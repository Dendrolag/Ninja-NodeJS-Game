/**
 * Le rappel des touches de l'ecran de jeu, pour ce qui depend des reglages de la partie.
 */

import type { ReglagesPartie } from '@neon-ninja/shared';

/**
 * Le rappel de la touche de la poche, selon les objets de poche en jeu (etapes 7.10 et
 * 7.11): la fumee, la mine, ou l'une ou l'autre. Rien si aucun n'est en jeu.
 */
export function toucheDeLaPoche(objets: ReglagesPartie['objetsDePoche']): string {
  if (objets.fumee.actif && objets.mine.actif) {
    return ' · E pour la poche';
  }

  if (objets.fumee.actif) {
    return ' · E pour la fumée';
  }

  return objets.mine.actif ? ' · E pour poser la mine' : '';
}
