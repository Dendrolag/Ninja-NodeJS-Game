/**
 * Comment les cartes et les modes de jeu se presentent au joueur.
 *
 * Les noms des cartes sont ceux retenus le 29 juin 2026 pour la version 1
 * (journal de conception): Rainy Tokyo, Tokyo et Spirit & Time. Le jeu d'origine
 * appelait la troisieme « Room Of Spirit and Time ». Les ambiances viennent de la
 * maquette.
 *
 * LES TABLES SONT INDEXEES PAR LES IDENTIFIANTS DU CONTRAT. Ajouter une carte ou
 * un mode au contrat sans lui donner de nom ici est donc une erreur de
 * compilation: rien ne peut apparaitre a l'ecran sous son identifiant technique.
 */

import type { IdentifiantCarte, Mode } from '@neon-ninja/shared';

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
 * Le nom de chaque mode de jeu, tel que le joueur le lit.
 *
 * Le mode est un jeu de regles enfichable (decision du 29 juin 2026), et le salon
 * le transporte depuis l'etape 2.4. Le Tactique s'est ajoute au Classique a l'etape
 * 7.1.
 */
export const NOMS_DES_MODES: Readonly<Record<Mode, string>> = {
  classique: 'Classique',
  tactique: 'Tactique',
};

/** Le nom d'une carte tel qu'on l'affiche, mode miroir compris. */
export function nomDeCarte(carte: IdentifiantCarte, modeMiroir: boolean): string {
  const nom = PRESENTATION_CARTES[carte].nom;

  return modeMiroir ? `${nom} · Miroir` : nom;
}
