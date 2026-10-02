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
 *   - le CORPS, la part rouge de chaque pixel, passee en blanc: une teinte la rend
 *     exactement de la couleur voulue, puisque blanc fois couleur donne la couleur;
 *   - les DETAILS, le reste, jamais teinte, dessine dessous.
 *
 * UN PIXEL PEUT ETRE EN PARTIE DANS CHAQUE CALQUE (etape 4.8). Le corps du sprite est
 * adouci vers son contour: un pixel de bord est un melange du rouge et d'un detail
 * neutre. Il donne sa part de rouge au corps, en opacite, et son fond aux details;
 * superposes, les deux calques le redonnent dans la couleur voulue, son adoucissement
 * garde. Le jeu d'origine repeignait chaque pixel en entier ou pas du tout, et son bord
 * devenait un escalier borde de rouge.
 *
 * Les textures restent partagees par toutes les entites: le GPU applique la couleur,
 * sans canevas par joueur.
 *
 * FONCTION PURE, sur un tableau de pixels. Le rendu PixiJS lui fournit ceux de
 * chaque image chargee (pixi.ts).
 */

import { REPEINTE_DU_NINJA, YEUX_DU_BLACK_NINJA } from './apparence.js';

/** Les deux calques d'une image de ninja, en pixels RVBA, de la taille de l'image. */
export interface CalquesDuNinja {
  /** La part rouge de chaque pixel, en blanc, a l'opacite de cette part. */
  readonly corps: Uint8ClampedArray;
  /** Le reste de chaque pixel, a l'opacite qui, sous le corps, redonne celle du pixel. */
  readonly details: Uint8ClampedArray;
}

/**
 * Coupe une image de ninja en ses deux calques.
 *
 * Un pixel d'opacite a, dont la part de rouge est t et le fond f, se dessine en f
 * teinte de t fois la couleur voulue. Le corps porte du blanc a l'opacite a fois t. Les
 * details portent f, a l'opacite qui fait que les deux calques superposes couvrent
 * exactement a: a (1 - t) / (1 - a t). Le rouge pur n'a pas de fond, et ne laisse rien
 * aux details.
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

    if (opacite === 0) {
      continue;
    }

    const part = partDeRouge(rouge, vert, bleu);

    if (part > 0) {
      corps.set([255, 255, 255, opacite * part], index);
    }

    if (part < 1) {
      const a = opacite / 255;
      // Le fond: ce qui reste du pixel une fois sa part de rouge retiree.
      details.set(
        [
          (rouge - part * 255) / (1 - part),
          vert / (1 - part),
          bleu / (1 - part),
          (255 * a * (1 - part)) / (1 - a * part),
        ],
        index,
      );
    }
  }

  return { corps, details };
}

/**
 * La part de rouge d'un pixel, de zero a un: celle d'un melange du rouge pur et d'un
 * fond neutre. Zero pour un neutre et pour un pixel qui n'est pas un tel melange, comme
 * la peau.
 */
export function partDeRouge(rouge: number, vert: number, bleu: number): number {
  const { ecartNeutre, excesMinimum } = REPEINTE_DU_NINJA;
  const exces = rouge - Math.max(vert, bleu);

  if (Math.abs(vert - bleu) > ecartNeutre || exces < excesMinimum) {
    return 0;
  }

  return Math.min(1, exces / 255);
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

/**
 * Rougit les yeux d'un calque de details: le regard du Black Ninja (etape 5.8, marque A de la
 * planche docs/design/etape-5-8/). Les reflets clairs et neutres du masque, gris ou blancs,
 * prennent la couleur donnee, en gardant leur opacite; les autres details, le cerne et la
 * peau, ne changent pas.
 *
 * FONCTION PURE, sur un tableau de pixels, comme separerLesCalques.
 *
 * @param details Le calque des details, tel que separerLesCalques le rend.
 * @param couleur La couleur des yeux, en 24 bits.
 */
export function rougirLesYeux(details: Uint8ClampedArray, couleur: number): Uint8ClampedArray {
  const rougis = Uint8ClampedArray.from(details);
  const { clarte, ecart } = YEUX_DU_BLACK_NINJA;

  for (let index = 0; index < details.length; index += 4) {
    const rouge = details[index] ?? 0;
    const vert = details[index + 1] ?? 0;
    const bleu = details[index + 2] ?? 0;
    const opacite = details[index + 3] ?? 0;
    const clair = rouge > clarte && vert > clarte && bleu > clarte;
    const neutre = Math.max(rouge, vert, bleu) - Math.min(rouge, vert, bleu) < ecart;

    if (opacite > 0 && clair && neutre) {
      rougis.set([(couleur >> 16) & 0xff, (couleur >> 8) & 0xff, couleur & 0xff, opacite], index);
    }
  }

  return rougis;
}
