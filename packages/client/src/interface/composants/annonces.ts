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
 * LE GRAND TITRE (etape 4.6). L'annonce d'un objet ne passe pas par le fil: elle
 * s'affiche en grand au centre de l'ecran, a la couleur de l'objet, avec son icone. Un
 * seul a la fois: le suivant remplace le precedent, pour que deux objets ramasses coup
 * sur coup ne s'empilent pas au milieu du jeu. Il s'efface par son animation, comme le
 * fil.
 *
 * Ce fichier ne choisit aucun texte: les phrases viennent de annonces.ts.
 */

import type { Annonce, GrandTitre } from '../../annonces.js';
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
  const fil = creer(doc, 'div', {
    classe: 'annonces',
    attributs: { role: 'status', 'aria-live': 'polite' },
  });
  const scene = creer(doc, 'div', {
    classe: 'grands-titres',
    attributs: { role: 'status', 'aria-live': 'polite' },
  });
  const racine = creer(doc, 'div', { classe: 'annonces-hote' }, fil, scene);

  const retirer = (evenement: Event): void => {
    const cible = evenement.target;

    if (
      cible instanceof HTMLElement &&
      (cible.parentElement === fil || cible.parentElement === scene)
    ) {
      cible.remove();
    }
  };

  racine.addEventListener('animationend', retirer);

  return {
    racine,

    ajouter(annonce) {
      if (annonce.grandTitre !== undefined) {
        scene.replaceChildren(elementDuGrandTitre(doc, annonce.grandTitre));

        return;
      }

      fil.append(
        creer(doc, 'p', { classe: `annonce annonce-${annonce.ton}`, texte: annonce.texte }),
      );

      while (fil.children.length > ANNONCES_VISIBLES_MAXIMUM) {
        fil.firstElementChild?.remove();
      }
    },

    demonter() {
      racine.removeEventListener('animationend', retirer);
      racine.remove();
    },
  };
}

/**
 * L'element d'un grand titre: l'icone dans son disque, le surtitre, le nom de l'objet et
 * la ligne qui le dit. La couleur passe par une propriete de la feuille de style.
 */
function elementDuGrandTitre(doc: Document, titre: GrandTitre): HTMLElement {
  // L'Evade n'a pas d'icone: son disque est raye, et porte « x2 » (etape 7.9).
  const pictogramme =
    titre.icone === undefined
      ? creer(doc, 'span', { classe: 'grand-titre-x2', texte: 'x2' })
      : creer(doc, 'span', { classe: 'grand-titre-pictogramme' });

  if (titre.icone !== undefined) {
    pictogramme.style.backgroundImage = `url("${titre.icone}")`;
  }

  const classes = ['grand-titre', titre.brouille ? 'brouille' : '', titre.raye ? 'raye' : '']
    .filter((classe) => classe !== '')
    .join(' ');

  const element = creer(
    doc,
    'div',
    { classe: classes },
    creer(
      doc,
      'span',
      { classe: 'grand-titre-icone', attributs: { 'aria-hidden': 'true' } },
      pictogramme,
    ),
    creer(doc, 'span', { classe: 'grand-titre-surtitre', texte: titre.surtitre }),
    creer(doc, 'strong', { classe: 'grand-titre-titre', texte: titre.titre }),
    creer(doc, 'span', { classe: 'grand-titre-ligne', texte: titre.ligne }),
  );
  element.style.setProperty('--couleur-objet', couleurCss(titre.couleur));

  return element;
}

/** Une couleur de 24 bits, ecrite pour la feuille de style. */
export function couleurCss(couleur: number): string {
  return `#${couleur.toString(16).padStart(6, '0')}`;
}
