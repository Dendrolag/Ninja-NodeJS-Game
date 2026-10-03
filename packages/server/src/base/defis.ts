/**
 * Les defis de la semaine en base (etape 3.10): relever ceux qu'une partie a atteints, et
 * dire ou en est un compte.
 *
 * CE FICHIER NE DECIDE RIEN. Les defis de la semaine, leur avancee et leur recompense se
 * calculent par le paquet partage (avancementsDeLaSemaine): ce fichier lit les parties
 * de la semaine et les defis deja releves, et ecrit ce qu'il trouve.
 *
 * RELEVER, C'EST RATTRAPER, comme pour les succes. A la fin d'une partie, les parties de
 * sa semaine se plient; un defi atteint et pas encore releve s'inscrit, date de cette
 * partie, avec l'XP qu'il verse. Inscrire deux fois ne fait rien: la cle (compte,
 * semaine, defi) l'interdit, et l'insertion l'ignore. Une recompense n'est donc jamais
 * versee deux fois, meme par deux parties finies en meme temps.
 */

import type { DefiReleve, DefisDeFin, DefisDeLaSemaine } from '@neon-ninja/shared';
import {
  avancementsDeLaSemaine,
  defisDeLaSemaine,
  estUnDefi,
  semaineDuJour,
} from '@neon-ninja/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { defisReleves } from './schema.js';
import type { Ecrivain, Lecteur, PartieDatee } from './succes.js';
import { FUSEAU_DES_JOURS, historiquesDesComptes } from './succes.js';

/** Ce que la fin d'une partie a fait des defis d'un compte. */
export interface DefisDUnCompte {
  /** Ce que l'ecran de fin en dit: les defis releves par cette partie, et leur semaine. */
  readonly fin: DefisDeFin;
  /** L'XP des defis que cet appel a inscrits, a ajouter a la progression. Zero au reessai. */
  readonly xpVersee: number;
}

/** Les defis deja releves par ces comptes cette semaine: l'XP versee, par defi. */
async function relevesDeLaSemaine(
  lecteur: Lecteur,
  compteIds: readonly string[],
  semaine: string,
): Promise<ReadonlyMap<string, Map<string, number>>> {
  const parCompte = new Map<string, Map<string, number>>(compteIds.map((id) => [id, new Map()]));

  if (compteIds.length === 0) {
    return parCompte;
  }

  const lignes = await lecteur
    .select({ compteId: defisReleves.compteId, defi: defisReleves.defi, xp: defisReleves.xp })
    .from(defisReleves)
    .where(and(inArray(defisReleves.compteId, [...compteIds]), eq(defisReleves.semaine, semaine)));

  for (const ligne of lignes) {
    if (estUnDefi(ligne.defi)) {
      parCompte.get(ligne.compteId)?.set(ligne.defi, ligne.xp);
    }
  }

  return parCompte;
}

/** Les defis que cette partie a releves pour ces comptes, dans l'ordre des familles. */
async function relevesParLaPartie(
  lecteur: Lecteur,
  partieId: string,
  compteIds: readonly string[],
  semaine: string,
): Promise<ReadonlyMap<string, readonly DefiReleve[]>> {
  const lignes = await lecteur
    .select({ compteId: defisReleves.compteId, defi: defisReleves.defi, xp: defisReleves.xp })
    .from(defisReleves)
    .where(
      and(eq(defisReleves.partieId, partieId), inArray(defisReleves.compteId, [...compteIds])),
    );
  const ordre = defisDeLaSemaine(semaine);

  return new Map(
    compteIds.map((compteId) => [
      compteId,
      lignes
        .flatMap((ligne) =>
          ligne.compteId === compteId && estUnDefi(ligne.defi)
            ? [{ id: ligne.defi, xp: ligne.xp }]
            : [],
        )
        .sort((a, b) => rang(ordre, a.id) - rang(ordre, b.id)),
    ]),
  );
}

/** La place d'un defi parmi ceux de sa semaine; a la fin s'il n'en est plus. */
function rang(ordre: readonly string[], id: string): number {
  const index = ordre.indexOf(id);
  return index === -1 ? ordre.length : index;
}

/**
 * Releve les defis que cette partie fait atteindre a ses comptes, dans la transaction qui
 * l'enregistre, et dit a chacun ce que la fin doit en annoncer.
 *
 * @param historiques L'historique de chaque compte, qui comprend cette partie.
 * @param inscrire Faux au reessai d'une partie deja enregistree: rien ne s'inscrit, et la
 *                 fin annonce ce que le premier essai avait releve.
 */
export async function releverLesDefis(
  ecrivain: Ecrivain,
  partieId: string,
  historiques: ReadonlyMap<string, readonly PartieDatee[]>,
  inscrire: boolean,
): Promise<ReadonlyMap<string, DefisDUnCompte>> {
  // Tous les comptes d'une partie la finissent a la meme heure: une seule semaine.
  const partie = [...historiques.values()].flat().find((datee) => datee.partieId === partieId);
  const compteIds = [...historiques.keys()];

  if (partie === undefined) {
    return new Map();
  }

  const semaine = semaineDuJour(partie.partie.jour);
  const dejaReleves = await relevesDeLaSemaine(ecrivain, compteIds, semaine);
  const aInscrire: (typeof defisReleves.$inferInsert)[] = [];
  const parties = new Map(
    [...historiques].map(([compteId, historique]) => [
      compteId,
      historique
        .filter((datee) => semaineDuJour(datee.partie.jour) === semaine)
        .map((datee) => datee.partie),
    ]),
  );

  if (inscrire) {
    for (const [compteId, deLaSemaine] of parties) {
      for (const avancement of avancementsDeLaSemaine(
        semaine,
        deLaSemaine,
        dejaReleves.get(compteId) ?? new Map(),
      )) {
        if (!avancement.accompli && avancement.actuel >= avancement.seuil) {
          aInscrire.push({
            compteId,
            semaine,
            defi: avancement.id,
            xp: avancement.xp,
            releveLe: partie.termineeLe,
            partieId,
          });
        }
      }
    }
  }

  // Une partie du meme compte finie en meme temps a pu relever les memes: ils sont
  // ignores, et seule l'XP de ce qui s'est vraiment inscrit est versee.
  const inscrits =
    aInscrire.length === 0
      ? []
      : await ecrivain.insert(defisReleves).values(aInscrire).onConflictDoNothing().returning({
          compteId: defisReleves.compteId,
          defi: defisReleves.defi,
          xp: defisReleves.xp,
        });

  for (const inscrit of inscrits) {
    dejaReleves.get(inscrit.compteId)?.set(inscrit.defi, inscrit.xp);
  }

  const releves = await relevesParLaPartie(ecrivain, partieId, compteIds, semaine);

  return new Map(
    compteIds.map((compteId) => [
      compteId,
      {
        fin: {
          releves: releves.get(compteId) ?? [],
          defis: avancementsDeLaSemaine(
            semaine,
            parties.get(compteId) ?? [],
            dejaReleves.get(compteId) ?? new Map(),
          ),
        },
        xpVersee: inscrits
          .filter((inscrit) => inscrit.compteId === compteId)
          .reduce((total, inscrit) => total + inscrit.xp, 0),
      },
    ]),
  );
}

/**
 * Les defis de la semaine en cours, et ou en est ce compte (etape 3.10).
 *
 * La semaine et sa fin se lisent a l'heure de la base, celle qui date les parties: une
 * partie finie a la derniere seconde d'une semaine compte pour celle que la route montre.
 */
export async function defisDuCompte(lecteur: Lecteur, compteId: string): Promise<DefisDeLaSemaine> {
  const [maintenant] = await lecteur
    .select({
      semaine: sql<string>`to_char(date_trunc('week', now() at time zone ${FUSEAU_DES_JOURS}), 'YYYY-MM-DD')`,
      // Le lundi suivant 0 h a Paris, ecrit en temps universel: « 2026-10-11T22:00:00Z ».
      finLe: sql<string>`to_char(((date_trunc('week', now() at time zone ${FUSEAU_DES_JOURS}) + interval '7 days') at time zone ${FUSEAU_DES_JOURS}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    })
    .from(sql`(select 1) as maintenant`);

  if (maintenant === undefined) {
    throw new Error("La base n'a pas dit quelle semaine court.");
  }

  const { semaine } = maintenant;
  const [historiques, releves] = await Promise.all([
    historiquesDesComptes(lecteur, [compteId], semaine),
    relevesDeLaSemaine(lecteur, [compteId], semaine),
  ]);

  return {
    semaine,
    finLe: new Date(maintenant.finLe).toISOString(),
    defis: avancementsDeLaSemaine(
      semaine,
      (historiques.get(compteId) ?? []).map((datee) => datee.partie),
      releves.get(compteId) ?? new Map(),
    ),
  };
}

/** L'XP que les defis de cette partie ont versee a chaque compte, pour un reessai. */
export async function xpDesDefisDeLaPartie(
  lecteur: Lecteur,
  partieId: string,
): Promise<ReadonlyMap<string, number>> {
  const lignes = await lecteur
    .select({ compteId: defisReleves.compteId, xp: sql<number>`sum(${defisReleves.xp})::int` })
    .from(defisReleves)
    .where(eq(defisReleves.partieId, partieId))
    .groupBy(defisReleves.compteId);

  return new Map(lignes.map((ligne) => [ligne.compteId, ligne.xp]));
}
