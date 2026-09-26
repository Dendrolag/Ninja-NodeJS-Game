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
 *
 * Ce que l'etape 3.4 a ajoute:
 *
 *   - le changement de mot de passe contre l'ancien, qui ferme les autres sessions;
 *   - le code de secours, remis a chaque nouveau mot de passe, qui reinitialise un
 *     mot de passe oublie;
 *   - la coupure des connexions de jeu dont la session vient d'etre fermee.
 *
 * Ce que l'etape 3.6 a ajoute:
 *
 *   - les amities, les demandes d'ami et les blocages, en trois tables;
 *   - leurs regles, en fonctions pures (comptes/amities.ts), appliquees en base sous
 *     le verrou des deux comptes;
 *   - la relation et les parties jouees ensemble sur la fiche d'un joueur.
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

export type { ImagesAttendues } from './fluxDEtat.js';
export { BATTEMENTS_ENTRE_DEUX_IMAGES, FluxDEtat } from './fluxDEtat.js';

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

export type { ActiviteDuServeur, DossiersServis, ReponseDeSante } from './fichiers.js';
export { ChronometreDuBattement } from './chronometreDuBattement.js';
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
  profilParPseudo,
  trouverCompteParPseudo,
} from './base/comptes.js';

export { compteDeLaSession, fermerSession, ouvrirSession } from './base/sessions.js';

export type { AmitiesEnregistrees, GesteApplique, PersonneEnregistree } from './base/amities.js';
export { amitiesDuCompte, appliquerGeste, faceAFace, faitsEntre } from './base/amities.js';

export type {
  ChangementDeMotDePasse,
  CodeDuCompte,
  Reinitialisation,
  SecretsDuCompte,
} from './base/secrets.js';
export {
  aUnCodeDeSecours,
  codeParPseudo,
  consommerCodeDeSecours,
  remplacerCodeDeSecours,
  remplacerMotDePasse,
  secretsDuCompte,
} from './base/secrets.js';

export type {
  AnnuaireDesComptes,
  IdentiteDeCompte,
  MotifDeRefus,
  ReponseDeCompte,
  ServiceDeComptes,
} from './comptes/annuaire.js';
export type { LimitesDesComptes, OptionsAuthentification } from './comptes/Authentification.js';
export {
  Authentification,
  CODE_DE_SECOURS_INCORRECT,
  DUREE_SESSION_MS,
  JOUEUR_INCONNU,
  MOT_DE_PASSE_INCORRECT,
} from './comptes/Authentification.js';
export type { DecisionDAmitie, EcritureDAmitie, FaitsDAmitie } from './comptes/amities.js';
export {
  AMI_DE_SOI,
  AUCUNE_DEMANDE,
  DEBLOQUER_D_ABORD,
  GESTE_SUR_SOI,
  MES_AMIS_AU_COMPLET,
  SES_AMIS_AU_COMPLET,
  TROP_DE_DEMANDES,
  deciderDuGeste,
  faitsApres,
  relationVue,
} from './comptes/amities.js';
export { empreinteDuCode, fabriquerCodeDeSecours } from './comptes/codeDeSecours.js';
export { empreinteDuJeton, fabriquerJeton } from './comptes/jetons.js';
export type { VerdictTentative } from './comptes/limiteur.js';
export { LimiteurDeTentatives } from './comptes/limiteur.js';
export type { ParametresScrypt } from './comptes/motDePasse.js';
export { PARAMETRES_SCRYPT, hacherMotDePasse, verifierMotDePasse } from './comptes/motDePasse.js';
export { routesDesComptes } from './comptes/routes.js';
export { statistiquesDeJoueur } from './comptes/statistiques.js';
export { succesDeFiche, succesDeFin, succesDuProfil } from './comptes/succes.js';

export type { Progression, ValeursProgression } from './base/progression.js';
export { ecrireProgression, lireProgression } from './base/progression.js';

export type {
  NouveauResultat,
  NouvellePartie,
  PartieEnregistree,
  ProgressionAppliquee,
  ResultatDePartie,
} from './base/parties.js';
export { enregistrerPartie, lireHistorique, statistiquesParMode } from './base/parties.js';
export type { StatistiquesEnregistreesDUnMode } from './base/parties.js';
export type {
  BilanDuRattrapage,
  PartieDatee,
  SuccesDUnCompte,
  SuccesEnregistre,
} from './base/succes.js';
export type { Cohorte, ReleveDeRetention, Repartition, SemaineActive } from './base/mesures.js';
export { rapportDeRetention, releverLaRetention } from './base/mesures.js';
export {
  attribuerLesSucces,
  historiquesDesComptes,
  mesuresDuCompte,
  raretes,
  rattraperLesSucces,
  succesDuCompte,
  succesEnregistres,
} from './base/succes.js';

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
