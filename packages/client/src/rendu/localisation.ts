/**
 * Retrouver son personnage: les quatre fleches qui le designent.
 *
 * POURQUOI CE REPERE EXISTE. Dans Neon Ninja, un joueur ressemble a un faux
 * ninja: meme silhouette, et, des qu'il a rallie des bots, la meme couleur que
 * son troupeau. Au milieu de cinquante personnages, on se perd de vue. Le jeu
 * d'origine dessinait donc quatre fleches autour du personnage: a la demande
 * (touche F, ou bouton sur mobile), a l'entree en partie, et apres chaque
 * capture, puisqu'on reapparait alors ailleurs.
 *
 * L'ETAPE 4.2 L'AVAIT OUBLIE en portant le rendu. Il est rattrape a l'etape 4.3,
 * qui assemble l'ecran de jeu et l'a remarque en relisant l'aide du jeu d'origine.
 *
 * FONCTIONS PURES. Le jeu d'origine tenait un booleen et une minuterie, remis a
 * zero a six endroits differents. Ici un reperage n'est qu'une date de fin, et
 * l'opacite des fleches se calcule a partir de l'instant: il n'y a rien a remettre
 * a zero, et aucune minuterie a annuler en quittant la partie.
 */

import type { Vecteur } from '@neon-ninja/shared';

import { DUREES_LOCALISATION, REPERE_LOCALISATION } from './apparence.js';
import type { FlecheScene } from './scene.js';

/** Un reperage: jusqu'a quand les fleches restent visibles. */
export interface Localisation {
  /** Instant local ou les fleches ont fini de s'effacer. */
  readonly finA: number;
}

/**
 * Commence un reperage.
 *
 * @param maintenant Instant local, lu sur l'horloge du client.
 * @param dureeMs    Duree totale, fondu compris.
 */
export function localiser(maintenant: number, dureeMs: number): Localisation {
  return { finA: maintenant + dureeMs };
}

/**
 * Opacite des fleches a cet instant: pleine, puis un fondu sur la fin.
 *
 * Zero quand il n'y a pas de reperage, ou quand il est termine.
 */
export function opaciteDeLocalisation(
  localisation: Localisation | undefined,
  maintenant: number,
): number {
  if (localisation === undefined) {
    return 0;
  }

  const reste = localisation.finA - maintenant;

  if (reste <= 0) {
    return 0;
  }

  return Math.min(reste / DUREES_LOCALISATION.fonduMs, 1);
}

/** Les quatre directions ou poser une fleche: haut, droite, bas, gauche. */
const DIRECTIONS: readonly Vecteur[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/**
 * Les fleches a dessiner autour d'un point de la carte.
 *
 * Chaque fleche est un triangle dont la base est posee a distance du centre et
 * dont la pointe revient vers lui. La distance respire avec le temps, ce qui
 * attire l'oeil mieux qu'un repere immobile.
 *
 * @param centre     Position affichee du personnage, en coordonnees de carte.
 * @param opacite    Opacite des fleches, de zero a un. Aucune fleche a zero.
 * @param maintenant Instant local, qui fait respirer les fleches.
 */
export function flechesDeLocalisation(
  centre: Vecteur,
  opacite: number,
  maintenant: number,
): readonly FlecheScene[] {
  if (opacite <= 0) {
    return [];
  }

  const repere = REPERE_LOCALISATION;
  const ecart = repere.distance + Math.sin(maintenant * repere.cadence) * repere.amplitude;

  return DIRECTIONS.map((direction, index) => {
    const baseX = centre.x + direction.x * ecart;
    const baseY = centre.y + direction.y * ecart;
    // La base de la fleche est perpendiculaire a sa direction.
    const travers = { x: -direction.y, y: direction.x };

    return {
      id: `localisation:${String(index)}`,
      points: [
        baseX - direction.x * repere.longueur,
        baseY - direction.y * repere.longueur,
        baseX + travers.x * repere.demiLargeur,
        baseY + travers.y * repere.demiLargeur,
        baseX - travers.x * repere.demiLargeur,
        baseY - travers.y * repere.demiLargeur,
      ],
      remplissage: { couleur: repere.remplissage, alpha: opacite },
      contour: { couleur: repere.contour, alpha: opacite, epaisseur: repere.epaisseur },
    };
  });
}
