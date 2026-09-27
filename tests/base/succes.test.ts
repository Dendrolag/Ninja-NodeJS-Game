/**
 * Tests d'integration des succes (etape 3.7), contre une vraie base.
 *
 * La table et ses contraintes, l'attribution dans la transaction de fin de partie,
 * datee de la partie d'origine et jamais faite deux fois, le reessai qui annonce les
 * memes succes, le rattrapage idempotent, la rarete, et ce que le profil et la fiche
 * en montrent.
 *
 * Les tests de la base tournent en parallele sur la meme base: chacun cree ses comptes,
 * et la rarete se verifie dans un instantane coherent de la base, pas contre un nombre
 * ecrit a l'avance.
 */

import { randomUUID } from 'node:crypto';

import type { LimitesDesComptes, NouveauResultat, NouvellePartie } from '@neon-ninja/server';
import {
  Authentification,
  CODES_POSTGRES,
  attribuerLesSucces,
  creerCompte,
  enregistrerPartie,
  erreurPostgres,
  mesuresDuCompte,
  raretes,
  rattraperLesSucces,
  schema,
  succesDuCompte,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import type { IdentifiantSucces } from '@neon-ninja/shared';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, erreurDe, pseudoNeuf } from './contexte.js';

/** Des limites que les tests ne peuvent pas atteindre sans le vouloir. */
const LIMITES_LARGES: LimitesDesComptes = {
  connexionParPseudo: { parSeconde: 100, rafale: 1000 },
  connexionParAdresse: { parSeconde: 100, rafale: 1000 },
  inscriptionParAdresse: { parSeconde: 100, rafale: 1000 },
};

/** Un scrypt allege: ces tests ne portent pas sur l'empreinte. */
const SCRYPT_ALLEGE = { N: 2 ** 10, r: 8, p: 1 };

const MOT_DE_PASSE = 'correct cheval pile agrafe';

/** Une partie de Horde a deux, terminee a cette heure. */
function partie(termineeLe: string, surcharge: Partial<NouvellePartie> = {}): NouvellePartie {
  return {
    id: randomUUID(),
    mode: 'classique',
    carte: 'map1',
    modeMiroir: false,
    dureeS: 180,
    nombreJoueurs: 2,
    termineeLe: new Date(termineeLe),
    ...surcharge,
  };
}

/** Le resultat d'un compte, sans prise ni gain. */
function resultat(
  compteId: string,
  placement: number,
  surcharge: Partial<NouveauResultat> = {},
): NouveauResultat {
  return {
    compteId,
    placement,
    points: 10,
    captures: 0,
    botsNoirsDetruits: 0,
    xpGagnee: 0,
    piecesGagnees: 0,
    variationPointsLigue: 0,
    ...surcharge,
  };
}

describe.runIf(baseDisponible())('succes', () => {
  const db = baseDeTest();

  /** Un compte neuf, pour un seul test. */
  async function nouveauCompte(): Promise<string> {
    return accepte(await creerCompte(db(), pseudoNeuf('Succes'))).id;
  }

  /** Les succes inscrits d'un compte, avec leur partie d'origine et leur date. */
  async function lignesDe(
    compteId: string,
  ): Promise<{ succes: string; partieId: string | null; debloqueLe: Date }[]> {
    return db()
      .select({
        succes: schema.succesDebloques.succes,
        partieId: schema.succesDebloques.partieId,
        debloqueLe: schema.succesDebloques.debloqueLe,
      })
      .from(schema.succesDebloques)
      .where(eq(schema.succesDebloques.compteId, compteId))
      .orderBy(schema.succesDebloques.succes);
  }

  /** Efface les succes d'un compte, comme ceux d'un compte d'avant l'etape. */
  async function effacerLesSucces(compteId: string): Promise<void> {
    await db().delete(schema.succesDebloques).where(eq(schema.succesDebloques.compteId, compteId));
  }

  describe('la table', () => {
    it('refuse un identifiant mal forme, et un succes deux fois', async () => {
      const compteId = await nouveauCompte();
      const ligne = { compteId, succes: 'premier-pas', debloqueLe: new Date() };

      await db().insert(schema.succesDebloques).values(ligne);

      expect(
        erreurPostgres(await erreurDe(db().insert(schema.succesDebloques).values(ligne))),
      ).toEqual({
        code: CODES_POSTGRES.unicite,
        contrainte: 'succes_debloques_compte_succes',
      });
      expect(
        erreurPostgres(
          await erreurDe(
            db()
              .insert(schema.succesDebloques)
              .values({ ...ligne, succes: 'Premier pas' }),
          ),
        )?.contrainte,
      ).toBe('succes_debloques_identifiant');
      expect(
        erreurPostgres(
          await erreurDe(
            db()
              .insert(schema.succesDebloques)
              .values({ ...ligne, succes: 'a'.repeat(41) }),
          ),
        )?.contrainte,
      ).toBe('succes_debloques_longueur');
    });

    it('part avec le compte, et garde le succes sans sa partie si elle disparait', async () => {
      const compteId = await nouveauCompte();
      const { partieId } = await enregistrerPartie(db(), partie('2026-09-01T10:00:00Z'), []);

      await db()
        .insert(schema.succesDebloques)
        .values({ compteId, succes: 'premier-pas', debloqueLe: new Date(), partieId });
      await db().delete(schema.parties).where(eq(schema.parties.id, partieId));

      expect((await lignesDe(compteId))[0]?.partieId).toBeNull();

      await db().delete(schema.comptes).where(eq(schema.comptes.id, compteId));

      expect(await lignesDe(compteId)).toEqual([]);
    });

    it('ignore a la lecture un succes que le code ne connait plus', async () => {
      const compteId = await nouveauCompte();

      await db()
        .insert(schema.succesDebloques)
        .values({ compteId, succes: 'succes-retire', debloqueLe: new Date() });

      expect((await succesDuCompte(db(), compteId)).size).toBe(0);
    });
  });

  describe('en fin de partie', () => {
    it('annonce les succes de la premiere partie, dates de sa fin', async () => {
      const alice = await nouveauCompte();
      const bob = await nouveauCompte();
      const jouee = partie('2026-09-02T18:00:00Z');

      const { partieId, progressions } = await enregistrerPartie(db(), jouee, [
        resultat(alice, 1, { captures: 1 }),
        resultat(bob, 2),
      ]);

      expect(progressions.map((appliquee) => appliquee.succes.debloques)).toEqual([
        ['premier-pas', 'premiere-prise', 'premiere-couronne'],
        ['premier-pas'],
      ]);
      expect(await lignesDe(bob)).toEqual([
        { succes: 'premier-pas', partieId, debloqueLe: new Date('2026-09-02T18:00:00Z') },
      ]);
      // Une carte sur trois fait le tiers de Touriste: aucun autre cumul n'en est si pres.
      expect(progressions[0]?.succes.plusProche).toEqual({ id: 'touriste', actuel: 1, seuil: 3 });
      expect(progressions[1]?.succes.plusProche).toEqual({ id: 'touriste', actuel: 1, seuil: 3 });
    });

    it('ne donne jamais deux fois le meme succes', async () => {
      const alice = await nouveauCompte();
      const bob = await nouveauCompte();

      await enregistrerPartie(db(), partie('2026-09-03T18:00:00Z'), [
        resultat(alice, 1),
        resultat(bob, 2),
      ]);
      const { progressions } = await enregistrerPartie(db(), partie('2026-09-03T18:10:00Z'), [
        resultat(alice, 1),
        resultat(bob, 2),
      ]);

      expect(progressions.map((appliquee) => appliquee.succes.debloques)).toEqual([[], []]);
      expect((await lignesDe(alice)).map((ligne) => ligne.succes)).toEqual([
        'premier-pas',
        'premiere-couronne',
      ]);
    });

    it('annonce les memes succes au reessai d une partie deja enregistree', async () => {
      const alice = await nouveauCompte();
      const jouee = partie('2026-09-04T18:00:00Z', { nombreJoueurs: 1 });
      const lignes = [resultat(alice, 1, { botsNoirsDetruits: 2 })];

      const premier = await enregistrerPartie(db(), jouee, lignes);
      const reessai = await enregistrerPartie(db(), jouee, lignes);

      expect(premier.progressions[0]?.succes.debloques).toEqual(['premier-pas', 'nettoyeur']);
      expect(reessai.progressions[0]?.succes).toEqual(premier.progressions[0]?.succes);
      expect(await lignesDe(alice)).toHaveLength(2);
    });

    it('inscrit un succes oublie a sa vraie date, sans l annoncer', async () => {
      const alice = await nouveauCompte();
      const bob = await nouveauCompte();
      const { partieId: premiere } = await enregistrerPartie(db(), partie('2026-09-05T18:00:00Z'), [
        resultat(alice, 1),
        resultat(bob, 2),
      ]);

      await effacerLesSucces(alice);
      const { progressions } = await enregistrerPartie(
        db(),
        partie('2026-09-05T19:00:00Z', { modeMiroir: true }),
        [resultat(alice, 2), resultat(bob, 1)],
      );

      expect(progressions[0]?.succes.debloques).toEqual(['reflet']);
      expect(await lignesDe(alice)).toEqual([
        {
          succes: 'premier-pas',
          partieId: premiere,
          debloqueLe: new Date('2026-09-05T18:00:00Z'),
        },
        {
          succes: 'premiere-couronne',
          partieId: premiere,
          debloqueLe: new Date('2026-09-05T18:00:00Z'),
        },
        {
          succes: 'reflet',
          partieId: expect.any(String) as string,
          debloqueLe: new Date('2026-09-05T19:00:00Z'),
        },
      ]);
    });

    it('lit les amis d aujourd hui: dix parties ensemble font une bande, dix devant une rivalite', async () => {
      const alice = await nouveauCompte();
      const bob = await nouveauCompte();

      await db()
        .insert(schema.amities)
        .values({
          compteA: sql`least(${alice}::uuid, ${bob}::uuid)`,
          compteB: sql`greatest(${alice}::uuid, ${bob}::uuid)`,
        });

      let dixieme: IdentifiantSucces[][] = [];

      for (let partieJouee = 1; partieJouee <= 10; partieJouee += 1) {
        const minute = String(partieJouee).padStart(2, '0');
        const { progressions } = await enregistrerPartie(
          db(),
          partie(`2026-09-06T18:${minute}:00Z`),
          [resultat(alice, 1), resultat(bob, 2)],
        );

        dixieme = progressions.map((appliquee) => [...appliquee.succes.debloques]);
      }

      expect(dixieme).toEqual([['dix-couronnes', 'en-bande', 'rivalite'], ['en-bande']]);
    });

    it('compte les jours a l heure de Paris', async () => {
      const alice = await nouveauCompte();

      // 23 h 30 puis 0 h 30 a Paris, le meme jour en temps universel.
      await enregistrerPartie(db(), partie('2026-09-07T21:30:00Z', { nombreJoueurs: 1 }), [
        resultat(alice, 1),
      ]);
      await enregistrerPartie(db(), partie('2026-09-07T22:30:00Z', { nombreJoueurs: 1 }), [
        resultat(alice, 1),
      ]);

      expect((await mesuresDuCompte(db(), alice)).jours).toBe(2);
    });
  });

  describe('le rattrapage', () => {
    it('inscrit les succes des comptes d avant, dates de leur partie d origine, et une seule fois', async () => {
      const alice = await nouveauCompte();
      const bob = await nouveauCompte();
      const { partieId: premiere } = await enregistrerPartie(db(), partie('2026-09-08T18:00:00Z'), [
        resultat(alice, 2),
        resultat(bob, 1),
      ]);
      const { partieId: seconde } = await enregistrerPartie(db(), partie('2026-09-08T19:00:00Z'), [
        resultat(alice, 1, { captures: 3 }),
        resultat(bob, 2),
      ]);

      await effacerLesSucces(alice);
      const bilan = await rattraperLesSucces(db(), 7);
      const apres = await lignesDe(alice);

      expect(bilan.comptes).toBeGreaterThanOrEqual(2);
      expect(bilan.inscrits).toBeGreaterThanOrEqual(3);
      expect(apres).toEqual([
        { succes: 'premier-pas', partieId: premiere, debloqueLe: new Date('2026-09-08T18:00:00Z') },
        {
          succes: 'premiere-couronne',
          partieId: seconde,
          debloqueLe: new Date('2026-09-08T19:00:00Z'),
        },
        {
          succes: 'premiere-prise',
          partieId: seconde,
          debloqueLe: new Date('2026-09-08T19:00:00Z'),
        },
      ]);

      // Relance: rien de plus pour ces comptes, et leurs lignes ne changent pas.
      await rattraperLesSucces(db(), 7);

      expect(await lignesDe(alice)).toEqual(apres);
      expect((await attribuerLesSucces(db(), [alice, bob])).get(alice)?.inscrits).toBe(0);
    });

    it("n'inscrit rien pour un compte qui n'a jamais joue", async () => {
      const compteId = await nouveauCompte();

      expect((await attribuerLesSucces(db(), [compteId])).get(compteId)).toEqual({
        mesures: expect.objectContaining({ partiesJouees: 0, xpTotale: 0 }) as unknown,
        succes: new Map(),
        inscrits: 0,
      });
    });
  });

  describe('la rarete', () => {
    it('rapporte les detenteurs aux comptes qui ont joue, dans un instantane coherent', async () => {
      const alice = await nouveauCompte();

      await enregistrerPartie(db(), partie('2026-09-09T18:00:00Z', { nombreJoueurs: 1 }), [
        resultat(alice, 1),
      ]);

      await db().transaction(
        async (transaction) => {
          const [compte] = await transaction
            .select({ joueurs: sql<number>`count(distinct ${schema.resultats.compteId})::int` })
            .from(schema.resultats);
          const [detenteurs] = await transaction
            .select({ nombre: sql<number>`count(*)::int` })
            .from(schema.succesDebloques)
            .where(
              and(
                eq(schema.succesDebloques.succes, 'premier-pas'),
                sql`exists (select 1 from ${schema.resultats} where ${schema.resultats.compteId} = ${schema.succesDebloques.compteId})`,
              ),
            );
          const parSucces = await raretes(transaction);

          expect(parSucces.get('premier-pas')).toBeCloseTo(
            ((detenteurs?.nombre ?? 0) * 100) / (compte?.joueurs ?? 1),
            10,
          );
          expect(parSucces.get('premier-pas')).toBeLessThanOrEqual(100);
          expect(parSucces.has('succes-retire' as IdentifiantSucces)).toBe(false);
        },
        { isolationLevel: 'repeatable read' },
      );
    });
  });

  describe('le profil et la fiche', () => {
    it('montrent les succes obtenus, dates au profil seulement, et la progression au profil', async () => {
      const auth = new Authentification({
        db: db(),
        limites: LIMITES_LARGES,
        parametresScrypt: SCRYPT_ALLEGE,
      });
      const pseudo = pseudoNeuf('Succes');
      const inscription = await auth.inscrire({ pseudo, motDePasse: MOT_DE_PASSE }, '127.0.0.1');
      const lecteur = await auth.inscrire(
        { pseudo: pseudoNeuf('Lecteur'), motDePasse: MOT_DE_PASSE },
        '127.0.0.1',
      );

      if (!inscription.acceptee || !lecteur.acceptee) {
        throw new Error('Inscription refusee.');
      }

      const compte = await trouverCompteParPseudo(db(), pseudo);

      if (compte === undefined) {
        throw new Error("Le compte inscrit n'est pas en base.");
      }

      await enregistrerPartie(db(), partie('2026-09-10T18:00:00Z', { nombreJoueurs: 1 }), [
        resultat(compte.id, 1),
      ]);

      const profil = await auth.profil(inscription.valeur.jeton);
      const fiche = await auth.ficheJoueur(lecteur.valeur.jeton, pseudo);

      if (!profil.acceptee || !fiche.acceptee) {
        throw new Error('Lecture refusee.');
      }

      const premierPas = profil.valeur.succes.find((succes) => succes.id === 'premier-pas');

      expect(premierPas?.debloqueLe).toBe('2026-09-10T18:00:00.000Z');
      expect(premierPas?.rarete).toBeGreaterThan(0);
      expect(profil.valeur.succes.find((succes) => succes.id === 'habitue')).toEqual({
        id: 'habitue',
        progression: { actuel: 1, seuil: 25 },
        rarete: expect.any(Number) as number,
      });
      expect(fiche.valeur.succes).toEqual([
        { id: 'premier-pas', rarete: expect.any(Number) as number },
      ]);
    });
  });

  it('ne touche que les lignes du compte vise', async () => {
    const alice = await nouveauCompte();
    const bob = await nouveauCompte();

    await enregistrerPartie(db(), partie('2026-09-11T18:00:00Z'), [
      resultat(alice, 1),
      resultat(bob, 2),
    ]);
    await effacerLesSucces(alice);
    await attribuerLesSucces(db(), [alice]);

    const [ligneDeBob] = await db()
      .select()
      .from(schema.succesDebloques)
      .where(
        and(
          eq(schema.succesDebloques.compteId, bob),
          eq(schema.succesDebloques.succes, 'premier-pas'),
        ),
      );

    expect(ligneDeBob?.debloqueLe).toEqual(new Date('2026-09-11T18:00:00Z'));
    expect(await lignesDe(alice)).toHaveLength(2);
  });
});
