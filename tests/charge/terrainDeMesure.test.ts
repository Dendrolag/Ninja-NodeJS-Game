/**
 * Les terrains de la carte de mesure (etape 5.10): Tokyo repete, coupe au bord, et le
 * terrain sans mur.
 *
 * Le terrain realiste entier fait cent millions de pixels: sa fabrication est verifiee sur
 * une coupe plus petite, qui traverse plusieurs Tokyo et en coupe un au milieu, par la
 * meme fonction.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { ChargeurDeTerrain } from '../../packages/server/dist/index.js';
import { CARTE_DE_MESURE } from '../../packages/shared/dist/index.js';
import type { CarteCollisions } from '../../packages/sim/dist/index.js';
import { creerCarteCollisions, estMur } from '../../packages/sim/dist/index.js';

import { terrainDeMesure, terrainRepete } from './terrainDeMesure.ts';

let tokyo: CarteCollisions;

beforeAll(() => {
  tokyo = new ChargeurDeTerrain().charger({ carte: 'map1', modeMiroir: false });
});

describe('terrainRepete', () => {
  it('repete la source a l identique et la coupe au bord', () => {
    // Une source de 4 sur 3 dont chaque pixel se distingue: un mur sur la diagonale.
    const source = creerCarteCollisions({ largeur: 4, hauteur: 3 }, (x, y) => x === y);
    const repete = terrainRepete(source, { largeur: 10, hauteur: 7 });

    expect(repete.largeur).toBe(10);
    expect(repete.hauteur).toBe(7);

    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        expect(estMur(repete, x, y), `pixel ${String(x)}, ${String(y)}`).toBe(
          estMur(source, x % 4, y % 3),
        );
      }
    }

    // Le dernier Tokyo est coupe: la colonne 9 est la colonne 1 de la source.
    expect(estMur(repete, 9, 4)).toBe(true);
  });

  it('repete Tokyo pixel pour pixel, d un Tokyo au suivant', () => {
    // 4 500 sur 3 200: trois Tokyo en largeur, le dernier coupe au quart; trois en hauteur,
    // le dernier coupe au septieme.
    const repete = terrainRepete(tokyo, { largeur: 4500, hauteur: 3200 });
    let murs = 0;

    for (let y = 0; y < 3200; y += 7) {
      for (let x = 0; x < 4500; x += 3) {
        const attendu = estMur(tokyo, x % 2000, y % 1500);
        if (estMur(repete, x, y) !== attendu) {
          throw new Error(`Le pixel ${String(x)}, ${String(y)} n'est pas celui de Tokyo.`);
        }
        murs += attendu ? 1 : 0;
      }
    }

    // Tokyo a des murs: la comparaison n'a pas porte sur une carte vide.
    expect(murs).toBeGreaterThan(0);
    expect(repete.morceauPrincipal).toBeDefined();
  });
});

describe('terrainDeMesure', () => {
  it('fait un terrain sans mur aux dimensions de la carte de mesure', () => {
    const vide = terrainDeMesure('vide', tokyo);

    expect(vide.largeur).toBe(CARTE_DE_MESURE.largeur);
    expect(vide.hauteur).toBe(CARTE_DE_MESURE.hauteur);
    expect(vide.murs.every((octet) => octet === 0)).toBe(true);
    expect(estMur(vide, 9999, 9999)).toBe(false);
    expect(estMur(vide, 10_000, 0)).toBe(true);
  });

  it('mesure 10 000 sur 10 000, cinq Tokyo en largeur et six et deux tiers en hauteur', () => {
    expect(CARTE_DE_MESURE).toEqual({ largeur: 10_000, hauteur: 10_000 });
    expect(CARTE_DE_MESURE.largeur / tokyo.largeur).toBe(5);
    expect(Math.ceil(CARTE_DE_MESURE.hauteur / tokyo.hauteur)).toBe(7);
  });
});
