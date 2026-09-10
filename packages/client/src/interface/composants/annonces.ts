/**
 * Le fil des annonces: les phrases qui apparaissent un instant puis s'effacent.
 *
 * AUCUNE MINUTERIE. Le jeu d'origine faisait disparaitre chaque notification par
 * deux setTimeout imbriques, jamais annules: une notification posee juste avant de
 * quitter la partie s'effacait sur l'ecran suivant. Ici l'effacement est une
 * animation de la feuille de style, et l'element se retire a la fin de celle-ci.
 * Quand l'ecran disparait, l'element disparait avec lui, et il n'y a rien a
 * annuler.
 *
 * LE FIL EST BORNE. Une rafale de captures ne doit pas couvrir l'ecran: au-dela
 * de quatre annonces visibles, la plus ancienne laisse sa place.
 *
 * Ce fichier ne choisit aucun texte: les phrases viennent de annonces.ts.
 */

import type { Annonce } from '../../annonces.js';
import { creer } from '../dom.js';

/** Combien d'annonces restent visibles en meme temps. */
export const ANNONCES_VISIBLES_MAXIMUM = 4;

/** Un fil d'annonces monte. */
export interface FilDAnnonces {
  /** L'element a placer dans le document. */
  readonly racine: HTMLElement;
  /** Fait apparaitre une annonce. */
  ajouter(annonce: Annonce): void;
  demonter(): void;
}

/** Monte un fil d'annonces vide. */
export function monterFilDAnnonces(doc: Document): FilDAnnonces {
  // Annonce aux lecteurs d'ecran sans les interrompre: une capture ne vaut pas
  // qu'on coupe la lecture en cours.
  const racine = creer(doc, 'div', {
    classe: 'annonces',
    attributs: { role: 'status', 'aria-live': 'polite' },
  });

  const retirer = (evenement: Event): void => {
    const cible = evenement.target;

    if (cible instanceof HTMLElement && cible.parentElement === racine) {
      cible.remove();
    }
  };

  racine.addEventListener('animationend', retirer);

  return {
    racine,

    ajouter(annonce) {
      racine.append(
        creer(doc, 'p', { classe: `annonce annonce-${annonce.ton}`, texte: annonce.texte }),
      );

      while (racine.children.length > ANNONCES_VISIBLES_MAXIMUM) {
        racine.firstElementChild?.remove();
      }
    },

    demonter() {
      racine.removeEventListener('animationend', retirer);
      racine.remove();
    },
  };
}
