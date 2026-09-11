/**
 * Tests de la mise en forme de la progression.
 *
 * Ce qu'ils protegent: chaque palier a un nom, les nombres se lisent a la
 * francaise, et la barre de niveau suit les seuils du paquet partage.
 */

import { PALIERS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import {
  NOMS_DES_PALIERS,
  barreDeNiveau,
  formaterNombre,
  formaterVariation,
} from './progression.js';

describe('la mise en forme de la progression', () => {
  it('nomme chaque palier du paquet partage', () => {
    expect(PALIERS.map((palier) => NOMS_DES_PALIERS[palier.id])).toEqual([
      'Bronze',
      'Argent',
      'Or',
      'Platine',
      'Diamant',
    ]);
  });

  it('ecrit les milliers separes par une espace', () => {
    expect(formaterNombre(1280)).toMatch(/^1\s280$/u);
    expect(formaterNombre(42)).toBe('42');
  });

  it('signe les variations, avec le vrai signe moins', () => {
    expect(formaterVariation(20)).toBe('+20');
    expect(formaterVariation(-10)).toBe('−10');
    expect(formaterVariation(0)).toBe('0');
  });

  it('dessine la barre de niveau selon les seuils du paquet partage', () => {
    expect(barreDeNiveau(0)).toEqual({ niveau: 1, pourCent: 0, xp: '0 / 100 XP' });
    expect(barreDeNiveau(99)).toEqual({ niveau: 1, pourCent: 99, xp: '99 / 100 XP' });
    expect(barreDeNiveau(150)).toEqual({ niveau: 2, pourCent: 25, xp: '50 / 200 XP' });
  });
});
