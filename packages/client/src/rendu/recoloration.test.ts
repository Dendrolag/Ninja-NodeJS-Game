/**
 * Tests de la recoloration des ninjas.
 *
 * LE DEFAUT QUE CES TESTS FERMENT, releve a la recette de l'etape 5.4. Le rendu
 * posait la couleur d'un ninja par TEINTE, c'est-a-dire en multipliant chaque
 * pixel du sprite par la couleur voulue, en croyant le sprite dessine en niveaux
 * de gris. Il est dessine en ROUGE. Blanc fois rouge donne rouge, vert fois rouge
 * donne noir: tous les faux ninjas et les joueurs rouges ou jaunes apparaissaient
 * rouges, les autres noirs aux yeux colores, et plus aucune capture ne se voyait.
 *
 * Le jeu d'origine, lui, remplacait les pixels proches du rouge par la couleur
 * voulue et laissait les autres intacts (getColoredSprite, legacy/client.js:617).
 *
 * LE DEFAUT QU'ILS FERMENT DEPUIS L'ETAPE 4.8. Ce partage tout ou rien coupait le
 * bord adouci du corps: un ninja vert avait un bord en escalier, borde de rouge, que
 * l'on voit de pres. Chaque pixel se partage desormais selon sa part de rouge. Les
 * tests decisifs ci-dessous repeignent les vraies images du jeu: dans leur propre
 * rouge, elles se retrouvent; dans les autres couleurs, chaque pixel garde sa part,
 * et aucun liseré rouge ne reste.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { COULEURS_JOUEURS, COULEUR_BOT_NEUTRE, COULEUR_BOT_NOIR } from '@neon-ninja/shared';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { YEUX_DU_BLACK_NINJA } from './apparence.js';
import type { CalquesDuNinja } from './recoloration.js';
import { partDeRouge, rayerLeCorps, rougirLesYeux, separerLesCalques } from './recoloration.js';

/** Le dossier des sprites de ninja, a la racine du depot. */
const DOSSIER_NINJA = fileURLToPath(new URL('../../../../assets/ninja/', import.meta.url));

/** Les pixels d'une image du dossier des ninjas, en RVBA. */
function pixelsDe(fichier: string): Uint8Array {
  return PNG.sync.read(readFileSync(`${DOSSIER_NINJA}${fichier}`)).data;
}

/** Une couleur ecrite en hexadecimal, en trois composantes. */
function composantes(couleur: string): readonly [number, number, number] {
  const valeur = Number.parseInt(couleur.slice(1), 16);

  return [valeur >> 16, (valeur >> 8) & 0xff, valeur & 0xff];
}

/**
 * La recoloration du jeu d'origine, recopiee telle quelle (TARGET_COLOR et
 * COLOR_TOLERANCE, legacy/client.js:493), pour montrer le defaut qu'elle avait.
 *
 * Tout pixel dont chaque composante est a moins de 140 du rouge pur prend la couleur
 * voulue en entier; les autres ne bougent pas. L'opacite n'est jamais touchee.
 */
function recolorationDOrigine(pixels: Uint8Array, couleur: string): Uint8Array {
  const [r, v, b] = composantes(couleur);
  const resultat = Uint8Array.from(pixels);

  for (let index = 0; index < resultat.length; index += 4) {
    const proche =
      Math.abs((resultat[index] ?? 0) - 255) <= 140 &&
      (resultat[index + 1] ?? 0) <= 140 &&
      (resultat[index + 2] ?? 0) <= 140;

    if (proche) {
      resultat.set([r, v, b], index);
    }
  }

  return resultat;
}

/**
 * La recoloration attendue: chaque pixel, melange d'une part t de rouge pur et d'un
 * fond, garde son fond et prend t fois la couleur voulue. Calculee en nombres reels,
 * sans passer par les calques. L'opacite n'est jamais touchee.
 */
function recolorationAttendue(pixels: Uint8Array, couleur: string): Float64Array {
  const cible = composantes(couleur);
  const resultat = new Float64Array(pixels.length);

  for (let index = 0; index < pixels.length; index += 4) {
    const [r, v, b] = [pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0];
    const part = partDeRouge(r, v, b);
    const fond =
      part === 1 ? [0, 0, 0] : [(r - part * 255) / (1 - part), v / (1 - part), b / (1 - part)];

    for (let composante = 0; composante < 3; composante += 1) {
      const valeurFond = Math.min(255, Math.max(0, fond[composante] ?? 0));
      resultat[index + composante] = part * (cible[composante] ?? 0) + (1 - part) * valeurFond;
    }
    resultat[index + 3] = pixels[index + 3] ?? 0;
  }

  return resultat;
}

/**
 * Ce que le GPU affiche: le corps multiplie par la teinte, pose par-dessus les details,
 * chacun a son opacite. Rendu en nombres reels, opacite comprise.
 */
function composer(calques: CalquesDuNinja, couleur: string): Float64Array {
  const teinte = composantes(couleur);
  const resultat = new Float64Array(calques.details.length);

  for (let index = 0; index < resultat.length; index += 4) {
    const alphaCorps = (calques.corps[index + 3] ?? 0) / 255;
    const alphaDetails = (calques.details[index + 3] ?? 0) / 255;
    const alpha = alphaCorps + alphaDetails * (1 - alphaCorps);

    for (let composante = 0; composante < 3; composante += 1) {
      const corps = ((calques.corps[index + composante] ?? 0) * (teinte[composante] ?? 0)) / 255;
      const details = calques.details[index + composante] ?? 0;

      resultat[index + composante] =
        alpha === 0 ? 0 : (corps * alphaCorps + details * alphaDetails * (1 - alphaCorps)) / alpha;
    }
    resultat[index + 3] = alpha * 255;
  }

  return resultat;
}

/**
 * Le plus grand ecart entre deux images, tel qu'il se voit: sur l'opacite, et sur chaque
 * composante ponderee par l'opacite. Un pixel presque transparent ne montre presque rien
 * de sa couleur, et l'arrondi de son opacite la decale sans que cela se voie.
 */
function plusGrandEcart(attendue: ArrayLike<number>, obtenue: ArrayLike<number>): number {
  let ecart = 0;

  for (let index = 0; index < attendue.length; index += 4) {
    const opaciteAttendue = attendue[index + 3] ?? 0;
    const opaciteObtenue = obtenue[index + 3] ?? 0;

    ecart = Math.max(ecart, Math.abs(opaciteAttendue - opaciteObtenue));

    for (let composante = 0; composante < 3; composante += 1) {
      const vue = (image: ArrayLike<number>, opacite: number): number =>
        ((image[index + composante] ?? 0) * opacite) / 255;

      ecart = Math.max(
        ecart,
        Math.abs(vue(attendue, opaciteAttendue) - vue(obtenue, opaciteObtenue)),
      );
    }
  }

  return ecart;
}

/**
 * Les pixels visibles restes rouges: le rouge y domine le vert et le bleu, a parts
 * egales de vert et de bleu. La peau, ou le vert domine le bleu, n'en est pas.
 */
function pixelsRestesRouges(image: ArrayLike<number>): number {
  let rouges = 0;

  for (let index = 0; index < image.length; index += 4) {
    const [r, v, b] = [image[index] ?? 0, image[index + 1] ?? 0, image[index + 2] ?? 0];

    if ((image[index + 3] ?? 0) > 0 && r > Math.max(v, b) + 40 && Math.abs(v - b) <= 18) {
      rouges += 1;
    }
  }

  return rouges;
}

/** Le contour presque noir des sprites. */
const CONTOUR = [31, 29, 25] as const;

/** Un melange d'une part de rouge pur et du reste de contour, arrondi comme dans une image. */
function melange(part: number): [number, number, number] {
  return [
    Math.round(part * 255 + (1 - part) * CONTOUR[0]),
    Math.round((1 - part) * CONTOUR[1]),
    Math.round((1 - part) * CONTOUR[2]),
  ];
}

describe('partDeRouge', () => {
  it('vaut un pour le rouge pur, et zero pour le contour, le blanc et un gris', () => {
    expect(partDeRouge(255, 0, 0)).toBe(1);
    expect(partDeRouge(...CONTOUR)).toBe(0);
    expect(partDeRouge(255, 255, 255)).toBe(0);
    expect(partDeRouge(57, 56, 52)).toBe(0);
  });

  it('retrouve la part de rouge d un melange avec le contour, et avec le blanc', () => {
    for (const part of [0.1, 0.25, 0.4, 0.6, 0.9]) {
      expect(partDeRouge(...melange(part))).toBeCloseTo(part, 1);
    }
    expect(partDeRouge(255, 128, 128)).toBeCloseTo(0.5, 2);
  });

  it('vaut zero pour la peau et ses ombres brunes, qui ne sont pas des melanges de rouge', () => {
    expect(partDeRouge(249, 202, 157)).toBe(0);
    expect(partDeRouge(143, 113, 87)).toBe(0);
  });
});

describe('separerLesCalques', () => {
  it('met un pixel rouge pur dans le corps, en blanc, et ne laisse rien aux details', () => {
    const calques = separerLesCalques(Uint8Array.of(255, 0, 0, 255));

    expect([...calques.corps]).toEqual([255, 255, 255, 255]);
    expect([...calques.details]).toEqual([0, 0, 0, 0]);
  });

  it('laisse un pixel blanc, le contour et la peau aux details, intacts', () => {
    for (const pixel of [
      [255, 255, 255, 255],
      [...CONTOUR, 255],
      [249, 202, 157, 255],
    ]) {
      const calques = separerLesCalques(Uint8Array.from(pixel));

      expect([...calques.corps]).toEqual([0, 0, 0, 0]);
      expect([...calques.details]).toEqual(pixel);
    }
  });

  it('partage un pixel de bord: sa part de rouge au corps, le contour aux details', () => {
    // 40 pour cent de rouge: le jeu d'origine le repeignait en entier.
    const calques = separerLesCalques(Uint8Array.of(...melange(0.4), 255));

    expect(calques.corps.slice(0, 3)).toEqual(Uint8ClampedArray.of(255, 255, 255));
    expect(calques.corps[3]).toBeCloseTo(0.4 * 255, -1);
    expect(calques.details[3]).toBe(255);
    for (let composante = 0; composante < 3; composante += 1) {
      expect(
        Math.abs((calques.details[composante] ?? 0) - (CONTOUR[composante] ?? 0)),
      ).toBeLessThanOrEqual(2);
    }
  });

  it('garde l opacite d un pixel a demi transparent, rouge pur ou de bord', () => {
    const rouge = separerLesCalques(Uint8Array.of(255, 0, 0, 128));

    expect([...rouge.corps]).toEqual([255, 255, 255, 128]);
    expect(rouge.details[3]).toBe(0);

    const bord = separerLesCalques(Uint8Array.of(...melange(0.4), 128));

    expect(composer(bord, '#FF0000')[3]).toBeCloseTo(128, 0);
  });

  it('ne met rien d un pixel transparent dans aucun calque', () => {
    const calques = separerLesCalques(Uint8Array.of(255, 0, 0, 0));

    expect([...calques.corps, ...calques.details]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('les vrais sprites du jeu', () => {
  const fichiers = readdirSync(DOSSIER_NINJA).filter((fichier) => fichier.endsWith('.png'));
  const couleurs = [...COULEURS_JOUEURS, COULEUR_BOT_NEUTRE, COULEUR_BOT_NOIR];

  it('sont les dix-sept images de ninja', () => {
    expect(fichiers).toHaveLength(17);
  });

  it('ne sont pas dessines en niveaux de gris: une teinte seule ne peut pas les colorer', () => {
    const pixels = pixelsDe('idle.png');
    let rouges = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      if ((pixels[index + 3] ?? 0) > 0 && (pixels[index] ?? 0) > (pixels[index + 1] ?? 0) + 100) {
        rouges += 1;
      }
    }

    expect(rouges).toBeGreaterThan(0);
  });

  it.each(fichiers)('%s: repeinte dans son propre rouge, redonne son image', (fichier) => {
    const pixels = pixelsDe(fichier);

    expect(plusGrandEcart(pixels, composer(separerLesCalques(pixels), '#FF0000'))).toBeLessThan(
      1.5,
    );
  });

  it.each(fichiers)(
    '%s: chaque pixel garde sa part de couleur, dans chaque couleur du jeu',
    (fichier) => {
      const pixels = pixelsDe(fichier);
      const calques = separerLesCalques(pixels);

      for (const couleur of couleurs) {
        expect(
          plusGrandEcart(recolorationAttendue(pixels, couleur), composer(calques, couleur)),
          couleur,
        ).toBeLessThan(2);
      }
    },
  );

  it.each(fichiers)('%s: repeinte en vert, ne garde aucun liseré rouge', (fichier) => {
    const pixels = pixelsDe(fichier);

    // Le defaut ferme: le jeu d'origine laissait du rouge au bord du corps.
    expect(pixelsRestesRouges(recolorationDOrigine(pixels, '#00FF00'))).toBeGreaterThan(0);
    expect(pixelsRestesRouges(composer(separerLesCalques(pixels), '#00FF00'))).toBe(0);
  });

  it.each(fichiers)('%s: le bord du corps reste adouci, en parts intermediaires', (fichier) => {
    const pixels = pixelsDe(fichier);
    const { corps } = separerLesCalques(pixels);
    let intermediaires = 0;

    for (let index = 0; index < corps.length; index += 4) {
      const opacite = corps[index + 3] ?? 0;

      if ((pixels[index + 3] ?? 0) === 255 && opacite > 0 && opacite < 255) {
        intermediaires += 1;
      }
    }

    expect(intermediaires).toBeGreaterThan(20);
  });
});

describe("les rayures de l'Evade (etape 7.9)", () => {
  it('raye le corps par bandes de deux lignes, sans toucher au reste ni a l opacite', () => {
    // Une image de deux pixels de large sur quatre de haut: le corps partout, sauf un trou.
    const corps = new Uint8ClampedArray(2 * 4 * 4);
    for (let pixel = 0; pixel < 8; pixel += 1) {
      corps.set([255, 255, 255, pixel === 5 ? 0 : 200], pixel * 4);
    }

    const raye = rayerLeCorps(corps, 2, 2, [0xe3262e, 0xf6f6f6]);
    const pixel = (rang: number): number[] => [...raye.slice(rang * 4, rang * 4 + 4)];

    // Les deux premieres lignes rouges, les deux suivantes blanches.
    expect(pixel(0)).toEqual([0xe3, 0x26, 0x2e, 200]);
    expect(pixel(3)).toEqual([0xe3, 0x26, 0x2e, 200]);
    expect(pixel(4)).toEqual([0xf6, 0xf6, 0xf6, 200]);
    expect(pixel(5)).toEqual([0, 0, 0, 0]);
    expect(pixel(7)).toEqual([0xf6, 0xf6, 0xf6, 200]);
  });
});

describe('les yeux rouges du Black Ninja (etape 5.8)', () => {
  const ROUGE = YEUX_DU_BLACK_NINJA.couleur;

  it('rougit un reflet clair et neutre, en gardant son opacite', () => {
    const rougis = rougirLesYeux(new Uint8ClampedArray([230, 230, 225, 200]), ROUGE);

    expect([...rougis]).toEqual([0xff, 0x32, 0x32, 200]);
  });

  it('laisse le cerne sombre, la peau coloree et le vide intacts', () => {
    const details = new Uint8ClampedArray([
      ...[20, 20, 20, 255],
      ...[240, 200, 150, 255],
      ...[255, 255, 255, 0],
    ]);

    expect([...rougirLesYeux(details, ROUGE)]).toEqual([...details]);
  });

  it('ne touche pas au calque recu', () => {
    const details = new Uint8ClampedArray([230, 230, 230, 255]);
    rougirLesYeux(details, ROUGE);

    expect([...details]).toEqual([230, 230, 230, 255]);
  });

  it('trouve des yeux a rougir sur l image de face, et en laisse la plupart des details', () => {
    const { details } = separerLesCalques(pixelsDe('idle.png'));
    const rougis = rougirLesYeux(details, ROUGE);
    let changes = 0;
    let visibles = 0;

    for (let index = 0; index < details.length; index += 4) {
      if ((details[index + 3] ?? 0) > 0) {
        visibles += 1;
      }
      if (rougis[index] !== details[index] || rougis[index + 1] !== details[index + 1]) {
        changes += 1;
      }
    }

    expect(changes).toBeGreaterThan(0);
    expect(changes).toBeLessThan(visibles / 4);
  });
});
