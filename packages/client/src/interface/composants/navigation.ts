/**
 * La navigation laterale: Jouer, Parties, Creer, Amis, Profil. L'entree Amis porte
 * une pastille, le nombre de demandes d'ami recues (etape 3.6).
 *
 * CE COMPOSANT NE DECIDE RIEN. Ce qu'il montre, et quand, vient de
 * modeleNavigation; un clic demande au client d'aller vers l'ecran, et c'est le
 * client qui decide s'il y va (un invite qui demande le profil est mene a la
 * connexion). En fenetre etroite, la feuille de style la replie en barre, en bas de
 * l'ecran (decision du 29 juin 2026).
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { Glyphe } from '../icones.js';
import type { DestinationDeNavigation } from '../modeles/navigation.js';
import { DESTINATIONS, modeleNavigation } from '../modeles/navigation.js';

/** Le pictogramme de chaque destination, ceux de la maquette. */
const GLYPHES: Readonly<Record<DestinationDeNavigation, Glyphe>> = {
  accueil: 'play',
  parties: 'globe',
  creation: 'plus',
  amis: 'amis',
  profil: 'diamond',
};

/** La navigation, montee. */
export interface Navigation {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Monte la navigation laterale. */
export function monterNavigation(doc: Document, client: Client): Navigation {
  const entrees = DESTINATIONS.map(({ vers, libelle }) => {
    const element = bouton(
      doc,
      { classe: 'navigation-entree', texte: libelle, icone: GLYPHES[vers] },
      () => {
        client.naviguer(vers);
      },
    );
    // La pastille est decorative: le nom du bouton dit deja combien de demandes attendent.
    const pastille = creer(doc, 'span', {
      classe: 'navigation-pastille',
      attributs: { 'aria-hidden': 'true' },
    });
    pastille.hidden = true;
    element.append(pastille);

    return { vers, libelle, element, pastille };
  });

  const racine = creer(
    doc,
    'nav',
    { classe: 'navigation', attributs: { 'aria-label': 'Navigation principale' } },
    ...entrees.map(({ element }) => element),
  );
  racine.hidden = true;

  return {
    racine,

    afficher(etat) {
      const modele = modeleNavigation(etat);

      montrer(racine, modele.visible);

      for (const [index, entree] of modele.entrees.entries()) {
        const element = entrees[index]?.element;

        if (entree.actif) {
          element?.setAttribute('aria-current', 'page');
        } else {
          element?.removeAttribute('aria-current');
        }

        const monte = entrees[index];
        if (monte !== undefined) {
          montrer(monte.pastille, entree.pastille > 0);
          ecrireTexte(monte.pastille, pastilleEcrite(entree.pastille));
          nommer(monte.element, monte.libelle, entree.pastille);
        }
      }
    },

    demonter() {
      racine.remove();
    },
  };
}

/**
 * Le nom lu d'une entree: son libelle, et les demandes qui attendent s'il y en a.
 * « Amis, 2 demandes reçues ».
 */
function nommer(element: HTMLElement, libelle: string, pastille: number): void {
  const nom =
    pastille > 0
      ? `${libelle}, ${String(pastille)} demande${pastille > 1 ? 's' : ''} reçue${pastille > 1 ? 's' : ''}`
      : undefined;

  if (nom === undefined) {
    element.removeAttribute('aria-label');
  } else if (element.getAttribute('aria-label') !== nom) {
    element.setAttribute('aria-label', nom);
  }
}

/** Ce que la pastille ecrit: rien sans demande, « 9+ » au-dela de neuf. */
function pastilleEcrite(pastille: number): string {
  if (pastille <= 0) {
    return '';
  }

  return pastille > 9 ? '9+' : String(pastille);
}
