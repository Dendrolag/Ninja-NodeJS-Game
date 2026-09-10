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
import { TOUCHES_DU_JEU, nomDeTouche } from './touches.js';

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
}

/**
 * Branche le clavier sur des controles.
 *
 * @returns La fonction a appeler pour tout debrancher.
 */
export function brancherClavier(controles: Controles, options: OptionsClavier = {}): () => void {
  const cible = options.cible ?? document;
  const fenetre = options.fenetre ?? window;

  const surEnfoncement = (evenement: Event): void => {
    const touche = nomDeTouche((evenement as KeyboardEvent).key);

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
