/**
 * Tests de la progression, contre une vraie base Neon.
 */

import { randomUUID } from 'node:crypto';

import {
  CODES_POSTGRES,
  creerCompte,
  ecrireProgression,
  erreurPostgres,
  lireProgression,
} from '@neon-ninja/server';
import { describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, erreurDe, pseudoNeuf } from './contexte.js';

describe.runIf(baseDisponible())('progression', () => {
  const db = baseDeTest();

  /** Un compte neuf, pour un seul test. */
  async function nouveauCompte(): Promise<string> {
    return accepte(await creerCompte(db(), pseudoNeuf('Joueur'))).id;
  }

  it('ecrit une progression et la relit', async () => {
    const compteId = await nouveauCompte();
    const avant = await lireProgression(db(), compteId);

    const ecrite = await ecrireProgression(db(), compteId, {
      xpTotale: 1_250,
      pieces: 35,
      pointsLigue: 14,
    });

    expect(ecrite).toMatchObject({ compteId, xpTotale: 1_250, pieces: 35, pointsLigue: 14 });
    expect(await lireProgression(db(), compteId)).toEqual(ecrite);
    expect(ecrite.misAJourLe.getTime()).toBeGreaterThanOrEqual(avant?.misAJourLe.getTime() ?? 0);
  });

  it('ne trouve aucune progression pour un compte qui n existe pas', async () => {
    expect(await lireProgression(db(), randomUUID())).toBeUndefined();
  });

  it('refuse d ecrire la progression d un compte qui n existe pas', async () => {
    await expect(
      ecrireProgression(db(), randomUUID(), { xpTotale: 1, pieces: 1, pointsLigue: 1 }),
    ).rejects.toThrow("n'existe pas");
  });

  it('laisse la base refuser une valeur negative, sans rien changer', async () => {
    const compteId = await nouveauCompte();

    const erreur = await erreurDe(
      ecrireProgression(db(), compteId, { xpTotale: 10, pieces: -1, pointsLigue: 0 }),
    );

    expect(erreurPostgres(erreur)).toEqual({
      code: CODES_POSTGRES.controle,
      contrainte: 'progressions_pieces_positives',
    });
    expect(await lireProgression(db(), compteId)).toMatchObject({ xpTotale: 0, pieces: 0 });
  });
});
