/**
 * Attribution des couleurs, en version deterministe.
 *
 * Portage de getRandomColor (legacy/server.js:1512) et getUniqueColor (:1521).
 * Le legacy tirait ces couleurs avec Math.random et allait lire l'objet global
 * des joueurs pour savoir lesquelles etaient prises. Ici tout arrive en
 * parametre: le generateur a graine, et la liste des couleurs a eviter. Deux
 * parties de meme graine attribuent donc exactement les memes couleurs.
 */

import type { Alea, Couleur, Tirage } from '@neon-ninja/shared';
import {
  COULEURS_JOUEURS,
  COULEUR_BOT_NEUTRE,
  COULEUR_BOT_NOIR,
  COULEUR_DES_TRAQUEURS,
  element,
  entier,
} from '@neon-ninja/shared';

/**
 * Une couleur au format hexadecimal, par exemple '#FF0000'.
 *
 * La definition vit dans @neon-ninja/shared, avec la palette des joueurs: le
 * serveur et le client parlent de la meme chose que le moteur. Elle est
 * republiee ici pour que le moteur reste lisible sans sortir de son paquet.
 */
export type { Couleur };

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
 * epuisee, on tire une couleur quelconque, en evitant celles interdites, et la
 * couleur des traqueurs du mode Chasse, reservee a leur role (etape 7.3).
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

  return couleurAleatoireHorsDe(alea, [...couleursExclues, COULEUR_DES_TRAQUEURS]);
}

/**
 * Tire des couleurs quelconques jusqu'a en trouver une qui n'est pas interdite.
 *
 * Au bout de TENTATIVES_MAXIMUM tirages, cas theorique, on rend la derniere
 * couleur tiree plutot que de boucler ou de lever une erreur. Une couleur en
 * double est un desagrement, pas une partie interrompue.
 */
function couleurAleatoireHorsDe(alea: Alea, interdites: readonly Couleur[]): Tirage<Couleur> {
  let tirage = couleurAleatoire(alea);

  for (
    let tentative = 1;
    tentative < TENTATIVES_MAXIMUM && interdites.includes(tirage.valeur);
    tentative += 1
  ) {
    tirage = couleurAleatoire(tirage.alea);
  }

  return tirage;
}

/**
 * Tire la couleur d'un bot qui nait.
 *
 * Portage du constructeur d'Entity (legacy/server.js:838), qui donne a chaque bot
 * une couleur quelconque par getRandomColor: la carte se remplit de bots de
 * toutes les couleurs, que les joueurs viennent ensuite repeindre.
 *
 * Une precaution que le legacy ne prenait pas: la couleur tiree n'est jamais
 * celle d'un joueur, ni une couleur de la palette qu'un joueur pourrait recevoir,
 * ni le blanc des bots neutres, ni le noir des bots noirs. Une chance sur deux
 * millions par bot, dans le legacy, de naitre deja compte dans un score. Ni, depuis
 * l'etape 7.3, la couleur des traqueurs du mode Chasse, reservee a leur role.
 *
 * @param couleursExclues Les couleurs des joueurs presents, qui peuvent sortir de
 *                        la palette quand elle est epuisee.
 */
export function couleurDeBot(alea: Alea, couleursExclues: readonly Couleur[]): Tirage<Couleur> {
  return couleurAleatoireHorsDe(alea, [
    ...COULEURS_JOUEURS,
    COULEUR_BOT_NEUTRE,
    COULEUR_BOT_NOIR,
    COULEUR_DES_TRAQUEURS,
    ...couleursExclues,
  ]);
}
