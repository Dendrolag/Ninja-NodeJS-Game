import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import {
  TIR_MS,
  placerLesBateaux,
} from '../../../packages/client/dist/interface/modeles/gestes/bataille.js';
import {
  VITESSE_DU_CADRAN,
  creerFrequence,
} from '../../../packages/client/dist/interface/modeles/gestes/frequence.js';
import { creerFusibles } from '../../../packages/client/dist/interface/modeles/gestes/fusibles.js';
import { graineDuGeste } from '../../../packages/client/dist/interface/modeles/gestes/index.js';
import { graineDeLaReparation } from '../../../packages/client/dist/interface/modeles/gestes/reparations.js';

/**
 * Faire au clavier, dans une page, le geste d'une tache courte d'Among Ninjas (etape 7.21).
 *
 * La page ne dit pas l'etat du geste: le scenario lit la nature de la tache sur la fenetre
 * (data-nature), et joue le geste comme un joueur au clavier, en regardant ou il en est
 * (« 2 sur 4 », lu par les lecteurs d'ecran). Chaque etape attend la fin de l'animation de la
 * precedente, comme un joueur patient.
 *
 * Le relier des couleurs ne sait pas quel nom va avec quelle couleur: il essaie les noms un a
 * un, comme un joueur qui ne distingue pas les couleurs et lit les noms, a ceci pres qu'il ne
 * les lit pas. Un essai rate ne coute que du temps.
 */

/** Ou en est le geste: les etapes faites et leur total, lus dans la fenetre. */
async function avancement(page: Page): Promise<{ faits: number; total: number }> {
  const texte = (await page.locator('.tache-avancement').textContent()) ?? '';
  const [faits, total] = texte.split(' sur ').map((nombre) => Number.parseInt(nombre, 10));

  return { faits: faits ?? 0, total: total ?? 0 };
}

/** Attend que le geste ait avance d'une etape, ou rien au bout de ce delai. */
async function attendreUneEtape(page: Page, avant: number, delaiMs: number): Promise<boolean> {
  try {
    await expect
      .poll(async () => (await avancement(page)).faits, { timeout: delaiMs })
      .toBeGreaterThan(avant);
    return true;
  } catch {
    return false;
  }
}

/** Tient Espace ce temps, en millisecondes. */
async function tenirEspace(page: Page, dureeMs: number): Promise<void> {
  await page.keyboard.down(' ');
  await page.waitForTimeout(dureeMs);
  await page.keyboard.up(' ');
}

/**
 * Fait le geste de la fenetre ouverte, au clavier, jusqu'a sa derniere etape, ou jusqu'a ce
 * nombre d'etapes faites, pour s'arreter en route.
 */
export async function faireLeGesteAuClavier(page: Page, jusqua?: number): Promise<void> {
  const fenetre = page.locator('.tache-fenetre');
  await expect(fenetre).toBeVisible();
  const nature = await fenetre.getAttribute('data-nature');

  for (let essai = 0; essai < 40; essai += 1) {
    const { faits, total } = await avancement(page);

    if (total > 0 && faits >= Math.min(jusqua ?? total, total)) {
      return;
    }

    switch (nature) {
      case 'katana':
        await page.keyboard.press('ArrowRight');
        await attendreUneEtape(page, faits, 2000);
        await page.waitForTimeout(700);
        break;

      case 'lunettes':
      case 'sang':
        // Espace tenue frotte la zone choisie, et passe seule a la suivante.
        await tenirEspace(page, 1800);
        break;

      case 'mines':
      case 'munitions':
        await page.keyboard.press(' ');
        await attendreUneEtape(page, faits, 2000);
        await page.waitForTimeout(950);
        break;

      case 'fumee':
        // La jauge se remplit en une seconde et demie: la bande est vers 77 pour cent.
        await tenirEspace(page, 1150);
        await page.waitForTimeout(500);
        break;

      case 'couleurs':
        // Droite vers les noms, le nom suivant, Espace: un essai par nom.
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press(' ');
        await page.waitForTimeout(1000);
        break;

      default:
        throw new Error(`Geste inconnu: ${String(nature)}`);
    }
  }

  throw new Error(`Le geste ${String(nature)} ne se finit pas.`);
}

/**
 * Joue au clavier la bataille navale de la fenetre ouverte (etape 7.24), sans un tir rate: les
 * bateaux se tirent dans la page d'une graine qui ne doit rien au hasard (le joueur, la station,
 * la tache), que le scenario refait. Il vise chaque case des bateaux depuis la case du milieu,
 * et attend l'animation de chaque tir, comme un joueur qui saurait ou tirer.
 */
export async function jouerLaBatailleAuClavier(page: Page, joueur: string): Promise<void> {
  const fenetre = page.locator('.tache-fenetre');
  await expect(fenetre).toHaveAttribute('data-nature', 'bataille');
  const station = (await page.locator('.tache-station').textContent()) ?? '';
  const bateaux = placerLesBateaux(graineDuGeste(joueur, station, 'bataille'));
  let colonne = 2;
  let ligne = 2;

  for (const [cible, rang] of bateaux.flat()) {
    for (; colonne !== cible; colonne += colonne < cible ? 1 : -1) {
      await page.keyboard.press(colonne < cible ? 'ArrowRight' : 'ArrowLeft');
    }
    for (; ligne !== rang; ligne += ligne < rang ? 1 : -1) {
      await page.keyboard.press(ligne < rang ? 'ArrowDown' : 'ArrowUp');
    }
    await page.keyboard.press(' ');
    await page.waitForTimeout(TIR_MS + 300);
  }
}

/** Ou en est le geste de la reparation ouverte, lu dans sa fenetre (etape 7.27). */
async function avancementDeLaReparation(page: Page): Promise<{ faits: number; total: number }> {
  const texte = (await page.locator('.reparation-avancement').textContent()) ?? '';
  const [faits, total] = texte.split(' sur ').map((nombre) => Number.parseInt(nombre, 10));

  return { faits: faits ?? 0, total: total ?? 0 };
}

/**
 * Repare la panne de neons au clavier, dans la fenetre de la reparation ouverte au boitier
 * (etape 7.27), comme un joueur patient: la reparation que la partie a tiree se lit sur la
 * fenetre (data-etape). Les fusibles grilles et la frequence de depart se tirent dans la page
 * d'une graine qui ne doit rien au hasard (le joueur, le poste, le geste), que le scenario refait.
 */
export async function reparerLaPanneAuClavier(page: Page, joueur: string): Promise<void> {
  const fenetre = page.locator('.reparation-fenetre');
  await expect(fenetre).toBeVisible();
  const geste = await fenetre.getAttribute('data-etape');

  switch (geste) {
    case 'lanceur':
      // Le lanceur: Espace tenue jusqu'au vert, vers 77 pour cent; le moteur tousse s'il est
      // rate, et l'on retire. Puis les trois disjoncteurs, par la fleche haut.
      for (
        let essai = 0;
        essai < 5 && (await avancementDeLaReparation(page)).faits === 0;
        essai += 1
      ) {
        await page.keyboard.down(' ');
        await page.waitForTimeout(1150);
        await page.keyboard.up(' ');
        await page.waitForTimeout(800);
      }
      for (let disjoncteur = 0; disjoncteur < 3; disjoncteur += 1) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(600);
      }
      return;

    case 'fusibles': {
      const { grilles } = creerFusibles(graineDeLaReparation(joueur, 'boitier', 'fusibles'));
      for (const rang of grilles) {
        // Retour en haut a gauche, puis jusqu'au fusible grille.
        for (const touche of ['ArrowUp', 'ArrowLeft', 'ArrowLeft']) {
          await page.keyboard.press(touche);
        }
        for (let colonne = 0; colonne < rang % 3; colonne += 1) {
          await page.keyboard.press('ArrowRight');
        }
        if (rang >= 3) {
          await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press(' ');
        await page.waitForTimeout(800);
      }
      await page.keyboard.press('ArrowDown');
      return;
    }

    case 'frequence': {
      // La fleche tenue le temps que le cadran arrive sur la cible, a sa vitesse, puis lachee:
      // la courbe se tient alors d'elle-meme dans la tolerance.
      const { cible, valeur } = creerFrequence(
        graineDeLaReparation(joueur, 'boitier', 'frequence'),
      );
      const touche = cible > valeur ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(touche);
      await page.waitForTimeout((Math.abs(cible - valeur) / VITESSE_DU_CADRAN) * 1000);
      await page.keyboard.up(touche);
      await page.waitForTimeout(1300);
      return;
    }

    default:
      throw new Error(`Reparation de la panne inconnue: ${String(geste)}`);
  }
}
