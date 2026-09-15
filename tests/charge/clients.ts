/**
 * Les clients simules du harnais de charge, dans un processus a part.
 *
 * CE FICHIER EST LANCE PAR charge-reseau.ts, jamais seul. Il ouvre de vraies
 * connexions Socket.IO vers le serveur mesure, cree les parties, les fait
 * rejoindre, les lance, fait bouger les joueurs, et compte ce qu'il recoit.
 *
 * POURQUOI UN PROCESSUS A PART. Des centaines de clients qui decodent chacun
 * vingt instantanes par seconde consomment beaucoup de processeur. Dans le
 * processus du serveur, ils lui voleraient le temps qu'on cherche justement a
 * mesurer. Repartis dans d'autres processus, donc sur d'autres coeurs, ils
 * laissent au serveur son fil d'execution; leur propre charge est relevee et
 * rapportee, pour qu'on sache s'ils ont suivi.
 *
 * UN CLIENT SIMULE SE COMPORTE COMME LE VRAI CLIENT, pour ce qui charge le
 * serveur: transport WebSocket seul, comme reseauSocketIo.ts; une intention de
 * deplacement emise seulement quand elle change, comme la boucle de rendu; un cap
 * tenu entre une demi-seconde et une seconde et demie. Il ne dessine rien, et ne
 * garde rien de ce qu'il recoit: Socket.IO decode quand meme chaque message, comme
 * pour un vrai joueur.
 *
 * LA TAILLE MESUREE EST CELLE DU FIL. Chaque paquet recu par Engine.IO est compte
 * avec son type, avant tout decodage par Socket.IO: c'est la taille de la trame
 * WebSocket, entetes du protocole WebSocket exclus. Depuis l'etape 2.3, un message
 * « etat » arrive en deux paquets, un en-tete en texte puis les octets de la trame:
 * les deux sont comptes ensemble, comme un seul message.
 *
 * LE DIALOGUE AVEC LE PROCESSUS PARENT est une suite de messages types ci-dessous:
 * preparer, lancer, mesurer, rapporter, fermer. Chaque etape repond une fois
 * terminee, ou signale une erreur.
 */

import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import type {
  Alea,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ResultatValidation,
} from '../../packages/shared/dist/index.js';
import { creerAlea, entier, nombre } from '../../packages/shared/dist/index.js';

import type { Resume } from './statistiques.ts';
import { resumer } from './statistiques.ts';

/** L'argument qui fait de ce module un processus de clients, quand il est lance seul. */
export const DRAPEAU_DES_CLIENTS = '--clients-du-harnais';

/**
 * Le nombre de bots d'une partie, selon son rang dans la charge.
 *
 * Une liste d'un seul nombre donne des parties toutes identiques. Une liste de
 * plusieurs les attribue a tour de role: « 50,150 » donne une partie sur deux au
 * reglage par defaut, et l'autre au maximum du salon, comme sur un vrai serveur
 * ou chaque hote choisit.
 */
export function botsDeLaRoom(bots: readonly number[], rang: number): number {
  const nombreDeBots = bots[rang % Math.max(bots.length, 1)];

  if (nombreDeBots === undefined) {
    throw new Error('Une charge doit indiquer au moins un nombre de bots.');
  }

  return nombreDeBots;
}

/** Ce que le processus parent demande. */
export type OrdreAuxClients =
  | {
      readonly type: 'preparer';
      /** Adresse du serveur mesure. */
      readonly url: string;
      /** Les parties dont ce processus a la charge, par leur rang dans la charge entiere. */
      readonly rooms: readonly number[];
      /** Nombre total de parties de la charge, pour etaler les lancements. */
      readonly totalRooms: number;
      readonly joueursParRoom: number;
      /** Bots de chaque partie, attribues a tour de role selon son rang. Voir botsDeLaRoom. */
      readonly bots: readonly number[];
      readonly dureePartieS: number;
      readonly graine: number;
    }
  | { readonly type: 'lancer' }
  | { readonly type: 'mesurer' }
  | { readonly type: 'rapporter' }
  | { readonly type: 'fermer' };

/** Ce que ce processus a mesure pendant la fenetre de mesure. */
export interface RapportDesClients {
  readonly clients: number;
  readonly dureeMs: number;
  /** Instantanes « etat » recus, tous clients confondus. */
  readonly messagesEtat: number;
  /** Octets de ces instantanes, sur le fil. */
  readonly octetsEtat: number;
  /** Octets de tous les autres messages recus: notifications, salon. */
  readonly octetsAutres: number;
  /** Intentions de deplacement emises. */
  readonly intentions: number;
  /** Ecart entre deux instantanes recus par un meme client, en millisecondes. */
  readonly intervalleReceptionMs: Resume;
  /** Temps processeur consomme par ce processus, en pour cent d'un coeur. */
  readonly processeurPourCent: number;
  /** Connexions perdues pendant la mesure. Tout autre nombre que zero invalide la mesure. */
  readonly deconnexions: number;
}

/** Ce que ce processus repond. */
export type ReponseDesClients =
  | { readonly type: 'prepare' }
  | { readonly type: 'lance' }
  | { readonly type: 'mesure' }
  | ({ readonly type: 'rapport' } & RapportDesClients)
  | { readonly type: 'erreur'; readonly message: string };

/** Une connexion typee par les deux contrats d'evenements, vue du client. */
type SocketClient = Socket<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Cadence a laquelle les clients reconsiderent leur cap, en millisecondes. */
const PAS_DES_INTENTIONS_MS = 50;

/** Plus petit et plus grand nombre de pas entre deux changements de cap. */
const CAP_TENU_PAS = { minimum: 10, maximum: 30 } as const;

/** Delai au-dela duquel une reponse du serveur est consideree comme perdue. */
const DELAI_REPONSE_MS = 30_000;

/**
 * Duree sur laquelle les demarrages des parties sont etales, en millisecondes: la
 * cadence de battement du serveur. Voir lancer().
 */
const ETALEMENT_DES_DEMARRAGES_MS = 50;

/** Un joueur simule. */
interface ClientSimule {
  readonly socket: SocketClient;
  readonly hote: boolean;
  /** Rang de sa partie dans la charge entiere. */
  readonly rang: number;
  /** Pas restants avant de changer de cap. */
  restant: number;
  /** Instant de reception du dernier instantane, pendant la mesure. */
  dernierEtat: number | undefined;
  /** Taille de l'en-tete d'un message « etat » dont les octets n'ont pas encore suivi. */
  enTeteDEtat: number | undefined;
  lance: boolean;
}

/** Les compteurs d'une fenetre de mesure. */
interface Compteurs {
  debut: number;
  processeur: NodeJS.CpuUsage;
  messagesEtat: number;
  octetsEtat: number;
  octetsAutres: number;
  intentions: number;
  intervalles: number[];
  deconnexions: number;
}

/** Des compteurs neufs, a l'instant present. */
function compteursNeufs(): Compteurs {
  return {
    debut: performance.now(),
    processeur: process.cpuUsage(),
    messagesEtat: 0,
    octetsEtat: 0,
    octetsAutres: 0,
    intentions: 0,
    intervalles: [],
    deconnexions: 0,
  };
}

/** Tout ce que ce processus retient. Une seule instance, creee au demarrage. */
interface Etat {
  readonly clients: ClientSimule[];
  alea: Alea;
  compteurs: Compteurs;
  mesureEnCours: boolean;
  arreterLesIntentions: (() => void) | undefined;
  totalRooms: number;
}

/** Envoie une reponse au processus parent. */
function repondre(reponse: ReponseDesClients): void {
  process.send?.(reponse);
}

/**
 * Ouvre une connexion et branche le comptage de ce qu'elle recoit.
 *
 * Le comptage est pose sur le transport Engine.IO, sous Socket.IO: il voit chaque
 * paquet tel qu'il est arrive, avant decodage.
 */
async function connecter(
  etat: Etat,
  url: string,
  hote: boolean,
  rang: number,
): Promise<ClientSimule> {
  const socket: SocketClient = io(url, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });

  const client: ClientSimule = {
    socket,
    hote,
    rang,
    restant: 0,
    dernierEtat: undefined,
    enTeteDEtat: undefined,
    lance: false,
  };

  socket.io.on('open', () => {
    socket.io.engine.on('packet', (paquet) => {
      if (!etat.mesureEnCours || paquet.type !== 'message') {
        return;
      }

      if (typeof paquet.data === 'string') {
        // Un octet pour le type du paquet Engine.IO, puis sa charge.
        const octets = Buffer.byteLength(paquet.data) + 1;

        // L'en-tete d'une trame du flux d'etat: ses octets suivent dans le paquet
        // binaire d'apres.
        if (paquet.data.startsWith('51-["etat"')) {
          client.enTeteDEtat = octets;
          return;
        }

        etat.compteurs.octetsAutres += octets;
        return;
      }

      // Un paquet binaire voyage tel quel, sans octet de type.
      const binaires = (paquet.data as Uint8Array | ArrayBuffer).byteLength;

      if (client.enTeteDEtat === undefined) {
        etat.compteurs.octetsAutres += binaires;
        return;
      }

      const maintenant = performance.now();
      etat.compteurs.messagesEtat += 1;
      etat.compteurs.octetsEtat += client.enTeteDEtat + binaires;
      client.enTeteDEtat = undefined;

      if (client.dernierEtat !== undefined) {
        etat.compteurs.intervalles.push(maintenant - client.dernierEtat);
      }

      client.dernierEtat = maintenant;
    });
  });

  socket.on('partieLancee', () => {
    client.lance = true;
  });

  socket.on('disconnect', () => {
    if (etat.mesureEnCours) {
      etat.compteurs.deconnexions += 1;
    }
  });

  await new Promise<void>((resoudre, rejeter) => {
    socket.once('connect', () => {
      resoudre();
    });
    socket.once('connect_error', (erreur) => {
      rejeter(erreur);
    });
  });

  etat.clients.push(client);

  return client;
}

/** Attend l'accuse d'une demande d'entree, ou echoue en le disant. */
async function entrer(
  demande: (accuse: (reponse: ResultatValidation<InfosSalon>) => void) => void,
  quoi: string,
): Promise<InfosSalon> {
  const reponse = await new Promise<ResultatValidation<InfosSalon>>((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error(`Pas de reponse du serveur pour ${quoi}.`));
    }, DELAI_REPONSE_MS);

    demande((recue) => {
      clearTimeout(minuterie);
      resoudre(recue);
    });
  });

  if (!reponse.valide) {
    throw new Error(`${quoi} refuse: ${JSON.stringify(reponse.erreurs)}`);
  }

  return reponse.valeur;
}

/**
 * Cree une partie privee et y fait entrer ses joueurs par le code.
 *
 * Privee pour que la partie rapide d'un autre client ne vienne jamais s'y glisser:
 * chaque partie de la charge a exactement le nombre de joueurs demande.
 */
async function preparerUneRoom(
  etat: Etat,
  ordre: Extract<OrdreAuxClients, { type: 'preparer' }>,
  rang: number,
): Promise<void> {
  const hote = await connecter(etat, ordre.url, true, rang);
  const salon = await entrer(
    (accuse) => {
      hote.socket.emit(
        'creerPartie',
        {
          pseudo: `Hote${String(rang)}`,
          configuration: {
            mode: 'classique',
            visibilite: 'privee',
            reglages: {
              nombreBotsInitial: botsDeLaRoom(ordre.bots, rang),
              dureePartieS: ordre.dureePartieS,
            },
          },
        },
        accuse,
      );
    },
    `la creation de la partie ${String(rang)}`,
  );

  if (salon.code === undefined) {
    throw new Error(`La partie ${String(rang)} n'a pas recu de code d'invitation.`);
  }

  const code = salon.code;

  for (let place = 1; place < ordre.joueursParRoom; place += 1) {
    const invite = await connecter(etat, ordre.url, false, rang);

    await entrer(
      (accuse) => {
        invite.socket.emit(
          'rejoindre',
          { pseudo: `J${String(rang)}n${String(place)}`, code },
          accuse,
        );
      },
      `l'entree du joueur ${String(place)} dans la partie ${String(rang)}`,
    );
  }
}

/**
 * Fait demarrer chaque partie, en etalant les demarrages sur un battement.
 *
 * Des parties lancees toutes a la meme milliseconde battraient toutes ensemble,
 * en une rafale unique toutes les cinquante millisecondes. Sur un vrai serveur,
 * les parties commencent a des instants quelconques et leurs battements se
 * repartissent: c'est ce qu'imite l'etalement. Il se fait sur le rang de la partie
 * dans la charge entiere, pour que les parties de deux processus ne demarrent pas
 * ensemble.
 */
async function lancer(etat: Etat): Promise<void> {
  const hotes = etat.clients.filter((client) => client.hote);

  hotes.forEach((hote) => {
    const decalage = (hote.rang * ETALEMENT_DES_DEMARRAGES_MS) / Math.max(etat.totalRooms, 1);

    setTimeout(() => {
      hote.socket.emit('demarrer');
    }, decalage);
  });

  const limite = performance.now() + DELAI_REPONSE_MS;

  while (!etat.clients.every((client) => client.lance)) {
    if (performance.now() > limite) {
      throw new Error("Toutes les parties n'ont pas ete lancees a temps.");
    }

    await new Promise((resoudre) => setTimeout(resoudre, 20));
  }

  etat.arreterLesIntentions = faireBougerLesJoueurs(etat);
}

/**
 * Donne a chaque joueur un cap, renouvele de temps en temps.
 *
 * Une seule minuterie pour tout le processus, et non une par client: des
 * centaines de minuteries coutent au processus des clients sans rien apporter a
 * la mesure du serveur.
 */
function faireBougerLesJoueurs(etat: Etat): () => void {
  const minuterie = setInterval(() => {
    for (const client of etat.clients) {
      if (client.restant > 0) {
        client.restant -= 1;
        continue;
      }

      const angle = nombre(etat.alea);
      const tenue = entier(angle.alea, CAP_TENU_PAS.maximum - CAP_TENU_PAS.minimum + 1);
      etat.alea = tenue.alea;

      const radians = angle.valeur * 2 * Math.PI;
      client.socket.emit('deplacer', {
        deplacement: { x: Math.cos(radians), y: Math.sin(radians) },
        enMouvement: true,
      });
      client.restant = CAP_TENU_PAS.minimum + tenue.valeur;

      if (etat.mesureEnCours) {
        etat.compteurs.intentions += 1;
      }
    }
  }, PAS_DES_INTENTIONS_MS);

  return () => {
    clearInterval(minuterie);
  };
}

/** Ce que ce processus a mesure depuis le debut de la fenetre. */
function rapport(etat: Etat): RapportDesClients {
  const compteurs = etat.compteurs;
  const dureeMs = performance.now() - compteurs.debut;
  const processeur = process.cpuUsage(compteurs.processeur);

  return {
    clients: etat.clients.length,
    dureeMs,
    messagesEtat: compteurs.messagesEtat,
    octetsEtat: compteurs.octetsEtat,
    octetsAutres: compteurs.octetsAutres,
    intentions: compteurs.intentions,
    intervalleReceptionMs: resumer(compteurs.intervalles),
    processeurPourCent: ((processeur.user + processeur.system) / 1000 / dureeMs) * 100,
    deconnexions: compteurs.deconnexions,
  };
}

/** Ferme toutes les connexions, puis le processus. */
function fermer(etat: Etat): void {
  etat.mesureEnCours = false;
  etat.arreterLesIntentions?.();

  for (const client of etat.clients) {
    client.socket.disconnect();
  }

  process.exit(0);
}

/** Traite un ordre du processus parent. */
async function obeir(etat: Etat, ordre: OrdreAuxClients): Promise<void> {
  switch (ordre.type) {
    case 'preparer':
      etat.alea = creerAlea(ordre.graine);
      etat.totalRooms = ordre.totalRooms;

      for (const rang of ordre.rooms) {
        await preparerUneRoom(etat, ordre, rang);
      }

      repondre({ type: 'prepare' });
      return;

    case 'lancer':
      await lancer(etat);
      repondre({ type: 'lance' });
      return;

    case 'mesurer':
      etat.compteurs = compteursNeufs();
      for (const client of etat.clients) {
        client.dernierEtat = undefined;
      }
      etat.mesureEnCours = true;
      repondre({ type: 'mesure' });
      return;

    case 'rapporter':
      etat.mesureEnCours = false;
      repondre({ type: 'rapport', ...rapport(etat) });
      return;

    case 'fermer':
      fermer(etat);
      return;
  }
}

/** Point d'entree du processus: attend les ordres du parent. */
function demarrer(): void {
  const etat: Etat = {
    clients: [],
    alea: creerAlea(0),
    compteurs: compteursNeufs(),
    mesureEnCours: false,
    arreterLesIntentions: undefined,
    totalRooms: 0,
  };

  process.on('message', (ordre: OrdreAuxClients) => {
    obeir(etat, ordre).catch((erreur: unknown) => {
      repondre({
        type: 'erreur',
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    });
  });

  // Un parent disparu ne doit pas laisser derriere lui des centaines de connexions.
  process.on('disconnect', () => {
    process.exit(0);
  });
}

// Ce module n'agit que lance seul avec son drapeau; importe, il ne fait rien.
if (process.argv.includes(DRAPEAU_DES_CLIENTS)) {
  demarrer();
}
