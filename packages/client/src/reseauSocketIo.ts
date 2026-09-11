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
 * LE LIEN S'OUVRE SUR DEMANDE, AVEC OU SANS JETON (reprise des ecrans du jalon 3).
 * Le serveur identifie le compte a l'ouverture, une fois pour toutes: le client
 * doit donc savoir quel jeton presenter avant d'ouvrir, et rouvrir quand la session
 * change. Jusque-la, le lien partait des la creation du transport.
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

/** La raison que donne Socket.IO quand c'est le client lui-meme qui ferme le lien. */
const FERMETURE_VOLONTAIRE = 'io client disconnect';

/** Ce que le joueur lit quand le serveur de jeu ne repond pas. */
export const SERVEUR_INJOIGNABLE =
  'Le serveur de jeu ne répond pas. Vérifiez votre connexion, puis réessayez.';

/**
 * Cree un transport Socket.IO, sans ouvrir le lien.
 *
 * Le client s'abonne d'abord, et ouvre ensuite: aucun message ne peut donc arriver
 * avant que quelqu'un ne l'attende.
 */
export function creerReseauSocketIo(options: OptionsReseauSocketIo = {}): Reseau {
  const socket: SocketCliente =
    options.url === undefined
      ? io({ transports: ['websocket'], reconnection: false, autoConnect: false })
      : io(options.url, { transports: ['websocket'], reconnection: false, autoConnect: false });

  return {
    get identifiant() {
      return socket.id;
    },

    get connecte() {
      return socket.connected;
    },

    ouvrir: (authentification) => {
      // Un lien ouvert, ou en train de s'ouvrir, est d'abord ferme: le jeton ne se
      // presente qu'a l'ouverture.
      if (socket.active) {
        socket.disconnect();
      }

      socket.auth = { ...authentification };
      socket.connect();
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
      // Un lien que le client ferme lui-meme, pour le rouvrir avec une autre
      // session, n'est pas un lien perdu.
      const surFermeture = (raison: string): void => {
        if (raison !== FERMETURE_VOLONTAIRE) {
          gestionnaire();
        }
      };

      socket.on('disconnect', surFermeture);

      return () => {
        socket.off('disconnect', surFermeture);
      };
    },

    surRefus: (gestionnaire) => {
      const surErreur = (erreur: Error): void => {
        gestionnaire(motifDuRefus(erreur));
      };

      socket.on('connect_error', surErreur);

      return () => {
        socket.off('connect_error', surErreur);
      };
    },

    fermer: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

/**
 * Le motif d'un lien qui n'a pas pu s'ouvrir.
 *
 * Un refus du serveur (un jeton qui n'ouvre aucune session) arrive avec son
 * explication, et la bibliotheque lui ajoute un champ data. Une panne de transport
 * n'en a pas: son message technique (« websocket error ») ne dirait rien au joueur.
 */
function motifDuRefus(erreur: Error): string {
  return 'data' in erreur ? erreur.message : SERVEUR_INJOIGNABLE;
}
