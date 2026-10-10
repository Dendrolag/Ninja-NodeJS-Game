/**
 * Nettoyer du sang au sol (etape 7.21): frotter trois taches avec l'eponge. Chaque tache
 * s'efface au plus vite en 1,2 seconde: 3,6 secondes pour les trois, au-dessus des 3,5 secondes
 * du serveur.
 *
 * La place des taches et leur dessin se tirent d'une graine: la meme tache se ressemble d'une
 * ouverture a l'autre.
 */

import type { AvancementDuGeste, CommandeDeGeste, PointDuGeste, Tireur } from './commun.js';
import { tireur } from './commun.js';
import type { EtatFrotte, ZoneAFrotter } from './frotter.js';
import { appliquerFrotte, avancementDuFrotte, frotteFini, zonesSales } from './frotter.js';

/** Ce qu'une tache met au plus vite a s'effacer. */
export const MS_PAR_TACHE_DE_SANG = 1200;

/** Le rayon d'une tache, dans l'espace du geste. */
const RAYON_D_UNE_TACHE = 50;

/**
 * Quatre dispositions des trois taches, en triangle, dont les centres sont a 149 unites au
 * moins les uns des autres: decalees chacune de 10 unites au plus, elles restent a 115 au moins.
 */
const DISPOSITIONS: readonly (readonly PointDuGeste[])[] = [
  [
    { x: 90, y: 110 },
    { x: 200, y: 215 },
    { x: 315, y: 115 },
  ],
  [
    { x: 90, y: 215 },
    { x: 200, y: 110 },
    { x: 315, y: 210 },
  ],
  [
    { x: 110, y: 100 },
    { x: 300, y: 110 },
    { x: 205, y: 225 },
  ],
  [
    { x: 110, y: 225 },
    { x: 300, y: 215 },
    { x: 200, y: 95 },
  ],
];

/** Le decalage d'une tache autour de sa place, au plus, sur chaque axe. */
const DECALAGE = 10;

/** Une goutte d'une tache, autour de son centre: une ellipse, pour le dessin. */
export interface GoutteDeSang {
  readonly dx: number;
  readonly dy: number;
  readonly rayonX: number;
  readonly rayonY: number;
  readonly angle: number;
}

/** Ou en est le nettoyage. */
export interface EtatSang extends EtatFrotte {
  readonly nature: 'sang';
  /** Les gouttes de chaque tache. */
  readonly gouttes: readonly (readonly GoutteDeSang[])[];
}

/**
 * Les centres des trois taches: une des dispositions, tiree, et chaque tache un peu decalee.
 * Elles restent ainsi toujours assez ecartees pour se frotter une a une.
 */
function placesDesTaches(tirer: Tireur): readonly ZoneAFrotter[] {
  const disposition = tirer.melanger(DISPOSITIONS)[0] as readonly PointDuGeste[];

  return disposition.map((place) => ({
    x: place.x + tirer.reel(-DECALAGE, DECALAGE),
    y: place.y + tirer.reel(-DECALAGE, DECALAGE),
    rayon: RAYON_D_UNE_TACHE,
  }));
}

/** Les neuf gouttes d'une tache. */
function gouttesDUneTache(tirer: Tireur): readonly GoutteDeSang[] {
  return Array.from({ length: 9 }, () => ({
    dx: tirer.reel(-24, 24),
    dy: tirer.reel(-14, 14),
    rayonX: tirer.reel(8, 22),
    rayonY: tirer.reel(5, 13),
    angle: tirer.reel(0, Math.PI),
  }));
}

/** Trois taches de sang. */
export function creerSang(graine: number): EtatSang {
  const tirer = tireur(graine);
  const zones = placesDesTaches(tirer);

  return {
    nature: 'sang',
    ...zonesSales(zones),
    gouttes: zones.map(() => gouttesDUneTache(tirer)),
    echos: [],
  };
}

/** Le nettoyage apres une commande. */
export function appliquerSang(
  etat: EtatSang,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatSang {
  return appliquerFrotte(etat, commande, maintenant, MS_PAR_TACHE_DE_SANG);
}

/** Les trois taches sont-elles effacees. */
export function sangFini(etat: EtatSang): boolean {
  return frotteFini(etat);
}

/** Les taches effacees. */
export function avancementDuSang(etat: EtatSang): AvancementDuGeste {
  return avancementDuFrotte(etat);
}
