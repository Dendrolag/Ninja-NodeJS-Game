/**
 * Le lointain d'une carte, qui glisse moins vite que le terrain (etape 8.8).
 *
 * FONCTIONS PURES. Le rendu les appelle a chaque image et pose le resultat sur le
 * sprite du lointain; rien ici ne connait PixiJS.
 *
 * L'IMPRESSION DE PROFONDEUR. Le terrain suit la camera exactement: quand elle avance
 * de cent pixels, il recule de cent pixels a l'ecran. Le lointain, lui, se decale dans
 * le sens de la camera d'une part de son ecart au centre de la carte: il recule moins
 * vite a l'ecran, comme ce qui est loin quand on se deplace.
 *
 * LA PART SE DEDUIT DE LA COURSE DE LA CAMERA. Sur chaque axe, la camera va de la
 * moitie de la vue au bord oppose: sa course, de part et d'autre du centre, est la
 * moitie de ce que la carte a de plus que la vue. La part est choisie pour qu'au bout
 * de la course, le lointain se soit ecarte de toute l'amplitude permise, et pas plus:
 * le centre du lointain peut etre vide, cache par le terrain, et l'amplitude est ce
 * qui le garde cache (LOINTAIN, apparence.ts). Plus la vue est petite, plus la course
 * est longue et plus la part est faible: l'effet est plus discret sur telephone.
 *
 * LE LOINTAIN COUVRE TOUJOURS L'ECRAN. Il a la taille de la carte, et la camera ne
 * montre jamais au-dela de la carte (borner, camera.ts): decale de moins que la
 * course, son bord reste hors de la vue.
 */

import type { DimensionsCarte, Position } from '@neon-ninja/shared';

import { LOINTAIN } from './apparence.js';
import type { Camera } from './camera.js';

/** Le reglage du lointain: jusqu'ou il s'ecarte, et quelle part de la camera il suit. */
export interface ReglageDuLointain {
  readonly amplitudePx: number;
  readonly partMaximale: number;
}

/** Taille de l'ecran, en pixels d'ecran. */
interface Ecran {
  readonly largeur: number;
  readonly hauteur: number;
}

/**
 * De combien le lointain s'ecarte de sa place, en pixels de carte.
 *
 * Nul quand la camera regarde le centre de la carte, et sur un axe ou la vue est plus
 * grande que la carte: la camera y est centree et ne bouge pas.
 */
export function decalageDuLointain(
  camera: Camera,
  ecran: Ecran,
  carte: DimensionsCarte,
  reglage: ReglageDuLointain = LOINTAIN,
): Position {
  return {
    x: decalageSurUnAxe(camera.x, carte.largeur, ecran.largeur / camera.echelle, reglage),
    y: decalageSurUnAxe(camera.y, carte.hauteur, ecran.hauteur / camera.echelle, reglage),
  };
}

/** Le decalage sur un axe, a partir du centre de la camera et de la taille de la vue. */
function decalageSurUnAxe(
  centre: number,
  dimensionCarte: number,
  dimensionVue: number,
  reglage: ReglageDuLointain,
): number {
  const course = (dimensionCarte - dimensionVue) / 2;

  if (course <= 0) {
    return 0;
  }

  const part = Math.min(reglage.partMaximale, reglage.amplitudePx / course);
  const ecart = (centre - dimensionCarte / 2) * part;

  // La camera descend un peu sous le HUD, au-dela de sa course (borner, camera.ts):
  // l'amplitude reste la limite, quoi qu'il arrive.
  return Math.min(Math.max(ecart, -reglage.amplitudePx), reglage.amplitudePx);
}

/**
 * Ou poser le sprite du lointain, deja etire a la taille de la carte et oriente.
 *
 * En miroir, le sprite retourne s'etend vers la gauche depuis le bord droit de la carte
 * (orienterLeDecor, miroir.ts): le decalage s'ajoute a ce bord. Il ne change pas de
 * sens, puisqu'il suit la camera et non l'image.
 */
export function positionDuLointain(
  decalage: Position,
  largeurCarte: number,
  modeMiroir: boolean,
): Position {
  return { x: (modeMiroir ? largeurCarte : 0) + decalage.x, y: decalage.y };
}
