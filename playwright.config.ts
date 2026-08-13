import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour les tests de bout en bout.
 *
 * A l'etape 0.1, il n'y a qu'un scenario de fumee qui ne demarre aucun serveur.
 * Le vrai parcours multi-clients arrive a l'etape 4.4, et c'est alors qu'un
 * bloc webServer sera ajoute pour lancer le jeu avant les tests.
 *
 * Le projet mobile est declare des maintenant parce que la decision du 29 juin
 * exige une verification en fenetre mobile, meme si le bureau reste prioritaire.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Interdit un test.only oublie dans une branche poussee.
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'bureau',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
