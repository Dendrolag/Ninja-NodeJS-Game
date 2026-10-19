/**
 * Reglages d'une partie: ce que l'hote choisit dans le salon avant de lancer.
 *
 * Portage de DEFAULT_GAME_SETTINGS (legacy/game-constants.js:79). Depuis
 * l'etape 1.5, tous les reglages dont le moteur se sert sont ici.
 *
 * Le reglage blackBotSpeed du legacy n'est deliberement pas porte: il n'etait lu
 * nulle part, le bot noir avancant a la vitesse d'un bot ordinaire (defaut X13
 * de l'audit, decision du 13 aout 2026 de conserver ce comportement). Porter un
 * reglage mort aurait ete recopier le piege.
 *
 * A l'inverse, blackBotStartPercent etait mort lui aussi (defaut X26), mais il
 * est porte ET rendu vivant sous le nom momentApparitionPourCent: contrairement
 * au precedent, ce reglage designe quelque chose que l'hote croit regler dans le
 * salon, et sa valeur par defaut reproduit exactement le comportement joue.
 *
 * POURQUOI CES REGLAGES VOYAGENT DANS L'ETAT. Dans le legacy, deux endroits
 * lisaient les valeurs par defaut au lieu des reglages de la partie en cours
 * (defaut X14 de l'audit), si bien que changer ces reglages dans le salon
 * n'avait aucun effet. Ici il n'existe aucun objet de reglages accessible
 * globalement: le moteur ne connait que celui que porte l'etat qu'on lui passe.
 * Le defaut ne peut donc plus se reproduire.
 *
 * POURQUOI DES GROUPES. Le legacy alignait quarante reglages a plat, avec des
 * prefixes en guise de rangement (enableSpeedBoost, speedBoostDuration,
 * speedBoostSpawnRate). Ici bonus, malus et zones forment trois groupes: on voit
 * d'un coup d'oeil ce qui appartient a quoi, et l'ecran de reglages du salon
 * (etape 4.3) se dessine en suivant cette structure. Le prix a payer est qu'un
 * appelant qui ne change qu'une valeur doit pouvoir le faire sans reecrire tout
 * le groupe: c'est le role de completerReglages.
 */

import type { BarreDesTaches, PalierDeVision } from './among.js';
import { AMONG, CARTE_DU_MODE_AMONG } from './among.js';
import type {
  IdentifiantCarte,
  Mode,
  ObjetDePoche,
  TypeBonus,
  TypeBonusTactique,
  TypeMalus,
  TypeMalusTactique,
  TypeZone,
} from './constantes.js';
import { MINES_DE_ZONE } from './constantes.js';

/** Reglages d'un bonus: est-il en jeu, combien de temps dure-t-il, apparait-il souvent. */
export interface ReglageBonus {
  readonly actif: boolean;
  /** Duree de l'effet une fois ramasse, en secondes. */
  readonly dureeS: number;
  /** Chance sur cent d'apparaitre a chaque tentative d'apparition. */
  readonly tauxApparitionPourCent: number;
}

/** Reglages des bonus dans leur ensemble. */
export interface ReglagesBonus {
  /** Delai moyen entre deux tentatives d'apparition, en secondes. */
  readonly intervalleApparitionS: number;
  readonly types: Readonly<Record<TypeBonus, ReglageBonus>>;
}

/** Reglages d'un malus: est-il en jeu, et combien de temps dure-t-il. */
export interface ReglageMalus {
  readonly actif: boolean;
  /** Duree de l'effet subi par les autres joueurs, en secondes. */
  readonly dureeS: number;
}

/**
 * Reglages des malus dans leur ensemble.
 *
 * Les malus partagent un seul taux d'apparition, la ou chaque bonus a le sien:
 * c'est ainsi dans le legacy, ou une tentative d'apparition de malus tire
 * d'abord si un malus apparait, puis lequel.
 */
export interface ReglagesMalus {
  readonly actifs: boolean;
  /** Delai moyen entre deux tentatives d'apparition, en secondes. */
  readonly intervalleApparitionS: number;
  /** Chance sur cent qu'une tentative fasse apparaitre un malus. */
  readonly tauxApparitionPourCent: number;
  readonly types: Readonly<Record<TypeMalus, ReglageMalus>>;
}

/**
 * Reglages des six objets du Tactique (etape 7.7): pour chacun, est-il en jeu et combien
 * de temps dure-t-il, plus un taux d'apparition pour chaque bonus.
 *
 * Ils suivent les regles d'apparition des objets du jeu d'origine: l'intervalle entre deux
 * tentatives est celui des bonus, et le taux commun des malus. Un groupe a part, et non
 * trois natures de plus dans les groupes bonus et malus, parce qu'il n'existe que dans une
 * partie Tactique: les autres modes gardent des reglages identiques a ce qu'ils etaient.
 */
export interface ReglagesObjetsTactiques {
  readonly bonus: Readonly<Record<TypeBonusTactique, ReglageBonus>>;
  readonly malus: Readonly<Record<TypeMalusTactique, ReglageMalus>>;
}

/**
 * Reglages des zones speciales.
 *
 * DEPUIS L'ETAPE 7.12, UNE ZONE S'OUVRE SUR UNE MINE DE ZONE, que la carte pose. Les champs
 * gardent leurs noms, pour que des reglages deja ecrits restent valides, et prennent le sens
 * de la mine (micro-decision 1 de la fiche): l'intervalle est celui des poses, la duree est
 * celle de la zone qui s'ouvre, les natures sont celles qu'une mine peut cacher.
 */
export interface ReglagesZones {
  /** Les mines de zone, donc les zones, sont-elles en jeu. */
  readonly actives: boolean;
  /** Duree de vie minimale d'une zone ouverte, en secondes. */
  readonly dureeMinimumS: number;
  /** Duree de vie maximale d'une zone ouverte, en secondes. */
  readonly dureeMaximumS: number;
  /** Delai entre deux poses de mine de zone, en secondes. */
  readonly intervalleApparitionS: number;
  /** Quelles natures de zone une mine peut cacher. */
  readonly types: Readonly<Record<TypeZone, boolean>>;
  /** Combien de mines de zone peuvent attendre sur la carte en meme temps (etape 7.12). */
  readonly minesMaximum: number;
}

/**
 * Reglages des bots noirs: les chasseurs qui entrent en jeu en cours de partie.
 *
 * Les quatre valeurs viennent de DEFAULT_GAME_SETTINGS, et trois d'entre elles
 * n'avaient aucun effet dans le legacy: le rayon de detection et la part de bots
 * perdue etaient lus dans les valeurs par defaut au lieu des reglages de la
 * partie (defaut X14), et le moment d'apparition n'etait lu nulle part (defaut
 * X26). Ici elles agissent toutes les quatre.
 */
export interface ReglagesBotsNoirs {
  readonly actifs: boolean;
  /** Nombre de bots noirs qui entrent en jeu ensemble. */
  readonly nombre: number;
  /** A quel pourcentage de la partie ecoule les bots noirs apparaissent. */
  readonly momentApparitionPourCent: number;
  /** Distance a laquelle un bot noir repere une proie, en pixels. */
  readonly rayonDetectionPx: number;
  /** Part des bots d'un joueur qu'une capture par bot noir lui fait perdre. */
  readonly partDeBotsPerduePourCent: number;
}

/**
 * Reglage d'un objet de poche (etape 7.10): est-il en jeu, et apparait-il souvent.
 *
 * Celui d'un bonus, sans duree: ramasse, l'objet remplit la poche au lieu de lancer un
 * effet, et il agit d'un coup quand le joueur le declenche.
 */
export interface ReglageObjetDePoche {
  readonly actif: boolean;
  /** Chance sur cent d'apparaitre a chaque tentative d'apparition des bonus. */
  readonly tauxApparitionPourCent: number;
}

/** Reglages des objets de poche, un par nature (etape 7.10). */
export type ReglagesObjetsDePoche = Readonly<Record<ObjetDePoche, ReglageObjetDePoche>>;

/**
 * Reglages du mode Among Ninjas (etape 7.20), que l'hote regle au salon. Valeurs confirmees
 * par le porteur du projet le 6 octobre 2026.
 */
export interface ReglagesAmong {
  /**
   * Combien de tueurs l'hote veut. Le moteur le ramene au lancement a ce que le nombre de
   * joueurs admet (tueursMaximum): un de cinq a six, deux de sept a huit, trois au-dela.
   */
  readonly tueurs: number;
  /** Les taches de chaque proie. */
  readonly tachesParProie: number;
  /**
   * Combien des taches de chaque proie sont longues, des mini-jeux (etape 7.24, reponse 1 du
   * porteur du projet, 11 octobre 2026): de 0 a 2, comptees dans les taches par proie.
   */
  readonly tachesLongues: number;
  /** Ce qu'un tueur attend entre deux meurtres, en secondes. */
  readonly rechargeMeurtreS: number;
  /** La duree maximale d'un tour, en secondes, l'une de DUREES_DE_TOUR_S. Zero: aucune. */
  readonly dureeDuTourS: number;
  /** La discussion d'une reunion, en secondes. */
  readonly discussionS: number;
  /** Le vote d'une reunion, en secondes. */
  readonly voteS: number;
  /** Les votes se montrent-ils sans dire qui a vote pour qui. */
  readonly votesAnonymes: boolean;
  /** Le palier de vision des proies. */
  readonly visionProie: PalierDeVision;
  /** Le palier de vision des tueurs. */
  readonly visionTueur: PalierDeVision;
  /** Les PNJ de la foule neutre, de 0 a 80: ils remplacent le nombre de PNJ des autres modes. */
  readonly foule: number;
  /**
   * Les taches visuelles (etape 7.21): la fin d'une tache de katana ou de fumee se voit de pres,
   * preuve qu'une vraie proie l'a faite. Activees par defaut (decision du porteur du projet du
   * 10 octobre 2026).
   */
  readonly tachesVisuelles: boolean;
  /** Quand les vivants voient la barre commune des taches (etape 7.21). */
  readonly barreDesTaches: BarreDesTaches;
}

/** Les reglages du mode Among Ninjas quand l'hote ne change rien. */
export const AMONG_PAR_DEFAUT: ReglagesAmong = {
  tueurs: 2,
  tachesParProie: 5,
  tachesLongues: 1,
  rechargeMeurtreS: 25,
  dureeDuTourS: 180,
  discussionS: 45,
  voteS: 45,
  votesAnonymes: false,
  visionProie: 'normale',
  visionTueur: 'normale',
  foule: AMONG.FOULE_PAR_DEFAUT,
  tachesVisuelles: true,
  barreDesTaches: 'toujours',
};

/** Reglages d'une partie, figes au lancement. */
export interface ReglagesPartie {
  /** Duree de la partie, en secondes. */
  readonly dureePartieS: number;
  /** Carte jouee. */
  readonly carte: IdentifiantCarte;
  /** Mode miroir: la carte est retournee horizontalement. */
  readonly modeMiroir: boolean;
  /**
   * La pluie tombe-t-elle sur la carte. Un reglage d'affichage, que le moteur ignore:
   * seule Tokyo a une pluie, et le reglage est sans effet ailleurs. Il remplace, a
   * l'etape 7.6, la carte Rainy Tokyo du jeu d'origine (decision du porteur du projet
   * du 18 septembre 2026: la pluie par defaut, comme l'ancienne carte par defaut).
   */
  readonly pluie: boolean;
  /**
   * La carte se joue-t-elle de nuit (etape 8.9). Un reglage d'affichage, que le moteur
   * ignore, sur le modele de la pluie: seuls la Station lunaire, Prison Island (etape
   * 8.11) et le Labyrinthe (etape 8.12) ont un fond de nuit (cheminFondDeNuit), et
   * le reglage est sans effet ailleurs. Le jour par defaut.
   */
  readonly nuit: boolean;
  /**
   * L'Evade apparait-il dans la partie (etape 7.9). Actif par defaut; la Chasse le retire
   * (imposerLesReglagesDuMode), et le moteur ne le fait apparaitre que dans les modes de
   * MODES_AVEC_EVADE.
   */
  readonly evade: boolean;
  /**
   * Nombre de bots presents au demarrage. Il ne depasse pas le plafond de la carte
   * (PLAFONDS_DE_FAUX_NINJAS, etape 7.6).
   */
  readonly nombreBotsInitial: number;
  readonly bonus: ReglagesBonus;
  readonly malus: ReglagesMalus;
  readonly zones: ReglagesZones;
  readonly botsNoirs: ReglagesBotsNoirs;
  /**
   * Les objets de poche (etape 7.10), dans tous les modes. Ils tentent leur chance avec les
   * bonus, a leur intervalle, apres toutes les autres natures de bonus.
   */
  readonly objetsDePoche: ReglagesObjetsDePoche;
  /**
   * Les objets du Tactique (etape 7.7). Presents dans les reglages que l'hote regle au
   * salon, quel que soit le mode, pour qu'il retrouve ses choix en changeant de mode; le
   * moteur les retire d'une partie d'un autre mode (imposerLesReglagesDuMode).
   */
  readonly objetsTactiques?: ReglagesObjetsTactiques;
  /**
   * Les reglages du mode Among Ninjas (etape 7.20). Presents au salon quel que soit le mode,
   * comme les objets du Tactique; le moteur les retire d'une partie d'un autre mode.
   */
  readonly among?: ReglagesAmong;
}

/**
 * Les objets du Tactique quand l'hote ne change rien (etape 7.7): les durees tranchees
 * par le porteur du projet le 19 septembre 2026, et des taux qui reprennent ceux des bonus
 * du jeu d'origine, le plus fort des trois, la Rafale, etant le plus rare.
 */
export const OBJETS_TACTIQUES_PAR_DEFAUT: ReglagesObjetsTactiques = {
  bonus: {
    rafale: { actif: true, dureeS: 5, tauxApparitionPourCent: 15 },
    rechargeRapide: { actif: true, dureeS: 10, tauxApparitionPourCent: 25 },
    viseeLarge: { actif: true, dureeS: 10, tauxApparitionPourCent: 20 },
  },
  malus: {
    tirUnique: { actif: true, dureeS: 10 },
    rechargeLente: { actif: true, dureeS: 12 },
    viseeEtroite: { actif: true, dureeS: 10 },
  },
};

/** Reglages appliques quand l'hote ne change rien. Valeurs du legacy, et les objets du Tactique. */
export const REGLAGES_PAR_DEFAUT: ReglagesPartie = {
  dureePartieS: 180,
  carte: 'map1',
  modeMiroir: false,
  pluie: true,
  nuit: false,
  evade: true,
  nombreBotsInitial: 50,
  bonus: {
    intervalleApparitionS: 4,
    types: {
      vitesse: { actif: true, dureeS: 10, tauxApparitionPourCent: 25 },
      invincibilite: { actif: true, dureeS: 10, tauxApparitionPourCent: 15 },
      revelation: { actif: true, dureeS: 10, tauxApparitionPourCent: 20 },
    },
  },
  malus: {
    actifs: true,
    intervalleApparitionS: 8,
    tauxApparitionPourCent: 20,
    types: {
      controlesInverses: { actif: true, dureeS: 10 },
      flou: { actif: true, dureeS: 12 },
      negatif: { actif: true, dureeS: 14 },
    },
  },
  zones: {
    actives: true,
    dureeMinimumS: 10,
    dureeMaximumS: 30,
    intervalleApparitionS: 15,
    types: { chaos: true, repulsion: true, attraction: true, invisibilite: true },
    minesMaximum: MINES_DE_ZONE.MAXIMUM_PAR_DEFAUT,
  },
  botsNoirs: {
    actifs: true,
    nombre: 2,
    momentApparitionPourCent: 50,
    rayonDetectionPx: 150,
    partDeBotsPerduePourCent: 50,
  },
  // Le taux du plus rare des bonus d'origine, l'Invincibilite: la fumee reste un objet
  // qu'on remarque (etape 7.10).
  // La mine a le taux de la fumee (etape 7.11, micro-decision 1 de la fiche).
  objetsDePoche: {
    fumee: { actif: true, tauxApparitionPourCent: 15 },
    mine: { actif: true, tauxApparitionPourCent: 15 },
  },
  objetsTactiques: OBJETS_TACTIQUES_PAR_DEFAUT,
  among: AMONG_PAR_DEFAUT,
};

/**
 * Une version d'un type dont chaque champ est facultatif, a tous les niveaux.
 *
 * Sert a ne fournir que les reglages que l'on veut changer: le reste vient des
 * valeurs par defaut.
 */
export type PartielProfond<T> = {
  readonly [Champ in keyof T]?: NonNullable<T[Champ]> extends object
    ? PartielProfond<NonNullable<T[Champ]>>
    : T[Champ];
};

/** Des reglages incomplets, tels qu'un appelant peut les fournir. */
export type ReglagesPartiels = PartielProfond<ReglagesPartie>;

/**
 * Complete des reglages partiels avec les valeurs par defaut.
 *
 * La fusion descend dans les groupes: ne donner que la duree du bonus de vitesse
 * laisse intacts son taux d'apparition et tous les autres bonus.
 */
export function completerReglages(partiels?: ReglagesPartiels): ReglagesPartie {
  return fusionner(REGLAGES_PAR_DEFAUT, partiels);
}

/**
 * Les reglages d'une partie, une fois appliques ceux que son mode impose.
 *
 * Un mode peut retirer du jeu ce que ses regles n'admettent pas, quoi que l'hote ait
 * choisi. Le moteur applique cette fonction en creant l'etat, et c'est donc elle qui
 * fait foi; le salon lit les reglages de l'etat, et montre ce qui se jouera.
 *
 *   - La Chasse n'a pas de bots noirs (etape 7.3, decision 9 du porteur du projet): ses
 *     ninjas ne font aucun score, et un bot noir n'aurait rien a prendre. Elle n'a pas
 *     d'Evade non plus (etape 7.9, decision 2).
 *   - Le Massacre n'a pas de zone de chaos (etape 7.4, decision 6 du porteur du projet):
 *     elle repeint des bots dont la couleur ne compte pour personne.
 *   - Seul le Tactique a ses objets (etape 7.7): les autres modes en perdent le groupe, et
 *     leur etat reste identique a l'octet a ce qu'il etait avant eux. Le Tactique le
 *     retrouve s'il manquait.
 *   - Seul Among Ninjas a ses reglages (etape 7.20): les autres modes en perdent le groupe,
 *     comme celui des objets du Tactique. Among Ninjas impose Tokyo, retire les Black Ninjas,
 *     l'Evade, les bonus, les malus, les zones et les objets de poche, qui frappent au hasard
 *     et brouillent la deduction, et prend le nombre de PNJ de sa foule.
 *   - Pour le reste, les autres modes n'imposent rien: leurs reglages sont rendus tels
 *     quels, ce qui laisse leurs parties identiques a ce qu'elles etaient.
 */
export function imposerLesReglagesDuMode(mode: Mode, reglages: ReglagesPartie): ReglagesPartie {
  if (mode !== 'among' && reglages.among !== undefined) {
    const { among: _retires, ...sansAmong } = reglages;
    return imposerLesReglagesDuMode(mode, sansAmong);
  }

  if (mode === 'tactique') {
    return reglages.objetsTactiques === undefined
      ? { ...reglages, objetsTactiques: OBJETS_TACTIQUES_PAR_DEFAUT }
      : reglages;
  }

  if (reglages.objetsTactiques !== undefined) {
    const { objetsTactiques: _retires, ...sansObjetsTactiques } = reglages;
    return imposerLesReglagesDuMode(mode, sansObjetsTactiques);
  }

  if (mode === 'chasse' && (reglages.botsNoirs.actifs || reglages.evade)) {
    return { ...reglages, evade: false, botsNoirs: { ...reglages.botsNoirs, actifs: false } };
  }

  if (mode === 'among') {
    return reglagesDAmong(reglages);
  }

  if (mode === 'massacre' && reglages.zones.types.chaos) {
    return {
      ...reglages,
      zones: { ...reglages.zones, types: { ...reglages.zones.types, chaos: false } },
    };
  }

  return reglages;
}

/**
 * Les reglages d'une partie Among Ninjas: ceux de l'hote, moins tout ce que le mode retire.
 * Les objets du Tactique sont deja retires a ce point.
 */
function reglagesDAmong(reglages: ReglagesPartie): ReglagesPartie {
  const among = reglages.among ?? AMONG_PAR_DEFAUT;
  const sansBonus = Object.fromEntries(
    Object.entries(reglages.bonus.types).map(([nature, bonus]) => [
      nature,
      { ...bonus, actif: false },
    ]),
  ) as ReglagesBonus['types'];
  const sansObjetsDePoche = Object.fromEntries(
    Object.entries(reglages.objetsDePoche).map(([nature, objet]) => [
      nature,
      { ...objet, actif: false },
    ]),
  ) as ReglagesObjetsDePoche;

  return {
    ...reglages,
    carte: CARTE_DU_MODE_AMONG,
    evade: false,
    nombreBotsInitial: among.foule,
    bonus: { ...reglages.bonus, types: sansBonus },
    malus: { ...reglages.malus, actifs: false },
    zones: { ...reglages.zones, actives: false },
    botsNoirs: { ...reglages.botsNoirs, actifs: false },
    objetsDePoche: sansObjetsDePoche,
    among,
  };
}

/**
 * Recouvre une valeur de reference par les champs fournis, groupe par groupe.
 *
 * La fonction ne traite que des objets simples, ce que sont tous les reglages.
 * Les conversions de type sont inevitables ici: TypeScript ne sait pas exprimer
 * qu'une table de champs facultatifs recouvre exactement la table complete.
 */
function fusionner<T>(reference: T, recouvrement: PartielProfond<T> | undefined): T {
  if (recouvrement === undefined) {
    return reference;
  }

  const resultat: Record<string, unknown> = { ...(reference as Record<string, unknown>) };

  for (const [champ, valeur] of Object.entries(recouvrement as Record<string, unknown>)) {
    if (valeur === undefined) {
      continue;
    }

    const actuelle = resultat[champ];
    resultat[champ] =
      estObjetSimple(actuelle) && estObjetSimple(valeur)
        ? fusionner(actuelle, valeur as PartielProfond<Record<string, unknown>>)
        : valeur;
  }

  return resultat as T;
}

/** Un objet dans lequel la fusion doit descendre, par opposition a une valeur. */
function estObjetSimple(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}
