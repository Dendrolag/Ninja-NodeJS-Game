/**
 * Le ninja d'un joueur, a sa couleur, dans un ecran de la page (etape 7.20): la revelation et
 * la reunion d'Among Ninjas montrent chaque joueur par son ninja, puisque toute accusation passe
 * par une couleur.
 *
 * Le sprite du jeu, teint comme la carte le teint: seul son corps prend la couleur, ses details
 * restent (rendu/recoloration.ts). Le sprite se charge une fois; un avatar demande avant est
 * peint des qu'il arrive.
 */

import { RACINE_RESSOURCES, cheminNinja } from '@neon-ninja/shared';

import { separerLesCalques } from '../rendu/recoloration.js';

/** Les deux calques du ninja de face, une fois charges. */
interface Calques {
  readonly corps: Uint8ClampedArray;
  readonly details: Uint8ClampedArray;
  readonly largeur: number;
  readonly hauteur: number;
}

let calques: Promise<Calques | undefined> | undefined;

/** Charge le ninja de face et separe ses calques, une seule fois pour toute la page. */
function chargerLesCalques(doc: Document): Promise<Calques | undefined> {
  calques ??= new Promise((resoudre) => {
    const image = doc.createElement('img');
    image.onload = () => {
      const toile = doc.createElement('canvas');
      toile.width = image.naturalWidth;
      toile.height = image.naturalHeight;
      const contexte = toile.getContext('2d', { willReadFrequently: true });

      if (contexte === null) {
        resoudre(undefined);
        return;
      }

      contexte.drawImage(image, 0, 0);
      const separes = separerLesCalques(
        contexte.getImageData(0, 0, toile.width, toile.height).data,
      );
      resoudre({ ...separes, largeur: toile.width, hauteur: toile.height });
    };
    image.onerror = () => {
      resoudre(undefined);
    };
    image.src = `${RACINE_RESSOURCES}/${cheminNinja('immobile')}`;
  });

  return calques;
}

/** Peint le ninja a cette couleur dans ce canevas: les details, puis le corps teint par-dessus. */
function peindre(toile: HTMLCanvasElement, couleur: string, source: Calques): void {
  toile.width = source.largeur;
  toile.height = source.hauteur;
  const contexte = toile.getContext('2d');

  if (contexte === null) {
    return;
  }

  const valeur = Number.parseInt(couleur.replace('#', ''), 16);
  const [rouge, vert, bleu] = [(valeur >> 16) & 255, (valeur >> 8) & 255, valeur & 255];
  const pixels = new Uint8ClampedArray(source.details.length);

  for (let index = 0; index < pixels.length; index += 4) {
    const corps = (source.corps[index + 3] ?? 0) / 255;
    const opaciteDetails = (source.details[index + 3] ?? 0) / 255;
    const opacite = corps + opaciteDetails * (1 - corps);

    if (opacite === 0) {
      continue;
    }

    const melange = (teinte: number, detail: number): number =>
      (teinte * corps + detail * opaciteDetails * (1 - corps)) / opacite;

    pixels[index] = melange(rouge, source.details[index] ?? 0);
    pixels[index + 1] = melange(vert, source.details[index + 1] ?? 0);
    pixels[index + 2] = melange(bleu, source.details[index + 2] ?? 0);
    pixels[index + 3] = opacite * 255;
  }

  contexte.putImageData(new ImageData(pixels, source.largeur, source.hauteur), 0, 0);
}

/** Un ninja a cette couleur, dans un canevas pret a poser; peint des que le sprite est la. */
export function avatarDeNinja(
  doc: Document,
  couleur: string,
  classe = 'avatar-ninja',
): HTMLCanvasElement {
  const toile = doc.createElement('canvas');
  toile.className = classe;
  toile.setAttribute('aria-hidden', 'true');

  void chargerLesCalques(doc).then((source) => {
    if (source !== undefined) {
      peindre(toile, couleur, source);
    }
  });

  return toile;
}
