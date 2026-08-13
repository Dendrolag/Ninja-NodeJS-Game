/**
 * Harnais de caracterisation du legacy.
 *
 * Ce module charge le serveur d'origine (legacy/server.js) et le rend testable
 * sans jamais le modifier. C'est la piece centrale de l'etape 0.2.
 *
 * ## Le probleme
 *
 * legacy/server.js n'est pas importable dans un test. Des sa premiere ligne
 * evaluee, il ouvre un serveur Express, cree un serveur Socket.IO, decode une
 * image de collision avec la bibliotheque native canvas, demarre une boucle de
 * jeu a vingt battements par seconde et se met a l'ecoute d'un port. Il tient
 * en plus tout son etat dans des variables de module: une seule partie, un seul
 * salon, partages par tout le processus. Deux scenarios executes a la suite se
 * pollueraient l'un l'autre.
 *
 * ## La solution retenue
 *
 * On lit le fichier comme du texte, on remplace uniquement ses lignes d'import,
 * et on evalue le reste dans une fonction dont les parametres portent les noms
 * des elements a controler: Date, Math, setTimeout, setInterval, console, ainsi
 * que les dependances externes. En JavaScript, un parametre de fonction masque
 * la variable globale de meme nom. Le code du legacy n'est donc pas retouche:
 * il continue d'appeler Date.now() et Math.random(), mais ces appels atteignent
 * l'horloge et le hasard que le test lui fournit.
 *
 * Trois consequences utiles:
 *
 * 1. Chaque appel a creerHarnais() produit une instance neuve, avec son propre
 *    etat global. La remise a zero entre deux scenarios est gratuite.
 * 2. Le temps et le hasard sont deterministes, donc les instantanes sont
 *    stables.
 * 3. Aucune entree-sortie reelle: pas de port ouvert, pas de fichier lu, pas de
 *    minuterie qui tourne en fond.
 *
 * Les constantes de legacy/game-constants.js sont chargees de la meme facon,
 * par evaluation de leur texte source dans la meme portee. Cela garantit que
 * chaque instance dispose de sa propre copie mutable, et que les accesseurs
 * dynamiques de GAME_CONFIG sont preserves tels quels, defauts compris.
 *
 * ## Ce que ce harnais ne fait pas
 *
 * Il ne corrige rien. Les bugs du legacy sont presents et observables: c'est
 * meme la raison d'etre de l'etape. Les fichiers de legacy/ ne sont jamais
 * ecrits, seulement lus.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { creerAlea } from './alea.js';

const RACINE_DEPOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const CHEMIN_SERVEUR = path.join(RACINE_DEPOT, 'legacy', 'server.js');
const CHEMIN_CONSTANTES = path.join(RACINE_DEPOT, 'legacy', 'game-constants.js');

// =========================================================================
// TYPES DECRIVANT LA SURFACE DU LEGACY
// =========================================================================
// Ces interfaces ne sont pas une specification: elles decrivent ce que le
// legacy expose reellement aujourd'hui, pour que les tests soient lisibles.

/** Une entite de jeu quelconque: joueur, bot ou bot noir. */
export interface EntiteLegacy {
  id: string;
  x: number;
  y: number;
  color: string;
  direction: string;
  type?: string;
}

/** Un joueur, tel que la classe Player du legacy le construit. */
export interface JoueurLegacy extends EntiteLegacy {
  nickname: string;
  type: 'player';
  captures: number;
  capturedPlayers: Record<string, { nickname: string; count: number }>;
  capturedBy: Record<string, { nickname: string; count: number }>;
  botsControlled: number;
  totalBotsCaptures: number;
  capturedByBlackBot: number;
  blackBotsDestroyed: number;
  spawnProtection: number;
  lastCapture: number;
  bonusStartTime: number;
  invincibilityActive: boolean;
  speedBoostActive: boolean;
  revealActive?: boolean;
  bonusTimers?: { speed: number; invincibility: number; reveal: number };
  isInvulnerable(): boolean;
  canCapture(): boolean;
  respawn(couleursExclues?: string[], garderCouleur?: boolean): void;
}

/** Un bot noir, avec la partie de son comportement que l'on caracterise. */
export interface BotNoirLegacy extends EntiteLegacy {
  type: string;
  detectionRadius: number;
  baseSpeed: number;
  lastCaptureTime: number;
  captureCooldown: number;
  targetEntity: EntiteLegacy | null;
  captureEntity(entite: EntiteLegacy): void;
  findNewTarget(entites: Record<string, EntiteLegacy>): void;
  pursueTarget(): void;
  getDistanceTo(entite: EntiteLegacy): number;
}

/** Un bonus ou un malus pose sur la carte. */
export interface RamassableLegacy {
  id: string;
  type: string;
  x: number;
  y: number;
  createdAt: number;
  lifetime: number;
  isExpired(): boolean;
}

/** Une ligne du classement, telle que calculatePlayerScores la produit. */
export interface ScoreLegacy {
  id: string;
  nickname: string;
  currentBots: number;
  totalBotsControlled: number;
  captures: number;
  capturedPlayers: Record<string, { nickname: string; count: number }>;
  capturedBy: Record<string, { nickname: string; count: number }>;
  capturedByBlackBot: number;
  blackBotsDestroyed: number;
  color: string;
}

/** La carte de collisions derivee de l'image collision.png. */
export interface CarteCollisionsLegacy {
  collisionData: boolean[][] | null;
  initialize(mapId?: string, mirrorMode?: boolean): Promise<boolean>;
  canMove(deX: number, deY: number, versX: number, versY: number, rayon?: number): boolean;
  checkCollision(x: number, y: number): boolean;
}

/**
 * Le gestionnaire de positions du legacy, charge d'eviter que deux entites
 * apparaissent l'une sur l'autre.
 */
export interface GestionnaireDePositionsLegacy {
  entitiesPositions: Map<string, { x: number; y: number }>;
  isValidPosition(x: number, y: number, rayon?: number): boolean;
  registerEntity(identifiant: string, x: number, y: number): void;
}

/** Un message sorti du serveur, capture au lieu d'etre envoye sur le reseau. */
export interface Emission {
  /** Destinataire: 'io' pour une diffusion generale, sinon l'identifiant de la socket. */
  cible: string;
  evenement: string;
  donnees: unknown;
}

/** Une socket factice, substituee a une vraie connexion Socket.IO. */
export interface SocketFactice {
  id: string;
  /** Declenche un evenement entrant, comme si le client l'avait envoye. */
  declencher(evenement: string, donnees?: unknown): void;
  /** Vrai si le serveur a enregistre un gestionnaire pour cet evenement. */
  ecoute(evenement: string): boolean;
}

/** Horloge simulee substituee a Date.now(). */
export interface HorlogeFactice {
  maintenant(): number;
  avancerDe(millisecondes: number): void;
  reglerA(millisecondes: number): void;
}

/** Une minuterie que le legacy a programmee, et que le harnais n'execute jamais. */
export interface MinuterieProgrammee {
  sorte: 'setTimeout' | 'setInterval';
  delai: number;
}

/** Image de collision factice, substituee au decodage de collision.png. */
export interface ImageDeCollision {
  largeur: number;
  hauteur: number;
  /** Donnees RVBA, quatre octets par pixel, dans l'ordre de lecture de l'image. */
  donnees: Uint8ClampedArray;
}

export interface OptionsHarnais {
  /** Graine du hasard. Deux harnais de meme graine se comportent identiquement. */
  graine?: number;
  /** Valeur initiale de l'horloge simulee, en millisecondes. */
  horlogeInitiale?: number;
}

/**
 * Tout ce qu'un test peut atteindre dans une instance de legacy chargee.
 * Les collections sont exposees en lecture vive: le legacy reaffecte certaines
 * d'entre elles (bonuses, malusItems), donc on passe par des accesseurs.
 */
export interface Harnais {
  // --- Etat global du legacy -------------------------------------------
  readonly players: Record<string, JoueurLegacy>;
  readonly bots: Record<string, EntiteLegacy>;
  readonly blackBots: Record<string, BotNoirLegacy>;
  readonly bonuses: RamassableLegacy[];
  readonly malusItems: RamassableLegacy[];
  readonly currentGameSettings: Record<string, unknown>;
  readonly waitingRoom: { players: Map<string, unknown>; isGameStarted: boolean };
  readonly MAP_DIMENSIONS: Record<string, { width: number; height: number }>;
  readonly availableColors: readonly string[];

  // --- Fonctions de jeu caracterisees ----------------------------------
  handlePlayerCapture(attaquant: JoueurLegacy, victime: JoueurLegacy): void;
  detectCollisions(entite: EntiteLegacy, identifiant: string): void;
  calculatePlayerScores(): ScoreLegacy[];
  handleBonusCollection(joueur: JoueurLegacy, bonus: RamassableLegacy): void;
  handleMalusCollection(joueur: JoueurLegacy, malus: RamassableLegacy): void;
  /** Expiration des bonus, telle que la boucle de jeu l'appelle a chaque tour. */
  updatePlayerBonuses(): void;

  // --- Objets et classes du legacy --------------------------------------
  readonly collisionMap: CarteCollisionsLegacy;
  readonly positionManager: GestionnaireDePositionsLegacy;
  creerJoueurNu(identifiant: string, pseudo: string): JoueurLegacy;
  creerBotNu(identifiant: string): EntiteLegacy;
  creerBotNoirNu(identifiant: string): BotNoirLegacy;
  creerBonus(type: string): RamassableLegacy;
  creerMalus(type: string): RamassableLegacy;

  // --- Controles du harnais ---------------------------------------------
  readonly horloge: HorlogeFactice;
  /** Tout ce que le serveur a tente d'emettre, dans l'ordre. */
  readonly emissions: readonly Emission[];
  /** Les emissions destinees a une cible donnee ('io' pour la diffusion generale). */
  emissionsVers(cible: string): Emission[];
  /** Les minuteries que le legacy a programmees. Aucune n'est executee. */
  readonly minuteries: readonly MinuterieProgrammee[];
  /** Les lignes que le legacy a ecrites sur la console. */
  readonly journal: readonly string[];

  /**
   * Ajoute un joueur pret a jouer: instance Player, inscription dans players,
   * et socket factice branchee pour que ses notifications soient capturees.
   */
  ajouterJoueur(
    identifiant: string,
    pseudo: string,
    reglages?: { couleur?: string; x?: number; y?: number },
  ): JoueurLegacy;

  /** Ajoute un bot d'une couleur et d'une position donnees. */
  ajouterBot(identifiant: string, couleur: string, x?: number, y?: number): EntiteLegacy;

  /** Ajoute un bot noir a une position donnee. */
  ajouterBotNoir(identifiant: string, x?: number, y?: number): BotNoirLegacy;

  /** Ajoute un bonus a une position donnee. */
  ajouterBonus(type: string, x: number, y: number): RamassableLegacy;

  /** Ajoute un malus a une position donnee. */
  ajouterMalus(type: string, x: number, y: number): RamassableLegacy;

  /**
   * Ouvre une connexion factice et laisse le legacy y brancher ses
   * gestionnaires d'evenements. C'est par la qu'on atteint le gestionnaire
   * 'move', qui contient la resolution du deplacement contre les murs.
   */
  connecterSocket(identifiant: string): SocketFactice;

  /**
   * Charge une carte de collisions a partir d'une image factice, en passant par
   * le vrai code de seuillage du legacy.
   */
  chargerCarteDeCollisions(image: ImageDeCollision, identifiantCarte: string): Promise<boolean>;
}

// =========================================================================
// PREPARATION DU CODE SOURCE
// =========================================================================

/**
 * Retire les declarations d'import du legacy: ses dependances sont injectees.
 *
 * Remplace aussi import.meta.url par un parametre. Le corps evalue n'est pas un
 * module ES, et import.meta y serait une erreur de syntaxe. Le legacy s'en sert
 * uniquement pour retrouver son propre repertoire.
 */
function retirerLesImports(source: string): string {
  return source
    .replace(/^import[\s\S]*?from\s+'[^']+';/gm, '')
    .replace(/import\.meta\.url/g, '__URL_LEGACY');
}

/** Retire le mot-cle export des constantes: elles vivront dans la meme portee. */
function retirerLesExports(source: string): string {
  return source.replace(/^export /gm, '');
}

/** Noms des parametres qui masquent les globales et les dependances du legacy. */
const PARAMETRES = [
  'express',
  'createServer',
  'Server',
  'fileURLToPath',
  'dirname',
  'path',
  'createCanvas',
  'loadImage',
  'Date',
  'Math',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'console',
  '__URL_LEGACY',
] as const;

/**
 * Elements que le corps evalue renvoie au harnais. Tout passe par des
 * accesseurs, car le legacy reaffecte plusieurs de ses collections.
 */
const EPILOGUE_EXPOSITION = `
return {
  get players() { return players; },
  get bots() { return bots; },
  get blackBots() { return blackBots; },
  get bonuses() { return bonuses; },
  get malusItems() { return malusItems; },
  get activeSockets() { return activeSockets; },
  get currentGameSettings() { return currentGameSettings; },
  get waitingRoom() { return waitingRoom; },
  get availableColors() { return availableColors; },
  MAP_DIMENSIONS,
  GAME_CONFIG,
  TIME_CONFIG,
  SPEED_CONFIG,
  DEFAULT_GAME_SETTINGS,
  collisionMap,
  positionManager,
  Player,
  Bot,
  BlackBot,
  Bonus,
  Malus,
  handlePlayerCapture,
  handleBonusCollection,
  handleMalusCollection,
  detectCollisions,
  calculatePlayerScores,
  updatePlayerBonuses,
  getUniqueColor,
  resetPlayer,
};
`;

/** Source assemblee du legacy, lue une seule fois puis reutilisee. */
let sourceAssemblee: string | null = null;

function lireSourceAssemblee(): string {
  if (sourceAssemblee === null) {
    const constantes = retirerLesExports(readFileSync(CHEMIN_CONSTANTES, 'utf8'));
    const serveur = retirerLesImports(readFileSync(CHEMIN_SERVEUR, 'utf8'));
    // Le legacy est un module ES, donc toujours en mode strict. On le conserve:
    // sans cela, une affectation a une variable non declaree creerait une
    // globale en silence au lieu de lever une erreur.
    sourceAssemblee = `'use strict';\n${constantes}\n${serveur}\n${EPILOGUE_EXPOSITION}`;
  }
  return sourceAssemblee;
}

// =========================================================================
// CONSTRUCTION D'UNE INSTANCE
// =========================================================================

/** Forme brute renvoyee par le corps evalue. Typage interne au harnais. */
interface InstanceLegacy {
  players: Record<string, JoueurLegacy>;
  bots: Record<string, EntiteLegacy>;
  blackBots: Record<string, BotNoirLegacy>;
  bonuses: RamassableLegacy[];
  malusItems: RamassableLegacy[];
  activeSockets: Record<string, unknown>;
  currentGameSettings: Record<string, unknown>;
  waitingRoom: { players: Map<string, unknown>; isGameStarted: boolean };
  availableColors: string[];
  MAP_DIMENSIONS: Record<string, { width: number; height: number }>;
  collisionMap: CarteCollisionsLegacy;
  positionManager: GestionnaireDePositionsLegacy;
  Player: new (id: string, pseudo: string) => JoueurLegacy;
  Bot: new (id: string) => EntiteLegacy;
  BlackBot: new (id: string) => BotNoirLegacy;
  Bonus: new (type: string) => RamassableLegacy;
  Malus: new (type: string) => RamassableLegacy;
  handlePlayerCapture(attaquant: JoueurLegacy, victime: JoueurLegacy): void;
  handleBonusCollection(joueur: JoueurLegacy, bonus: RamassableLegacy): void;
  handleMalusCollection(joueur: JoueurLegacy, malus: RamassableLegacy): void;
  detectCollisions(entite: EntiteLegacy, identifiant: string): void;
  calculatePlayerScores(): ScoreLegacy[];
  updatePlayerBonuses(): void;
}

/**
 * Charge une instance neuve du legacy, isolee de toutes les autres.
 *
 * @param options Graine du hasard et valeur initiale de l'horloge.
 */
export function creerHarnais(options: OptionsHarnais = {}): Harnais {
  const alea = creerAlea(options.graine ?? 20260813);
  let instantPresent = options.horlogeInitiale ?? 1_000_000;

  const emissions: Emission[] = [];
  const minuteries: MinuterieProgrammee[] = [];
  const journal: string[] = [];

  /** L'image que le prochain chargement de carte de collisions consommera. */
  let imageEnAttente: ImageDeCollision | null = null;

  // --- Substituts des globales ------------------------------------------

  const horlogeFactice = {
    now: () => instantPresent,
  };

  const mathFactice: Math = Object.create(Math) as Math;
  Object.defineProperty(mathFactice, 'random', { value: alea, writable: true });

  const consoleFactice = new Proxy({} as Record<string, unknown>, {
    get:
      () =>
      (...arguments_: unknown[]) => {
        journal.push(arguments_.map((valeur) => String(valeur)).join(' '));
      },
  });

  // Les minuteries sont enregistrees puis oubliees. Le legacy en programme
  // beaucoup et n'en annule aucune (voir le defaut X1 de l'audit): les
  // executer rendrait tout scenario imprevisible.
  let compteurMinuteries = 0;
  const setTimeoutFactice = (_rappel: unknown, delai = 0): number => {
    minuteries.push({ sorte: 'setTimeout', delai });
    return ++compteurMinuteries;
  };
  const setIntervalFactice = (_rappel: unknown, delai = 0): number => {
    minuteries.push({ sorte: 'setInterval', delai });
    return ++compteurMinuteries;
  };
  const annulerMinuterie = (): void => {};

  // --- Substituts des dependances externes -------------------------------

  const applicationFactice = {
    use: () => applicationFactice,
    get: () => applicationFactice,
  };
  const expressFactice = Object.assign(() => applicationFactice, {
    static: () => () => {},
  });
  const creerServeurFactice = () => ({ listen: () => {} });

  /** Gestionnaire de connexion que le legacy enregistre au chargement. */
  let gestionnaireDeConnexion: ((socket: unknown) => void) | null = null;

  const ioFactice = {
    on: (evenement: string, gestionnaire: (socket: unknown) => void) => {
      if (evenement === 'connection') gestionnaireDeConnexion = gestionnaire;
    },
    emit: (evenement: string, donnees?: unknown) => {
      emissions.push({ cible: 'io', evenement, donnees });
    },
    to: (cible: string) => ({
      emit: (evenement: string, donnees?: unknown) => {
        emissions.push({ cible, evenement, donnees });
      },
    }),
    sockets: { sockets: new Map<string, unknown>() },
  };
  const ServeurFactice = function ServeurFactice() {
    return ioFactice;
  } as unknown as new (...arguments_: unknown[]) => unknown;

  // Decodage d'image: on ne branche pas la bibliotheque native canvas. On
  // fournit des pixels connus, et c'est le vrai code de seuillage du legacy
  // qui les transforme en carte de collisions.
  const chargerImageFactice = async (): Promise<unknown> => {
    if (imageEnAttente === null) {
      // Aucune image fournie: la promesse ne se resout jamais, donc
      // collisionData reste null et la carte se comporte comme un terrain
      // entierement libre. C'est l'etat par defaut, voulu, des scenarios qui
      // ne portent pas sur le terrain.
      return new Promise<never>(() => {});
    }
    return { largeur: imageEnAttente.largeur, hauteur: imageEnAttente.hauteur };
  };
  const creerCanevasFactice = () => ({
    getContext: () => ({
      drawImage: () => {},
      getImageData: () => ({ data: imageEnAttente?.donnees ?? new Uint8ClampedArray(0) }),
    }),
  });

  // --- Evaluation du legacy ----------------------------------------------

  const fabrique = new Function(...PARAMETRES, lireSourceAssemblee()) as (
    ...arguments_: unknown[]
  ) => InstanceLegacy;

  const legacy = fabrique(
    expressFactice,
    creerServeurFactice,
    ServeurFactice,
    fileURLToPath,
    path.dirname,
    path,
    creerCanevasFactice,
    chargerImageFactice,
    horlogeFactice,
    mathFactice,
    setTimeoutFactice,
    setIntervalFactice,
    annulerMinuterie,
    annulerMinuterie,
    consoleFactice,
    pathToFileURL(CHEMIN_SERVEUR).href,
  );

  // --- Sockets factices ---------------------------------------------------

  /**
   * Fabrique une socket qui enregistre ce qu'on lui demande d'emettre et
   * retient les gestionnaires que le legacy y branche.
   */
  function fabriquerSocket(identifiant: string): {
    socket: Record<string, unknown>;
    facade: SocketFactice;
  } {
    const gestionnaires = new Map<string, (donnees?: unknown) => void>();

    const socket: Record<string, unknown> = {
      id: identifiant,
      on: (evenement: string, gestionnaire: (donnees?: unknown) => void) => {
        gestionnaires.set(evenement, gestionnaire);
      },
      emit: (evenement: string, donnees?: unknown) => {
        emissions.push({ cible: identifiant, evenement, donnees });
      },
      join: () => {},
      leave: () => {},
      disconnect: () => {},
      broadcast: {
        emit: (evenement: string, donnees?: unknown) => {
          emissions.push({ cible: 'broadcast', evenement, donnees });
        },
      },
    };

    const facade: SocketFactice = {
      id: identifiant,
      declencher: (evenement, donnees) => {
        const gestionnaire = gestionnaires.get(evenement);
        if (gestionnaire === undefined) {
          throw new Error(`Le legacy n'ecoute pas l'evenement "${evenement}".`);
        }
        gestionnaire(donnees);
      },
      ecoute: (evenement) => gestionnaires.has(evenement),
    };

    return { socket, facade };
  }

  // --- Assemblage du harnais ---------------------------------------------

  const harnais: Harnais = {
    get players() {
      return legacy.players;
    },
    get bots() {
      return legacy.bots;
    },
    get blackBots() {
      return legacy.blackBots;
    },
    get bonuses() {
      return legacy.bonuses;
    },
    get malusItems() {
      return legacy.malusItems;
    },
    get currentGameSettings() {
      return legacy.currentGameSettings;
    },
    get waitingRoom() {
      return legacy.waitingRoom;
    },
    get MAP_DIMENSIONS() {
      return legacy.MAP_DIMENSIONS;
    },
    get availableColors() {
      return legacy.availableColors;
    },

    handlePlayerCapture: (attaquant, victime) => legacy.handlePlayerCapture(attaquant, victime),
    detectCollisions: (entite, identifiant) => legacy.detectCollisions(entite, identifiant),
    calculatePlayerScores: () => legacy.calculatePlayerScores(),
    handleBonusCollection: (joueur, bonus) => legacy.handleBonusCollection(joueur, bonus),
    handleMalusCollection: (joueur, malus) => legacy.handleMalusCollection(joueur, malus),
    updatePlayerBonuses: () => legacy.updatePlayerBonuses(),

    get collisionMap() {
      return legacy.collisionMap;
    },
    get positionManager() {
      return legacy.positionManager;
    },
    creerJoueurNu: (identifiant, pseudo) => new legacy.Player(identifiant, pseudo),
    creerBotNu: (identifiant) => new legacy.Bot(identifiant),
    creerBotNoirNu: (identifiant) => new legacy.BlackBot(identifiant),
    creerBonus: (type) => new legacy.Bonus(type),
    creerMalus: (type) => new legacy.Malus(type),

    horloge: {
      maintenant: () => instantPresent,
      avancerDe: (millisecondes) => {
        instantPresent += millisecondes;
      },
      reglerA: (millisecondes) => {
        instantPresent = millisecondes;
      },
    },

    emissions,
    emissionsVers: (cible) => emissions.filter((emission) => emission.cible === cible),
    minuteries,
    journal,

    ajouterJoueur: (identifiant, pseudo, reglages = {}) => {
      const { socket } = fabriquerSocket(identifiant);
      const joueur = new legacy.Player(identifiant, pseudo);
      if (reglages.couleur !== undefined) joueur.color = reglages.couleur;
      if (reglages.x !== undefined) joueur.x = reglages.x;
      if (reglages.y !== undefined) joueur.y = reglages.y;
      legacy.players[identifiant] = joueur;
      legacy.activeSockets[identifiant] = socket;
      return joueur;
    },

    ajouterBot: (identifiant, couleur, x = 0, y = 0) => {
      const bot = new legacy.Bot(identifiant);
      bot.color = couleur;
      bot.x = x;
      bot.y = y;
      legacy.bots[identifiant] = bot;
      return bot;
    },

    ajouterBotNoir: (identifiant, x = 0, y = 0) => {
      const botNoir = new legacy.BlackBot(identifiant);
      botNoir.x = x;
      botNoir.y = y;
      legacy.blackBots[identifiant] = botNoir;
      return botNoir;
    },

    ajouterBonus: (type, x, y) => {
      const bonus = new legacy.Bonus(type);
      bonus.x = x;
      bonus.y = y;
      legacy.bonuses.push(bonus);
      return bonus;
    },

    ajouterMalus: (type, x, y) => {
      const malus = new legacy.Malus(type);
      malus.x = x;
      malus.y = y;
      legacy.malusItems.push(malus);
      return malus;
    },

    connecterSocket: (identifiant) => {
      if (gestionnaireDeConnexion === null) {
        throw new Error("Le legacy n'a pas enregistre de gestionnaire de connexion.");
      }
      const { socket, facade } = fabriquerSocket(identifiant);
      legacy.activeSockets[identifiant] = socket;
      gestionnaireDeConnexion(socket);
      return facade;
    },

    chargerCarteDeCollisions: async (image, identifiantCarte) => {
      // On declare la carte comme le legacy le ferait pour une vraie carte, puis
      // on la selectionne: tout son code de collision lit les dimensions via
      // MAP_DIMENSIONS[currentGameSettings.selectedMap].
      legacy.MAP_DIMENSIONS[identifiantCarte] = {
        width: image.largeur,
        height: image.hauteur,
      };
      legacy.currentGameSettings['selectedMap'] = identifiantCarte;
      imageEnAttente = image;
      const resultat = await legacy.collisionMap.initialize(identifiantCarte, false);
      imageEnAttente = null;
      return resultat;
    },
  };

  return harnais;
}

// =========================================================================
// FABRICATION D'IMAGES DE COLLISION
// =========================================================================

/**
 * Construit une image de collision factice, au format que le legacy attend:
 * quatre octets par pixel, dans l'ordre rouge, vert, bleu, alpha.
 *
 * Le legacy considere un pixel comme un mur quand la moyenne de ses trois
 * composantes est strictement inferieure a 128. On peint donc les murs en noir
 * et le sol en blanc.
 *
 * @param largeur Largeur de la carte en pixels.
 * @param hauteur Hauteur de la carte en pixels.
 * @param estUnMur Predicat appele pour chaque pixel.
 */
export function imageDeCollision(
  largeur: number,
  hauteur: number,
  estUnMur: (x: number, y: number) => boolean,
): ImageDeCollision {
  const donnees = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const index = (y * largeur + x) * 4;
      const niveau = estUnMur(x, y) ? 0 : 255;
      donnees[index] = niveau;
      donnees[index + 1] = niveau;
      donnees[index + 2] = niveau;
      donnees[index + 3] = 255;
    }
  }
  return { largeur, hauteur, donnees };
}

/**
 * Construit une image de collision d'un seul pixel, d'une teinte donnee.
 * Sert a caracteriser le seuil de luminosite, sans dependre d'une carte reelle.
 */
export function imageDUnPixel(rouge: number, vert: number, bleu: number): ImageDeCollision {
  return {
    largeur: 1,
    hauteur: 1,
    donnees: new Uint8ClampedArray([rouge, vert, bleu, 255]),
  };
}
