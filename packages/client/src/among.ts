/**
 * Ce que la page sait d'une partie Among Ninjas (etape 7.20), hors du flux d'etat.
 *
 * Deux sources, et rien d'autre. Le serveur dit a chaque joueur, a lui seul, ce qu'il sait de
 * lui-meme: son role, ses complices s'il est assassin, s'il est fantome, ses stations et sa
 * liste (l'etat prive). Et il dit a tous ce qui se passe en reunion: son ouverture, qui a vote,
 * le resultat. La phase, son temps et la barre des taches, eux, voyagent dans le flux.
 *
 * Ce module ne fait que tenir ces deux sources a jour. Il est pur: le reducteur l'appelle.
 */

import type { EtatPriveAmong, ReunionVue } from '@neon-ninja/shared';

/** Le resultat d'un vote, tel que la reunion le dit. */
export type ResultatVu = Extract<ReunionVue, { readonly quoi: 'resultat' }>;

/** La reunion en cours, ou la derniere, telle que la page l'affiche. */
export interface ReunionClient {
  readonly numero: number;
  readonly par?: string;
  readonly motif: Extract<ReunionVue, { readonly quoi: 'ouverte' }>['motif'];
  readonly cadavre?: string;
  /** Les vivants qui ont deja vote, dans l'ordre ou ils l'ont fait. */
  readonly votants: readonly string[];
  /** Notre vote, quand nous avons vote: un joueur, ou null pour passer. */
  readonly monVote?: string | null;
  /** Le resultat, des que le vote est clos. */
  readonly resultat?: ResultatVu;
}

/** Ce que la page sait d'une partie Among Ninjas lancee. */
export interface AmongClient {
  /** Ce que nous savons de nous-memes, des que le serveur nous l'a dit. */
  readonly prive: EtatPriveAmong | undefined;
  /** La reunion en cours, ou la derniere tenue. */
  readonly reunion: ReunionClient | undefined;
  /**
   * Les morts que tout le monde connait: ceux que chaque reunion a annonces, et les ejectes.
   * Un mort que personne n'a encore trouve n'y est pas, sauf pour qui l'a vu.
   */
  readonly morts: readonly string[];
  /**
   * L'instant local ou le serveur nous a dit notre tache commencee: la jauge en part. Absent
   * hors d'une tache en cours.
   */
  readonly tacheDebuteeA?: number;
}

/** Rien de connu: le debut d'une partie. */
export const AMONG_INCONNU: AmongClient = { prive: undefined, reunion: undefined, morts: [] };

/**
 * Ce que nous savons de nous-memes vient de changer, a cet instant local. Une tache qui
 * commence, ou qui change, part de cet instant; une tache lachee n'a plus d'instant.
 */
export function avecLEtatPrive(
  among: AmongClient,
  prive: EtatPriveAmong,
  instant: number,
): AmongClient {
  const { tacheDebuteeA: _ancienne, ...sansTache } = among;

  if (prive.tacheEnCours === undefined) {
    return { ...sansTache, prive };
  }

  const memeTache =
    among.prive?.tacheEnCours === prive.tacheEnCours && among.tacheDebuteeA !== undefined;

  return {
    ...sansTache,
    prive,
    tacheDebuteeA: memeTache ? (among.tacheDebuteeA as number) : instant,
  };
}

/** Ce qui se passe en reunion, a ajouter a ce que la page sait. */
export function apresLaReunion(among: AmongClient, reunion: ReunionVue): AmongClient {
  switch (reunion.quoi) {
    case 'ouverte':
      return {
        ...among,
        reunion: {
          numero: reunion.numero,
          ...(reunion.par === undefined ? {} : { par: reunion.par }),
          motif: reunion.motif,
          ...(reunion.cadavre === undefined ? {} : { cadavre: reunion.cadavre }),
          votants: [],
        },
        morts: ajouterSansDoublon(among.morts, reunion.morts),
      };

    case 'voteOuvert':
      return among;

    case 'aVote':
      return among.reunion === undefined || among.reunion.votants.includes(reunion.votant)
        ? among
        : {
            ...among,
            reunion: { ...among.reunion, votants: [...among.reunion.votants, reunion.votant] },
          };

    case 'resultat':
      return {
        ...among,
        ...(among.reunion === undefined
          ? {}
          : { reunion: { ...among.reunion, resultat: reunion } }),
        morts:
          reunion.ejecte === undefined
            ? among.morts
            : ajouterSansDoublon(among.morts, [reunion.ejecte]),
      };
  }
}

/** Retient notre vote, pour le montrer avant que le serveur ne l'ait compte. */
export function avecMonVote(among: AmongClient, cible: string | null): AmongClient {
  return among.reunion === undefined || among.reunion.monVote !== undefined
    ? among
    : { ...among, reunion: { ...among.reunion, monVote: cible } };
}

/** Une liste, plus ces elements qu'elle n'avait pas, dans leur ordre. */
function ajouterSansDoublon(
  liste: readonly string[],
  ajouts: readonly string[],
): readonly string[] {
  const nouveaux = ajouts.filter((element) => !liste.includes(element));

  return nouveaux.length === 0 ? liste : [...liste, ...nouveaux];
}
