/**
 * Point d'entree du client.
 *
 * Separation stricte entre l'etat et le rendu: un magasin d'etat unique d'un
 * cote, PixiJS pour le rendu in-game et le DOM pour les menus de l'autre.
 * Aucune variable globale mutable, c'etait le defaut central du client d'origine.
 *
 * La boucle de rendu est independante du reseau: le legacy n'affichait qu'a la
 * cadence des messages recus, ce qui plafonnait le jeu a 20 images par seconde.
 *
 * CE QUE L'ETAPE 4.1 A POSE, et comment les morceaux s'emboitent:
 *
 *   reseau (transport)  ->  client (cablage)  ->  magasin (etat)  ->  affichage
 *
 *   - reseau, l'interface du transport, et son implementation Socket.IO. Le
 *     reste du client ne sait pas comment les messages voyagent. C'est ce qui
 *     permettra a l'etape 2.3 de passer au delta binaire sans toucher au reste.
 *   - reconstruction, le seul endroit qui sache comment le flux d'etat est fait.
 *     Il rend une VuePartie, que le rendu de l'etape 4.2 lira.
 *   - actions et reduction, la seule maniere de faire changer l'etat: on decrit
 *     ce qui est arrive, une fonction pure calcule l'etat suivant.
 *   - magasin, le detenteur unique de cet etat, avec ses abonnes.
 *   - ecrans, la seule reponse a la question de savoir quel ecran afficher.
 *   - client, le cablage entre les trois, et les commandes du joueur.
 *   - selecteurs, les questions que l'affichage pose a l'etat.
 *
 * CE QUE L'ETAPE 4.2 A AJOUTE, dans quatre dossiers:
 *
 *   - rendu/, l'affichage du terrain. Un coeur pur (camera, lissage, scene) que
 *     l'on teste sans navigateur, et un adaptateur PixiJS qui pose la scene sur
 *     le GPU. La lueur neon y est un filtre de calque, plus un flou par entite.
 *   - controles/, la saisie. Une table de touches et un calcul d'intention,
 *     purs; deux branchements minces sur le clavier et le tactile.
 *   - hud/, la surcouche. Un modele pur de ce qu'il faut afficher, et un
 *     ecrivain de document qui ne decide rien.
 *   - sons/, le son. Une table de declencheurs pure, et un lecteur.
 *
 * CE QUE L'ETAPE 4.3 A AJOUTE: la page.
 *
 *   - interface/, les ecrans (accueil, salon, jeu, fin) et l'application qui les
 *     enchaine. Meme decoupage que partout ailleurs: des modeles purs dans
 *     interface/modeles, des ecrivains de document qui ne decident rien.
 *   - annonces, les phrases qui disent ce qui vient d'arriver.
 *   - rendu/localisation, les fleches qui designent notre personnage.
 *   - principal.ts, le point de depart dans le navigateur. Il n'est pas exporte
 *     ici: l'importer lancerait l'application. L'empaqueteur
 *     (scripts/empaqueter.ts) part de lui.
 */

export type { Action } from './actions.js';

export type { AccesPartie, Client, OptionsClient } from './client.js';
export { creerClient } from './client.js';

export type { Ecran, EcranDeMenu } from './ecrans.js';
export { ECRANS_DE_MENU, ecranSuivant, estUnEcranDeMenu } from './ecrans.js';

export type {
  DemandeDeCompte,
  EffetActif,
  EtatClient,
  EtatConnexion,
  MessageAffiche,
  NatureDemandeDeCompte,
  SessionDuClient,
} from './etat.js';
export {
  AUCUNE_DEMANDE_DE_COMPTE,
  ETAT_INITIAL,
  MAX_JOURNAL,
  MAX_MESSAGES,
  refusDe,
} from './etat.js';

export type {
  ApiComptes,
  ApiComptesFactice,
  AppelDesComptes,
  EnvoiHttp,
  OptionsApiComptesHttp,
  ReponseDesComptes,
  ReponsesDesComptes,
} from './comptes/api.js';
export {
  JETON_DESSAI,
  MOTIF_INJOIGNABLE,
  STATUT_INJOIGNABLE,
  STATUT_SESSION_ABSENTE,
  creerApiComptesFactice,
  creerApiComptesHttp,
  progressionDEssai,
} from './comptes/api.js';

export type { CoffreDeJeton } from './comptes/coffre.js';
export { CLE_JETON, creerCoffreDeJeton } from './comptes/coffre.js';

export type { CommandesDeSession, OptionsSession } from './comptes/session.js';
export { brancherLaSession } from './comptes/session.js';

export type { ChargesDeFait, FaitDeJeu, NatureDeFait } from './faits.js';
export { fait } from './faits.js';

export type { HorlogeClient, HorlogeClientManuelle } from './horloge.js';
export { creerHorlogeClientManuelle, horlogeNavigateur } from './horloge.js';

export type { Magasin, Observateur } from './magasin.js';
export { creerMagasin } from './magasin.js';

export type { VuePartie } from './reconstruction.js';
export { entiteDe, reconstruire } from './reconstruction.js';

export { reduire } from './reduction.js';

export type {
  ArgumentsDescendants,
  ArgumentsMontants,
  MessageEmis,
  NomDescendant,
  NomMontant,
  Reseau,
  ReseauFactice,
} from './reseau.js';
export { creerReseauFactice } from './reseau.js';

export type { OptionsReseauSocketIo } from './reseauSocketIo.js';
export { SERVEUR_INJOIGNABLE, creerReseauSocketIo } from './reseauSocketIo.js';

export {
  effetsEnCours,
  jeSuisHote,
  maLigneDeClassement,
  moiDansLaPartie,
  moiDansLeSalon,
  partieEnMouvement,
  resteDeLEffet,
} from './selecteurs.js';

// --------------------------------------------------------------------------
// Etape 4.2: rendu, controles, HUD et sons
// --------------------------------------------------------------------------

export type { Camera, TailleEcran, ZoneVisible } from './rendu/camera.js';
export { borner, cameraSur, echellePour, suivre, versEcran, zoneVisible } from './rendu/camera.js';

export type { EntiteLissee, VueLissee } from './rendu/interpolation.js';
export { TamponDeLissage, lisserUneEntite } from './rendu/interpolation.js';

export type { DisqueScene, FlecheScene, Scene, SpriteScene, ZoneScene } from './rendu/scene.js';
export { SCENE_VIDE, construireScene, couleurEnNombre } from './rendu/scene.js';

export { imageDeMarche, opaciteObjet, rayonPulsant } from './rendu/animation.js';

export type { Halo, Teinte } from './rendu/apparence.js';
export {
  APPARENCE_OBJET,
  APPARENCE_ZONE,
  DUREES_LOCALISATION,
  LUEUR,
  REPERE_LOCALISATION,
  TAILLE_SPRITE,
} from './rendu/apparence.js';

export type { Localisation } from './rendu/localisation.js';
export { flechesDeLocalisation, localiser, opaciteDeLocalisation } from './rendu/localisation.js';

export type { Boucle, OptionsBoucle } from './rendu/boucle.js';
export { lancerLaBoucle } from './rendu/boucle.js';

export type { OptionsRendu, Rendu } from './rendu/pixi.js';
export { monterRendu, prechargerLesSprites } from './rendu/pixi.js';

export type { DirectionsDemandees } from './controles/intention.js';
export {
  AUCUNE_DIRECTION,
  IMMOBILE,
  intentionDepuisDirections,
  intentionDepuisManette,
  memeIntention,
} from './controles/intention.js';

export {
  TOUCHES,
  TOUCHES_DU_JEU,
  TOUCHE_LOCALISER,
  directionsDepuisTouches,
  nomDeTouche,
} from './controles/touches.js';

export { Controles } from './controles/controles.js';

export type { OptionsClavier } from './controles/clavier.js';
export { brancherClavier } from './controles/clavier.js';

export type { EtatManette, OptionsTactile } from './controles/tactile.js';
export { MANETTE_AU_REPOS, RAYON_MANETTE, brancherTactile } from './controles/tactile.js';

export type { EffetHud, Hud, LigneHud, PointMinimap } from './hud/modele.js';
export { HUD_VIDE, SEUIL_URGENCE_MS, construireHud, formaterDuree } from './hud/modele.js';

export type { OptionsSurcouche, Surcouche } from './hud/surcouche.js';
export { COTE_MINIMAP, monterSurcouche } from './hud/surcouche.js';

export {
  SEUIL_TEMPS_PRESSE_MS,
  battementDeFin,
  sonDuFait,
  sonsDuChangement,
} from './sons/declencheurs.js';

export type { LecteurDeSons, OptionsLecteur } from './sons/lecteur.js';
export { creerLecteurDeSons } from './sons/lecteur.js';

// --------------------------------------------------------------------------
// Etape 4.3: les ecrans et l'application
// --------------------------------------------------------------------------

export type { Annonce, TonAnnonce } from './annonces.js';
export { annonceDuFait, annonceDuRefus, annoncesDuChangement } from './annonces.js';

export type { Application, OptionsApplication } from './interface/application.js';
export { monterApplication } from './interface/application.js';

export type { ContexteEcran, EcranAffiche, MonteurEcran } from './interface/ecrans/types.js';

export type { EtatDuLien, ModeleAccueil } from './interface/modeles/accueil.js';
export { AVIS_SESSION_EXPIREE, modeleAccueil } from './interface/modeles/accueil.js';

export type {
  EnvoiDeCompte,
  ModeleConnexion,
  SaisieDeCompte,
} from './interface/modeles/connexion.js';
export { modeleConnexion } from './interface/modeles/connexion.js';

export type { ModeleCompteDeLEntete } from './interface/modeles/entete.js';
export { modeleCompteDeLEntete } from './interface/modeles/entete.js';

export type { BarreDeNiveau } from './interface/modeles/progression.js';
export {
  NOMS_DES_PALIERS,
  barreDeNiveau,
  formaterNombre,
  formaterVariation,
} from './interface/modeles/progression.js';

export type {
  CompteAffiche,
  JoueurAffiche,
  LigneRecapitulatif,
  MessageDuChat,
  ModeleSalon,
} from './interface/modeles/salon.js';
export { initiales, modeleSalon } from './interface/modeles/salon.js';

export type { LigneFin, ModeleFin, Place } from './interface/modeles/fin.js';
export { modeleFin } from './interface/modeles/fin.js';

export type { PresentationCarte } from './interface/modeles/cartes.js';
export { NOMS_DES_MODES, PRESENTATION_CARTES, nomDeCarte } from './interface/modeles/cartes.js';

export type {
  ChampReglage,
  GroupeReglages,
  SectionReglages,
  ValeurDeChamp,
  ValeursFormulaire,
} from './interface/modeles/reglages.js';
export {
  GROUPES_REGLAGES,
  erreursParChamp,
  reglagesDepuisValeurs,
  tousLesChamps,
  valeursDepuisReglages,
  verifierLesValeurs,
} from './interface/modeles/reglages.js';

export type { PreferencesSon } from './interface/preferences.js';
export {
  CLE_PREFERENCES_SON,
  PREFERENCES_SON_PAR_DEFAUT,
  ecrirePreferencesSon,
  lirePreferencesSon,
} from './interface/preferences.js';
