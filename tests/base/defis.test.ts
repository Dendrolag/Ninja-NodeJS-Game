/**
 * Tests d'integration des defis de la semaine (etape 3.10), contre une vraie base.
 *
 * La table des defis releves et ses contraintes, le releve dans la transaction de fin,
 * l'XP versee une seule fois, le reessai qui n'inscrit rien de plus, la semaine a l'heure
 * de Paris, les parties qui ne comptent pas, l'XP des defis dans les succes de niveau, et
 * la lecture de la semaine en cours.
 *
 * Les tests de la base tournent en parallele sur la meme base: chacun cree ses comptes.
 */

import { randomUUID } from 'node:crypto';

import type { FaitsDesComptes, NouveauResultat, NouvellePartie } from '@neon-ninja/server';
import {
  CODES_POSTGRES,
  creerCompte,
  defisDuCompte,
  enregistrerPartie,
  erreurPostgres,
  lireProgression,
  schema,
} from '@neon-ninja/server';
import type { CarteEnregistree, FaitsDePartie } from '@neon-ninja/shared';
import { defisDeLaSemaine, semaineDuJour, semaineSuivante } from '@neon-ninja/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, erreurDe, pseudoNeuf } from './contexte.js';

/** La semaine des tests: ses trois defis sont verifies d'abord, les autres en dependent. */
const SEMAINE = '2026-10-05';

/** Une partie de Horde a quatre, de trois minutes, terminee a cette heure sur cette carte. */
function partie(
  termineeLe: string,
  carte: CarteEnregistree = 'map1',
  surcharge: Partial<NouvellePartie> = {},
): NouvellePartie {
  return {
    id: randomUUID(),
    mode: 'classique',
    carte,
    modeMiroir: false,
    dureeS: 180,
    nombreJoueurs: 4,
    termineeLe: new Date(termineeLe),
    ...surcharge,
  };
}

/** Le resultat d'un compte, deuxieme, qui a gagne cette XP. */
function resultat(compteId: string, xpGagnee = 60): NouveauResultat {
  return {
    compteId,
    placement: 2,
    points: 10,
    captures: 0,
    botsNoirsDetruits: 0,
    xpGagnee,
    piecesGagnees: Math.floor(xpGagnee / 10),
    variationPointsLigue: 0,
  };
}

/** Les faits d'un compte. */
function faits(compteId: string, sesFaits: FaitsDePartie): FaitsDesComptes {
  return new Map([[compteId, sesFaits]]);
}

describe.runIf(baseDisponible())('defis de la semaine', () => {
  const db = baseDeTest();

  /** Un compte neuf, pour un seul test. */
  async function nouveauCompte(): Promise<string> {
    return accepte(await creerCompte(db(), pseudoNeuf('Defi'))).id;
  }

  /** Les defis releves d'un compte, rangees par defi. */
  async function relevesDe(
    compteId: string,
  ): Promise<{ semaine: string; defi: string; xp: number; partieId: string | null }[]> {
    return db()
      .select({
        semaine: schema.defisReleves.semaine,
        defi: schema.defisReleves.defi,
        xp: schema.defisReleves.xp,
        partieId: schema.defisReleves.partieId,
      })
      .from(schema.defisReleves)
      .where(eq(schema.defisReleves.compteId, compteId))
      .orderBy(schema.defisReleves.defi);
  }

  it('part de trois defis connus pour la semaine des tests', () => {
    expect(defisDeLaSemaine(SEMAINE)).toEqual(['trois-cartes', 'doubleurs', 'multiplicateur']);
  });

  describe('la table', () => {
    it('refuse un defi mal nomme, une semaine qui ne commence pas un lundi, ou deux fois', async () => {
      const alice = await nouveauCompte();
      const ligne = {
        compteId: alice,
        semaine: SEMAINE,
        defi: 'trois-cartes',
        xp: 300,
        releveLe: new Date('2026-10-05T10:00:00Z'),
      };

      await db().insert(schema.defisReleves).values(ligne);

      expect(
        erreurPostgres(await erreurDe(db().insert(schema.defisReleves).values(ligne))),
      ).toEqual({ code: CODES_POSTGRES.unicite, contrainte: 'defis_releves_compte_semaine_defi' });
      expect(
        erreurPostgres(
          await erreurDe(
            db()
              .insert(schema.defisReleves)
              .values({ ...ligne, defi: 'Trois Cartes' }),
          ),
        ),
      ).toEqual({ code: CODES_POSTGRES.controle, contrainte: 'defis_releves_identifiant' });
      expect(
        erreurPostgres(
          await erreurDe(
            db()
              .insert(schema.defisReleves)
              .values({ ...ligne, semaine: '2026-10-06' }),
          ),
        ),
      ).toEqual({ code: CODES_POSTGRES.controle, contrainte: 'defis_releves_un_lundi' });
      expect(
        erreurPostgres(
          await erreurDe(
            db()
              .insert(schema.defisReleves)
              .values({ ...ligne, defi: 'doubleurs', xp: -1 }),
          ),
        ),
      ).toEqual({ code: CODES_POSTGRES.controle, contrainte: 'defis_releves_xp_positive' });
    });
  });

  describe('le releve en fin de partie', () => {
    it('inscrit un defi atteint une fois, avec son XP, date de la partie qui le releve', async () => {
      const alice = await nouveauCompte();

      const premiere = await enregistrerPartie(db(), partie('2026-10-05T10:00:00Z', 'map1'), [
        resultat(alice),
      ]);
      const deuxieme = await enregistrerPartie(db(), partie('2026-10-06T10:00:00Z', 'map3'), [
        resultat(alice),
      ]);
      const troisieme = await enregistrerPartie(db(), partie('2026-10-07T10:00:00Z', 'quartier'), [
        resultat(alice),
      ]);
      const quatrieme = await enregistrerPartie(db(), partie('2026-10-08T10:00:00Z', 'station'), [
        resultat(alice),
      ]);

      expect(premiere.progressions[0]?.defis.releves).toEqual([]);
      expect(premiere.progressions[0]?.defis.defis[0]).toMatchObject({
        id: 'trois-cartes',
        actuel: 1,
        seuil: 3,
        xp: 300,
        accompli: false,
      });
      expect(deuxieme.progressions[0]?.defis.releves).toEqual([]);
      expect(troisieme.progressions[0]?.defis.releves).toEqual([{ id: 'trois-cartes', xp: 300 }]);
      expect(troisieme.progressions[0]?.defis.defis[0]).toMatchObject({
        id: 'trois-cartes',
        actuel: 3,
        accompli: true,
      });
      // La partie qui le releve verse l'XP du defi en plus de la sienne.
      expect(troisieme.progressions[0]?.avant.xpTotale).toBe(120);
      expect(troisieme.progressions[0]?.apres.xpTotale).toBe(120 + 60 + 300);
      // Une quatrieme carte ne le releve pas une seconde fois.
      expect(quatrieme.progressions[0]?.defis.releves).toEqual([]);
      expect((await lireProgression(db(), alice))?.xpTotale).toBe(4 * 60 + 300);
      expect(await relevesDe(alice)).toEqual([
        { semaine: SEMAINE, defi: 'trois-cartes', xp: 300, partieId: troisieme.partieId },
      ]);
    });

    it('releve plusieurs defis d’une meme partie, dans l’ordre des familles', async () => {
      const alice = await nouveauCompte();

      await enregistrerPartie(db(), partie('2026-10-05T10:00:00Z', 'map1'), [resultat(alice)]);
      await enregistrerPartie(db(), partie('2026-10-05T11:00:00Z', 'map3'), [resultat(alice)]);
      const { progressions } = await enregistrerPartie(
        db(),
        partie('2026-10-05T12:00:00Z', 'quartier'),
        [resultat(alice)],
        faits(alice, { meilleurMultiplicateur: 5, doubleursVoles: 2 }),
      );

      expect(progressions[0]?.defis.releves).toEqual([
        { id: 'trois-cartes', xp: 300 },
        { id: 'doubleurs', xp: 400 },
        { id: 'multiplicateur', xp: 500 },
      ]);
      expect(progressions[0]?.apres.xpTotale).toBe(3 * 60 + 1200);
    });

    it('au reessai, n’inscrit rien de plus et annonce les memes defis', async () => {
      const alice = await nouveauCompte();
      const multiplicateur = faits(alice, { meilleurMultiplicateur: 6 });
      const fin = partie('2026-10-05T10:00:00Z');

      const premier = await enregistrerPartie(db(), fin, [resultat(alice)], multiplicateur);
      const reessai = await enregistrerPartie(db(), fin, [resultat(alice)], multiplicateur);

      expect(premier.progressions[0]?.defis.releves).toEqual([{ id: 'multiplicateur', xp: 500 }]);
      expect(reessai.progressions).toEqual(premier.progressions);
      expect((await lireProgression(db(), alice))?.xpTotale).toBe(60 + 500);
      expect(await relevesDe(alice)).toHaveLength(1);
    });

    it('ne compte que les parties de la semaine, a l’heure de Paris', async () => {
      const alice = await nouveauCompte();

      // Dimanche 4 octobre, 23 h 30 a Paris: la semaine precedente.
      await enregistrerPartie(db(), partie('2026-10-04T21:30:00Z', 'map1'), [resultat(alice)]);
      await enregistrerPartie(db(), partie('2026-10-04T21:40:00Z', 'map3'), [resultat(alice)]);
      // Lundi 5 octobre, 0 h 30 a Paris: la semaine des tests.
      const lundi = await enregistrerPartie(db(), partie('2026-10-04T22:30:00Z', 'quartier'), [
        resultat(alice),
      ]);

      expect(lundi.progressions[0]?.defis.releves).toEqual([]);
      expect(lundi.progressions[0]?.defis.defis[0]).toMatchObject({
        id: 'trois-cartes',
        actuel: 1,
      });
    });

    it('ne compte ni un abandon, ni une partie de moins de trois minutes, ni un fait seul', async () => {
      const alice = await nouveauCompte();

      await enregistrerPartie(db(), partie('2026-10-05T10:00:00Z', 'map1'), [resultat(alice, 0)]);
      await enregistrerPartie(db(), partie('2026-10-05T11:00:00Z', 'map3', { dureeS: 120 }), [
        resultat(alice),
      ]);
      const seul = await enregistrerPartie(
        db(),
        partie('2026-10-05T12:00:00Z', 'quartier', { nombreJoueurs: 1 }),
        [{ ...resultat(alice), placement: 1 }],
        faits(alice, { meilleurMultiplicateur: 9 }),
      );

      expect(seul.progressions[0]?.defis.releves).toEqual([]);
      expect(seul.progressions[0]?.defis.defis.map((defi) => defi.actuel)).toEqual([1, 0, 0]);
    });

    it('compte l’XP des defis dans les succes de niveau', async () => {
      const alice = await nouveauCompte();

      // 700 XP de partie et 500 du defi: 1 200, au-dela des 1 000 du niveau 5.
      const { progressions } = await enregistrerPartie(
        db(),
        partie('2026-10-05T10:00:00Z'),
        [resultat(alice, 700)],
        faits(alice, { meilleurMultiplicateur: 5 }),
      );

      expect(progressions[0]?.apres.xpTotale).toBe(1200);
      expect(progressions[0]?.succes.debloques).toContain('recrue');
    });
  });

  describe('la semaine en cours', () => {
    it('rend ses trois defis, l’avancee du compte et la fin de la semaine', async () => {
      const alice = await nouveauCompte();
      // Sans heure de fin: celle de la base, maintenant.
      const { termineeLe: _sansHeure, ...maintenant } = partie('2026-10-05T10:00:00Z');
      const { progressions } = await enregistrerPartie(db(), maintenant, [resultat(alice)]);
      const defis = await defisDuCompte(db(), alice);
      const finLe = new Date(defis.finLe);

      expect(defis.semaine).toBe(semaineDuJour(defis.semaine));
      expect(defis.defis.map((defi) => defi.id)).toEqual(defisDeLaSemaine(defis.semaine));
      expect(defis.defis).toEqual(progressions[0]?.defis.defis);
      // La fin est le lundi suivant, 0 h a Paris, dans moins d'une semaine.
      expect(finLe.getTime()).toBeGreaterThan(Date.now());
      expect(finLe.getTime() - Date.now()).toBeLessThanOrEqual(7 * 86_400_000);
      expect(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Paris',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(finLe),
      ).toBe(`${semaineSuivante(defis.semaine)}, 00:00`);
    });
  });
});
