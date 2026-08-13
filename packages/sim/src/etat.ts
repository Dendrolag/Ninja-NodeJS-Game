/**
 * Modele d'etat d'une partie.
 *
 * L'etat est une donnee, pas un objet vivant: rien ici ne se modifie sur place.
 * Chaque fonction qui « change » l'etat en renvoie un nouveau. C'est ce qui rend
 * le moteur testable comme une fonction mathematique, rejouable, et transposable
 * a plusieurs parties simultanees.
 *
 * Portage de Entity (legacy/server.js:832) et Player (:876). Ce que le portage
 * change, et pourquoi:
 *
 *   - Le constructeur du legacy appelait positionManager.getValidPosition() et
 *     getRandomColor(). Ici la position et la couleur sont soit fournies, soit
 *     tirees du generateur a graine transporte par l'etat. Le moteur n'appelle
 *     aucun service exterieur.
 *   - spawnProtection et lastCapture etaient des dates absolues, obtenues par
 *     Date.now(). Ce sont maintenant des durees restantes, que le moteur fait
 *     decroitre a chaque battement. Le moteur ne lit jamais l'horloge.
 *   - Les champs lastX et lastY de Entity ne sont pas portes: le legacy les
 *     ecrit une fois et ne les lit jamais.
 *   - Le champ botsControlled de Player n'est pas porte non plus: c'est le
 *     defaut X11 de l'audit, un compteur remis a zero a cinq endroits, jamais
 *     incremente, et envoye au client qui recoit donc toujours zero.
 *
 * Les compteurs de capture et les effets de bonus arrivent avec leurs etapes
 * (1.3 et 1.4). Les bots arrivent a l'etape 1.5. On ne pose pas ici des champs
 * dont personne ne sait encore se servir.
 */

import type {
  Alea,
  DimensionsCarte,
  Direction,
  Position,
  ReglagesPartie,
} from '@neon-ninja/shared';
import {
  APPARITION,
  CARTES,
  DUREES,
  REGLAGES_PAR_DEFAUT,
  creerAlea,
  reel,
} from '@neon-ninja/shared';

import type { Couleur } from './couleurs.js';
import { couleurUnique } from './couleurs.js';

/** Identifiant d'une entite. Cote serveur, ce sera l'identifiant de la connexion. */
export type IdentifiantEntite = string;

/** Nature d'une entite. Seuls les joueurs existent a ce stade du portage. */
export type TypeEntite = 'joueur' | 'bot' | 'botNoir';

/** Ce que toute entite du jeu possede: une identite, une place, une couleur, un regard. */
export interface Entite {
  readonly id: IdentifiantEntite;
  readonly type: TypeEntite;
  readonly position: Position;
  readonly couleur: Couleur;
  readonly direction: Direction;
}

/** Un joueur connecte a la partie. */
export interface Joueur extends Entite {
  readonly type: 'joueur';
  readonly pseudo: string;
  /**
   * Temps d'invulnerabilite restant apres une apparition, en millisecondes.
   * Trois secondes au depart (comportement a preserver numero 6).
   */
  readonly protectionSpawnRestanteMs: number;
  /**
   * Temps ecoule depuis la derniere capture reussie, en millisecondes.
   *
   * Le joueur doit attendre une seconde entre deux captures (comportement a
   * preserver numero 6). Ce compteur est ecrit dans le sens du legacy, qui
   * calcule « maintenant moins la derniere capture » et compare en inegalite
   * stricte. Un compte a rebours aurait decale la limite d'un battement: la
   * caracterisation a fige un refus a exactement mille millisecondes et une
   * acceptation juste apres.
   *
   * Le compteur est plafonne: au-dela de la limite, sa valeur exacte n'a plus
   * aucun effet, et un nombre qui grandit sans fin n'a rien a faire dans un
   * etat que l'on serialise vingt fois par seconde.
   */
  readonly tempsDepuisDerniereCaptureMs: number;
}

/**
 * Valeur du compteur de capture qui signifie « pret ». Un joueur qui vient
 * d'apparaitre peut capturer immediatement, comme dans le legacy, ou
 * lastCapture vaut zero face a une horloge absolue.
 */
export const COMPTEUR_CAPTURE_PRET = DUREES.DELAI_ENTRE_CAPTURES_MS + 1;

/** L'etat complet d'une partie a un instant donne. */
export interface EtatPartie {
  /** Nombre de battements de moteur ecoules depuis le debut de la partie. */
  readonly tick: number;
  /** Temps de jeu ecoule, en millisecondes. */
  readonly tempsEcouleMs: number;
  /** Duree totale prevue pour la partie, en millisecondes. */
  readonly dureeMs: number;
  /** Reglages choisis par l'hote. Le moteur ne connait que ceux-la. */
  readonly reglages: ReglagesPartie;
  /** Dimensions de la carte jouee. Le moteur n'en connait pas le dessin, seulement la taille. */
  readonly carte: DimensionsCarte;
  /** Les joueurs de la partie, indexes par identifiant. */
  readonly joueurs: Readonly<Record<IdentifiantEntite, Joueur>>;
  /** Generateur a graine de la partie. Tout tirage le fait avancer. */
  readonly alea: Alea;
}

/** Ce qu'il faut pour demarrer une partie. */
export interface OptionsEtatInitial {
  /** Graine de la partie. Deux parties de meme graine et memes entrees sont identiques. */
  readonly graine: number;
  /** Reglages a appliquer. Ceux qui manquent prennent la valeur par defaut. */
  readonly reglages?: Partial<ReglagesPartie>;
}

/** Ce qu'il faut pour faire entrer un joueur dans la partie. */
export interface OptionsAjoutJoueur {
  readonly id: IdentifiantEntite;
  readonly pseudo: string;
  /** Position imposee. Sinon elle est tiree de la graine. */
  readonly position?: Position;
  /** Couleur imposee. Sinon elle est tiree parmi celles encore libres. */
  readonly couleur?: Couleur;
}

/** Cree l'etat de depart d'une partie: pas de joueur, pas de temps ecoule. */
export function creerEtatInitial(options: OptionsEtatInitial): EtatPartie {
  const reglages: ReglagesPartie = { ...REGLAGES_PAR_DEFAUT, ...options.reglages };

  return {
    tick: 0,
    tempsEcouleMs: 0,
    dureeMs: reglages.dureePartieS * 1000,
    reglages,
    carte: CARTES[reglages.carte],
    joueurs: {},
    alea: creerAlea(options.graine),
  };
}

/**
 * Tire une position d'apparition sur la carte.
 *
 * Portage de PositionManager.getValidPosition (legacy/server.js:228), reduit a
 * son tirage: une position au hasard, a distance des bords. Ce que le legacy
 * faisait en plus, et qui arrive a l'etape 1.2 avec la carte de collisions:
 * verifier que la position n'est pas dans un mur, et l'ecarter des autres
 * entites. Deux defauts de l'audit se traitent la-bas: X3 (le chemin de secours
 * du legacy plante) et X4 (la distance de securite n'est jamais appliquee).
 */
export function positionDApparition(
  alea: Alea,
  carte: DimensionsCarte,
): {
  readonly valeur: Position;
  readonly alea: Alea;
} {
  const tirageX = reel(alea, APPARITION.MARGE_BORD, carte.largeur - APPARITION.MARGE_BORD);
  const tirageY = reel(tirageX.alea, APPARITION.MARGE_BORD, carte.hauteur - APPARITION.MARGE_BORD);

  return { valeur: { x: tirageX.valeur, y: tirageY.valeur }, alea: tirageY.alea };
}

/**
 * Fait entrer un joueur dans la partie.
 *
 * Le joueur apparait avec sa protection de trois secondes, une couleur libre et
 * une position tiree de la graine, sauf si l'appelant impose l'une ou l'autre.
 */
export function ajouterJoueur(etat: EtatPartie, options: OptionsAjoutJoueur): EtatPartie {
  let alea = etat.alea;

  let couleur = options.couleur;
  if (couleur === undefined) {
    const tirage = couleurUnique(alea, couleursUtilisees(etat));
    couleur = tirage.valeur;
    alea = tirage.alea;
  }

  let position = options.position;
  if (position === undefined) {
    const tirage = positionDApparition(alea, etat.carte);
    position = tirage.valeur;
    alea = tirage.alea;
  }

  const joueur: Joueur = {
    id: options.id,
    type: 'joueur',
    pseudo: options.pseudo,
    position,
    couleur,
    direction: 'immobile',
    protectionSpawnRestanteMs: DUREES.PROTECTION_SPAWN_MS,
    tempsDepuisDerniereCaptureMs: COMPTEUR_CAPTURE_PRET,
  };

  return { ...etat, joueurs: { ...etat.joueurs, [options.id]: joueur }, alea };
}

/** Fait sortir un joueur de la partie. Sans effet s'il n'y etait pas. */
export function retirerJoueur(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  if (etat.joueurs[id] === undefined) {
    return etat;
  }

  const joueurs = { ...etat.joueurs };
  delete joueurs[id];

  return { ...etat, joueurs };
}

/** Les couleurs deja portees par un joueur de la partie. */
export function couleursUtilisees(etat: EtatPartie): readonly Couleur[] {
  return Object.values(etat.joueurs).map((joueur) => joueur.couleur);
}

/**
 * Un joueur est-il a l'abri d'une capture ?
 *
 * Portage de Player.isInvulnerable (legacy/server.js:915), limite pour l'instant
 * a la protection d'apparition. L'invincibilite donnee par un bonus s'ajoutera a
 * l'etape 1.4, quand les bonus existeront.
 */
export function estInvulnerable(joueur: Joueur): boolean {
  return joueur.protectionSpawnRestanteMs > 0;
}

/**
 * Un joueur a-t-il le droit de capturer maintenant ?
 *
 * Portage de Player.canCapture (legacy/server.js:936), a l'identique: le delai
 * doit etre depasse, pas seulement atteint.
 */
export function peutCapturer(joueur: Joueur): boolean {
  return joueur.tempsDepuisDerniereCaptureMs > DUREES.DELAI_ENTRE_CAPTURES_MS;
}
