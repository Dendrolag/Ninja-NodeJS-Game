/**
 * Ce que retient une partie Among Ninjas (etape 7.20), et ce que son journal raconte.
 *
 * Les types seuls: les regles sont dans among.ts. Ils vivent a part de etat.ts, deja long,
 * et n'ont de sens que pour ce mode: une partie d'un autre mode n'a pas le champ
 * EtatPartie.among, et son journal ne porte aucun de ces evenements.
 */

import type {
  CampAmong,
  Couleur,
  MotifDeReunion,
  NatureDeSabotage,
  NatureDeTache,
  Nuisance,
  PhaseAmong,
  Position,
  RoleAmong,
  StationDuMode,
} from '@neon-ninja/shared';

export type { CampAmong, MotifDeReunion, PhaseAmong };

/** Un identifiant d'entite, comme dans etat.ts. */
type Identifiant = string;

/**
 * Une tache de la liste d'une proie: une station, et le geste qu'elle y fait (etape 7.21),
 * tire pour elle parmi ceux de la station. Deux proies a la meme station n'ont donc pas
 * forcement la meme tache.
 */
export interface TacheAmong {
  /** Le rang de la station parmi les stations actives de la partie (EtatAmong.stations). */
  readonly station: number;
  readonly nature: NatureDeTache;
  readonly faite: boolean;
}

/** Les faits de jeu d'un joueur, qui font ses points de fin (POINTS_AMONG). */
export interface FaitsAmong {
  readonly taches: number;
  readonly signalements: number;
  readonly meurtres: number;
  /** Les votes contre un tueur que ce vote a ejecte. */
  readonly bonsVotes: number;
  /** Les meurtres du premier tour. */
  readonly meurtresAuPremierTour: number;
  /** Les bons votes de la premiere reunion. */
  readonly tueursTrouvesALaPremiereReunion: number;
}

/** Ce que le mode retient d'un joueur. */
export interface JoueurAmong {
  readonly role: RoleAmong;
  /** Tue, ou ejecte: il joue en fantome, invisible des vivants. */
  readonly fantome: boolean;
  /** Pour un tueur: le temps avant de pouvoir tuer de nouveau. Zero pour une proie. */
  readonly rechargeMs: number;
  /** Il a sonne son gong, le seul de sa partie. */
  readonly gongUtilise: boolean;
  /**
   * Il tenait le bouton d'action au battement precedent. Signaler et sonner se font a
   * l'appui, pas tant qu'on tient: un joueur qui garde le bouton enfonce en arrivant pres du
   * gong ne le sonne pas sans le vouloir.
   */
  readonly actionTenue: boolean;
  /** Sa liste de taches. Vide pour un tueur. */
  readonly taches: readonly TacheAmong[];
  /**
   * La tache qu'il a ouverte: son rang dans sa liste, et le temps passe depuis l'ouverture. La
   * page joue le geste; le moteur ne compte que ce temps, et juge la fin annoncee contre la
   * duree minimale de la nature de la tache (etape 7.21).
   */
  readonly tacheEnCours?: { readonly indice: number; readonly ecouleMs: number };
  readonly faits: FaitsAmong;
}

/**
 * Le sabotage en cours (etape 7.22): un seul a la fois, pour toute la partie. Le saboteur n'y
 * est pas: rien ne doit le designer.
 */
export interface SabotageAmong {
  readonly nature: NatureDeSabotage;
  /**
   * Ce qu'il en reste: une nuisance et le nuage s'eteignent seuls, la surchauffe fait gagner les
   * assassins a son terme. Zero pour la panne, qui dure jusqu'a sa reparation, et pour une
   * surchauffe perdue.
   */
  readonly restantMs: number;
  /** Le nuage: le rang de sa station parmi les stations actives. */
  readonly station?: number;
  /**
   * La reparation: pour la panne, le temps que quelqu'un tient le boitier; pour la surchauffe,
   * le temps que les deux consoles sont tenues ensemble. Retombe a zero des que cela cesse.
   */
  readonly reparationMs: number;
  /** La surchauffe: chaque console est-elle tenue a ce battement. */
  readonly consolesTenues: readonly [boolean, boolean];
}

/** Un cadavre, au sol jusqu'a la fin de la reunion qui suit. */
export interface CadavreAmong {
  readonly victime: Identifiant;
  readonly position: Position;
  readonly couleur: Couleur;
}

/** Un vote: pour un joueur, ou null pour passer. */
export type VoteAmong = Identifiant | null;

/** La reunion en cours. */
export interface ReunionAmong {
  /** Son rang dans la partie, a partir de un. */
  readonly numero: number;
  /** Qui l'a ouverte. Absent pour la reunion que le terme du tour impose. */
  readonly par?: Identifiant;
  readonly motif: MotifDeReunion;
  /** La victime dont on a trouve le cadavre, pour un signalement. */
  readonly cadavre?: Identifiant;
  /** Les votes deja exprimes, par votant. */
  readonly votes: Readonly<Record<Identifiant, VoteAmong>>;
}

/** Les voix d'une option du vote. */
export interface VoixAmong {
  /** Un joueur, ou null pour « passer ». */
  readonly cible: VoteAmong;
  readonly voix: number;
}

/** Le resultat du dernier vote, affiche pendant l'ejection. */
export interface EjectionAmong {
  /** L'ejecte. Absent si personne ne l'est: egalite, ou « passer » en tete. */
  readonly ejecte?: Identifiant;
  readonly votes: Readonly<Record<Identifiant, VoteAmong>>;
  readonly decompte: readonly VoixAmong[];
}

/** Ce que retient une partie Among Ninjas. Voir EtatPartie.among. */
export interface EtatAmong {
  readonly phase: PhaseAmong;
  /** Ce qu'il reste de la phase, sauf pendant le jeu, ou c'est le tour qui compte. */
  readonly phaseRestanteMs: number;
  /**
   * Les joueurs dont la page a charge la carte, dans l'ordre de l'etat. Pendant le chargement
   * seulement: la revelation commence quand tous y sont.
   */
  readonly charges?: readonly Identifiant[];
  /** Le tour en cours, a partir de un. Zero pendant la revelation. */
  readonly tour: number;
  /** Le temps de jeu ecoule depuis le debut du tour. */
  readonly tourEcouleMs: number;
  /** Combien de reunions se sont ouvertes. */
  readonly reunions: number;
  readonly joueurs: Readonly<Record<Identifiant, JoueurAmong>>;
  readonly cadavres: Readonly<Record<Identifiant, CadavreAmong>>;
  /** Les stations actives de la partie, tirees au lancement, deja retournees en miroir. */
  readonly stations: readonly StationDuMode[];
  /** Le point de reunion, ou sonne le gong. */
  readonly gong: Position;
  /** Le boitier ou l'on repare la panne de neons (etape 7.22), retourne en miroir. */
  readonly boitier: Position;
  /** Les deux consoles de la surchauffe (etape 7.22), retournees en miroir. */
  readonly consoles: readonly [Position, Position];
  /** Le sabotage en cours (etape 7.22). */
  readonly sabotage?: SabotageAmong;
  /** Le temps avant le prochain sabotage, commun a tous les assassins (etape 7.22). */
  readonly rechargeDesSabotagesMs: number;
  /** Le temps avant la prochaine malediction, commun a tous les fantomes (etape 7.22). */
  readonly rechargeDeLaMaledictionMs: number;
  readonly reunion?: ReunionAmong;
  readonly ejection?: EjectionAmong;
  /**
   * Les taches faites par des proies parties: elles restent faites, et comptent au total.
   * Les taches restantes d'une proie qui part sortent du total (etude, section 4.2).
   */
  readonly tachesDesPartis: number;
  /**
   * Les taches faites a l'ouverture de la derniere reunion, zero avant la premiere: la barre
   * commune que voient les vivants quand l'hote ne la montre qu'en reunion (etape 7.21).
   */
  readonly tachesALaDerniereReunion: number;
  /** Le camp vainqueur, des que la partie est decidee. */
  readonly vainqueur?: CampAmong;
}

/** Un tueur a tue une proie. */
export interface Meurtre {
  readonly type: 'meurtre';
  readonly tueur: Identifiant;
  readonly victime: Identifiant;
  readonly position: Position;
}

/** Une reunion s'est ouverte. */
export interface ReunionOuverte {
  readonly type: 'reunionOuverte';
  readonly numero: number;
  readonly par?: Identifiant;
  readonly motif: MotifDeReunion;
  readonly cadavre?: Identifiant;
  /** Tous les fantomes, cadavre trouve ou non, comme dans Among Us. */
  readonly morts: readonly Identifiant[];
}

/** La discussion est finie: le vote s'ouvre. */
export interface VoteOuvert {
  readonly type: 'voteOuvert';
}

/** Un vivant a vote. Pour qui, le resultat le dira. */
export interface AVote {
  readonly type: 'aVote';
  readonly votant: Identifiant;
}

/** Le vote est clos. */
export interface ResultatDuVote {
  readonly type: 'resultatDuVote';
  readonly ejecte?: Identifiant;
  readonly votes: Readonly<Record<Identifiant, VoteAmong>>;
  readonly decompte: readonly VoixAmong[];
}

/** Un tour commence: les vivants sont autour du point de reunion. */
export interface TourCommence {
  readonly type: 'tourCommence';
  readonly tour: number;
}

/** Une proie a fini une tache. */
export interface TacheFaite {
  readonly type: 'tacheFaite';
  readonly joueur: Identifiant;
  readonly station: number;
  readonly nature: NatureDeTache;
}

/**
 * La fin d'une tache visuelle (etape 7.21): des etincelles ou une bouffee, a la station. Seule
 * une vraie proie vivante la produit, et seulement si l'hote l'a voulu. L'evenement ne nomme
 * pas la proie: les temoins la voient, ou non.
 */
export interface TacheVisuelle {
  readonly type: 'tacheVisuelle';
  readonly nature: NatureDeTache;
  readonly position: Position;
}

/**
 * Un sabotage commence (etape 7.22). Il ne nomme pas le saboteur. Pour une nuisance, les proies
 * vivantes qui la subissent.
 */
export interface SabotageLance {
  readonly type: 'sabotage';
  readonly nature: NatureDeSabotage;
  readonly victimes: readonly Identifiant[];
}

/** Le sabotage en cours est fini: repare (la panne, la surchauffe), ou eteint de lui-meme. */
export interface SabotageFini {
  readonly type: 'sabotageFini';
  readonly nature: NatureDeSabotage;
  readonly repare: boolean;
}

/**
 * Une proie fantome maudit les assassins vivants (etape 7.22). Elle n'est pas nommee: rien ne
 * doit dire aux vivants qu'un fantome agit.
 */
export interface Malediction {
  readonly type: 'malediction';
  readonly nature: Nuisance;
  readonly victimes: readonly Identifiant[];
}

/** Les evenements du mode, ajoutes au journal d'un battement. */
export type EvenementAmong =
  | Meurtre
  | ReunionOuverte
  | VoteOuvert
  | AVote
  | ResultatDuVote
  | TourCommence
  | TacheFaite
  | TacheVisuelle
  | SabotageLance
  | SabotageFini
  | Malediction;
