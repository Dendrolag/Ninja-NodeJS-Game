/**
 * Tests des comptes, contre une vraie base Neon.
 */

import {
  CODES_POSTGRES,
  creerCompte,
  erreurPostgres,
  lireProgression,
  schema,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import { reperePseudo } from '@neon-ninja/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, erreurDe, pseudoNeuf } from './contexte.js';

describe.runIf(baseDisponible())('comptes', () => {
  const db = baseDeTest();

  it('cree un compte et sa progression, a zero', async () => {
    const pseudo = pseudoNeuf('Alice');

    const compte = accepte(await creerCompte(db(), `  ${pseudo}  `));

    expect(compte.pseudo).toBe(pseudo);
    expect(compte.creeLe).toBeInstanceOf(Date);
    expect(await lireProgression(db(), compte.id)).toMatchObject({
      compteId: compte.id,
      xpTotale: 0,
      pieces: 0,
      pointsLigue: 0,
    });
  });

  it('refuse un pseudo deja pris, meme ecrit autrement', async () => {
    const pseudo = pseudoNeuf('Bob');
    accepte(await creerCompte(db(), pseudo));

    const refus = await creerCompte(db(), pseudo.toUpperCase());

    expect(refus).toEqual({
      valide: false,
      erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris.' }],
    });
  });

  it('refuse un pseudo invalide avec le motif de la validation, sans rien ecrire', async () => {
    const refus = await creerCompte(db(), '<b>Carol</b>');

    expect(refus.valide).toBe(false);
    expect(await trouverCompteParPseudo(db(), '<b>Carol</b>')).toBeUndefined();
  });

  it('retrouve un compte par son pseudo, quelle que soit son ecriture', async () => {
    const pseudo = pseudoNeuf('Dave');
    const compte = accepte(await creerCompte(db(), pseudo));

    expect(await trouverCompteParPseudo(db(), ` ${pseudo.toLowerCase()} `)).toEqual(compte);
    expect(await trouverCompteParPseudo(db(), pseudoNeuf('Personne'))).toBeUndefined();
  });

  it('tient l unicite dans la base elle-meme, pas seulement dans creerCompte', async () => {
    const pseudo = pseudoNeuf('Erin');
    const ligne = { pseudo, reperePseudo: reperePseudo(pseudo) };
    await db().insert(schema.comptes).values(ligne);

    const erreur = await erreurDe(db().insert(schema.comptes).values(ligne));

    expect(erreurPostgres(erreur)).toEqual({
      code: CODES_POSTGRES.unicite,
      contrainte: 'comptes_repere_pseudo_unique',
    });
  });

  it('supprime la progression avec le compte', async () => {
    const compte = accepte(await creerCompte(db(), pseudoNeuf('Frank')));

    await db().delete(schema.comptes).where(eq(schema.comptes.id, compte.id));

    expect(await lireProgression(db(), compte.id)).toBeUndefined();
  });
});
