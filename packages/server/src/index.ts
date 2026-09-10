/**
 * Point d'entree du serveur.
 *
 * C'est ici que vivent toutes les entrees-sorties: l'horloge, et plus tard
 * Express, Socket.IO et la base de donnees. Le serveur appelle le moteur de
 * @neon-ninja/sim en lui injectant le temps et la graine.
 *
 * Ce que l'etape 2.1 a pose:
 *
 *   - GameRoom, l'enveloppe d'une partie: son etat, son salon, son hote, son
 *     statut, et sa boucle de battement.
 *   - RoomManager, qui ouvre, retrouve et ferme des parties. Plusieurs parties
 *     tournent cote a cote sans se voir.
 *   - Horloge, le temps rendu injectable, avec une horloge manuelle pour les
 *     tests.
 *
 * Ce que l'etape 2.2 a ajoute:
 *
 *   - ServeurSocket, la frontiere reseau: elle valide, limite le debit, route par
 *     partie et traduit l'etat du moteur en messages.
 *   - instantane, la projection de l'etat du moteur vers ce qui part sur le
 *     reseau. C'est ce que l'etape 2.3 convertira en delta binaire.
 *   - CompteARebours, le decompte de demarrage annulable.
 *   - serveur, le montage HTTP plus Socket.IO, et principal, le demarrage.
 *
 * Ce que l'etape 2.4 a ajoute:
 *
 *   - la creation de partie, publique ou privee, avec un code d'invitation
 *     fabrique par le serveur;
 *   - la liste des parties publiques ouvertes, et la partie rapide;
 *   - la capacite d'une partie, et le mode, branche jusqu'au moteur.
 */

export type { JoueurDeRoom, OptionsGameRoom, StatutRoom } from './GameRoom.js';
export { CADENCE_BATTEMENT_MS, DT_MAXIMUM_MS, GameRoom } from './GameRoom.js';

export type { OptionsCreationRoom, OptionsRoomManager } from './RoomManager.js';
export { RoomManager } from './RoomManager.js';

export type { Horloge, HorlogeManuelle } from './horloge.js';
export { creerHorlogeManuelle, horlogeSysteme } from './horloge.js';

export type { OptionsCompteARebours } from './compteARebours.js';
export { CompteARebours, SEUIL_ANNULATION_S } from './compteARebours.js';

export type { Notification } from './instantane.js';
export {
  classementDe,
  instantaneDe,
  joueurDuSalon,
  notificationsDe,
  salonDe,
} from './instantane.js';

export type { OptionsServeurSocket, ServeurTypee, SocketTypee } from './ServeurSocket.js';
export { ServeurSocket } from './ServeurSocket.js';

export type { OptionsServeur, ServeurMonte } from './serveur.js';
export { PORT_PAR_DEFAUT, creerServeur, demarrerServeur } from './serveur.js';

export type { DossiersServis } from './fichiers.js';
export { MESSAGE_DE_SANTE, POLITIQUE_DE_CONTENU, applicationWeb } from './fichiers.js';

export type { CleDeTerrain, SourceDeTerrain } from './terrain.js';
export {
  ChargeurDeTerrain,
  SANS_TERRAIN,
  racineRessources,
  redimensionner,
  terrainDepuisImage,
} from './terrain.js';
