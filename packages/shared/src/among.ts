/**
 * Le mode Among Ninjas: ses valeurs, ses lieux et ses couleurs (etape 7.20).
 *
 * Un mode de deduction sociale. Des tueurs anonymes eliminent en secret des proies, qui
 * font des taches a des stations de la carte. Un cadavre signale, ou le gong, ouvre une
 * reunion ou l'on discute puis vote pour ejecter un joueur. Les morts jouent en fantome.
 * Chacun ne voit que dans un rayon autour de lui.
 *
 * Les valeurs viennent de l'etude du 5 octobre 2026 (docs/design/etude-mode-among-ninjas.md),
 * confirmees ou corrigees par le porteur du projet le 6 octobre 2026 (fiche 7.20, section
 * « Valeurs confirmees »). Toutes se reverront apres une partie d'essai.
 *
 * Rien ici n'est une regle: les regles vivent dans le moteur (packages/sim/src/among.ts).
 * Ce fichier dit les nombres, les places et les noms que le moteur, le serveur et la page
 * partagent.
 */

import type { Couleur, IdentifiantCarte, TypeMalus } from './constantes.js';
import { CARTES } from './constantes.js';
import type { Position } from './geometrie.js';

/** Les nombres du mode. */
export const AMONG = {
  /** Il faut cinq joueurs pour lancer: a quatre, un seul meurtre reduit la partie a un duel. */
  JOUEURS_MINIMUM: 5,
  /**
   * L'attente du chargement de la carte, au lancement, au plus (demande du porteur du projet
   * du 10 octobre 2026): la revelation attend que chacun ait charge, pour que personne ne la
   * manque, mais un joueur bloque ou deconnecte ne retient pas la partie au-dela.
   */
  ATTENTE_DU_CHARGEMENT_MAXIMUM_MS: 30_000,
  /**
   * Un fantome va plus vite que les vivants (demande du porteur du projet du 10 octobre 2026):
   * 1,5 fois la vitesse commune, soit 225 pixels par seconde.
   */
  MULTIPLICATEUR_DES_FANTOMES: 1.5,
  /** La revelation du role, une fois tout le monde charge: le monde est fige pendant ce temps. */
  DUREE_REVELATION_MS: 5000,
  /** Le resultat d'un vote reste affiche ce temps, le monde fige. */
  DUREE_EJECTION_MS: 5000,
  /** La recharge du meurtre au debut de chaque tour, quel que soit le reglage. */
  RECHARGE_DEBUT_DE_TOUR_MS: 10_000,
  /**
   * Le meurtre se fait au contact (decision du porteur du projet du 6 octobre 2026: « le
   * tueur doit etre colle a sa victime »): deux ninjas de 32 pixels de diametre se touchent
   * quand leurs centres sont a 32 pixels. Une seule proie par meurtre.
   */
  PORTEE_DU_MEURTRE_PX: 32,
  /** On signale un cadavre a cette distance au plus, de centre a centre. */
  PORTEE_DU_SIGNALEMENT_PX: 100,
  /** On sonne le gong a cette distance au plus du point de reunion. */
  PORTEE_DU_GONG_PX: 100,
  /** Le gong ne sonne pas dans les premieres secondes d'un tour. */
  DELAI_DU_GONG_MS: 15_000,
  /** Le disque d'une station: on y ouvre sa tache, et on doit y rester pour la finir. */
  RAYON_D_UNE_STATION_PX: 50,
  /**
   * Combien de stations sont actives en plus du nombre de taches par proie: assez pour que
   * deux listes ne se ressemblent pas, pas toutes, pour que les lieux changent d'une partie a
   * l'autre (etude, section 9.5).
   */
  STATIONS_EN_PLUS_DES_TACHES: 4,
  /** Le cercle ou les vivants sont replaces autour du point de reunion. */
  RAYON_DU_CERCLE_DE_REUNION_PX: 90,
  /** La foule neutre au plus (de 0 a 80, decision du porteur du projet). */
  FOULE_MAXIMUM: 80,
  /** La foule neutre par defaut. */
  FOULE_PAR_DEFAUT: 40,
  /**
   * Les sabotages (etape 7.22, fiche docs/plan/etape-7-22.md), valeurs soumises au porteur du
   * projet le 10 octobre 2026. Un seul a la fois; entre deux, une recharge commune a tous les
   * assassins, qui part de la fin du precedent.
   */
  RECHARGE_DES_SABOTAGES_MS: 30_000,
  /** La recharge des sabotages au debut de chaque tour, comme le delai du gong. */
  RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS: 15_000,
  /** Une nuisance (vision floue, negative, commandes inversees) sur les proies vivantes. */
  DUREE_D_UNE_NUISANCE_MS: 10_000,
  /** Le nuage noir sur une station: qui s'y tient n'est vu que des assassins et des fantomes. */
  DUREE_DU_NUAGE_MS: 20_000,
  RAYON_DU_NUAGE_PX: 150,
  /** La panne de neons: le rayon de vision des proies vivantes, jusqu'a la reparation. */
  RAYON_DE_VISION_EN_PANNE_PX: 110,
  /** La surchauffe: le delai avant la victoire des assassins. */
  DELAI_DE_LA_SURCHAUFFE_MS: 45_000,
  /**
   * Les deux cles (etape 7.27): ce qu'il faut les tenir tournees ensemble, aux deux consoles
   * purgees, pour reparer la surchauffe.
   */
  REPARATION_DE_LA_SURCHAUFFE_MS: 1000,
  /** Le relais (etape 7.27): les interrupteurs a couper, d'une console a l'autre. */
  INTERRUPTEURS_DU_RELAIS: 4,
  /** Le disque du boitier et de chaque console, comme celui d'une station. */
  RAYON_D_UN_POSTE_PX: 50,
  /**
   * La malediction des fantomes (etape 7.22): une proie fantome inflige a tous les assassins
   * vivants l'un des trois malus des nuisances, a son choix (retour d'essai du porteur du projet
   * du 10 octobre 2026). Une recharge commune a tous les fantomes.
   */
  DUREE_DE_LA_MALEDICTION_MS: 8000,
  RECHARGE_DE_LA_MALEDICTION_MS: 45_000,
  /** Pas de malediction dans les premieres secondes d'un tour. */
  DELAI_DE_LA_MALEDICTION_MS: 15_000,
  /**
   * Les pas entendus (etape 7.23, fiche docs/plan/etape-7-23.md), valeurs soumises au porteur du
   * projet le 11 octobre 2026. Un vivant qui marche fait un pas a chaque foulee parcourue: a la
   * vitesse commune de 150 pixels par seconde, toutes les 250 millisecondes, la cadence de nos
   * propres pas.
   */
  FOULEE_PX: 37.5,
  /** On entend les pas d'un vivant jusqu'a cette distance, de centre a centre. */
  PORTEE_DES_PAS_PX: 500,
  /**
   * Le deguisement en PNJ (etape 7.28, fiche docs/plan/etape-7-28.md), decisions du porteur du
   * projet du 14 octobre 2026: vingt secondes pour les deux camps, sans cumul.
   */
  DUREE_DU_DEGUISEMENT_MS: 20_000,
  /** Un habit pris, le suivant apparait ailleurs ce temps de jeu plus tard. */
  REAPPARITION_DE_L_HABIT_MS: 45_000,
  /**
   * Une proie prend l'habit en passant dessus: son centre a cette distance au plus de celui de
   * l'habit, le rayon d'un ninja (16 pixels) et un peu plus que celui de l'habit dessine.
   */
  PORTEE_DE_L_HABIT_PX: 28,
  /**
   * L'habit se pose loin du gong et des stations (fiche, « La proie »): la ou l'on ne passe pas
   * forcement, et ou personne ne le trouve en faisant sa tache.
   */
  ECART_DE_L_HABIT_AU_GONG_PX: 250,
  ECART_DE_L_HABIT_AUX_STATIONS_PX: 120,
} as const;

/**
 * Les paliers de distance d'un pas entendu hors de vue (etape 7.23): proche, moyen, loin, par
 * leur borne haute, en pixels. Le dernier est la portee des pas.
 */
export const PALIERS_DES_PAS_PX = [170, 335, AMONG.PORTEE_DES_PAS_PX] as const;

/**
 * Combien de secteurs de direction pour un pas entendu hors de vue: huit, de 45 degres chacun.
 * Le secteur zero est l'est, et ils tournent dans le sens des aiguilles d'une montre a l'ecran,
 * ou l'axe vertical descend: le secteur deux est le sud.
 */
export const SECTEURS_DES_PAS = 8;

/**
 * Un pas entendu hors de vue (etape 7.23): d'ou il vient, arrondi, et a quelle distance, en
 * palier. Ni position, ni marcheur: assez pour l'oreille, trop peu pour un radar.
 */
export interface PasEntendu {
  /** La direction, de zero a SECTEURS_DES_PAS moins un. */
  readonly secteur: number;
  /** La distance: le rang de son palier dans PALIERS_DES_PAS_PX. */
  readonly palier: number;
}

/**
 * Le pas qu'on entend d'un marcheur a cet ecart de soi (de soi vers lui), ou rien s'il est hors
 * de portee. Un ecart nul, qui n'arrive pas, est a l'est.
 */
export function pasEntendu(ecart: Position): PasEntendu | undefined {
  const distance = Math.hypot(ecart.x, ecart.y);
  const palier = PALIERS_DES_PAS_PX.findIndex((borne) => distance <= borne);

  if (palier < 0) {
    return undefined;
  }

  const angle = Math.atan2(ecart.y, ecart.x);
  const secteur =
    (Math.round(angle / ((2 * Math.PI) / SECTEURS_DES_PAS)) + SECTEURS_DES_PAS) % SECTEURS_DES_PAS;

  return { secteur, palier };
}

/**
 * L'ecart que la page prete a un pas entendu hors de vue, pour le placer: au milieu de son
 * secteur, et au milieu de son palier.
 */
export function ecartDUnPas(pas: PasEntendu): Position {
  const basse = pas.palier === 0 ? 0 : (PALIERS_DES_PAS_PX[pas.palier - 1] ?? 0);
  const haute = PALIERS_DES_PAS_PX[pas.palier] ?? AMONG.PORTEE_DES_PAS_PX;
  const distance = (basse + haute) / 2;
  const angle = (pas.secteur * 2 * Math.PI) / SECTEURS_DES_PAS;

  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

/**
 * Ou en est une partie lancee.
 *
 *   - `chargement`: la revelation attend que chacun ait charge la carte, le monde est fige;
 *   - `revelation`: chacun decouvre son role, le monde est fige;
 *   - `jeu`: on bouge, on tue, on fait ses taches;
 *   - `discussion` puis `vote`: la reunion, le monde est fige;
 *   - `ejection`: le resultat du vote s'affiche, le monde est fige.
 */
export const PHASES_AMONG = [
  'chargement',
  'revelation',
  'jeu',
  'discussion',
  'vote',
  'ejection',
] as const;

/** Une phase d'une partie lancee. */
export type PhaseAmong = (typeof PHASES_AMONG)[number];

/** Pourquoi une reunion s'est ouverte: un cadavre signale, le gong, ou le terme du tour. */
export type MotifDeReunion = 'cadavre' | 'gong' | 'temps';

/** Un camp, celui qui gagne. */
export type CampAmong = 'proies' | 'tueurs';

/** Les paliers de vision qu'un hote choisit pour chaque role. */
export const PALIERS_DE_VISION = ['reduite', 'normale', 'large'] as const;

/** Un palier de vision. */
export type PalierDeVision = (typeof PALIERS_DE_VISION)[number];

/**
 * Les sabotages d'un assassin (etape 7.22). Les trois premiers, les nuisances, sont les malus du
 * jeu, sur les proies vivantes. Puis le nuage noir sur une station, la panne de neons et la
 * surchauffe, qui se repare a deux ou fait gagner les assassins.
 */
export const NATURES_DE_SABOTAGE = [
  'flou',
  'negatif',
  'controlesInverses',
  'nuage',
  'panne',
  'surchauffe',
] as const;

/** Un sabotage. */
export type NatureDeSabotage = (typeof NATURES_DE_SABOTAGE)[number];

/** Une nuisance: un sabotage qui est un malus du jeu. */
export type Nuisance = NatureDeSabotage & TypeMalus;

/**
 * Les nuisances: les sabotages qui sont des malus du jeu. Ce sont aussi les trois maledictions
 * qu'une proie fantome peut infliger aux assassins.
 */
export const NUISANCES: readonly Nuisance[] = ['flou', 'negatif', 'controlesInverses'];

/** Ce sabotage est-il une nuisance, un malus du jeu ? */
export function estUneNuisance(nature: NatureDeSabotage): nature is Nuisance {
  return (NUISANCES as readonly NatureDeSabotage[]).includes(nature);
}

/** Les deux roles d'une partie. Un fantome garde le sien. */
export type RoleAmong = 'proie' | 'tueur';

/**
 * Les taches courtes (etape 7.21, fiche docs/plan/etape-7-21.md): sept gestes de quatre a cinq
 * secondes, joues dans la page.
 */
export const NATURES_COURTES = [
  'katana',
  'lunettes',
  'sang',
  'couleurs',
  'mines',
  'munitions',
  'fumee',
] as const;

/**
 * Les taches longues (etape 7.24, fiche docs/plan/etape-7-24.md): quatre mini-jeux d'arcade de
 * quinze a vingt-cinq secondes, joues dans la page, pendant lesquels la proie reste immobile et
 * vulnerable. Leurs noms sont a nous, pas ceux des jeux dont ils s'inspirent (reponse 4 du
 * porteur du projet, 11 octobre 2026): des caisses a empiler, un serpent, des Black Ninjas a
 * repousser, une bataille navale.
 */
export const NATURES_LONGUES = ['caisses', 'serpent', 'envahisseurs', 'bataille'] as const;

/**
 * Toutes les taches, courtes puis longues. Le moteur n'en connait que la nature et la duree
 * minimale: les gestes et les mini-jeux vivent dans la page.
 */
export const NATURES_DE_TACHE = [...NATURES_COURTES, ...NATURES_LONGUES] as const;

/** La nature d'une tache: le geste ou le mini-jeu qu'elle demande. */
export type NatureDeTache = (typeof NATURES_DE_TACHE)[number];

/** La nature d'une tache courte. */
export type NatureCourte = (typeof NATURES_COURTES)[number];

/** La nature d'une tache longue. */
export type NatureLongue = (typeof NATURES_LONGUES)[number];

/** Cette tache est-elle un mini-jeu, une tache longue. */
export function estUneTacheLongue(nature: NatureDeTache): nature is NatureLongue {
  return (NATURES_LONGUES as readonly NatureDeTache[]).includes(nature);
}

/**
 * Le temps qu'il faut au moins entre l'ouverture d'une tache et sa fin, par nature (etude,
 * section 9.2): un client qui annonce sa tache finie plus tot est refuse. Un tricheur peut
 * sauter le geste, pas aller plus vite qu'un bon joueur. La page regle le rythme de chaque
 * geste et de chaque mini-jeu pour qu'un joueur rapide et honnete finisse juste au-dessus.
 */
export const DUREES_MINIMALES_DES_TACHES_MS: Readonly<Record<NatureDeTache, number>> = {
  katana: 3000,
  lunettes: 3000,
  sang: 3500,
  couleurs: 3500,
  mines: 3500,
  munitions: 3500,
  fumee: 3000,
  caisses: 12_000,
  serpent: 12_000,
  envahisseurs: 12_000,
  bataille: 12_000,
};

/**
 * Les reparations de la panne de neons (etape 7.27, fiche docs/plan/etape-7-27.md): relancer le
 * generateur, changer les fusibles grilles, accorder la frequence. Chaque partie en tire une, au
 * lancement, gardee toute la partie. Plus aucune ne se fait en tenant seulement le bouton
 * d'action: c'est un geste, joue dans la fenetre des taches.
 */
export const REPARATIONS_DE_LA_PANNE = ['lanceur', 'fusibles', 'frequence'] as const;

/** Une reparation de la panne de neons. */
export type ReparationDeLaPanne = (typeof REPARATIONS_DE_LA_PANNE)[number];

/**
 * Les reparations de la surchauffe (etape 7.27): les deux cles, ou chaque console se purge puis
 * se repare cle tournee, ensemble; et le relais, des interrupteurs coupes d'une console a l'autre.
 * Chaque partie en tire une, comme pour la panne.
 */
export const REPARATIONS_DE_LA_SURCHAUFFE = ['cles', 'relais'] as const;

/** Une reparation de la surchauffe. */
export type ReparationDeLaSurchauffe = (typeof REPARATIONS_DE_LA_SURCHAUFFE)[number];

/** Les cinq reparations, celles de la panne puis celles de la surchauffe. */
export const NATURES_DE_REPARATION = [
  ...REPARATIONS_DE_LA_PANNE,
  ...REPARATIONS_DE_LA_SURCHAUFFE,
] as const;

/** Une reparation, de la panne ou de la surchauffe. */
export type NatureDeReparation = (typeof NATURES_DE_REPARATION)[number];

/**
 * Les gestes d'une reparation, que la page joue et dont elle annonce la fin: chacune des trois
 * reparations de la panne, la purge d'une console des deux cles, et un interrupteur du relais.
 */
export type GesteDeReparation = ReparationDeLaPanne | 'purge' | 'interrupteur';

/**
 * Le temps qu'il faut au moins a chaque geste d'une reparation (etape 7.27), compte par le
 * serveur: de l'ouverture de la reparation, et, pour un interrupteur, du dernier interrupteur
 * coupe. Une fin annoncee plus tot est ignoree. Les trois de la panne prennent les 3 secondes de
 * l'ancienne reparation tenue.
 */
export const DUREES_MINIMALES_DES_REPARATIONS_MS: Readonly<Record<GesteDeReparation, number>> = {
  lanceur: 3000,
  fusibles: 3000,
  frequence: 3000,
  purge: 2000,
  interrupteur: 600,
};

/** Le poste d'une reparation: le boitier de la panne, ou l'une des deux consoles, par son rang. */
export type PosteDeReparation = 'boitier' | 0 | 1;

/**
 * Les taches visuelles (etude, section 9.3): leur fin se voit de pres, des etincelles sur la
 * pierre, une bouffee de fumee. Seule une vraie proie vivante les produit: une preuve
 * d'innocence, reglage de l'hote.
 */
export const TACHES_VISUELLES: readonly NatureDeTache[] = ['katana', 'fumee'];

/**
 * Quand la barre commune des taches se montre aux vivants: toujours, a jour; en reunion
 * seulement, figee pendant le jeu au compte de la derniere reunion; ou jamais.
 */
export const BARRES_DES_TACHES = ['toujours', 'reunions', 'jamais'] as const;

/** Un reglage de la barre des taches. */
export type BarreDesTaches = (typeof BARRES_DES_TACHES)[number];

/**
 * Le rayon de vision de chaque role, par palier, en pixels. Le porteur du projet trouvait le
 * tueur trop bien servi a 380 pixels: le palier par defaut du tueur est 320, et 380 devient
 * son palier large.
 */
export const RAYONS_DE_VISION: Readonly<
  Record<RoleAmong, Readonly<Record<PalierDeVision, number>>>
> = {
  proie: { reduite: 200, normale: 260, large: 320 },
  tueur: { reduite: 260, normale: 320, large: 380 },
};

/** Les durees maximales d'un tour qu'un hote peut choisir, en secondes. Zero: aucune. */
export const DUREES_DE_TOUR_S = [0, 120, 180, 300] as const;

/**
 * Les points du sous-classement de fin, par fait de jeu (decision du porteur du projet du 6
 * octobre 2026: le camp vainqueur d'abord, puis des points tires de faits de jeu). Valeurs de
 * depart, a revoir apres une partie d'essai.
 */
export const POINTS_AMONG = {
  /** Une tache faite, vivant ou fantome. */
  TACHE: 10,
  /** Un cadavre signale. */
  SIGNALEMENT: 15,
  /** Un vote contre un tueur que ce vote a ejecte. */
  BON_VOTE: 20,
  /** Un meurtre. */
  MEURTRE: 30,
  /** En plus du bon vote: le tueur ejecte des la premiere reunion. */
  TUEUR_TROUVE_A_LA_PREMIERE_REUNION: 25,
  /** Deux meurtres ou plus des le premier tour. */
  DEUX_MEURTRES_AU_PREMIER_TOUR: 25,
} as const;

/**
 * Combien de tueurs une partie admet au plus, selon son nombre de joueurs: un de cinq a six,
 * deux de sept a huit, trois au-dela (etude, section 5). Jamais moins d'un.
 */
export function tueursMaximum(joueurs: number): number {
  if (joueurs >= 9) {
    return 3;
  }

  return joueurs >= 7 ? 2 : 1;
}

/** Une couleur de joueur de ce mode, et son nom, montre au salon, en reunion et a la fin. */
export interface CouleurNommee {
  readonly couleur: Couleur;
  readonly nom: string;
}

/**
 * Les douze couleurs des joueurs de ce mode (micro-decision 13 de la fiche): toute
 * accusation passe par une couleur, « j'ai vu Orange ». Distinctes deux a deux, lisibles sur
 * Tokyo, et aucune n'est le gris de la foule. Aucune n'est sombre non plus: seul le Black
 * Ninja l'est (luminance de 0,18 au moins, defaut X38).
 */
export const COULEURS_NOMMEES: readonly CouleurNommee[] = [
  { couleur: '#FF3030', nom: 'Rouge' },
  { couleur: '#3D7DFF', nom: 'Bleu' },
  { couleur: '#1FBF4C', nom: 'Vert' },
  { couleur: '#FFE81A', nom: 'Jaune' },
  { couleur: '#FF8C1A', nom: 'Orange' },
  { couleur: '#9A55FF', nom: 'Violet' },
  { couleur: '#FF5FD2', nom: 'Rose' },
  { couleur: '#2EE6FF', nom: 'Cyan' },
  { couleur: '#F5F5F5', nom: 'Blanc' },
  { couleur: '#A8FF3E', nom: 'Lime' },
  { couleur: '#B06A2C', nom: 'Marron' },
  { couleur: '#E0406E', nom: 'Framboise' },
];

/** Les douze couleurs seules, dans l'ordre de leur tirage. */
export const COULEURS_DES_JOUEURS_AMONG: readonly Couleur[] = COULEURS_NOMMEES.map(
  (nommee) => nommee.couleur,
);

/** Le nom d'une couleur de ce mode, ou undefined pour une autre couleur. */
export function nomDeCouleur(couleur: Couleur): string | undefined {
  const cherchee = couleur.toUpperCase();

  return COULEURS_NOMMEES.find((nommee) => nommee.couleur.toUpperCase() === cherchee)?.nom;
}

/**
 * Le gris de la foule neutre (micro-decision 12 de la fiche): reserve a ce mode, qu'aucun
 * joueur ne recoit. La foule ne prend pas les couleurs des joueurs, a l'inverse des sosies de
 * la Chasse: une accusation qui passe par une couleur deviendrait douteuse.
 */
export const COULEUR_DE_LA_FOULE: Couleur = '#7F8A99';

/**
 * Une station: sa place, son nom, montre sur la carte (« j'etais a la pierre du jardin zen »
 * est un alibi), et les taches qui lui vont. La tache de chaque proie a une station se tire
 * parmi elles.
 */
export interface StationDuMode extends Position {
  readonly nom: string;
  readonly natures: readonly NatureDeTache[];
  /**
   * Les places ou la station peut se tenir, quand son meuble est plusieurs fois sur la carte (16
   * octobre 2026, demande du porteur du projet): chaque partie en tire une, si bien qu'on ne la
   * trouve pas toujours au meme endroit. La place de la station (x, y) est la premiere. Absentes
   * d'une station qui ne bouge pas, et de la station tiree d'une partie lancee.
   */
  readonly places?: readonly Position[];
  /**
   * L'objet du decor peint au fond de la fenetre des taches de cette station (16 octobre 2026):
   * le tapis du salon, sous le sang a nettoyer. Le nom de son image (cheminObjetDuDecor).
   */
  readonly fondDesTaches?: string;
}

/**
 * Le lieu qu'habille un objet du decor: le gong, le boitier, une station, dite par son nom, ou
 * une console de la surchauffe, par son rang.
 */
export type LieuDUnObjet =
  'gong' | 'boitier' | { readonly station: string } | { readonly console: 0 | 1 };

/**
 * Un objet du decor du mode (demande du porteur du projet du 13 octobre 2026): une image posee
 * sur un lieu, a la place du cercle qui le marquait, toujours la pendant une partie d'Among
 * Ninjas. Il s'eclaire pour qui peut s'en servir. L'image est rangee avec sa carte
 * (cheminObjetDuDecor), plus grande qu'affichee pour rester nette: elle se pose a la taille
 * dite ici, en pixels de carte, choisie a cote des ninjas de 32 pixels.
 */
export interface ObjetDuDecor {
  /** Le lieu qu'il habille, centre sur sa place, ou sur la sienne propre. */
  readonly lieu: LieuDUnObjet;
  /** Le nom de son image, sans extension. */
  readonly image: string;
  readonly largeur: number;
  readonly hauteur: number;
  /**
   * Sa place propre, en pixels de carte, quand il ne se pose pas au centre de son lieu: un meuble
   * du decor, sur lequel on ne peut pas se tenir, et devant lequel est la station (16 octobre
   * 2026).
   */
  readonly place?: Position;
  /**
   * La place de la station qu'il sert, parmi les places de sa station (StationDuMode.places): il
   * ne s'eclaire que si la partie a tire celle-la. Absente: la place de sa station.
   */
  readonly devant?: Position;
  /** Son image se pose retournee de gauche a droite: le meuble regarde de l'autre cote. */
  readonly retourne?: boolean;
  /**
   * Une decoupe du fond de sa carte, livree a la resolution du fond (16 octobre 2026): elle se
   * pose etiree comme lui, pour s'y superposer au pixel pres, et non agrandie deux fois.
   */
  readonly decoupe?: boolean;
}

/**
 * Les lieux du mode sur une carte: le point de reunion, ou sonne le gong, les stations, et les
 * postes des sabotages (etape 7.22): le boitier ou l'on repare la panne de neons, et les deux
 * consoles de la surchauffe. Et les objets qui en habillent certains: un lieu sans objet garde
 * son dessin neon.
 */
export interface LieuxDuMode {
  readonly gong: Position;
  readonly stations: readonly StationDuMode[];
  readonly boitier: Position;
  readonly consoles: readonly [Position, Position];
  readonly objets: readonly ObjetDuDecor[];
}

/**
 * Les lieux du mode, carte par carte, dans le sens normal. Seule Tokyo en a pour l'essai: le
 * mode lui impose sa carte.
 *
 * Les places partent de l'etude (section 10), lues sur le decor, et se verifient sur le
 * terrain reel, en normal et en miroir, par les tests du serveur (terrain.test.ts): le centre
 * de chacune tenable, dans le morceau principal de la carte, et la majeure partie de son disque
 * praticable. Le gong est le passage pieton central.
 *
 * Une station se pose donc DEVANT son meuble, pas dessus: cinq d'entre elles avaient leur
 * centre sur le meuble, dans un mur, et le joueur devait se tenir au bord du disque, jusqu'a
 * 38 pixels sur 50 devant la table de la maison (10 octobre 2026, ecrit avec le scenario de
 * bout en bout de l'etape 7.20).
 */
export const LIEUX_DES_CARTES: Readonly<Partial<Record<IdentifiantCarte, LieuxDuMode>>> = {
  map1: {
    gong: { x: 1145, y: 630 },
    // Chaque mini-jeu se joue a deux stations, dans deux quartiers, pour que les assassins ne
    // sachent pas ou guetter (reponse 2 du porteur du projet, 11 octobre 2026); chacune de ces
    // stations garde sa tache courte.
    stations: [
      {
        x: 946,
        y: 84,
        nom: "Bornes roses de l'arcade",
        natures: ['couleurs', 'caisses', 'serpent', 'envahisseurs'],
        places: [
          { x: 946, y: 84 },
          { x: 1039, y: 84 },
          { x: 946, y: 166 },
          { x: 1039, y: 167 },
          { x: 946, y: 248 },
          { x: 1039, y: 249 },
          { x: 922, y: 359 },
          { x: 991, y: 359 },
          { x: 1061, y: 359 },
        ],
      },
      {
        x: 1198,
        y: 69,
        nom: "Bornes rouges de l'arcade",
        natures: ['mines', 'bataille'],
        places: [
          { x: 1198, y: 69 },
          { x: 644, y: 97 },
          { x: 1199, y: 151 },
          { x: 645, y: 180 },
          { x: 1199, y: 235 },
          { x: 647, y: 254 },
          { x: 1201, y: 319 },
        ],
      },
      { x: 700, y: 355, nom: "Lavabos de l'arcade", natures: ['lunettes', 'sang'] },
      { x: 170, y: 180, nom: 'Pierre du jardin zen', natures: ['katana'] },
      {
        x: 415,
        y: 490,
        nom: 'Distributeur du jardin',
        natures: ['fumee'],
      },
      {
        x: 1369,
        y: 100,
        nom: 'Véhicules du parking',
        natures: ['munitions'],
        places: [
          { x: 1369, y: 100 },
          { x: 1369, y: 316 },
          { x: 803, y: 1110 },
        ],
      },
      { x: 1690, y: 110, nom: 'Ordinateur de la maison', natures: ['couleurs', 'serpent'] },
      {
        x: 1898,
        y: 229,
        nom: 'Meubles de la maison',
        natures: ['lunettes', 'bataille'],
        places: [
          { x: 1898, y: 229 },
          { x: 1731, y: 366 },
        ],
      },
      { x: 630, y: 1295, nom: 'Cuisine du restaurant', natures: ['sang', 'katana'] },
      {
        x: 1429,
        y: 991,
        nom: "Entrée de l'hôtel",
        natures: ['mines'],
        places: [
          { x: 1429, y: 991 },
          { x: 1132, y: 1008 },
        ],
      },
      {
        x: 1320,
        y: 1070,
        nom: 'Tapis du salon',
        natures: ['sang'],
        fondDesTaches: 'tapis-hotel',
      },
      {
        x: 1875,
        y: 1008,
        nom: 'Commodes de la salle violette',
        natures: ['munitions', 'mines'],
        places: [
          { x: 1875, y: 1008 },
          { x: 1878, y: 1135 },
          { x: 1878, y: 1246 },
          { x: 1450, y: 1274 },
          { x: 1879, y: 1359 },
        ],
      },
      {
        x: 1623,
        y: 1042,
        nom: 'Futons de la salle violette',
        natures: ['couleurs', 'caisses', 'envahisseurs'],
        places: [
          { x: 1623, y: 1042 },
          { x: 1624, y: 1190 },
        ],
      },
    ],
    // Les postes des sabotages, lus par l'etude (section 10) et sondes sur le terrain au debut de
    // l'etape 7.22: le boitier de la rue, et les consoles au pied des lampadaires nord-ouest et
    // sud-est. Les consoles etaient sur les lampadaires; leur image posee (14 octobre 2026),
    // elles s'ecartent du lampadaire, dessine au premier plan et qui la traversait: sous lui au
    // nord-ouest, a sa gauche au sud-est, a 1 415 pixels l'une de l'autre.
    boitier: { x: 1330, y: 495 },
    consoles: [
      { x: 485, y: 355 },
      { x: 1795, y: 890 },
    ],
    // Le pavillon du gong sur le passage pieton, le generateur sur le carton de la rue, la
    // pierre au milieu du jardin zen, et la console sur chacun des deux lampadaires, aux
    // proportions de leurs images (249 sur 288, 192 sur 91, 192 sur 192, et 300 sur 267). La
    // pierre tient dans le disque de sa station, de 100 pixels.
    objets: [
      { lieu: 'gong', image: 'gong', largeur: 97, hauteur: 112 },
      { lieu: 'boitier', image: 'generator', largeur: 72, hauteur: 34 },
      {
        lieu: { station: 'Pierre du jardin zen' },
        image: 'pierre-jardin',
        largeur: 96,
        hauteur: 96,
      },
      { lieu: { console: 0 }, image: 'console', largeur: 72, hauteur: 64 },
      { lieu: { console: 1 }, image: 'console', largeur: 72, hauteur: 64 },
      // Les meubles livres par le porteur du projet le 16 octobre 2026, decoupes du fond: un
      // objet par exemplaire du meuble sur la carte, pose sur lui au pixel pres, et la place de
      // la station qu'il sert, devant lui (docs/design/etape-7-28/3-stations-proposees.png).
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-profil',
        largeur: 31.33,
        hauteur: 59.25,
        place: { x: 920.33, y: 73.88 },
        devant: { x: 946, y: 84 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-profil',
        largeur: 31.33,
        hauteur: 59.25,
        place: { x: 1065, y: 73.88 },
        devant: { x: 1039, y: 84 },
        retourne: true,
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-profil',
        largeur: 31.33,
        hauteur: 59.25,
        place: { x: 920.33, y: 156.38 },
        devant: { x: 946, y: 166 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-profil',
        largeur: 31.33,
        hauteur: 59.25,
        place: { x: 1065, y: 156.38 },
        devant: { x: 1039, y: 167 },
        retourne: true,
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-profil',
        largeur: 31.33,
        hauteur: 59.25,
        place: { x: 920.33, y: 238.88 },
        devant: { x: 946, y: 248 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-profil',
        largeur: 31.33,
        hauteur: 59.25,
        place: { x: 1065, y: 238.88 },
        devant: { x: 1039, y: 249 },
        retourne: true,
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-face',
        largeur: 26.67,
        hauteur: 59.25,
        place: { x: 922, y: 322.88 },
        devant: { x: 922, y: 359 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-face',
        largeur: 26.67,
        hauteur: 59.25,
        place: { x: 991.33, y: 322.88 },
        devant: { x: 991, y: 359 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes roses de l'arcade" },
        image: 'borne-arcade-rose-face',
        largeur: 26.67,
        hauteur: 59.25,
        place: { x: 1060.67, y: 322.88 },
        devant: { x: 1061, y: 359 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes rouges de l'arcade" },
        image: 'borne-arcade-rouge-profil',
        largeur: 23.33,
        hauteur: 63,
        place: { x: 1223.67, y: 72 },
        devant: { x: 1198, y: 69 },
        retourne: true,
        decoupe: true,
      },
      {
        lieu: { station: "Bornes rouges de l'arcade" },
        image: 'borne-arcade-rouge-profil',
        largeur: 23.33,
        hauteur: 63,
        place: { x: 619.67, y: 99 },
        devant: { x: 644, y: 97 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes rouges de l'arcade" },
        image: 'borne-arcade-rouge-profil',
        largeur: 23.33,
        hauteur: 63,
        place: { x: 1224.33, y: 155.25 },
        devant: { x: 1199, y: 151 },
        retourne: true,
        decoupe: true,
      },
      {
        lieu: { station: "Bornes rouges de l'arcade" },
        image: 'borne-arcade-rouge-profil',
        largeur: 23.33,
        hauteur: 63,
        place: { x: 619.67, y: 183 },
        devant: { x: 645, y: 180 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes rouges de l'arcade" },
        image: 'borne-arcade-rouge-profil',
        largeur: 23.33,
        hauteur: 63,
        place: { x: 1224.33, y: 239.25 },
        devant: { x: 1199, y: 235 },
        retourne: true,
        decoupe: true,
      },
      {
        lieu: { station: "Bornes rouges de l'arcade" },
        image: 'borne-arcade-rouge-profil',
        largeur: 23.33,
        hauteur: 63,
        place: { x: 619.67, y: 267 },
        devant: { x: 647, y: 254 },
        decoupe: true,
      },
      {
        lieu: { station: "Bornes rouges de l'arcade" },
        image: 'borne-arcade-rouge-profil',
        largeur: 23.33,
        hauteur: 63,
        place: { x: 1224.33, y: 323.25 },
        devant: { x: 1201, y: 319 },
        retourne: true,
        decoupe: true,
      },
      {
        lieu: { station: 'Distributeur du jardin' },
        image: 'distributeur-face',
        largeur: 30,
        hauteur: 51,
        place: { x: 419, y: 450.75 },
        devant: { x: 415, y: 490 },
        decoupe: true,
      },
      {
        lieu: { station: 'Véhicules du parking' },
        image: 'voiture-jaune-profil',
        largeur: 70.67,
        hauteur: 62.25,
        place: { x: 1322.67, y: 115.88 },
        devant: { x: 1369, y: 100 },
        decoupe: true,
      },
      {
        lieu: { station: 'Véhicules du parking' },
        image: 'voiture-blanche-profil',
        largeur: 70.67,
        hauteur: 63,
        place: { x: 1324, y: 331.5 },
        devant: { x: 1369, y: 316 },
        decoupe: true,
      },
      {
        lieu: { station: 'Véhicules du parking' },
        image: 'camionnette-grise',
        largeur: 46.67,
        hauteur: 83.25,
        place: { x: 764.67, y: 1096.12 },
        devant: { x: 803, y: 1110 },
        decoupe: true,
      },
      {
        lieu: { station: 'Meubles de la maison' },
        image: 'buffet-salon',
        largeur: 26,
        hauteur: 167.25,
        place: { x: 1930.33, y: 164.62 },
        devant: { x: 1898, y: 229 },
        decoupe: true,
      },
      {
        lieu: { station: 'Meubles de la maison' },
        image: 'table-basse-salon',
        largeur: 21.33,
        hauteur: 25.5,
        place: { x: 1714, y: 367.5 },
        devant: { x: 1731, y: 366 },
        decoupe: true,
      },
      {
        lieu: { station: "Entrée de l'hôtel" },
        image: 'distributeur-rouge-face',
        largeur: 29.33,
        hauteur: 50.25,
        place: { x: 1450, y: 965.62 },
        devant: { x: 1429, y: 991 },
        decoupe: true,
      },
      {
        lieu: { station: "Entrée de l'hôtel" },
        image: 'meuble-entree-hotel',
        largeur: 24.67,
        hauteur: 49.5,
        place: { x: 1091, y: 984.75 },
        devant: { x: 1132, y: 1008 },
        decoupe: true,
      },
      {
        lieu: { station: 'Tapis du salon' },
        image: 'tapis-hotel',
        largeur: 154.67,
        hauteur: 174.75,
        place: { x: 1319.33, y: 1075.88 },
        devant: { x: 1320, y: 1070 },
        decoupe: true,
      },
      {
        lieu: { station: 'Commodes de la salle violette' },
        image: 'commode',
        largeur: 28.67,
        hauteur: 43.5,
        place: { x: 1899, y: 1002 },
        devant: { x: 1875, y: 1008 },
        decoupe: true,
      },
      {
        lieu: { station: 'Commodes de la salle violette' },
        image: 'commode',
        largeur: 28.67,
        hauteur: 43.5,
        place: { x: 1899, y: 1115.25 },
        devant: { x: 1878, y: 1135 },
        decoupe: true,
      },
      {
        lieu: { station: 'Commodes de la salle violette' },
        image: 'commode',
        largeur: 28.67,
        hauteur: 43.5,
        place: { x: 1899, y: 1226.25 },
        devant: { x: 1878, y: 1246 },
        decoupe: true,
      },
      {
        lieu: { station: 'Commodes de la salle violette' },
        image: 'commode',
        largeur: 28.67,
        hauteur: 43.5,
        place: { x: 1474.33, y: 1281 },
        devant: { x: 1450, y: 1274 },
        decoupe: true,
      },
      {
        lieu: { station: 'Commodes de la salle violette' },
        image: 'commode',
        largeur: 28.67,
        hauteur: 43.5,
        place: { x: 1900.33, y: 1337.25 },
        devant: { x: 1879, y: 1359 },
        decoupe: true,
      },
      {
        lieu: { station: 'Futons de la salle violette' },
        image: 'futon-profil',
        largeur: 40,
        hauteur: 27,
        place: { x: 1596.67, y: 1041 },
        devant: { x: 1623, y: 1042 },
        decoupe: true,
      },
      {
        lieu: { station: 'Futons de la salle violette' },
        image: 'futon-profil',
        largeur: 40,
        hauteur: 27,
        place: { x: 1598, y: 1190.25 },
        devant: { x: 1624, y: 1190 },
        decoupe: true,
      },
    ],
  },
};

/**
 * La place d'un objet du decor parmi les lieux du mode: celle du gong, du boitier, de la
 * station qui porte son nom, ou de la console de ce rang. Undefined pour une station inconnue.
 */
export function placeDUnObjet(lieux: LieuxDuMode, lieu: LieuDUnObjet): Position | undefined {
  if (typeof lieu === 'string') {
    return lieux[lieu];
  }

  if ('console' in lieu) {
    return lieux.consoles[lieu.console];
  }

  return lieux.stations.find((station) => station.nom === lieu.station);
}

/** Ce qui distingue le lieu d'un objet des autres: « gong », « station:<nom> », « console:0 ». */
export function cleDUnLieu(lieu: LieuDUnObjet): string {
  if (typeof lieu === 'string') {
    return lieu;
  }

  return 'console' in lieu ? `console:${String(lieu.console)}` : `station:${lieu.station}`;
}

/** La carte que le mode impose (micro-decision 8 de la fiche): Tokyo, pour l'essai. */
export const CARTE_DU_MODE_AMONG: IdentifiantCarte = 'map1';

/**
 * Les lieux du mode tels qu'ils se jouent: retournes avec la carte en miroir (etape 8.3), ou
 * le gauche devient le droit. Undefined pour une carte qui n'en a pas.
 */
export function lieuxDuMode(carte: IdentifiantCarte, miroir: boolean): LieuxDuMode | undefined {
  const lieux = LIEUX_DES_CARTES[carte];

  if (lieux === undefined || !miroir) {
    return lieux;
  }

  const largeur = CARTES[carte].largeur;
  const retourner = (place: Position): Position => ({ x: largeur - place.x, y: place.y });

  return {
    gong: retourner(lieux.gong),
    stations: lieux.stations.map((station) => ({
      ...station,
      x: largeur - station.x,
      ...(station.places === undefined ? {} : { places: station.places.map(retourner) }),
    })),
    boitier: retourner(lieux.boitier),
    consoles: [retourner(lieux.consoles[0]), retourner(lieux.consoles[1])],
    // Un objet suit son lieu, ou sa place propre; son image se retourne avec le decor, dans la
    // page.
    objets: lieux.objets.map((objet) => ({
      ...objet,
      ...(objet.place === undefined ? {} : { place: retourner(objet.place) }),
      ...(objet.devant === undefined ? {} : { devant: retourner(objet.devant) }),
    })),
  };
}
