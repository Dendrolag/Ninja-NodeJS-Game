/**
 * Le lointain de Spirit & Time, et le calcul qui le fait glisser (etape 8.8).
 *
 * Deux choses a garantir. Le calcul: le lointain suit la camera en partie, sans jamais
 * s'ecarter de sa place de plus que l'amplitude. Les images: dans cette amplitude, le
 * trou noir du centre du lointain reste cache par le toit-terrasse. La seconde se
 * verifie sur les fichiers livres, pour qu'une image relivree qui rapprocherait le trou
 * du bord echoue ici, et non sous les yeux d'un joueur.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { cheminCarte, cheminLointain } from '@neon-ninja/shared';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { LOINTAIN } from './apparence.js';
import { borner } from './camera.js';
import { decalageDuLointain, positionDuLointain } from './parallaxe.js';

const CARTE = { largeur: 2400, hauteur: 1760 };
const ORDINATEUR = { largeur: 1600, hauteur: 900 };

describe('decalageDuLointain', () => {
  it('est nul quand la camera regarde le centre de la carte', () => {
    expect(decalageDuLointain({ x: 1200, y: 880, echelle: 1 }, ORDINATEUR, CARTE)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('atteint l amplitude au bout de la course de la camera, dans son sens', () => {
    // Vue de 1600 sur 900: la camera va de 800 a 1600 en largeur, de 450 a 1310 en hauteur.
    const enHautAGauche = decalageDuLointain({ x: 800, y: 450, echelle: 1 }, ORDINATEUR, CARTE);
    const enBasADroite = decalageDuLointain({ x: 1600, y: 1310, echelle: 1 }, ORDINATEUR, CARTE);

    expect(enHautAGauche.x).toBeCloseTo(-LOINTAIN.amplitudePx);
    expect(enHautAGauche.y).toBeCloseTo(-LOINTAIN.amplitudePx);
    expect(enBasADroite.x).toBeCloseTo(LOINTAIN.amplitudePx);
    expect(enBasADroite.y).toBeCloseTo(LOINTAIN.amplitudePx);
  });

  it('suit la camera en proportion, et donc glisse moins vite que le terrain', () => {
    // Course de 400 en largeur: le lointain suit 120 sur 400 du mouvement de la camera.
    const decalage = decalageDuLointain({ x: 1400, y: 880, echelle: 1 }, ORDINATEUR, CARTE);

    expect(decalage.x).toBeCloseTo((200 * LOINTAIN.amplitudePx) / 400);
    expect(decalage.y).toBe(0);
  });

  it('tient compte du grossissement: sur telephone, la course est plus longue et la part plus faible', () => {
    // Cadrage du telephone: 360 sur 271 pixels de carte, ici a l'echelle 2.
    const telephone = { largeur: 720, hauteur: 542 };
    const auBout = decalageDuLointain({ x: 180, y: 880, echelle: 2 }, telephone, CARTE);
    const aMiChemin = decalageDuLointain({ x: 690, y: 880, echelle: 2 }, telephone, CARTE);

    expect(auBout.x).toBeCloseTo(-LOINTAIN.amplitudePx);
    expect(aMiChemin.x).toBeCloseTo(-LOINTAIN.amplitudePx / 2);
  });

  it('ne suit jamais plus de la part maximale, sur une vue a peine plus petite que la carte', () => {
    // Course de 50 seulement: la part serait de 3, elle s'arrete a la moitie.
    const presqueTout = { largeur: 2300, hauteur: 1760 };
    const decalage = decalageDuLointain({ x: 1150, y: 880, echelle: 1 }, presqueTout, CARTE);

    expect(decalage.x).toBeCloseTo(-50 * LOINTAIN.partMaximale);
  });

  it('reste immobile sur un axe ou la vue depasse la carte', () => {
    const tresLarge = { largeur: 3000, hauteur: 900 };

    expect(decalageDuLointain({ x: 1200, y: 450, echelle: 1 }, tresLarge, CARTE).x).toBe(0);
  });

  it('ne depasse pas l amplitude quand la camera descend sous le HUD', () => {
    // borner laisse la camera monter au-dessus de sa course de la hauteur du HUD.
    const decalage = decalageDuLointain({ x: 1200, y: 380, echelle: 1 }, ORDINATEUR, CARTE);

    expect(decalage.y).toBe(-LOINTAIN.amplitudePx);
  });

  it('ne s ecarte jamais de plus que l amplitude ni que la course, ou que soit la camera', () => {
    const ecrans = [ORDINATEUR, { largeur: 889, hauteur: 500 }, { largeur: 360, hauteur: 271 }];

    for (const ecran of ecrans) {
      for (let x = -500; x <= 2900; x += 125) {
        for (let y = -500; y <= 2300; y += 125) {
          const camera = { x, y, echelle: 1 };
          const centre = borner({ x, y }, { ...ecran, margeHaute: 60 }, camera, CARTE);
          const decalage = decalageDuLointain({ ...centre, echelle: 1 }, ecran, CARTE);
          const courseX = (CARTE.largeur - ecran.largeur) / 2;

          expect(Math.abs(decalage.x)).toBeLessThanOrEqual(LOINTAIN.amplitudePx);
          expect(Math.abs(decalage.y)).toBeLessThanOrEqual(LOINTAIN.amplitudePx);
          expect(Math.abs(decalage.x)).toBeLessThanOrEqual(courseX);
        }
      }
    }
  });
});

describe('positionDuLointain', () => {
  it('pose le lointain a sa place, plus son decalage', () => {
    expect(positionDuLointain({ x: -40, y: 25 }, 2400, false)).toEqual({ x: -40, y: 25 });
  });

  it('en miroir, part du bord droit ou s accroche l image retournee, dans le meme sens', () => {
    expect(positionDuLointain({ x: -40, y: 25 }, 2400, true)).toEqual({ x: 2360, y: 25 });
  });
});

/** Le dossier assets du depot, retrouve depuis ce fichier de test. */
const RESSOURCES = fileURLToPath(new URL('../../../../assets/', import.meta.url));

/** Les pixels d'une image du depot, en rouge, vert, bleu, opacite. */
function lire(relatif: string): PNG {
  return PNG.sync.read(readFileSync(`${RESSOURCES}${relatif}`));
}

/**
 * Etend une marque de tant de pixels sur un axe: un pixel est marque si un pixel marque
 * est a moins de cette distance sur la meme ligne (ou la meme colonne).
 */
function etendre(
  marques: Uint8Array,
  largeur: number,
  hauteur: number,
  distance: number,
  horizontal: boolean,
): Uint8Array {
  const etendues = new Uint8Array(marques.length);
  const longueur = horizontal ? largeur : hauteur;
  const lignes = horizontal ? hauteur : largeur;
  const cumul = new Int32Array(longueur + 1);

  for (let ligne = 0; ligne < lignes; ligne += 1) {
    const indice = (rang: number): number =>
      horizontal ? ligne * largeur + rang : rang * largeur + ligne;

    for (let rang = 0; rang < longueur; rang += 1) {
      cumul[rang + 1] = (cumul[rang] ?? 0) + (marques[indice(rang)] ?? 0);
    }
    for (let rang = 0; rang < longueur; rang += 1) {
      const debut = Math.max(0, rang - distance);
      const fin = Math.min(longueur, rang + distance + 1);

      etendues[indice(rang)] = (cumul[fin] ?? 0) - (cumul[debut] ?? 0) > 0 ? 1 : 0;
    }
  }

  return etendues;
}

/** La part du lointain qu'un pixel du terrain peut laisser paraitre sans que cela se voie. */
const PART_INVISIBLE = 0.02;

describe('les images livrees de Spirit & Time', () => {
  const lointain = lire(cheminLointain('map3') as string);
  const fond = lire(cheminCarte('map3', 'background'));
  const dessus = lire(cheminCarte('map3', 'foreground'));
  const { width: largeur, height: hauteur } = lointain;

  /** Le trou: les pixels noirs du lointain, que le terrain doit cacher. */
  const trou = new Uint8Array(largeur * hauteur);
  /**
   * Ou l'on voit le lointain: la ou le fond et l'avant-plan, poses l'un sur l'autre, en
   * laissent paraitre plus de 2 pour cent. En dessous, un pixel noir change la couleur du
   * terrain de cinq niveaux sur 255 au plus, ce qui ne se voit pas: quelques pixels du toit,
   * presque opaques, laissent ainsi passer le lointain jusqu'au-dessus du trou.
   */
  const ajoure = new Uint8Array(largeur * hauteur);

  for (let pixel = 0; pixel < largeur * hauteur; pixel += 1) {
    const octet = pixel * 4;
    const rouge = lointain.data[octet] ?? 0;
    const vert = lointain.data[octet + 1] ?? 0;
    const bleu = lointain.data[octet + 2] ?? 0;

    trou[pixel] = Math.max(rouge, vert, bleu) <= 8 ? 1 : 0;
    const paraitre =
      ((255 - (fond.data[octet + 3] ?? 0)) * (255 - (dessus.data[octet + 3] ?? 0))) / 255 ** 2;

    ajoure[pixel] = paraitre > PART_INVISIBLE ? 1 : 0;
  }

  /** Combien de pixels du trou paraissent, pour un ecart du lointain jusqu'a cette distance. */
  const pixelsDuTrouVisibles = (distance: number): number => {
    // Un ecart sur chaque axe jusqu'a la distance: le trou s'etend d'autant dans les deux sens.
    const etendu = etendre(
      etendre(trou, largeur, hauteur, distance, true),
      largeur,
      hauteur,
      distance,
      false,
    );
    let visibles = 0;

    for (let pixel = 0; pixel < etendu.length; pixel += 1) {
      visibles += (etendu[pixel] ?? 0) & (ajoure[pixel] ?? 0);
    }

    return visibles;
  };

  it('ont toutes la taille de la carte', () => {
    for (const image of [lointain, fond, dessus]) {
      expect({ largeur: image.width, hauteur: image.height }).toEqual(CARTE);
    }
  });

  it('ont un trou au centre du lointain, et lui seul est noir', () => {
    // Le rectangle de 412 a 2063 en largeur, de 326 a 1508 en hauteur, a quelques pixels
    // pres sur son bord, que la reduction de l'image a adoucis.
    expect(trou.reduce((somme, valeur) => somme + valeur, 0)).toBe(1_953_776);
  });

  it('cachent le trou pour tout ecart du lointain dans l amplitude', () => {
    // En miroir, les trois images se retournent ensemble: ce qui vaut a l'endroit vaut a
    // l'envers.
    expect(pixelsDuTrouVisibles(LOINTAIN.amplitudePx)).toBe(0);
  });

  it('le montreraient a 139 pixels d ecart: l amplitude est bien une mesure', () => {
    expect(pixelsDuTrouVisibles(138)).toBe(0);
    expect(pixelsDuTrouVisibles(139)).toBeGreaterThan(0);
  });
});
