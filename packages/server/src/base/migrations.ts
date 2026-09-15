/**
 * Appliquer les migrations versionnees a une base.
 *
 * Les migrations sont les fichiers SQL de packages/server/migrations, ecrits par
 * drizzle-kit a partir de schema.ts et commites. Drizzle retient dans la base
 * celles qui ont deja ete appliquees (table drizzle.__drizzle_migrations): les
 * appliquer une seconde fois ne fait rien, et une base en retard recoit
 * seulement ce qui lui manque.
 *
 * Toujours par l'adresse directe, jamais par le pooler: voir connexion.ts.
 */

import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { adresseDirecte, ouvrirBase } from './connexion.js';

/**
 * Le dossier des migrations.
 *
 * Meme profondeur depuis src/base et depuis dist/base: le chemin vaut pour le
 * code source (tests) comme pour le code compile (serveur).
 */
export const DOSSIER_MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Applique a la base de cette adresse les migrations qui lui manquent. */
export async function appliquerMigrations(adresse: string): Promise<void> {
  const base = ouvrirBase(adresseDirecte(adresse), { maximumConnexions: 1 });

  try {
    await migrate(base.db, { migrationsFolder: DOSSIER_MIGRATIONS });
  } finally {
    await base.fermer();
  }
}
