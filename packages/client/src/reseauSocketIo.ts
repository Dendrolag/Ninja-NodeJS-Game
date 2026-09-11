/**
 * L'implementation Socket.IO du transport: le seul fichier du client qui sache
 * qu'une socket existe.
 *
 * Il ne contient aucune decision. Il traduit l'interface Reseau vers la
 * bibliotheque, et rien de plus: pas de reconnexion inventee, pas de file
 * d'attente de messages, pas de traitement des charges utiles. Tout ce qui
 * ressemble a une decision est ailleurs, et c'est ce qui rend ce fichier
 * remplacable.
 *
 * LE TYPAGE EST INVERSE PAR RAPPORT AU SERVEUR, et ce n'est pas une coquetterie:
 * ce que le serveur ecoute, le client l'emet. Socket.IO prend donc les deux
 * contrats dans l'autre ordre. Les intervertir compile chez soi et ne parle plus
 * a personne en face; les nommer explicitement evite l'erreur.
 *
 * LA RECONNEXION AUTOMATIQUE EST COUPEE. Socket.IO la propose, mais retrouver sa
 * place suppose que la place survive au transport. La session de compte de
 * l'etape 3.2 survit, mais la place dans une partie, elle, reste attachee a la
 * connexion: une reconnexion silencieuse redonnerait un identifiant neuf, donc un
 * joueur inconnu de la partie, et le client afficherait une partie dans laquelle
 * il n'est plus. Mieux vaut une deconnexion franche, que l'etat du client
 * enregistre et que l'ecran peut annoncer.
 */

import type { EvenementsClientVersServeur, EvenementsServeurVersClient } from '@neon-ninja/shared';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import type { ArgumentsMontants, NomDescendant, NomMontant, Reseau } from './reseau.js';

/** La socket du client: les contrats vus a l'envers de ceux du serveur. */
type SocketCliente = Socket<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Ce qu'il faut pour ouvrir un lien avec le serveur. */
export interface OptionsReseauSocketIo {
  /**
   * Adresse du serveur.
   *
   * Absente, la bibliotheque se connecte a l'origine de la page, ce qui est le
   * cas courant en production ou le client et le serveur sont servis ensemble.
   */
  readonly url?: string;
}

/**
 * Ouvre un lien Socket.IO avec le serveur de jeu.
 *
 * La connexion part immediatement. Le client s'abonne d'abord, se connecte
 * ensuite: c'est pourquoi le cablage de client.ts pose ses ecoutes avant que le
 * lien ne soit etabli, et non l'inverse.
 */
export function creerReseauSocketIo(options: OptionsReseauSocketIo = {}): Reseau {
  const socket: SocketCliente =
    options.url === undefined
      ? io({ transports: ['websocket'], reconnection: false })
      : io(options.url, { transports: ['websocket'], reconnection: false });

  return {
    get identifiant() {
      return socket.id;
    },

    get connecte() {
      return socket.connected;
    },

    emettre: <Nom extends NomMontant>(nom: Nom, ...arguments_: ArgumentsMontants<Nom>) => {
      // La signature generique d'emit ne sait pas exprimer l'accord entre le nom
      // et ses arguments, que le contrat garantit par ailleurs.
      socket.emit(nom, ...(arguments_ as never));
    },

    sur: <Nom extends NomDescendant>(nom: Nom, gestionnaire: EvenementsServeurVersClient[Nom]) => {
      socket.on(nom, gestionnaire as never);

      return () => {
        socket.off(nom, gestionnaire as never);
      };
    },

    surConnexion: (gestionnaire) => {
      socket.on('connect', gestionnaire);

      return () => {
        socket.off('connect', gestionnaire);
      };
    },

    surDeconnexion: (gestionnaire) => {
      socket.on('disconnect', gestionnaire);

      return () => {
        socket.off('disconnect', gestionnaire);
      };
    },

    fermer: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
