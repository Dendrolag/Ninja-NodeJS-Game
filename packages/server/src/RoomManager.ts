/**
 * Le RoomManager: qui ouvre les parties, qui les retrouve, qui les ferme.
 *
 * La GameRoom sait tenir une partie. Le RoomManager sait qu'il en existe
 * plusieurs. C'est la seule chose qui manquait au legacy pour faire tourner deux
 * parties a la fois: son etat de partie vivait dans des variables de module, il
 * n'y en avait donc qu'un exemplaire par serveur.
 *
 * IL N'Y A TOUJOURS AUCUN ETAT GLOBAL. Le RoomManager n'est pas une variable de
 * module: c'est une classe que l'on instancie. Le point d'entree du serveur en
 * cree un, et les tests en creent autant qu'ils veulent, sans qu'ils se voient.
 *
 * UNE ROOM VIDE EST DETRUITE. Le dernier joueur qui part emporte la partie avec
 * lui: la boucle s'arrete, l'etat est libere. Sans cette regle, un serveur
 * accumulerait des parties fantomes qui continueraient de battre pour personne,
 * ce qui est la forme que prenait le defaut X1 de l'audit.
 *
 * TROIS FACONS DE TROUVER UNE PARTIE, depuis l'etape 2.4: par son identifiant,
 * par son code d'invitation si elle est privee, et parmi les parties publiques
 * ouvertes. Ce fichier sait les retrouver; decider laquelle un joueur a le droit
 * de viser appartient a la couche reseau (ServeurSocket).
 */

import { randomInt } from 'node:crypto';

import type {
  Mode,
  ReglagesPartiels,
  ResultatValidation,
  SessionJoueur,
  Visibilite,
} from '@neon-ninja/shared';
import { BORNES_CODE_INVITATION } from '@neon-ninja/shared';
import type { CarteCollisions } from '@neon-ninja/sim';

import type { JoueurDeRoom, OptionsGameRoom } from './GameRoom.js';
import { GameRoom } from './GameRoom.js';
import type { Horloge } from './horloge.js';

/**
 * Combien de codes tirer au plus avant de renoncer a en trouver un libre.
 *
 * Avec un milliard de codes possibles, un tirage ne tombe sur un code pris que
 * si le serveur porte des centaines de millions de parties privees. Vingt
 * tirages manques de suite signalent donc un tirage defaillant, pas un manque de
 * chance: mieux vaut une erreur franche qu'une boucle sans fin.
 */
const TIRAGES_DE_CODE_MAXIMUM = 20;

/** Reglages communs a toutes les rooms d'un meme gestionnaire. */
export interface OptionsRoomManager {
  /** Horloge fournie a chaque room. Celle du systeme par defaut. */
  readonly horloge?: Horloge;
  /** Cadence des boucles, en millisecondes. Celle de GameRoom par defaut. */
  readonly cadenceMs?: number;
  /**
   * Comment tirer la graine d'une partie quand l'appelant n'en fournit pas.
   *
   * C'est le seul endroit du serveur ou du hasard non maitrise a sa place: une
   * partie doit differer de la precedente. Une fois la graine tiree, tout ce qui
   * suit en decoule et se rejoue a l'identique. Les tests fournissent leur
   * propre tirage, ou leur propre graine.
   */
  readonly genererGraine?: () => number;
  /**
   * Comment tirer un code d'invitation.
   *
   * Par defaut, le generateur cryptographique de Node: un code ne doit pas se
   * deviner a partir des precedents, ce que la graine d'une partie, elle, n'a
   * pas a garantir. Les tests fournissent leur propre tirage.
   */
  readonly tirerCode?: () => string;
}

/** Ce qu'il faut pour ouvrir une partie. */
export interface OptionsCreationRoom {
  /** Graine de la partie. Tiree automatiquement si elle n'est pas fournie. */
  readonly graine?: number;
  /** Mode de la partie. Le Classique par defaut. */
  readonly mode?: Mode;
  /** Visibilite de la partie. Publique par defaut; privee, elle recoit un code. */
  readonly visibilite?: Visibilite;
  /** Reglages choisis par l'hote. Ceux qui manquent prennent la valeur par defaut. */
  readonly reglages?: ReglagesPartiels;
  /** Terrain de la partie, decode hors du moteur. Sans lui, une carte sans mur. */
  readonly terrain?: CarteCollisions;
  /** Appele apres chaque battement. C'est par la que la couche reseau diffuse. */
  readonly surBattement?: (room: GameRoom) => void;
  /** Appele au battement ou la partie se termine. */
  readonly surFinDePartie?: (room: GameRoom) => void;
}

/** Tirage par defaut d'une graine de partie: un entier sur 32 bits. */
function graineAuHasard(): number {
  return Math.floor(Math.random() * 0x100000000);
}

/** Tirage par defaut d'un code d'invitation, lettre par lettre dans l'alphabet des codes. */
function codeAuHasard(): string {
  const { alphabet, longueur } = BORNES_CODE_INVITATION;

  return Array.from({ length: longueur }, () => alphabet[randomInt(alphabet.length)]).join('');
}

/** Le gestionnaire des parties d'un serveur. */
export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly horloge: Horloge | undefined;
  private readonly cadenceMs: number | undefined;
  private readonly genererGraine: () => number;
  private readonly tirerCode: () => string;

  /**
   * Numero de la prochaine room.
   *
   * Un compteur d'instance, pas un compteur global: deux gestionnaires
   * numerotent chacun de leur cote, et leurs identifiants ne se melangent pas
   * puisqu'on ne cherche une room que dans le gestionnaire qui l'a creee.
   */
  private prochainNumero = 1;

  constructor(options: OptionsRoomManager = {}) {
    this.horloge = options.horloge;
    this.cadenceMs = options.cadenceMs;
    this.genererGraine = options.genererGraine ?? graineAuHasard;
    this.tirerCode = options.tirerCode ?? codeAuHasard;
  }

  /** Le nombre de parties ouvertes. */
  get nombreDeRooms(): number {
    return this.rooms.size;
  }

  /** Toutes les parties ouvertes, dans leur ordre de creation. */
  get toutesLesRooms(): readonly GameRoom[] {
    return [...this.rooms.values()];
  }

  /**
   * Ouvre une partie, vide, dans son salon.
   *
   * Elle n'a ni joueur, ni bot, ni hote: c'est le premier joueur accueilli qui
   * devient hote, et c'est le lancement qui pose les bots. Une partie privee
   * recoit un code d'invitation qu'aucune autre partie ouverte ne porte.
   *
   * @throws Si aucun code libre n'a pu etre tire. Voir TIRAGES_DE_CODE_MAXIMUM.
   */
  creer(options: OptionsCreationRoom = {}): GameRoom {
    const id = `room-${this.prochainNumero}`;
    this.prochainNumero += 1;

    const visibilite = options.visibilite ?? 'publique';
    const code = visibilite === 'privee' ? this.codeLibre() : undefined;

    // Les champs facultatifs sont omis plutot que poses a undefined: le projet
    // compile avec exactOptionalPropertyTypes, qui distingue les deux.
    const parametres: OptionsGameRoom = {
      id,
      graine: options.graine ?? this.genererGraine(),
      visibilite,
      ...(code === undefined ? {} : { code }),
      ...(options.mode === undefined ? {} : { mode: options.mode }),
      ...(options.reglages === undefined ? {} : { reglages: options.reglages }),
      ...(options.terrain === undefined ? {} : { terrain: options.terrain }),
      ...(options.surBattement === undefined ? {} : { surBattement: options.surBattement }),
      ...(options.surFinDePartie === undefined ? {} : { surFinDePartie: options.surFinDePartie }),
      ...(this.horloge === undefined ? {} : { horloge: this.horloge }),
      ...(this.cadenceMs === undefined ? {} : { cadenceMs: this.cadenceMs }),
    };

    const room = new GameRoom(parametres);
    this.rooms.set(id, room);

    return room;
  }

  /** Retrouve une partie par son identifiant. */
  room(id: string): GameRoom | undefined {
    return this.rooms.get(id);
  }

  /**
   * Retrouve une partie privee par son code d'invitation.
   *
   * Le code attendu est sous sa forme canonique, celle que la validation rend.
   */
  parCode(code: string): GameRoom | undefined {
    return this.toutesLesRooms.find((room) => room.code === code);
  }

  /**
   * Les parties publiques qu'un joueur peut rejoindre depuis la liste: dans leur
   * salon, et pas pleines. Dans leur ordre de creation, la plus ancienne d'abord.
   */
  partiesPubliquesOuvertes(): readonly GameRoom[] {
    return this.toutesLesRooms.filter(
      (room) => room.visibilite === 'publique' && room.statut === 'salon' && !room.estPleine,
    );
  }

  /**
   * Fait entrer un joueur dans une partie.
   *
   * Un identifiant de room inconnu est un refus a expliquer, pas une panne: un
   * joueur peut tres bien tenter de rejoindre une partie qui vient d'etre
   * fermee.
   */
  rejoindre(idRoom: string, session: SessionJoueur): ResultatValidation<JoueurDeRoom> {
    const room = this.rooms.get(idRoom);

    if (room === undefined) {
      return { valide: false, erreurs: [{ champ: 'room', motif: "Cette partie n'existe plus." }] };
    }

    return room.accueillir(session);
  }

  /**
   * Fait sortir un joueur, et ferme la partie si elle se retrouve vide.
   *
   * @returns Vrai si le joueur etait bien dans cette partie.
   */
  quitter(idRoom: string, idJoueur: string): boolean {
    const room = this.rooms.get(idRoom);

    if (room === undefined) {
      return false;
    }

    const sorti = room.faireSortir(idJoueur);

    if (room.estVide) {
      this.detruire(idRoom);
    }

    return sorti;
  }

  /**
   * Ferme une partie: sa boucle s'arrete, et elle n'est plus retrouvable.
   *
   * @returns Vrai si la partie existait.
   */
  detruire(idRoom: string): boolean {
    const room = this.rooms.get(idRoom);

    if (room === undefined) {
      return false;
    }

    room.arreter();
    this.rooms.delete(idRoom);

    return true;
  }

  /**
   * Ferme toutes les parties.
   *
   * Sert a l'extinction du serveur, et aux tests qui ne veulent pas laisser
   * derriere eux une boucle qui bat encore.
   */
  toutFermer(): void {
    for (const id of [...this.rooms.keys()]) {
      this.detruire(id);
    }
  }

  /**
   * Un code d'invitation qu'aucune partie ouverte ne porte.
   *
   * Le code d'une partie detruite redevient libre: il ne designe plus rien.
   */
  private codeLibre(): string {
    for (let tirage = 0; tirage < TIRAGES_DE_CODE_MAXIMUM; tirage += 1) {
      const code = this.tirerCode();

      if (this.parCode(code) === undefined) {
        return code;
      }
    }

    throw new Error(
      `Aucun code d'invitation libre en ${String(TIRAGES_DE_CODE_MAXIMUM)} tirages: le tirage des codes est defaillant.`,
    );
  }
}
