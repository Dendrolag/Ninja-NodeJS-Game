/**
 * Les regles de la progression: ce qu'une partie rapporte a un compte, et ce qui
 * se deduit de ce qu'il a accumule.
 *
 * VALEURS VALIDEES PAR LE PORTEUR DU PROJET LE 11 SEPTEMBRE 2026 (etape 3.3,
 * question 2 de la section 8 du cadrage). Le detail et les raisons sont au journal
 * de docs/design/README.md. Changer un nombre ici change le jeu pour tout le
 * monde: c'est une decision de conception, pas un reglage technique.
 *
 * CE QUI SE DEDUIT NE SE STOCKE PAS (cadrage de l'etape 0.3, section 5). La base
 * garde l'XP totale, les pieces et les points de ligue. Le niveau se deduit de
 * l'XP, le palier des points de ligue, ici, dans le paquet partage, pour que le
 * serveur et le client calculent toujours la meme chose.
 *
 * TOUT CE FICHIER EST PUR. Il ne lit ni horloge ni base: le serveur lui donne ce
 * qui s'est passe dans la partie, il rend ce que cela rapporte.
 *
 * LES QUATRE REGLES, EN FRANCAIS.
 *
 *   1. L'XP se gagne au temps passe en partie: 10 XP par minute, plus 20 XP par
 *      minute pour chaque joueur que l'on devance au classement final, invites
 *      compris. Enchainer des parties courtes, seul ou avec un complice, ne
 *      rapporte donc presque rien. Les pieces valent un dixieme de l'XP.
 *   2. Passer du niveau n au niveau n + 1 coute 100 x n XP: le niveau 2 s'atteint
 *      a 100 XP, le niveau 10 a 4 500, le niveau 20 a 19 000.
 *   3. Les points de ligue varient selon la place: +20 au premier, -10 au dernier,
 *      en ligne droite entre les deux. Seulement dans une partie d'au moins deux
 *      joueurs et d'au moins trois minutes; une partie plus courte, ou jouee seul,
 *      ne fait ni gagner ni perdre. Les points ne descendent jamais sous zero
 *      (c'est l'enregistrement qui l'applique, puisqu'il connait le solde).
 *   4. Un compte qui quitte une partie en cours est compte dernier: aucune XP, aucune
 *      piece, et la perte de points de ligue du dernier. Sans cela, quitter juste
 *      avant la fin eviterait toute perte.
 */

/** Les nombres des regles de progression. */
export const REGLES_DE_PROGRESSION = {
  /** XP par minute passee en partie. */
  xpParMinute: 10,
  /** XP par minute passee en partie, pour chaque joueur devance au classement final. */
  xpParMinuteParJoueurDevance: 20,
  /** XP pour une piece: les pieces valent un dixieme de l'XP, arrondi en dessous. */
  xpParPiece: 10,
  /** Passer du niveau n au niveau n + 1 coute ce nombre fois n. */
  xpParNiveau: 100,
  ligue: {
    /** Variation du premier. */
    variationDuPremier: 20,
    /** Variation du dernier, et d'un compte qui abandonne. */
    variationDuDernier: -10,
    /** En dessous de ce nombre de joueurs, la ligue ne bouge pas. */
    joueursMinimum: 2,
    /** En dessous de cette duree de partie, la ligue ne bouge pas: trois minutes. */
    dureeMinimumMs: 180_000,
  },
} as const;

/** Une minute, en millisecondes. */
const MINUTE_MS = 60_000;

/** Les paliers de rang, du plus bas au plus haut. */
export type IdentifiantPalier = 'bronze' | 'argent' | 'or' | 'platine' | 'diamant';

/** Un palier de rang, et les points de ligue a partir desquels on l'atteint. */
export interface Palier {
  readonly id: IdentifiantPalier;
  readonly seuil: number;
}

/**
 * Les paliers de rang, du plus bas au plus haut.
 *
 * Cinq paliers sans subdivision: l'echelle de ligue detaillee (« Diamant II ») est
 * reportee apres la v1 (cadrage, section 1). Les noms affiches appartiennent au
 * client.
 */
export const PALIERS: readonly [Palier, ...Palier[]] = [
  { id: 'bronze', seuil: 0 },
  { id: 'argent', seuil: 100 },
  { id: 'or', seuil: 300 },
  { id: 'platine', seuil: 600 },
  { id: 'diamant', seuil: 1000 },
];

// --------------------------------------------------------------------------
// Ce qui se deduit
// --------------------------------------------------------------------------

/**
 * L'XP totale a partir de laquelle on atteint ce niveau.
 *
 * C'est la somme de ce que coutent les niveaux precedents: 100 x (1 + 2 + ... +
 * (niveau - 1)), soit 50 x niveau x (niveau - 1). Le niveau 1 s'atteint a zero.
 *
 * @throws Si le niveau n'est pas un entier d'au moins 1.
 */
export function xpDuNiveau(niveau: number): number {
  if (!Number.isInteger(niveau) || niveau < 1) {
    throw new Error(`Un niveau est un entier d'au moins 1, recu ${String(niveau)}.`);
  }

  return (REGLES_DE_PROGRESSION.xpParNiveau * niveau * (niveau - 1)) / 2;
}

/**
 * Le niveau correspondant a une XP totale.
 *
 * Le calcul part de la formule inverse de xpDuNiveau, une unite en dessous, puis
 * monte jusqu'au dernier seuil franchi: une racine carree en virgule flottante
 * peut se tromper de tres peu, et « tres peu » suffit a rater un seuil pile.
 * Partir en dessous garantit qu'on n'a jamais a redescendre, et les seuils, eux,
 * se comparent en nombres entiers exacts.
 *
 * @throws Si l'XP n'est pas un entier positif ou nul: elle vient de la base, ou
 *         elle ne peut pas l'etre, donc ce serait une faute du serveur.
 */
export function niveauDeXp(xpTotale: number): number {
  exigerUnEntierPositif(xpTotale, 'Une XP totale');

  const pas = REGLES_DE_PROGRESSION.xpParNiveau;
  const estimation = Math.floor((1 + Math.sqrt(1 + (8 * xpTotale) / pas)) / 2);
  let niveau = Math.max(1, estimation - 1);

  while (xpDuNiveau(niveau + 1) <= xpTotale) {
    niveau += 1;
  }

  return niveau;
}

/** Ou en est un compte dans son niveau: de quoi dessiner la barre de progression. */
export interface AvancementDuNiveau {
  readonly niveau: number;
  /** XP gagnee depuis l'entree dans ce niveau. */
  readonly xpDansLeNiveau: number;
  /** XP que coute ce niveau en entier, pour passer au suivant. */
  readonly xpDuNiveauEntier: number;
}

/** L'avancement dans le niveau correspondant a une XP totale. */
export function avancementDuNiveau(xpTotale: number): AvancementDuNiveau {
  const niveau = niveauDeXp(xpTotale);

  return {
    niveau,
    xpDansLeNiveau: xpTotale - xpDuNiveau(niveau),
    xpDuNiveauEntier: REGLES_DE_PROGRESSION.xpParNiveau * niveau,
  };
}

/**
 * Le palier de rang correspondant a des points de ligue.
 *
 * @throws Si les points ne sont pas un entier positif ou nul.
 */
export function palierDePoints(pointsLigue: number): IdentifiantPalier {
  exigerUnEntierPositif(pointsLigue, 'Des points de ligue');

  let atteint: Palier = PALIERS[0];

  for (const palier of PALIERS) {
    if (pointsLigue >= palier.seuil) {
      atteint = palier;
    }
  }

  return atteint.id;
}

// --------------------------------------------------------------------------
// Ce qu'une partie rapporte
// --------------------------------------------------------------------------

/** Ce qu'il faut savoir d'un compte a la fin d'une partie pour calculer ses gains. */
export interface PlaceEnFinDePartie {
  /** 1 pour le premier. Un abandon est place dernier, au nombre de joueurs. */
  readonly placement: number;
  /** Tous les joueurs de la partie, invites et abandons compris. */
  readonly nombreJoueurs: number;
  /** Temps passe dans la partie en cours de jeu, en millisecondes. */
  readonly tempsJoueMs: number;
  /** Duree reglee de la partie, en millisecondes. */
  readonly dureePartieMs: number;
  /** Le compte a quitte la partie avant la fin. */
  readonly abandon: boolean;
}

/** Ce qu'une partie rapporte a un compte. */
export interface Recompenses {
  readonly xp: number;
  readonly pieces: number;
  /**
   * La variation demandee par les regles. Une perte peut encore etre reduite a
   * l'enregistrement, pour ne pas descendre sous zero.
   */
  readonly variationPointsLigue: number;
}

/**
 * Ce qu'une partie rapporte a un compte, selon les quatre regles de ce fichier.
 *
 * @throws Si la place est impossible (placement hors du nombre de joueurs, temps
 *         negatif): elle vient du serveur, donc ce serait une faute de sa part.
 */
export function recompensesDePartie(place: PlaceEnFinDePartie): Recompenses {
  exigerUnePlacePossible(place);

  const placement = place.abandon ? place.nombreJoueurs : place.placement;
  const variationPointsLigue = variationDeLigue(
    placement,
    place.nombreJoueurs,
    place.dureePartieMs,
  );

  if (place.abandon) {
    return { xp: 0, pieces: 0, variationPointsLigue };
  }

  const xp = xpDePartie(place.nombreJoueurs - placement, place.tempsJoueMs, place.dureePartieMs);

  return {
    xp,
    pieces: Math.floor(xp / REGLES_DE_PROGRESSION.xpParPiece),
    variationPointsLigue,
  };
}

/**
 * L'XP d'une partie: au temps passe, et aux joueurs devances.
 *
 * Le temps compte au plus la duree de la partie: le dernier battement peut la
 * depasser de quelques millisecondes, qui ne rapportent rien.
 */
function xpDePartie(joueursDevances: number, tempsJoueMs: number, dureePartieMs: number): number {
  const { xpParMinute, xpParMinuteParJoueurDevance } = REGLES_DE_PROGRESSION;
  const tempsCompteMs = Math.min(tempsJoueMs, dureePartieMs);

  return Math.floor(
    (tempsCompteMs * (xpParMinute + xpParMinuteParJoueurDevance * joueursDevances)) / MINUTE_MS,
  );
}

/**
 * La variation de points de ligue d'une place: +20 au premier, -10 au dernier, en
 * ligne droite entre les deux, arrondie a l'entier le plus proche (une demie vers
 * le haut).
 */
function variationDeLigue(placement: number, nombreJoueurs: number, dureePartieMs: number): number {
  const { variationDuPremier, variationDuDernier, joueursMinimum, dureeMinimumMs } =
    REGLES_DE_PROGRESSION.ligue;

  if (nombreJoueurs < joueursMinimum || dureePartieMs < dureeMinimumMs) {
    return 0;
  }

  const partDevancee = (nombreJoueurs - placement) / (nombreJoueurs - 1);
  const arrondie = Math.round(
    variationDuDernier + (variationDuPremier - variationDuDernier) * partDevancee,
  );

  // Math.round rend -0 pour une valeur entre -0,5 et 0: un zero est un zero.
  return arrondie === 0 ? 0 : arrondie;
}

/** Refuse une place que le serveur n'a pas pu legitimement produire. */
function exigerUnePlacePossible(place: PlaceEnFinDePartie): void {
  if (!Number.isInteger(place.nombreJoueurs) || place.nombreJoueurs < 1) {
    throw new Error(
      `Une partie a au moins un joueur, recu ${String(place.nombreJoueurs)} joueurs.`,
    );
  }

  if (
    !Number.isInteger(place.placement) ||
    place.placement < 1 ||
    place.placement > place.nombreJoueurs
  ) {
    throw new Error(
      `Placement ${String(place.placement)} impossible dans une partie de ${String(place.nombreJoueurs)} joueurs.`,
    );
  }

  for (const [nom, duree] of [
    ['temps joue', place.tempsJoueMs],
    ['duree de partie', place.dureePartieMs],
  ] as const) {
    if (!Number.isFinite(duree) || duree < 0) {
      throw new Error(`Un ${nom} est une duree positive ou nulle, recu ${String(duree)}.`);
    }
  }
}

/** Refuse ce qui n'est pas un entier positif ou nul. */
function exigerUnEntierPositif(valeur: number, nom: string): void {
  if (!Number.isInteger(valeur) || valeur < 0) {
    throw new Error(`${nom} est un entier positif ou nul, recu ${String(valeur)}.`);
  }
}
