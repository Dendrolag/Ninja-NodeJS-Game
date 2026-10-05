/**
 * Tests de la patience des verifications (etapes 5.9 et 5.13).
 *
 * Ce qu'ils protegent: une verification se repose jusqu'a ce qu'elle passe, au
 * rythme dit, et rend les problemes du dernier essai si elle ne passe jamais.
 */

import { describe, expect, it } from 'vitest';

import { problemesApresPatience } from './patience.ts';

describe('problemesApresPatience', () => {
  it('repose la question jusqu a ce qu elle passe', async () => {
    const reponses = [['pas encore'], ['pas encore'], []];
    const attentes: number[] = [];

    await expect(
      problemesApresPatience(
        'X',
        async () => reponses.shift() ?? [],
        { essais: 5, intervalleMs: 7 },
        async (ms) => {
          attentes.push(ms);
        },
      ),
    ).resolves.toEqual([]);
    expect(attentes).toEqual([7, 7]);
  });

  it('rend les problemes du dernier essai, une erreur comprise', async () => {
    await expect(
      problemesApresPatience(
        'Le serveur',
        async () => Promise.reject(new Error('connexion refusee')),
        { essais: 2, intervalleMs: 1 },
        async () => undefined,
      ),
    ).resolves.toEqual(['Le serveur ne repond pas: connexion refusee']);
  });
});
