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

export { captureAutorisee, capturerBot, capturerJoueur, detruireBotNoir } from './capture.js';

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
  resoudreContacts,
} from './contacts.js';

export type { Couleur } from './couleurs.js';
export { couleurAleatoire, couleurUnique } from './couleurs.js';

export { resoudreDeplacement } from './deplacement.js';

export { aLaLongueur, determinerDirection, directionDuVecteur, norme } from './direction.js';

export type {
  Bot,
  CaptureDeJoueur,
  DestructionDeBotNoir,
  Entite,
  EtatPartie,
  EvenementPartie,
  HistoriqueCapture,
  IdentifiantEntite,
  Joueur,
  OptionsAjoutBot,
  OptionsAjoutJoueur,
  OptionsEtatInitial,
  TypeEntite,
} from './etat.js';
export {
  COMPTEUR_CAPTURE_PRET,
  ajouterBot,
  ajouterJoueur,
  couleursUtilisees,
  creerEtatInitial,
  entiteDe,
  estInvulnerable,
  peutCapturer,
  positionDApparition,
  positionsOccupees,
  retirerBot,
  retirerJoueur,
  toutesLesEntites,
} from './etat.js';

export type { EntreeJoueur, Entrees, EvaluationFinDePartie } from './moteur.js';
export { evaluerFinDePartie, tick } from './moteur.js';

export type { LigneScore } from './score.js';
export { calculerScores, scoreDe } from './score.js';
