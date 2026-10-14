/**
 * La panne de neons d'Among Ninjas, telle que le vrai rendu la dessine (etape 7.22, revue le
 * 14 octobre 2026).
 *
 * Pendant la panne, une proie vivante ne voit plus que le petit disque autour d'elle. A la
 * demande du porteur du projet, tout le reste est noir: le decor eteint, qui se devinait
 * encore sous un voile de 0,82, et l'ecran au-dela du bord de la carte, ou se voyait la
 * couleur du fond. Ce que les tests unitaires ne voient pas, et qu'il faut prouver dans un
 * vrai navigateur:
 *
 *   1. AUTOUR DU DISQUE, TOUT EST NOIR, sur la carte comme hors d'elle.
 *   2. LE DISQUE, LUI, MONTRE LE DECOR.
 *   3. HORS DE LA PANNE, RIEN NE CHANGE: le decor eteint se devine sous son voile, et le bord
 *      de la carte garde la couleur du fond.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/**
 * La page: Tokyo, a la demi-echelle sur 800 par 450 pixels, la camera posee pres du coin
 * haut gauche de la carte, si bien que la moitie gauche et le haut de l'ecran tombent hors
 * d'elle. Le disque de vision, de 110 pixels, est centre en (300, 200) sur la carte, soit en
 * (500, 275) a l'ecran.
 */
function pageDeLaPanne(voile: number): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Panne</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:800px;height:450px}</style>
<div class="hote" id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu } from '/paquets/client/rendu/pixi.js';

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2000, hauteur: 1500 },
    identifiantCarte: 'map1',
    modeMiroir: false,
    pluie: false,
    nuit: false,
    lueur: false,
    largeur: 800,
    hauteur: 450,
    densite: 1,
  });
  await rendu.chargerLeDecor();

  const scene = {
    disques: [],
    cones: [],
    zones: [],
    objets: [],
    entites: [],
    reperes: [],
    indicateur: { disques: [], parts: [], traits: [] },
    marques: [],
    fumees: [],
    mines: { disques: [], parts: [], traits: [] },
    explosions: [],
    impacts: [],
    sang: [],
    secousse: { x: 0, y: 0 },
    vision: { x: 300, y: 200, rayon: 110, voile: ${String(voile)} },
  };

  rendu.dessiner(scene, { x: 100, y: 150, echelle: 0.5 });
  rendu.application.render();
  const { pixels } = await Promise.resolve(
    rendu.application.renderer.extract.pixels({
      target: rendu.application.stage,
      frame: rendu.application.screen,
    }),
  );

  /** La luminosite moyenne d'un rectangle de l'ecran. */
  const luminosite = (gauche, haut, droite, bas) => {
    let somme = 0;
    let comptes = 0;
    for (let y = haut; y < bas; y += 1) {
      for (let x = gauche; x < droite; x += 1) {
        const i = (y * 800 + x) * 4;
        somme += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        comptes += 1;
      }
    }
    return somme / comptes;
  };

  // La camera en (100, 150) a la demi-echelle: l'ecran montre la carte de -700 a 900 en
  // largeur, de -300 a 600 en hauteur. Le bord gauche de la carte est a 350 a l'ecran, son
  // bord haut a 75.
  /**
   * L'opacite moyenne d'un rectangle, de 0 a 255. L'extraction ne rend pas la couleur du fond
   * du canevas: la ou rien n'est dessine, le pixel est transparent, et c'est elle qui s'y voit.
   */
  const opacite = (gauche, haut, droite, bas) => {
    let somme = 0;
    let comptes = 0;
    for (let y = haut; y < bas; y += 1) {
      for (let x = gauche; x < droite; x += 1) {
        somme += pixels[(y * 800 + x) * 4 + 3];
        comptes += 1;
      }
    }
    return somme / comptes;
  };

  window.panne = {
    horsCarte: luminosite(0, 0, 300, 450),
    opaciteHorsCarte: opacite(0, 0, 300, 450),
    surLaCarte: luminosite(620, 120, 800, 450),
    dansLeDisque: luminosite(480, 255, 520, 295),
  };
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({
    '/panne.html': pageDeLaPanne(1),
    '/vision.html': pageDeLaPanne(0.5),
  });
});

test.afterAll(async () => {
  await serveur.arreter();
});

interface Releve {
  readonly horsCarte: number;
  readonly opaciteHorsCarte: number;
  readonly surLaCarte: number;
  readonly dansLeDisque: number;
}

/** Charge une page et rend ce qu'elle a mesure. */
async function relever(page: Page, chemin: string): Promise<Releve> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}${chemin}`);
  await page.waitForFunction(() => (window as unknown as { panne?: unknown }).panne, null, {
    timeout: 60_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  return (await page.evaluate(() => (window as unknown as { panne: Releve }).panne)) as Releve;
}

test('pendant la panne, tout est noir autour du disque, sur la carte comme hors d elle', async ({
  page,
}, infos) => {
  const releve = await relever(page, '/panne.html');
  await page.locator('canvas').screenshot({ path: infos.outputPath('panne.png') });

  expect(releve.horsCarte, JSON.stringify(releve)).toBe(0);
  expect(releve.opaciteHorsCarte, JSON.stringify(releve)).toBe(255);
  expect(releve.surLaCarte, JSON.stringify(releve)).toBe(0);
  expect(releve.dansLeDisque, JSON.stringify(releve)).toBeGreaterThan(10);
});

test('hors de la panne, le decor eteint se devine et le bord garde la couleur du fond', async ({
  page,
}) => {
  const releve = await relever(page, '/vision.html');

  // Rien n'est dessine hors de la carte: la couleur du fond du canevas s'y voit.
  expect(releve.opaciteHorsCarte, JSON.stringify(releve)).toBe(0);
  expect(releve.surLaCarte, JSON.stringify(releve)).toBeGreaterThan(5);
});
