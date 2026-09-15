/**
 * Tests des helpers de direction.
 *
 * Les valeurs attendues viennent de Entity.determineDirection
 * (legacy/server.js:844). Le repere est celui de l'ecran: y positif vers le bas,
 * donc un deplacement vers le bas est « sud », pas « nord ».
 */

import { describe, expect, it } from 'vitest';

import { aLaLongueur, determinerDirection, directionDuVecteur, norme } from './direction.js';

describe('determinerDirection', () => {
  it('rend les quatre directions cardinales', () => {
    expect(determinerDirection(1, 0)).toBe('est');
    expect(determinerDirection(-1, 0)).toBe('ouest');
    expect(determinerDirection(0, 1)).toBe('sud');
    expect(determinerDirection(0, -1)).toBe('nord');
  });

  it('rend les quatre diagonales', () => {
    expect(determinerDirection(1, 1)).toBe('sud_est');
    expect(determinerDirection(-1, 1)).toBe('sud_ouest');
    expect(determinerDirection(1, -1)).toBe('nord_est');
    expect(determinerDirection(-1, -1)).toBe('nord_ouest');
  });

  it('coupe les secteurs tous les 22,5 degres', () => {
    // Juste en dessous de la limite: encore l'est. Juste au-dessus: sud-est.
    expect(determinerDirection(Math.cos(0.39), Math.sin(0.39))).toBe('est');
    expect(determinerDirection(Math.cos(0.4), Math.sin(0.4))).toBe('sud_est');
  });

  it('rend immobile en dessous du dixieme de pixel', () => {
    expect(determinerDirection(0, 0)).toBe('immobile');
    expect(determinerDirection(0.09, -0.09)).toBe('immobile');
  });

  it('reste sensible juste au-dessus du seuil', () => {
    expect(determinerDirection(0.11, 0)).toBe('est');
  });

  it('ne depend que de l orientation, pas de la longueur', () => {
    expect(determinerDirection(1, 1)).toBe(determinerDirection(500, 500));
  });
});

describe('directionDuVecteur', () => {
  it('donne le meme resultat que determinerDirection', () => {
    expect(directionDuVecteur({ x: 0, y: -3 })).toBe('nord');
  });
});

describe('norme', () => {
  it('mesure la longueur d un vecteur', () => {
    expect(norme({ x: 3, y: 4 })).toBe(5);
    expect(norme({ x: 0, y: 0 })).toBe(0);
  });
});

describe('aLaLongueur', () => {
  it('ramene un vecteur a la longueur demandee sans changer sa direction', () => {
    const resultat = aLaLongueur({ x: 10, y: 0 }, 3);

    expect(resultat).toEqual({ x: 3, y: 0 });
  });

  it('conserve l orientation en diagonale', () => {
    const resultat = aLaLongueur({ x: 1, y: 1 }, 10);

    expect(norme(resultat)).toBeCloseTo(10, 10);
    expect(resultat.x).toBeCloseTo(resultat.y, 10);
  });

  it('laisse un vecteur nul a zero', () => {
    expect(aLaLongueur({ x: 0, y: 0 }, 42)).toEqual({ x: 0, y: 0 });
  });
});
