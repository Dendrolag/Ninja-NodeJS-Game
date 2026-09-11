/**
 * Le champ du pseudo d'un invite, commun a l'accueil, a la liste des parties et a
 * la creation.
 *
 * LE PSEUDO VIT DANS L'ETAT, PAS DANS LE CHAMP (reprise des ecrans du jalon 3).
 * Chaque saisie est retenue par le client (pseudoSaisi); chaque ecran qui monte ce
 * champ le remplit a partir de l'etat. Le joueur choisit donc son pseudo une fois,
 * et le retrouve en passant de l'accueil a la liste des parties ou a la creation.
 *
 * CE COMPOSANT NE DECIDE RIEN: ni s'il est montre (un compte n'a pas de pseudo a
 * choisir), ni ce qui cloche dans le pseudo. Les ecrans le lui disent.
 */

import { BORNES_PSEUDO } from '@neon-ninja/shared';

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { creer, montrer } from '../dom.js';

/** Le champ du pseudo, monte. */
export interface ChampPseudo {
  /** L'etiquette et sa saisie, a placer dans l'ecran. */
  readonly racine: HTMLLabelElement;
  readonly saisie: HTMLInputElement;
  /** Remplit le champ a partir de l'etat, et le montre ou le cache. */
  afficher(etat: EtatClient, visible: boolean, erreur: string | undefined): void;
  demonter(): void;
}

/** Monte le champ du pseudo d'un invite. */
export function monterChampPseudo(doc: Document, client: Client): ChampPseudo {
  const saisie = creer(doc, 'input', {
    classe: 'champ-texte',
    attributs: {
      type: 'text',
      name: 'pseudo',
      maxlength: String(BORNES_PSEUDO.longueur.maximum),
      autocomplete: 'nickname',
      spellcheck: 'false',
      placeholder: 'Votre pseudo',
    },
  });

  const racine = creer(
    doc,
    'label',
    { classe: 'champ-pseudo' },
    creer(doc, 'span', { classe: 'etiquette', texte: 'Pseudo' }),
    saisie,
  );

  const surSaisie = (): void => {
    client.saisirPseudo(saisie.value);
  };

  saisie.addEventListener('input', surSaisie);

  return {
    racine,
    saisie,

    afficher(etat, visible, erreur) {
      montrer(racine, visible);
      saisie.toggleAttribute('aria-invalid', erreur !== undefined);

      // Ecrire la meme valeur deplacerait le curseur au bout du champ, au milieu
      // d'une correction.
      if (saisie.value !== etat.pseudoSaisi) {
        saisie.value = etat.pseudoSaisi;
      }
    },

    demonter() {
      saisie.removeEventListener('input', surSaisie);
      racine.remove();
    },
  };
}
