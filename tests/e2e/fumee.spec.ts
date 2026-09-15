import { expect, test } from '@playwright/test';

/**
 * Scenario de fumee de l'etape 0.1.
 *
 * Il ne teste pas le jeu. Il prouve seulement que Playwright est installe, que
 * les navigateurs se lancent, et que la chaine de bout en bout tourne en local
 * comme en integration continue: quand un parcours echoue, ce scenario dit si
 * c'est le jeu ou l'outillage.
 *
 * Il ne demarre aucun serveur: la page est fournie directement au navigateur.
 * Les parcours du jeu sont dans navigation.spec.ts, parcours-solo.spec.ts et
 * multijoueur.spec.ts.
 */
test.describe('harnais de bout en bout', () => {
  test('le navigateur se lance et rend une page', async ({ page }) => {
    await page.setContent(
      '<!doctype html><meta charset="utf-8"><title>Neon Ninja</title><h1 id="titre">Neon Ninja</h1>',
    );

    await expect(page.locator('#titre')).toHaveText('Neon Ninja');
    await expect(page).toHaveTitle('Neon Ninja');
  });

  test('le navigateur execute du JavaScript', async ({ page }) => {
    await page.setContent('<!doctype html><div id="cible"></div>');
    await page.evaluate(() => {
      const cible = document.querySelector('#cible');
      if (cible) cible.textContent = String(2 + 3);
    });

    await expect(page.locator('#cible')).toHaveText('5');
  });
});
