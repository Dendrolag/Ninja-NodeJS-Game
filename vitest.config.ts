import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/** Chemin absolu d'un fichier du depot, ecrit relativement a ce fichier de configuration. */
const chemin = (relatif: string): string => fileURLToPath(new URL(relatif, import.meta.url));

export default defineConfig({
  // Les tests lisent les paquets du depot dans leurs sources TypeScript, pas
  // dans leur compilation. Sans cela, un test peut tourner contre un dist
  // perime et passer au vert alors que le code a change: exactement le genre de
  // faux positif que ce projet cherche a eviter.
  resolve: {
    alias: {
      '@neon-ninja/shared': chemin('./packages/shared/src/index.ts'),
      '@neon-ninja/sim': chemin('./packages/sim/src/index.ts'),
    },
  },
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
      // Exclus: les tests eux-memes, et les fichiers sans code executable (les
      // points d'entree qui ne font que reexporter, les fichiers de types).
      // Les compter reviendrait a mesurer la couverture de lignes vides.
      exclude: ['**/*.test.ts', '**/index.ts', '**/geometrie.ts'],
    },
  },
});
