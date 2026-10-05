import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { notesParues } from '../../packages/client/dist/interface/modeles/notesDeVersion.js';
import { NUMERO_DE_VERSION } from '../../packages/shared/dist/index.js';
import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Les nouveautes (etape 4.9), sur la vraie page et le vrai serveur.
 *
 * Un joueur qui revient, venu avant que les notes existent, la lit a l'accueil; il la
 * ferme, elle ne revient pas au rechargement, et le numero du pied la rouvre. Un
 * joueur tout nouveau ne la voit pas. Il tourne dans les deux cadrages, et laisse une
 * capture de la note ouverte dans chacun.
 */

const TITRE = 'Nouveautés';

/** Les notes parues: toutes s'affichent, la plus recente en tete. */
const NOTES = notesParues(NUMERO_DE_VERSION);

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** Fait de ce navigateur celui d'un joueur deja venu: il a regle le son. */
async function devenirUnHabitue(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('neon-ninja.son', '{"volumeMusique":0.2}');
  });
}

test('la note s ouvre a un joueur qui revient, une fois, et se rouvre par le numero', async ({
  page,
  hasTouch,
}, info) => {
  const erreurs = releverLesErreurs(page);
  const note = page.getByRole('dialog', { name: TITRE });

  await page.goto(jeu.url);
  await devenirUnHabitue(page);
  await page.reload();

  await expect(note).toBeVisible();
  await expect(note.getByRole('heading', { level: 3 })).toHaveText(
    NOTES.map((parue) => `${parue.version} · ${parue.titre}`),
  );
  // La capture attend la fin de l'animation d'apparition, qui fait glisser la fenetre.
  await note.evaluate((cadre) => Promise.all(cadre.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: info.outputPath(`note-de-version-${info.project.name}.png`) });

  await note.getByRole('button', { name: 'À l’attaque' }).click();
  await expect(note).toBeHidden();

  // Fermee, elle ne revient pas.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Partie rapide' })).toBeVisible();
  await expect(note).toBeHidden();

  // Le numero du pied la rouvre, au doigt ou a la souris; Echap la referme.
  const numero = page.locator('.accueil-pied').getByRole('button', {
    name: new RegExp(`^V${NUMERO_DE_VERSION.replaceAll('.', '\\.')}`),
  });

  if (hasTouch) {
    await numero.tap();
  } else {
    await numero.click();
  }

  await expect(note).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(note).toBeHidden();
  await expect(numero).toBeFocused();

  expect(erreurs).toEqual([]);
});

test('la note ne s ouvre pas pour un joueur tout nouveau', async ({ page }) => {
  const erreurs = releverLesErreurs(page);

  await page.goto(jeu.url);
  await expect(page.getByRole('button', { name: 'Partie rapide' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: TITRE })).toBeHidden();

  // Il revient: il a deja vu cette version, la note n'a rien a lui apprendre.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Partie rapide' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: TITRE })).toBeHidden();

  expect(erreurs).toEqual([]);
});
