/**
 * Les statistiques du harnais de charge: un centile faux ferait passer un serveur
 * satura pour un serveur qui tient.
 */

import { describe, expect, it } from 'vitest';

import { RESUME_VIDE, arrondi, centile, resumer, resumeArrondi } from './statistiques.ts';

describe('centile', () => {
  const cent = Array.from({ length: 100 }, (_, rang) => rang + 1);

  it('rend la valeur de rang le plus proche, jamais une valeur inventee', () => {
    expect(centile(cent, 50)).toBe(50);
    expect(centile(cent, 95)).toBe(95);
    expect(centile(cent, 99)).toBe(99);
    expect(centile(cent, 100)).toBe(100);
    expect(centile([10, 20, 30], 50)).toBe(20);
  });

  it('rend la plus petite valeur pour le centile zero', () => {
    expect(centile(cent, 0)).toBe(1);
  });

  it('refuse une serie vide et un centile hors de 0 a 100', () => {
    expect(() => centile([], 50)).toThrow();
    expect(() => centile(cent, -1)).toThrow();
    expect(() => centile(cent, 101)).toThrow();
    expect(() => centile(cent, Number.NaN)).toThrow();
  });
});

describe('resumer', () => {
  it('resume une serie dans le desordre', () => {
    const resume = resumer([4, 1, 3, 2]);

    expect(resume).toEqual({
      nombre: 4,
      moyenne: 2.5,
      p50: 2,
      p95: 4,
      p99: 4,
      minimum: 1,
      maximum: 4,
    });
  });

  it('voit le battement lent que la moyenne cache', () => {
    const battements = [...Array.from({ length: 99 }, () => 1), 100];
    const resume = resumer(battements);

    expect(resume.moyenne).toBeCloseTo(1.99);
    expect(resume.p99).toBe(1);
    expect(resume.maximum).toBe(100);
  });

  it('rend un resume vide pour une serie vide', () => {
    expect(resumer([])).toEqual(RESUME_VIDE);
  });

  it('ne modifie pas la serie recue', () => {
    const serie = [3, 1, 2];
    resumer(serie);

    expect(serie).toEqual([3, 1, 2]);
  });
});

describe('arrondi', () => {
  it('arrondit a deux decimales par defaut', () => {
    expect(arrondi(1.23456)).toBe(1.23);
    expect(arrondi(1.23456, 3)).toBe(1.235);
  });

  it('arrondit chaque valeur d un resume, sauf le nombre', () => {
    expect(resumeArrondi(resumer([1.111, 2.222]), 1)).toEqual({
      nombre: 2,
      moyenne: 1.7,
      p50: 1.1,
      p95: 2.2,
      p99: 2.2,
      minimum: 1.1,
      maximum: 2.2,
    });
  });
});
