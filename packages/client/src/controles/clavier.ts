/**
 * Le branchement du clavier sur les controles.
 *
 * CE FICHIER NE CONTIENT AUCUNE REGLE, et c'est voulu. Il pose trois ecoutes,
 * les transmet, et sait les retirer. Tout ce qui decide quelque chose est dans
 * touches.ts et controles.ts, qui se testent sans navigateur. Si une condition
 * apparaissait ici, elle serait au mauvais endroit.
 *
 * LES ECOUTES SE RETIRENT. La fonction rend de quoi les enlever, et l'appelant
 * doit s'en servir en quittant la partie. Le client d'origine ajoutait ses
 * ecoutes a chaque entree en jeu sans jamais les retirer: un joueur qui
 * rejoignait trois parties de suite traitait chaque touche trois fois.
 */

import type { Controles } from './controles.js';
import { TOUCHES_DU_JEU, TOUCHE_CAPTURER, TOUCHE_LOCALISER, nomDeTouche } from './touches.js';

/** Ce qu'il faut pour ecouter un clavier. */
export interface OptionsClavier {
  /**
   * L'objet qui recoit les evenements de clavier. Le document par defaut.
   *
   * Injectable pour que les tests puissent fournir un objet d'essai, et pour
   * qu'un jour un canevas puisse capter les touches sans que le reste de la page
   * les voie.
   */
  readonly cible?: EventTarget;
  /** L'objet dont la perte de focus relache tout. La fenetre par defaut. */
  readonly fenetre?: EventTarget;
  /**
   * La barre d'espace tire-t-elle: vrai dans une partie Tactique (etape 7.1). Faux par
   * defaut: en Classique, la touche reste au navigateur.
   */
  readonly capture?: boolean;
}

/** Les elements qui ont deja l'usage de la barre d'espace. */
const CONTROLES_DE_PAGE: ReadonlySet<string> = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

/**
 * Branche le clavier sur des controles.
 *
 * @returns La fonction a appeler pour tout debrancher.
 */
export function brancherClavier(controles: Controles, options: OptionsClavier = {}): () => void {
  const cible = options.cible ?? document;
  const fenetre = options.fenetre ?? window;
  const capture = options.capture ?? false;

  /**
   * La barre d'espace tire. Maintenue, elle ne tire qu'une fois: le navigateur repete
   * l'evenement, et la repetition est ignoree. Sur un bouton qui a le focus, elle
   * garde son role et l'actionne: le joueur qui vient de fermer une fenetre ne tire
   * pas par megarde.
   */
  const tirer = (evenement: KeyboardEvent): void => {
    if (evenement.repeat || surUnControleDePage(evenement.target)) {
      return;
    }

    evenement.preventDefault();
    controles.demanderUnTir();
  };

  const surEnfoncement = (evenement: Event): void => {
    const clavier = evenement as KeyboardEvent;
    const touche = nomDeTouche(clavier.key);

    if (touche === TOUCHE_LOCALISER) {
      controles.demanderLaLocalisation();
      return;
    }

    if (capture && touche === TOUCHE_CAPTURER) {
      tirer(clavier);
      return;
    }

    if (!TOUCHES_DU_JEU.has(touche)) {
      return;
    }

    // Les fleches font defiler la page: un joueur qui avance ne doit pas voir
    // son ecran glisser sous lui. On n'intercepte que les touches du jeu, pour
    // laisser le reste du clavier au chat et aux menus.
    evenement.preventDefault();
    controles.enfoncer(touche);
  };

  const surRelachement = (evenement: Event): void => {
    controles.relacher(nomDeTouche((evenement as KeyboardEvent).key));
  };

  const surPerteDeFocus = (): void => {
    controles.toutRelacher();
  };

  cible.addEventListener('keydown', surEnfoncement);
  cible.addEventListener('keyup', surRelachement);
  fenetre.addEventListener('blur', surPerteDeFocus);

  return () => {
    cible.removeEventListener('keydown', surEnfoncement);
    cible.removeEventListener('keyup', surRelachement);
    fenetre.removeEventListener('blur', surPerteDeFocus);
  };
}

/**
 * La touche vise-t-elle un element de la page qui a l'usage de l'espace.
 *
 * Lu par le nom de balise plutot que par instanceof: les tests tournent sans
 * navigateur, avec des cibles d'essai.
 */
function surUnControleDePage(cible: EventTarget | null): boolean {
  const balise = (cible as { readonly tagName?: unknown } | null)?.tagName;

  return typeof balise === 'string' && CONTROLES_DE_PAGE.has(balise);
}
