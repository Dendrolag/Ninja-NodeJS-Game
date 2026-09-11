/**
 * Les parties jouees: enregistrer une partie et ses resultats, relire l'historique
 * d'un compte.
 *
 * UNE PARTIE ET SES RESULTATS S'ECRIVENT ENSEMBLE, OU PAS DU TOUT. Une seule
 * transaction: si un resultat est refuse, la partie n'est pas ecrite non plus.
 * Une partie a moitie enregistree fausserait les statistiques du profil.
 *
 * Tout refus ici vient d'une faute du code serveur (un compte qui n'existe pas,
 * une valeur negative, deux resultats pour le meme compte): il leve une erreur.
 * Aucun joueur n'enregistre une partie lui-meme.
 */

import type { IdentifiantCarte, Mode } from '@neon-ninja/shared';
import { desc, eq } from 'drizzle-orm';

import type { BaseDeDonnees } from './connexion.js';
import { parties, resultats } from './schema.js';

/** Une partie qui vient de se terminer. */
export interface NouvellePartie {
  readonly mode: Mode;
  readonly carte: IdentifiantCarte;
  readonly modeMiroir: boolean;
  readonly dureeS: number;
  /** Tous les joueurs, avec ou sans compte. */
  readonly nombreJoueurs: number;
  readonly termineeLe: Date;
}

/** Ce qu'un compte a fait et gagne dans cette partie. */
export interface NouveauResultat {
  readonly compteId: string;
  /** 1 pour le premier. Au plus le nombre de joueurs de la partie. */
  readonly placement: number;
  readonly points: number;
  readonly captures: number;
  readonly botsNoirsDetruits: number;
  readonly xpGagnee: number;
  readonly piecesGagnees: number;
  readonly variationPointsLigue: number;
}

/** Une ligne de l'historique d'un compte: sa partie, et son resultat dans celle-ci. */
export interface ResultatDePartie extends NouvellePartie, Omit<NouveauResultat, 'compteId'> {
  readonly partieId: string;
}

/**
 * Enregistre une partie terminee et les resultats de ses joueurs qui ont un compte.
 *
 * @returns L'identifiant de la partie, commun a tous ses resultats.
 */
export async function enregistrerPartie(
  db: BaseDeDonnees,
  partie: NouvellePartie,
  lignes: readonly NouveauResultat[],
): Promise<string> {
  // Seule regle que la base ne peut pas verifier seule: elle relie deux tables.
  for (const ligne of lignes) {
    if (ligne.placement > partie.nombreJoueurs) {
      throw new Error(
        `Placement ${ligne.placement} impossible dans une partie de ${partie.nombreJoueurs} joueurs.`,
      );
    }
  }

  return db.transaction(async (transaction) => {
    const [enregistree] = await transaction
      .insert(parties)
      .values(partie)
      .returning({ id: parties.id });

    if (enregistree === undefined) {
      throw new Error("La base n'a rendu aucune ligne pour la partie enregistree.");
    }

    if (lignes.length > 0) {
      await transaction
        .insert(resultats)
        .values(lignes.map((ligne) => ({ ...ligne, partieId: enregistree.id })));
    }

    return enregistree.id;
  });
}

/** Les dernieres parties de ce compte, de la plus recente a la plus ancienne. */
export async function lireHistorique(
  db: BaseDeDonnees,
  compteId: string,
  limite = 20,
): Promise<ResultatDePartie[]> {
  return db
    .select({
      partieId: parties.id,
      mode: parties.mode,
      carte: parties.carte,
      modeMiroir: parties.modeMiroir,
      dureeS: parties.dureeS,
      nombreJoueurs: parties.nombreJoueurs,
      termineeLe: parties.termineeLe,
      placement: resultats.placement,
      points: resultats.points,
      captures: resultats.captures,
      botsNoirsDetruits: resultats.botsNoirsDetruits,
      xpGagnee: resultats.xpGagnee,
      piecesGagnees: resultats.piecesGagnees,
      variationPointsLigue: resultats.variationPointsLigue,
    })
    .from(resultats)
    .innerJoin(parties, eq(resultats.partieId, parties.id))
    .where(eq(resultats.compteId, compteId))
    .orderBy(desc(parties.termineeLe))
    .limit(limite);
}
