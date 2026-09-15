/**
 * Tests de la lecture des erreurs de PostgreSQL.
 */

import { describe, expect, it } from 'vitest';

import { CODES_POSTGRES, erreurPostgres } from './erreurs.js';

/** Une erreur comme le pilote pg la leve. */
function erreurDuPilote(code: string, constraint?: string): Error {
  return Object.assign(new Error('refus de la base'), { code, constraint });
}

describe('erreurPostgres', () => {
  it('lit le code et la contrainte d une erreur du pilote', () => {
    expect(erreurPostgres(erreurDuPilote('23505', 'comptes_repere_pseudo_unique'))).toEqual({
      code: CODES_POSTGRES.unicite,
      contrainte: 'comptes_repere_pseudo_unique',
    });
  });

  it('va chercher l erreur du pilote dans la cause d une erreur de Drizzle', () => {
    const enveloppe = new Error('Failed query', { cause: erreurDuPilote('23514', 'x_positif') });

    expect(erreurPostgres(enveloppe)).toEqual({ code: '23514', contrainte: 'x_positif' });
  });

  it('rend une contrainte absente quand la base n en nomme pas', () => {
    expect(erreurPostgres(erreurDuPilote('22P02'))).toEqual({
      code: '22P02',
      contrainte: undefined,
    });
  });

  it('ne prend pas une panne reseau pour un refus de la base', () => {
    const panne = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

    expect(erreurPostgres(panne)).toBeUndefined();
  });

  it('rend undefined pour ce qui n est pas une erreur de la base', () => {
    expect(erreurPostgres(new Error('faute du code'))).toBeUndefined();
    expect(erreurPostgres('texte')).toBeUndefined();
    expect(erreurPostgres(null)).toBeUndefined();
  });

  it('ne suit pas une chaine de causes sans fin', () => {
    const boucle: { cause?: unknown } = {};
    boucle.cause = boucle;

    expect(erreurPostgres(boucle)).toBeUndefined();
  });
});
