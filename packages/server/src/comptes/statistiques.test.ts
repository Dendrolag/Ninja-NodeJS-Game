/**
 * Tests de la deduction des statistiques d'un joueur (etape 3.5): totaux, ordre des
 * modes, mode prefere, meilleur score seul. Ce que la base compte est verifie contre
 * Neon, dans tests/base/fiche.test.ts.
 */

import type { Mode } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { StatistiquesEnregistreesDUnMode } from '../base/parties.js';
import { statistiquesDeJoueur } from './statistiques.js';

/** Une ligne d'un mode, a completer. */
function ligne(
  mode: Mode,
  valeurs: Partial<StatistiquesEnregistreesDUnMode> = {},
): StatistiquesEnregistreesDUnMode {
  return {
    mode,
    partiesJouees: 1,
    partiesAPlusieurs: 1,
    victoires: 0,
    meilleurScore: 10,
    meilleurScoreSeul: undefined,
    derniereLe: new Date('2026-09-01T12:00:00.000Z'),
    ...valeurs,
  };
}

describe('statistiquesDeJoueur', () => {
  it('rend des statistiques vides a qui n a jamais joue, sans mode prefere', () => {
    expect(statistiquesDeJoueur([])).toEqual({
      partiesJouees: 0,
      partiesAPlusieurs: 0,
      victoires: 0,
      parMode: [],
    });
  });

  it('additionne les modes, et les range dans l ordre des modes du jeu', () => {
    const statistiques = statistiquesDeJoueur([
      ligne('massacre', { partiesJouees: 2, partiesAPlusieurs: 0, meilleurScore: 900 }),
      ligne('classique', { partiesJouees: 5, partiesAPlusieurs: 4, victoires: 2 }),
      ligne('chasse', { partiesJouees: 3, partiesAPlusieurs: 3, victoires: 1 }),
    ]);

    expect(statistiques).toMatchObject({ partiesJouees: 10, partiesAPlusieurs: 7, victoires: 3 });
    expect(statistiques.parMode.map((mode) => mode.mode)).toEqual([
      'classique',
      'chasse',
      'massacre',
    ]);
  });

  it('choisit le mode le plus joue', () => {
    expect(
      statistiquesDeJoueur([
        ligne('classique', { partiesJouees: 3 }),
        ligne('tactique', { partiesJouees: 7 }),
        ligne('equipes', { partiesJouees: 2 }),
      ]).modePrefere,
    ).toBe('tactique');
  });

  it('departage deux modes aussi joues par la partie la plus recente', () => {
    const lignes = [
      ligne('classique', { partiesJouees: 4, derniereLe: new Date('2026-09-02T10:00:00.000Z') }),
      ligne('chasse', { partiesJouees: 4, derniereLe: new Date('2026-09-03T10:00:00.000Z') }),
      ligne('tactique', { partiesJouees: 1, derniereLe: new Date('2026-09-20T10:00:00.000Z') }),
    ];

    expect(statistiquesDeJoueur(lignes).modePrefere).toBe('chasse');
    // L'ordre des lignes recues n'y change rien.
    expect(statistiquesDeJoueur([...lignes].reverse()).modePrefere).toBe('chasse');
  });

  it('rend chaque mode sans sa date, et ne dit le meilleur score seul que s il existe', () => {
    const { parMode } = statistiquesDeJoueur([
      ligne('massacre', {
        partiesJouees: 3,
        partiesAPlusieurs: 1,
        victoires: 1,
        meilleurScore: 900,
        meilleurScoreSeul: 700,
      }),
      ligne('classique', { meilleurScore: 40 }),
    ]);

    expect(parMode).toEqual([
      {
        mode: 'classique',
        partiesJouees: 1,
        partiesAPlusieurs: 1,
        victoires: 0,
        meilleurScore: 40,
      },
      {
        mode: 'massacre',
        partiesJouees: 3,
        partiesAPlusieurs: 1,
        victoires: 1,
        meilleurScore: 900,
        meilleurScoreSeul: 700,
      },
    ]);
    expect(Object.keys(parMode[0] ?? {})).not.toContain('meilleurScoreSeul');
  });
});
