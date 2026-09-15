/**
 * La camera: quelle portion de la carte on regarde, et a quel grossissement.
 *
 * FONCTIONS PURES, ETAT IMMUABLE. Une camera est un objet de trois nombres; la
 * suivante se calcule a partir de la precedente, de la cible et du temps ecoule.
 * Le client d'origine gardait sa camera dans une variable de module que six
 * endroits differents ecrivaient, dont un dans un rappel d'animation qui
 * s'executait apres la verification des limites: la camera pouvait donc sortir
 * de la carte pendant une image, ce qui se voyait comme un saut.
 *
 * LE SUIVI NE DEPEND PLUS DE LA CADENCE D'AFFICHAGE. Le jeu d'origine rattrapait
 * huit pour cent de l'ecart PAR IMAGE: sur un ecran a 144 hertz, la camera
 * collait au joueur, sur un ecran a 30 hertz elle trainait. Ici le rattrapage est
 * exponentiel et prend le temps ecoule en parametre, si bien que deux machines
 * differentes voient la meme camera au meme instant. Le reglage est choisi pour
 * reproduire la sensation d'origine a soixante images par seconde.
 */

import type { DimensionsCarte, Position } from '@neon-ninja/shared';

import { CADRAGE_MOBILE, HAUTEUR_DE_VUE_PX, VITESSE_CAMERA_PAR_SECONDE } from './apparence.js';

/** Ou la camera regarde, et de combien elle grossit. */
export interface Camera {
  /** Point de la carte au centre de l'ecran. */
  readonly x: number;
  readonly y: number;
  /** Grossissement: un pixel de carte occupe cette fraction de pixel d'ecran. */
  readonly echelle: number;
}

/** Taille de la zone d'affichage, en pixels d'ecran. */
export interface TailleEcran {
  readonly largeur: number;
  readonly hauteur: number;
}

/**
 * Choisit le grossissement en fonction de la fenetre et de la carte.
 *
 * Portage de initializeCamera. Deux cadrages: sur ordinateur on vise une hauteur
 * de vue constante, de sorte que la portion de terrain visible ne depende pas de
 * la taille de la fenetre; sur mobile on serre davantage, parce qu'un ecran de
 * telephone tenu a la main ne se lit pas comme un moniteur.
 */
export function echellePour(ecran: TailleEcran, carte: DimensionsCarte, mobile: boolean): number {
  if (mobile) {
    return Math.min(ecran.largeur / CADRAGE_MOBILE.largeur, ecran.hauteur / CADRAGE_MOBILE.hauteur);
  }

  const proportionsCarte = carte.largeur / carte.hauteur;
  const proportionsEcran = ecran.largeur / ecran.hauteur;

  return proportionsEcran > proportionsCarte
    ? ecran.hauteur / HAUTEUR_DE_VUE_PX
    : ecran.largeur / (HAUTEUR_DE_VUE_PX * proportionsCarte);
}

/**
 * Ramene un centre de camera dans les limites de la carte.
 *
 * Sans cela, suivre un joueur colle a un bord montrerait du vide a cote du
 * terrain. Quand la vue est plus large que la carte, il n'y a pas de position
 * valable: on centre la carte, ce que le jeu d'origine ne faisait pas et qui se
 * voyait sur les petites cartes en plein ecran.
 */
export function borner(
  centre: Position,
  ecran: TailleEcran,
  camera: Camera,
  carte: DimensionsCarte,
): Position {
  const demiLargeur = ecran.largeur / camera.echelle / 2;
  const demiHauteur = ecran.hauteur / camera.echelle / 2;

  const x =
    demiLargeur * 2 >= carte.largeur
      ? carte.largeur / 2
      : Math.min(Math.max(centre.x, demiLargeur), carte.largeur - demiLargeur);

  const y =
    demiHauteur * 2 >= carte.hauteur
      ? carte.hauteur / 2
      : Math.min(Math.max(centre.y, demiHauteur), carte.hauteur - demiHauteur);

  return { x, y };
}

/** Une camera centree d'emblee sur un point, sans transition. */
export function cameraSur(
  centre: Position,
  ecran: TailleEcran,
  carte: DimensionsCarte,
  mobile: boolean,
): Camera {
  const echelle = echellePour(ecran, carte, mobile);
  const borne = borner(centre, ecran, { x: centre.x, y: centre.y, echelle }, carte);

  return { x: borne.x, y: borne.y, echelle };
}

/**
 * Avance la camera vers sa cible.
 *
 * Rattrapage exponentiel: la camera comble a chaque instant une part de l'ecart
 * qui la separe de sa cible, ce qui donne un mouvement doux qui ne depasse
 * jamais. La formule ne depend pas de la cadence d'affichage, seulement du temps
 * ecoule.
 *
 * @param dtMs Temps ecoule depuis l'image precedente, en millisecondes.
 */
export function suivre(
  camera: Camera,
  cible: Position,
  ecran: TailleEcran,
  carte: DimensionsCarte,
  dtMs: number,
): Camera {
  const borne = borner(cible, ecran, camera, carte);
  const part = 1 - Math.exp((-VITESSE_CAMERA_PAR_SECONDE * Math.max(dtMs, 0)) / 1000);

  const suivie = {
    x: camera.x + (borne.x - camera.x) * part,
    y: camera.y + (borne.y - camera.y) * part,
    echelle: camera.echelle,
  };

  // La camera est bornee APRES le rattrapage, et pas seulement avant: sa
  // position de depart peut etre hors limites juste apres un changement de
  // taille de fenetre, qui modifie la portion visible.
  const dansLesLimites = borner(suivie, ecran, camera, carte);

  return { x: dansLesLimites.x, y: dansLesLimites.y, echelle: camera.echelle };
}

/** Ou tombe un point de la carte sur l'ecran. Sert au HUD et a la saisie. */
export function versEcran(point: Position, camera: Camera, ecran: TailleEcran): Position {
  return {
    x: (point.x - camera.x) * camera.echelle + ecran.largeur / 2,
    y: (point.y - camera.y) * camera.echelle + ecran.hauteur / 2,
  };
}

/** La portion de carte actuellement visible, en coordonnees de carte. */
export interface ZoneVisible {
  readonly gauche: number;
  readonly haut: number;
  readonly droite: number;
  readonly bas: number;
}

/**
 * Ce que la camera montre en ce moment.
 *
 * La minimap s'en sert pour dessiner le rectangle de vue, et le rendu pourra
 * s'en servir plus tard pour ne pas dessiner ce qui est hors champ. La marge
 * evite qu'une entite a cheval sur le bord apparaisse d'un coup.
 */
export function zoneVisible(camera: Camera, ecran: TailleEcran, marge = 0): ZoneVisible {
  const demiLargeur = ecran.largeur / camera.echelle / 2 + marge;
  const demiHauteur = ecran.hauteur / camera.echelle / 2 + marge;

  return {
    gauche: camera.x - demiLargeur,
    haut: camera.y - demiHauteur,
    droite: camera.x + demiLargeur,
    bas: camera.y + demiHauteur,
  };
}
