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

import type { EtatDeProgression, ProgressionEnregistree } from '@neon-ninja/shared';
import { niveauDeXp, palierDePoints, recompensesDePartie } from '@neon-ninja/shared';
import type { IdentifiantEntite } from '@neon-ninja/sim';

import type { NouveauResultat, NouvellePartie, ProgressionAppliquee } from './base/parties.js';
import type { ValeursProgression } from './base/progression.js';
import type { GameRoom } from './GameRoom.js';

/** Ce qu'une partie terminee laisse a enregistrer pour ses comptes. */
export interface FinPourLesComptes {
  readonly partie: NouvellePartie;
  /** Un par compte, present a la fin ou parti avant. Vide si personne n'avait de compte. */
  readonly resultats: readonly NouveauResultat[];
  /**
   * La connexion de chaque compte present a la fin, par identifiant de compte.
   *
   * Un compte parti avant la fin n'y figure pas: son abandon s'enregistre, mais il
   * n'a plus d'ecran de fin a qui envoyer un recapitulatif.
   */
  readonly connexions: ReadonlyMap<string, IdentifiantEntite>;
}

/** Ce que la fin de cette partie laisse a enregistrer pour ses comptes. */
export function finPourLesComptes(room: GameRoom): FinPourLesComptes {
  const bilan = room.bilan();
  const resultats: NouveauResultat[] = [];
  const connexions = new Map<string, IdentifiantEntite>();

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
      connexions.set(joueur.compte.id, joueur.id);
    }
  }

  return {
    partie: {
      mode: room.mode,
      carte: room.reglages.carte,
      modeMiroir: room.reglages.modeMiroir,
      dureeS: room.reglages.dureePartieS,
      nombreJoueurs: bilan.nombreJoueurs,
    },
    resultats,
    connexions,
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
