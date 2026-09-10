import { expect, test } from '@playwright/test';

import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le scenario de navigation de l'etape 4.3: la vraie page, sur le vrai serveur.
 *
 * Il parcourt les ecrans du jalon 1 comme un joueur: l'accueil et son pseudo
 * refuse puis accepte, le salon et ses reglages refuses puis enregistres, le chat,
 * le lancement et son compte a rebours, la partie affichee par PixiJS, puis le
 * retour a l'accueil. La fin de partie n'y est pas: une partie dure au moins trente
 * secondes, et l'ecran de fin est couvert dans un document par
 * packages/client/src/interface/ecrans/fin.test.ts.
 *
 * AUCUNE ERREUR NE DOIT APPARAITRE DANS LA CONSOLE. C'est ce qui verifie que la
 * politique de securite du contenu posee par le serveur ne bloque rien de ce dont
 * la page a besoin: le navigateur y signale chaque ressource refusee.
 *
 * Il tourne dans les deux cadrages, bureau et mobile. Le parcours a plusieurs
 * clients, la capture et la cohérence des scores appartiennent a l'etape 4.4.
 */

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('de l accueil a la partie, puis retour a l accueil', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreurs.push(message.text());
    }
  });
  page.on('pageerror', (erreur) => {
    erreurs.push(erreur.message);
  });

  const ecran = page.locator('.application');

  // -- L'accueil --------------------------------------------------------------
  await page.goto(jeu.url);
  await expect(page.getByRole('heading', { name: /Prêt à frapper/u })).toBeVisible();

  const pseudo = page.getByPlaceholder('Votre pseudo');
  const jouer = page.getByRole('button', { name: 'Jouer' });

  await pseudo.fill('Al<i>ce');
  await expect(page.locator('.accueil-erreur')).toContainText("n'accepte que");
  await expect(jouer).toBeDisabled();

  await pseudo.fill('Alice');
  await jouer.click();

  // -- Le salon ---------------------------------------------------------------
  await expect(ecran).toHaveAttribute('data-ecran', 'salon');
  await expect(page.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();

  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const reglages = page.getByRole('dialog', { name: 'Réglages de la partie' });
  const dureeDuBoost = reglages.locator('[data-chemin="bonus.types.vitesse.dureeS"]');
  const enregistrer = reglages.getByRole('button', { name: 'Enregistrer' });

  await dureeDuBoost.fill('50');
  await expect(reglages.getByText('Ce réglage doit se trouver entre 5 et 30')).toBeVisible();
  await expect(enregistrer).toBeDisabled();

  await dureeDuBoost.fill('20');
  await reglages.getByText('Spirit & Time').click();
  await enregistrer.click();
  await expect(reglages).toBeHidden();
  await expect(page.locator('.recapitulatif')).toContainText('Spirit & Time');

  const message = page.getByRole('textbox', { name: 'Message' });
  await message.fill('<b>prêt</b>');
  await message.press('Enter');
  await expect(page.locator('.chat-texte')).toHaveText('<b>prêt</b>');

  await page.getByRole('button', { name: 'Lancer la partie' }).click();
  await expect(page.getByText('La partie commence dans')).toBeVisible();

  // -- La partie --------------------------------------------------------------
  await expect(ecran).toHaveAttribute('data-ecran', 'jeu', { timeout: 15_000 });
  await expect(page.locator('.terrain canvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.hud-temps')).toHaveText(/\d:\d\d/u, { timeout: 10_000 });
  await expect(page.locator('.hud-classement')).toContainText('Alice');

  await page.locator('.jeu-actions').getByRole('button', { name: 'Quitter' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Quitter la partie ?' });
  await confirmation.getByRole('button', { name: 'Quitter' }).click();

  // -- Retour a l'accueil -----------------------------------------------------
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await expect(pseudo).toHaveValue('Alice');

  expect(erreurs).toEqual([]);
});
