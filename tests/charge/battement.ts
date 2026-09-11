/**
 * Le banc du battement: ce que coute une partie au serveur, battement par battement.
 *
 * C'EST LA MOITIE DU HARNAIS DE CHARGE QUI NE DEPEND NI DU RESEAU NI DE L'HEURE.
 * Une vraie GameRoom, avec les murs de sa carte, est avancee battement apres
 * battement aussi vite que possible. Rien ne tourne a cote: ce qui est mesure est
 * exactement le travail qu'une partie demande au processeur du serveur a chaque
 * battement.
 *
 * TROIS POSTES SONT MESURES SEPAREMENT, parce qu'ils ne relevent pas de la meme
 * optimisation:
 *
 *   - LE MOTEUR: tick(), deplacements, bots, zones, objets, contacts. C'est la
 *     que vivraient une grille spatiale ou un niveau de detail d'IA (etape 5.2).
 *   - LA PROJECTION: instantaneDe et notificationsDe, de l'etat du moteur vers ce
 *     qui part sur le reseau.
 *   - LE CODAGE: la trame binaire du flux d'etat (etape 2.3), image ou delta,
 *     codee par le meme FluxDEtat que la couche reseau. Jusqu'a l'etape 2.3,
 *     c'etait la serialisation JSON de l'instantane.
 *
 * LA TAILLE DU MESSAGE EST CELLE DU FIL. Socket.IO envoie une trame binaire en deux
 * paquets: un en-tete en texte, `451-["etat",{"_placeholder":true,"num":0}]`, ou
 * « 4 » est le type d'un message Engine.IO et « 51- » celui d'un evenement a une
 * piece binaire, puis les octets de la trame, tels quels. Le harnais reseau
 * (charge-reseau.ts) mesure ces deux paquets sur de vrais clients, ce qui verifie
 * ce calcul. La taille qu'aurait eue l'ancien message JSON, `42["etat",{...}]`, et
 * la taille de la trame compressee sont donnees a titre de comparaison, sur un
 * battement sur vingt.
 *
 * LE BANC EST DETERMINISTE, sauf pour les durees. Meme graine, memes intentions
 * tirees au generateur a graine, meme pas de temps: la partie jouee est la meme a
 * chaque execution, donc la taille de chaque message aussi, a l'octet pres. Les
 * durees, elles, dependent de la machine, et varient d'une execution a l'autre:
 * c'est pour cela qu'elles sont resumees par des centiles.
 *
 * AUCUN CODE DU JEU N'EST MODIFIE NI IMITE. La room est celle du serveur, lue dans
 * sa compilation, c'est-a-dire le code qui tourne en production. Seul le rappel
 * de battement, que la room offre a qui veut etre prevenu, est fourni ici.
 */

import { deflateRawSync } from 'node:zlib';

import type { CarteCollisions } from '../../packages/sim/dist/index.js';
import type { Alea, IdentifiantCarte } from '../../packages/shared/dist/index.js';
import { creerAlea, entier, nombre } from '../../packages/shared/dist/index.js';
import {
  CADENCE_BATTEMENT_MS,
  FluxDEtat,
  GameRoom,
  creerHorlogeManuelle,
  instantaneDe,
  notificationsDe,
} from '../../packages/server/dist/index.js';

import type { Resume } from './statistiques.ts';
import { resumer } from './statistiques.ts';

/**
 * L'en-tete que Socket.IO envoie avant les octets d'une trame du flux d'etat: le
 * type de message Engine.IO (« 4 »), le type d'evenement binaire a une piece
 * (« 51- »), et le nom de l'evenement avec l'emplacement de la piece.
 */
export const EN_TETE_DE_TRAME = `451-${JSON.stringify(['etat', { _placeholder: true, num: 0 }])}`;

/** Octets ajoutes par Socket.IO et Engine.IO autour d'une trame binaire du flux. */
export const OCTETS_D_ENVELOPPE = EN_TETE_DE_TRAME.length;

/**
 * Octets ajoutes autour du JSON d'un evenement texte: le type de message Engine.IO
 * (« 4 ») et le type d'evenement Socket.IO (« 2 »). C'etait l'enveloppe du flux
 * d'etat jusqu'a l'etape 2.3.
 */
export const OCTETS_D_ENVELOPPE_JSON = 2;

/**
 * Un battement sur combien voit ses tailles de comparaison calculees.
 *
 * Compresser, ou serialiser en JSON un instantane que plus personne n'envoie, coute
 * plus cher que coder la trame: le faire a chaque battement fausserait la duree
 * totale mesuree, qui n'en tient pourtant pas compte. Un echantillon regulier suffit
 * a une information de taille.
 */
const PERIODE_ECHANTILLON = 20;

/** Plus petit et plus grand nombre de battements entre deux changements de cap d'un joueur. */
const CAP_TENU_BATTEMENTS = { minimum: 10, maximum: 30 } as const;

/** Ce qu'il faut pour jouer le banc. */
export interface OptionsBancBattement {
  /** Nombre de bots au lancement de la partie. Le banc accepte de depasser les bornes du salon. */
  readonly bots: number;
  /** Nombre de joueurs dans la partie. */
  readonly joueurs: number;
  /** Nombre de battements mesures. */
  readonly battements: number;
  /**
   * Battements joues avant de mesurer. Le compilateur a la volee de Node optimise
   * le code apres quelques centaines d'appels: les premiers battements mesurent
   * sa mise en route, pas le jeu.
   */
  readonly echauffement: number;
  /** Graine de la partie et des intentions des joueurs. */
  readonly graine: number;
  /** Les murs de la carte. Absent: une carte sans mur, ce qui ne represente pas le jeu. */
  readonly terrain: CarteCollisions | undefined;
  /** La carte jouee. map1 par defaut, la carte par defaut du jeu. */
  readonly carte?: IdentifiantCarte;
}

/** Ce que le banc a mesure. Les durees sont en millisecondes, les tailles en octets. */
export interface ResultatBancBattement {
  readonly bots: number;
  readonly joueurs: number;
  readonly battements: number;
  /** Duree de tick(), le moteur pur. */
  readonly moteurMs: Resume;
  /** Duree de la projection: instantane et notifications. */
  readonly projectionMs: Resume;
  /** Duree du codage de la trame du flux d'etat. */
  readonly serialisationMs: Resume;
  /** Duree du battement complet: moteur, projection et codage. */
  readonly totalMs: Resume;
  /** Taille d'un message « etat » sur le fil: en-tete et trame, images comprises. */
  readonly octetsParMessage: Resume;
  /** Taille du meme message si sa trame etait compressee (deflate), sur un battement sur vingt. */
  readonly octetsCompressesParMessage: Resume;
  /**
   * Taille qu'aurait eue le message en JSON, comme jusqu'a l'etape 2.3, sur un
   * battement sur vingt.
   */
  readonly octetsJsonParMessage: Resume;
  /** Nombre d'entites (joueurs, bots, bots noirs) dans l'instantane, en moyenne. */
  readonly entitesParMessage: number;
  /**
   * Somme des tailles de tous les messages mesures.
   *
   * C'est l'empreinte de la partie jouee: deux executions de meme graine rendent
   * exactement la meme somme. Un test s'en sert pour verifier la reproductibilite.
   */
  readonly octetsTotal: number;
}

/** Ce qu'un battement mesure laisse derriere lui. */
interface MesureDUnBattement {
  projectionMs: number;
  serialisationMs: number;
  octets: number;
  octetsCompresses: number | undefined;
  octetsJson: number | undefined;
  entites: number;
}

/**
 * Joue une partie et mesure chacun de ses battements.
 *
 * La duree de la partie est reglee pour couvrir exactement les battements joues.
 * Les bots noirs apparaissant a la moitie du temps de jeu, la mesure couvre donc
 * toujours la partie sans eux, puis avec eux.
 */
export function mesurerLeBattement(options: OptionsBancBattement): ResultatBancBattement {
  const joues = options.echauffement + options.battements;

  let alea = creerAlea(options.graine ^ 0x5bd1e995);
  const avantChangement = new Map<string, number>();

  // Le flux de la partie, comme la couche reseau en tient un par partie.
  const flux = new FluxDEtat();

  // Ce que le rappel de battement a releve. La room l'appelle a l'interieur de
  // avancer(): la boucle ci-dessous le lit juste apres.
  let mesure: MesureDUnBattement | undefined;
  const surBattement = (partie: GameRoom): void => {
    const debutProjection = performance.now();
    const instantane = instantaneDe(partie.etat);
    notificationsDe(partie.etat);
    const finProjection = performance.now();
    const trame = flux.trameDuBattement(instantane);
    const finCodage = performance.now();

    mesure = {
      projectionMs: finProjection - debutProjection,
      serialisationMs: finCodage - finProjection,
      octets: trame.byteLength + OCTETS_D_ENVELOPPE,
      octetsCompresses: undefined,
      octetsJson: undefined,
      entites: instantane.entites.length,
    };

    if (partie.etat.tick % PERIODE_ECHANTILLON === 0) {
      mesure.octetsCompresses = deflateRawSync(trame).length + OCTETS_D_ENVELOPPE;
      mesure.octetsJson =
        Buffer.byteLength(JSON.stringify(['etat', instantane])) + OCTETS_D_ENVELOPPE_JSON;
    }
  };

  const room = ouvrirLaPartie(options, joues, surBattement);

  const moteur: number[] = [];
  const projection: number[] = [];
  const serialisation: number[] = [];
  const total: number[] = [];
  const octets: number[] = [];
  const compresses: number[] = [];
  const json: number[] = [];
  let entites = 0;

  for (let battement = 0; battement < joues; battement += 1) {
    alea = orienterLesJoueurs(room, alea, avantChangement);

    mesure = undefined;
    const debut = performance.now();
    room.avancer(CADENCE_BATTEMENT_MS);
    const duree = performance.now() - debut;

    if (mesure === undefined) {
      throw new Error(`Le battement ${String(battement)} n'a pas prevenu le banc.`);
    }

    if (battement < options.echauffement) {
      continue;
    }

    const releve: MesureDUnBattement = mesure;
    const horsMoteur = releve.projectionMs + releve.serialisationMs;

    moteur.push(duree - horsMoteur);
    projection.push(releve.projectionMs);
    serialisation.push(releve.serialisationMs);
    total.push(duree);
    octets.push(releve.octets);
    entites += releve.entites;

    if (releve.octetsCompresses !== undefined) {
      compresses.push(releve.octetsCompresses);
    }

    if (releve.octetsJson !== undefined) {
      json.push(releve.octetsJson);
    }
  }

  room.arreter();

  return {
    bots: options.bots,
    joueurs: options.joueurs,
    battements: options.battements,
    moteurMs: resumer(moteur),
    projectionMs: resumer(projection),
    serialisationMs: resumer(serialisation),
    totalMs: resumer(total),
    octetsParMessage: resumer(octets),
    octetsCompressesParMessage: resumer(compresses),
    octetsJsonParMessage: resumer(json),
    entitesParMessage: entites / Math.max(options.battements, 1),
    octetsTotal: octets.reduce((somme, valeur) => somme + valeur, 0),
  };
}

/**
 * Ouvre la partie du banc, la peuple de joueurs, et la lance.
 *
 * Son horloge est une horloge manuelle que personne n'avance: sa boucle ne bat
 * donc jamais d'elle-meme, et c'est le banc qui fait avancer la partie.
 */
function ouvrirLaPartie(
  options: OptionsBancBattement,
  battements: number,
  surBattement: (room: GameRoom) => void,
): GameRoom {
  const dureePartieS = Math.ceil((battements * CADENCE_BATTEMENT_MS) / 1000) + 1;

  const room = new GameRoom({
    id: 'banc',
    graine: options.graine,
    reglages: {
      carte: options.carte ?? 'map1',
      nombreBotsInitial: options.bots,
      dureePartieS,
    },
    ...(options.terrain === undefined ? {} : { terrain: options.terrain }),
    horloge: creerHorlogeManuelle(),
    surBattement,
  });

  for (let rang = 1; rang <= options.joueurs; rang += 1) {
    const entree = room.accueillir({ id: `j${String(rang)}`, pseudo: `Joueur${String(rang)}` });

    if (!entree.valide) {
      throw new Error(`Le joueur ${String(rang)} n'a pas pu entrer dans la partie du banc.`);
    }
  }

  room.lancer();

  return room;
}

/**
 * Donne a chaque joueur un cap, qu'il tient entre une demi-seconde et une
 * seconde et demie avant d'en changer.
 *
 * Des joueurs immobiles ne representeraient pas une partie: ils ne capturent
 * rien, ne ramassent rien, et laissent le moteur sans conflit a resoudre. Des caps
 * tires au generateur a graine rendent la partie aussi animee qu'une vraie, et
 * identique d'une execution a l'autre.
 */
function orienterLesJoueurs(
  room: GameRoom,
  alea: Alea,
  avantChangement: Map<string, number>,
): Alea {
  let suivant = alea;

  for (const joueur of room.joueurs) {
    const restant = avantChangement.get(joueur.id) ?? 0;

    if (restant > 0) {
      avantChangement.set(joueur.id, restant - 1);
      continue;
    }

    const angle = nombre(suivant);
    const tenue = entier(angle.alea, CAP_TENU_BATTEMENTS.maximum - CAP_TENU_BATTEMENTS.minimum + 1);
    suivant = tenue.alea;

    const radians = angle.valeur * 2 * Math.PI;
    room.enregistrerIntention(joueur.id, {
      deplacement: { x: Math.cos(radians), y: Math.sin(radians) },
      enMouvement: true,
    });
    avantChangement.set(joueur.id, CAP_TENU_BATTEMENTS.minimum + tenue.valeur);
  }

  return suivant;
}
