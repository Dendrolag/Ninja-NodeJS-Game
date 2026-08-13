/**
 * Point d'entree du client.
 *
 * Separation stricte entre l'etat et le rendu: un magasin d'etat unique d'un
 * cote, PixiJS pour le rendu in-game et le DOM pour les menus de l'autre.
 * Aucune variable globale mutable, c'etait le defaut central du client d'origine.
 *
 * La boucle de rendu est independante du reseau: le legacy n'affichait qu'a la
 * cadence des messages recus, ce qui plafonnait le jeu a 20 images par seconde.
 *
 * Le contenu reel arrive aux etapes 4.1 a 4.3.
 */

export {};
