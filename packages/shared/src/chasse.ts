/**
 * Le mode Chasse, vu de toutes les couches (etape 7.3).
 *
 * Le moteur tient la table des traqueurs; le serveur et le client, eux, ne voient que des
 * couleurs, dans le flux d'etat et dans le classement. Ce fichier fait le passage de
 * l'une a l'autre, au meme endroit pour tous: le camp d'une couleur, l'issue d'une Chasse
 * tiree du classement, et la place que cette issue donne a chacun pour ses recompenses.
 *
 * TOUT CE FICHIER EST PUR, comme celui des Equipes: le serveur l'appelle pour le bilan, le
 * client pour le HUD et l'ecran de fin, et les deux calculent la meme chose.
 */

import type { PlaceDansUnCamp } from './camps.js';
import { placeDansUnCamp } from './camps.js';
import type { Couleur } from './constantes.js';
import { COULEUR_DES_TRAQUEURS } from './constantes.js';

/** Les deux camps d'une Chasse. */
export type CampDeChasse = 'proies' | 'traqueurs';

/**
 * Le camp d'une couleur: la couleur des traqueurs, ou celle d'une proie.
 *
 * La casse ne compte pas: le flux d'etat fait voyager les couleurs en majuscules, et rien
 * n'oblige un appelant a les ecrire ainsi.
 */
export function campDeCouleur(couleur: Couleur): CampDeChasse {
  return couleur.toUpperCase() === COULEUR_DES_TRAQUEURS.toUpperCase() ? 'traqueurs' : 'proies';
}

/** Ce qu'il faut savoir d'un joueur pour decider une Chasse: sa couleur. */
export interface LigneDeJoueurEnChasse {
  readonly couleur: Couleur;
}

/**
 * Le camp qui gagne une Chasse, a lire une fois la partie terminee.
 *
 * S'il reste une proie parmi les joueurs presents, les proies ont survecu; sinon, les
 * traqueurs l'emportent (decision 8 du porteur du projet). Une proie partie avant la fin
 * n'a pas survecu: elle n'est plus dans le classement.
 */
export function campVainqueur(classement: readonly LigneDeJoueurEnChasse[]): CampDeChasse {
  return classement.some((ligne) => campDeCouleur(ligne.couleur) === 'proies')
    ? 'proies'
    : 'traqueurs';
}

/**
 * Combien de proies sont encore debout, parmi les joueurs presents.
 *
 * Ce que le HUD affiche pendant la partie.
 */
export function proiesRestantes(classement: readonly LigneDeJoueurEnChasse[]): number {
  return classement.filter((ligne) => campDeCouleur(ligne.couleur) === 'proies').length;
}

/**
 * La place d'un joueur present a la fin d'une Chasse (micro-decision 12 de la fiche 7.3).
 *
 * La regle des camps des Equipes, sans egalite possible: les vainqueurs sont premiers et
 * devancent tous les autres, abandons compris; les perdants sont places juste apres eux et
 * ne devancent que les abandons (placeDansUnCamp).
 *
 * @param classement Les joueurs presents a la fin.
 * @param couleur La couleur du joueur.
 * @param nombreJoueurs Tous les joueurs de la partie, abandons compris.
 */
export function placeDansLaChasse(
  classement: readonly LigneDeJoueurEnChasse[],
  couleur: Couleur,
  nombreJoueurs: number,
): PlaceDansUnCamp {
  const vainqueur = campVainqueur(classement);
  const vainqueursPresents = classement.filter(
    (ligne) => campDeCouleur(ligne.couleur) === vainqueur,
  ).length;

  return placeDansUnCamp({
    vainqueur: campDeCouleur(couleur) === vainqueur,
    vainqueursPresents,
    nombreJoueurs,
    presents: classement.length,
  });
}
