/**
 * La fin d'une partie, vue des comptes: ce qui s'enregistre, et ce que chacun en
 * apprend (etape 3.3).
 *
 * DEUX TRADUCTIONS, ET AUCUNE REGLE DE JEU. Les gains se calculent par
 * recompensesDePartie, dans @neon-ninja/shared; ce fichier ne fait que passer d'une
 * forme a l'autre.
 *
 *   1. Du bilan de la room vers ce qui s'enregistre: la partie, et le resultat de
 *      chaque joueur qui a un compte, present a la fin ou parti avant. Un invite ne
 *      laisse aucun resultat, mais il compte dans le nombre de joueurs et dans le
 *      placement des autres (decision du 11 septembre 2026).
 *   2. De la progression appliquee par la base vers le recapitulatif envoye au
 *      compte. Les gains y sont la DIFFERENCE entre la progression d'apres et celle
 *      d'avant: le recapitulatif dit ce qui a ete ecrit, jamais ce qui avait ete
 *      demande.
 *
 * TOUT CE FICHIER EST PUR, comme instantane.ts: il ne lit ni horloge ni base, et se
 * teste sans monter de serveur.
 */

import { randomUUID } from 'node:crypto';

import type { EtatDeProgression, ProgressionEnregistree } from '@neon-ninja/shared';
import { niveauDeXp, palierDePoints, recompensesDePartie } from '@neon-ninja/shared';
import type { IdentifiantEntite } from '@neon-ninja/sim';

import type { NouveauResultat, NouvellePartie, ProgressionAppliquee } from './base/parties.js';
import type { ValeursProgression } from './base/progression.js';
import type { GameRoom } from './GameRoom.js';

/**
 * Combien de fois essayer d'enregistrer une fin de partie avant de dire qu'elle ne
 * compte pas (recette de l'etape 5.4).
 *
 * Une base qui se reveille ou une coupure passagere ne doit pas couter sa partie a un
 * joueur. Trois essais, trois secondes d'ecart: le recapitulatif arrive au plus six
 * secondes plus tard, l'ecran de fin disant pendant ce temps que la partie
 * s'enregistre.
 */
export const ESSAIS_D_ENREGISTREMENT = 3;

/** L'attente entre deux essais d'enregistrement d'une fin de partie. */
export const ATTENTE_ENTRE_DEUX_ENREGISTREMENTS_MS = 3000;

/** Ce qu'une partie terminee laisse a enregistrer pour ses comptes. */
export interface FinPourLesComptes {
  readonly partie: NouvellePartie;
  /** Un par compte, present a la fin ou parti avant. Vide si personne n'avait de compte. */
  readonly resultats: readonly NouveauResultat[];
  /**
   * L'identifiant de joueur de chaque compte present a la fin, par identifiant de
   * compte: c'est par lui que la couche reseau retrouve la connexion a prevenir.
   *
   * Un compte parti avant la fin n'y figure pas: son abandon s'enregistre, mais il
   * n'a plus d'ecran de fin a qui envoyer un recapitulatif.
   */
  readonly joueurs: ReadonlyMap<string, IdentifiantEntite>;
}

/** Ce que la fin de cette partie laisse a enregistrer pour ses comptes. */
export function finPourLesComptes(room: GameRoom): FinPourLesComptes {
  const bilan = room.bilan();
  const resultats: NouveauResultat[] = [];
  const joueurs = new Map<string, IdentifiantEntite>();

  for (const joueur of bilan.joueurs) {
    if (joueur.compte === undefined) {
      continue;
    }

    const gains = recompensesDePartie({
      placement: joueur.placement,
      nombreJoueurs: bilan.nombreJoueurs,
      tempsJoueMs: joueur.tempsJoueMs,
      dureePartieMs: bilan.dureePartieMs,
      abandon: joueur.abandon,
      // Une partie Equipes dit ce que chacun devance: son placement ne le dit pas.
      ...(joueur.devancement === undefined ? {} : { devancement: joueur.devancement }),
    });

    resultats.push({
      compteId: joueur.compte.id,
      placement: joueur.placement,
      points: joueur.points,
      captures: joueur.captures,
      botsNoirsDetruits: joueur.botsNoirsDetruits,
      xpGagnee: gains.xp,
      piecesGagnees: gains.pieces,
      variationPointsLigue: gains.variationPointsLigue,
    });

    if (joueur.id !== undefined) {
      joueurs.set(joueur.compte.id, joueur.id);
    }
  }

  return {
    partie: {
      // Tire ici, avant tout essai: tous les essais d'enregistrement portent le meme,
      // et la base reconnait une partie qu'un essai precedent a deja ecrite.
      id: randomUUID(),
      mode: room.mode,
      carte: room.reglages.carte,
      modeMiroir: room.reglages.modeMiroir,
      dureeS: room.reglages.dureePartieS,
      nombreJoueurs: bilan.nombreJoueurs,
    },
    resultats,
    joueurs,
  };
}

/**
 * Le recapitulatif envoye a un compte, une fois sa progression enregistree.
 *
 * @param resultat Le resultat du compte, pour son placement.
 * @param nombreJoueurs Le nombre de joueurs de la partie.
 * @param appliquee Ce que la base a reellement applique a sa progression.
 */
export function progressionEnregistree(
  resultat: NouveauResultat,
  nombreJoueurs: number,
  appliquee: ProgressionAppliquee,
): ProgressionEnregistree {
  const { avant, apres } = appliquee;

  return {
    enregistree: true,
    placement: resultat.placement,
    nombreJoueurs,
    xpGagnee: apres.xpTotale - avant.xpTotale,
    piecesGagnees: apres.pieces - avant.pieces,
    variationPointsLigue: apres.pointsLigue - avant.pointsLigue,
    avant: etatDeProgression(avant),
    apres: etatDeProgression(apres),
    succes: appliquee.succes,
  };
}

/** Une progression, avec son niveau et son palier deduits. */
function etatDeProgression(valeurs: ValeursProgression): EtatDeProgression {
  return {
    xpTotale: valeurs.xpTotale,
    niveau: niveauDeXp(valeurs.xpTotale),
    pieces: valeurs.pieces,
    pointsLigue: valeurs.pointsLigue,
    palier: palierDePoints(valeurs.pointsLigue),
  };
}
