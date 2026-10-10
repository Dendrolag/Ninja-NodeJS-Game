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

import type { EtatPriveAmong, MeurtreVu, Position, ReunionVue } from '@neon-ninja/shared';
import { AMONG } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';

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
  /**
   * L'instant local ou l'on nous a tues: le grand texte du deces s'affiche par-dessus tout
   * (demande du porteur du projet du 10 octobre 2026). Absent tant qu'on est vivant.
   */
  readonly decesA?: number;
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

/** Un meurtre, a cet instant local: s'il nous a tues, le grand texte du deces s'affiche. */
export function apresUnMeurtre(
  among: AmongClient,
  meurtre: MeurtreVu,
  moi: string | undefined,
  instant: number,
): AmongClient {
  return meurtre.victime === moi ? { ...among, decesA: instant } : among;
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

/**
 * Les stations que ce joueur doit voir, sur la carte et la mini-carte: celles des taches qui lui
 * restent pour une proie, vivante ou fantome; toutes les stations actives pour un assassin, qui
 * voit celles des proies (decision 9 de la fiche).
 */
export function stationsAMontrer(prive: EtatPriveAmong): readonly Position[] {
  const rangs =
    prive.role === 'tueur'
      ? prive.stations.map((_place, rang) => rang)
      : prive.taches.filter((tache) => !tache.faite).map((tache) => tache.station);

  return rangs.flatMap((rang) => {
    const place = prive.stations[rang];

    return place === undefined ? [] : [place];
  });
}

/**
 * La proie qu'un assassin tuerait s'il frappait maintenant, ou rien (demande du porteur du
 * projet du 10 octobre 2026): la page la met en surbrillance, et le bouton du katana ne
 * s'active que pour elle.
 *
 * LA REGLE DU MOTEUR (tuer, packages/sim/src/among.ts): un assassin vivant, en phase de jeu, son
 * katana pret, et la proie vivante la plus proche a sa portee; a distance egale, la premiere
 * dans l'ordre. Les proies sont les joueurs de sa vue qui ne sont pas ses complices: un
 * fantome n'est jamais dans la vue d'un vivant. La page juge sur les positions recues, le
 * serveur tranche.
 */
export function victimeAPortee(etat: EtatClient): string | undefined {
  const prive = etat.among.prive;
  const partie = etat.partie;

  if (
    etat.salon?.mode !== 'among' ||
    prive?.role !== 'tueur' ||
    prive.fantome ||
    partie?.among?.phase !== 'jeu'
  ) {
    return undefined;
  }

  const moi = partie.entites.find((entite) => entite.id === etat.moi);

  if (moi?.type !== 'joueur' || (moi.tactique?.charges ?? 0) === 0) {
    return undefined;
  }

  const complices = new Set(prive.complices);
  let victime: string | undefined;
  let retenue = Number.POSITIVE_INFINITY;

  for (const entite of partie.entites) {
    if (
      entite.type !== 'joueur' ||
      entite.id === moi.id ||
      entite.fantome === true ||
      complices.has(entite.id)
    ) {
      continue;
    }

    const distance = Math.hypot(entite.x - moi.x, entite.y - moi.y);

    if (distance <= AMONG.PORTEE_DU_MEURTRE_PX && distance < retenue) {
      victime = entite.id;
      retenue = distance;
    }
  }

  return victime;
}
