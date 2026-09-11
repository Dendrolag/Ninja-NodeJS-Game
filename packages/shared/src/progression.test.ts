/**
 * Tests des regles de progression: niveaux, paliers, et ce qu'une partie rapporte.
 *
 * Les valeurs attendues sont ecrites en toutes lettres, et non recalculees a partir
 * des constantes: ce sont celles que le porteur du projet a validees le 11
 * septembre 2026. Si une constante change, ces tests doivent le signaler.
 */

import { describe, expect, it } from 'vitest';

import type { PlaceEnFinDePartie } from './progression.js';
import {
  PALIERS,
  avancementDuNiveau,
  niveauDeXp,
  palierDePoints,
  recompensesDePartie,
  xpDuNiveau,
} from './progression.js';

/** Trois minutes, la duree par defaut d'une partie. */
const TROIS_MINUTES = 180_000;

/** La place d'un compte present du debut a la fin d'une partie de trois minutes. */
function place(surcharge: Partial<PlaceEnFinDePartie>): PlaceEnFinDePartie {
  return {
    placement: 1,
    nombreJoueurs: 1,
    tempsJoueMs: TROIS_MINUTES,
    dureePartieMs: TROIS_MINUTES,
    abandon: false,
    ...surcharge,
  };
}

describe('niveaux', () => {
  it('fait couter 100 x n XP le passage du niveau n au suivant', () => {
    expect([1, 2, 3, 5, 10, 20, 30].map(xpDuNiveau)).toEqual([
      0, 100, 300, 1000, 4500, 19_000, 43_500,
    ]);
  });

  it('met un compte neuf au niveau 1, et change de niveau pile au seuil', () => {
    expect(niveauDeXp(0)).toBe(1);
    expect(niveauDeXp(99)).toBe(1);
    expect(niveauDeXp(100)).toBe(2);
    expect(niveauDeXp(299)).toBe(2);
    expect(niveauDeXp(300)).toBe(3);
    expect(niveauDeXp(2500)).toBe(7);
  });

  it('retrouve chaque seuil exactement, meme tres haut', () => {
    for (const niveau of [2, 17, 250, 6000]) {
      expect(niveauDeXp(xpDuNiveau(niveau))).toBe(niveau);
      expect(niveauDeXp(xpDuNiveau(niveau) - 1)).toBe(niveau - 1);
    }
  });

  it('ne descend jamais quand l XP monte', () => {
    let precedent = niveauDeXp(0);

    for (let xp = 0; xp <= 50_000; xp += 37) {
      const niveau = niveauDeXp(xp);
      expect(niveau).toBeGreaterThanOrEqual(precedent);
      precedent = niveau;
    }
  });

  it('dit ou en est un compte dans son niveau', () => {
    expect(avancementDuNiveau(0)).toEqual({ niveau: 1, xpDansLeNiveau: 0, xpDuNiveauEntier: 100 });
    expect(avancementDuNiveau(420)).toEqual({
      niveau: 3,
      xpDansLeNiveau: 120,
      xpDuNiveauEntier: 300,
    });
  });

  it('refuse une XP negative ou fractionnaire, et un niveau impossible', () => {
    expect(() => niveauDeXp(-1)).toThrow();
    expect(() => niveauDeXp(1.5)).toThrow();
    expect(() => niveauDeXp(Number.NaN)).toThrow();
    expect(() => xpDuNiveau(0)).toThrow();
  });
});

describe('paliers', () => {
  it('compte cinq paliers, de Bronze a Diamant', () => {
    expect(PALIERS).toEqual([
      { id: 'bronze', seuil: 0 },
      { id: 'argent', seuil: 100 },
      { id: 'or', seuil: 300 },
      { id: 'platine', seuil: 600 },
      { id: 'diamant', seuil: 1000 },
    ]);
  });

  it('deduit le palier des points de ligue, pile au seuil', () => {
    expect(palierDePoints(0)).toBe('bronze');
    expect(palierDePoints(99)).toBe('bronze');
    expect(palierDePoints(100)).toBe('argent');
    expect(palierDePoints(300)).toBe('or');
    expect(palierDePoints(599)).toBe('or');
    expect(palierDePoints(600)).toBe('platine');
    expect(palierDePoints(1000)).toBe('diamant');
    expect(palierDePoints(250_000)).toBe('diamant');
  });

  it('refuse des points negatifs ou fractionnaires', () => {
    expect(() => palierDePoints(-1)).toThrow();
    expect(() => palierDePoints(0.5)).toThrow();
  });
});

describe('XP et pieces d une partie', () => {
  it('donne l exemple valide: partie de trois minutes a quatre joueurs', () => {
    const gains = [1, 2, 3, 4].map((placement) =>
      recompensesDePartie(place({ placement, nombreJoueurs: 4 })),
    );

    expect(gains.map(({ xp, pieces }) => [xp, pieces])).toEqual([
      [210, 21],
      [150, 15],
      [90, 9],
      [30, 3],
    ]);
  });

  it('paie au temps passe dans la partie, pas a sa duree', () => {
    const entreUneMinuteAvantLaFin = recompensesDePartie(
      place({ placement: 1, nombreJoueurs: 2, tempsJoueMs: 60_000 }),
    );

    expect(entreUneMinuteAvantLaFin.xp).toBe(30);
    expect(entreUneMinuteAvantLaFin.pieces).toBe(3);
  });

  it('ne rapporte presque rien a une partie courte jouee seul', () => {
    expect(recompensesDePartie(place({ tempsJoueMs: 30_000, dureePartieMs: 30_000 }))).toEqual({
      xp: 5,
      pieces: 0,
      variationPointsLigue: 0,
    });
  });

  it('ne compte pas les millisecondes jouees au-dela de la duree', () => {
    expect(recompensesDePartie(place({ tempsJoueMs: TROIS_MINUTES + 49 })).xp).toBe(30);
  });

  it('arrondit l XP et les pieces en dessous', () => {
    // 59 999 ms a 10 XP par minute: 9,99 XP.
    expect(recompensesDePartie(place({ tempsJoueMs: 59_999 })).xp).toBe(9);
    // 3 min 18 s, a 30 XP par minute: 99 XP, soit 9 pieces et non 9,9.
    const gains = recompensesDePartie(
      place({ placement: 1, nombreJoueurs: 2, tempsJoueMs: 198_000, dureePartieMs: 600_000 }),
    );
    expect([gains.xp, gains.pieces]).toEqual([99, 9]);
  });
});

describe('points de ligue d une partie', () => {
  it('donne +20 au premier et -10 au dernier, en ligne droite entre les deux', () => {
    const variations = (nombreJoueurs: number): number[] =>
      Array.from(
        { length: nombreJoueurs },
        (_, index) =>
          recompensesDePartie(place({ placement: index + 1, nombreJoueurs })).variationPointsLigue,
      );

    expect(variations(2)).toEqual([20, -10]);
    expect(variations(3)).toEqual([20, 5, -10]);
    expect(variations(4)).toEqual([20, 10, 0, -10]);
    expect(variations(12)).toEqual([20, 17, 15, 12, 9, 6, 4, 1, -2, -5, -7, -10]);
  });

  it('arrondit une demie vers le haut, et ne rend jamais moins zero', () => {
    // Neuf joueurs, septieme: -10 + 30 x 2/8 = -2,5.
    expect(
      recompensesDePartie(place({ placement: 7, nombreJoueurs: 9 })).variationPointsLigue,
    ).toBe(-2);
    // Quatre joueurs, troisieme: exactement zero, et pas moins zero.
    expect(
      Object.is(
        recompensesDePartie(place({ placement: 3, nombreJoueurs: 4 })).variationPointsLigue,
        0,
      ),
    ).toBe(true);
  });

  it('ne bouge pas dans une partie jouee seul', () => {
    expect(recompensesDePartie(place({})).variationPointsLigue).toBe(0);
  });

  it('ne bouge pas dans une partie de moins de trois minutes, et bouge a trois minutes pile', () => {
    const courte = place({ placement: 2, nombreJoueurs: 2, dureePartieMs: TROIS_MINUTES - 1 });
    const pile = place({ placement: 2, nombreJoueurs: 2 });

    expect(recompensesDePartie(courte).variationPointsLigue).toBe(0);
    expect(recompensesDePartie(pile).variationPointsLigue).toBe(-10);
  });
});

describe('abandon', () => {
  it('ne rapporte ni XP ni pieces, et coute les points du dernier', () => {
    expect(recompensesDePartie(place({ placement: 4, nombreJoueurs: 4, abandon: true }))).toEqual({
      xp: 0,
      pieces: 0,
      variationPointsLigue: -10,
    });
  });

  it('compte dernier quel que soit le placement donne', () => {
    expect(recompensesDePartie(place({ placement: 1, nombreJoueurs: 3, abandon: true }))).toEqual({
      xp: 0,
      pieces: 0,
      variationPointsLigue: -10,
    });
  });

  it('ne coute rien dans une partie trop courte pour la ligue', () => {
    expect(
      recompensesDePartie(
        place({ placement: 2, nombreJoueurs: 2, dureePartieMs: 60_000, abandon: true }),
      ),
    ).toEqual({ xp: 0, pieces: 0, variationPointsLigue: 0 });
  });
});

describe('place impossible', () => {
  it('refuse un placement hors de la partie ou un nombre de joueurs impossible', () => {
    expect(() => recompensesDePartie(place({ placement: 0 }))).toThrow('Placement 0');
    expect(() => recompensesDePartie(place({ placement: 3, nombreJoueurs: 2 }))).toThrow(
      'Placement 3',
    );
    expect(() => recompensesDePartie(place({ placement: 1.5, nombreJoueurs: 2 }))).toThrow();
    expect(() => recompensesDePartie(place({ nombreJoueurs: 0 }))).toThrow('au moins un joueur');
  });

  it('refuse un temps negatif ou non fini', () => {
    expect(() => recompensesDePartie(place({ tempsJoueMs: -1 }))).toThrow('temps joue');
    expect(() => recompensesDePartie(place({ dureePartieMs: Number.NaN }))).toThrow(
      'duree de partie',
    );
  });
});
