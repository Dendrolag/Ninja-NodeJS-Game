import { expect, test } from '@playwright/test';

import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Les credits (etape 4.7), sur la vraie page et le vrai serveur.
 *
 * Depuis le pied de l'accueil, on ouvre la fenetre, on lit les deux lignes, on la
 * ferme au clavier puis d'un geste, et le badge « Prototype » se lit sur les vignettes
 * des decors provisoires. Il tourne dans les deux cadrages: sur telephone, le pied
 * passe sur deux lignes et le bouton doit rester a portee du pouce.
 */

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('les credits s ouvrent depuis le pied de l accueil', async ({ page, hasTouch }) => {
  const erreurs = releverLesErreurs(page);

  await page.goto(jeu.url);

  const pied = page.locator('.accueil-pied');
  const bouton = pied.getByRole('button', { name: 'Crédits' });
  const credits = page.getByRole('dialog', { name: 'Crédits' });

  await expect(pied).toContainText('Version');
  await expect(credits).toBeHidden();

  // Au clavier: le bouton prend le focus, la touche Entree l'ouvre, Echap la ferme.
  await bouton.focus();
  await page.keyboard.press('Enter');
  await expect(credits).toBeVisible();
  await expect(credits).toContainText('Neon Ninja est une création originale de Dendrolag.');
  await expect(credits).toContainText(
    'Avec l’aimable participation de Bribz pour la carte Tokyo et les ninjas.',
  );
  await page.keyboard.press('Escape');
  await expect(credits).toBeHidden();
  await expect(bouton).toBeFocused();

  // D'un geste: au doigt sur telephone, a la souris sur ordinateur, puis la croix.
  if (hasTouch) {
    await bouton.tap();
  } else {
    await bouton.click();
  }

  await expect(credits).toBeVisible();
  await credits.getByRole('button', { name: 'Fermer' }).click();
  await expect(credits).toBeHidden();

  expect(erreurs).toEqual([]);
});

test('les decors provisoires portent le badge Prototype au choix de la carte', async ({ page }) => {
  await page.goto(jeu.url);
  await page.getByRole('button', { name: 'Créer une partie' }).click();

  const vignette = (nom: string) => page.locator('.carte-choix', { hasText: nom });

  await expect(vignette('Spirit & Time').locator('.carte-prototype')).toBeVisible();
  await expect(vignette('Quartier').locator('.carte-prototype')).toBeVisible();
  await expect(vignette('Tokyo').locator('.carte-prototype')).toHaveCount(0);
});
