/**
 * Le mode Chasse, vu de toutes les couches (etape 7.3).
 *
 * Le moteur tient la table des traqueurs; le serveur et le client, eux, ne voient que des
 * couleurs, dans le flux d'etat et dans le classement. Ce fichier fait le passage de l'une a
 * l'autre, au meme endroit pour tous: le camp d'une couleur, et les proies restantes.
 *
 * Le classement et les recompenses d'une Chasse sont ceux du Classique, aux points: rien
 * d'autre n'est a partager.
 *
 * TOUT CE FICHIER EST PUR: le client l'appelle pour le HUD, la minimap et l'ecran de fin.
 */

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

/** Ce qu'il faut savoir d'un joueur pour compter les proies: sa couleur. */
export interface LigneDeJoueurEnChasse {
  readonly couleur: Couleur;
}

/** Combien de proies sont encore debout, parmi les joueurs presents. */
export function proiesRestantes(classement: readonly LigneDeJoueurEnChasse[]): number {
  return classement.filter((ligne) => campDeCouleur(ligne.couleur) === 'proies').length;
}
