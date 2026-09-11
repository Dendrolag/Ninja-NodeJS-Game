/**
 * Commande `pnpm base:migrer`: applique les migrations a la base de DATABASE_URL.
 *
 * C'est la seule facon prevue de faire evoluer une vraie base. Les tests, eux,
 * appliquent les migrations a leur propre branche Neon, creee pour eux.
 */

import { appliquerMigrations } from './migrations.js';

const adresse = process.env['DATABASE_URL'];

if (adresse === undefined || adresse === '') {
  console.error("DATABASE_URL n'est pas definie: aucune base a migrer.");
  process.exitCode = 1;
} else {
  await appliquerMigrations(adresse);
  process.stdout.write('Migrations appliquees.\n');
}
