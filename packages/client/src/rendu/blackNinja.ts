/**
 * Les marques du Black Ninja (etape 5.8), choisies par le porteur du projet sur la planche
 * docs/design/etape-5-8/1-couleurs-et-black-ninja.png, en plus de son corps noir, de son
 * anneau rouge qui pulse et de son disque de detection:
 *
 *   - des yeux rouges qui brillent: une image aux yeux rougis, fabriquee au chargement
 *     (rougirLesYeux, recoloration.ts), et une lueur rouge pale sous sa tete, qui respire;
 *   - une aura de fumee: des volutes sombres violacees qui tournent autour de lui.
 *
 * Tout se pose dans les disques, sous les personnages: aucun filtre par personnage. Seul le
 * Black Ninja les porte; depuis la meme etape, aucun faux ninja n'est assez sombre pour lui
 * ressembler (defaut X38 de l'audit).
 *
 * Fonctions pures: le temps arrive en parametre.
 */

import { AURA_DU_BLACK_NINJA, YEUX_DU_BLACK_NINJA } from './apparence.js';
import type { DisqueScene } from './scene.js';

/** Les volutes de l'aura et la lueur des yeux d'un Black Ninja, a sa place affichee. */
export function marquesDuBlackNinja(
  id: string,
  x: number,
  y: number,
  maintenant: number,
): readonly DisqueScene[] {
  return [...auraDeFumee(id, x, y, maintenant), lueurDesYeux(id, x, y, maintenant)];
}

/**
 * L'aura: des volutes de trois sortes, plus ou moins loin, grandes et pales, qui font le tour
 * du Black Ninja, ecrasees en hauteur et un peu montees, comme de la fumee a ses pieds.
 */
function auraDeFumee(id: string, x: number, y: number, maintenant: number): readonly DisqueScene[] {
  const forme = AURA_DU_BLACK_NINJA;
  const tour = ((maintenant % forme.tourMs) / forme.tourMs) * 2 * Math.PI;
  const volutes: DisqueScene[] = [];

  for (let rang = 0; rang < forme.volutes; rang += 1) {
    const sorte = rang % 3;
    const angle = tour + (rang * 2 * Math.PI) / forme.volutes;
    const distance = forme.distance[sorte] ?? 0;

    volutes.push({
      id: `${id}:volute${String(rang)}`,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance * forme.ecrasement + forme.montee - sorte * forme.montee,
      rayon: forme.rayon[sorte] ?? 0,
      remplissage: { couleur: forme.couleur, alpha: forme.alpha[sorte] ?? 0 },
      contour: undefined,
    });
  }

  return volutes;
}

/** La lueur rouge sous les yeux, qui respire lentement. */
function lueurDesYeux(id: string, x: number, y: number, maintenant: number): DisqueScene {
  const { couleur, lueur } = YEUX_DU_BLACK_NINJA;

  return {
    id: `${id}:yeux`,
    x,
    y: y + lueur.decalageY,
    rayon: lueur.rayon,
    remplissage: {
      couleur,
      alpha: lueur.alpha + lueur.amplitude * Math.sin(maintenant * lueur.cadence),
    },
    contour: undefined,
  };
}
