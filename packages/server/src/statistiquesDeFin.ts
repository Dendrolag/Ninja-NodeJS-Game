/**
 * Les statistiques de fin de partie de chaque joueur, selon le mode (9 octobre 2026): ce que
 * le classement final montre a cote des points. Les colonnes de chaque mode, leurs intitules
 * et la facon d'ajouter un mode sont dans packages/shared, statistiquesDeFin.ts.
 *
 * TROIS SOURCES, TOUTES LUES A LA FIN. L'etat de la partie (les compteurs de chaque joueur,
 * ceux du Massacre et de la Chasse), le releve des exploits (le plus haut combo, le meilleur
 * tir, l'Evade attrape, les ninjas rallies: ce que l'etat ne garde pas), et l'instant ou
 * chacun est entre en jeu, que la room retient (la survie d'une proie arrivee en cours de
 * Chasse ne compte pas le temps d'avant son arrivee).
 *
 * UNE FONCTION PURE. Elle ne garde rien et ne mute rien: la room l'appelle au battement de la
 * fin, comme le bilan, et le serveur envoie le resultat avec le classement final.
 */

import type {
  ClassementDesEquipes,
  FaitsDePartie,
  StatistiqueDeFin,
  StatistiquesDUnJoueur,
} from '@neon-ninja/shared';
import { classementDesEquipes, statistiquesDeLaPartie } from '@neon-ninja/shared';
import type { EtatPartie, IdentifiantEntite, Joueur, LigneScore } from '@neon-ninja/sim';

/** Ce qu'il faut savoir d'un joueur pour calculer ses statistiques. */
interface JoueurEnFin {
  readonly etat: EtatPartie;
  readonly joueur: Joueur;
  /** Sa ligne au classement final. */
  readonly ligne: LigneScore;
  /** Ses faits de partie, tels que le releve les a retenus. */
  readonly faits: FaitsDePartie;
  /** L'instant ou il est entre en jeu, en temps de jeu. */
  readonly entreeMs: number;
  /** Le classement des equipes, dans une partie Equipes seulement. */
  readonly equipes: ClassementDesEquipes | undefined;
}

/**
 * Le calcul de chaque statistique. Rien rendu: la statistique n'a pas de sens pour ce
 * joueur, et la page montre un tiret (une proie n'a pas de vies de traqueur).
 *
 * C'EST UNE TABLE COMPLETE: une statistique ajoutee dans packages/shared sans son calcul ici
 * ne compile pas.
 */
const CALCULS: Readonly<Record<StatistiqueDeFin, (joueur: JoueurEnFin) => number | undefined>> = {
  ninjas: ({ ligne, equipes }) =>
    equipes === undefined ? ligne.botsPortes : partDesNinjas(equipes, ligne.id),
  captures: ({ joueur }) => joueur.captures,
  ninjasRallies: ({ faits }) => faits.ninjasRallies ?? 0,
  meilleurCombo: ({ faits }) => faits.meilleurMultiplicateur,
  meilleurTir: ({ faits }) => faits.meilleurFilet ?? 0,
  // Le Massacre compte ensemble les faux ninjas et les Black Ninjas tues: ces derniers ont
  // leur propre colonne.
  ninjasTues: ({ etat, joueur }) =>
    Math.max((etat.massacre?.guerriers[joueur.id]?.botsTues ?? 0) - joueur.botsNoirsDetruits, 0),
  joueursTues: ({ joueur }) => joueur.captures,
  infections: ({ joueur }) => joueur.captures,
  survie: survieEnChasse,
  vies: ({ etat, joueur }) => etat.chasse?.traqueurs[joueur.id]?.vies,
  botsNoirsDetruits: ({ joueur }) => joueur.botsNoirsDetruits,
  evade: ({ faits }) => ((faits.evadesAttrapes ?? 0) > 0 ? 1 : 0),
};

/**
 * Les statistiques de fin de chaque joueur present, par son identifiant: les colonnes de la
 * partie (celles du mode, moins celles qu'un reglage coupe), et rien d'autre.
 *
 * @param faitsDe Les faits de partie d'un joueur, par son identifiant.
 * @param entreesMs L'instant ou chaque joueur est entre en jeu. Absent: des le debut.
 */
export function statistiquesDeFin(
  etat: EtatPartie,
  classement: readonly LigneScore[],
  faitsDe: (id: IdentifiantEntite) => FaitsDePartie,
  entreesMs: ReadonlyMap<IdentifiantEntite, number>,
): Readonly<Record<IdentifiantEntite, StatistiquesDUnJoueur>> {
  const colonnes = statistiquesDeLaPartie(etat.mode, etat.reglages);
  const equipes = etat.mode === 'equipes' ? classementDesEquipes(classement) : undefined;
  const parJoueur: Record<IdentifiantEntite, StatistiquesDUnJoueur> = {};

  for (const ligne of classement) {
    const joueur = etat.joueurs[ligne.id];

    if (joueur === undefined) {
      continue;
    }

    const enFin: JoueurEnFin = {
      etat,
      joueur,
      ligne,
      faits: faitsDe(ligne.id),
      entreeMs: entreesMs.get(ligne.id) ?? 0,
      equipes,
    };
    const statistiques: Partial<Record<StatistiqueDeFin, number>> = {};

    for (const colonne of colonnes) {
      const valeur = CALCULS[colonne](enFin);

      if (valeur !== undefined) {
        statistiques[colonne] = valeur;
      }
    }

    parJoueur[ligne.id] = statistiques;
  }

  return parJoueur;
}

/** La part d'un joueur dans les ninjas de son equipe: ses ninjas divises par ses membres. */
function partDesNinjas(equipes: ClassementDesEquipes, id: IdentifiantEntite): number {
  const equipe = equipes.equipes.find((ligne) => ligne.membres.includes(id));

  return equipe === undefined ? 0 : Math.floor(equipe.botsPortes / equipe.membres.length);
}

/**
 * Le temps qu'une proie a tenu, en Chasse: de son entree en jeu a son infection, ou a la fin
 * si elle n'a pas ete prise. Rien pour un traqueur des le debut, qui n'a jamais ete proie.
 */
function survieEnChasse({ etat, joueur, entreeMs }: JoueurEnFin): number | undefined {
  const traqueur = etat.chasse?.traqueurs[joueur.id];
  const finMs = traqueur?.devenuAMs ?? Math.min(etat.tempsEcouleMs, etat.dureeMs);

  return traqueur !== undefined && traqueur.devenuAMs <= entreeMs
    ? undefined
    : Math.max(finMs - entreeMs, 0);
}
