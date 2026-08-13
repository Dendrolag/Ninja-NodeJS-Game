/**
 * Direction d'une entite a partir de son deplacement.
 *
 * Portage de Entity.determineDirection et Entity.updateDirection
 * (legacy/server.js:844 et :864). Dans le legacy, ce sont des methodes qui
 * modifient l'entite au passage. Ici ce sont deux fonctions pures: l'une calcule
 * une direction, l'autre renvoie une copie de l'entite avec cette direction.
 *
 * Le repere est celui de l'ecran: l'axe des y descend. Un deplacement vers le
 * bas est donc « sud ».
 */

import type { Direction, Vecteur } from '@neon-ninja/shared';

/**
 * En dessous de ce deplacement, en pixels, on considere l'entite immobile.
 * Valeur du legacy, conservee telle quelle.
 */
const SEUIL_IMMOBILITE = 0.1;

/**
 * Determine vers ou regarde une entite qui se deplace de (dx, dy).
 *
 * Le cercle est decoupe en huit secteurs de 45 degres, centres sur les
 * directions cardinales et diagonales.
 */
export function determinerDirection(dx: number, dy: number): Direction {
  if (Math.abs(dx) < SEUIL_IMMOBILITE && Math.abs(dy) < SEUIL_IMMOBILITE) {
    return 'immobile';
  }

  const degres = Math.atan2(dy, dx) * (180 / Math.PI);

  if (degres >= -22.5 && degres < 22.5) return 'est';
  if (degres >= 22.5 && degres < 67.5) return 'sud_est';
  if (degres >= 67.5 && degres < 112.5) return 'sud';
  if (degres >= 112.5 && degres < 157.5) return 'sud_ouest';
  if (degres >= 157.5 || degres < -157.5) return 'ouest';
  if (degres >= -157.5 && degres < -112.5) return 'nord_ouest';
  if (degres >= -112.5 && degres < -67.5) return 'nord';
  return 'nord_est';
}

/** Meme calcul, a partir d'un vecteur plutot que de deux nombres. */
export function directionDuVecteur(vecteur: Vecteur): Direction {
  return determinerDirection(vecteur.x, vecteur.y);
}

/** Norme d'un vecteur. */
export function norme(vecteur: Vecteur): number {
  return Math.sqrt(vecteur.x * vecteur.x + vecteur.y * vecteur.y);
}

/**
 * Ramene un vecteur a la longueur demandee.
 *
 * Un vecteur nul reste nul: il n'a pas de direction a conserver.
 */
export function aLaLongueur(vecteur: Vecteur, longueur: number): Vecteur {
  const taille = norme(vecteur);
  if (taille === 0) {
    return { x: 0, y: 0 };
  }

  return { x: (vecteur.x / taille) * longueur, y: (vecteur.y / taille) * longueur };
}
