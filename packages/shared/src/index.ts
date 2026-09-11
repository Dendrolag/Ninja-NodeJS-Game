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
  BORNES_CODE_INVITATION,
  BORNES_JETON,
  BORNES_MOT_DE_PASSE,
  BORNES_PSEUDO,
  BORNES_REGLAGES,
  BORNES_ROOM,
  LIMITES_COMPTES,
  LIMITES_DEBIT,
} from './bornes.js';

export type {
  AuthentificationReseau,
  CompteConnecte,
  DemandeConnexion,
  DemandeInscription,
  MaProgression,
  PartieDuProfil,
  ProfilDuCompte,
  ReponseRefusee,
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

export type { Consommation, SeauAJetons } from './debit.js';
export { consommer, seauNeuf } from './debit.js';

export type {
  CompteDeSession,
  ConfigurationPartie,
  DemandeChat,
  DemandeCreation,
  DemandeRejoindre,
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
  ProgressionDeFin,
  ProgressionEnregistree,
  ProgressionNonEnregistree,
  Refus,
  StatutPartie,
  ZoneVue,
} from './evenements.js';

export type {
  Couleur,
  DimensionsCarte,
  Direction,
  IdentifiantCarte,
  Mode,
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
  COULEUR_BOT_NEUTRE,
  COULEUR_BOT_NOIR,
  COULEURS_JOUEURS,
  DEPLACEMENTS_LEGACY_PAR_PAS,
  DIRECTIONS,
  DUREES,
  MODES,
  OBJETS,
  RAYON_ENTITE,
  SCORE,
  TYPES_BONUS,
  TYPES_MALUS,
  TYPES_ZONE,
  VISIBILITES,
  VITESSES,
  ZONES,
} from './constantes.js';

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
  IMAGES_DE_MARCHE,
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
export { REGLAGES_PAR_DEFAUT, completerReglages } from './reglages.js';

export type { ErreurValidation, ResultatValidation } from './validation.js';
export {
  normaliserTexte,
  reperePseudo,
  validerCodeInvitation,
  validerDemandeConnexion,
  validerDemandeCreation,
  validerDemandeInscription,
  validerDemandeRejoindre,
  validerIntentionDeplacement,
  validerJeton,
  validerMessageChat,
  validerMotDePasse,
  validerPseudo,
  validerReglages,
} from './validation.js';
