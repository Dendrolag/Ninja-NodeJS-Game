/**
 * Tests des parties et de leurs resultats, contre une vraie base Neon.
 */

import { randomInt, randomUUID } from 'node:crypto';

import type { NouveauResultat, NouvellePartie } from '@neon-ninja/server';
import {
  CODES_POSTGRES,
  creerCompte,
  enregistrerPartie,
  erreurPostgres,
  lireHistorique,
  schema,
} from '@neon-ninja/server';
import type { IdentifiantCarte } from '@neon-ninja/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, erreurDe, pseudoNeuf } from './contexte.js';

/**
 * Une partie terminee a une heure unique, pour la retrouver sans connaitre son
 * identifiant (quand son enregistrement a echoue, par exemple).
 */
function partie(surcharge: Partial<NouvellePartie> = {}): NouvellePartie {
  return {
    mode: 'classique',
    carte: 'map2',
    modeMiroir: true,
    dureeS: 180,
    nombreJoueurs: 3,
    termineeLe: new Date(Date.UTC(2026, 0, 1) + randomInt(0, 2 ** 40)),
    ...surcharge,
  };
}

/** Le resultat d'un compte, avec des valeurs ordinaires. */
function resultat(
  compteId: string,
  placement: number,
  surcharge: Partial<NouveauResultat> = {},
): NouveauResultat {
  return {
    compteId,
    placement,
    points: 42,
    captures: 2,
    botsNoirsDetruits: 1,
    xpGagnee: 120,
    piecesGagnees: 15,
    variationPointsLigue: -3,
    ...surcharge,
  };
}

describe.runIf(baseDisponible())('parties et resultats', () => {
  const db = baseDeTest();

  /** Un compte neuf, pour un seul test. */
  async function nouveauCompte(): Promise<string> {
    return accepte(await creerCompte(db(), pseudoNeuf('Joueur'))).id;
  }

  /** Nombre de parties terminees a cette heure precise. */
  async function partiesTermineesA(termineeLe: Date): Promise<number> {
    const lignes = await db()
      .select()
      .from(schema.parties)
      .where(eq(schema.parties.termineeLe, termineeLe));

    return lignes.length;
  }

  it('enregistre une partie et ses resultats, relus dans l historique de chaque compte', async () => {
    const alice = await nouveauCompte();
    const bob = await nouveauCompte();
    const jouee = partie();

    const partieId = await enregistrerPartie(db(), jouee, [
      resultat(alice, 1, { points: 80, variationPointsLigue: 12 }),
      resultat(bob, 3),
    ]);

    expect(await lireHistorique(db(), alice)).toEqual([
      {
        partieId,
        ...jouee,
        placement: 1,
        points: 80,
        captures: 2,
        botsNoirsDetruits: 1,
        xpGagnee: 120,
        piecesGagnees: 15,
        variationPointsLigue: 12,
      },
    ]);
    expect(await lireHistorique(db(), bob)).toMatchObject([
      { partieId, placement: 3, variationPointsLigue: -3 },
    ]);
  });

  it('rend l historique de la partie la plus recente a la plus ancienne', async () => {
    const compte = await nouveauCompte();
    const ancienne = partie({ termineeLe: new Date('2026-03-01T10:00:00Z') });
    const recente = partie({ termineeLe: new Date('2026-03-02T10:00:00Z') });

    const idAncienne = await enregistrerPartie(db(), ancienne, [resultat(compte, 1)]);
    const idRecente = await enregistrerPartie(db(), recente, [resultat(compte, 2)]);

    const historique = await lireHistorique(db(), compte);
    expect(historique.map((ligne) => ligne.partieId)).toEqual([idRecente, idAncienne]);
    expect(await lireHistorique(db(), compte, 1)).toHaveLength(1);
  });

  it('n ecrit pas la partie si un de ses resultats est refuse', async () => {
    const compte = await nouveauCompte();
    const jouee = partie();

    const erreur = await erreurDe(
      enregistrerPartie(db(), jouee, [resultat(compte, 1), resultat(randomUUID(), 2)]),
    );

    expect(erreurPostgres(erreur)?.code).toBe(CODES_POSTGRES.cleEtrangere);
    expect(await partiesTermineesA(jouee.termineeLe)).toBe(0);
    expect(await lireHistorique(db(), compte)).toEqual([]);
  });

  it('refuse deux resultats du meme compte dans une meme partie', async () => {
    const compte = await nouveauCompte();

    const erreur = await erreurDe(
      enregistrerPartie(db(), partie(), [resultat(compte, 1), resultat(compte, 2)]),
    );

    expect(erreurPostgres(erreur)).toEqual({
      code: CODES_POSTGRES.unicite,
      contrainte: 'resultats_partie_compte',
    });
  });

  it('refuse un placement au-dela du nombre de joueurs, avant d ecrire', async () => {
    const compte = await nouveauCompte();
    const jouee = partie({ nombreJoueurs: 3 });

    await expect(enregistrerPartie(db(), jouee, [resultat(compte, 4)])).rejects.toThrow(
      'Placement 4 impossible',
    );
    expect(await partiesTermineesA(jouee.termineeLe)).toBe(0);
  });

  it('laisse la base refuser un gain negatif', async () => {
    const compte = await nouveauCompte();

    const erreur = await erreurDe(
      enregistrerPartie(db(), partie(), [resultat(compte, 1, { xpGagnee: -1 })]),
    );

    expect(erreurPostgres(erreur)).toEqual({
      code: CODES_POSTGRES.controle,
      contrainte: 'resultats_xp_positive',
    });
  });

  it('laisse la base refuser une carte qui n existe pas', async () => {
    const erreur = await erreurDe(
      db()
        .insert(schema.parties)
        .values(partie({ carte: 'map9' as IdentifiantCarte })),
    );

    // 22P02: valeur hors du type enumere.
    expect(erreurPostgres(erreur)?.code).toBe('22P02');
  });

  it('supprime les resultats avec le compte, et garde la partie', async () => {
    const partant = await nouveauCompte();
    const restant = await nouveauCompte();
    const jouee = partie();
    await enregistrerPartie(db(), jouee, [resultat(partant, 1), resultat(restant, 2)]);

    await db().delete(schema.comptes).where(eq(schema.comptes.id, partant));

    expect(await lireHistorique(db(), partant)).toEqual([]);
    expect(await lireHistorique(db(), restant)).toHaveLength(1);
    expect(await partiesTermineesA(jouee.termineeLe)).toBe(1);
  });

  it('refuse de supprimer une partie qui a encore des resultats', async () => {
    const compte = await nouveauCompte();
    const partieId = await enregistrerPartie(db(), partie(), [resultat(compte, 1)]);

    const erreur = await erreurDe(
      db().delete(schema.parties).where(eq(schema.parties.id, partieId)),
    );

    expect(erreurPostgres(erreur)).toEqual({
      code: CODES_POSTGRES.restriction,
      contrainte: 'resultats_partie_id_parties_id_fk',
    });
    expect(await lireHistorique(db(), compte)).toHaveLength(1);
  });
});
