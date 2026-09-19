/**
 * Les adresses publiques de la page (etape 5.6).
 *
 * Un module sans dependance: la sortie Vercel s'en sert pour rediriger l'alias, et
 * les tests du referencement le lisent dans un document simule, ou l'empaqueteur
 * ne peut pas se charger.
 */

/**
 * L'adresse canonique du jeu, la seule que les moteurs de recherche doivent retenir
 * (etape 5.6). La page, le fichier des robots et le plan du site l'ecrivent en
 * clair; un test verifie qu'ils disent la meme, et que la CI met en ligne a celle-ci.
 */
export const ADRESSE_CANONIQUE = 'https://ninja.dendrolag.fr';

/**
 * L'alias que Vercel donne au projet. Il servait la meme page que l'adresse
 * canonique: deux adresses pour un meme contenu, que les moteurs de recherche
 * departagent mal. Il y renvoie desormais. Les adresses propres a chaque
 * deploiement, elles, ne sont pas redirigees: elles servent au diagnostic.
 */
export const ALIAS_VERCEL = 'neon-ninja-jeu.vercel.app';
