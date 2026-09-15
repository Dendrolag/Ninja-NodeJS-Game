/**
 * Tests du repere de localisation.
 *
 * Le jeu d'origine tenait ce repere par un booleen et une minuterie. Ici tout se
 * deduit de l'instant: on verifie donc l'opacite a des instants choisis, et la
 * geometrie des fleches, sans rien faire attendre.
 */

import { describe, expect, it } from 'vitest';

import { DUREES_LOCALISATION, REPERE_LOCALISATION } from './apparence.js';
import { flechesDeLocalisation, localiser, opaciteDeLocalisation } from './localisation.js';

describe('opaciteDeLocalisation', () => {
  it('est nulle sans reperage', () => {
    expect(opaciteDeLocalisation(undefined, 1_000)).toBe(0);
  });

  it('est pleine au debut, puis s efface sur la derniere demi-seconde', () => {
    const reperage = localiser(1_000, DUREES_LOCALISATION.demandeeMs);
    const fin = 1_000 + DUREES_LOCALISATION.demandeeMs;

    expect(opaciteDeLocalisation(reperage, 1_000)).toBe(1);
    expect(opaciteDeLocalisation(reperage, fin - DUREES_LOCALISATION.fonduMs)).toBe(1);
    expect(opaciteDeLocalisation(reperage, fin - DUREES_LOCALISATION.fonduMs / 2)).toBeCloseTo(0.5);
    expect(opaciteDeLocalisation(reperage, fin)).toBe(0);
    expect(opaciteDeLocalisation(reperage, fin + 1_000)).toBe(0);
  });
});

describe('flechesDeLocalisation', () => {
  it('ne dessine rien quand les fleches sont effacees', () => {
    expect(flechesDeLocalisation({ x: 500, y: 500 }, 0, 0)).toEqual([]);
  });

  it('pose quatre fleches, chacune pointee vers le personnage', () => {
    const centre = { x: 500, y: 400 };
    const fleches = flechesDeLocalisation(centre, 1, 0);

    expect(fleches).toHaveLength(4);

    for (const fleche of fleches) {
      const [pointeX, pointeY, baseAX, baseAY, baseBX, baseBY] = fleche.points as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const distance = (x: number, y: number): number => Math.hypot(x - centre.x, y - centre.y);

      // La pointe est plus pres du personnage que les deux coins de la base.
      expect(distance(pointeX, pointeY)).toBeLessThan(distance(baseAX, baseAY));
      expect(distance(pointeX, pointeY)).toBeLessThan(distance(baseBX, baseBY));
      // Et elle en reste a distance: la fleche ne recouvre pas le personnage.
      expect(distance(pointeX, pointeY)).toBeCloseTo(
        REPERE_LOCALISATION.distance - REPERE_LOCALISATION.longueur,
      );
    }
  });

  it('porte l opacite demandee sur le remplissage et le contour', () => {
    const [fleche] = flechesDeLocalisation({ x: 0, y: 0 }, 0.25, 0);

    expect(fleche?.remplissage.alpha).toBe(0.25);
    expect(fleche?.contour.alpha).toBe(0.25);
  });
});
