// Configuration ESLint du monorepo, en format plat (ESLint 9).
//
// Deux niveaux:
//   1. des regles generales appliquees a tout le code TypeScript du depot;
//   2. un bloc dedie a packages/sim qui fait respecter l'invariant de purete.
//
// Le dossier legacy/ est entierement exclu: c'est une reference en lecture seule,
// on ne la corrige pas et on ne la reformate pas.

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Modules interdits dans packages/sim.
 * Chaque entree porte son message d'explication, pour que la violation soit
 * comprehensible sans avoir a ouvrir la documentation.
 */
const IMPORTS_INTERDITS_DANS_SIM = [
  {
    name: 'socket.io',
    message: 'Le coeur de simulation ne fait pas de reseau. Le Socket.IO vit dans packages/server.',
  },
  {
    name: 'socket.io-client',
    message: 'Le coeur de simulation ne fait pas de reseau. Le Socket.IO vit dans packages/server.',
  },
  {
    name: 'express',
    message: "Le coeur de simulation n'expose aucun serveur web. Express vit dans packages/server.",
  },
  {
    name: 'pixi.js',
    message: 'Le coeur de simulation ne dessine rien. PixiJS vit dans packages/client.',
  },
];

/**
 * Modules Node d'entree-sortie interdits dans packages/sim, avec et sans prefixe node:.
 */
const MODULES_NODE_INTERDITS = [
  'fs',
  'fs/promises',
  'http',
  'https',
  'net',
  'path',
  'os',
  'child_process',
  'worker_threads',
  'dgram',
  'tls',
].flatMap((nom) => [
  {
    name: nom,
    message: `Le coeur de simulation ne fait aucune entree-sortie. Deplacer l'usage de "${nom}" vers packages/server et injecter le resultat dans le moteur.`,
  },
  {
    name: `node:${nom}`,
    message: `Le coeur de simulation ne fait aucune entree-sortie. Deplacer l'usage de "node:${nom}" vers packages/server et injecter le resultat dans le moteur.`,
  },
]);

export default tseslint.config(
  {
    // Rien de genere ni de legacy n'est analyse.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'legacy/**',
      'docs/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'packages/client/web/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  {
    // L'invariant de purete du coeur de simulation.
    // Voir .claude/rules/sim-purity.md. Ne jamais assouplir ce bloc pour faire
    // passer une compilation: deplacer l'entree-sortie vers packages/server.
    files: ['packages/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [...IMPORTS_INTERDITS_DANS_SIM, ...MODULES_NODE_INTERDITS] },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message:
            "Le coeur de simulation ne lit jamais l'horloge. Le temps arrive par le parametre dt du moteur.",
        },
        {
          object: 'Math',
          property: 'random',
          message:
            'Le coeur de simulation ne tire aucun hasard direct. Utiliser le generateur a graine de @neon-ninja/shared.',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message:
            'Le coeur de simulation ne connait pas le navigateur. Le DOM vit dans packages/client.',
        },
        {
          name: 'document',
          message:
            'Le coeur de simulation ne connait pas le navigateur. Le DOM vit dans packages/client.',
        },
        {
          name: 'localStorage',
          message:
            'Le coeur de simulation ne connait pas le navigateur. Le DOM vit dans packages/client.',
        },
        {
          name: 'fetch',
          message: 'Le coeur de simulation ne fait pas de reseau. Deplacer vers packages/server.',
        },
      ],
    },
  },

  {
    // Les fichiers de test peuvent afficher et utiliser des utilitaires libres.
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Doit rester en dernier: desactive les regles de style qui entrent en
  // conflit avec Prettier.
  prettier,
);
