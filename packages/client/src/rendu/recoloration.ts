/**
 * La recoloration des ninjas: quelle part du sprite prend la couleur de son
 * proprietaire.
 *
 * LE SPRITE EST ROUGE, ET UNE TEINTE SEULE NE SAIT PAS LE RECOLORER. Une teinte
 * multiplie chaque pixel par une couleur: sur un sprite rouge, le blanc laisse du
 * rouge et le vert donne du noir. Le jeu d'origine remplacait les pixels proches du
 * rouge par la couleur voulue, en fabriquant un canevas par entite et par couleur.
 *
 * ICI, CHAQUE IMAGE EST COUPEE UNE FOIS EN DEUX CALQUES, au chargement:
 *
 *   - le CORPS, les pixels a repeindre, passes en blanc: une teinte les rend
 *     exactement de la couleur voulue, puisque blanc fois couleur donne la couleur;
 *   - les DETAILS, tous les autres pixels, laisses intacts et jamais teintes.
 *
 * Poses l'un sur l'autre, ils donnent au pixel pres l'image du jeu d'origine, et
 * les textures restent partagees par toutes les entites: le GPU applique la
 * couleur, sans canevas par joueur.
 *
 * FONCTION PURE, sur un tableau de pixels. Le rendu PixiJS lui fournit ceux de
 * chaque image chargee (pixi.ts).
 */

import { REPEINTE_DU_NINJA } from './apparence.js';

/** Les deux calques d'une image de ninja, en pixels RVBA, de la taille de l'image. */
export interface CalquesDuNinja {
  /** Les pixels a repeindre, en blanc, avec leur opacite d'origine. Transparent ailleurs. */
  readonly corps: Uint8ClampedArray;
  /** Tous les autres pixels, intacts. Transparent la ou est le corps. */
  readonly details: Uint8ClampedArray;
}

/**
 * Coupe une image de ninja en ses deux calques.
 *
 * @param pixels Les pixels de l'image, quatre octets par pixel: rouge, vert, bleu, opacite.
 */
export function separerLesCalques(pixels: ArrayLike<number>): CalquesDuNinja {
  const corps = new Uint8ClampedArray(pixels.length);
  const details = new Uint8ClampedArray(pixels.length);

  for (let index = 0; index < pixels.length; index += 4) {
    const rouge = pixels[index] ?? 0;
    const vert = pixels[index + 1] ?? 0;
    const bleu = pixels[index + 2] ?? 0;
    const opacite = pixels[index + 3] ?? 0;

    if (estARepeindre(rouge, vert, bleu)) {
      corps.set([255, 255, 255, opacite], index);
    } else {
      details.set([rouge, vert, bleu, opacite], index);
    }
  }

  return { corps, details };
}

/** Ce pixel est-il assez proche du rouge pur pour prendre la couleur du proprietaire. */
function estARepeindre(rouge: number, vert: number, bleu: number): boolean {
  const { cible, tolerance } = REPEINTE_DU_NINJA;

  return (
    Math.abs(rouge - cible.r) <= tolerance &&
    Math.abs(vert - cible.v) <= tolerance &&
    Math.abs(bleu - cible.b) <= tolerance
  );
}

/**
 * Raye le calque du corps d'une image de ninja, par bandes horizontales de deux couleurs:
 * le corps de l'Evade (etape 7.9, skin C de la planche docs/design/etape-7-9/). Aucune
 * image n'est livree pour lui: ses rayures se calculent sur les sprites du jeu.
 *
 * Seuls les pixels du corps changent de couleur, en gardant leur opacite; le reste du
 * calque reste transparent. La premiere bande, en haut, est de la premiere couleur.
 *
 * FONCTION PURE, sur un tableau de pixels, comme separerLesCalques.
 *
 * @param corps   Le calque du corps, tel que separerLesCalques le rend.
 * @param largeur La largeur de l'image, en pixels.
 * @param bande   L'epaisseur d'une bande, en lignes de pixels.
 * @param couleurs Les deux couleurs des bandes, en 24 bits.
 */
export function rayerLeCorps(
  corps: Uint8ClampedArray,
  largeur: number,
  bande: number,
  couleurs: readonly [number, number],
): Uint8ClampedArray {
  const raye = new Uint8ClampedArray(corps.length);

  for (let index = 0; index < corps.length; index += 4) {
    const opacite = corps[index + 3] ?? 0;

    if (opacite === 0) {
      continue;
    }

    const ligne = Math.floor(index / 4 / largeur);
    const couleur = Math.floor(ligne / bande) % 2 === 0 ? couleurs[0] : couleurs[1];

    raye.set([(couleur >> 16) & 0xff, (couleur >> 8) & 0xff, couleur & 0xff, opacite], index);
  }

  return raye;
}
