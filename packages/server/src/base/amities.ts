/**
 * Les amities en base (etape 3.6): lire ce qui lie deux comptes, appliquer un geste,
 * lire la liste d'un compte, et les parties jouees ensemble.
 *
 * CE FICHIER NE DECIDE RIEN. Les regles sont dans comptes/amities.ts, en fonctions
 * pures: ce fichier lit les faits qu'elles demandent, et ecrit ce qu'elles decident.
 *
 * UN GESTE EST UNE TRANSACTION QUI VERROUILLE LES DEUX COMPTES, dans l'ordre de leurs
 * identifiants, comme la fin de partie verrouille ses progressions: deux gestes qui
 * touchent un meme compte passent l'un apres l'autre. Deux demandes croisees au meme
 * instant font donc une amitie, et non deux demandes; deux acceptations simultanees ne
 * font pas passer un compte au-dela de deux cents amis. Le verrou est « sans cle »
 * (for no key update): il n'arrete pas l'enregistrement d'une partie, qui ne fait que
 * referencer le compte.
 *
 * UNE AMITIE SE RANGE DANS UN ORDRE FIXE, le plus petit identifiant d'abord. L'ordre est
 * celui de la base (least, greatest), et non celui de JavaScript, pour que les deux ne
 * puissent jamais diverger.
 */

import type { FaceAFace } from '@neon-ninja/shared';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { DecisionDAmitie, EcritureDAmitie, FaitsDAmitie } from '../comptes/amities.js';
import { faitsApres } from '../comptes/amities.js';
import type { BaseDeDonnees } from './connexion.js';
import { amities, blocages, comptes, demandesDAmi, progressions, resultats } from './schema.js';

/** Une transaction ouverte sur la base. */
type Transaction = Parameters<Parameters<BaseDeDonnees['transaction']>[0]>[0];

/** Ce qui execute une lecture: la base, ou une transaction ouverte sur elle. */
type Lecteur = Pick<BaseDeDonnees, 'select'>;

/** Un compte d'une liste d'amis, tel que la base le lit. Le niveau se deduit de l'XP. */
export interface PersonneEnregistree {
  readonly pseudo: string;
  readonly xpTotale: number;
}

/** Les amities d'un compte, telles que la base les lit. */
export interface AmitiesEnregistrees {
  readonly amis: readonly PersonneEnregistree[];
  readonly recues: readonly PersonneEnregistree[];
  readonly envoyees: readonly PersonneEnregistree[];
  readonly bloques: readonly PersonneEnregistree[];
}

/** Un geste applique: la decision prise, et les faits qui en resultent. */
export interface GesteApplique {
  readonly decision: DecisionDAmitie;
  /** Les faits apres le geste; ceux d'avant s'il a ete refuse. */
  readonly faits: FaitsDAmitie;
}

/**
 * Ce qui lie ces deux comptes, vu du premier, en une seule requete.
 *
 * Hors transaction, pour la fiche: ce qu'elle montre peut changer l'instant d'apres,
 * comme tout ce qu'elle montre.
 */
export async function faitsEntre(
  lecteur: Lecteur,
  moi: string,
  lui: string,
): Promise<FaitsDAmitie> {
  const [ligne] = await lecteur
    .select({
      amis: sql<boolean>`exists (select 1 from ${amities} where ${amities.compteA} = least(${moi}::uuid, ${lui}::uuid) and ${amities.compteB} = greatest(${moi}::uuid, ${lui}::uuid))`,
      demandeEnvoyee: demandeExiste(moi, lui),
      demandeRecue: demandeExiste(lui, moi),
      jeBloque: blocageExiste(moi, lui),
      ilMeBloque: blocageExiste(lui, moi),
      mesAmis: nombreDAmis(moi),
      sesAmis: nombreDAmis(lui),
      mesDemandesEnAttente: sql<number>`(select count(*)::int from ${demandesDAmi} where ${demandesDAmi.de} = ${moi}::uuid)`,
    })
    .from(comptes)
    .where(eq(comptes.id, moi));

  if (ligne === undefined) {
    throw new Error(`Le compte ${moi} n'existe pas.`);
  }

  return { soi: moi === lui, ...ligne };
}

/**
 * Applique un geste de moi sur lui: verrouille les deux comptes, lit leurs faits,
 * demande la decision, et fait ses ecritures, en une seule transaction.
 *
 * @param decider Les regles, qui recoivent les faits lus sous le verrou.
 */
export async function appliquerGeste(
  db: BaseDeDonnees,
  moi: string,
  lui: string,
  decider: (faits: FaitsDAmitie) => DecisionDAmitie,
): Promise<GesteApplique> {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: comptes.id })
      .from(comptes)
      .where(inArray(comptes.id, [...new Set([moi, lui])]))
      .orderBy(comptes.id)
      .for('no key update');

    const faits = await faitsEntre(transaction, moi, lui);
    const decision = decider(faits);

    if (!decision.permis) {
      return { decision, faits };
    }

    for (const ecriture of decision.ecritures) {
      await ecrire(transaction, ecriture, moi, lui);
    }

    return { decision, faits: faitsApres(faits, decision.ecritures) };
  });
}

/**
 * Les amities de ce compte, chaque liste triee par pseudo, quelle que soit sa casse.
 *
 * Les demandes recues d'un compte qu'il bloque n'y sont pas: elles sont ignorees.
 */
export async function amitiesDuCompte(
  db: BaseDeDonnees,
  compteId: string,
): Promise<AmitiesEnregistrees> {
  const [amis, recues, envoyees, bloques] = await Promise.all([
    personnes(
      db,
      sql`case when ${amities.compteA} = ${compteId}::uuid then ${amities.compteB} else ${amities.compteA} end`,
      amities,
      or(eq(amities.compteA, compteId), eq(amities.compteB, compteId)),
    ),
    personnes(
      db,
      demandesDAmi.de,
      demandesDAmi,
      and(
        eq(demandesDAmi.pour, compteId),
        sql`not exists (select 1 from ${blocages} where ${blocages.bloqueur} = ${compteId}::uuid and ${blocages.bloque} = ${demandesDAmi.de})`,
      ),
    ),
    personnes(db, demandesDAmi.pour, demandesDAmi, eq(demandesDAmi.de, compteId)),
    personnes(db, blocages.bloque, blocages, eq(blocages.bloqueur, compteId)),
  ]);

  return { amis, recues, envoyees, bloques };
}

/**
 * Les parties que ces deux comptes ont jouees ensemble, et qui a fini devant l'autre,
 * vues du premier. Les egalites ne comptent ni d'un cote ni de l'autre.
 */
export async function faceAFace(db: BaseDeDonnees, moi: string, lui: string): Promise<FaceAFace> {
  const autre = alias(resultats, 'autre');
  const [ligne] = await db
    .select({
      partiesEnsemble: sql<number>`count(*)::int`,
      devant: sql<number>`(count(*) filter (where ${resultats.placement} < ${autre.placement}))::int`,
      derriere: sql<number>`(count(*) filter (where ${resultats.placement} > ${autre.placement}))::int`,
    })
    .from(resultats)
    .innerJoin(autre, eq(autre.partieId, resultats.partieId))
    .where(and(eq(resultats.compteId, moi), eq(autre.compteId, lui)));

  return ligne ?? { partiesEnsemble: 0, devant: 0, derriere: 0 };
}

// --------------------------------------------------------------------------
// Briques
// --------------------------------------------------------------------------

/** Une demande de ce compte a celui-la attend-elle. */
function demandeExiste(de: string, pour: string) {
  return sql<boolean>`exists (select 1 from ${demandesDAmi} where ${demandesDAmi.de} = ${de}::uuid and ${demandesDAmi.pour} = ${pour}::uuid)`;
}

/** Ce compte bloque-t-il celui-la. */
function blocageExiste(bloqueur: string, bloque: string) {
  return sql<boolean>`exists (select 1 from ${blocages} where ${blocages.bloqueur} = ${bloqueur}::uuid and ${blocages.bloque} = ${bloque}::uuid)`;
}

/** Le nombre d'amis de ce compte, dans les deux colonnes. */
function nombreDAmis(compteId: string) {
  return sql<number>`(select count(*)::int from ${amities} where ${amities.compteA} = ${compteId}::uuid or ${amities.compteB} = ${compteId}::uuid)`;
}

/**
 * Les comptes designes par cette colonne dans les lignes de cette table qui
 * satisfont cette condition, avec leur XP, tries par pseudo.
 */
async function personnes(
  db: BaseDeDonnees,
  colonne: Parameters<typeof eq>[0],
  table: typeof amities | typeof demandesDAmi | typeof blocages,
  condition: ReturnType<typeof and>,
): Promise<PersonneEnregistree[]> {
  return db
    .select({ pseudo: comptes.pseudo, xpTotale: progressions.xpTotale })
    .from(table)
    .innerJoin(comptes, eq(comptes.id, colonne))
    .innerJoin(progressions, eq(progressions.compteId, comptes.id))
    .where(condition)
    .orderBy(asc(comptes.reperePseudo));
}

/** Fait une ecriture decidee par les regles, entre moi et lui. */
async function ecrire(
  transaction: Transaction,
  ecriture: EcritureDAmitie,
  moi: string,
  lui: string,
): Promise<void> {
  switch (ecriture) {
    case 'creerAmitie':
      await transaction
        .insert(amities)
        .values({
          compteA: sql`least(${moi}::uuid, ${lui}::uuid)`,
          compteB: sql`greatest(${moi}::uuid, ${lui}::uuid)`,
        })
        .onConflictDoNothing();
      return;

    case 'supprimerAmitie':
      await transaction
        .delete(amities)
        .where(
          and(
            eq(amities.compteA, sql`least(${moi}::uuid, ${lui}::uuid)`),
            eq(amities.compteB, sql`greatest(${moi}::uuid, ${lui}::uuid)`),
          ),
        );
      return;

    case 'creerDemandeEnvoyee':
      await transaction.insert(demandesDAmi).values({ de: moi, pour: lui }).onConflictDoNothing();
      return;

    case 'supprimerDemandeEnvoyee':
      await supprimerDemande(transaction, moi, lui);
      return;

    case 'supprimerDemandeRecue':
      await supprimerDemande(transaction, lui, moi);
      return;

    case 'creerBlocage':
      await transaction
        .insert(blocages)
        .values({ bloqueur: moi, bloque: lui })
        .onConflictDoNothing();
      return;

    case 'supprimerBlocage':
      await transaction
        .delete(blocages)
        .where(and(eq(blocages.bloqueur, moi), eq(blocages.bloque, lui)));
      return;
  }
}

/** Efface la demande de ce compte a celui-la, s'il y en a une. */
async function supprimerDemande(transaction: Transaction, de: string, pour: string): Promise<void> {
  await transaction
    .delete(demandesDAmi)
    .where(and(eq(demandesDAmi.de, de), eq(demandesDAmi.pour, pour)));
}
