import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  approcherUnFauxNinja,
  attendreLaPartie,
  expliquerLEchec,
  lancer,
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
      await accomplir(approcherUnFauxNinja(partie, 'Alice', commande, DISTANCE_DE_TIR_PX));

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
