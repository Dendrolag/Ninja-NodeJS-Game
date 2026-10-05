/**
 * La place d'un son sur la carte: a quel volume et de quel cote on l'entend (etape 4.11).
 *
 * FONCTIONS PURES, TESTABLES SANS HAUT-PARLEUR. Elles disent ou se trouve un son et
 * comment il s'entend depuis notre place; le jouer ainsi est le travail de lecteur.ts.
 *
 * QUELS SONS. Ceux qui ont lieu a un endroit de la carte et s'entendent de tous:
 * l'armement et l'explosion d'une mine posee, l'armement d'une mine de zone et
 * l'ouverture de sa zone, le nuage de fumee. Les sons qui ne concernent que nous (nos
 * tirs, nos captures, l'interface) et les annonces a toute la partie (l'apparition de
 * l'Evade) n'ont pas de lieu: ils jouent a plein et au centre, comme avant.
 *
 * LES POSITIONS SONT CELLES DE LA CARTE AFFICHEE. En miroir, le serveur envoie deja les
 * positions du terrain retourne (etape 8.3): la gauche d'un son est celle de l'ecran.
 */

import type { Position } from '@neon-ninja/shared';

import type { FaitDeJeu } from '../faits.js';

/**
 * Les reglages de l'oreille, en pixels de carte (decisions de la fiche 4.11).
 *
 *   - procheePx: plein volume jusque-la. Un rayon d'explosion et demi: qui est touche
 *     par une mine l'entend toujours a plein.
 *   - porteePx: silence au-dela. Un peu moins que la largeur d'un ecran d'ordinateur,
 *     qui montre environ 1 600 pixels de carte: une mine a l'autre bout de la carte ne
 *     s'entend pas.
 *   - coteePx: un son a cet ecart horizontal, ou plus, est entierement d'un cote. Le bord
 *     d'un ecran d'ordinateur.
 *   - coteMax: la part la plus forte d'un cote, pour qu'un son ne quitte jamais tout a
 *     fait une oreille.
 */
export const OREILLE = {
  procheePx: 200,
  porteePx: 1_400,
  coteePx: 800,
  coteMax: 0.8,
} as const;

/**
 * Comment s'entend un son situe.
 *
 *   - volume: de zero (on ne l'entend pas) a un (plein volume), en part du volume des effets.
 *   - cote: de moins un (a gauche) a un (a droite), zero au centre.
 */
export interface PlaceDuSon {
  readonly volume: number;
  readonly cote: number;
}

/**
 * Comment s'entend, depuis notre place, un son qui a lieu a cet endroit.
 *
 * Entre la distance proche et la portee, le volume suit le carre de la part de chemin
 * restant: une baisse lineaire du volume s'entendrait d'abord a peine puis d'un coup;
 * celle-ci s'entend reguliere. Au bord de l'ecran, a 800 pixels, il est au quart.
 */
export function placeDuSon(source: Position, auditeur: Position): PlaceDuSon {
  const dx = source.x - auditeur.x;
  const distance = Math.hypot(dx, source.y - auditeur.y);
  const restant = (OREILLE.porteePx - distance) / (OREILLE.porteePx - OREILLE.procheePx);
  const part = Math.min(Math.max(restant, 0), 1);
  const cote = Math.min(Math.max(dx / OREILLE.coteePx, -1), 1) * OREILLE.coteMax || 0;

  return { volume: part * part, cote };
}

/**
 * L'endroit de la carte ou a lieu le son d'un fait, s'il est situe.
 *
 * Rendre undefined est le cas ordinaire: la plupart des sons ne concernent que nous, ou
 * toute la partie, et jouent au centre.
 *
 * @param moi      Notre identifiant: notre propre fumee ne concerne que nous.
 * @param auditeur D'ou l'on ecoute: une fumee a deux bouts, et son son vient du plus proche.
 */
export function lieuDuSon(
  fait: FaitDeJeu,
  moi: string | undefined,
  auditeur: Position,
): Position | undefined {
  switch (fait.nature) {
    case 'mineArmee':
    case 'mineExplosee':
    case 'mineDeZone':
      return { x: fait.charge.x, y: fait.charge.y };

    case 'fumee': {
      if (fait.charge.joueur === moi) {
        return undefined;
      }

      const { depart, arrivee } = fait.charge;
      return distanceCarree(depart, auditeur) <= distanceCarree(arrivee, auditeur)
        ? { x: depart.x, y: depart.y }
        : { x: arrivee.x, y: arrivee.y };
    }

    default:
      return undefined;
  }
}

/**
 * Comment s'entend, depuis notre place, le son d'un fait.
 *
 * @param auditeur D'ou l'on ecoute, ou rien si on ne le sait pas.
 * @returns La place du son, ou rien pour un son qui n'est pas situe ou qu'on ne sait pas
 *          d'ou ecouter: il joue alors a plein et au centre.
 */
export function placeDuFait(
  fait: FaitDeJeu,
  moi: string | undefined,
  auditeur: Position | undefined,
): PlaceDuSon | undefined {
  if (auditeur === undefined) {
    return undefined;
  }

  const lieu = lieuDuSon(fait, moi, auditeur);
  return lieu === undefined ? undefined : placeDuSon(lieu, auditeur);
}

function distanceCarree(a: Position, b: Position): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
