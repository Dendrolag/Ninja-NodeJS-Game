/**
 * Les seuils du harnais de charge: les criteres de tenue et le budget par coeur.
 */

import { CADENCE_BATTEMENT_MS } from '@neon-ninja/server';
import { describe, expect, it } from 'vitest';

import {
  CADENCE_MS,
  CRITERES_DE_TENUE,
  FREQUENCE_CIBLE_HZ,
  debitKoParSeconde,
  megabitsParSeconde,
  partiesParCoeur,
  verdictDeTenue,
} from './seuils.ts';

describe('la cadence du harnais', () => {
  it('est celle du serveur', () => {
    expect(CADENCE_MS).toBe(CADENCE_BATTEMENT_MS);
    expect(FREQUENCE_CIBLE_HZ).toBe(20);
  });
});

describe('verdictDeTenue', () => {
  const tenue = { frequenceMinimumHz: 20, intervalleP99Ms: 55, deconnexions: 0 };

  it('dit qu un serveur a la frequence cible, sans a-coup ni perte, a tenu', () => {
    expect(verdictDeTenue(tenue)).toEqual({ tenue: true, motifs: [] });
  });

  it('accepte une frequence juste au plancher et un ecart juste au plafond', () => {
    expect(
      verdictDeTenue({
        ...tenue,
        frequenceMinimumHz: FREQUENCE_CIBLE_HZ * CRITERES_DE_TENUE.partDeLaFrequenceCible,
        intervalleP99Ms: CRITERES_DE_TENUE.intervalleP99MaximumMs,
      }).tenue,
    ).toBe(true);
  });

  it('refuse une partie qui ralentit sous le plancher', () => {
    const verdict = verdictDeTenue({ ...tenue, frequenceMinimumHz: 18.9 });

    expect(verdict.tenue).toBe(false);
    expect(verdict.motifs).toHaveLength(1);
    expect(verdict.motifs[0]).toContain('frequence');
  });

  it('refuse des battements qui sautent plus d une fois sur cent', () => {
    const verdict = verdictDeTenue({ ...tenue, intervalleP99Ms: 101 });

    expect(verdict.tenue).toBe(false);
    expect(verdict.motifs[0]).toContain('ecart');
  });

  it('refuse une mesure ou une connexion a ete perdue, et cumule les motifs', () => {
    const verdict = verdictDeTenue({
      frequenceMinimumHz: 10,
      intervalleP99Ms: 400,
      deconnexions: 2,
    });

    expect(verdict.tenue).toBe(false);
    expect(verdict.motifs).toHaveLength(3);
  });
});

describe('partiesParCoeur', () => {
  it('divise la part utilisable d un battement par le cout d une partie', () => {
    // 50 ms de cadence, dont 70 pour cent utilisables: 35 ms.
    expect(partiesParCoeur(1)).toBe(35);
    expect(partiesParCoeur(0.78)).toBe(44);
    expect(partiesParCoeur(35)).toBe(1);
  });

  it('rend zero quand une seule partie depasse le budget', () => {
    expect(partiesParCoeur(36)).toBe(0);
  });

  it('refuse un cout nul, negatif ou indefini', () => {
    expect(() => partiesParCoeur(0)).toThrow();
    expect(() => partiesParCoeur(-1)).toThrow();
    expect(() => partiesParCoeur(Number.NaN)).toThrow();
  });
});

describe('les debits', () => {
  it('convertit des octets par message en kilo-octets puis en megabits par seconde', () => {
    expect(debitKoParSeconde(20_000, 20)).toBe(400);
    expect(megabitsParSeconde(400)).toBe(3.2);
  });
});
