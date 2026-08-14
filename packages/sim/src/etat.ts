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
  RAYON_ENTITE,
  REGLAGES_PAR_DEFAUT,
  creerAlea,
  reel,
} from '@neon-ninja/shared';

import type { CarteCollisions } from './collisions.js';
import { carteSansMur, positionTenable } from './collisions.js';
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
  /** Dimensions de la carte jouee. */
  readonly carte: DimensionsCarte;
  /**
   * Le terrain: ou l'on peut marcher, ou l'on ne peut pas.
   *
   * C'est une donnee de configuration, constante pendant toute la partie. Elle
   * voyage dans l'etat pour que le moteur garde son contrat a trois arguments,
   * tick(etat, entrees, dt), mais elle n'est jamais recopiee d'un battement au
   * suivant: tous les etats successifs d'une partie partagent la meme carte.
   * Elle n'a pas non plus vocation a etre diffusee aux clients a chaque
   * battement: la couche reseau choisira ce qu'elle envoie (etape 2.2).
   */
  readonly terrain: CarteCollisions;
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
  /**
   * Terrain de la partie, prepare a l'exterieur du moteur a partir de l'image de
   * collision de la carte choisie. Ses dimensions doivent etre celles de cette
   * carte. Sans terrain, la partie se joue sur une carte sans mur, bornee par
   * ses seuls bords: c'est le repli du legacy quand son image manquait.
   */
  readonly terrain?: CarteCollisions;
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
  const carte = CARTES[reglages.carte];
  const terrain = options.terrain ?? carteSansMur(carte);

  // Un terrain aux mauvaises dimensions est une faute d'appelant, et c'est
  // exactement la nature du defaut X5 de l'audit: le legacy jouait sur la grande
  // carte en croyant qu'elle mesurait 2000 sur 1500. On le refuse au lieu de le
  // laisser passer.
  if (terrain.largeur !== carte.largeur || terrain.hauteur !== carte.hauteur) {
    throw new Error(
      `Le terrain fourni mesure ${terrain.largeur}x${terrain.hauteur}, ` +
        `mais la carte ${reglages.carte} mesure ${carte.largeur}x${carte.hauteur}.`,
    );
  }

  return {
    tick: 0,
    tempsEcouleMs: 0,
    dureeMs: reglages.dureePartieS * 1000,
    reglages,
    carte,
    terrain,
    joueurs: {},
    alea: creerAlea(options.graine),
  };
}

/**
 * Tire une position d'apparition sur la carte.
 *
 * Portage de PositionManager.getValidPosition (legacy/server.js:228) et de son
 * chemin de secours _findBackupPosition (:305). On tire jusqu'a cent positions
 * au hasard, a cent pixels des bords, et on garde la premiere qui convient. Si
 * aucune ne convient, une recherche en spirale depuis le centre prend le relais.
 *
 * DEUX DEFAUTS DE L'AUDIT SONT CORRIGES ICI.
 *
 * X3, le chemin de secours plantait. Le legacy y lisait une variable startTime
 * jamais declaree, pour afficher une duree: le repli levait donc une erreur au
 * lieu de replier quoi que ce soit, et il devient d'autant plus probable que la
 * carte est encombree. Il n'y a plus rien a afficher ici, le moteur n'ecrit
 * nulle part, et la spirale fonctionne.
 *
 * X4, la distance de securite ne s'appliquait jamais. Le legacy tenait un
 * registre des positions des entites pour empecher deux apparitions collees,
 * mais il ne l'alimentait nulle part: le registre restait vide, et les cent
 * pixels de SAFE_SPAWN_DISTANCE etaient lettre morte. Decision de l'etape 1.2:
 * on fait vivre le mecanisme plutot que de le retirer, parce qu'apparaitre colle
 * a un adversaire ou a un bot noir est une mauvaise experience de jeu, et que
 * c'etait manifestement l'intention. Il n'y a plus de registre a tenir a jour:
 * les positions occupees sont lues dans l'etat, donc elles ne peuvent plus etre
 * oubliees.
 *
 * La distance de securite reste un souhait, pas une obligation: si la carte est
 * trop encombree pour la respecter, on prefere une position dans un espace libre
 * a un echec. C'est le role du second passage de la spirale.
 *
 * @param alea Generateur a graine. Le tirage le fait avancer.
 * @param terrain Le terrain, qui porte aussi les dimensions de la carte.
 * @param occupees Positions deja prises, a eviter d'une distance de securite.
 * @param rayon Encombrement de l'entite qui apparait.
 */
export function positionDApparition(
  alea: Alea,
  terrain: CarteCollisions,
  occupees: readonly Position[] = [],
  rayon: number = RAYON_ENTITE,
): {
  readonly valeur: Position;
  readonly alea: Alea;
} {
  let generateur = alea;

  for (let tentative = 0; tentative < APPARITION.TENTATIVES_MAXIMUM; tentative += 1) {
    const tirageX = reel(
      generateur,
      APPARITION.MARGE_BORD,
      terrain.largeur - APPARITION.MARGE_BORD,
    );
    const tirageY = reel(
      tirageX.alea,
      APPARITION.MARGE_BORD,
      terrain.hauteur - APPARITION.MARGE_BORD,
    );
    generateur = tirageY.alea;

    const candidate = { x: tirageX.valeur, y: tirageY.valeur };
    if (positionTenable(terrain, candidate, rayon) && aLEcartDe(candidate, occupees)) {
      return { valeur: candidate, alea: generateur };
    }
  }

  return { valeur: positionDeSecours(terrain, occupees, rayon), alea: generateur };
}

/** Une position respecte-t-elle la distance de securite avec toutes les autres ? */
function aLEcartDe(position: Position, occupees: readonly Position[]): boolean {
  return occupees.every(
    (autre) =>
      Math.hypot(position.x - autre.x, position.y - autre.y) >= APPARITION.DISTANCE_DE_SECURITE,
  );
}

/**
 * Cherche une place en spirale depuis le centre de la carte, quand le tirage au
 * sort n'a rien donne.
 *
 * Portage de _findBackupPosition (legacy/server.js:305), avec deux differences.
 * Le centre est celui de la carte reellement jouee, et non le 2000 sur 1500 que
 * le legacy renvoyait toujours (defaut X5). Et la recherche se fait en deux
 * passages: le premier respecte la distance de securite, le second se contente
 * d'un espace libre. Faute de quoi, le centre de la carte, comme le legacy.
 */
function positionDeSecours(
  terrain: CarteCollisions,
  occupees: readonly Position[],
  rayon: number,
): Position {
  const centre = { x: terrain.largeur / 2, y: terrain.hauteur / 2 };

  for (const exigeLEcart of [true, false]) {
    for (let anneau = 1; anneau < 20; anneau += 1) {
      for (let secteur = 0; secteur < 16; secteur += 1) {
        const cap = (secteur * Math.PI) / 8;
        const candidate = {
          x: centre.x + Math.cos(cap) * anneau * APPARITION.PAS_SPIRALE,
          y: centre.y + Math.sin(cap) * anneau * APPARITION.PAS_SPIRALE,
        };

        if (
          positionTenable(terrain, candidate, rayon) &&
          (!exigeLEcart || aLEcartDe(candidate, occupees))
        ) {
          return candidate;
        }
      }
    }
  }

  return centre;
}

/**
 * Fait entrer un joueur dans la partie.
 *
 * Le joueur apparait avec sa protection de trois secondes, une couleur libre et
 * une position tiree de la graine, a l'ecart des murs et des autres joueurs,
 * sauf si l'appelant impose l'une ou l'autre.
 *
 * Une position imposee n'est pas verifiee: elle vient d'un appelant qui sait ce
 * qu'il fait, un test ou une reprise de partie. Une entite posee dans un mur y
 * reste bloquee, aucun deplacement ne pouvant plus la liberer.
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
    const tirage = positionDApparition(alea, etat.terrain, positionsOccupees(etat));
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
 * Les places deja prises sur la carte, dont une nouvelle entite doit s'ecarter.
 *
 * Remplace le registre entitiesPositions du legacy, qui devait etre tenu a jour
 * a la main et ne l'etait jamais (defaut X4). Une position lue dans l'etat ne
 * peut pas etre oubliee.
 */
export function positionsOccupees(etat: EtatPartie): readonly Position[] {
  return Object.values(etat.joueurs).map((joueur) => joueur.position);
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
