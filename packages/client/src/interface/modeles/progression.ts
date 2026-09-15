/**
 * Comment la progression d'un compte se presente au joueur: noms des paliers,
 * nombres, variations et barre de niveau.
 *
 * LES REGLES NE SONT PAS ICI. Le niveau et l'avancement dans le niveau se deduisent
 * de l'XP par les fonctions du paquet partage (progression.ts), les memes que le
 * serveur applique: le client ne recalcule aucune regle, il met en forme.
 *
 * LES NOMS DES PALIERS APPARTIENNENT AU CLIENT (handoff 3.3): le serveur ne connait
 * que leurs identifiants. La table est indexee par ces identifiants, si bien qu'un
 * palier ajoute sans nom ne compile pas.
 */

import type { IdentifiantPalier } from '@neon-ninja/shared';
import { avancementDuNiveau } from '@neon-ninja/shared';

/** Le nom de chaque palier de rang, tel que le joueur le lit. */
export const NOMS_DES_PALIERS: Readonly<Record<IdentifiantPalier, string>> = {
  bronze: 'Bronze',
  argent: 'Argent',
  or: 'Or',
  platine: 'Platine',
  diamant: 'Diamant',
};

/** Les nombres a la francaise: « 1 280 », avec l'espace fine des milliers. */
const FORMAT_DES_NOMBRES = new Intl.NumberFormat('fr-FR');

/** Un nombre entier, ecrit a la francaise. */
export function formaterNombre(nombre: number): string {
  return FORMAT_DES_NOMBRES.format(nombre);
}

/**
 * Une variation signee: « +20 », « −10 », ou « 0 ».
 *
 * Le moins est le signe typographique, et non le tiret: c'est lui que lit un
 * lecteur d'ecran comme « moins ».
 */
export function formaterVariation(variation: number): string {
  if (variation > 0) {
    return `+${formaterNombre(variation)}`;
  }

  if (variation < 0) {
    return `−${formaterNombre(-variation)}`;
  }

  return '0';
}

/** Ce que montre la barre de niveau d'un compte. */
export interface BarreDeNiveau {
  readonly niveau: number;
  /** Part du niveau courant deja faite, de 0 a 99. */
  readonly pourCent: number;
  /** « 40 / 200 XP »: l'XP gagnee dans le niveau, sur ce qu'il coute. */
  readonly xp: string;
}

/** La barre de niveau qui correspond a une XP totale. */
export function barreDeNiveau(xpTotale: number): BarreDeNiveau {
  const avancement = avancementDuNiveau(xpTotale);

  return {
    niveau: avancement.niveau,
    pourCent: Math.floor((avancement.xpDansLeNiveau * 100) / avancement.xpDuNiveauEntier),
    xp: `${formaterNombre(avancement.xpDansLeNiveau)} / ${formaterNombre(avancement.xpDuNiveauEntier)} XP`,
  };
}
