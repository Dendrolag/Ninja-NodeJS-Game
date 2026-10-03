/**
 * Les credits du jeu (etape 4.7): qui l'a cree, et qui y a participe.
 *
 * LES TEXTES SONT CEUX ARRETES AVEC LE PORTEUR DU PROJET le 28 septembre 2026. Bribz
 * a realise le decor de la carte Tokyo et les ninjas; le journal du jeu d'origine le
 * disait deja (« by Bribz »), mais rien ne le disait au joueur.
 *
 * La Station lunaire (etape 8.9) est dessinee par 2-Minute Tabletop, sous licence Creative
 * Commons BY-NC 4.0, qui oblige a nommer l'auteur, a renvoyer a la licence et a dire ce qui
 * a ete change (assets/README.md). La licence l'autorise: le nom renvoie a sa page.
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
  /** La licence sous laquelle son apport est utilise, s'il en a une (etape 8.9). */
  readonly licence?: Licence;
}

/** Une licence, nommee, et la page qui la donne en entier. */
export interface Licence {
  readonly nom: string;
  readonly adresse: string;
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
  participations: [
    // Pas d'adresse: l'accord de Bribz sur un lien n'est pas encore donne.
    { nom: 'Bribz', apport: 'la carte Tokyo et les ninjas' },
    {
      nom: '2-Minute Tabletop',
      apport: 'la carte Station lunaire',
      adresse: 'https://www.patreon.com/2minutetabletop',
      licence: { nom: 'CC BY-NC 4.0', adresse: 'https://creativecommons.org/licenses/by-nc/4.0/' },
    },
  ],
};

/** Ce qui precede le nom, dans la ligne d'une participation. */
export const AVANT_LE_NOM = 'Avec l’aimable participation de ';

/**
 * Ce qui suit le nom, dans la ligne d'une participation: son apport, puis, s'il a une
 * licence, de quoi l'annoncer. Le nom de la licence et le point final suivent alors.
 */
export function apresLeNom(participation: Participation): string {
  return participation.licence === undefined
    ? ` pour ${participation.apport}.`
    : ` pour ${participation.apport}, sous licence `;
}
