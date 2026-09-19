import { expect, test } from '@playwright/test';

import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le scenario de navigation de l'etape 4.3: la vraie page, sur le vrai serveur.
 *
 * Il parcourt les ecrans du jalon 1 comme un joueur: l'accueil et son pseudo
 * refuse puis accepte, le salon et ses reglages refuses puis enregistres, le chat,
 * le lancement et son compte a rebours, la partie affichee par PixiJS, puis le
 * retour a l'accueil. La fin de partie n'y est pas: une partie dure au moins trente
 * secondes. Elle est jouee jusqu'au bout par parcours-solo.spec.ts et
 * multijoueur.spec.ts, qui y ajoutent les deplacements, la capture et la
 * coherence des scores.
 *
 * AUCUNE ERREUR NE DOIT APPARAITRE DANS LA CONSOLE. C'est ce qui verifie que la
 * politique de securite du contenu posee par le serveur ne bloque rien de ce dont
 * la page a besoin: le navigateur y signale chaque ressource refusee.
 *
 * Il tourne dans les deux cadrages, bureau et mobile.
 */

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('de l accueil a la partie, puis retour a l accueil', async ({ page, hasTouch }) => {
  // Un parcours entier, chargement de la carte compris, comme les autres parcours.
  // Avec le delai par defaut de trente secondes, il etait le seul a en manquer quand
  // les scenarios jouent en parallele sur la machine de developpement (etape 5.4).
  test.setTimeout(90_000);

  const erreurs = releverLesErreurs(page);
  const ecran = page.locator('.application');

  // -- L'accueil --------------------------------------------------------------
  await page.goto(jeu.url);
  await expect(page.getByRole('heading', { name: /Le ninja, c’est vous/u })).toBeVisible();

  const pseudo = page.getByPlaceholder('Votre pseudo');
  const jouer = page.getByRole('button', { name: 'Partie rapide' });

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
  await expect(page.locator('.terrain canvas')).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('.hud-temps')).toHaveText(/\d:\d\d/u, { timeout: 10_000 });
  await expect(page.locator('.hud-classement')).toContainText('Alice');

  if (hasTouch) {
    // Recette de l'etape 5.4: sur telephone, le bouton qui montre ou est notre ninja
    // n'etait qu'une petite icone parmi celles du haut de l'ecran, et le porteur du
    // projet ne l'a pas trouve. Le jeu d'origine le posait en bas, sous le pouce.
    const localiser = page.getByRole('button', { name: 'Localiser mon ninja' });
    await expect(localiser).toBeVisible();

    const boite = await localiser.boundingBox();
    const hauteurDeLEcran = page.viewportSize()?.height ?? 0;

    expect(boite?.height ?? 0, 'un bouton a la taille d un pouce').toBeGreaterThanOrEqual(56);
    expect(boite?.y ?? 0, 'dans la moitie basse de l ecran').toBeGreaterThan(hauteurDeLEcran / 2);
  }

  await page.locator('.jeu-actions').getByRole('button', { name: 'Quitter' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Quitter la partie ?' });
  await confirmation.getByRole('button', { name: 'Quitter' }).click();

  // -- Retour a l'accueil -----------------------------------------------------
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await expect(pseudo).toHaveValue('Alice');

  expect(erreurs).toEqual([]);
});

/**
 * Le referencement de l'etape 5.6: ce que lit un moteur de recherche qui n'execute
 * pas le jeu, et les fichiers qu'il demande. Avec le jeu, la presentation statique
 * cede sa place a l'accueil, sans erreur: le bloc de donnees structurees passe la
 * politique de securite du contenu.
 */
test('la page se presente sans le jeu, et sert ce que lisent les moteurs de recherche', async ({
  browser,
  page,
  request,
}) => {
  const sansJavaScript = await browser.newContext({ javaScriptEnabled: false });
  const lecteur = await sansJavaScript.newPage();

  await lecteur.goto(jeu.url);
  await expect(lecteur).toHaveTitle('Neon Ninja, jeu multijoueur gratuit dans le navigateur');
  await expect(lecteur.getByRole('heading', { level: 1 })).toContainText('Le ninja, c’est vous.');
  await expect(lecteur.getByRole('heading', { level: 2 })).toHaveText([
    'Horde',
    'Tactique',
    'Équipes',
    'Chasse',
    'Massacre',
  ]);
  await sansJavaScript.close();

  for (const [chemin, type] of [
    ['/robots.txt', 'text/plain'],
    ['/sitemap.xml', 'xml'],
    ['/icones/apercu.jpg', 'image/jpeg'],
  ] as const) {
    const reponse = await request.get(`${jeu.url}${chemin}`);

    expect(reponse.status(), chemin).toBe(200);
    expect(reponse.headers()['content-type'], chemin).toContain(type);
  }

  const erreurs = releverLesErreurs(page);

  await page.goto(jeu.url);
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'accueil');
  await expect(page.locator('.presentation')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
