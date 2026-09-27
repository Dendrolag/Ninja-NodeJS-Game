/**
 * La mesure de la retention et de ce qui calibre les succes (etape 3.7, decision 7 de
 * l'etude des succes), lue dans les resultats enregistres.
 *
 * SANS PISTEUR, ET EN LECTURE SEULE. Les resultats suffisent: un compte est actif une
 * semaine s'il y a joue une partie, et il est revenu s'il a rejoue sept jours ou plus
 * apres sa premiere partie. Rien ne s'ecrit, rien ne suit les invites.
 *
 * Le releve se fait a la main (`pnpm base:mesurer`), avant la mise en ligne des succes
 * puis un mois apres: docs/mesures/retention.md en garde la procedure et les chiffres.
 * Il dit aussi ce qu'une partie et un compte font d'ordinaire, pour recalibrer un jour
 * les seuils des succes sur des donnees assez nombreuses.
 */

import { JOUEURS_POUR_UNE_VICTOIRE } from '@neon-ninja/shared';
import { eq, sql } from 'drizzle-orm';

import type { BaseDeDonnees } from './connexion.js';
import { parties, resultats } from './schema.js';

/** Ce qui execute une lecture: la base, ou une transaction ouverte sur elle. */
type Lecteur = Pick<BaseDeDonnees, 'select'>;

/**
 * Le fuseau des semaines: celui des joueurs. Ecrit en toutes lettres dans la requete,
 * et non passe en parametre: une semaine regroupee doit etre la meme expression dans la
 * selection et dans le regroupement, ce que deux parametres distincts ne sont pas.
 */
const FUSEAU = sql.raw("'Europe/Paris'");

/** Le delai apres la premiere partie a partir duquel un compte qui rejoue est revenu. */
const JOURS_AVANT_LE_RETOUR = 7;

/** Les comptes qui ont joue une semaine, qui commence le lundi. */
export interface SemaineActive {
  /** Le lundi, a l'heure de Paris: « 2026-09-21 ». */
  readonly semaine: string;
  readonly comptes: number;
}

/** Les comptes dont la premiere partie tombe une semaine, et ceux d'entre eux revenus. */
export interface Cohorte {
  readonly semaine: string;
  readonly comptes: number;
  /** Ceux qui ont rejoue sept jours ou plus apres leur premiere partie. */
  readonly revenus: number;
}

/** La repartition d'un nombre. */
export interface Repartition {
  readonly moyenne: number;
  readonly mediane: number;
  /** Neuf sur dix sont en dessous. */
  readonly neuvieme: number;
  readonly maximum: number;
}

/** Un releve complet. */
export interface ReleveDeRetention {
  readonly comptesActifsParSemaine: readonly SemaineActive[];
  /**
   * Seulement les cohortes dont la premiere partie date de sept jours ou plus: les plus
   * recentes n'ont pas encore eu le temps de revenir.
   */
  readonly cohortes: readonly Cohorte[];
  readonly calibration: {
    readonly resultats: number;
    readonly prisesParPartie: Repartition;
    readonly blackNinjasParPartie: Repartition;
    readonly victoiresParCompte: Repartition;
    readonly partiesParCompteEtParSemaine: Repartition;
  };
}

/** Le lundi de la semaine d'une date, a l'heure de Paris. */
const semaineDe = (colonne: typeof parties.termineeLe) =>
  sql<string>`to_char(date_trunc('week', ${colonne} at time zone ${FUSEAU}), 'YYYY-MM-DD')`;

/** Lit le releve dans la base. */
export async function releverLaRetention(lecteur: Lecteur): Promise<ReleveDeRetention> {
  const semaine = semaineDe(parties.termineeLe);
  const [actifs, cohortes, calibration] = await Promise.all([
    lecteur
      .select({ semaine, comptes: sql<number>`count(distinct ${resultats.compteId})::int` })
      .from(resultats)
      .innerJoin(parties, eq(resultats.partieId, parties.id))
      .groupBy(semaine)
      .orderBy(semaine),
    lireLesCohortes(lecteur),
    lireLaCalibration(lecteur),
  ]);

  return { comptesActifsParSemaine: actifs, cohortes, calibration };
}

/** Les cohortes par semaine de premiere partie. */
async function lireLesCohortes(lecteur: Lecteur): Promise<Cohorte[]> {
  const parCompte = lecteur
    .select({
      compteId: resultats.compteId,
      premiere: sql<Date>`min(${parties.termineeLe})`.as('premiere'),
      derniere: sql<Date>`max(${parties.termineeLe})`.as('derniere'),
    })
    .from(resultats)
    .innerJoin(parties, eq(resultats.partieId, parties.id))
    .groupBy(resultats.compteId)
    .as('par_compte');
  const semaine = sql<string>`to_char(date_trunc('week', ${parCompte.premiere} at time zone ${FUSEAU}), 'YYYY-MM-DD')`;
  const delai = sql.raw(`make_interval(days => ${String(JOURS_AVANT_LE_RETOUR)})`);

  return lecteur
    .select({
      semaine,
      comptes: sql<number>`count(*)::int`,
      revenus: sql<number>`(count(*) filter (where ${parCompte.derniere} >= ${parCompte.premiere} + ${delai}))::int`,
    })
    .from(parCompte)
    .where(sql`${parCompte.premiere} <= now() - ${delai}`)
    .groupBy(semaine)
    .orderBy(semaine);
}

/** Les colonnes d'une repartition, sur une expression. */
function repartitionDe(expression: ReturnType<typeof sql>) {
  return {
    moyenne: sql<number>`coalesce(avg(${expression}), 0)::float`,
    mediane: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${expression}), 0)::float`,
    neuvieme: sql<number>`coalesce(percentile_cont(0.9) within group (order by ${expression}), 0)::float`,
    maximum: sql<number>`coalesce(max(${expression}), 0)::int`,
  };
}

/** Ce qu'une partie et un compte font d'ordinaire. */
async function lireLaCalibration(lecteur: Lecteur): Promise<ReleveDeRetention['calibration']> {
  const victoire = sql`${resultats.placement} = 1 and ${parties.nombreJoueurs} >= ${JOUEURS_POUR_UNE_VICTOIRE}`;
  const parCompte = lecteur
    .select({ victoires: sql<number>`count(*) filter (where ${victoire})`.as('victoires') })
    .from(resultats)
    .innerJoin(parties, eq(resultats.partieId, parties.id))
    .groupBy(resultats.compteId)
    .as('par_compte');
  const semaine = semaineDe(parties.termineeLe);
  const parSemaine = lecteur
    .select({ nombre: sql<number>`count(*)`.as('nombre') })
    .from(resultats)
    .innerJoin(parties, eq(resultats.partieId, parties.id))
    .groupBy(resultats.compteId, semaine)
    .as('par_semaine');

  const [[parPartie], [victoires], [cadence]] = await Promise.all([
    lecteur
      .select({
        resultats: sql<number>`count(*)::int`,
        prises: repartitionDe(sql`${resultats.captures}`),
        blackNinjas: repartitionDe(sql`${resultats.botsNoirsDetruits}`),
      })
      .from(resultats),
    lecteur.select(repartitionDe(sql`${parCompte.victoires}`)).from(parCompte),
    lecteur.select(repartitionDe(sql`${parSemaine.nombre}`)).from(parSemaine),
  ]);
  const vide: Repartition = { moyenne: 0, mediane: 0, neuvieme: 0, maximum: 0 };

  return {
    resultats: parPartie?.resultats ?? 0,
    prisesParPartie: parPartie?.prises ?? vide,
    blackNinjasParPartie: parPartie?.blackNinjas ?? vide,
    victoiresParCompte: victoires ?? vide,
    partiesParCompteEtParSemaine: cadence ?? vide,
  };
}

/** Un nombre a la francaise, une decimale au plus. */
const FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Une repartition, en une ligne. */
function ligneDeRepartition(libelle: string, repartition: Repartition): string {
  return `  ${libelle}: moyenne ${FORMAT.format(repartition.moyenne)}, mediane ${FORMAT.format(repartition.mediane)}, 9 sur 10 sous ${FORMAT.format(repartition.neuvieme)}, maximum ${FORMAT.format(repartition.maximum)}`;
}

/** Une part, en pour cent entier, ou un tiret sans effectif. */
function part(nombre: number, total: number): string {
  return total === 0 ? '-' : `${String(Math.round((nombre * 100) / total))} %`;
}

/**
 * Le releve, en texte a recopier dans docs/mesures/retention.md.
 *
 * @param jour Le jour du releve, que la commande lit sur l'horloge: cette fonction ne la
 *             lit pas.
 */
export function rapportDeRetention(releve: ReleveDeRetention, jour: string): string {
  const comptes = releve.cohortes.reduce((somme, cohorte) => somme + cohorte.comptes, 0);
  const revenus = releve.cohortes.reduce((somme, cohorte) => somme + cohorte.revenus, 0);
  const { calibration } = releve;

  return [
    `Releve du ${jour}`,
    '',
    'Comptes actifs par semaine (du lundi, heure de Paris)',
    ...(releve.comptesActifsParSemaine.length === 0
      ? ['  aucune partie enregistree']
      : releve.comptesActifsParSemaine.map(
          (ligne) => `  ${ligne.semaine}: ${String(ligne.comptes)}`,
        )),
    '',
    `Revenus ${String(JOURS_AVANT_LE_RETOUR)} jours ou plus apres leur premiere partie, par semaine de premiere partie`,
    ...(releve.cohortes.length === 0
      ? ['  aucune cohorte assez ancienne']
      : releve.cohortes.map(
          (cohorte) =>
            `  ${cohorte.semaine}: ${String(cohorte.revenus)} sur ${String(cohorte.comptes)} (${part(cohorte.revenus, cohorte.comptes)})`,
        )),
    `  ensemble: ${String(revenus)} sur ${String(comptes)} (${part(revenus, comptes)})`,
    '',
    `Calibration des seuils, sur ${String(calibration.resultats)} resultats`,
    ligneDeRepartition('Prises par partie', calibration.prisesParPartie),
    ligneDeRepartition('Black Ninjas detruits par partie', calibration.blackNinjasParPartie),
    ligneDeRepartition('Victoires par compte', calibration.victoiresParCompte),
    ligneDeRepartition(
      'Parties par compte et par semaine active',
      calibration.partiesParCompteEtParSemaine,
    ),
    '',
  ].join('\n');
}
