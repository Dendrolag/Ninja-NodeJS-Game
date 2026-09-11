/**
 * Configuration de drizzle-kit, l'outil qui ecrit les migrations.
 *
 * `pnpm base:generer` compare src/base/schema.ts aux migrations deja ecrites, et
 * ajoute dans migrations/ le fichier SQL qui fait passer de l'un a l'autre. Aucune
 * connexion a une base n'est necessaire pour cela.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/base/schema.ts',
  out: './migrations',
  strict: true,
  verbose: true,
});
