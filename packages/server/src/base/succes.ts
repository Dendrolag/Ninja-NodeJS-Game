/**
 * Les succes en base (etape 3.7): lire l'historique qu'ils plient, inscrire ceux qui
 * sont atteints, les relire, dire leur rarete, et rattraper les comptes existants.
 *
 * CE FICHIER NE DECIDE RIEN. Les mesures et la premiere partie de chaque succes se
 * calculent par le pli du paquet partage (parcoursDe): ce fichier lit l'historique
 * qu'il demande, et ecrit ce qu'il trouve.
 *
 * ATTRIBUER, C'EST RATTRAPER. Pour un compte, l'attribution plie tout son historique et
 * inscrit chaque succes atteint qui ne l'est pas encore, date de la partie apres
 * laquelle il l'etait pour la premiere fois. La fin de partie l'appelle pour ses
 * comptes, le rattrapage pour tous: un succes oublie, pour quelque raison que ce soit,
 * s'inscrit a la partie suivante du compte, avec sa vraie date. Inscrire deux fois ne
 * fait rien: la cle primaire l'interdit, et l'insertion l'ignore.
 */

import type { IdentifiantSucces, Mesures, PartieDuParcours } from '@neon-ninja/shared';
import { estUnSucces, parcoursDe } from '@neon-ninja/shared';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { BaseDeDonnees } from './connexion.js';
import { amities, parties, resultats, succesDebloques } from './schema.js';

/** Ce qui execute une lecture: la base, ou une transaction ouverte sur elle. */
type Lecteur = Pick<BaseDeDonnees, 'select'>;

/** Ce qui lit et ecrit: la base, ou une transaction ouverte sur elle. */
type Ecrivain = Pick<BaseDeDonnees, 'select' | 'insert'>;

/**
 * Le fuseau des jours de « Fidele » (etude des succes, section 4.2): celui des joueurs,
 * et non celui du serveur, qui tourne en temps universel.
 */
const FUSEAU_DES_JOURS = 'Europe/Paris';

/** Combien de comptes le rattrapage traite a la fois. */
const COMPTES_PAR_LOT = 50;

/** Une partie de l'historique d'un compte, avec de quoi dater un succes. */
export interface PartieDatee {
  readonly partieId: string;
  readonly termineeLe: Date;
  readonly partie: PartieDuParcours;
}

/** Un succes inscrit pour un compte. */
export interface SuccesEnregistre {
  readonly debloqueLe: Date;
  /** Absente si la partie d'origine a disparu depuis. */
  readonly partieId: string | undefined;
}

/** Les succes d'un compte, apres une attribution. */
export interface SuccesDUnCompte {
  /** Les mesures de son parcours, sur tout son historique. */
  readonly mesures: Mesures;
  /** Tous ses succes inscrits, anciens et nouveaux. */
  readonly succes: ReadonlyMap<IdentifiantSucces, SuccesEnregistre>;
  /** Combien cette attribution en a inscrit. */
  readonly inscrits: number;
}

/**
 * L'historique de ces comptes, tel que le pli le lit: pour chacun, ses parties dans
 * l'ordre ou elles se sont terminees, avec ses amis d'aujourd'hui qui les ont jouees.
 *
 * Deux requetes pour tous les comptes, et non deux par compte: la fin d'une partie de
 * douze joueurs n'en fait pas vingt-quatre.
 */
export async function historiquesDesComptes(
  lecteur: Lecteur,
  compteIds: readonly string[],
): Promise<ReadonlyMap<string, readonly PartieDatee[]>> {
  const ids = [...new Set(compteIds)];
  const historiques = new Map<string, PartieDatee[]>(ids.map((id) => [id, []]));

  if (ids.length === 0) {
    return historiques;
  }

  const [lignes, amisPresents] = await Promise.all([
    lecteur
      .select({
        compteId: resultats.compteId,
        partieId: parties.id,
        termineeLe: parties.termineeLe,
        jour: sql<string>`to_char(${parties.termineeLe} at time zone ${FUSEAU_DES_JOURS}, 'YYYY-MM-DD')`,
        mode: parties.mode,
        carte: parties.carte,
        modeMiroir: parties.modeMiroir,
        nombreJoueurs: parties.nombreJoueurs,
        placement: resultats.placement,
        captures: resultats.captures,
        botsNoirsDetruits: resultats.botsNoirsDetruits,
        xpGagnee: resultats.xpGagnee,
        variationPointsLigue: resultats.variationPointsLigue,
      })
      .from(resultats)
      .innerJoin(parties, eq(resultats.partieId, parties.id))
      .where(inArray(resultats.compteId, ids))
      .orderBy(asc(resultats.compteId), asc(parties.termineeLe), asc(parties.id)),
    amisDansLeursParties(lecteur, ids),
  ]);

  for (const { compteId, partieId, termineeLe, ...partie } of lignes) {
    historiques.get(compteId)?.push({
      partieId,
      termineeLe,
      partie: { ...partie, amis: amisPresents.get(`${compteId}/${partieId}`) ?? [] },
    });
  }

  return historiques;
}

/**
 * Les amis d'aujourd'hui de ces comptes qui ont joue les memes parties qu'eux, et leur
 * place, par « compte/partie ».
 */
async function amisDansLeursParties(
  lecteur: Lecteur,
  ids: readonly string[],
): Promise<ReadonlyMap<string, PartieDuParcours['amis']>> {
  const moi = alias(resultats, 'moi');
  const ami = alias(resultats, 'ami');
  const lignes = await lecteur
    .select({
      compteId: moi.compteId,
      partieId: moi.partieId,
      ami: ami.compteId,
      placement: ami.placement,
    })
    .from(moi)
    .innerJoin(ami, and(eq(ami.partieId, moi.partieId), ne(ami.compteId, moi.compteId)))
    .innerJoin(
      amities,
      and(
        eq(amities.compteA, sql`least(${moi.compteId}, ${ami.compteId})`),
        eq(amities.compteB, sql`greatest(${moi.compteId}, ${ami.compteId})`),
      ),
    )
    .where(inArray(moi.compteId, [...ids]));
  const parPartie = new Map<string, { compte: string; placement: number }[]>();

  for (const ligne of lignes) {
    const cle = `${ligne.compteId}/${ligne.partieId}`;
    const presents = parPartie.get(cle) ?? [];

    presents.push({ compte: ligne.ami, placement: ligne.placement });
    parPartie.set(cle, presents);
  }

  return parPartie;
}

/**
 * Les succes inscrits pour ces comptes. Un identifiant que le code ne connait plus est
 * ignore: le succes a ete retire.
 */
export async function succesEnregistres(
  lecteur: Lecteur,
  compteIds: readonly string[],
): Promise<ReadonlyMap<string, ReadonlyMap<IdentifiantSucces, SuccesEnregistre>>> {
  const ids = [...new Set(compteIds)];
  const parCompte = new Map<string, Map<IdentifiantSucces, SuccesEnregistre>>(
    ids.map((id) => [id, new Map()]),
  );

  if (ids.length === 0) {
    return parCompte;
  }

  const lignes = await lecteur
    .select()
    .from(succesDebloques)
    .where(inArray(succesDebloques.compteId, ids));

  for (const ligne of lignes) {
    if (estUnSucces(ligne.succes)) {
      parCompte.get(ligne.compteId)?.set(ligne.succes, {
        debloqueLe: ligne.debloqueLe,
        partieId: ligne.partieId ?? undefined,
      });
    }
  }

  return parCompte;
}

/**
 * Inscrit, pour chacun de ces comptes, les succes atteints qui ne le sont pas encore,
 * dates de leur partie d'origine.
 *
 * Dans la transaction de fin de partie, l'historique lu comprend la partie qui vient de
 * s'ecrire. Une meme attribution relancee n'inscrit rien.
 */
export async function attribuerLesSucces(
  ecrivain: Ecrivain,
  compteIds: readonly string[],
): Promise<ReadonlyMap<string, SuccesDUnCompte>> {
  const [historiques, enregistres] = await Promise.all([
    historiquesDesComptes(ecrivain, compteIds),
    succesEnregistres(ecrivain, compteIds),
  ]);
  const aInscrire: (typeof succesDebloques.$inferInsert)[] = [];
  const parCompte = new Map<
    string,
    { mesures: Mesures; succes: Map<IdentifiantSucces, SuccesEnregistre> }
  >();

  for (const [compteId, historique] of historiques) {
    const { mesures, premieres } = parcoursDe(historique.map((datee) => datee.partie));
    const succes = new Map(enregistres.get(compteId));

    for (const [id, index] of premieres) {
      const origine = historique[index];

      if (origine !== undefined && !succes.has(id)) {
        succes.set(id, { debloqueLe: origine.termineeLe, partieId: origine.partieId });
        aInscrire.push({
          compteId,
          succes: id,
          debloqueLe: origine.termineeLe,
          partieId: origine.partieId,
        });
      }
    }

    parCompte.set(compteId, { mesures, succes });
  }

  // Une attribution concurrente (le rattrapage pendant une fin de partie) a pu inscrire
  // les memes: ils sont ignores, et ce qui est rendu reste ce que le pli a trouve.
  const inscrits =
    aInscrire.length === 0
      ? []
      : await ecrivain
          .insert(succesDebloques)
          .values(aInscrire)
          .onConflictDoNothing()
          .returning({ compteId: succesDebloques.compteId });

  return new Map(
    [...parCompte].map(([compteId, { mesures, succes }]) => [
      compteId,
      {
        mesures,
        succes,
        inscrits: inscrits.filter((ligne) => ligne.compteId === compteId).length,
      },
    ]),
  );
}

/**
 * La rarete de chaque succes: la part des comptes qui ont au moins une partie
 * enregistree et qui l'ont obtenu, en pour cent, de 0 a 100. Un succes que personne
 * n'a obtenu n'y est pas.
 *
 * Calculee a chaque lecture, sur toute la base: rien ne se stocke de plus.
 */
export async function raretes(lecteur: Lecteur): Promise<ReadonlyMap<IdentifiantSucces, number>> {
  const [detenteurs, [joueurs]] = await Promise.all([
    // Seuls comptent les detenteurs qui ont joue: le rapport ne depasse jamais cent.
    lecteur
      .select({ succes: succesDebloques.succes, comptes: sql<number>`count(*)::int` })
      .from(succesDebloques)
      .where(
        sql`exists (select 1 from ${resultats} where ${resultats.compteId} = ${succesDebloques.compteId})`,
      )
      .groupBy(succesDebloques.succes),
    lecteur
      .select({ comptes: sql<number>`count(distinct ${resultats.compteId})::int` })
      .from(resultats),
  ]);
  const total = joueurs?.comptes ?? 0;
  const parSucces = new Map<IdentifiantSucces, number>();

  if (total === 0) {
    return parSucces;
  }

  for (const ligne of detenteurs) {
    if (estUnSucces(ligne.succes)) {
      // Les deux lectures ne partagent pas un instantane: une partie enregistree entre
      // les deux pourrait faire passer un succes au-dela de tous les joueurs.
      parSucces.set(ligne.succes, Math.min((ligne.comptes * 100) / total, 100));
    }
  }

  return parSucces;
}

/** Ce que le rattrapage a fait. */
export interface BilanDuRattrapage {
  /** Les comptes qui ont au moins une partie, tous examines. */
  readonly comptes: number;
  /** Les succes inscrits. Zero a la seconde execution. */
  readonly inscrits: number;
}

/**
 * Attribue leurs succes a tous les comptes qui ont joue (etape 3.7, decision 3 de
 * l'etude): ceux d'avant les succes, et ceux qui ne rejouent pas.
 *
 * Par lots de comptes, chacun dans sa transaction: un lot en echec n'annule pas les
 * precedents, et une relance reprend ou il faut, puisqu'elle n'inscrit rien deux fois.
 */
export async function rattraperLesSucces(
  db: BaseDeDonnees,
  comptesParLot = COMPTES_PAR_LOT,
): Promise<BilanDuRattrapage> {
  const joueurs = await db
    .selectDistinct({ compteId: resultats.compteId })
    .from(resultats)
    .orderBy(asc(resultats.compteId));
  let inscrits = 0;

  for (let debut = 0; debut < joueurs.length; debut += comptesParLot) {
    const lot = joueurs.slice(debut, debut + comptesParLot).map((ligne) => ligne.compteId);
    const attribues = await db.transaction((transaction) => attribuerLesSucces(transaction, lot));

    for (const compte of attribues.values()) {
      inscrits += compte.inscrits;
    }
  }

  return { comptes: joueurs.length, inscrits };
}

/** Les succes inscrits d'un seul compte. */
export async function succesDuCompte(
  lecteur: Lecteur,
  compteId: string,
): Promise<ReadonlyMap<IdentifiantSucces, SuccesEnregistre>> {
  return (await succesEnregistres(lecteur, [compteId])).get(compteId) ?? new Map();
}

/** Les mesures du parcours d'un seul compte, sur tout son historique, sans rien inscrire. */
export async function mesuresDuCompte(lecteur: Lecteur, compteId: string): Promise<Mesures> {
  const historique = (await historiquesDesComptes(lecteur, [compteId])).get(compteId) ?? [];

  return parcoursDe(historique.map((datee) => datee.partie)).mesures;
}
