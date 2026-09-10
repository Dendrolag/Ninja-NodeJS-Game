/**
 * Comment les cartes et le mode de jeu se presentent au joueur.
 *
 * Les noms sont ceux retenus le 29 juin 2026 pour la version 1 (journal de
 * conception): Rainy Tokyo, Tokyo et Spirit & Time. Le jeu d'origine appelait la
 * troisieme « Room Of Spirit and Time ». Les ambiances viennent de la maquette.
 *
 * LA TABLE EST INDEXEE PAR L'IDENTIFIANT DE CARTE DU CONTRAT. Ajouter une carte
 * au contrat sans lui donner de nom ici est donc une erreur de compilation: une
 * carte ne peut pas apparaitre dans le salon sous son identifiant technique.
 */

import type { IdentifiantCarte } from '@neon-ninja/shared';

/** Ce que le joueur lit d'une carte. */
export interface PresentationCarte {
  readonly nom: string;
  readonly ambiance: string;
}

/** La presentation de chaque carte jouable. */
export const PRESENTATION_CARTES: Readonly<Record<IdentifiantCarte, PresentationCarte>> = {
  map1: { nom: 'Rainy Tokyo', ambiance: 'Néon · Pluie' },
  map2: { nom: 'Tokyo', ambiance: 'Urbain · Nuit' },
  map3: { nom: 'Spirit & Time', ambiance: 'Vide · Infini' },
};

/**
 * Le nom du seul mode jouable en version 1.
 *
 * Le mode est un jeu de regles enfichable (decision du 29 juin 2026), mais tant
 * qu'il n'en existe qu'un, le contrat ne le transporte pas: il n'y a rien a
 * choisir, donc rien a lire ailleurs qu'ici.
 */
export const NOM_DU_MODE = 'Classique';

/** Le nom d'une carte tel qu'on l'affiche, mode miroir compris. */
export function nomDeCarte(carte: IdentifiantCarte, modeMiroir: boolean): string {
  const nom = PRESENTATION_CARTES[carte].nom;

  return modeMiroir ? `${nom} · Miroir` : nom;
}
