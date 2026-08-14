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

export type {
  DimensionsCarte,
  Direction,
  IdentifiantCarte,
  TypeBonus,
  TypeMalus,
  TypeZone,
} from './constantes.js';
export {
  APPARITION,
  CADENCES_LEGACY_MS,
  CARTES,
  COULEUR_BOT_NEUTRE,
  COULEUR_BOT_NOIR,
  COULEURS_JOUEURS,
  DEPLACEMENTS_LEGACY_PAR_PAS,
  DIRECTIONS,
  DUREES,
  OBJETS,
  RAYON_ENTITE,
  SCORE,
  TYPES_BONUS,
  TYPES_MALUS,
  TYPES_ZONE,
  VITESSES,
  ZONES,
} from './constantes.js';

export type { Position, Vecteur } from './geometrie.js';

export type {
  PartielProfond,
  ReglageBonus,
  ReglageMalus,
  ReglagesBonus,
  ReglagesMalus,
  ReglagesPartie,
  ReglagesPartiels,
  ReglagesZones,
} from './reglages.js';
export { REGLAGES_PAR_DEFAUT, completerReglages } from './reglages.js';
