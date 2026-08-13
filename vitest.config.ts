import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Les tests unitaires vivent a cote du code qu'ils couvrent, dans packages/.
    // Les tests transverses (dont la verification de l'invariant de purete)
    // vivent dans tests/, hors du dossier e2e qui appartient a Playwright.
    include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'legacy/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      // La cible de couverture exigeante porte sur le coeur de simulation
      // uniquement. Voir la section « Cible de couverture » de CLAUDE.md.
      include: ['packages/sim/src/**/*.ts', 'packages/shared/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
