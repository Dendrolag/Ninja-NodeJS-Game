/**
 * Tests du souvenir des zones deja expliquees (9 octobre 2026).
 */

import { describe, expect, it } from 'vitest';

import { stockageEnMemoire, stockageRefuse } from './essais.js';
import { CLE_ZONES_EXPLIQUEES, creerSouvenirDesZones } from './souvenirDesZones.js';

describe('le souvenir des zones', () => {
  it('part de zero, compte, et se relit d une visite a l autre', () => {
    const stockage = stockageEnMemoire();
    const premiere = creerSouvenirDesZones(stockage);

    expect(premiere.explications('chaos')).toBe(0);
    premiere.retenirUneExplication('chaos');
    premiere.retenirUneExplication('chaos');
    premiere.retenirUneExplication('repulsion');

    const seconde = creerSouvenirDesZones(stockage);

    expect(seconde.explications('chaos')).toBe(2);
    expect(seconde.explications('repulsion')).toBe(1);
    expect(seconde.explications('invisibilite')).toBe(0);
  });

  it('ignore une valeur abimee', () => {
    const stockage = stockageEnMemoire();
    stockage.setItem(CLE_ZONES_EXPLIQUEES, '{"chaos":"beaucoup","attraction":-2,"repulsion":2}');

    const souvenir = creerSouvenirDesZones(stockage);

    expect(souvenir.explications('chaos')).toBe(0);
    expect(souvenir.explications('attraction')).toBe(0);
    expect(souvenir.explications('repulsion')).toBe(2);

    stockage.setItem(CLE_ZONES_EXPLIQUEES, 'pas du json');
    expect(creerSouvenirDesZones(stockage).explications('repulsion')).toBe(0);
  });

  it('vit en memoire sans stockage, ou quand le stockage refuse d ecrire', () => {
    const sansStockage = creerSouvenirDesZones();
    sansStockage.retenirUneExplication('invisibilite');
    expect(sansStockage.explications('invisibilite')).toBe(1);

    const refuse = stockageEnMemoire();
    refuse.setItem = () => {
      throw new Error('plein');
    };
    const souvenir = creerSouvenirDesZones(refuse);
    souvenir.retenirUneExplication('chaos');
    expect(souvenir.explications('chaos')).toBe(1);

    // Un navigateur qui refuse les donnees de site leve des la lecture.
    const prive = creerSouvenirDesZones(stockageRefuse());
    prive.retenirUneExplication('attraction');
    expect(prive.explications('attraction')).toBe(1);
  });
});
