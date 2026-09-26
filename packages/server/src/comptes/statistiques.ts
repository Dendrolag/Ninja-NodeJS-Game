/**
 * Les statistiques d'un joueur, telles que son profil et sa fiche les montrent
 * (etape 3.5), deduites de ce que la base a regroupe par mode.
 *
 * FONCTION PURE. La base compte, mode par mode (base/parties.ts); ce fichier en
 * tire les totaux, l'ordre des modes et le mode prefere. Separer les deux permet de
 * verifier ces regles sans base, et aux comptes en memoire des tests de les
 * appliquer telles quelles, sans en ecrire une seconde version.
 *
 * LA DATE DE LA DERNIERE PARTIE NE SORT PAS D'ICI. Elle departage le mode prefere,
 * puis disparait: sur une fiche, elle dirait quand le joueur a joue, ce que l'etude
 * des amis reserve a son profil (decision 7 du 25 septembre 2026).
 */

import type { StatistiquesDUnMode, StatistiquesDeJoueur } from '@neon-ninja/shared';
import { MODES } from '@neon-ninja/shared';

import type { StatistiquesEnregistreesDUnMode } from '../base/parties.js';

/** Les statistiques d'un joueur, a partir de ses lignes par mode, dans n'importe quel ordre. */
export function statistiquesDeJoueur(
  lignes: readonly StatistiquesEnregistreesDUnMode[],
): StatistiquesDeJoueur {
  const rangees = [...lignes].sort(
    (une, autre) => MODES.indexOf(une.mode) - MODES.indexOf(autre.mode),
  );
  const prefere = modePrefere(rangees);

  return {
    partiesJouees: somme(rangees, (ligne) => ligne.partiesJouees),
    partiesAPlusieurs: somme(rangees, (ligne) => ligne.partiesAPlusieurs),
    victoires: somme(rangees, (ligne) => ligne.victoires),
    ...(prefere === undefined ? {} : { modePrefere: prefere.mode }),
    parMode: rangees.map(statistiquesDUnMode),
  };
}

/**
 * Le mode le plus joue, departage par la partie la plus recente (etude des amis,
 * section 3.3). Absent sans aucune partie.
 */
function modePrefere(
  lignes: readonly StatistiquesEnregistreesDUnMode[],
): StatistiquesEnregistreesDUnMode | undefined {
  let prefere: StatistiquesEnregistreesDUnMode | undefined;

  for (const ligne of lignes) {
    if (
      prefere === undefined ||
      ligne.partiesJouees > prefere.partiesJouees ||
      (ligne.partiesJouees === prefere.partiesJouees &&
        ligne.derniereLe.getTime() > prefere.derniereLe.getTime())
    ) {
      prefere = ligne;
    }
  }

  return prefere;
}

/**
 * Une ligne a la forme du contrat, sans sa date.
 *
 * Un meilleur score seul absent n'est pas ecrit: le contrat le declare facultatif, et
 * un champ absent n'est pas un champ qui vaut undefined.
 */
function statistiquesDUnMode(ligne: StatistiquesEnregistreesDUnMode): StatistiquesDUnMode {
  const { mode, partiesJouees, partiesAPlusieurs, victoires, meilleurScore, meilleurScoreSeul } =
    ligne;

  return {
    mode,
    partiesJouees,
    partiesAPlusieurs,
    victoires,
    meilleurScore,
    ...(meilleurScoreSeul === undefined ? {} : { meilleurScoreSeul }),
  };
}

/** La somme d'un nombre sur toutes les lignes. */
function somme(
  lignes: readonly StatistiquesEnregistreesDUnMode[],
  nombre: (ligne: StatistiquesEnregistreesDUnMode) => number,
): number {
  return lignes.reduce((total, ligne) => total + nombre(ligne), 0);
}
