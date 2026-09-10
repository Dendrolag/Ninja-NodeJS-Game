/**
 * Les animations: ce qui change a l'ecran sans que l'etat du jeu change.
 *
 * TOUT SE CALCULE A PARTIR DU TEMPS, ET RIEN NE SE RETIENT. Aucune de ces
 * fonctions ne garde de compteur: on leur donne l'instant, elles rendent
 * l'apparence a cet instant. C'est ce qui les rend testables comme des
 * fonctions mathematiques, et ce qui evite une famille entiere de defauts, celle
 * ou une animation se decale parce qu'une image a ete sautee.
 *
 * LE CLIGNOTEMENT DES OBJETS EST PASSE DU SERVEUR AU CLIENT. Le jeu d'origine
 * calculait cote serveur une opacite et une echelle a partir de son horloge, et
 * les envoyait vingt fois par seconde a tout le monde (champs isBlinking et
 * blinkState de son updateEntities). C'est de l'animation: elle se calcule ici,
 * a partir de la duree de vie restante que le contrat transporte deja.
 */

import { IMAGES_DE_MARCHE, OBJETS } from '@neon-ninja/shared';

import type { Halo } from './apparence.js';
import { CADENCE_CLIGNOTEMENT, CADENCE_MARCHE_MS } from './apparence.js';

/**
 * Quelle image de marche montrer a cet instant.
 *
 * Les deux images alternent a cadence fixe, et TOUTES LES ENTITES SONT EN PHASE.
 * Le jeu d'origine faisait de meme, avec un compteur unique dans son gestionnaire
 * de sprites: cent ninjas qui marchent au pas ne choquent pas a l'oeil, alors
 * qu'un compteur par entite couterait cent etats a tenir a jour.
 *
 * @param maintenant Instant local, en millisecondes.
 * @returns Numero d'image, a partir de un.
 */
export function imageDeMarche(maintenant: number): number {
  return (Math.floor(maintenant / CADENCE_MARCHE_MS) % IMAGES_DE_MARCHE) + 1;
}

/**
 * Le rayon d'un halo qui pulse, a cet instant.
 *
 * @param maintenant Instant local, en millisecondes.
 */
export function rayonPulsant(halo: Halo, maintenant: number): number {
  return halo.rayon + Math.sin(maintenant * halo.cadence) * halo.amplitude;
}

/**
 * L'opacite d'un objet pose sur la carte, a cet instant.
 *
 * Un objet qui va disparaitre clignote, ce qui laisse au joueur le temps de
 * decider s'il court le chercher. Au-dessus du seuil, il est pleinement opaque.
 *
 * @param dureeDeVieRestanteMs Ce que le contrat transporte pour cet objet.
 * @param maintenant           Instant local, en millisecondes.
 */
export function opaciteObjet(dureeDeVieRestanteMs: number, maintenant: number): number {
  if (dureeDeVieRestanteMs > OBJETS.SEUIL_CLIGNOTEMENT_MS) {
    return 1;
  }

  return 0.3 + Math.abs(Math.sin(maintenant * CADENCE_CLIGNOTEMENT)) * 0.7;
}
