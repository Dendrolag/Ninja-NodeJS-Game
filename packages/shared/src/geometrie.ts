/**
 * Types geometriques de base, partages par le moteur, le serveur et le client.
 *
 * Ils sont volontairement minces: deux nombres. Les separer en deux types
 * distincts n'apporte rien au compilateur, mais beaucoup a la lecture. Une
 * position dit « ou », un vecteur dit « de combien ».
 */

/** Un point sur la carte, en pixels, origine en haut a gauche. */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/** Un deplacement ou une direction, en pixels. L'axe des y descend. */
export interface Vecteur {
  readonly x: number;
  readonly y: number;
}
