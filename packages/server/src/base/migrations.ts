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

/** Combien de fois tenter les migrations au demarrage du serveur. */
export const TENTATIVES_DE_MIGRATION = 3;

/**
 * Applique les migrations, en reprenant apres un echec, TENTATIVES_DE_MIGRATION fois au
 * plus (etape 8.8).
 *
 * C'est le premier geste du serveur en production: une base qui ne repond pas a la
 * premiere connexion ne doit ni empecher la mise en ligne, ni la retenir quinze minutes
 * (le delai de connexion, connexion.ts, borne chaque tentative). Chaque echec se dit; le
 * dernier remonte, et le serveur ne demarre pas.
 *
 * @param appliquer La migration elle-meme. Remplacee dans les tests.
 */
export async function appliquerMigrationsAvecReprises(
  adresse: string,
  appliquer: (adresse: string) => Promise<void> = appliquerMigrations,
  tentatives: number = TENTATIVES_DE_MIGRATION,
): Promise<void> {
  for (let tentative = 1; ; tentative += 1) {
    try {
      await appliquer(adresse);
      return;
    } catch (erreur) {
      if (tentative >= tentatives) {
        throw erreur;
      }
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      console.error(`Migrations, tentative ${String(tentative)} echouee: ${message}. Reprise.`);
    }
  }
}
