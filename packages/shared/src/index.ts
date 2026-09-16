/**
 * Point d'entree du paquet partage.
 *
 * Ce paquet contient ce que le moteur, le serveur et le client ont en commun:
 * les constantes de jeu, les types partages, le generateur de nombres a graine,
 * et plus tard les schemas de validation des entrees.
 *
 * Il ne contient aucune logique de gameplay: celle-la vit dans packages/sim.
 */

export type { Alea, Tirage } from './alea.js';
export { creerAlea, element, entier, nombre, reel } from './alea.js';

export type { Intervalle, LimiteDebit } from './bornes.js';
export {
  BORNES_CHAT,
  BORNES_CODE_DE_SECOURS,
  BORNES_CODE_INVITATION,
  BORNES_JETON,
  BORNES_MOT_DE_PASSE,
  BORNES_PSEUDO,
  BORNES_REGLAGES,
  BORNES_ROOM,
  DELAI_DE_RETOUR_MS,
  LIMITES_COMPTES,
  LIMITES_DEBIT,
} from './bornes.js';

export type {
  AuthentificationReseau,
  CodeDeSecoursEmis,
  CompteConnecte,
  DemandeChangementMotDePasse,
  DemandeCodeDeSecours,
  DemandeConnexion,
  DemandeInscription,
  DemandeReinitialisation,
  MaProgression,
  PartieDuProfil,
  ProfilDuCompte,
  ReponseRefusee,
  SessionInscrite,
  SessionOuverte,
  StatistiquesDuCompte,
} from './comptes.js';
export {
  JOUEURS_POUR_UNE_VICTOIRE,
  PARTIES_DU_PROFIL,
  PREFIXE_JETON_HTTP,
  RACINE_API_COMPTES,
  ROUTES_COMPTES,
} from './comptes.js';

export type {
  AvancementDuNiveau,
  Devancement,
  IdentifiantPalier,
  Palier,
  PlaceEnFinDePartie,
  Recompenses,
} from './progression.js';
export {
  PALIERS,
  REGLES_DE_PROGRESSION,
  avancementDuNiveau,
  niveauDeXp,
  palierDePoints,
  recompensesDePartie,
  xpDuNiveau,
} from './progression.js';

export { origineValide, politiqueDeContenu } from './page.js';

export { MOTIF_VERSION_DIFFERENTE, versionAcceptee } from './version.js';

export type { Consommation, SeauAJetons } from './debit.js';
export { consommer, seauNeuf } from './debit.js';

export type {
  CompteDeSession,
  ConfigurationPartie,
  DemandeChat,
  DemandeCreation,
  DemandeRejoindre,
  DemandeRetour,
  IntentionDeplacement,
  MessageChat,
  SessionJoueur,
} from './entrees.js';

export type {
  BonusActive,
  BotNoirDetruit,
  BotVu,
  CaptureParBotNoirSubie,
  CaptureReussie,
  CaptureSubie,
  CompteDuSalon,
  EntiteVue,
  EtatCompteARebours,
  EtatDeProgression,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  FinDePartie,
  InfosSalon,
  InstantanePartie,
  JoueurDuSalon,
  JoueurVu,
  LigneClassement,
  MalusRamasseParMoi,
  MalusSubi,
  ObjetVu,
  PartieEnPause,
  PartiePublique,
  PlaceEnPartie,
  ProgressionDeFin,
  ProgressionEnregistree,
  ProgressionNonEnregistree,
  Refus,
  StatutPartie,
  TactiqueVue,
  TirDeCaptureVu,
  VieDeTraqueurPerdueVue,
  ZoneVue,
} from './evenements.js';

export type {
  Couleur,
  DimensionsCarte,
  Direction,
  Equipe,
  IdentifiantCarte,
  Mode,
  Orientation,
  TypeBonus,
  TypeMalus,
  TypeZone,
  Visibilite,
} from './constantes.js';
export {
  APPARITION,
  BOTS,
  BOTS_NOIRS,
  CADENCES_LEGACY_MS,
  CAPACITES,
  CARTES,
  CHASSE,
  COULEUR_BOT_NEUTRE,
  COULEUR_BOT_NOIR,
  COULEUR_DES_TRAQUEURS,
  COULEURS_DES_EQUIPES,
  COULEURS_JOUEURS,
  DEPLACEMENTS_LEGACY_PAR_PAS,
  DIRECTIONS,
  DUREES,
  EQUIPES,
  MEMBRES_PAR_EQUIPE_MAXIMUM,
  MODES,
  OBJETS,
  RAYON_ENTITE,
  SCORE,
  TACTIQUE,
  TYPES_BONUS,
  TYPES_MALUS,
  TYPES_ZONE,
  VISIBILITES,
  VITESSES,
  ZONES,
} from './constantes.js';

export type { IssueParCamp, PlaceDansUnCamp } from './camps.js';
export { placeDansUnCamp } from './camps.js';

export type { CampDeChasse, LigneDeJoueurEnChasse } from './chasse.js';
export { campDeCouleur, proiesRestantes } from './chasse.js';

export type {
  ClassementDesEquipes,
  IssueDesEquipes,
  LigneDEquipe,
  LigneDeJoueurEnEquipe,
  PlaceDansLesEquipes,
} from './equipes.js';
export {
  classementDesEquipes,
  equipeDArrivee,
  equipeDeCouleur,
  placeDansLesEquipes,
  pointsEnEquipe,
} from './equipes.js';

export type { EnTeteDeTrame, NatureDeTrame, TrameDEtat, TrameEncodee } from './flux.js';
export {
  ErreurDeTrame,
  SUBDIVISIONS_DU_PIXEL,
  VERSION_DU_FLUX,
  appliquerTrame,
  encoderDelta,
  encoderImage,
  lireEnTete,
  quantifierInstantane,
} from './flux.js';

export type { Position, Vecteur } from './geometrie.js';

export type { CoucheCarte, NomDeSon, PisteMusicale } from './ressources.js';
export {
  COTE_IMAGE_OBJET_PX,
  IMAGES_DE_MARCHE,
  IMAGES_PAR_OBJET,
  MUSIQUES,
  RACINE_RESSOURCES,
  SONS,
  SONS_DE_PAS,
  SONS_EN_BOUCLE,
  cheminApercuCarte,
  cheminCarte,
  cheminNinja,
  cheminObjet,
  cheminPluie,
  IMAGES_DE_PLUIE,
  cheminSon,
  tousLesNinjas,
  tousLesObjets,
} from './ressources.js';

export type {
  PartielProfond,
  ReglageBonus,
  ReglageMalus,
  ReglagesBonus,
  ReglagesBotsNoirs,
  ReglagesMalus,
  ReglagesPartie,
  ReglagesPartiels,
  ReglagesZones,
} from './reglages.js';
export { REGLAGES_PAR_DEFAUT, completerReglages, imposerLesReglagesDuMode } from './reglages.js';

export type { ErreurValidation, ResultatValidation } from './validation.js';
export {
  formaterCodeDeSecours,
  normaliserTexte,
  reperePseudo,
  validerCodeDeSecours,
  validerCodeInvitation,
  validerDemandeChangementMotDePasse,
  validerDemandeCodeDeSecours,
  validerDemandeConnexion,
  validerDemandeCreation,
  validerDemandeInscription,
  validerDemandeReinitialisation,
  validerDemandeRejoindre,
  validerDemandeRetour,
  validerEquipe,
  validerIntentionDeplacement,
  validerJeton,
  validerMessageChat,
  validerMotDePasse,
  validerPseudo,
  validerReglages,
} from './validation.js';
