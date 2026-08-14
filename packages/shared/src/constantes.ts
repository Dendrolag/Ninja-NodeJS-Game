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

/**
 * Les trois bonus ramassables. Un bonus profite a celui qui le ramasse.
 *
 * Portage des types manipules par spawnBonus (legacy/server.js:1579): speed,
 * invincibility et reveal.
 */
export const TYPES_BONUS = ['vitesse', 'invincibilite', 'revelation'] as const;

/** Nature d'un bonus. */
export type TypeBonus = (typeof TYPES_BONUS)[number];

/**
 * Les trois malus ramassables. Un malus frappe les AUTRES joueurs, pas celui qui
 * le ramasse: c'est le comportement a preserver numero 4 de CLAUDE.md.
 *
 * Portage des types manipules par spawnMalus (legacy/server.js:651): reverse,
 * blur et negative.
 */
export const TYPES_MALUS = ['controlesInverses', 'flou', 'negatif'] as const;

/** Nature d'un malus. */
export type TypeMalus = (typeof TYPES_MALUS)[number];

/**
 * Les quatre zones speciales. Portage de ZONE_TYPES (legacy/server.js:187).
 *
 * Le legacy leur donnait aussi un nom et deux couleurs d'affichage. Ces
 * trois-la sont de la presentation: elles appartiennent au client, pas au
 * moteur, qui ne connait que la nature de la zone et sa geometrie.
 */
export const TYPES_ZONE = ['chaos', 'repulsion', 'attraction', 'invisibilite'] as const;

/** Nature d'une zone speciale. */
export type TypeZone = (typeof TYPES_ZONE)[number];

/**
 * Objets ramassables poses sur la carte: les bonus et les malus.
 *
 * Valeurs du legacy (classes Bonus :1347 et Malus :1401, identiques a la ligne
 * pres), sauf le seuil de clignotement, qui ne sert qu'a l'affichage et que le
 * moteur transmet sans s'en servir.
 */
export const OBJETS = {
  /** Duree pendant laquelle un objet reste pose avant de disparaitre. */
  DUREE_DE_VIE_MS: 8000,
  /** En dessous de cette duree restante, le client fait clignoter l'objet. */
  SEUIL_CLIGNOTEMENT_MS: 3000,
  /**
   * Distance de ramassage, en pixels. Plus courte que le seuil de contact entre
   * entites, qui vaut vingt: un objet se ramasse en marchant dessus, pas en
   * passant a cote.
   */
  SEUIL_RAMASSAGE_PX: 15,
  /** Nombre maximal de malus poses en meme temps. Les bonus n'ont pas de plafond. */
  MALUS_SIMULTANES_MAXIMUM: 5,
  /**
   * Amplitude du hasard sur l'intervalle entre deux apparitions. A 0,5, un
   * intervalle de quatre secondes devient un tirage entre trois et cinq
   * secondes. Formule du legacy (:1610 et :672).
   */
  VARIATION_INTERVALLE: 0.5,
} as const;

/**
 * Zones speciales: leur taille, leur nombre, et la force de leurs effets.
 *
 * Les forces du legacy s'exprimaient par battement de la boucle serveur, comme
 * les vitesses. Elles sont converties en pixels par seconde pour la meme raison:
 * le moteur avance proportionnellement au temps ecoule, pas au nombre d'appels.
 */
export const ZONES = {
  /** Nombre maximal de zones actives en meme temps (legacy :817). */
  SIMULTANEES_MAXIMUM: 3,
  /** Rayon minimal d'une zone, en pixels (legacy :523). */
  RAYON_MINIMUM_PX: 150,
  /** Une zone couvre au plus cette fraction de la carte (legacy :517). */
  PART_DE_CARTE: 5,
  /**
   * Probabilite qu'une zone de chaos repeigne un bot donne, par battement de
   * cinquante millisecondes (legacy :558). Le moteur la ramene au temps ecoule
   * reel, pour que le resultat ne depende pas de la cadence d'appel.
   */
  CHAOS_PROBABILITE_PAR_BATTEMENT: 0.05,
  /** Force de repulsion exercee par chaque joueur present dans la zone. */
  REPULSION: {
    FORCE_PX_PAR_SECONDE: (4 * 1000) / CADENCES_LEGACY_MS.BOUCLE_SERVEUR,
    /** Au-dela de cette distance, un joueur ne repousse plus (legacy :576). */
    PORTEE_PX: 200,
    /** Deplacement maximal impose a un bot sur un axe, toutes forces cumulees. */
    PLAFOND_PX_PAR_SECONDE: (5 * 1000) / CADENCES_LEGACY_MS.BOUCLE_SERVEUR,
  },
  /** Force d'attraction vers le joueur le plus proche. */
  ATTRACTION: {
    FORCE_PX_PAR_SECONDE: (3 * 1000) / CADENCES_LEGACY_MS.BOUCLE_SERVEUR,
  },
} as const;

/**
 * Errance des bots: comment ils alternent marche et pause, changent de cap, et
 * se degagent quand ils butent sur un mur.
 *
 * Portage de la classe Bot (legacy/server.js:941). Les durees sont celles du
 * legacy, exprimees en millisecondes, et elles n'ont pas eu besoin d'etre
 * converties: le legacy les comparait deja a une horloge, contrairement a ses
 * vitesses, qui se comptaient par battement.
 *
 * Les deux distances en pixels, elles, valaient « deux pas de bot » dans le
 * legacy. Ce sont des distances de test, pas des vitesses: un bot ne les
 * parcourt pas en une seconde, il les utilise pour verifier qu'un cap est
 * praticable. Elles restent donc telles quelles.
 */
export const BOTS = {
  /** Duree minimale d'une phase de marche ou de pause (legacy :952). */
  DUREE_ETAT_MINIMUM_MS: 1000,
  /** Duree maximale d'une phase de marche ou de pause. */
  DUREE_ETAT_MAXIMUM_MS: 3000,
  /** Delai minimal avant un changement de cap spontane (legacy :949). */
  INTERVALLE_DE_CAP_MINIMUM_MS: 1000,
  /** Delai maximal avant un changement de cap spontane. */
  INTERVALLE_DE_CAP_MAXIMUM_MS: 3000,
  /** Periode du controle de blocage d'un bot ordinaire (legacy :955). */
  CONTROLE_DE_BLOCAGE_MS: 500,
  /** Periode du controle de blocage d'un bot noir, plus attentif (legacy :1145). */
  CONTROLE_DE_BLOCAGE_BOT_NOIR_MS: 300,
  /** En dessous de cette distance parcourue entre deux controles, le bot est juge bloque. */
  DEPLACEMENT_MINIMUM_PX: 1,
  /** Nombre de controles sans avancer avant d'essayer un autre cap (legacy :988). */
  CONTROLES_AVANT_CHANGEMENT_DE_CAP: 3,
  /** Nombre de controles sans avancer avant de forcer un degagement (legacy :990). */
  CONTROLES_AVANT_DEGAGEMENT: 5,
  /** Nombre de caps tires au sort avant de renoncer et de faire demi-tour (legacy :1100). */
  TENTATIVES_DE_CAP_MAXIMUM: 8,
  /** Distance a laquelle on verifie qu'un cap envisage est praticable (legacy :1110). */
  PORTEE_DU_TEST_DE_CAP_PX: 2 * DEPLACEMENTS_LEGACY_PAR_PAS.BOT,
  /** Longueur du bond tente pour se degager d'un blocage (legacy :1013). */
  DISTANCE_DE_DEGAGEMENT_PX: 2 * DEPLACEMENTS_LEGACY_PAR_PAS.BOT,
  /** Les huit caps essayes dans l'ordre pour se degager (legacy :1008). */
  ANGLES_DE_DEGAGEMENT_DEGRES: [0, 45, 90, 135, 180, 225, 270, 315],
} as const;

/**
 * Chasse des bots noirs. Portage de la classe BlackBot (legacy/server.js:1130).
 *
 * Le rayon de detection et la part de bots perdue ne sont pas ici: ce sont des
 * reglages de partie, choisis dans le salon, et le defaut X14 de l'audit vient
 * precisement de ce que le legacy allait les chercher ailleurs que dans les
 * reglages de la partie en cours.
 */
export const BOTS_NOIRS = {
  /** Delai impose a un bot noir entre deux captures (legacy :1139). */
  DELAI_ENTRE_CAPTURES_MS: 2000,
  /** Periode a laquelle un bot noir reconsidere sa proie (legacy :1144). */
  INTERVALLE_DE_RECHERCHE_MS: 500,
  /** Distance a laquelle un bot noir attrape sa proie (legacy :1252). */
  SEUIL_DE_CAPTURE_PX: 20,
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
