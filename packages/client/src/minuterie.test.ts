/**
 * Tests de la minuterie du client.
 *
 * Ce qu'ils protegent: la minuterie manuelle des tests se comporte comme le vrai
 * temps (ordre des rappels, rappels planifies en chemin, annulation), et la
 * minuterie du navigateur rappelle et s'annule vraiment.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { creerMinuterieManuelle, minuterieNavigateur } from './minuterie.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('creerMinuterieManuelle', () => {
  it('rappelle a echeance, dans l ordre des echeances, et pas avant', () => {
    const minuterie = creerMinuterieManuelle();
    const appels: string[] = [];

    minuterie.planifier(300, () => appels.push('trois cents'));
    minuterie.planifier(100, () => appels.push('cent'));
    minuterie.planifier(100, () => appels.push('cent, planifie apres'));

    minuterie.avancerDe(99);
    expect(appels).toEqual([]);

    minuterie.avancerDe(201);
    expect(appels).toEqual(['cent', 'cent, planifie apres', 'trois cents']);
    expect(minuterie.enAttente).toBe(0);
  });

  it('fait partir dans le meme avancement un rappel planifie en chemin', () => {
    const minuterie = creerMinuterieManuelle();
    const appels: number[] = [];

    minuterie.planifier(100, () => {
      appels.push(100);
      minuterie.planifier(100, () => appels.push(200));
      minuterie.planifier(500, () => appels.push(600));
    });

    minuterie.avancerDe(250);

    expect(appels).toEqual([100, 200]);
    expect(minuterie.enAttente).toBe(1);
  });

  it('n appelle pas un rappel annule', () => {
    const minuterie = creerMinuterieManuelle();
    const rappel = vi.fn();

    const annuler = minuterie.planifier(100, rappel);
    annuler();
    minuterie.avancerDe(1000);

    expect(rappel).not.toHaveBeenCalled();
    expect(minuterie.enAttente).toBe(0);
  });

  it('refuse d avancer d un temps negatif ou infini', () => {
    const minuterie = creerMinuterieManuelle();

    expect(() => minuterie.avancerDe(-1)).toThrow(/temps positif/u);
    expect(() => minuterie.avancerDe(Number.POSITIVE_INFINITY)).toThrow(/temps positif/u);
  });
});

describe('minuterieNavigateur', () => {
  it('rappelle apres le delai, et s annule', () => {
    vi.useFakeTimers();
    const rappel = vi.fn();
    const annule = vi.fn();

    minuterieNavigateur.planifier(3000, rappel);
    const annuler = minuterieNavigateur.planifier(3000, annule);
    annuler();
    vi.advanceTimersByTime(3000);

    expect(rappel).toHaveBeenCalledTimes(1);
    expect(annule).not.toHaveBeenCalled();
  });
});
