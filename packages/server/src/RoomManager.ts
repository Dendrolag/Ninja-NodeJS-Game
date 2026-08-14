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
 * creera un a l'etape 2.2, et les tests en creent autant qu'ils veulent, sans
 * qu'ils se voient.
 *
 * UNE ROOM VIDE EST DETRUITE. Le dernier joueur qui part emporte la partie avec
 * lui: la boucle s'arrete, l'etat est libere. Sans cette regle, un serveur
 * accumulerait des parties fantomes qui continueraient de battre pour personne,
 * ce qui est la forme que prenait le defaut X1 de l'audit.
 *
 * CE QUI N'EST PAS ICI. Le code d'invitation des parties privees et la file des
 * parties publiques appartiennent a l'etape 2.4; la couche Socket.IO qui appelle
 * ces methodes appartient a l'etape 2.2. Ce fichier ne connait ni reseau, ni
 * code d'invitation, ni capacite maximale.
 */

import type { ReglagesPartiels, ResultatValidation, SessionJoueur } from '@neon-ninja/shared';
import type { CarteCollisions } from '@neon-ninja/sim';

import type { JoueurDeRoom, OptionsGameRoom } from './GameRoom.js';
import { GameRoom } from './GameRoom.js';
import type { Horloge } from './horloge.js';

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
}

/** Ce qu'il faut pour ouvrir une partie. */
export interface OptionsCreationRoom {
  /** Graine de la partie. Tiree automatiquement si elle n'est pas fournie. */
  readonly graine?: number;
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

/** Le gestionnaire des parties d'un serveur. */
export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly horloge: Horloge | undefined;
  private readonly cadenceMs: number | undefined;
  private readonly genererGraine: () => number;

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
   * devient hote, et c'est le lancement qui pose les bots.
   */
  creer(options: OptionsCreationRoom = {}): GameRoom {
    const id = `room-${this.prochainNumero}`;
    this.prochainNumero += 1;

    // Les champs facultatifs sont omis plutot que poses a undefined: le projet
    // compile avec exactOptionalPropertyTypes, qui distingue les deux.
    const parametres: OptionsGameRoom = {
      id,
      graine: options.graine ?? this.genererGraine(),
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
}
