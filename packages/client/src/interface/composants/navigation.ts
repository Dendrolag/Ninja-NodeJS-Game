/**
 * La navigation laterale: Jouer, Parties, Creer, Profil.
 *
 * CE COMPOSANT NE DECIDE RIEN. Ce qu'il montre, et quand, vient de
 * modeleNavigation; un clic demande au client d'aller vers l'ecran, et c'est le
 * client qui decide s'il y va (un invite qui demande le profil est mene a la
 * connexion). En fenetre etroite, la feuille de style la replie en barre, en bas de
 * l'ecran (decision du 29 juin 2026).
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, montrer } from '../dom.js';
import type { Glyphe } from '../icones.js';
import type { DestinationDeNavigation } from '../modeles/navigation.js';
import { DESTINATIONS, modeleNavigation } from '../modeles/navigation.js';

/** Le pictogramme de chaque destination, ceux de la maquette. */
const GLYPHES: Readonly<Record<DestinationDeNavigation, Glyphe>> = {
  accueil: 'play',
  parties: 'globe',
  creation: 'plus',
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
  const entrees = DESTINATIONS.map(({ vers, libelle }) => ({
    vers,
    element: bouton(
      doc,
      { classe: 'navigation-entree', texte: libelle, icone: GLYPHES[vers] },
      () => {
        client.naviguer(vers);
      },
    ),
  }));

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
      }
    },

    demonter() {
      racine.remove();
    },
  };
}
