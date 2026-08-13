/**
 * Attribution des couleurs, en version deterministe.
 *
 * Portage de getRandomColor (legacy/server.js:1512) et getUniqueColor (:1521).
 * Le legacy tirait ces couleurs avec Math.random et allait lire l'objet global
 * des joueurs pour savoir lesquelles etaient prises. Ici tout arrive en
 * parametre: le generateur a graine, et la liste des couleurs a eviter. Deux
 * parties de meme graine attribuent donc exactement les memes couleurs.
 */

import type { Alea, Tirage } from '@neon-ninja/shared';
import { COULEURS_JOUEURS, element, entier } from '@neon-ninja/shared';

/** Une couleur au format hexadecimal, par exemple '#FF0000'. */
export type Couleur = string;

const CHIFFRES_HEXADECIMAUX = '0123456789ABCDEF';

/**
 * Nombre maximal de tirages avant d'abandonner la recherche d'une couleur
 * inedite. Le legacy bouclait sans limite; avec plus de seize millions de
 * couleurs possibles le cas ne se produit pas, mais une boucle sans sortie n'a
 * pas sa place dans un moteur qui tourne vingt fois par seconde.
 */
const TENTATIVES_MAXIMUM = 32;

/** Tire une couleur au hasard parmi les seize millions de couleurs hexadecimales. */
export function couleurAleatoire(alea: Alea): Tirage<Couleur> {
  let courant = alea;
  let couleur = '#';

  for (let index = 0; index < 6; index += 1) {
    const tirage = entier(courant, 16);
    couleur += CHIFFRES_HEXADECIMAUX[tirage.valeur];
    courant = tirage.alea;
  }

  return { valeur: couleur, alea: courant };
}

/**
 * Tire une couleur qui n'est pas deja prise.
 *
 * Tant que la palette des joueurs contient une couleur libre, on y puise: ce
 * sont les six couleurs vives et bien distinctes du jeu. Une fois la palette
 * epuisee, on tire une couleur quelconque, en evitant celles interdites.
 *
 * @param couleursExclues Couleurs a ne pas attribuer: celles des autres joueurs,
 *                        et, lors d'une reapparition, celle de l'attaquant et
 *                        celle que la victime portait.
 */
export function couleurUnique(alea: Alea, couleursExclues: readonly Couleur[]): Tirage<Couleur> {
  const libres = COULEURS_JOUEURS.filter((couleur) => !couleursExclues.includes(couleur));

  if (libres.length > 0) {
    return element(alea, libres);
  }

  let courant = alea;
  for (let tentative = 0; tentative < TENTATIVES_MAXIMUM; tentative += 1) {
    const tirage = couleurAleatoire(courant);
    courant = tirage.alea;

    if (!couleursExclues.includes(tirage.valeur)) {
      return tirage;
    }
  }

  // Cas theorique: on rend la derniere couleur tiree plutot que de boucler ou
  // de lever une erreur. Une couleur en double est un desagrement, pas une
  // partie interrompue.
  return couleurAleatoire(courant);
}
