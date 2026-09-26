/**
 * Tests de la mise en forme des statistiques, commune au profil et a la fiche
 * (etape 3.5).
 */

import { describe, expect, it } from 'vitest';

import { formaterNombre } from './progression.js';
import { SANS_VALEUR, lignesParMode, tuilesDesStatistiques } from './statistiques.js';

describe('tuilesDesStatistiques', () => {
  it('lit les victoires sur les parties a plusieurs, au singulier comme au pluriel', () => {
    const tuiles = (partiesAPlusieurs: number): string | undefined =>
      tuilesDesStatistiques({
        partiesJouees: 3,
        partiesAPlusieurs,
        victoires: 1,
        modePrefere: 'classique',
        parMode: [],
      })[1]?.detail;

    expect(tuiles(0)).toBe('sur 0 partie à plusieurs');
    expect(tuiles(1)).toBe('sur 1 partie à plusieurs');
    expect(tuiles(2)).toBe('sur 2 parties à plusieurs');
    expect(tuiles(1500)).toBe(`sur ${formaterNombre(1500)} parties à plusieurs`);
  });

  it('nomme le mode prefere comme le jeu le nomme, et met un tiret sans partie', () => {
    const prefere = (modePrefere?: 'classique' | 'massacre'): string | undefined =>
      tuilesDesStatistiques({
        partiesJouees: modePrefere === undefined ? 0 : 1,
        partiesAPlusieurs: 0,
        victoires: 0,
        ...(modePrefere === undefined ? {} : { modePrefere }),
        parMode: [],
      })[2]?.valeur;

    expect(prefere('classique')).toBe('Horde');
    expect(prefere('massacre')).toBe('Massacre');
    expect(prefere()).toBe(SANS_VALEUR);
  });
});

describe('lignesParMode', () => {
  it('garde l ordre recu, et ecrit un tiret sans partie jouee seul', () => {
    expect(
      lignesParMode({
        partiesJouees: 5,
        partiesAPlusieurs: 3,
        victoires: 1,
        parMode: [
          {
            mode: 'chasse',
            partiesJouees: 3,
            partiesAPlusieurs: 3,
            victoires: 1,
            meilleurScore: 12_400,
          },
          {
            mode: 'massacre',
            partiesJouees: 2,
            partiesAPlusieurs: 0,
            victoires: 0,
            meilleurScore: 700,
            meilleurScoreSeul: 700,
          },
        ],
      }),
    ).toEqual([
      {
        mode: 'Chasse',
        parties: '3',
        victoires: '1 sur 3',
        meilleurScore: formaterNombre(12_400),
        meilleurScoreSeul: SANS_VALEUR,
      },
      {
        mode: 'Massacre',
        parties: '2',
        victoires: '0 sur 0',
        meilleurScore: '700',
        meilleurScoreSeul: '700',
      },
    ]);
  });
});
