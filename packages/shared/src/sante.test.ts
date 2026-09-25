import { describe, expect, it } from 'vitest';

import { lireLeResumeDuBattement } from './sante.js';

const RESUME = {
  fenetreS: 300,
  battements: 3600,
  ecart: { mediane: 50, p90: 51, p99: 60, max: 90 },
  enRetard: 0,
  duree: { mediane: 0.4, p90: 0.8, p99: 1.5, max: 3 },
};

describe('lireLeResumeDuBattement', () => {
  it('lit le resume d une reponse de sante', () => {
    expect(lireLeResumeDuBattement({ message: 'ok', battement: RESUME })).toEqual(RESUME);
  });

  it('rend null quand le serveur dit qu aucune partie n a battu', () => {
    expect(lireLeResumeDuBattement({ battement: null })).toBeNull();
  });

  it('ecarte une reponse qui n a pas la forme attendue', () => {
    expect(lireLeResumeDuBattement(undefined)).toBeUndefined();
    expect(lireLeResumeDuBattement('ok')).toBeUndefined();
    // Un serveur d'avant l'etape 8.6 ne dit rien des battements.
    expect(lireLeResumeDuBattement({ message: 'ok' })).toBeUndefined();
    expect(lireLeResumeDuBattement({ battement: { ...RESUME, enRetard: '2' } })).toBeUndefined();
    expect(
      lireLeResumeDuBattement({ battement: { ...RESUME, ecart: { mediane: 50 } } }),
    ).toBeUndefined();
  });

  it('ne recopie que les champs attendus', () => {
    const lu = lireLeResumeDuBattement({
      battement: { ...RESUME, intrus: 1, ecart: { ...RESUME.ecart, intrus: 2 } },
    });

    expect(lu).toEqual(RESUME);
  });
});
