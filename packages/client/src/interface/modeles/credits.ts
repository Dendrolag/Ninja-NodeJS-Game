/**
 * Les credits du jeu (etape 4.7): qui l'a cree, et qui y a participe.
 *
 * LES TEXTES SONT CEUX ARRETES AVEC LE PORTEUR DU PROJET le 28 septembre 2026. Bribz
 * a realise le decor de la carte Tokyo et les ninjas; le journal du jeu d'origine le
 * disait deja (« by Bribz »), mais rien ne le disait au joueur.
 *
 * CE SONT DES DONNEES, que la fenetre des credits se contente d'afficher. Le jour ou
 * Bribz donnera son accord pour un lien vers sa page, il suffira de renseigner
 * `adresse`: la fenetre sait deja en faire un lien sur, qui s'ouvre dans un nouvel
 * onglet sans transmettre la page d'origine.
 */

/** Une participation au jeu, lue « Avec l'aimable participation de <nom> pour <apport>. » */
export interface Participation {
  readonly nom: string;
  /** Ce que la personne a apporte au jeu. */
  readonly apport: string;
  /** Sa page, si elle a accepte qu'on y renvoie. Sans elle, le nom s'affiche seul. */
  readonly adresse?: string;
}

/** Tout ce que disent les credits. */
export interface Credits {
  /** La premiere ligne: a qui est le jeu. */
  readonly creation: string;
  readonly participations: readonly Participation[];
}

/** Les credits du jeu. */
export const CREDITS: Credits = {
  creation: 'Neon Ninja est une création originale de Dendrolag.',
  // Pas d'adresse: l'accord de Bribz sur un lien n'est pas encore donne.
  participations: [{ nom: 'Bribz', apport: 'la carte Tokyo et les ninjas' }],
};

/** Ce qui precede le nom, dans la ligne d'une participation. */
export const AVANT_LE_NOM = 'Avec l’aimable participation de ';

/** Ce qui suit le nom, dans la ligne d'une participation. */
export function apresLeNom(participation: Participation): string {
  return ` pour ${participation.apport}.`;
}
