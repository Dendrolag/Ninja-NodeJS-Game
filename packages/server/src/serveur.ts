/**
 * Le montage du serveur: un serveur HTTP, Socket.IO dessus, et la couche jeu.
 *
 * C'est le seul fichier du paquet qui ouvre un port. Il assemble, il ne decide
 * rien: la validation est dans @neon-ninja/shared, les parties dans GameRoom et
 * RoomManager, le routage dans ServeurSocket, le jeu dans @neon-ninja/sim.
 *
 * POURQUOI PAS EXPRESS, ALORS QUE LA PILE DU PROJET L'ANNONCE. Parce qu'a cette
 * etape il n'y a rien a servir: pas de fichier client, pas de route d'interface
 * de programmation. Express arrivera avec le client de la phase 4, quand il aura
 * un travail. Une dependance ajoutee sans usage est une dependance que personne
 * ne surveille, et la faille S5 de l'audit portait precisement sur des
 * dependances non tenues a jour. Le module http de Node suffit ici, et il ne
 * s'installe pas.
 *
 * La seule route repond a la question qu'un hebergeur pose: est-ce que ca tourne.
 */

import { createServer } from 'node:http';
import type { Server as ServeurHttp } from 'node:http';

import type { EvenementsClientVersServeur, EvenementsServeurVersClient } from '@neon-ninja/shared';
import { Server } from 'socket.io';

import type { Horloge } from './horloge.js';
import type { ServeurTypee } from './ServeurSocket.js';
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
   * visitait. Ici la liste est explicite, et vide par defaut: en developpement,
   * le client est servi par la meme origine et n'a rien a declarer.
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
  const http = createServer((_requete, reponse) => {
    reponse.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    reponse.end('Neon Ninja: le serveur tourne.');
  });

  const io: ServeurTypee = new Server<EvenementsClientVersServeur, EvenementsServeurVersClient>(
    http,
    {
      cors: { origin: [...(options.originesAutorisees ?? [])] },
    },
  );

  const jeu = new ServeurSocket({
    io,
    ...(options.horloge === undefined ? {} : { horloge: options.horloge }),
    ...(options.terrains === undefined ? {} : { terrains: options.terrains }),
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
