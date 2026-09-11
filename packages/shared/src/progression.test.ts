/**
 * Tests de la deduction du niveau.
 *
 * Les seuils sont provisoires jusqu'a l'etape 3.3. Ce qui ne l'est pas: un compte
 * neuf est au niveau 1, le niveau ne descend jamais quand l'XP monte, et une XP
 * impossible est une faute du serveur.
 */

import { describe, expect, it } from 'vitest';

import { XP_PAR_NIVEAU_PROVISOIRE, niveauDeXp } from './progression.js';

describe('niveauDeXp', () => {
  it('met un compte neuf au niveau 1', () => {
    expect(niveauDeXp(0)).toBe(1);
  });

  it('passe au niveau suivant pile au seuil, pas avant', () => {
    expect(niveauDeXp(XP_PAR_NIVEAU_PROVISOIRE - 1)).toBe(1);
    expect(niveauDeXp(XP_PAR_NIVEAU_PROVISOIRE)).toBe(2);
    expect(niveauDeXp(2 * XP_PAR_NIVEAU_PROVISOIRE + 500)).toBe(3);
  });

  it('ne descend jamais quand l XP monte', () => {
    let precedent = niveauDeXp(0);

    for (let xp = 0; xp <= 10 * XP_PAR_NIVEAU_PROVISOIRE; xp += 137) {
      const niveau = niveauDeXp(xp);
      expect(niveau).toBeGreaterThanOrEqual(precedent);
      precedent = niveau;
    }
  });

  it('refuse une XP negative ou fractionnaire', () => {
    expect(() => niveauDeXp(-1)).toThrow();
    expect(() => niveauDeXp(1.5)).toThrow();
    expect(() => niveauDeXp(Number.NaN)).toThrow();
  });
});
