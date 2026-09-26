/**
 * Commande `pnpm base:mesurer`: le releve de retention et de calibration de la base de
 * DATABASE_URL (etape 3.7), en lecture seule.
 *
 * La procedure et les releves sont dans docs/mesures/retention.md.
 */

import { ouvrirBase } from './connexion.js';
import { rapportDeRetention, releverLaRetention } from './mesures.js';

const adresse = process.env['DATABASE_URL'];

if (adresse === undefined || adresse === '') {
  console.error("DATABASE_URL n'est pas definie: aucune base a mesurer.");
  process.exitCode = 1;
} else {
  const base = ouvrirBase(adresse, { maximumConnexions: 1 });

  try {
    const releve = await releverLaRetention(base.db);
    process.stdout.write(rapportDeRetention(releve, new Date().toISOString().slice(0, 10)));
  } finally {
    await base.fermer();
  }
}
