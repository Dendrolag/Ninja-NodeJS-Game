/**
 * Commande `pnpm base:rattraper`: attribue leurs succes aux comptes de la base de
 * DATABASE_URL (etape 3.7).
 *
 * A lancer une fois, apres la mise en ligne des succes: les comptes d'avant arrivent avec
 * les succes qu'ils avaient deja merites, dates de leur partie d'origine. La relancer
 * n'inscrit rien. L'oublier ne retarde que les comptes qui ne rejouent pas: chaque fin
 * de partie rattrape deja ceux de ses joueurs.
 */

import { ouvrirBase } from './connexion.js';
import { rattraperLesSucces } from './succes.js';

const adresse = process.env['DATABASE_URL'];

if (adresse === undefined || adresse === '') {
  console.error("DATABASE_URL n'est pas definie: aucune base a rattraper.");
  process.exitCode = 1;
} else {
  const base = ouvrirBase(adresse, { maximumConnexions: 1 });

  try {
    const bilan = await rattraperLesSucces(base.db);
    process.stdout.write(
      `${String(bilan.comptes)} comptes examines, ${String(bilan.inscrits)} succes inscrits.\n`,
    );
  } finally {
    await base.fermer();
  }
}
