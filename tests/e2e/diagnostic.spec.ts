import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { attendreLaFin, attendreLaPartie, entrer, lancer, regler } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le relevé de performance de l'étape 8.5: il s'ouvre par l'adresse, et seulement par elle.
 *
 * Avec `?diagnostic=1`, un panneau montre la cadence et les saccades pendant la partie, et
 * son bouton copie un relevé complet. Sans le paramètre, le panneau n'existe pas, ni à
 * l'accueil ni en partie. Une variante de l'adresse change le montage du rendu, et le
 * relevé dit laquelle était en place.
 *
 * JOUÉ PAR LE SEUL PROJET BUREAU. Le relevé ne dépend pas du cadrage, et le presse-papiers
 * se lit plus simplement sur un Chromium de bureau.
 */

/** Une partie courte et peu peuplée: le relevé n'a besoin que de quelques secondes. */
const PARTIE_COURTE = { dureePartieS: '30', nombreBotsInitial: '50' } as const;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

/**
 * Entre, règle une partie courte, la lance et attend qu'elle soit jouable.
 *
 * Sans HUD, le temps de la partie ne s'écrit jamais: on attend alors seulement que le
 * terrain soit dessiné.
 */
async function jouerUnePartie(page: Page, adresse: string, hud = true): Promise<void> {
  await entrer(page, adresse, 'Alice');
  await regler(page, PARTIE_COURTE);
  await lancer(page);

  if (hud) {
    await attendreLaPartie(page);
    return;
  }

  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'jeu', {
    timeout: 15_000,
  });
  await expect(page.locator('.jeu-chargement')).toBeHidden({ timeout: 40_000 });
}

/** Copie le relevé par son bouton, et le rend tel que le presse-papiers le contient. */
async function copierLeReleve(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Copier le relevé' }).click();
  await expect(page.locator('.diagnostic-copier')).toHaveText('Copié');

  return page.evaluate(async () => navigator.clipboard.readText());
}

test('sans le paramètre, aucun relevé, ni à l accueil ni en partie', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto(jeu.url);
  await expect(page.getByPlaceholder('Votre pseudo')).toBeVisible();
  await expect(page.locator('.diagnostic')).toHaveCount(0);

  await jouerUnePartie(page, jeu.url);
  await expect(page.locator('.diagnostic')).toHaveCount(0);
});

test('avec le paramètre, le relevé suit la partie et se copie', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: jeu.url });

  await page.goto(`${jeu.url}/?diagnostic=1`);
  await expect(page.locator('.diagnostic')).toContainText('en attente d’une partie');

  await jouerUnePartie(page, `${jeu.url}/?diagnostic=1`);

  // La cadence se lit dès que la partie tourne.
  await expect(page.locator('.diagnostic-resume')).toHaveText(/^[1-9]\d* i\/s · p90 /u, {
    timeout: 10_000,
  });

  const releve = await copierLeReleve(page);

  expect(releve).toContain('Relevé de performance Neon Ninja');
  expect(releve).toContain('Variantes: aucune');
  expect(releve).toMatch(/Partie: carte \w+, mode classique, 50 PNJ au départ/u);
  expect(releve).toMatch(/Rendu: webgl/u);
  expect(releve).toMatch(/Instantanés reçus: [1-9]/u);
  expect(releve).toMatch(/Notre code: moyenne \d/u);
  expect(releve).toMatch(/PixiJS: moyenne \d/u);
  expect(releve).toContain('== Serveur, battements de toutes ses parties');

  // A la fin de la partie, la page lit les battements du serveur (etape 8.6): le releve
  // copie sur l'ecran des resultats dit ce que le serveur a envoye.
  await attendreLaFin(page);
  await expect(async () => {
    const final = await copierLeReleve(page);
    expect(final).toMatch(/Écart entre deux battements d'une partie, 50 ms visés: médiane \d/u);
  }).toPass({ timeout: 15_000 });
});

test('une variante de l adresse change le rendu, et le relevé la nomme', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: jeu.url });

  await jouerUnePartie(page, `${jeu.url}/?diagnostic=1&densite=1&cadence=20&hud=0&son=0`, false);

  await expect(page.locator('.hud-temps')).toHaveText('');
  await expect(page.locator('.diagnostic-resume')).toHaveText(/^[1-9]\d* i\/s/u, {
    timeout: 10_000,
  });

  const releve = await copierLeReleve(page);

  expect(releve).toContain('Variantes: densité 1, cadence 20, sans son, sans HUD');
  expect(releve).toMatch(/Rendu: webgl.*, densité 1,/u);

  // Plafonnée à vingt images par seconde, la cadence mesurée ne la dépasse pas.
  const cadence = /Durée mesurée: [\d,]+ s, \d+ images, ([\d,]+) par seconde/u.exec(releve);
  expect(Number(cadence?.[1]?.replace(',', '.'))).toBeLessThanOrEqual(21);
});
