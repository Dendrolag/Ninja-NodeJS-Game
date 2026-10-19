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

import type {
  EntiteVue,
  EtatPriveAmong,
  MeurtreVu,
  NatureDeTache,
  Position,
  PosteDeReparation,
  ReunionVue,
  StationDuMode,
} from '@neon-ninja/shared';
import { AMONG } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import { graineDuGeste } from './interface/modeles/gestes/index.js';

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
   * La tache dont la fenetre est ouverte (etape 7.21): la notre, que le serveur nous a dite
   * ouverte, ou celle qu'un assassin fait semblant de faire, que la page seule connait.
   */
  readonly tacheOuverte?: TacheOuverte;
  /**
   * Nous avons ferme notre tache, et le serveur ne l'a pas encore dite fermee: la page n'en
   * rouvre pas d'autre d'ici la, sans quoi le serveur, qui la tient encore pour ouverte, ne
   * rouvrirait rien.
   */
  readonly fermetureEnAttente?: true;
  /**
   * La reparation dont la fenetre est ouverte (etape 7.27): celle que le serveur nous a dite
   * ouverte, a son poste.
   */
  readonly reparationOuverte?: ReparationOuverte;
  /**
   * Nous avons ferme notre reparation, et le serveur ne l'a pas encore dite fermee: la fenetre ne
   * se rouvre pas d'ici la, comme pour une tache.
   */
  readonly reparationFermeeEnAttente?: true;
  /**
   * L'instant local ou l'on nous a tues: le grand texte du deces s'affiche par-dessus tout
   * (demande du porteur du projet du 10 octobre 2026). Absent tant qu'on est vivant.
   */
  readonly decesA?: number;
}

/** Une tache dont la fenetre est ouverte (etape 7.21). */
export interface TacheOuverte {
  readonly nature: NatureDeTache;
  readonly station: StationDuMode;
  /** L'instant local de l'ouverture: la page n'annonce pas la fin avant la duree minimale. */
  readonly depuis: number;
  /** Un assassin fait semblant: la page seule la joue, sans rien dire au serveur. */
  readonly feinte: boolean;
}

/** Une reparation dont la fenetre est ouverte (etape 7.27). */
export interface ReparationOuverte {
  readonly poste: PosteDeReparation;
  /** L'instant local de l'ouverture: la page n'annonce pas la fin avant la duree minimale. */
  readonly depuis: number;
}

/** Rien de connu: le debut d'une partie. */
export const AMONG_INCONNU: AmongClient = { prive: undefined, reunion: undefined, morts: [] };

/**
 * Ce que nous savons de nous-memes vient de changer, a cet instant local (etape 7.21).
 *
 *   - Le serveur dit une tache ouverte qu'il ne disait pas: sa fenetre s'ouvre, de cet instant.
 *   - Il ne dit plus de tache ouverte: notre fenetre se ferme (sortie du disque, reunion, mort,
 *     tache faite), et une fermeture que nous attendions est faite.
 *   - Un assassin devenu fantome cesse de faire semblant.
 */
export function avecLEtatPrive(
  among: AmongClient,
  prive: EtatPriveAmong,
  instant: number,
): AmongClient {
  return avecLaReparation(avecLaTache(among, prive, instant), among, prive, instant);
}

/** La tache ouverte, d'apres ce que le serveur dit de nous (etape 7.21). */
function avecLaTache(among: AmongClient, prive: EtatPriveAmong, instant: number): AmongClient {
  const { tacheOuverte, fermetureEnAttente: _attendue, ...sansTache } = among;
  const indice = prive.tacheEnCours;

  if (indice === undefined) {
    return tacheOuverte?.feinte === true && !prive.fantome
      ? { ...sansTache, prive, tacheOuverte }
      : { ...sansTache, prive };
  }

  const attente =
    among.fermetureEnAttente === undefined ? {} : { fermetureEnAttente: true as const };

  if (among.prive?.tacheEnCours === indice) {
    return {
      ...sansTache,
      ...attente,
      prive,
      ...(tacheOuverte === undefined ? {} : { tacheOuverte }),
    };
  }

  const tache = prive.taches[indice];
  const station = tache === undefined ? undefined : prive.stations[tache.station];

  return tache === undefined || station === undefined
    ? { ...sansTache, prive }
    : {
        ...sansTache,
        prive,
        tacheOuverte: { nature: tache.nature, station, depuis: instant, feinte: false },
      };
}

/**
 * La reparation ouverte, d'apres ce que le serveur dit de nous (etape 7.27), sur le modele de la
 * tache: une reparation qu'il dit ouverte a un autre poste ouvre sa fenetre de cet instant; une
 * qu'il ne dit plus la ferme (sortie du disque, sabotage fini, reunion, mort), et une fermeture
 * attendue est faite.
 *
 * @param avant Ce que la page savait avant ce nouvel etat prive.
 */
function avecLaReparation(
  among: AmongClient,
  avant: AmongClient,
  prive: EtatPriveAmong,
  instant: number,
): AmongClient {
  const { reparationOuverte, reparationFermeeEnAttente: _attendue, ...sansReparation } = among;
  const poste = prive.reparationEnCours;

  if (poste === undefined) {
    return sansReparation;
  }

  if (avant.prive?.reparationEnCours === poste) {
    return {
      ...sansReparation,
      ...(avant.reparationFermeeEnAttente === undefined
        ? {}
        : { reparationFermeeEnAttente: true as const }),
      ...(reparationOuverte === undefined ? {} : { reparationOuverte }),
    };
  }

  return { ...sansReparation, reparationOuverte: { poste, depuis: instant } };
}

/**
 * Nous fermons la fenetre de notre reparation (etape 7.27). Tant que le serveur la tient pour
 * ouverte, la page ne la rouvre pas.
 */
export function apresLaFermetureDeLaReparation(among: AmongClient): AmongClient {
  const { reparationOuverte: _fermee, ...sansReparation } = among;

  return among.prive?.reparationEnCours === undefined
    ? sansReparation
    : { ...sansReparation, reparationFermeeEnAttente: true };
}

/**
 * Un assassin vivant fait semblant a cette station, a cet instant local (decisions de la fiche
 * 7.21): la fenetre s'ouvre comme pour une proie, avec l'une des taches de la station, toujours
 * la meme pour lui a cette station. Rien si une fenetre est deja ouverte, ou pour tout autre.
 */
export function avecUneFeinte(
  among: AmongClient,
  rang: number,
  moi: string | undefined,
  instant: number,
): AmongClient {
  const prive = among.prive;
  const station = prive?.stations[rang];

  if (
    prive?.role !== 'tueur' ||
    prive.fantome ||
    station === undefined ||
    among.tacheOuverte !== undefined
  ) {
    return among;
  }

  const choix = graineDuGeste(moi ?? '', station.nom, 'katana') % station.natures.length;
  const nature = station.natures[choix] ?? (station.natures[0] as NatureDeTache);

  return { ...among, tacheOuverte: { nature, station, depuis: instant, feinte: true } };
}

/**
 * Nous fermons notre fenetre, la tache faite ou non. Pour une vraie tache encore ouverte au
 * serveur, la page attend qu'il la dise fermee avant d'en rouvrir une.
 */
export function apresLaFermeture(among: AmongClient): AmongClient {
  const { tacheOuverte, ...sansTache } = among;

  return tacheOuverte?.feinte === false && among.prive?.tacheEnCours !== undefined
    ? { ...sansTache, fermetureEnAttente: true }
    : sansTache;
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
    // Une reunion ferme toute fenetre de tache: celle d'une proie, le serveur la dit fermee; celle
    // d'un assassin qui faisait semblant, la page la ferme ici.
    case 'ouverte':
      return {
        ...(among.tacheOuverte?.feinte === true ? apresLaFermeture(among) : among),
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
export function stationsAMontrer(prive: EtatPriveAmong): readonly StationDuMode[] {
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
 *
 * A defaut de proie, le PNJ le plus proche a portee (etape 7.28): le tuer deguise l'assassin. Une
 * proie deguisee est un PNJ dans sa vue: le serveur la tuera, elle, si elle est la plus proche.
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

  return victime ?? pnjAPortee(partie.entites, moi);
}

/** Le PNJ le plus proche a portee du meurtre de cet assassin, ou rien (etape 7.28). */
function pnjAPortee(entites: readonly EntiteVue[], moi: Position): string | undefined {
  let pnj: string | undefined;
  let retenue = Number.POSITIVE_INFINITY;

  for (const entite of entites) {
    const distance = Math.hypot(entite.x - moi.x, entite.y - moi.y);

    if (entite.type === 'bot' && distance <= AMONG.PORTEE_DU_MEURTRE_PX && distance < retenue) {
      pnj = entite.id;
      retenue = distance;
    }
  }

  return pnj;
}
