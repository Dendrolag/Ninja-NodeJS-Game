/**
 * La regle des objets du Tactique vue de toutes les couches (etape 7.7): quand un effet
 * agit, et quel cone il donne.
 *
 * Le moteur tient les effets de chaque joueur; la page, elle, connait les siens par les
 * notifications et doit dessiner le cone que le moteur appliquera. La regle est donc ici,
 * une seule fois pour les deux, comme celle du combo (combo.ts).
 *
 * UN BONUS ET SON MALUS CONTRAIRE S'ANNULENT tant que les deux durent: aucun des deux
 * n'agit (decision du porteur du projet du 19 septembre 2026).
 *
 * TOUT CE FICHIER EST PUR.
 */

import type { EffetTactique, TypeBonusTactique, TypeMalusTactique, Visee } from './constantes.js';
import {
  CONTRAIRES_TACTIQUES,
  OBJETS_TACTIQUES,
  TACTIQUE,
  TYPES_BONUS_TACTIQUES,
} from './constantes.js';

/** Le temps restant sur chacun des six effets du Tactique, en millisecondes. */
export type RestesDesEffetsTactiques = Readonly<Record<EffetTactique, number>>;

/** Aucun effet du Tactique en cours. */
export const AUCUN_EFFET_TACTIQUE: RestesDesEffetsTactiques = {
  rafale: 0,
  rechargeRapide: 0,
  viseeLarge: 0,
  tirUnique: 0,
  rechargeLente: 0,
  viseeEtroite: 0,
};

/** Le bonus contraire de chaque malus du Tactique. */
const CONTRAIRE_DU_MALUS: Readonly<Record<TypeMalusTactique, TypeBonusTactique>> = {
  tirUnique: 'rafale',
  rechargeLente: 'rechargeRapide',
  viseeEtroite: 'viseeLarge',
};

/** Cette nature est-elle un bonus du Tactique ? */
function estUnBonus(nature: EffetTactique): nature is TypeBonusTactique {
  return (TYPES_BONUS_TACTIQUES as readonly string[]).includes(nature);
}

/**
 * Un effet agit-il ? Il faut qu'il dure encore, et que son contraire ne dure pas.
 */
export function effetQuiAgit(effets: RestesDesEffetsTactiques, nature: EffetTactique): boolean {
  const contraire = estUnBonus(nature) ? CONTRAIRES_TACTIQUES[nature] : CONTRAIRE_DU_MALUS[nature];

  return effets[nature] > 0 && effets[contraire] <= 0;
}

/** La visee d'un joueur, selon ses effets. */
export function viseeDe(effets: RestesDesEffetsTactiques): Visee {
  if (effetQuiAgit(effets, 'viseeLarge')) {
    return 'large';
  }

  return effetQuiAgit(effets, 'viseeEtroite') ? 'etroite' : 'normale';
}

/** L'ouverture totale et la portee du cone de chaque visee. */
export const CONES_DES_VISEES: Readonly<
  Record<Visee, { readonly angleDegres: number; readonly porteePx: number }>
> = {
  normale: { angleDegres: TACTIQUE.ANGLE_DU_CONE_DEGRES, porteePx: TACTIQUE.PORTEE_PX },
  large: {
    angleDegres: OBJETS_TACTIQUES.VISEE_LARGE.ANGLE_DEGRES,
    porteePx: OBJETS_TACTIQUES.VISEE_LARGE.PORTEE_PX,
  },
  etroite: {
    angleDegres: OBJETS_TACTIQUES.VISEE_ETROITE.ANGLE_DEGRES,
    porteePx: OBJETS_TACTIQUES.VISEE_ETROITE.PORTEE_PX,
  },
};
