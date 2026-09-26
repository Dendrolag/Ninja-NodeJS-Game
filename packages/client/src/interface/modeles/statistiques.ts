/**
 * Les statistiques d'un joueur, sous forme de donnees: ce que le profil et la fiche
 * en montrent tous deux (etape 3.5).
 *
 * UNE SEULE MISE EN FORME POUR LES DEUX. Le profil et la fiche lisent la meme
 * agregation (StatistiquesDeJoueur); les ecrire deux fois finirait par leur faire
 * dire deux choses differentes du meme joueur.
 *
 * FONCTION PURE. Tout vient du serveur, qui a compte: le client met en forme, il ne
 * compte rien.
 */

import type { StatistiquesDeJoueur, StatistiquesDUnMode } from '@neon-ninja/shared';

import { NOMS_DES_MODES } from './cartes.js';
import { formaterNombre } from './progression.js';

/** Une statistique, telle qu'on l'affiche dans une tuile. */
export interface StatistiqueAffichee {
  readonly libelle: string;
  readonly valeur: string;
  /** Une precision sous la valeur: « sur 40 parties à plusieurs ». */
  readonly detail?: string;
}

/** Un mode du tableau des statistiques, tel qu'on l'affiche. */
export interface LigneDUnMode {
  /** « Horde ». */
  readonly mode: string;
  readonly parties: string;
  /** « 3 sur 5 »: les victoires, sur les parties a plusieurs. */
  readonly victoires: string;
  readonly meilleurScore: string;
  /** Le meilleur score d'une partie jouee seul, ou un tiret s'il n'y en a pas. */
  readonly meilleurScoreSeul: string;
}

/** Ce qu'on ecrit a la place d'un nombre qui n'existe pas encore. */
export const SANS_VALEUR = '—';

/** Les tuiles communes au profil et a la fiche: parties, victoires, mode prefere. */
export function tuilesDesStatistiques(
  statistiques: StatistiquesDeJoueur,
): readonly StatistiqueAffichee[] {
  return [
    { libelle: 'Parties jouées', valeur: formaterNombre(statistiques.partiesJouees) },
    {
      libelle: 'Victoires',
      valeur: formaterNombre(statistiques.victoires),
      detail: `sur ${partiesAPlusieurs(statistiques.partiesAPlusieurs)}`,
    },
    {
      libelle: 'Mode préféré',
      // Un tiret plutot qu'un mode au hasard: aucune partie n'a encore ete jouee.
      valeur:
        statistiques.modePrefere === undefined
          ? SANS_VALEUR
          : NOMS_DES_MODES[statistiques.modePrefere],
    },
  ];
}

/** Le tableau par mode, dans l'ordre ou le serveur le rend: celui des modes du jeu. */
export function lignesParMode(statistiques: StatistiquesDeJoueur): readonly LigneDUnMode[] {
  return statistiques.parMode.map(ligneDUnMode);
}

/** Un mode, mis en forme. */
function ligneDUnMode(ligne: StatistiquesDUnMode): LigneDUnMode {
  return {
    mode: NOMS_DES_MODES[ligne.mode],
    parties: formaterNombre(ligne.partiesJouees),
    victoires: `${formaterNombre(ligne.victoires)} sur ${formaterNombre(ligne.partiesAPlusieurs)}`,
    meilleurScore: formaterNombre(ligne.meilleurScore),
    meilleurScoreSeul:
      ligne.meilleurScoreSeul === undefined ? SANS_VALEUR : formaterNombre(ligne.meilleurScoreSeul),
  };
}

/** « 1 partie à plusieurs », « 40 parties à plusieurs ». */
function partiesAPlusieurs(nombre: number): string {
  return `${formaterNombre(nombre)} ${nombre > 1 ? 'parties' : 'partie'} à plusieurs`;
}
