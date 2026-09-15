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
 * Le test decisif ci-dessous refait ce calcul sur les vraies images du jeu et
 * exige que les deux calques, une fois la teinte posee sur le corps, donnent
 * exactement la meme image, pour chaque couleur de la palette.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { COULEURS_JOUEURS, COULEUR_BOT_NEUTRE, COULEUR_BOT_NOIR } from '@neon-ninja/shared';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { REPEINTE_DU_NINJA } from './apparence.js';
import type { CalquesDuNinja } from './recoloration.js';
import { separerLesCalques } from './recoloration.js';

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
 * La recoloration du jeu d'origine, recopiee telle quelle comme reference.
 *
 * Tout pixel dont chaque composante est a moins de la tolerance du rouge pur
 * prend la couleur voulue; les autres ne bougent pas. L'opacite n'est jamais
 * touchee.
 */
function recolorationDOrigine(pixels: Uint8Array, couleur: string): Uint8Array {
  const [r, v, b] = composantes(couleur);
  const resultat = Uint8Array.from(pixels);
  const { cible, tolerance } = REPEINTE_DU_NINJA;

  for (let index = 0; index < resultat.length; index += 4) {
    const proche =
      Math.abs((resultat[index] ?? 0) - cible.r) <= tolerance &&
      Math.abs((resultat[index + 1] ?? 0) - cible.v) <= tolerance &&
      Math.abs((resultat[index + 2] ?? 0) - cible.b) <= tolerance;

    if (proche) {
      resultat[index] = r;
      resultat[index + 1] = v;
      resultat[index + 2] = b;
    }
  }

  return resultat;
}

/**
 * Ce que le GPU affiche: les details tels quels, et le corps multiplie par la
 * teinte. Les deux calques ne se recouvrent jamais, un pixel appartient a l'un
 * ou a l'autre.
 */
function composer(calques: CalquesDuNinja, couleur: string): Uint8Array {
  const [r, v, b] = composantes(couleur);
  const resultat = new Uint8Array(calques.details.length);

  for (let index = 0; index < resultat.length; index += 4) {
    const alphaCorps = calques.corps[index + 3] ?? 0;

    if (alphaCorps > 0) {
      resultat[index] = Math.round(((calques.corps[index] ?? 0) * r) / 255);
      resultat[index + 1] = Math.round(((calques.corps[index + 1] ?? 0) * v) / 255);
      resultat[index + 2] = Math.round(((calques.corps[index + 2] ?? 0) * b) / 255);
      resultat[index + 3] = alphaCorps;
    } else {
      resultat.set(calques.details.subarray(index, index + 4), index);
    }
  }

  return resultat;
}

/**
 * Une image telle qu'elle se voit: un pixel entierement transparent ne montre
 * rien, quelle que soit la couleur qu'il porte. Le jeu d'origine repeignait aussi
 * ceux-la, sans effet a l'ecran; les comparer octet par octet ne dirait rien.
 */
function visible(pixels: Uint8Array): Uint8Array {
  const resultat = Uint8Array.from(pixels);

  for (let index = 0; index < resultat.length; index += 4) {
    if (resultat[index + 3] === 0) {
      resultat.fill(0, index, index + 4);
    }
  }

  return resultat;
}

describe('separerLesCalques', () => {
  it('met un pixel rouge dans le corps, en blanc, et le retire des details', () => {
    const calques = separerLesCalques(Uint8Array.of(255, 0, 0, 255));

    expect([...calques.corps]).toEqual([255, 255, 255, 255]);
    expect([...calques.details]).toEqual([0, 0, 0, 0]);
  });

  it('laisse un pixel blanc dans les details, et le retire du corps', () => {
    const calques = separerLesCalques(Uint8Array.of(255, 255, 255, 255));

    expect([...calques.corps]).toEqual([0, 0, 0, 0]);
    expect([...calques.details]).toEqual([255, 255, 255, 255]);
  });

  it('repeint un rouge sombre dans la tolerance, pas un rouge qui en sort', () => {
    const dansLaTolerance = separerLesCalques(Uint8Array.of(115, 140, 140, 255));
    const horsTolerance = separerLesCalques(Uint8Array.of(114, 0, 0, 255));

    expect(dansLaTolerance.corps[3]).toBe(255);
    expect(horsTolerance.corps[3]).toBe(0);
    expect([...horsTolerance.details]).toEqual([114, 0, 0, 255]);
  });

  it('garde l opacite du pixel repeint', () => {
    const calques = separerLesCalques(Uint8Array.of(255, 0, 0, 128));

    expect([...calques.corps]).toEqual([255, 255, 255, 128]);
  });

  it('ne met jamais un pixel dans les deux calques', () => {
    const calques = separerLesCalques(pixelsDe('idle.png'));

    for (let index = 3; index < calques.corps.length; index += 4) {
      expect((calques.corps[index] ?? 0) > 0 && (calques.details[index] ?? 0) > 0).toBe(false);
    }
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

  it.each(fichiers)('%s: corps teinte et details redonnent l image du jeu d origine', (fichier) => {
    const pixels = pixelsDe(fichier);
    const calques = separerLesCalques(pixels);

    for (const couleur of couleurs) {
      expect(visible(composer(calques, couleur)), couleur).toEqual(
        visible(recolorationDOrigine(pixels, couleur)),
      );
    }
  });
});
