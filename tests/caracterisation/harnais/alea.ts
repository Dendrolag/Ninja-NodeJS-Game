/**
 * Generateur pseudo-aleatoire a graine, reserve au harnais de caracterisation.
 *
 * Le legacy tire son hasard de Math.random, ce qui rend ses sorties
 * irreproductibles. Pour figer son comportement dans des instantanes, on
 * remplace Math.random par ce generateur pendant toute la duree d'un scenario:
 * meme graine, meme suite de tirages, donc meme sortie a chaque execution.
 *
 * Ce fichier n'est pas le futur generateur du jeu. Celui-la vivra dans
 * packages/shared a l'etape 1.1 et sera couvert par ses propres tests. Ici on
 * ne cherche qu'une source de hasard rejouable, la plus courte possible.
 *
 * L'algorithme est mulberry32: un etat de 32 bits, quelques melanges, une
 * sortie dans l'intervalle [0, 1). Il est suffisant pour du test, pas pour de
 * la cryptographie.
 */

/**
 * Construit un tirage pseudo-aleatoire reproductible a partir d'une graine.
 *
 * @param graine Entier de depart. Deux appels avec la meme graine produisent
 *               exactement la meme suite de nombres.
 * @returns Une fonction sans argument qui renvoie un nombre dans [0, 1).
 */
export function creerAlea(graine: number): () => number {
  let etat = graine >>> 0;

  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let melange = etat;
    melange = Math.imul(melange ^ (melange >>> 15), melange | 1);
    melange ^= melange + Math.imul(melange ^ (melange >>> 7), melange | 61);
    return ((melange ^ (melange >>> 14)) >>> 0) / 4294967296;
  };
}
