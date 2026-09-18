/**
 * Point d'entree du coeur de simulation.
 *
 * INVARIANT: ce paquet ne fait aucune entree-sortie. Pas de reseau, pas de DOM,
 * pas de Date.now(), pas de Math.random(). Le temps arrive par dt, le hasard par
 * le generateur a graine de @neon-ninja/shared.
 *
 * La regle complete est dans .claude/rules/sim-purity.md, et le linter la fait
 * respecter automatiquement. Si le linter signale une violation, la correction
 * n'est jamais d'assouplir la regle: c'est de deplacer l'entree-sortie vers
 * packages/server et d'injecter ce dont le moteur a besoin.
 *
 * Le contrat du moteur tient en une fonction:
 *
 *     tick(etat, entrees, dt) -> nouvel etat
 */

export type { PerteFaceAuBotNoir } from './bots.js';
export {
  avancerLesBots,
  faireApparaitreLesBotsNoirs,
  perteClassique,
  peuplerDeBots,
} from './bots.js';

export {
  captureAutorisee,
  capturerBot,
  capturerEnEquipe,
  capturerJoueur,
  detruireBotNoir,
} from './capture.js';

export type { CarteCollisions } from './collisions.js';
export {
  SEUIL_MUR_LUMINOSITE,
  carteDepuisPixels,
  carteSansMur,
  creerCarteCollisions,
  estMur,
  positionTenable,
  trajetTenable,
} from './collisions.js';

export type { Contact, RegleDeResolution } from './contacts.js';
export {
  SEUIL_CONTACT_PX,
  detecterContacts,
  regleClassique,
  regleChasse,
  regleEquipes,
  regleTactique,
  resoudreContacts,
} from './contacts.js';

export type { Couleur } from './couleurs.js';
export { couleurAleatoire, couleurUnique } from './couleurs.js';

export { resoudreDeplacement } from './deplacement.js';

export { aLaLongueur, determinerDirection, directionDuVecteur, norme } from './direction.js';

export type { DureesRestantes } from './effets.js';
export {
  AUCUN_BONUS,
  AUCUN_MALUS,
  bonusEnCours,
  cumuler,
  effetsEnCours,
  estActif,
  fairePasserLeTemps,
  malusEnCours,
  remplacer,
} from './effets.js';

export {
  PERSONNE_HORS_JEU,
  agirEnChasse,
  chasseDecidee,
  devenirTraqueur,
  estTraqueur,
  horsJeuEnChasse,
  infecter,
  lancerLaChasse,
  malusEnChasse,
  peutTirer,
  pointsEnChasse,
  tirerEnChasse,
  traqueurEnJeu,
} from './chasse.js';

export { malusEnEquipe, partDuJoueur, perteEnEquipe } from './equipes.js';

export {
  CONE_DU_KATANA,
  GUERRIER_DE_DEPART,
  agirEnMassacre,
  frapper,
  guerrierDe,
  lancerLeMassacre,
  massacreDecide,
  multiplicateurDuCombo,
  perteEnMassacre,
  pointsEnMassacre,
  tuerUnJoueur,
} from './massacre.js';

export type {
  BonusPose,
  BonusRamasse,
  Bot,
  BotNoir,
  BotOrdinaire,
  CaptureDeJoueur,
  CaptureParBotNoir,
  CarteVidee,
  CoupDeKatana,
  DestructionDeBotNoir,
  Entite,
  EtatDeChasse,
  EtatDeMassacre,
  EtatPartie,
  EtatTactiqueDuJoueur,
  EvenementPartie,
  GuerrierEnMassacre,
  HistoriqueCapture,
  IdentifiantEntite,
  Joueur,
  JoueurTranche,
  MalusPose,
  MalusRamasse,
  MortParLeKatana,
  ObjetRamassable,
  OptionsAjoutBot,
  OptionsAjoutJoueur,
  OptionsEtatInitial,
  ParcoursEnChasse,
  ProchainesApparitions,
  TirDeCapture,
  TraqueurEnChasse,
  TypeEntite,
  VieDeTraqueurPerdue,
  ZoneSpeciale,
} from './etat.js';
export {
  COMPTEUR_CAPTURE_PRET,
  ajouterBot,
  ajouterJoueur,
  bonusActif,
  changerDeCouleur,
  couleursUtilisees,
  creerEtatInitial,
  entiteDe,
  estInvincible,
  estInvulnerable,
  identifiantSuivant,
  malusActif,
  peutCapturer,
  positionDApparition,
  positionsOccupees,
  retirerBot,
  retirerJoueur,
  toutesLesEntites,
} from './etat.js';

export type { OptionsPoseObjet, VictimeDuMalus } from './objets.js';
export {
  faireApparaitreLesObjets,
  fairePasserLeTempsSurLesObjets,
  malusClassique,
  nombreDeMalusPoses,
  poserObjet,
  ramasser,
  ramasserLesObjets,
  retirerObjet,
} from './objets.js';

export { mettreEnPause, reprendre } from './pause.js';

export { avancerUneEcheance, intervalleFixe, intervalleVariable } from './planification.js';

export type { GeometrieDuCone } from './tactique.js';
export {
  CONE_TACTIQUE,
  ETAT_TACTIQUE_DE_DEPART,
  agirEnTactique,
  dansLeCone,
  geometrieDuCone,
  etatTactiqueDe,
  recharger,
  tirer,
} from './tactique.js';

export { appliquerLesEffetsDeZone, avancerLesZones, estCache, zoneContient } from './zones.js';

export type { EntreeJoueur, Entrees, EvaluationFinDePartie, JeuDeRegles } from './moteur.js';
export { REGLES_DES_MODES, evaluerFinDePartie, lancerLaPartie, tick } from './moteur.js';

export type { LigneScore } from './score.js';
export { calculerScores, scoreDe } from './score.js';
