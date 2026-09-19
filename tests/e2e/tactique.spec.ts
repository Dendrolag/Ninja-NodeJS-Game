import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CONE_TACTIQUE } from '../../packages/sim/dist/index.js';
import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  approcherUnFauxNinja,
  attendreLaPartie,
  expliquerLEchec,
  lancer,
  ramasserUnBonusTactique,
  regler,
  releverLesErreurs,
  releverLesSignesVitaux,
} from './harnais/parcours.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le mode Tactique de l'etape 7.1, joue dans la page.
 *
 * Alice cree une partie Tactique depuis l'ecran de creation, et le salon lui dit
 * comment on y capture. Elle la lance, voit le bouton Capturer et ses cinq charges,
 * s'approche d'un faux ninja, puis tire: le serveur lui compte un faux ninja, et le
 * bouton montre une charge de moins. Avant son premier tir reussi, elle n'en porte
 * aucun: la frolant en chemin, elle ne l'aurait pas capture.
 *
 * JOUE DANS LES DEUX CADRAGES. Sur bureau, Alice se deplace au clavier et tire a la
 * barre d'espace. En fenetre mobile, elle se deplace au pouce et tire du bouton.
 *
 * UN TIR PEUT MANQUER, ET LE SCENARIO REPREND L'APPROCHE. Entre l'arret du pilote a
 * portee et le depart du tir, le faux ninja a pu sortir du cone; un tir sans effet ne
 * coute rien.
 *
 * LES ZONES SPECIALES SONT COUPEES: une zone de chaos repeint des faux ninjas au
 * hasard, et pourrait en donner un a Alice sans qu'elle ait tire.
 */

/** Une partie assez longue pour plusieurs approches, et peuplee. */
const PARTIE_TACTIQUE = {
  dureePartieS: '90',
  nombreBotsInitial: '100',
  'zones.actives': false,
} as const;

/** A cette distance d'un faux ninja, en pixels, Alice s'arrete pour tirer: bien dans la portee. */
const DISTANCE_DE_TIR_PX = 60;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** Alice cree une partie Tactique depuis l'ecran de creation, et attend son salon. */
async function creerUnePartieTactique(page: Page): Promise<void> {
  await page.goto(jeu.url);
  await page.getByPlaceholder('Votre pseudo').fill('Alice');
  await page.getByRole('button', { name: 'Créer une partie' }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'creation');
  await page.locator('label.tuile-choix[data-mode="tactique"]').click();
  await expect(page.locator('.creation-recapitulatif h2')).toHaveText(/^Tactique · /u);
  await page.getByRole('button', { name: 'Créer le salon' }).click();
  await expect(page.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
}

test('creer une partie Tactique, s approcher d un faux ninja et le prendre par un tir', async ({
  page,
  hasTouch,
}) => {
  // La partie, son compte a rebours, le chargement de la carte et plusieurs approches.
  test.setTimeout(180_000);

  const erreurs = releverLesErreurs(page);
  const signes = await releverLesSignesVitaux(page);

  // -- La creation et le salon -------------------------------------------------
  await creerUnePartieTactique(page);
  await expect(page.locator('.salon-regle')).toContainText('cône');
  await regler(page, PARTIE_TACTIQUE);
  await lancer(page);

  // -- La partie ---------------------------------------------------------------
  await attendreLaPartie(page);
  const partie = jeu.partie();
  expect(partie.mode).toBe('tactique');

  const bouton = page.locator('.hud-capture');
  await expect(bouton).toBeVisible();
  await expect(bouton.locator('.hud-charge')).toHaveCount(5);

  if (!hasTouch) {
    await expect(page.locator('.jeu-rappel')).toContainText('Espace pour capturer');
  }

  const commande = hasTouch ? await commandeAuPouce(page) : commandeAuClavier(page);
  const tirer = async (): Promise<void> => {
    await (hasTouch ? bouton.tap() : page.keyboard.press('Space'));
  };
  const fauxNinjasDAlice = (): number =>
    partie.classement().find((ligne) => ligne.pseudo === 'Alice')?.botsPortes ?? 0;

  await expliquerLEchec({ Alice: signes }, async () => {
    await expect(async () => {
      await accomplir(
        approcherUnFauxNinja(partie, 'Alice', commande, DISTANCE_DE_TIR_PX, CONE_TACTIQUE),
      );

      // Toucher ne capture pas: avant son premier tir reussi, Alice ne porte rien.
      expect(fauxNinjasDAlice()).toBe(0);

      await tirer();
      await expect.poll(fauxNinjasDAlice, { timeout: 2_000 }).toBeGreaterThan(0);
    }).toPass({ timeout: 120_000 });
  });

  // Un tir qui a capture coute une charge, qui revient en cinq secondes.
  await expect(bouton.locator('.hud-charge.pleine')).not.toHaveCount(5, { timeout: 4_000 });

  expect(erreurs).toEqual([]);
});

/**
 * Les objets du Tactique de l'etape 7.7: Alice ramasse un bonus du mode, et la page le dit.
 *
 * Les trois bonus du Tactique apparaissent a coup sur toutes les deux secondes, et les
 * autres objets sont coupes, pour qu'Alice trouve vite le sien. Elle le ramasse; le HUD
 * nomme son effet, et l'arc de ses charges est sous son ninja (capture d'ecran jointe au
 * rapport, a relire a l'oeil).
 */
test('ramasser un bonus du Tactique et le voir agir', async ({ page, hasTouch }, infos) => {
  test.setTimeout(120_000);

  const erreurs = releverLesErreurs(page);
  const signes = await releverLesSignesVitaux(page);

  await creerUnePartieTactique(page);
  await regler(page, {
    dureePartieS: '90',
    'zones.actives': false,
    'botsNoirs.actifs': false,
    'malus.actifs': false,
    'bonus.intervalleApparitionS': '2',
    'bonus.types.vitesse.actif': false,
    'bonus.types.invincibilite.actif': false,
    'bonus.types.revelation.actif': false,
    'objetsTactiques.bonus.rafale.tauxApparitionPourCent': '100',
    'objetsTactiques.bonus.rechargeRapide.tauxApparitionPourCent': '100',
    'objetsTactiques.bonus.viseeLarge.tauxApparitionPourCent': '100',
  });
  await lancer(page);
  await attendreLaPartie(page);
  const partie = jeu.partie();

  const commande = hasTouch ? await commandeAuPouce(page) : commandeAuClavier(page);

  await expliquerLEchec({ Alice: signes }, async () => {
    await expect(async () => {
      await accomplir(ramasserUnBonusTactique(partie, 'Alice', commande));
    }).toPass({ timeout: 60_000 });
  });

  await expect(page.locator('.hud-effet-libelle')).toContainText(
    /Rafale|Recharge rapide|Visée large/u,
  );
  await page.screenshot({ path: infos.outputPath('bonus-du-tactique.png') });

  expect(erreurs).toEqual([]);
});
