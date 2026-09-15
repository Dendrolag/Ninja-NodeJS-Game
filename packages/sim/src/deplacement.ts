/**
 * Comment une entite se deplace quand un mur la gene.
 *
 * Portage de la resolution du deplacement du gestionnaire move
 * (legacy/server.js:2604 a 2665), debarrassee de tout ce qui relevait du reseau:
 * il ne reste que la geometrie. Le legacy essaie, dans l'ordre:
 *
 *   1. le mouvement demande, en entier;
 *   2. sinon, ses composantes horizontale et verticale separement, ce qui donne
 *      le glissement le long d'un mur;
 *   3. sinon, six directions de contournement, a trente, quarante-cinq et
 *      soixante degres de part et d'autre;
 *   4. sinon, on ne bouge pas.
 *
 * Deux defauts du legacy sont corriges au passage, tous deux relevés en portant
 * ce code. Voir les commentaires des etapes 2 et 3 ci-dessous.
 *
 * La fonction ne connait ni joueur, ni bot: elle prend une position, un pas et
 * un rayon. Les bots de l'etape 1.5 se deplaceront avec la meme.
 */

import type { Position, Vecteur } from '@neon-ninja/shared';
import { RAYON_ENTITE } from '@neon-ninja/shared';

import type { CarteCollisions } from './collisions.js';
import { trajetTenable } from './collisions.js';

/**
 * Ecarts d'angle essayes pour contourner un obstacle, en degres, dans l'ordre.
 * Valeurs du legacy (server.js:2645).
 */
const ANGLES_DE_CONTOURNEMENT = [30, -30, 45, -45, 60, -60] as const;

/**
 * Deplace une entite d'un pas, en tenant compte du terrain.
 *
 * @param carte Le terrain de la partie.
 * @param depart Ou l'entite se trouve.
 * @param pas De combien elle veut avancer, en pixels. C'est un deplacement
 *            complet, deja mis a la bonne longueur par l'appelant: cette
 *            fonction ne connait ni vitesse ni duree.
 * @param rayon Encombrement de l'entite.
 * @returns La position atteinte. C'est la position de depart si rien n'est
 *          praticable.
 */
export function resoudreDeplacement(
  carte: CarteCollisions,
  depart: Position,
  pas: Vecteur,
  rayon: number = RAYON_ENTITE,
): Position {
  const arrivee = { x: depart.x + pas.x, y: depart.y + pas.y };
  if (trajetTenable(carte, depart, arrivee, rayon)) {
    return arrivee;
  }

  const glisse = glisserLeLongDuMur(carte, depart, pas, rayon);
  if (glisse !== depart) {
    return glisse;
  }

  return contourner(carte, depart, pas, rayon);
}

/**
 * Rejoue le pas axe par axe: d'abord l'horizontale, puis la verticale depuis la
 * position atteinte. C'est ce qui fait longer un mur au lieu de s'y coller net.
 *
 * DEFAUT DU LEGACY CORRIGE ICI. Le legacy testait les deux axes depuis la meme
 * position de depart, puis appliquait les deux resultats: quand les deux axes
 * passaient separement, il posait l'entite sur la diagonale, c'est-a-dire
 * exactement la position que le mouvement complet venait de refuser. Une entite
 * pouvait ainsi couper l'angle d'un mur en diagonale. Enchainer les deux axes,
 * comme ici, decrit le meme glissement mais par un chemin reellement parcouru:
 * on ne peut plus arriver ou l'on n'aurait pas pu aller.
 */
function glisserLeLongDuMur(
  carte: CarteCollisions,
  depart: Position,
  pas: Vecteur,
  rayon: number,
): Position {
  let position = depart;

  if (pas.x !== 0) {
    const surX = { x: position.x + pas.x, y: position.y };
    if (trajetTenable(carte, position, surX, rayon)) {
      position = surX;
    }
  }

  if (pas.y !== 0) {
    const surY = { x: position.x, y: position.y + pas.y };
    if (trajetTenable(carte, position, surY, rayon)) {
      position = surY;
    }
  }

  return position;
}

/**
 * Dernier recours: essayer de partir un peu de cote, a la meme distance.
 *
 * DEFAUT DU LEGACY CORRIGE ICI. Le legacy calculait ces directions a partir de
 * l'axe des abscisses et non de la direction voulue: un joueur bloque en allant
 * vers l'ouest repartait vers l'est. Les ecarts sont ici relatifs a la direction
 * demandee, ce qui correspond a l'intention evidente du code d'origine.
 */
function contourner(
  carte: CarteCollisions,
  depart: Position,
  pas: Vecteur,
  rayon: number,
): Position {
  const distance = Math.hypot(pas.x, pas.y);
  if (distance === 0) {
    return depart;
  }

  const capInitial = Math.atan2(pas.y, pas.x);

  for (const ecart of ANGLES_DE_CONTOURNEMENT) {
    const cap = capInitial + (ecart * Math.PI) / 180;
    const essai = {
      x: depart.x + Math.cos(cap) * distance,
      y: depart.y + Math.sin(cap) * distance,
    };

    if (trajetTenable(carte, depart, essai, rayon)) {
      return essai;
    }
  }

  return depart;
}
