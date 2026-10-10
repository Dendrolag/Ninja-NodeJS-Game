/**
 * Nettoyer une paire de lunettes (etape 7.21): frotter les deux verres jusqu'a effacer leurs
 * traces. Chaque verre s'efface au plus vite en 1,6 seconde: 3,2 secondes pour les deux,
 * au-dessus des 3 secondes du serveur.
 *
 * Les traces de chaque verre se tirent d'une graine, pour le dessin seulement: la meme tache se
 * ressemble d'une ouverture a l'autre.
 */

import type { AvancementDuGeste, CommandeDeGeste, Tireur } from './commun.js';
import { tireur } from './commun.js';
import type { EtatFrotte } from './frotter.js';
import { appliquerFrotte, avancementDuFrotte, frotteFini, zonesSales } from './frotter.js';

/** Ce qu'un verre met au plus vite a s'effacer. */
export const MS_PAR_VERRE = 1600;

/** Les deux verres, dans l'espace du geste. */
export const VERRES = [
  { x: 120, y: 150, rayon: 72 },
  { x: 280, y: 150, rayon: 72 },
] as const;

/** Une trace sur un verre, autour de son centre: une ellipse, pour le dessin. */
export interface TraceDeVerre {
  readonly dx: number;
  readonly dy: number;
  readonly rayonX: number;
  readonly rayonY: number;
  readonly angle: number;
}

/** Ou en est le nettoyage. */
export interface EtatLunettes extends EtatFrotte {
  readonly nature: 'lunettes';
  /** Les traces de chaque verre. */
  readonly traces: readonly (readonly TraceDeVerre[])[];
}

/** Les sept traces d'un verre. */
function tracesDUnVerre(tirer: Tireur): readonly TraceDeVerre[] {
  return Array.from({ length: 7 }, () => ({
    dx: tirer.reel(-40, 40),
    dy: tirer.reel(-35, 35),
    rayonX: tirer.reel(8, 20),
    rayonY: tirer.reel(5, 12),
    angle: tirer.reel(0, Math.PI),
  }));
}

/** Des lunettes sales. */
export function creerLunettes(graine: number): EtatLunettes {
  const tirer = tireur(graine);

  return {
    nature: 'lunettes',
    ...zonesSales(VERRES),
    traces: [tracesDUnVerre(tirer), tracesDUnVerre(tirer)],
    echos: [],
  };
}

/** Le nettoyage apres une commande. */
export function appliquerLunettes(
  etat: EtatLunettes,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatLunettes {
  return appliquerFrotte(etat, commande, maintenant, MS_PAR_VERRE);
}

/** Les deux verres sont-ils propres. */
export function lunettesFinies(etat: EtatLunettes): boolean {
  return frotteFini(etat);
}

/** Les verres propres. */
export function avancementDesLunettes(etat: EtatLunettes): AvancementDuGeste {
  return avancementDuFrotte(etat);
}
