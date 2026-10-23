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
 *   - LA PROJECTION: les vues et les notifications, de l'etat du moteur vers ce
 *     qui part sur le reseau. Depuis l'etape 2.9, une vue par cle (vuesDe), et chaque
 *     notification telle que la vue de son destinataire la montre.
 *   - LE CODAGE: la trame binaire du flux d'etat (etape 2.3), image ou delta,
 *     codee par le meme FluxParVue que la couche reseau: une par vue. Jusqu'a
 *     l'etape 2.3, c'etait la serialisation JSON de l'instantane.
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
 * LE MODE (etape 7.1). Le banc joue une partie Classique par defaut. Dans une partie
 * Tactique, chaque joueur tire en changeant de cap, soit toutes les demi-secondes a
 * une seconde et demie, tirs vides compris: une partie aussi animee qu'une vraie. Une
 * partie Classique tire au sort exactement ce qu'elle tirait avant l'arrivee du mode,
 * et sa taille de reference ne bouge donc pas.
 *
 * En Chasse (etape 7.3), personne ne tire: des tirs au hasard feraient perdre leurs vies
 * aux traqueurs en quelques secondes, et la partie, decidee, s'arreterait avant la fin
 * de la mesure. Ce que le mode coute a chaque battement, le parcours des proies et l'arme
 * des traqueurs, est mesure; un tir, rare et borne a une seconde d'attente, ne l'est pas.
 * Le mode accueille dix joueurs: le banc se lance avec --joueurs 10.
 *
 * En Massacre (etape 7.4), chaque joueur frappe en changeant de cap, comme en Tactique:
 * des coups au hasard tuent des bots, sans vider la carte pendant la mesure. Le mode
 * accueille huit joueurs: le banc se lance avec --joueurs 8.
 *
 * En Among Ninjas (etape 7.20), le mode impose Tokyo et regle sa foule par ses propres
 * reglages: le nombre de bots du banc devient la foule. Personne ne tue: un meurtre ferait un
 * fantome, qui partage la vue des fantomes. Douze vivants, douze vues, une trame chacun: le
 * pire cas du mode. La mesure tient dans le premier tour, apres la revelation (5 secondes,
 * moins que l'echauffement), et avant son terme (3 minutes par defaut).
 *
 * LA CARTE DE MESURE (etape 5.10). Avec carteDeMesure, la partie se joue sur 10 000 sur
 * 10 000 pixels, avec le terrain que l'appelant fabrique (terrainDeMesure.ts), et autant de
 * joueurs que demande, au-dela de la capacite du mode. Les Black Ninjas y sont un par
 * centaine d'entites, la proportion d'une partie reelle (deux pour trois cents faux ninjas
 * par defaut, cinq au plus), pour que leur cout grandisse avec la foule comme il le ferait.
 * Avec zoneDInteret, le banc estime en plus ce que chaque joueur recevrait s'il ne voyait
 * que ce qui l'entoure (zoneDInteret.ts), hors de la duree mesuree du battement.
 *
 * AUCUN CODE DU JEU N'EST MODIFIE NI IMITE. La room est celle du serveur, lue dans
 * sa compilation, c'est-a-dire le code qui tourne en production. Seul le rappel
 * de battement, que la room offre a qui veut etre prevenu, est fourni ici.
 */

import { deflateRawSync } from 'node:zlib';

import type { CarteCollisions } from '../../packages/sim/dist/index.js';
import type {
  Alea,
  IdentifiantCarte,
  InstantanePartie,
  Mode,
} from '../../packages/shared/dist/index.js';
import { CAPACITES, MINES, creerAlea, entier, nombre } from '../../packages/shared/dist/index.js';
import type { CleDeVue } from '../../packages/server/dist/index.js';
import {
  CADENCE_BATTEMENT_MS,
  FluxParVue,
  GameRoom,
  OCTETS_DU_SECRET,
  VUE_COMMUNE,
  aliasDesNinjas,
  cleDeVue,
  creerHorlogeManuelle,
  notificationDansLaVue,
  notificationsDe,
  vuesDe,
} from '../../packages/server/dist/index.js';

import type { Resume } from './statistiques.ts';
import { resumer } from './statistiques.ts';
import { vueFiltree } from './zoneDInteret.ts';

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
  /** Le mode de la partie. Le Classique par defaut. */
  readonly mode?: Mode;
  /**
   * Les joueurs posent des mines (etape 7.11): seule la mine apparait parmi les objets de
   * poche, a chaque tentative, toutes les deux secondes. Un joueur qui en a moins de trois
   * posees va chercher la plus proche, et pose celle qu'il a en poche aussitot: la partie
   * approche le pire cas, trois mines par joueur, moins celles que les autres font sauter.
   */
  readonly mines?: boolean;
  /**
   * La partie se joue sur la carte de mesure de 10 000 sur 10 000 (etape 5.10), avec un
   * Black Ninja par centaine d'entites. Le terrain fourni doit en avoir les dimensions.
   */
  readonly carteDeMesure?: boolean;
  /** Le banc estime le filtrage par zone d'interet (etape 5.10). */
  readonly zoneDInteret?: boolean;
}

/** Ce que le filtrage par zone d'interet aurait donne (etape 5.10). */
export interface EstimationZoneDInteret {
  /** Entites que chaque joueur aurait recues, en moyenne par battement et par joueur. */
  readonly entitesParJoueur: number;
  /** Taille du message « etat » que chaque joueur aurait recu, enveloppe comprise. */
  readonly octetsParMessage: Resume;
  /** Duree du filtrage et du codage des trames de tous les joueurs, par battement. */
  readonly codageMs: Resume;
}

/** Ce que le banc a mesure. Les durees sont en millisecondes, les tailles en octets. */
export interface ResultatBancBattement {
  readonly bots: number;
  readonly joueurs: number;
  readonly battements: number;
  /** Le mode de la partie jouee. */
  readonly mode: Mode;
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
  /**
   * Les battements mesures pendant un sabotage d'Among Ninjas (etape 7.22): le nuage noir que
   * le premier assassin pose des que la regle le permet. Zero dans les autres modes.
   */
  readonly battementsSabotes: number;
  /**
   * Les pas faits par les vivants d'Among Ninjas pendant les battements mesures (etape 7.23): ce
   * que la projection fait entendre a chacun. Zero dans les autres modes.
   */
  readonly pasFaits: number;
  /** Les Black Ninjas qui entrent en jeu a la moitie de la partie. */
  readonly botsNoirs: number;
  /** Ce que le filtrage par zone d'interet aurait donne. Absent sans zoneDInteret. */
  readonly zoneDInteret: EstimationZoneDInteret | undefined;
  /**
   * Duree du lancement de la partie, en millisecondes: la mise en place des faux ninjas et
   * des joueurs, que le serveur fait d'un bloc, sur le fil de toutes ses parties (etape 5.10).
   */
  readonly lancementMs: number;
}

/** Ce qu'un battement mesure laisse derriere lui. */
interface MesureDUnBattement {
  vues: ReadonlyMap<CleDeVue, InstantanePartie>;
  destinataires: ReadonlyMap<string, CleDeVue>;
  projectionMs: number;
  serialisationMs: number;
  octets: number;
  octetsCompresses: number | undefined;
  octetsJson: number | undefined;
  entites: number;
}

/**
 * La taille moyenne de la trame que recoit un joueur: hors Chasse, la trame unique; en
 * Chasse, celle de sa vue (etape 2.9).
 */
function octetsParMessage(
  envois: readonly { readonly destinataires: readonly string[]; readonly trame: Uint8Array }[],
): number {
  const recus = envois.reduce((somme, envoi) => somme + envoi.destinataires.length, 0);
  const octets = envois.reduce(
    (somme, envoi) => somme + envoi.trame.byteLength * envoi.destinataires.length,
    0,
  );

  return octets / recus;
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

  // Le flux de la partie et les alias de ses ninjas, comme la couche reseau en tient un par
  // partie (etape 2.9). Un secret fixe: le banc reste deterministe, a l'octet pres.
  const flux = new FluxParVue();
  const alias = aliasDesNinjas(new Uint8Array(OCTETS_DU_SECRET).fill(1));

  // Ce que le rappel de battement a releve. La room l'appelle a l'interieur de
  // avancer(): la boucle ci-dessous le lit juste apres.
  let mesure: MesureDUnBattement | undefined;
  const surBattement = (partie: GameRoom): void => {
    // La projection, vue par vue, comme ServeurSocket.diffuserLeBattement: chaque joueur
    // est un destinataire, sous son propre identifiant.
    const debutProjection = performance.now();
    const destinataires = new Map<string, CleDeVue>(
      Object.keys(partie.etat.joueurs).map((id) => [id, cleDeVue(partie.etat, id)]),
    );
    const vues = vuesDe(partie.etat, new Set(destinataires.values()), alias);
    for (const notification of notificationsDe(partie.etat)) {
      notificationDansLaVue(
        notification,
        partie.etat,
        cleDeVue(partie.etat, notification.pour),
        alias,
      );
    }
    const finProjection = performance.now();
    const envois = flux.envoisDuBattement(vues, destinataires);
    const finCodage = performance.now();

    // La vue de reference, pour les entites et la comparaison au JSON: la commune s'il y en
    // a une, comme hors Chasse.
    const instantane = vues.get(VUE_COMMUNE) ?? [...vues.values()][0];
    const trame = envois[0]?.trame;
    if (instantane === undefined || trame === undefined) {
      throw new Error('Le banc joue au moins un joueur: une vue et une trame sont attendues.');
    }

    mesure = {
      vues,
      destinataires,
      projectionMs: finProjection - debutProjection,
      serialisationMs: finCodage - finProjection,
      octets: octetsParMessage(envois) + OCTETS_D_ENVELOPPE,
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

  const { room, lancementMs } = ouvrirLaPartie(options, joues, surBattement);

  // Le filtrage estime: un flux par joueur, comme l'etape 2.10 en tiendra un, nourri a
  // chaque battement, echauffement compris, pour que ses deltas aient leur reference.
  const fluxFiltre = new FluxParVue();
  const octetsFiltres: number[] = [];
  const codageFiltre: number[] = [];
  let entitesFiltrees = 0;

  const moteur: number[] = [];
  const projection: number[] = [];
  const serialisation: number[] = [];
  const total: number[] = [];
  const octets: number[] = [];
  const compresses: number[] = [];
  const json: number[] = [];
  let entites = 0;
  let battementsSabotes = 0;
  let pasFaits = 0;

  for (let battement = 0; battement < joues; battement += 1) {
    alea = orienterLesJoueurs(room, alea, avantChangement, options.mines === true);
    poserLeNuage(room);

    mesure = undefined;
    const debut = performance.now();
    room.avancer(CADENCE_BATTEMENT_MS);
    const duree = performance.now() - debut;

    if (mesure === undefined) {
      throw new Error(`Le battement ${String(battement)} n'a pas prevenu le banc.`);
    }

    const filtre =
      options.zoneDInteret === true ? estimerLeFiltrage(room, mesure, fluxFiltre) : undefined;

    if (battement < options.echauffement) {
      continue;
    }

    if (filtre !== undefined) {
      octetsFiltres.push(filtre.octets);
      codageFiltre.push(filtre.dureeMs);
      entitesFiltrees += filtre.entites;
    }

    if (room.etat.among?.sabotage !== undefined) {
      battementsSabotes += 1;
    }

    pasFaits += room.etat.among?.pasDuBattement?.length ?? 0;

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
    mode: room.mode,
    moteurMs: resumer(moteur),
    projectionMs: resumer(projection),
    serialisationMs: resumer(serialisation),
    totalMs: resumer(total),
    octetsParMessage: resumer(octets),
    octetsCompressesParMessage: resumer(compresses),
    octetsJsonParMessage: resumer(json),
    entitesParMessage: entites / Math.max(options.battements, 1),
    octetsTotal: octets.reduce((somme, valeur) => somme + valeur, 0),
    battementsSabotes,
    pasFaits,
    botsNoirs: room.reglages.botsNoirs.actifs ? room.reglages.botsNoirs.nombre : 0,
    lancementMs,
    zoneDInteret:
      options.zoneDInteret === true
        ? {
            entitesParJoueur: entitesFiltrees / Math.max(options.battements, 1),
            octetsParMessage: resumer(octetsFiltres),
            codageMs: resumer(codageFiltre),
          }
        : undefined,
  };
}

/**
 * Ce qu'un battement aurait envoye avec le filtrage par zone d'interet: la vue de chaque
 * joueur reduite a son rectangle, codee dans son propre flux.
 *
 * @returns La taille moyenne du message recu par un joueur, enveloppe comprise, les
 *          entites qu'il aurait recues en moyenne, et la duree du filtrage et du codage.
 */
function estimerLeFiltrage(
  room: GameRoom,
  mesure: MesureDUnBattement,
  flux: FluxParVue,
): { readonly octets: number; readonly entites: number; readonly dureeMs: number } {
  const debut = performance.now();
  const vues = new Map<CleDeVue, InstantanePartie>();
  const destinataires = new Map<string, CleDeVue>();
  let entites = 0;

  for (const [id, cle] of mesure.destinataires) {
    const vue = mesure.vues.get(cle);
    const joueur = room.etat.joueurs[id];

    if (vue === undefined || joueur === undefined) {
      continue;
    }

    const filtree = vueFiltree(vue, joueur.position);
    vues.set(id, filtree);
    destinataires.set(id, id);
    entites += filtree.entites.length;
  }

  const envois = flux.envoisDuBattement(vues, destinataires);
  const dureeMs = performance.now() - debut;

  return {
    octets: octetsParMessage(envois) + OCTETS_D_ENVELOPPE,
    entites: entites / Math.max(destinataires.size, 1),
    dureeMs,
  };
}

/**
 * Les Black Ninjas de la carte de mesure: un par centaine d'entites, au moins un (etape
 * 5.10). Sur Tokyo, deux pour trois cents faux ninjas et douze joueurs par defaut.
 */
export function botsNoirsDeLaMesure(bots: number, joueurs: number): number {
  return Math.max(1, Math.round((bots + joueurs) / 100));
}

/**
 * Le banc d'Among Ninjas (etape 7.22): le premier assassin pose le nuage noir sur la premiere
 * station des que la regle le permet. C'est le sabotage qui coute au serveur: la vue de chaque
 * proie vivante y perd ce qui s'y tient. Aucun tirage: la partie reste la meme d'une execution
 * a l'autre. Rien dans les autres modes.
 */
function poserLeNuage(room: GameRoom): void {
  const among = room.etat.among;

  if (
    among === undefined ||
    among.phase !== 'jeu' ||
    among.sabotage !== undefined ||
    among.rechargeDesSabotagesMs > 0
  ) {
    return;
  }

  const assassin = Object.entries(among.joueurs).find(([, joueur]) => joueur.role === 'tueur');

  if (assassin !== undefined) {
    room.saboter(assassin[0], { nature: 'nuage', station: 0 });
  }
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
): { readonly room: GameRoom; readonly lancementMs: number } {
  const dureePartieS = Math.ceil((battements * CADENCE_BATTEMENT_MS) / 1000) + 1;
  // Le lancement compte la partie ouverte, peuplee et lancee: ou que le moteur pose ses
  // faux ninjas, la mesure le couvre.
  const debutDuLancement = performance.now();

  const room = new GameRoom({
    id: 'banc',
    graine: options.graine,
    mode: options.mode ?? 'classique',
    reglages: {
      carte: options.carte ?? 'map1',
      nombreBotsInitial: options.bots,
      dureePartieS,
      ...(options.carteDeMesure === true
        ? { botsNoirs: { nombre: botsNoirsDeLaMesure(options.bots, options.joueurs) } }
        : {}),
      // Among Ninjas tire sa foule de ses reglages, qui imposent le nombre de bots.
      ...(options.mode === 'among' ? { among: { foule: options.bots } } : {}),
      ...(options.mines === true
        ? {
            bonus: { intervalleApparitionS: 2 },
            objetsDePoche: {
              fumee: { actif: false },
              mine: { actif: true, tauxApparitionPourCent: 100 },
            },
          }
        : {}),
    },
    ...(options.terrain === undefined ? {} : { terrain: options.terrain }),
    horloge: creerHorlogeManuelle(),
    surBattement,
    // Autant de joueurs que le banc en demande, 30 ou 60 au-dela des douze d'un mode.
    banc: {
      capacite: Math.max(options.joueurs, CAPACITES[options.mode ?? 'classique']),
      carteDeMesure: options.carteDeMesure === true,
    },
  });

  for (let rang = 1; rang <= options.joueurs; rang += 1) {
    const entree = room.accueillir({ id: `j${String(rang)}`, pseudo: `Joueur${String(rang)}` });

    if (!entree.valide) {
      throw new Error(`Le joueur ${String(rang)} n'a pas pu entrer dans la partie du banc.`);
    }
  }

  room.lancer();
  const lancementMs = performance.now() - debutDuLancement;

  // Among Ninjas attend que chacun ait charge la carte avant la revelation (etape 7.20).
  for (const joueur of room.joueurs) {
    room.signalerLeChargement(joueur.id);
  }

  return { room, lancementMs };
}

/**
 * Le banc des mines (etape 7.11): ce joueur pose la mine qu'il a en poche, ou va chercher la
 * plus proche tant qu'il en a moins de trois posees. Aucun tirage. Rend faux s'il n'a rien a
 * faire de ce cote, et suit alors son cap ordinaire.
 */
function chercherUneMine(room: GameRoom, id: string): boolean {
  const joueur = room.etat.joueurs[id];

  if (joueur === undefined) {
    return false;
  }

  if (joueur.poche === 'mine') {
    room.demanderLaPoche(id);
    return true;
  }

  const posees = Object.values(room.etat.minesPosees ?? {}).filter((mine) => mine.poseur === id);
  const auSol = Object.values(room.etat.objets).filter((objet) => objet.nature === 'mine');

  if (posees.length >= MINES.PLAFOND_PAR_JOUEUR || auSol.length === 0) {
    return false;
  }

  const ici = joueur.position;
  const but = auSol
    .map((objet) => objet.position)
    .reduce((meilleur, autre) =>
      Math.hypot(autre.x - ici.x, autre.y - ici.y) <
      Math.hypot(meilleur.x - ici.x, meilleur.y - ici.y)
        ? autre
        : meilleur,
    );
  const ecart = Math.max(Math.hypot(but.x - ici.x, but.y - ici.y), 1);

  room.enregistrerIntention(id, {
    deplacement: { x: (but.x - ici.x) / ecart, y: (but.y - ici.y) / ecart },
    enMouvement: true,
  });
  return true;
}

/**
 * Donne a chaque joueur un cap, qu'il tient entre une demi-seconde et une
 * seconde et demie avant d'en changer.
 *
 * Des joueurs immobiles ne representeraient pas une partie: ils ne capturent
 * rien, ne ramassent rien, et laissent le moteur sans conflit a resoudre. Des caps
 * tires au generateur a graine rendent la partie aussi animee qu'une vraie, et
 * identique d'une execution a l'autre.
 *
 * Dans une partie Tactique, le joueur tire aussi a chaque changement de cap. Le tir ne
 * consomme aucun tirage: une partie Classique reste celle qu'elle etait.
 */
function orienterLesJoueurs(
  room: GameRoom,
  alea: Alea,
  avantChangement: Map<string, number>,
  poserDesMines: boolean,
): Alea {
  let suivant = alea;

  for (const joueur of room.joueurs) {
    if (poserDesMines && chercherUneMine(room, joueur.id)) {
      continue;
    }

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

    if (room.mode === 'tactique' || room.mode === 'massacre') {
      room.demanderUnTir(joueur.id);
    }
  }

  return suivant;
}
