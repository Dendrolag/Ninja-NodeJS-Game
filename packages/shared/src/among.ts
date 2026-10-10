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

import type { Couleur, IdentifiantCarte } from './constantes.js';
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
} as const;

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

/** Les deux roles d'une partie. Un fantome garde le sien. */
export type RoleAmong = 'proie' | 'tueur';

/**
 * Les taches courtes (etape 7.21, fiche docs/plan/etape-7-21.md): sept gestes de quatre a cinq
 * secondes, joues dans la page. Le moteur n'en connait que la nature et la duree minimale.
 */
export const NATURES_DE_TACHE = [
  'katana',
  'lunettes',
  'sang',
  'couleurs',
  'mines',
  'munitions',
  'fumee',
] as const;

/** La nature d'une tache: le geste qu'elle demande. */
export type NatureDeTache = (typeof NATURES_DE_TACHE)[number];

/**
 * Le temps qu'il faut au moins entre l'ouverture d'une tache et sa fin, par nature (etude,
 * section 9.2): un client qui annonce sa tache finie plus tot est refuse. Un tricheur peut
 * sauter le geste, pas aller plus vite qu'un bon joueur. La page regle le rythme de chaque
 * geste pour qu'un joueur rapide et honnete finisse juste au-dessus.
 */
export const DUREES_MINIMALES_DES_TACHES_MS: Readonly<Record<NatureDeTache, number>> = {
  katana: 3000,
  lunettes: 3000,
  sang: 3500,
  couleurs: 3500,
  mines: 3500,
  munitions: 3500,
  fumee: 3000,
};

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
}

/** Les lieux du mode sur une carte: le point de reunion, ou sonne le gong, et les stations. */
export interface LieuxDuMode {
  readonly gong: Position;
  readonly stations: readonly StationDuMode[];
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
    // Les bornes d'arcade n'ont que des mini-jeux dans l'etude: le cablage d'une borne les
    // occupe en attendant l'etape 7.24, comme le rangement des mines la table de jeu.
    stations: [
      { x: 990, y: 190, nom: "Bornes d'arcade", natures: ['couleurs'] },
      { x: 740, y: 155, nom: "Table de jeu de l'arcade", natures: ['mines'] },
      { x: 700, y: 355, nom: "Lavabos de l'arcade", natures: ['lunettes', 'sang'] },
      { x: 170, y: 180, nom: 'Pierre du jardin zen', natures: ['katana'] },
      { x: 415, y: 490, nom: 'Distributeur du jardin', natures: ['fumee'] },
      { x: 1335, y: 80, nom: 'Camionnette du parking', natures: ['munitions'] },
      { x: 1690, y: 110, nom: 'Ordinateur de la maison', natures: ['couleurs'] },
      { x: 1800, y: 150, nom: 'Table de la maison', natures: ['lunettes'] },
      { x: 630, y: 1295, nom: 'Cuisine du restaurant', natures: ['sang', 'katana'] },
      { x: 1100, y: 1350, nom: 'Comptoir du salon', natures: ['mines'] },
      { x: 1320, y: 1070, nom: 'Tapis du salon', natures: ['fumee'] },
      { x: 1760, y: 1240, nom: 'Casiers de la salle violette', natures: ['munitions', 'mines'] },
      { x: 1600, y: 1045, nom: 'Bureaux de la salle violette', natures: ['couleurs'] },
    ],
  },
};

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

  return {
    gong: { x: largeur - lieux.gong.x, y: lieux.gong.y },
    stations: lieux.stations.map((station) => ({ ...station, x: largeur - station.x })),
  };
}
