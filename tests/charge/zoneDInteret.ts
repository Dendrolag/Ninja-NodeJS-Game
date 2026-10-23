/**
 * L'estimation du filtrage par zone d'interet (etape 5.10).
 *
 * Sur une carte de 10 000 sur 10 000, chaque joueur recoit aujourd'hui toutes les
 * entites de la partie, meme a huit mille pixels de lui. L'etape 2.10 lui donnera
 * seulement ce qui l'entoure. Ce module ne la construit pas: il estime ce qu'elle
 * ferait gagner, en codant pour chaque joueur la trame qu'il recevrait s'il ne voyait
 * que le rectangle centre sur lui.
 *
 * LE RECTANGLE. Sur ordinateur, la camera montre 900 pixels de carte en hauteur
 * (HAUTEUR_DE_VUE_PX, packages/client/src/rendu/apparence.ts), et autant que l'ecran le
 * permet en largeur. L'ecran le plus large qu'on retient est un 21:9, 2 133 pixels de
 * carte. Le rendu met encore a jour ce qui depasse de deux sprites (MARGE_HORS_CHAMP_PX,
 * 64 pixels), et la camera rattrape le joueur avec un temps de retard: on arrondit a
 * 2 400 sur 1 200, soit 133 pixels de marge de chaque cote en largeur et 150 en hauteur.
 * Un telephone en montre bien moins (360 sur 271): le rectangle couvre tous les ecrans.
 *
 * Ce qui est filtre: les entites, les objets et les zones, par leur centre. Le classement
 * et le temps restant restent ceux de toute la partie.
 */

import type { InstantanePartie, Position } from '../../packages/shared/dist/index.js';

/** Le rectangle montre a un joueur, en pixels de carte, de part et d'autre de sa position. */
export const ZONE_D_INTERET = { demiLargeur: 1200, demiHauteur: 600 } as const;

/** Un rectangle centre sur un joueur. */
export interface Zone {
  readonly demiLargeur: number;
  readonly demiHauteur: number;
}

/** Ce point est-il dans le rectangle centre sur ce joueur, bords compris. */
export function dansLaZone(
  centre: Position,
  point: { readonly x: number; readonly y: number },
  zone: Zone = ZONE_D_INTERET,
): boolean {
  return (
    Math.abs(point.x - centre.x) <= zone.demiLargeur &&
    Math.abs(point.y - centre.y) <= zone.demiHauteur
  );
}

/** La vue d'un joueur reduite a ce qui est dans son rectangle. */
export function vueFiltree(
  vue: InstantanePartie,
  centre: Position,
  zone: Zone = ZONE_D_INTERET,
): InstantanePartie {
  return {
    ...vue,
    entites: vue.entites.filter((entite) => dansLaZone(centre, entite, zone)),
    objets: vue.objets.filter((objet) => dansLaZone(centre, objet, zone)),
    zones: vue.zones.filter((zoneDeJeu) => dansLaZone(centre, zoneDeJeu, zone)),
  };
}
