/**
 * Les deux projets de tests de Vitest.
 *
 * `unitaires`: tout ce qui tourne sans base de donnees. Les tests unitaires vivent
 * a cote du code qu'ils couvrent, dans packages/; les tests transverses (dont la
 * verification de l'invariant de purete) dans tests/, hors du dossier e2e qui
 * appartient a Playwright.
 *
 * `base`: les tests d'integration de la base (etape 3.1). Avant eux, une branche
 * Neon est creee, videe et migree; apres eux, elle est supprimee. Voir
 * tests/base/branche-de-test.ts. Vitest ne prepare cette branche que si au moins
 * un test de la base est selectionne: `pnpm test packages/sim` ne touche pas a
 * Neon.
 *
 * Les deux etendent vitest.config.ts, qui porte les alias vers les sources des
 * paquets et la couverture.
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unitaires',
      include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'tests/base/**', 'legacy/**'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'base',
      include: ['tests/base/**/*.test.ts'],
      globalSetup: ['tests/base/branche-de-test.ts'],
      // Une base Neon en veille met quelques secondes a se reveiller, et la
      // preparation de la branche en prend davantage.
      testTimeout: 30_000,
      hookTimeout: 180_000,
    },
  },
]);
