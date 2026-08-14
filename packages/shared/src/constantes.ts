/**
 * Constantes de jeu partagees par le moteur, le serveur et le client.
 *
 * Portage de legacy/game-constants.js. Deux differences de fond avec l'original,
 * toutes deux voulues:
 *
 * 1. Les dimensions de carte ne sont plus des accesseurs dynamiques qui vont
 *    lire une variable de module. C'etait le defaut X5 de l'audit: ces accesseurs
 *    lisaient une variable inexistante et renvoyaient toujours 2000x1500, meme
 *    sur une carte de 3000x2000. Ici les dimensions sont une simple table, et
 *    c'est l'etat de la partie qui porte celles de la carte en cours.
 *
 * 2. Les vitesses sont exprimees en pixels par seconde, pas en pixels par pas.
 *    Voir le commentaire de VITESSES ci-dessous: c'est le point de portage le
 *    plus delicat de cette etape.
 */

/**
 * Cadences reelles du legacy, en millisecondes.
 *
 * Elles ne sont pas des reglages: ce sont les intervalles observes dans le code
 * d'origine. Elles servent uniquement a convertir les vitesses du legacy, qui
 * s'exprimaient par pas, en vitesses par seconde.
 */
export const CADENCES_LEGACY_MS = {
  /** Boucle de jeu du client de bureau, qui envoie un deplacement (legacy/client.js:2770). */
  ENVOI_DEPLACEMENT_JOUEUR: 20,
  /** Boucle du serveur, qui fait avancer les bots (TIME_CONFIG.UPDATE_INTERVAL). */
  BOUCLE_SERVEUR: 50,
} as const;

/**
 * Vitesses du legacy telles qu'ecrites dans son code: une distance par pas.
 *
 * Ce sont les valeurs figees par les tests de caracterisation, et les valeurs
 * citees au point 5 des comportements a preserver de CLAUDE.md.
 */
export const DEPLACEMENTS_LEGACY_PAR_PAS = {
  JOUEUR: 3,
  BOT: 5,
  /** Le bot noir se deplace a la vitesse d'un bot ordinaire. Voir le defaut X13 de l'audit. */
  BOT_NOIR: 5,
} as const;

/**
 * Vitesses de deplacement, en pixels par seconde.
 *
 * POURQUOI CETTE CONVERSION. Le legacy ne raisonne pas en temps: il deplace une
 * entite d'une distance fixe a chaque evenement. Un joueur avance de 3 pixels a
 * chaque message recu, et son client en envoie un toutes les 20 millisecondes;
 * un bot avance de 5 pixels a chaque battement de la boucle serveur, qui tourne
 * toutes les 50 millisecondes. Les deux nombres, 3 et 5, ne sont donc pas
 * comparables entre eux: ils ne sont pas rapportes a la meme horloge.
 *
 * Ramenes a la seconde, un joueur avance a 150 pixels par seconde et un bot a
 * 100. C'est ce que l'on ressent en jouant, et c'est ce que le moteur reproduit.
 * Le moteur recevant le temps ecoule (dt), il n'a plus besoin de supposer une
 * cadence: la vitesse ne depend plus du debit de messages, ce qui supprime au
 * passage la cause de la faille S2 de l'audit.
 *
 * Attention en lisant les tests de caracterisation: ils figent 3 et 5, parce
 * qu'ils observent le legacy tel qu'il est. La conversion ci-dessous preserve la
 * vitesse reellement jouee, pas l'ecriture du legacy.
 */
export const VITESSES = {
  JOUEUR_PX_PAR_SECONDE:
    (DEPLACEMENTS_LEGACY_PAR_PAS.JOUEUR * 1000) / CADENCES_LEGACY_MS.ENVOI_DEPLACEMENT_JOUEUR,
  BOT_PX_PAR_SECONDE: (DEPLACEMENTS_LEGACY_PAR_PAS.BOT * 1000) / CADENCES_LEGACY_MS.BOUCLE_SERVEUR,
  BOT_NOIR_PX_PAR_SECONDE:
    (DEPLACEMENTS_LEGACY_PAR_PAS.BOT_NOIR * 1000) / CADENCES_LEGACY_MS.BOUCLE_SERVEUR,
  /** Multiplicateur du bonus de vitesse. Applique a l'etape 1.4. */
  MULTIPLICATEUR_BONUS: 1.7,
  /** Plafond du multiplicateur de vitesse, tous effets confondus. */
  MULTIPLICATEUR_MAXIMUM: 2,
} as const;

/** Dimensions des cartes du jeu, en pixels. */
export const CARTES = {
  map1: { largeur: 2000, hauteur: 1500 },
  map2: { largeur: 2000, hauteur: 1500 },
  map3: { largeur: 3000, hauteur: 2000 },
} as const;

/** Identifiant d'une carte jouable. */
export type IdentifiantCarte = keyof typeof CARTES;

/** Dimensions d'une carte, en pixels. */
export interface DimensionsCarte {
  readonly largeur: number;
  readonly hauteur: number;
}

/** Durees et delais du jeu, en millisecondes sauf mention contraire. */
export const DUREES = {
  /** Duree d'invulnerabilite accordee a l'apparition d'un joueur. */
  PROTECTION_SPAWN_MS: 3000,
  /** Delai minimal impose a un joueur entre deux captures. */
  DELAI_ENTRE_CAPTURES_MS: 1000,
  /** Compte a rebours avant le demarrage d'une partie, en secondes. */
  COMPTE_A_REBOURS_S: 5,
} as const;

/**
 * Bareme du score.
 *
 * Le score d'un joueur est un stock, pas un cumul: il vaut le nombre de bots
 * portant sa couleur a l'instant present, plus les points acquis en detruisant
 * des bots noirs. Se faire capturer le ramene donc a ses seuls points de bots
 * noirs. C'est le comportement a preserver numero 1 de CLAUDE.md, celui qui fait
 * la tension de fin de partie.
 */
export const SCORE = {
  /** Points accordes a un joueur pour la destruction d'un bot noir. */
  POINTS_PAR_BOT_NOIR: 15,
} as const;

/** Reglages de l'apparition des entites. */
export const APPARITION = {
  /** Bande interdite le long des bords de la carte, en pixels. */
  MARGE_BORD: 100,
  /** Distance minimale souhaitee entre deux entites qui apparaissent, en pixels. */
  DISTANCE_DE_SECURITE: 100,
  /** Nombre maximal de tirages avant d'abandonner la recherche d'une position. */
  TENTATIVES_MAXIMUM: 100,
  /**
   * Ecart entre deux anneaux de la recherche en spirale, en pixels. C'est le
   * chemin de secours emprunte quand tous les tirages au sort ont echoue.
   */
  PAS_SPIRALE: 50,
} as const;

/** Rayon de collision d'une entite, en pixels. */
export const RAYON_ENTITE = 16;

/** Les huit directions d'affichage, plus l'immobilite. */
export const DIRECTIONS = [
  'immobile',
  'nord',
  'nord_est',
  'est',
  'sud_est',
  'sud',
  'sud_ouest',
  'ouest',
  'nord_ouest',
] as const;

/** Direction d'une entite, telle que le client l'utilise pour choisir un sprite. */
export type Direction = (typeof DIRECTIONS)[number];

/**
 * Palette des couleurs attribuees aux joueurs.
 *
 * Portage de la liste availableColors du legacy (server.js:174).
 */
export const COULEURS_JOUEURS = [
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
] as const;

/** Couleur d'un bot non capture. */
export const COULEUR_BOT_NEUTRE = '#FFFFFF';

/** Couleur d'un bot noir. */
export const COULEUR_BOT_NOIR = '#000000';
