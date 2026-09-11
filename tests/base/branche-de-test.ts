/**
 * Preparation globale des tests de la base: une branche Neon neuve pour toute
 * l'execution.
 *
 * Dans l'ordre: creer la branche, attendre qu'elle soit prete et qu'elle accepte
 * une connexion, la vider, lui appliquer les migrations, puis donner son adresse
 * aux tests. A la fin, la supprimer. Si la preparation echoue, la branche est
 * supprimee aussitot.
 *
 * LA BRANCHE EST VIDEE AVANT D'ETRE MIGREE. Elle ne recoit pas les donnees de la
 * base principale, mais elle en recoit la structure: une base principale deja
 * migree donnerait une branche ou les tables existent et ou les migrations
 * echoueraient. La vider fait partir chaque execution d'une base vierge, ce qui
 * est exactement ce que doit prouver le test des migrations.
 *
 * SANS ACCES A NEON. En local, les tests de la base sont sautes, avec un message.
 * En CI, c'est une erreur: une CI verte sans avoir teste la base mentirait.
 */

import { randomBytes } from 'node:crypto';

import { adresseChiffree, adressePooler, appliquerMigrations } from '@neon-ninja/server';
import pg from 'pg';
import type { GlobalSetupContext } from 'vitest/node';

import {
  accesNeonDepuisEnvironnement,
  attendreBranche,
  creerBranche,
  supprimerBranche,
} from './neon.js';

/** Au-dela, Neon supprime la branche meme si personne ne l'a fait. */
const DUREE_DE_VIE_MS = 60 * 60 * 1_000;

/** Delai laisse a Neon pour preparer la branche. */
const ATTENTE_BRANCHE_MS = 120_000;

/** Essais de connexion, espaces de deux secondes, le temps que la base demarre. */
const ESSAIS_DE_CONNEXION = 30;

export default async function preparerLaBase({
  provide,
}: GlobalSetupContext): Promise<(() => Promise<void>) | undefined> {
  const acces = accesNeonDepuisEnvironnement();

  if (acces === undefined) {
    if (process.env['CI'] === 'true') {
      throw new Error(
        'NEON_API_KEY et NEON_PROJECT_ID manquent: la CI ne peut pas tester la base. ' +
          'Les ajouter aux secrets du depot GitHub.',
      );
    }

    console.warn('Tests de la base sautes: NEON_API_KEY et NEON_PROJECT_ID ne sont pas definies.');
    provide('adresseBase', '');
    return undefined;
  }

  const branche = await creerBranche(acces, nomDeBranche(), DUREE_DE_VIE_MS);

  try {
    await attendreBranche(acces, branche.id, ATTENTE_BRANCHE_MS);
    await attendreConnexion(branche.adresse);
    await viderLaBase(branche.adresse);
    await appliquerMigrations(branche.adresse);
  } catch (erreur) {
    await supprimerBranche(acces, branche.id);
    throw erreur;
  }

  // Les tests passent par le pooler, comme le serveur.
  provide('adresseBase', adressePooler(branche.adresse));

  return async () => {
    await supprimerBranche(acces, branche.id);
  };
}

/** Un nom de branche lisible dans la console Neon, et unique. */
function nomDeBranche(): string {
  const horodatage = new Date().toISOString().replace(/[:.]/gu, '-');

  return `tests-${horodatage}-${randomBytes(3).toString('hex')}`;
}

/** Un client seul vers la base de la branche, pour les operations de preparation. */
function clientDirect(adresse: string): pg.Client {
  return new pg.Client({ connectionString: adresseChiffree(adresse) });
}

/** Attend que la base de la branche accepte une connexion. */
async function attendreConnexion(adresse: string): Promise<void> {
  for (let essai = 1; ; essai += 1) {
    const client = clientDirect(adresse);

    try {
      await client.connect();
      await client.query('select 1');
      return;
    } catch (erreur) {
      if (essai >= ESSAIS_DE_CONNEXION) {
        throw erreur;
      }

      await new Promise((resoudre) => {
        setTimeout(resoudre, 2_000);
      });
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

/** Retire tout ce que la branche a herite de la structure de sa parente. */
async function viderLaBase(adresse: string): Promise<void> {
  const client = clientDirect(adresse);
  await client.connect();

  try {
    await client.query(
      'drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public;',
    );
  } finally {
    await client.end();
  }
}
