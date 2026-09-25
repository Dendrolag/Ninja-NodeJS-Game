import { describe, expect, it } from 'vitest';

import { ChronometreDuBattement, SEUIL_DE_RETARD_MS } from './chronometreDuBattement.js';

describe('le chronometre du battement', () => {
  it('ne dit rien tant qu aucune partie n a battu', () => {
    expect(new ChronometreDuBattement().resume(1_000)).toBeUndefined();
  });

  it('resume l ecart et la duree des battements d une serie connue', () => {
    const chronometre = new ChronometreDuBattement();

    // Cent battements: quatre-vingt-dix-huit a l'heure, deux en retard.
    for (let rang = 0; rang < 100; rang += 1) {
      const ecart = rang === 40 ? 180 : rang === 80 ? 120 : 50;
      chronometre.enregistrer(rang * 50, ecart, rang % 10 === 0 ? 4 : 1);
    }

    expect(chronometre.resume(5_000)).toEqual({
      fenetreS: 300,
      battements: 100,
      ecart: { mediane: 50, p90: 50, p99: 120, max: 180 },
      enRetard: 2,
      duree: { mediane: 1, p90: 1, p99: 4, max: 4 },
    });
  });

  it('compte en retard un ecart d au moins deux battements', () => {
    const chronometre = new ChronometreDuBattement();

    chronometre.enregistrer(0, SEUIL_DE_RETARD_MS - 0.1, 1);
    chronometre.enregistrer(100, SEUIL_DE_RETARD_MS, 1);

    expect(chronometre.resume(100)?.enRetard).toBe(1);
  });

  it('ne resume que la fenetre qui s acheve maintenant', () => {
    const chronometre = new ChronometreDuBattement();

    chronometre.enregistrer(0, 400, 1);
    chronometre.enregistrer(10_000, 50, 1);

    const resume = chronometre.resume(10_000, 5_000);

    expect(resume?.battements).toBe(1);
    expect(resume?.ecart.max).toBe(50);
    expect(chronometre.resume(20_000, 5_000)).toBeUndefined();
  });

  it('oublie les plus anciens battements au-dela de sa capacite, sans grossir', () => {
    const chronometre = new ChronometreDuBattement();

    // Un premier battement tres en retard, puis de quoi le chasser du tableau.
    chronometre.enregistrer(0, 999, 1);
    for (let rang = 1; rang <= 6_000; rang += 1) {
      chronometre.enregistrer(rang, 50, 1);
    }

    const resume = chronometre.resume(6_000, Number.POSITIVE_INFINITY);

    expect(resume?.battements).toBe(6_000);
    expect(resume?.ecart.max).toBe(50);
  });
});
