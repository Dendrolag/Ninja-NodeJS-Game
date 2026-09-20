/**
 * Retrouver son personnage: l'onde qui le designe.
 *
 * POURQUOI CE REPERE EXISTE. Dans Neon Ninja, un joueur ressemble a un faux
 * ninja: meme silhouette, et, des qu'il a rallie des bots, la meme couleur que
 * son troupeau. Au milieu de cinquante personnages, on se perd de vue. Le jeu
 * d'origine dessinait donc quatre fleches autour du personnage: a la demande
 * (touche F, ou bouton sur mobile), a l'entree en partie, et apres chaque
 * capture, puisqu'on reapparait alors ailleurs. Depuis l'etape 7.8, ce sont des anneaux
 * a notre couleur qui se resserrent sur lui: le rouge des fleches ne tenait pas dans la
 * palette du jeu, et se confondait avec le halo des Black Ninjas.
 *
 * L'ETAPE 4.2 L'AVAIT OUBLIE en portant le rendu. Il est rattrape a l'etape 4.3,
 * qui assemble l'ecran de jeu et l'a remarque en relisant l'aide du jeu d'origine.
 *
 * FONCTIONS PURES. Le jeu d'origine tenait un booleen et une minuterie, remis a
 * zero a six endroits differents. Ici un reperage n'est qu'une date de fin, et
 * l'opacite du repere se calcule a partir de l'instant: il n'y a rien a remettre
 * a zero, et aucune minuterie a annuler en quittant la partie.
 */

import type { Vecteur } from '@neon-ninja/shared';

import { DUREES_LOCALISATION, REPERE_LOCALISATION } from './apparence.js';
import type { DisqueScene } from './scene.js';

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
 * Opacite du repere a cet instant: pleine, puis un fondu sur la fin.
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

/**
 * Le repere a dessiner autour d'un point de la carte: l'onde qui se referme.
 *
 * Deux anneaux, decales d'un demi-cycle, qui se resserrent sur le personnage et s'effacent
 * en arrivant, plus un anneau d'ancrage qui ne bouge pas. Chacun est trace deux fois: un
 * trait blanc a demi opaque dessous, un peu plus epais, puis le trait de notre couleur
 * dessus, pour rester lisible quand notre couleur est sombre sur un fond de nuit.
 *
 * L'onde se deduit de l'instant, comme l'opacite du reperage: il n'y a aucun etat a tenir
 * et aucune minuterie a annuler.
 *
 * @param centre     Position affichee du personnage, en coordonnees de carte.
 * @param opacite    Opacite du repere, de zero a un. Aucun repere a zero.
 * @param maintenant Instant local, qui fait avancer l'onde.
 * @param couleur    Notre couleur dans la partie.
 */
export function reperesDeLocalisation(
  centre: Vecteur,
  opacite: number,
  maintenant: number,
  couleur: number,
): readonly DisqueScene[] {
  if (opacite <= 0) {
    return [];
  }

  const repere = REPERE_LOCALISATION;
  const disques: DisqueScene[] = [];

  for (const [rang, avance] of [0, repere.decalage].entries()) {
    const part = (((maintenant / repere.cycleMs + avance) % 1) + 1) % 1;
    const rayon = repere.rayonDeDepart - (repere.rayonDeDepart - repere.rayonDArrivee) * part;

    disques.push(
      ...anneau(
        `localisation:onde:${String(rang)}`,
        centre,
        rayon,
        couleur,
        opacite * repere.alphaAuDepart * (1 - part),
        repere.epaisseur,
      ),
    );
  }

  disques.push(
    ...anneau(
      'localisation:ancrage',
      centre,
      repere.rayonDAncrage,
      couleur,
      opacite * repere.alphaDAncrage,
      repere.epaisseurDAncrage,
    ),
  );

  return disques;
}

/** Un anneau: le trait blanc qui le cerne, puis le trait de couleur par-dessus. */
function anneau(
  id: string,
  centre: Vecteur,
  rayon: number,
  couleur: number,
  alpha: number,
  epaisseur: number,
): readonly DisqueScene[] {
  const repere = REPERE_LOCALISATION;
  const commun = { x: centre.x, y: centre.y, rayon, remplissage: undefined };

  return [
    {
      ...commun,
      id: `${id}:cerne`,
      contour: {
        couleur: repere.cerne,
        alpha: alpha * repere.alphaDuCerne,
        epaisseur: epaisseur + repere.epaisseurDuCerne - repere.epaisseur,
      },
    },
    { ...commun, id, contour: { couleur, alpha, epaisseur } },
  ];
}
