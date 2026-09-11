/**
 * Le montage du serveur: un serveur HTTP, Socket.IO dessus, et la couche jeu.
 *
 * C'est le seul fichier du paquet qui ouvre un port. Il assemble, il ne decide
 * rien: la validation est dans @neon-ninja/shared, les parties dans GameRoom et
 * RoomManager, le routage dans ServeurSocket, le jeu dans @neon-ninja/sim, et le
 * service des fichiers dans fichiers.ts.
 *
 * EXPRESS REPOND AUX REQUETES HTTP, SOCKET.IO AUX CONNEXIONS DU JEU. Les deux
 * partagent le meme serveur HTTP et le meme port: Socket.IO intercepte ses propres
 * adresses avant qu'Express ne les voie. Express n'est arrive qu'a l'etape 4.3,
 * quand il y a eu une page a servir; jusque-la, le module http de Node suffisait,
 * et une dependance sans usage est une dependance que personne ne surveille
 * (faille S5 de l'audit). Depuis l'etape 3.2, Express repond aussi aux routes des
 * comptes, et Socket.IO identifie le compte d'une connexion a son ouverture.
 */

import { createServer } from 'node:http';
import type { Server as ServeurHttp } from 'node:http';

import type { EvenementsClientVersServeur, EvenementsServeurVersClient } from '@neon-ninja/shared';
import type { DefaultEventsMap } from 'socket.io';
import { Server } from 'socket.io';

import type { ServiceDeComptes } from './comptes/annuaire.js';
import { routesDesComptes } from './comptes/routes.js';
import type { DossiersServis } from './fichiers.js';
import { applicationWeb } from './fichiers.js';
import type { Horloge } from './horloge.js';
import type { DonneesDeConnexion, ServeurTypee } from './ServeurSocket.js';
import { ServeurSocket } from './ServeurSocket.js';
import type { SourceDeTerrain } from './terrain.js';

/** Port par defaut du serveur de jeu. */
export const PORT_PAR_DEFAUT = 3000;

/** Ce qu'il faut pour monter un serveur. */
export interface OptionsServeur {
  /**
   * Origines autorisees a se connecter, pour le controle d'acces du navigateur.
   *
   * Le legacy acceptait toutes les origines (son cors valait '*'), ce qui
   * permettait a n'importe quelle page de piloter une partie au nom de qui la
   * visitait. Ici la liste est explicite, et vide par defaut: le client est servi
   * par la meme origine et n'a rien a declarer.
   */
  readonly originesAutorisees?: readonly string[];
  /** Horloge du serveur. Celle du systeme par defaut. */
  readonly horloge?: Horloge;
  /**
   * D'ou viennent les murs des cartes.
   *
   * SANS MUR PAR DEFAUT, ET C'EST UN CHOIX. Decoder une image de collision est
   * une lecture de disque de plusieurs centaines de millisecondes: la faire sans
   * qu'on l'ait demandee alourdirait chaque montage de serveur, y compris les
   * dizaines que font les tests, qui verifient des messages et pas des murs. Le
   * serveur reel la demande dans principal.ts, en fournissant un
   * ChargeurDeTerrain.
   */
  readonly terrains?: SourceDeTerrain;
  /**
   * Les dossiers de la page et des ressources a servir.
   *
   * AUCUN FICHIER PAR DEFAUT, pour la meme raison que les murs: seul le serveur
   * reel, et le scenario de bout en bout qui le reproduit, ont une page a servir.
   */
  readonly fichiers?: DossiersServis;
  /**
   * Les comptes (etape 3.2): inscription, connexion, et identification des
   * connexions reseau.
   *
   * SANS COMPTES PAR DEFAUT, et le jeu tourne quand meme: tout le monde joue en
   * invite, les routes des comptes repondent qu'ils sont indisponibles, et une
   * connexion reseau qui presente un jeton est refusee. C'est le cas des tests et
   * des scenarios de bout en bout. Le serveur reel les branche dans principal.ts
   * quand DATABASE_URL est definie.
   */
  readonly comptes?: ServiceDeComptes;
  /**
   * Nombre de mandataires places devant le serveur, dont on croit l'en-tete
   * X-Forwarded-For pour connaitre l'adresse d'un joueur. Zero par defaut.
   *
   * Utile aux limites de tentatives de connexion: derriere le mandataire d'un
   * hebergeur, sans ce reglage, tous les joueurs auraient la meme adresse. Le
   * poser sans mandataire reel permettrait au contraire a un client de s'inventer
   * une adresse.
   */
  readonly mandatairesDeConfiance?: number;
}

/** Un serveur monte, pret a ecouter. */
export interface ServeurMonte {
  /** Le serveur HTTP, sur lequel Socket.IO est attache. */
  readonly http: ServeurHttp;
  /** Le serveur Socket.IO. */
  readonly io: ServeurTypee;
  /** La couche jeu: ses parties, ses connexions. */
  readonly jeu: ServeurSocket;
  /** Arrete tout: les parties, Socket.IO, puis le serveur HTTP. */
  fermer(): Promise<void>;
}

/**
 * Monte un serveur complet, sans le faire ecouter.
 *
 * Separer le montage de l'ecoute n'est pas une coquetterie: c'est ce qui permet
 * aux tests d'ouvrir un port libre, de jouer une partie entiere et de tout
 * refermer, sans jamais dependre d'un numero de port fixe.
 */
export function creerServeur(options: OptionsServeur = {}): ServeurMonte {
  const origines = options.originesAutorisees ?? [];
  const application = applicationWeb(options.fichiers, routesDesComptes(options.comptes, origines));
  const mandataires = options.mandatairesDeConfiance ?? 0;

  if (mandataires > 0) {
    application.set('trust proxy', mandataires);
  }

  const http = createServer(application);

  const io: ServeurTypee = new Server<
    EvenementsClientVersServeur,
    EvenementsServeurVersClient,
    DefaultEventsMap,
    DonneesDeConnexion
  >(http, {
    cors: { origin: [...origines] },
  });

  const jeu = new ServeurSocket({
    io,
    ...(options.horloge === undefined ? {} : { horloge: options.horloge }),
    ...(options.terrains === undefined ? {} : { terrains: options.terrains }),
    ...(options.comptes === undefined ? {} : { comptes: options.comptes }),
  });

  return {
    http,
    io,
    jeu,
    fermer: async () => {
      jeu.fermer();
      await io.close();
      await new Promise<void>((resoudre) => {
        http.close(() => {
          resoudre();
        });
      });
    },
  };
}

/**
 * Monte un serveur et le fait ecouter.
 *
 * @param port Port d'ecoute. Zero demande au systeme d'en choisir un libre, ce
 *             dont les tests se servent.
 */
export async function demarrerServeur(
  port: number = PORT_PAR_DEFAUT,
  options: OptionsServeur = {},
): Promise<ServeurMonte> {
  const serveur = creerServeur(options);

  await new Promise<void>((resoudre) => {
    serveur.http.listen(port, () => {
      resoudre();
    });
  });

  return serveur;
}
