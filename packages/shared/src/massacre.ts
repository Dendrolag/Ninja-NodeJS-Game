/**
 * Le mode Massacre, vu de toutes les couches (etape 7.4).
 *
 * Le moteur tient les points et les combos; la page, elle, ne voit que les coups de katana
 * et doit dire au joueur ou en est son multiplicateur. La regle qui le calcule est donc ici,
 * une seule fois pour les deux.
 *
 * TOUT CE FICHIER EST PUR.
 */

import { MASSACRE } from './constantes.js';

/**
 * Le multiplicateur d'un combo de tant de morts: un cran de plus toutes les cinq morts,
 * jusqu'a cinq. Zero ou une mort valent un.
 */
export function multiplicateurDuCombo(morts: number): number {
  return Math.min(1 + Math.floor(morts / MASSACRE.MORTS_PAR_CRAN), MASSACRE.MULTIPLICATEUR_MAXIMUM);
}
