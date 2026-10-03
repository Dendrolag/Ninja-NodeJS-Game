/**
 * Les parties jouees: enregistrer une partie, ses resultats et les gains de ses
 * comptes; relire l'historique d'un compte.
 *
 * TOUT S'ECRIT ENSEMBLE, OU RIEN. Une seule transaction pour la partie, le resultat
 * de chaque compte, les faits releves pendant la partie (etape 3.8), l'ajout de ses
 * gains a sa progression, depuis l'etape 3.10 les defis de la semaine qu'il releve et
 * leur XP (base/defis.ts) et, depuis l'etape 3.7, les succes qu'il a atteints
 * (base/succes.ts): si l'un est refuse, rien n'est ecrit. Une partie a moitie
 * enregistree fausserait les statistiques du profil, et un gain applique sans son
 * resultat ne s'expliquerait plus.
 *
 * LES DEFIS AVANT LES SUCCES. L'XP d'un defi compte dans l'XP totale des succes de
 * niveau: les succes se plient sur l'historique qui la porte deja.
 *
 * LES GAINS S'AJOUTENT, ILS NE REMPLACENT PAS (etape 3.3). La progression de chaque
 * compte est verrouillee, lue, puis augmentee dans la meme transaction. Deux parties
 * qui se terminent en meme temps pour un meme compte (deux onglets) s'appliquent
 * donc l'une apres l'autre, sans que la seconde efface la premiere, ce que ferait
 * ecrireProgression, qui remplace les valeurs. Les verrous sont pris dans l'ordre
 * des identifiants de compte: deux enregistrements qui partagent des comptes ne
 * peuvent pas s'attendre mutuellement.
 *
 * LES POINTS DE LIGUE NE DESCENDENT JAMAIS SOUS ZERO. Une perte plus grande que le
 * solde est reduite a ce solde, et c'est la variation reduite qui s'enregistre dans
 * le resultat: l'historique dit ce qui a ete applique, pas ce qui avait ete demande.
 *
 * Tout refus ici vient d'une faute du code serveur (un compte qui n'existe pas,
 * un gain negatif, deux resultats pour le meme compte): il leve une erreur.
 * Aucun joueur n'enregistre une partie lui-meme.
 */

import type {
  CarteEnregistree,
  DefisDeFin,
  FaitsDePartie,
  Mode,
  SuccesDeFin,
} from '@neon-ninja/shared';
import { JOUEURS_POUR_UNE_VICTOIRE } from '@neon-ninja/shared';
import { desc, eq, inArray, sql } from 'drizzle-orm';

import { succesDeFin } from '../comptes/succes.js';
import type { BaseDeDonnees } from './connexion.js';
import { releverLesDefis, xpDesDefisDeLaPartie } from './defis.js';
import type { ValeursProgression } from './progression.js';
import { faitsDePartie, parties, progressions, resultats } from './schema.js';
import type { PartieDatee } from './succes.js';
import { attribuerLesSucces, historiquesDesComptes } from './succes.js';

/** Une transaction ouverte sur la base. */
type Transaction = Parameters<Parameters<BaseDeDonnees['transaction']>[0]>[0];

/** Une partie qui vient de se terminer. */
export interface NouvellePartie {
  /**
   * L'identifiant de la partie. Absent: la base en tire un.
   *
   * Le serveur de jeu le tire avant son premier essai d'enregistrement: une partie
   * deja enregistree sous cet identifiant ne s'enregistre pas une seconde fois
   * (recette de l'etape 5.4).
   */
  readonly id?: string;
  readonly mode: Mode;
  readonly carte: CarteEnregistree;
  readonly modeMiroir: boolean;
  readonly dureeS: number;
  /** Tous les joueurs, avec ou sans compte, abandons compris. */
  readonly nombreJoueurs: number;
  /**
   * L'heure de fin. Absente: l'heure de la base au moment de l'enregistrement.
   *
   * Le serveur de jeu la laisse absente: son horloge mesure des ecarts, pas des
   * dates (voir horloge.ts), et l'enregistrement suit la fin de quelques
   * millisecondes.
   */
  readonly termineeLe?: Date;
}

/** Ce qu'un compte a fait dans cette partie, et ce qu'il y gagne. */
export interface NouveauResultat {
  readonly compteId: string;
  /** 1 pour le premier. Au plus le nombre de joueurs de la partie. */
  readonly placement: number;
  readonly points: number;
  readonly captures: number;
  readonly botsNoirsDetruits: number;
  readonly xpGagnee: number;
  readonly piecesGagnees: number;
  /**
   * La variation demandee, signee. Une perte plus grande que le solde du compte
   * est reduite a ce solde; c'est la variation reduite qui s'enregistre.
   */
  readonly variationPointsLigue: number;
}

/**
 * Les faits de partie de chaque compte present a la fin, par identifiant de compte
 * (etape 3.8). Un compte qui n'y figure pas n'a aucun fait.
 */
export type FaitsDesComptes = ReadonlyMap<string, FaitsDePartie>;

/** L'evolution de la progression d'un compte, telle que l'enregistrement l'a appliquee. */
export interface ProgressionAppliquee {
  readonly compteId: string;
  /** La progression lue, verrouillee, juste avant l'ajout des gains. */
  readonly avant: ValeursProgression;
  /**
   * La progression rendue par la base apres l'ajout des gains, XP des defis comprise
   * (etape 3.10).
   */
  readonly apres: ValeursProgression;
  /** Les succes que la partie a donnes au compte, et le plus proche (etape 3.7). */
  readonly succes: SuccesDeFin;
  /** Les defis que la partie a releves pour le compte, et ceux de sa semaine (etape 3.10). */
  readonly defis: DefisDeFin;
}

/** L'evolution de la progression d'un compte, avant ses defis et ses succes. */
type GainsAppliques = Omit<ProgressionAppliquee, 'succes' | 'defis'>;

/** Une partie enregistree, et ce que ses comptes y ont gagne. */
export interface PartieEnregistree {
  readonly partieId: string;
  /** Une par resultat, dans l'ordre des resultats recus. */
  readonly progressions: readonly ProgressionAppliquee[];
}

/** Une ligne de l'historique d'un compte: sa partie, et son resultat dans celle-ci. */
export interface ResultatDePartie
  extends Omit<NouvellePartie, 'id' | 'termineeLe'>, Omit<NouveauResultat, 'compteId'> {
  readonly partieId: string;
  readonly termineeLe: Date;
}

/**
 * Enregistre une partie terminee, les resultats de ses joueurs qui ont un compte et
 * leurs faits de partie, et ajoute leurs gains a leur progression.
 *
 * @param faits Les faits de partie des comptes presents a la fin. Un fait n'existe
 *              qu'avec le resultat de son compte: la base refuse l'un sans l'autre.
 * @returns L'identifiant de la partie, et l'evolution de la progression de chaque
 *          compte.
 */
export async function enregistrerPartie(
  db: BaseDeDonnees,
  partie: NouvellePartie,
  lignes: readonly NouveauResultat[],
  faits: FaitsDesComptes = new Map(),
): Promise<PartieEnregistree> {
  // Seule regle que la base ne peut pas verifier seule: elle relie deux tables.
  for (const ligne of lignes) {
    if (ligne.placement > partie.nombreJoueurs) {
      throw new Error(
        `Placement ${ligne.placement} impossible dans une partie de ${partie.nombreJoueurs} joueurs.`,
      );
    }
  }

  return db.transaction(async (transaction) => {
    // Une partie deja enregistree sous cet identifiant ne s'ecrit pas deux fois: c'est
    // le serveur qui retente une fin de partie dont un essai avait abouti sans que sa
    // reponse arrive. Ce que cet essai a applique est relu, et rien n'est ajoute.
    const [enregistree] = await transaction
      .insert(parties)
      .values({ ...partie, termineeLe: partie.termineeLe ?? sql`now()` })
      .onConflictDoNothing({ target: parties.id })
      .returning({ id: parties.id });

    if (enregistree === undefined) {
      if (partie.id === undefined) {
        throw new Error("La base n'a rendu aucune ligne pour la partie enregistree.");
      }

      return {
        partieId: partie.id,
        progressions: await avecLesDefisEtLesSucces(
          transaction,
          partie.id,
          await progressionsDejaAppliquees(transaction, partie.id, lignes),
          false,
        ),
      };
    }

    if (lignes.length === 0) {
      return { partieId: enregistree.id, progressions: [] };
    }

    const avants = await verrouillerLesProgressions(
      transaction,
      lignes.map((ligne) => ligne.compteId),
    );
    const appliquees = lignes.map((ligne) => ({ ligne, avant: progressionDe(avants, ligne) }));

    // Les resultats d'abord: c'est la que la base refuse un gain negatif ou un
    // doublon, avec la contrainte qui le dit.
    await transaction.insert(resultats).values(
      appliquees.map(({ ligne, avant }) => ({
        ...ligne,
        variationPointsLigue: variationAppliquee(ligne, avant),
        partieId: enregistree.id,
      })),
    );

    // Les faits ensuite, avant l'attribution des succes, qui les lit avec l'historique.
    const lignesDeFaits = lignesDesFaits(enregistree.id, faits);

    if (lignesDeFaits.length > 0) {
      await transaction.insert(faitsDePartie).values(lignesDeFaits);
    }

    const progressionsAppliquees: GainsAppliques[] = [];

    for (const { ligne, avant } of appliquees) {
      progressionsAppliquees.push({
        compteId: ligne.compteId,
        avant,
        apres: await ajouterLesGains(transaction, ligne, variationAppliquee(ligne, avant)),
      });
    }

    return {
      partieId: enregistree.id,
      progressions: await avecLesDefisEtLesSucces(
        transaction,
        enregistree.id,
        progressionsAppliquees,
        true,
      ),
    };
  });
}

/**
 * Releve les defis puis attribue les succes des comptes de la partie, dans la
 * transaction qui l'enregistre, et joint a chaque progression ce que la partie leur a
 * donne (etapes 3.7 et 3.10).
 *
 * L'historique se lit une fois. L'XP des defis que la partie releve s'ajoute a la
 * progression, puis a la partie dans l'historique, avant le pli des succes.
 *
 * Au reessai d'une partie deja enregistree, rien ne s'inscrit de plus: les defis et les
 * succes annonces sont relus par leur partie d'origine, et ce sont les memes.
 *
 * @param inscrire Faux au reessai.
 */
async function avecLesDefisEtLesSucces(
  transaction: Transaction,
  partieId: string,
  gains: readonly GainsAppliques[],
  inscrire: boolean,
): Promise<ProgressionAppliquee[]> {
  const compteIds = gains.map((appliquee) => appliquee.compteId);
  const historiques = await historiquesDesComptes(transaction, compteIds);
  const defis = await releverLesDefis(transaction, partieId, historiques, inscrire);
  const avecLeursDefis: (GainsAppliques & { readonly defis: DefisDeFin })[] = [];

  for (const appliquee of gains) {
    const sesDefis = defis.get(appliquee.compteId);

    if (sesDefis === undefined) {
      throw new Error(`Aucun defi releve pour le compte ${appliquee.compteId}.`);
    }

    avecLeursDefis.push({
      ...appliquee,
      apres:
        sesDefis.xpVersee === 0
          ? appliquee.apres
          : await verserLXpDesDefis(transaction, appliquee.compteId, sesDefis.xpVersee),
      defis: sesDefis.fin,
    });
  }

  const attribues = await attribuerLesSucces(
    transaction,
    compteIds,
    avecLXpDesDefis(historiques, partieId, defis),
  );

  return avecLeursDefis.map((appliquee) => {
    const compte = attribues.get(appliquee.compteId);

    if (compte === undefined) {
      throw new Error(`Aucun succes attribue au compte ${appliquee.compteId}.`);
    }

    return { ...appliquee, succes: succesDeFin(partieId, compte.mesures, compte.succes) };
  });
}

/**
 * L'historique, ou la partie qui vient de se jouer porte l'XP des defis qu'elle a
 * releves. Au reessai, la lecture la portait deja: la valeur est la meme.
 */
function avecLXpDesDefis(
  historiques: ReadonlyMap<string, readonly PartieDatee[]>,
  partieId: string,
  defis: ReadonlyMap<string, { readonly fin: DefisDeFin }>,
): ReadonlyMap<string, readonly PartieDatee[]> {
  return new Map(
    [...historiques].map(([compteId, historique]) => {
      const xp = (defis.get(compteId)?.fin.releves ?? []).reduce(
        (total, releve) => total + releve.xp,
        0,
      );

      return [
        compteId,
        historique.map((datee) =>
          datee.partieId !== partieId || xp === 0
            ? datee
            : { ...datee, partie: { ...datee.partie, xpDesDefis: xp } },
        ),
      ];
    }),
  );
}

/** Ajoute l'XP des defis releves a la progression d'un compte, deja verrouillee. */
async function verserLXpDesDefis(
  transaction: Transaction,
  compteId: string,
  xp: number,
): Promise<ValeursProgression> {
  const [apres] = await transaction
    .update(progressions)
    .set({ xpTotale: sql`${progressions.xpTotale} + ${xp}`, misAJourLe: sql`now()` })
    .where(eq(progressions.compteId, compteId))
    .returning({
      xpTotale: progressions.xpTotale,
      pieces: progressions.pieces,
      pointsLigue: progressions.pointsLigue,
    });

  if (apres === undefined) {
    throw new Error(`La base n'a rendu aucune progression pour le compte ${compteId}.`);
  }

  return apres;
}

/**
 * Verrouille et lit la progression de ces comptes, jusqu'a la fin de la transaction.
 *
 * Dans l'ordre des identifiants: deux transactions qui verrouillent des comptes
 * communs les prennent dans le meme ordre, et ne peuvent donc pas s'interbloquer.
 */
async function verrouillerLesProgressions(
  transaction: Transaction,
  compteIds: readonly string[],
): Promise<ReadonlyMap<string, ValeursProgression>> {
  const lignes = await transaction
    .select({
      compteId: progressions.compteId,
      xpTotale: progressions.xpTotale,
      pieces: progressions.pieces,
      pointsLigue: progressions.pointsLigue,
    })
    .from(progressions)
    .where(inArray(progressions.compteId, [...new Set(compteIds)]))
    .orderBy(progressions.compteId)
    .for('update');

  return new Map(lignes.map(({ compteId, ...valeurs }) => [compteId, valeurs] as const));
}

/** La progression verrouillee du compte de ce resultat, ou une erreur s'il n'existe pas. */
function progressionDe(
  avants: ReadonlyMap<string, ValeursProgression>,
  ligne: NouveauResultat,
): ValeursProgression {
  const avant = avants.get(ligne.compteId);

  if (avant === undefined) {
    throw new Error(`Aucun resultat a enregistrer: le compte ${ligne.compteId} n'existe pas.`);
  }

  return avant;
}

/**
 * Ce qu'un enregistrement precedent de cette partie a applique a chacun de ses comptes.
 *
 * L'apres est la progression d'aujourd'hui; l'avant s'en deduit en retirant les gains
 * ecrits dans le resultat, et l'XP des defis que la partie a releves (etape 3.10). C'est exact tant qu'aucune autre partie de ces comptes ne
 * s'est enregistree entre les deux essais, qui ne sont separes que de quelques secondes.
 */
async function progressionsDejaAppliquees(
  transaction: Transaction,
  partieId: string,
  lignes: readonly NouveauResultat[],
): Promise<readonly GainsAppliques[]> {
  if (lignes.length === 0) {
    return [];
  }

  const enregistres = await transaction
    .select({
      compteId: resultats.compteId,
      xpGagnee: resultats.xpGagnee,
      piecesGagnees: resultats.piecesGagnees,
      variationPointsLigue: resultats.variationPointsLigue,
    })
    .from(resultats)
    .where(eq(resultats.partieId, partieId));
  const gains = new Map(enregistres.map(({ compteId, ...gain }) => [compteId, gain] as const));
  const xpDesDefis = await xpDesDefisDeLaPartie(transaction, partieId);
  const actuelles = await verrouillerLesProgressions(
    transaction,
    lignes.map((ligne) => ligne.compteId),
  );

  return lignes.map((ligne) => {
    const gain = gains.get(ligne.compteId);
    const apres = progressionDe(actuelles, ligne);

    if (gain === undefined) {
      throw new Error(
        `La partie ${partieId} est deja enregistree, sans resultat pour le compte ${ligne.compteId}.`,
      );
    }

    return {
      compteId: ligne.compteId,
      avant: {
        xpTotale: apres.xpTotale - gain.xpGagnee - (xpDesDefis.get(ligne.compteId) ?? 0),
        pieces: apres.pieces - gain.piecesGagnees,
        pointsLigue: apres.pointsLigue - gain.variationPointsLigue,
      },
      apres,
    };
  });
}

/** Les lignes de la table des faits: une par fait non nul de chaque compte. */
function lignesDesFaits(
  partieId: string,
  faits: FaitsDesComptes,
): (typeof faitsDePartie.$inferInsert)[] {
  return [...faits].flatMap(([compteId, sesFaits]) =>
    Object.entries(sesFaits).flatMap(([fait, valeur]) =>
      valeur === undefined || valeur === 0 ? [] : [{ partieId, compteId, fait, valeur }],
    ),
  );
}

/** La variation de points de ligue reellement applicable: jamais sous zero. */
function variationAppliquee(ligne: NouveauResultat, avant: ValeursProgression): number {
  return Math.max(ligne.variationPointsLigue, -avant.pointsLigue);
}

/**
 * Ajoute les gains d'un resultat a la progression de son compte.
 *
 * L'ajout est ecrit par la base elle-meme (valeur + gain), pas recalcule par le
 * serveur: meme verrouillee, la ligne n'a pas a etre reecrite de memoire.
 */
async function ajouterLesGains(
  transaction: Transaction,
  ligne: NouveauResultat,
  variationPointsLigue: number,
): Promise<ValeursProgression> {
  const [apres] = await transaction
    .update(progressions)
    .set({
      xpTotale: sql`${progressions.xpTotale} + ${ligne.xpGagnee}`,
      pieces: sql`${progressions.pieces} + ${ligne.piecesGagnees}`,
      pointsLigue: sql`${progressions.pointsLigue} + ${variationPointsLigue}`,
      misAJourLe: sql`now()`,
    })
    .where(eq(progressions.compteId, ligne.compteId))
    .returning({
      xpTotale: progressions.xpTotale,
      pieces: progressions.pieces,
      pointsLigue: progressions.pointsLigue,
    });

  if (apres === undefined) {
    throw new Error(`La base n'a rendu aucune progression pour le compte ${ligne.compteId}.`);
  }

  return apres;
}

/** Les dernieres parties de ce compte, de la plus recente a la plus ancienne. */
export async function lireHistorique(
  db: BaseDeDonnees,
  compteId: string,
  limite = 20,
): Promise<ResultatDePartie[]> {
  return db
    .select({
      partieId: parties.id,
      mode: parties.mode,
      carte: parties.carte,
      modeMiroir: parties.modeMiroir,
      dureeS: parties.dureeS,
      nombreJoueurs: parties.nombreJoueurs,
      termineeLe: parties.termineeLe,
      placement: resultats.placement,
      points: resultats.points,
      captures: resultats.captures,
      botsNoirsDetruits: resultats.botsNoirsDetruits,
      xpGagnee: resultats.xpGagnee,
      piecesGagnees: resultats.piecesGagnees,
      variationPointsLigue: resultats.variationPointsLigue,
    })
    .from(resultats)
    .innerJoin(parties, eq(resultats.partieId, parties.id))
    .where(eq(resultats.compteId, compteId))
    .orderBy(desc(parties.termineeLe))
    .limit(limite);
}

/** Ce que les resultats d'un compte disent de lui dans un mode, sur tout son historique. */
export interface StatistiquesEnregistreesDUnMode {
  readonly mode: Mode;
  readonly partiesJouees: number;
  /** Les parties d'au moins JOUEURS_POUR_UNE_VICTOIRE joueurs. */
  readonly partiesAPlusieurs: number;
  /** Premieres places dans une partie a plusieurs. */
  readonly victoires: number;
  readonly meilleurScore: number;
  /** Le meilleur score d'une partie jouee seul. Absent tant qu'il n'y en a aucune. */
  readonly meilleurScoreSeul: number | undefined;
  /**
   * La fin de la derniere partie de ce mode. Elle departage le mode prefere, et ne
   * sort pas du serveur: voir comptes/statistiques.ts.
   */
  readonly derniereLe: Date;
}

/**
 * Les statistiques d'un compte, mode par mode, deduites de ses resultats (etape 3.5).
 *
 * CE QUI SE DEDUIT NE SE STOCKE PAS (cadrage, section 5): aucune colonne ne tient
 * ces compteurs, qu'une partie oubliee ou enregistree deux fois ferait diverger.
 * Une seule requete d'agregat, regroupee par mode, sur tout l'historique, et non sur
 * les dernieres parties que le profil affiche. L'index resultats_par_compte la sert.
 *
 * Une partie jouee seul n'est pas une victoire: voir JOUEURS_POUR_UNE_VICTOIRE. Son
 * meilleur score, lui, se garde a part: c'est le record en Massacre solo de l'etape
 * 7.4, etendu a tous les modes.
 *
 * @returns Une ligne par mode joue au moins une fois, dans un ordre quelconque.
 */
export async function statistiquesParMode(
  db: BaseDeDonnees,
  compteId: string,
): Promise<StatistiquesEnregistreesDUnMode[]> {
  const aPlusieurs = sql`${parties.nombreJoueurs} >= ${JOUEURS_POUR_UNE_VICTOIRE}`;
  const lignes = await db
    .select({
      mode: parties.mode,
      partiesJouees: sql<number>`count(*)::int`,
      partiesAPlusieurs: sql<number>`(count(*) filter (where ${aPlusieurs}))::int`,
      victoires: sql<number>`(count(*) filter (where ${resultats.placement} = 1 and ${aPlusieurs}))::int`,
      meilleurScore: sql<number>`max(${resultats.points})`,
      meilleurScoreSeul: sql<
        number | null
      >`max(${resultats.points}) filter (where ${parties.nombreJoueurs} = 1)`,
      // Un agregat ne passe pas de lui-meme par la conversion de la colonne: mapWith la
      // lui applique, et la date arrive comme celle de lireHistorique.
      derniereLe: sql<Date>`max(${parties.termineeLe})`.mapWith(parties.termineeLe),
    })
    .from(resultats)
    .innerJoin(parties, eq(resultats.partieId, parties.id))
    .where(eq(resultats.compteId, compteId))
    .groupBy(parties.mode);

  return lignes.map((ligne) => ({
    ...ligne,
    meilleurScoreSeul: ligne.meilleurScoreSeul ?? undefined,
  }));
}
