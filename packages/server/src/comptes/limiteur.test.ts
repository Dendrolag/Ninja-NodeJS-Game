/**
 * Tests de la limite des tentatives.
 *
 * Le temps est celui d'une horloge manuelle: une minute de penalite passe en une
 * ligne.
 */

import type { LimiteDebit } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerHorlogeManuelle } from '../horloge.js';
import { LimiteurDeTentatives } from './limiteur.js';

/** Trois tentatives d'un coup, puis une par minute. */
const LIMITE: LimiteDebit = { parSeconde: 1 / 60, rafale: 3 };

describe('LimiteurDeTentatives', () => {
  it('accepte la rafale, puis refuse en disant quand reessayer', () => {
    const limiteur = new LimiteurDeTentatives(LIMITE, creerHorlogeManuelle());

    expect([1, 2, 3].map(() => limiteur.tenter('alice').accepte)).toEqual([true, true, true]);

    const refus = limiteur.tenter('alice');
    expect(refus.accepte).toBe(false);
    if (!refus.accepte) {
      expect(refus.reessayerDansMs).toBeGreaterThanOrEqual(59_999);
      expect(refus.reessayerDansMs).toBeLessThanOrEqual(60_001);
    }
  });

  it('rend une tentative quand le temps a passe', () => {
    const horloge = creerHorlogeManuelle();
    const limiteur = new LimiteurDeTentatives(LIMITE, horloge);
    for (let fois = 0; fois < 3; fois += 1) {
      limiteur.tenter('alice');
    }

    horloge.avancerDe(30_000);
    expect(limiteur.tenter('alice').accepte).toBe(false);

    horloge.avancerDe(31_000);
    expect(limiteur.tenter('alice').accepte).toBe(true);
    expect(limiteur.tenter('alice').accepte).toBe(false);
  });

  it('ne punit pas davantage qui insiste: un refus ne consomme rien', () => {
    const horloge = creerHorlogeManuelle();
    const limiteur = new LimiteurDeTentatives(LIMITE, horloge);
    for (let fois = 0; fois < 3; fois += 1) {
      limiteur.tenter('alice');
    }

    for (let fois = 0; fois < 20; fois += 1) {
      limiteur.tenter('alice');
    }

    horloge.avancerDe(61_000);
    expect(limiteur.tenter('alice').accepte).toBe(true);
  });

  it('tient un seau par cle', () => {
    const limiteur = new LimiteurDeTentatives(LIMITE, creerHorlogeManuelle());
    for (let fois = 0; fois < 3; fois += 1) {
      limiteur.tenter('alice');
    }

    expect(limiteur.tenter('alice').accepte).toBe(false);
    expect(limiteur.tenter('bob').accepte).toBe(true);
  });

  it('oublie les cles dont le seau s est rempli, et garde les autres', () => {
    const horloge = creerHorlogeManuelle();
    const limiteur = new LimiteurDeTentatives({ parSeconde: 1, rafale: 3 }, horloge);

    limiteur.tenter('passee');
    for (let fois = 0; fois < 3; fois += 1) {
      limiteur.tenter('epuisee');
    }
    expect(limiteur.nombreDeCles).toBe(2);

    // Une minute plus tard, les deux seaux sont pleins: tout est oublie au
    // nettoyage, sauf la cle qui vient d'essayer.
    horloge.avancerDe(60_000);
    limiteur.tenter('nouvelle');

    expect(limiteur.nombreDeCles).toBe(1);
  });
});
