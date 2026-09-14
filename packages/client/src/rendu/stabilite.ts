/**
 * Le juge de stabilite: l'affichage d'une partie qui commence est-il devenu fluide.
 *
 * POURQUOI. Au lancement d'une partie, les premieres images dessinees coutent cher: le
 * decor, deux images de 3000 par 2000 pixels, part vers la carte graphique, et la
 * lueur se prepare. Sur telephone, le jeu ramait ainsi quelques instants avant de se
 * stabiliser (recette de l'etape 5.4). L'ecran de jeu garde donc son ecran de
 * preparation jusqu'a ce que ce juge declare l'affichage fluide.
 *
 * LA REGLE (STABILITE, apparence.ts). Le decompte ne commence qu'a la premiere image
 * ou la partie est dessinee. L'affichage est stable apres assez d'images rapides
 * d'affilee; une image lente remet le compte a zero. Il l'est de toute facon au bout
 * de l'attente maximale: mieux vaut une partie qui rame qu'un ecran qui ne se leve
 * pas. Une fois stable, il le reste.
 *
 * Il ne lit aucune horloge: on lui donne l'instant de chaque image, celui que le
 * navigateur fournit a la boucle de rendu.
 */

import { STABILITE } from './apparence.js';

/** Les seuils du juge. */
export interface ReglageDeStabilite {
  readonly imagesRapidesRequises: number;
  readonly dureeImageRapideMs: number;
  readonly attenteMaximaleMs: number;
}

/** Un juge, qui observe les images une a une. */
export interface JugeDeStabilite {
  /**
   * Observe une image.
   *
   * @param instant        L'instant de l'image, en millisecondes.
   * @param partieDessinee La partie est-elle dessinee dans cette image.
   * @returns L'affichage est-il stable.
   */
  observer(instant: number, partieDessinee: boolean): boolean;
}

/** Cree un juge qui n'a encore rien vu. */
export function creerJugeDeStabilite(reglage: ReglageDeStabilite = STABILITE): JugeDeStabilite {
  let debut: number | undefined;
  let precedent = 0;
  let rapides = 0;
  let stable = false;

  return {
    observer(instant, partieDessinee) {
      if (stable || !partieDessinee) {
        return stable;
      }

      if (debut === undefined) {
        debut = instant;
        precedent = instant;
        return false;
      }

      rapides = instant - precedent <= reglage.dureeImageRapideMs ? rapides + 1 : 0;
      precedent = instant;
      stable =
        rapides >= reglage.imagesRapidesRequises || instant - debut >= reglage.attenteMaximaleMs;

      return stable;
    },
  };
}
