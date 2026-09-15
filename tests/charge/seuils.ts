/**
 * Les seuils du harnais de charge: quand dit-on qu'un serveur tient, et combien de
 * parties un coeur peut porter.
 *
 * CE FICHIER NE MESURE RIEN. Il pose les criteres, et les applique a ce que les
 * deux bancs ont mesure. Tout y est pur, donc teste sur des valeurs ecrites a la
 * main. Les valeurs de reference relevees a l'etape 5.1, et leur justification,
 * sont dans docs/mesures/charge-serveur.md.
 */

/**
 * Cadence de battement du serveur, en millisecondes.
 *
 * Recopiee de CADENCE_BATTEMENT_MS (packages/server/src/GameRoom.ts) plutot
 * qu'importee: ce fichier est charge par les clients simules, qui n'ont pas a
 * charger le serveur. Un test verifie que les deux valeurs restent egales.
 */
export const CADENCE_MS = 50;

/** Frequence de battement visee, en battements par seconde. */
export const FREQUENCE_CIBLE_HZ = 1000 / CADENCE_MS;

/**
 * Part d'un battement que le travail des parties peut occuper sur un coeur.
 *
 * LE RESTE N'EST PAS DU TEMPS PERDU. Node.js fait tout sur un seul fil
 * d'execution: le battement des parties, mais aussi l'ecriture des messages sur
 * les connexions, la reception des intentions, l'ouverture des connexions, les
 * routes des comptes, la reponse de la base, et le ramasse-miettes qui interrompt
 * tout le monde. Un fil occupe a cent pour cent par les battements n'a plus de
 * place pour rien de cela: le moindre a-coup decale un battement. Trente pour cent
 * de marge est la regle usuelle pour une boucle d'evenements qui doit rester
 * reactive.
 */
export const PART_DU_BATTEMENT_UTILISABLE = 0.7;

/**
 * Les criteres qui disent qu'un serveur tient la frequence cible.
 *
 * - LA FREQUENCE REELLE de chaque partie ne descend pas sous 95 pour cent de la
 *   cible. En dessous, le jeu ralentit pour tout le monde: le moteur recoit un pas
 *   de temps plus long, que la boucle borne a DT_MAXIMUM_MS.
 * - LE 99E CENTILE DE L'ECART entre deux battements d'une meme partie ne depasse
 *   pas deux cadences. Au-dela, plus d'un battement sur cent en a saute un: un
 *   joueur le voit comme un a-coup.
 * - AUCUNE CONNEXION PERDUE pendant la mesure.
 */
export const CRITERES_DE_TENUE = {
  partDeLaFrequenceCible: 0.95,
  intervalleP99MaximumMs: 2 * CADENCE_MS,
} as const;

/** Ce qu'il faut savoir d'une mesure pour juger si le serveur a tenu. */
export interface ObservationsDeTenue {
  /** Frequence de battement de la partie la plus lente, en battements par seconde. */
  readonly frequenceMinimumHz: number;
  /** 99e centile de l'ecart entre deux battements d'une meme partie, en millisecondes. */
  readonly intervalleP99Ms: number;
  readonly deconnexions: number;
}

/** Le verdict: tenu ou non, et pourquoi. */
export interface VerdictDeTenue {
  readonly tenue: boolean;
  /** Chaque critere manque, dit en clair. Vide quand le serveur a tenu. */
  readonly motifs: readonly string[];
}

/** Juge si le serveur a tenu la frequence cible pendant une mesure. */
export function verdictDeTenue(observations: ObservationsDeTenue): VerdictDeTenue {
  const motifs: string[] = [];
  const plancher = FREQUENCE_CIBLE_HZ * CRITERES_DE_TENUE.partDeLaFrequenceCible;

  if (observations.frequenceMinimumHz < plancher) {
    motifs.push(
      `frequence ${observations.frequenceMinimumHz.toFixed(1)} Hz sous le plancher de ${plancher.toFixed(1)} Hz`,
    );
  }

  if (observations.intervalleP99Ms > CRITERES_DE_TENUE.intervalleP99MaximumMs) {
    motifs.push(
      `ecart p99 de ${observations.intervalleP99Ms.toFixed(1)} ms au-dela de ${String(CRITERES_DE_TENUE.intervalleP99MaximumMs)} ms`,
    );
  }

  if (observations.deconnexions > 0) {
    motifs.push(`${String(observations.deconnexions)} connexion(s) perdue(s)`);
  }

  return { tenue: motifs.length === 0, motifs };
}

/**
 * Combien de parties un coeur porte, d'apres ce que coute une partie par battement.
 *
 * C'est le budget par coeur de la fiche 5.1: le temps utilisable d'un battement,
 * divise par le cout d'une partie. Le cout a fournir est un cout MOYEN: sur un
 * coeur, ce sont les couts qui s'additionnent battement apres battement. Les pics,
 * eux, se jugent par le verdict de tenue, sur la vraie charge.
 *
 * @param coutParPartieMs Cout moyen d'une partie par battement, en millisecondes.
 */
export function partiesParCoeur(coutParPartieMs: number): number {
  if (!Number.isFinite(coutParPartieMs) || coutParPartieMs <= 0) {
    throw new Error(`Un cout par partie doit etre positif, recu ${String(coutParPartieMs)}.`);
  }

  return Math.floor((CADENCE_MS * PART_DU_BATTEMENT_UTILISABLE) / coutParPartieMs);
}

/**
 * La partie de reference du banc du battement.
 *
 * C'est une partie pleine au maximum des bornes du salon: douze joueurs, cent
 * cinquante bots, sur la carte par defaut, a graine fixe. Le banc etant
 * deterministe pour les tailles, la taille moyenne de ses messages est la meme sur
 * toutes les machines: c'est ce qui en fait un seuil verifiable en integration
 * continue.
 */
export const PARTIE_DE_REFERENCE = {
  bots: 150,
  joueurs: 12,
  battements: 600,
  echauffement: 100,
  graine: 42,
} as const;

/**
 * Taille moyenne d'un message du flux d'etat de la partie de reference, sur le fil,
 * en octets: en-tete Socket.IO et trame binaire, images periodiques comprises.
 *
 * Mesuree a l'etape 2.3, le 12 septembre 2026, sur le flux binaire en delta. Elle
 * valait 21 518 octets a l'etape 5.1, sur le flux JSON de l'etape 2.2. Une
 * modification qui la fait sortir de la tolerance change la bande passante de tous
 * les joueurs: elle doit etre voulue, mesuree, et reportee ici et dans
 * docs/mesures/charge-serveur.md.
 */
export const OCTETS_PAR_MESSAGE_DE_REFERENCE = 453;

/**
 * Ecart tolere autour de la taille de reference, en part de celle-ci.
 *
 * Assez large pour qu'un ajustement du jeu, qui deplace un peu les entites, ne
 * fasse pas echouer la verification; assez etroit pour qu'un champ ajoute a chaque
 * entite, ou un changement de format, la fasse echouer.
 */
export const TOLERANCE_DE_TAILLE = 0.05;

/** Le debit d'un flux de messages, en kilo-octets par seconde. */
export function debitKoParSeconde(octetsParMessage: number, messagesParSeconde: number): number {
  return (octetsParMessage * messagesParSeconde) / 1000;
}

/** Un debit en kilo-octets par seconde, exprime en megabits par seconde. */
export function megabitsParSeconde(koParSeconde: number): number {
  return (koParSeconde * 8) / 1000;
}
