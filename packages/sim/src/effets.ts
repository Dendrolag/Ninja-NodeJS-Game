/**
 * Les effets qu'un joueur porte: bonus recus, malus subis, et leur duree.
 *
 * Ce fichier ne connait ni la carte, ni les objets poses dessus, ni le joueur
 * lui-meme: il ne manipule qu'une table « nature de l'effet, temps restant ».
 * C'est ce qui permet de la tester seule, et de la reutiliser telle quelle pour
 * les bonus comme pour les malus, qui ne different que par leur regle de cumul.
 *
 * TROIS CHOSES QUE LE PORTAGE CHANGE, ET POURQUOI.
 *
 * 1. Un seul compteur au lieu de deux. Le legacy tenait, pour chaque effet, un
 *    indicateur (speedBoostActive) ET une duree (bonusTimers.speed), qu'il
 *    fallait garder d'accord a la main. Ici l'effet est actif tant qu'il reste du
 *    temps: il n'y a qu'une verite.
 *
 * 2. Les durees decroissent, elles ne se comparent pas a une date. Le legacy
 *    notait l'instant du ramassage (bonusStartTime) et comparait a Date.now().
 *    Le moteur ne lit pas l'horloge: il retranche le temps ecoule.
 *
 * 3. Le serveur expire maintenant TOUS les effets. Le legacy n'expirait que
 *    l'invincibilite (updatePlayerBonuses, :627); la vitesse et la revelation
 *    restaient armees indefiniment cote serveur, et c'est le client qui decidait
 *    de les arreter (defaut X24 de l'audit, cousin de la faille S2). La duree
 *    reellement jouee etait donc bien de dix secondes, decidee par le client. Le
 *    portage la fait respecter par le moteur: le comportement ressenti est le
 *    meme, l'autorite change de camp.
 *
 * LA REGLE DE CUMUL N'EST PAS LA MEME DES DEUX COTES, et c'est voulu:
 *
 *   - Un bonus s'ajoute a ce qui reste. Deux bonus de vitesse coup sur coup
 *     donnent vingt secondes. C'est le comportement a preserver numero 10 de
 *     CLAUDE.md, confirme comme intentionnel le 13 aout 2026.
 *   - Un malus repart de sa duree pleine, il ne s'ajoute pas. C'est ce que fait
 *     le client du legacy, seul endroit ou un malus vivait (client.js:3408): il
 *     inscrit une fin a « maintenant plus la duree », ecrasant la precedente.
 */

import type { TypeBonus, TypeMalus } from '@neon-ninja/shared';
import { TYPES_BONUS, TYPES_MALUS } from '@neon-ninja/shared';

/** Temps restant sur chaque effet d'une famille, en millisecondes. Zero: inactif. */
export type DureesRestantes<Nature extends string> = Readonly<Record<Nature, number>>;

/** Aucun bonus en cours. */
export const AUCUN_BONUS: DureesRestantes<TypeBonus> = {
  vitesse: 0,
  invincibilite: 0,
  revelation: 0,
};

/** Aucun malus en cours. */
export const AUCUN_MALUS: DureesRestantes<TypeMalus> = {
  controlesInverses: 0,
  flou: 0,
  negatif: 0,
};

/** Un effet est-il en cours ? */
export function estActif<Nature extends string>(
  durees: DureesRestantes<Nature>,
  nature: NoInfer<Nature>,
): boolean {
  return durees[nature] > 0;
}

/**
 * Ajoute une duree a un effet: c'est la regle des bonus.
 *
 * Ramasser un second bonus de vitesse pendant que le premier court prolonge
 * l'effet au lieu de le remplacer.
 */
export function cumuler<Nature extends string>(
  durees: DureesRestantes<Nature>,
  nature: NoInfer<Nature>,
  dureeMs: number,
): DureesRestantes<Nature> {
  return { ...durees, [nature]: durees[nature] + dureeMs };
}

/**
 * Repart de la duree pleine: c'est la regle des malus.
 *
 * Un malus n'a qu'une duree par nature, donc repartir a zero ne raccourcit
 * jamais un effet en cours; cela le prolonge jusqu'a la duree pleine.
 */
export function remplacer<Nature extends string>(
  durees: DureesRestantes<Nature>,
  nature: NoInfer<Nature>,
  dureeMs: number,
): DureesRestantes<Nature> {
  return { ...durees, [nature]: Math.max(durees[nature], dureeMs) };
}

/** Fait s'ecouler le temps sur tous les effets d'une famille. Aucun ne passe sous zero. */
export function fairePasserLeTemps<Nature extends string>(
  durees: DureesRestantes<Nature>,
  dtMs: number,
): DureesRestantes<Nature> {
  const restantes: Record<Nature, number> = { ...durees };

  for (const nature in restantes) {
    restantes[nature] = Math.max(restantes[nature] - dtMs, 0);
  }

  return restantes;
}

/** Les natures d'effet en cours, dans l'ordre du catalogue. Utile a l'affichage. */
export function effetsEnCours<Nature extends string>(
  durees: DureesRestantes<Nature>,
  catalogue: readonly Nature[],
): readonly Nature[] {
  return catalogue.filter((nature) => estActif(durees, nature));
}

/** Les bonus en cours d'un joueur, dans l'ordre du catalogue. */
export function bonusEnCours(durees: DureesRestantes<TypeBonus>): readonly TypeBonus[] {
  return effetsEnCours(durees, TYPES_BONUS);
}

/** Les malus en cours d'un joueur, dans l'ordre du catalogue. */
export function malusEnCours(durees: DureesRestantes<TypeMalus>): readonly TypeMalus[] {
  return effetsEnCours(durees, TYPES_MALUS);
}
