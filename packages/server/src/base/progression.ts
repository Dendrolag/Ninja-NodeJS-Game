/**
 * La progression d'un compte: la lire, l'ecrire.
 *
 * Trois nombres, jamais negatifs: l'XP totale, les pieces, les points de ligue.
 * Le niveau et le palier de rang ne sont pas ici: ils s'en deduisent, par les
 * fonctions de packages/shared/src/progression.ts.
 *
 * ECRIRE REMPLACE, CE N'EST PAS AJOUTER. Les gains d'une partie ne passent jamais
 * par ecrireProgression: ils s'ajoutent dans la transaction qui enregistre la
 * partie (enregistrerPartie, parties.ts), pour que deux parties rapprochees d'un
 * meme compte ne s'effacent pas l'une l'autre.
 *
 * Une valeur negative ou un compte inconnu ne peuvent venir que d'une faute du
 * code serveur, pas d'une demande de joueur: ils levent une erreur. La base
 * refuse d'ailleurs d'elle-meme une valeur negative.
 */

import { eq, sql } from 'drizzle-orm';

import type { BaseDeDonnees } from './connexion.js';
import { progressions } from './schema.js';

/** Ce qui se modifie dans une progression. */
export interface ValeursProgression {
  readonly xpTotale: number;
  readonly pieces: number;
  readonly pointsLigue: number;
}

/** La progression d'un compte. */
export interface Progression extends ValeursProgression {
  readonly compteId: string;
  readonly misAJourLe: Date;
}

/** La progression de ce compte, ou undefined si le compte n'existe pas. */
export async function lireProgression(
  db: BaseDeDonnees,
  compteId: string,
): Promise<Progression | undefined> {
  const [progression] = await db
    .select()
    .from(progressions)
    .where(eq(progressions.compteId, compteId));

  return progression;
}

/**
 * Remplace la progression de ce compte par ces valeurs.
 *
 * L'heure de mise a jour est celle de la base, pas celle du serveur.
 */
export async function ecrireProgression(
  db: BaseDeDonnees,
  compteId: string,
  valeurs: ValeursProgression,
): Promise<Progression> {
  const [progression] = await db
    .update(progressions)
    .set({
      xpTotale: valeurs.xpTotale,
      pieces: valeurs.pieces,
      pointsLigue: valeurs.pointsLigue,
      misAJourLe: sql`now()`,
    })
    .where(eq(progressions.compteId, compteId))
    .returning();

  if (progression === undefined) {
    throw new Error(`Aucune progression a ecrire: le compte ${compteId} n'existe pas.`);
  }

  return progression;
}
