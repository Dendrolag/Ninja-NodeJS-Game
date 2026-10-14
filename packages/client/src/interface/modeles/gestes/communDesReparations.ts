/**
 * Ce que les gestes des reparations d'Among Ninjas ont en commun (etape 7.27): les commandes
 * qu'ils recoivent, celles des taches et la molette, et les echos qu'ils laissent. Le reste suit
 * les regles des gestes des taches (commun.ts).
 */

import type { CommandeDeGeste } from './commun.js';

/** Une commande d'un geste de reparation: celles des taches, et la molette, en crans. */
export type CommandeDeReparation =
  CommandeDeGeste | { readonly type: 'molette'; readonly crans: number };

/**
 * Ce qu'un geste de reparation fait entendre: le moteur qui tousse ou demarre, un disjoncteur
 * remonte, un fusible enclenche, le levier general, l'oscilloscope accorde, un coup de vanne,
 * l'interrupteur qui claque, et un essai rate.
 */
export type EchoDeReparation =
  | 'tousse'
  | 'demarre'
  | 'disjoncteur'
  | 'fusible'
  | 'levier'
  | 'accord'
  | 'vanne'
  | 'declic'
  | 'ratee';

/** Ce que tout geste de reparation porte: ses echos, dans l'ordre. */
export interface BaseDeReparation {
  readonly echos: readonly EchoDeReparation[];
}

/** L'etat avec cet echo de plus. */
export function avecEchoDeReparation<E extends BaseDeReparation>(
  etat: E,
  echo: EchoDeReparation,
): E {
  return { ...etat, echos: [...etat.echos, echo] };
}

/** Une valeur ramenee entre deux bornes. */
export function borner(valeur: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(valeur, minimum), maximum);
}
