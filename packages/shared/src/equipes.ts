/**
 * Les equipes du mode Equipes, vues de toutes les couches (etape 7.2).
 *
 * Le moteur ne connait pas d'equipe: il connait des couleurs, et deux joueurs de meme
 * couleur sont coequipiers. Le serveur et le client, eux, parlent d'equipes. Ce fichier
 * fait le passage de l'une a l'autre, au meme endroit pour tous.
 */

import type { Couleur, Equipe } from './constantes.js';
import { COULEURS_DES_EQUIPES, EQUIPES } from './constantes.js';

/**
 * L'equipe qui porte cette couleur, ou undefined si aucune ne la porte.
 *
 * La casse ne compte pas: le flux d'etat fait voyager les couleurs en majuscules, et
 * rien n'oblige un appelant a les ecrire ainsi.
 */
export function equipeDeCouleur(couleur: Couleur): Equipe | undefined {
  const cherchee = couleur.toUpperCase();

  return EQUIPES.find((equipe) => COULEURS_DES_EQUIPES[equipe].toUpperCase() === cherchee);
}
