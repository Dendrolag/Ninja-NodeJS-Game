import { expect, test } from '@playwright/test';

import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Un lien perdu sur l'accueil, retabli sans recharger la page: le scenario de l'etape 2.6.
 *
 * Alice ouvre le jeu et saisit son pseudo. Le serveur s'eteint, comme pour une mise en
 * ligne: la page doit dire que la connexion est perdue et qu'elle se retablit, sans
 * laisser jouer ni proposer de recharger. Le serveur se rallume a la meme adresse: la
 * page doit retrouver le lien d'elle-meme, garder ce qu'Alice avait saisi, et la
 * laisser entrer dans une partie. Un temoin pose dans la page prouve qu'elle n'a pas
 * ete rechargee.
 *
 * CE QUE LA CONSOLE DIT PENDANT L'EXTINCTION EST ATTENDU. Chaque essai d'ouverture sur
 * un serveur eteint fait ecrire au navigateur un echec de WebSocket; toute autre erreur
 * fait echouer le scenario.
 */

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('un lien perdu sur l accueil se retablit sans recharger la page', async ({ page }) => {
  const erreurs = releverLesErreurs(page);
  const partieRapide = page.getByRole('button', { name: 'Partie rapide' });
  const lien = page.locator('.accueil-lien');

  await page.goto(jeu.url);
  await page.getByPlaceholder('Votre pseudo').fill('Alice');
  await expect(partieRapide).toBeEnabled();
  await page.evaluate(() => {
    Object.assign(globalThis, { temoinDeLaPage: 'avant la coupure' });
  });

  await jeu.eteindre();

  await expect(lien).toHaveText('Connexion perdue. Reconnexion…');
  await expect(partieRapide).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Recharger la page' })).toBeHidden();

  // Que la page ait le temps d'essayer au moins une fois sur un serveur eteint.
  await page.waitForTimeout(4000);
  await expect(lien).toHaveText('Connexion perdue. Reconnexion…');

  await jeu.rallumer();

  // Un essai toutes les trois secondes: le lien revient dans ce delai.
  await expect(lien).toBeHidden({ timeout: 10_000 });
  await expect(page.getByPlaceholder('Votre pseudo')).toHaveValue('Alice');
  await expect(partieRapide).toBeEnabled();
  expect(await page.evaluate(() => Reflect.get(globalThis, 'temoinDeLaPage'))).toBe(
    'avant la coupure',
  );

  await partieRapide.click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'salon');

  expect(erreurs.filter((erreur) => !erreur.includes('WebSocket connection to'))).toEqual([]);
});
