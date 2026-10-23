/**
 * Les deux terrains de la carte de mesure (etape 5.10): 10 000 sur 10 000 pixels.
 *
 * AUCUNE IMAGE N'ENTRE DANS LE DEPOT. Une image de cent millions de pixels pese des
 * dizaines de megaoctets et ne se dessine pas pour une mesure: les deux terrains se
 * fabriquent en memoire, par le banc, a chaque processus de mesure.
 *
 *   - LE TERRAIN REALISTE repete la collision de Tokyo cinq fois en largeur et sept en
 *     hauteur (2000 sur 1500 a chaque fois), puis la coupe a 10 000 sur 10 000. Il a la
 *     densite de murs d'une vraie carte, ses rues et ses impasses, sans contenu a
 *     dessiner. Les bords de Tokyo, qui sont des murs hors de la carte, deviennent des
 *     passages d'un Tokyo au suivant la ou le sol touche le bord.
 *   - LE TERRAIN SANS MUR, en temoin: ce que coute la foule seule, sans les murs qui
 *     la canalisent.
 *
 * Le terrain realiste passe par creerCarteCollisions, comme une carte generee: son
 * morceau principal se calcule donc comme celui d'une vraie carte, et le banc paie ce
 * calcul au demarrage de chaque processus, hors de la mesure du battement.
 */

import type { DimensionsCarte } from '../../packages/shared/dist/index.js';
import { CARTE_DE_MESURE } from '../../packages/shared/dist/index.js';
import type { CarteCollisions } from '../../packages/sim/dist/index.js';
import { carteSansMur, creerCarteCollisions, estMur } from '../../packages/sim/dist/index.js';

/** Les terrains de la carte de mesure. */
export const TERRAINS_DE_MESURE = ['realiste', 'vide'] as const;

/** Un terrain de la carte de mesure: Tokyo repete, ou sans mur. */
export type TerrainDeMesure = (typeof TERRAINS_DE_MESURE)[number];

/**
 * Une carte faite d'une autre repetee en largeur et en hauteur, coupee aux dimensions
 * demandees: le pixel (x, y) est celui de la source en (x modulo sa largeur, y modulo sa
 * hauteur).
 */
export function terrainRepete(
  source: CarteCollisions,
  dimensions: DimensionsCarte,
): CarteCollisions {
  return creerCarteCollisions(dimensions, (x, y) =>
    estMur(source, x % source.largeur, y % source.hauteur),
  );
}

/**
 * Le terrain de la carte de mesure.
 *
 * @param tokyo Les murs de Tokyo (map1), sans miroir, tels que le serveur les decode.
 */
export function terrainDeMesure(nature: TerrainDeMesure, tokyo: CarteCollisions): CarteCollisions {
  return nature === 'vide' ? carteSansMur(CARTE_DE_MESURE) : terrainRepete(tokyo, CARTE_DE_MESURE);
}
