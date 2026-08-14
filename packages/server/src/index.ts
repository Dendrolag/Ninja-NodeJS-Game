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
 * Ce qui reste a venir: la couche Socket.IO et les contrats d'evenements
 * (etape 2.2), puis le matchmaking (etape 2.4).
 */

export type { JoueurDeRoom, OptionsGameRoom, StatutRoom } from './GameRoom.js';
export { CADENCE_BATTEMENT_MS, DT_MAXIMUM_MS, GameRoom } from './GameRoom.js';

export type { OptionsCreationRoom, OptionsRoomManager } from './RoomManager.js';
export { RoomManager } from './RoomManager.js';

export type { Horloge, HorlogeManuelle } from './horloge.js';
export { creerHorlogeManuelle, horlogeSysteme } from './horloge.js';
