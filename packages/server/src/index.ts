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
 *
 * Ce que l'etape 3.1 a ajoute, dans base/:
 *
 *   - le schema de la base (comptes, progressions, parties, resultats) et ses
 *     migrations versionnees, ecrites par drizzle-kit;
 *   - l'ouverture de la base par le pooler de Neon, et les migrations en direct;
 *   - les operations de base: creer un compte, lire et ecrire sa progression,
 *     enregistrer une partie et relire l'historique d'un compte.
 *
 * Ce que l'etape 3.2 a ajoute, dans comptes/ et base/:
 *
 *   - l'inscription et la connexion par pseudo et mot de passe, hache par scrypt;
 *   - la session par jeton, dont la base ne garde que l'empreinte;
 *   - la limite des tentatives, par pseudo et par adresse;
 *   - les routes HTTP des comptes, et l'identification du compte a l'ouverture
 *     d'une connexion Socket.IO: un compte entre en partie sous son pseudo et avec
 *     son niveau, un invite sous un pseudo qui n'est celui d'aucun compte.
 *
 * Ce que l'etape 3.3 a ajoute:
 *
 *   - le bilan d'une partie dans la GameRoom: placement, temps joue, abandons;
 *   - finDePartie, qui en tire le resultat et les gains de chaque compte, par les
 *     regles de progression de @neon-ninja/shared;
 *   - l'enregistrement de la partie, des resultats et des gains en une seule
 *     transaction, et le recapitulatif de progression envoye a chaque compte.
 */

export type {
  BilanDePartie,
  JoueurDeRoom,
  JoueurDuBilan,
  OptionsGameRoom,
  StatutRoom,
} from './GameRoom.js';
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

export type {
  DonneesDeConnexion,
  OptionsServeurSocket,
  ServeurTypee,
  SocketTypee,
} from './ServeurSocket.js';
export { ServeurSocket } from './ServeurSocket.js';

export type { OptionsServeur, ServeurMonte } from './serveur.js';
export { PORT_PAR_DEFAUT, creerServeur, demarrerServeur } from './serveur.js';

export type { DossiersServis } from './fichiers.js';
export { MESSAGE_DE_SANTE, POLITIQUE_DE_CONTENU, applicationWeb } from './fichiers.js';

export type { BaseDeDonnees, BaseOuverte, OptionsBase } from './base/connexion.js';
export { adresseChiffree, adresseDirecte, adressePooler, ouvrirBase } from './base/connexion.js';

export type { ErreurPostgres } from './base/erreurs.js';
export { CODES_POSTGRES, erreurPostgres } from './base/erreurs.js';

export { DOSSIER_MIGRATIONS, appliquerMigrations } from './base/migrations.js';

export * as schema from './base/schema.js';

export type { Compte, Identifiants, OptionsCreationCompte, Profil } from './base/comptes.js';
export {
  creerCompte,
  identifiantsParPseudo,
  profilDuCompte,
  trouverCompteParPseudo,
} from './base/comptes.js';

export { compteDeLaSession, fermerSession, ouvrirSession } from './base/sessions.js';

export type {
  AnnuaireDesComptes,
  IdentiteDeCompte,
  MotifDeRefus,
  ReponseDeCompte,
  ServiceDeComptes,
} from './comptes/annuaire.js';
export type { LimitesDesComptes, OptionsAuthentification } from './comptes/Authentification.js';
export { Authentification, DUREE_SESSION_MS } from './comptes/Authentification.js';
export { empreinteDuJeton, fabriquerJeton } from './comptes/jetons.js';
export type { VerdictTentative } from './comptes/limiteur.js';
export { LimiteurDeTentatives } from './comptes/limiteur.js';
export type { ParametresScrypt } from './comptes/motDePasse.js';
export { PARAMETRES_SCRYPT, hacherMotDePasse, verifierMotDePasse } from './comptes/motDePasse.js';
export { routesDesComptes } from './comptes/routes.js';

export type { Progression, ValeursProgression } from './base/progression.js';
export { ecrireProgression, lireProgression } from './base/progression.js';

export type {
  NouveauResultat,
  NouvellePartie,
  PartieEnregistree,
  ProgressionAppliquee,
  ResultatDePartie,
} from './base/parties.js';
export { enregistrerPartie, lireHistorique } from './base/parties.js';

export type { FinPourLesComptes } from './finDePartie.js';
export { finPourLesComptes, progressionEnregistree } from './finDePartie.js';

export type { CleDeTerrain, SourceDeTerrain } from './terrain.js';
export {
  ChargeurDeTerrain,
  SANS_TERRAIN,
  racineRessources,
  redimensionner,
  terrainDepuisImage,
} from './terrain.js';
