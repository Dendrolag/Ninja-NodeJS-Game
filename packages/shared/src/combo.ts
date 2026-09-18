/**
 * La regle du combo, vue de toutes les couches.
 *
 * Le moteur tient les combos; la page, elle, ne voit que les coups du joueur et doit dire
 * ou en est son multiplicateur. La regle qui le calcule est donc ici, une seule fois pour
 * les deux. Elle est nee avec le Massacre (etape 7.4), qui compte ses morts, et sert aussi a
 * la Horde (etape 7.5), qui compte ses faux ninjas rallies.
 *
 * TOUT CE FICHIER EST PUR.
 */

import { COMBO } from './constantes.js';

/**
 * Le multiplicateur d'un combo de tant de coups: un cran de plus tous les cinq coups,
 * jusqu'a cinq. Zero ou un coup valent un.
 */
export function multiplicateurDuCombo(coups: number): number {
  return Math.min(1 + Math.floor(coups / COMBO.COUPS_PAR_CRAN), COMBO.MULTIPLICATEUR_MAXIMUM);
}
