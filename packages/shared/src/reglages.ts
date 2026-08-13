/**
 * Reglages d'une partie: ce que l'hote choisit dans le salon avant de lancer.
 *
 * Portage progressif de DEFAULT_GAME_SETTINGS (legacy/game-constants.js:79). On
 * ne porte a chaque etape que les reglages dont le moteur sait deja se servir.
 * Ce qui manque, et ou cela arrive:
 *
 *   - bonus (activation, durees, taux d'apparition): etape 1.4;
 *   - malus (activation, durees, taux): etape 1.4;
 *   - zones speciales (types actifs, durees, intervalle): etape 1.4;
 *   - bots noirs (nombre, moment d'apparition, rayon de detection, pourcentage
 *     de points perdus): etape 1.5.
 *
 * Le reglage blackBotSpeed du legacy n'est deliberement pas porte: il n'etait lu
 * nulle part, le bot noir avancant a la vitesse d'un bot ordinaire (defaut X13
 * de l'audit, decision du 13 aout 2026 de conserver ce comportement). Porter un
 * reglage mort aurait ete recopier le piege.
 *
 * POURQUOI CES REGLAGES VOYAGENT DANS L'ETAT. Dans le legacy, deux endroits
 * lisaient les valeurs par defaut au lieu des reglages de la partie en cours
 * (defaut X14 de l'audit), si bien que changer ces reglages dans le salon
 * n'avait aucun effet. Ici il n'existe aucun objet de reglages accessible
 * globalement: le moteur ne connait que celui que porte l'etat qu'on lui passe.
 * Le defaut ne peut donc plus se reproduire.
 */

import type { IdentifiantCarte } from './constantes.js';

/** Reglages d'une partie, figes au lancement. */
export interface ReglagesPartie {
  /** Duree de la partie, en secondes. */
  readonly dureePartieS: number;
  /** Carte jouee. */
  readonly carte: IdentifiantCarte;
  /** Mode miroir: la carte est retournee horizontalement. */
  readonly modeMiroir: boolean;
  /** Nombre de bots presents au demarrage. */
  readonly nombreBotsInitial: number;
}

/** Reglages appliques quand l'hote ne change rien. Valeurs du legacy. */
export const REGLAGES_PAR_DEFAUT: ReglagesPartie = {
  dureePartieS: 180,
  carte: 'map1',
  modeMiroir: false,
  nombreBotsInitial: 50,
};
