/**
 * Ce que les sept gestes des taches courtes d'Among Ninjas ont en commun (etape 7.21): leur
 * espace, les commandes qu'ils recoivent, et les echos qu'ils laissent, que la page fait
 * entendre.
 *
 * UN GESTE EST UN MODELE PUR. Il recoit des commandes (le pointeur, une touche, le temps qui
 * passe) avec l'instant local, et rend son nouvel etat. Le composant (composants/tache.ts) le
 * dessine et le relaie au serveur une fois fini; rien ici ne touche au DOM.
 *
 * L'ESPACE D'UN GESTE est un rectangle de 400 sur 300 unites, le meme au bureau et au
 * telephone: le composant le pose a l'echelle de sa fenetre, et ramene le pointeur dedans.
 *
 * LE RYTHME. Le serveur refuse une tache finie avant sa duree minimale
 * (DUREES_MINIMALES_DES_TACHES_MS). Chaque geste est regle pour qu'un joueur rapide et
 * honnete finisse juste au-dessus: chaque etape joue une petite animation pendant laquelle
 * la suivante attend, et le geste n'est fini qu'une fois la derniere jouee. Les tests le
 * verifient, geste par geste, en le jouant le plus vite possible.
 */

import { creerAlea, entier, reel } from '@neon-ninja/shared';

/** La largeur et la hauteur de l'espace d'un geste, en unites. */
export const LARGEUR_DU_GESTE = 400;
export const HAUTEUR_DU_GESTE = 300;

/** Un point de l'espace d'un geste. */
export interface PointDuGeste {
  readonly x: number;
  readonly y: number;
}

/** Les touches qu'un geste ecoute. */
export type ToucheDeGeste = 'gauche' | 'droite' | 'haut' | 'bas' | 'espace';

/**
 * Une commande: le pointeur (souris ou doigt) pose, deplace ou leve en un point; une touche
 * enfoncee ou relachee; ou le temps qui passe, a chaque image.
 */
export type CommandeDeGeste =
  | {
      readonly type: 'pointeur';
      readonly phase: 'bas' | 'deplace' | 'haut';
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'touche'; readonly touche: ToucheDeGeste; readonly enfoncee: boolean }
  | { readonly type: 'temps' };

/**
 * Ce qu'un geste fait entendre: une passe de lame, un fil branche, une mine rangee, une
 * cartouche inseree, un bonus rempli, un essai rate. Le frottement et le remplissage, qui
 * durent, n'ont pas d'echo: leurs sons en boucle restent a fournir (fiche, section « Les
 * sons »).
 *
 * Les mini-jeux des taches longues (etape 7.24) en ajoutent: une caisse posee, une ligne
 * effacee, un fruit mange, un shuriken lance, un Black Ninja abattu, un tir a l'eau, un tir qui
 * touche, et une partie perdue, avant la partie neuve.
 */
export type EchoDeGeste =
  | 'passe'
  | 'fil'
  | 'mine'
  | 'cartouche'
  | 'remplie'
  | 'ratee'
  | 'posee'
  | 'ligne'
  | 'fruit'
  | 'lancer'
  | 'abattu'
  | 'eau'
  | 'touche'
  | 'perdue';

/** Ce que tout geste porte: ses echos, dans l'ordre. */
export interface BaseDeGeste {
  readonly echos: readonly EchoDeGeste[];
}

/** Ou en est un geste: les etapes faites, sur combien. */
export interface AvancementDuGeste {
  readonly faits: number;
  readonly total: number;
}

/** L'etat avec cet echo de plus. */
export function avecEcho<E extends BaseDeGeste>(etat: E, echo: EchoDeGeste): E {
  return { ...etat, echos: [...etat.echos, echo] };
}

/** La distance entre deux points de l'espace. */
export function distance(un: PointDuGeste, autre: PointDuGeste): number {
  return Math.hypot(un.x - autre.x, un.y - autre.y);
}

/** Ce point est-il dans ce rectangle, bords compris. */
export function dansLeRectangle(
  point: PointDuGeste,
  gauche: number,
  haut: number,
  largeur: number,
  hauteur: number,
): boolean {
  return (
    point.x >= gauche && point.x <= gauche + largeur && point.y >= haut && point.y <= haut + hauteur
  );
}

/** Des tirages a la suite, d'une meme graine: ce que montre un geste, pour son dessin. */
export interface Tireur {
  /** Un reel dans [minimum, maximum[. */
  reel(minimum: number, maximum: number): number;
  /** Une liste melangee. */
  melanger<T>(liste: readonly T[]): readonly T[];
}

/**
 * Un tireur, du generateur a graine du paquet partage: la meme graine montre le meme geste,
 * d'une ouverture a l'autre et dans les tests.
 */
export function tireur(graine: number): Tireur {
  let alea = creerAlea(graine);

  return {
    reel(minimum, maximum) {
      const tirage = reel(alea, minimum, maximum);
      alea = tirage.alea;
      return tirage.valeur;
    },
    melanger(liste) {
      const copie = [...liste];

      for (let rang = copie.length - 1; rang > 0; rang -= 1) {
        const tirage = entier(alea, rang + 1);
        alea = tirage.alea;
        const choisi = copie[tirage.valeur] as (typeof copie)[number];
        copie[tirage.valeur] = copie[rang] as (typeof copie)[number];
        copie[rang] = choisi;
      }

      return copie;
    },
  };
}
