/**
 * Generateur de nombres pseudo-aleatoires a graine.
 *
 * Le coeur de simulation n'a pas le droit d'appeler Math.random: deux parties
 * lancees avec la meme graine et les memes entrees doivent produire exactement
 * la meme partie. C'est ce qui rend les tests reproductibles, et ce qui rendra
 * plus tard la rejouabilite et le mode spectateur possibles.
 *
 * Particularite de ce generateur: il ne garde aucun etat cache. Tirer un nombre
 * ne modifie rien, cela renvoie le nombre tire *et* le generateur suivant. Le
 * generateur se transporte donc dans l'etat de la partie comme n'importe quelle
 * autre donnee, ce qui respecte la regle « aucun etat global mutable ».
 *
 *     const premier = nombre(etat.alea);
 *     const second = nombre(premier.alea);   // et non nombre(etat.alea)
 *
 * L'algorithme est mulberry32: un etat de 32 bits, quelques melanges, une sortie
 * dans l'intervalle [0, 1). Il est rapide, court, et suffisant pour du jeu. Il
 * n'est pas cryptographique, et n'a pas a l'etre.
 */

/** Un generateur a un instant donne. Deux generateurs de meme etat tirent la meme suite. */
export interface Alea {
  readonly etat: number;
}

/** Resultat d'un tirage: la valeur obtenue, et le generateur a utiliser pour le tirage suivant. */
export interface Tirage<T> {
  readonly valeur: T;
  readonly alea: Alea;
}

/**
 * Construit un generateur a partir d'une graine.
 *
 * @param graine Entier de depart. La meme graine donne toujours la meme suite.
 */
export function creerAlea(graine: number): Alea {
  return { etat: graine >>> 0 };
}

/**
 * Tire un nombre dans l'intervalle [0, 1).
 *
 * C'est l'equivalent direct de Math.random(), en reproductible.
 */
export function nombre(alea: Alea): Tirage<number> {
  const suivant = (alea.etat + 0x6d2b79f5) >>> 0;

  let melange = suivant;
  melange = Math.imul(melange ^ (melange >>> 15), melange | 1);
  melange ^= melange + Math.imul(melange ^ (melange >>> 7), melange | 61);
  const valeur = ((melange ^ (melange >>> 14)) >>> 0) / 4294967296;

  return { valeur, alea: { etat: suivant } };
}

/**
 * Tire un entier entre 0 inclus et une borne exclue.
 *
 * @param borneExclue Nombre de valeurs possibles. Doit etre au moins 1.
 */
export function entier(alea: Alea, borneExclue: number): Tirage<number> {
  if (!Number.isInteger(borneExclue) || borneExclue < 1) {
    throw new Error(
      `La borne d'un tirage entier doit etre un entier positif, recu ${borneExclue}.`,
    );
  }

  const tirage = nombre(alea);
  return { valeur: Math.floor(tirage.valeur * borneExclue), alea: tirage.alea };
}

/**
 * Tire un reel entre deux bornes, la borne haute exclue.
 */
export function reel(alea: Alea, minimum: number, maximumExclu: number): Tirage<number> {
  const tirage = nombre(alea);
  return { valeur: minimum + tirage.valeur * (maximumExclu - minimum), alea: tirage.alea };
}

/**
 * Tire un element au hasard dans une liste non vide.
 */
export function element<T>(alea: Alea, elements: readonly T[]): Tirage<T> {
  if (elements.length === 0) {
    throw new Error('Impossible de tirer un element dans une liste vide.');
  }

  const tirage = entier(alea, elements.length);
  // La borne du tirage vaut la longueur de la liste: l'index existe toujours.
  return { valeur: elements[tirage.valeur] as T, alea: tirage.alea };
}
