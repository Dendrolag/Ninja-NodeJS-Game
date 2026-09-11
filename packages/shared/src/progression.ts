/**
 * Ce qui se deduit de la progression d'un compte.
 *
 * LE NIVEAU NE SE STOCKE PAS, IL SE DEDUIT DE L'XP TOTALE (cadrage de l'etape 0.3,
 * section 5). Une seule fonction, ici, dans le paquet partage, pour que le serveur
 * et le client calculent toujours le meme niveau a partir de la meme XP.
 *
 * LES SEUILS SONT PROVISOIRES. Ils ne se fixent qu'a l'etape 3.3, avec les autres
 * valeurs des recompenses, a faire valider par le porteur du projet. En attendant,
 * un niveau tous les mille points d'XP: une regle simple, qui donne le niveau 1 a
 * un compte neuf et permet de verifier que le salon affiche le niveau reel d'un
 * compte. L'etape 3.3 remplace cette fonction, pas ses appelants.
 */

/** XP a gagner pour passer d'un niveau au suivant. Provisoire, jusqu'a l'etape 3.3. */
export const XP_PAR_NIVEAU_PROVISOIRE = 1000;

/**
 * Le niveau correspondant a une XP totale.
 *
 * @throws Si l'XP n'est pas un entier positif ou nul: elle vient de la base, ou
 *         elle ne peut pas l'etre, donc ce serait une faute du serveur.
 */
export function niveauDeXp(xpTotale: number): number {
  if (!Number.isInteger(xpTotale) || xpTotale < 0) {
    throw new Error(`Une XP totale est un entier positif ou nul, recu ${String(xpTotale)}.`);
  }

  return 1 + Math.floor(xpTotale / XP_PAR_NIVEAU_PROVISOIRE);
}
