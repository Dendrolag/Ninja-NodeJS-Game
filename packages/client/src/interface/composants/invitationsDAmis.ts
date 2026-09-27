/**
 * Les cartes d'invitation d'un ami, au-dessus des ecrans de menu (etape 2.8).
 *
 * « Alice vous invite », la partie en une ligne, Rejoindre et Ignorer. Rejoindre entre
 * par le droit d'entree que le serveur tient, sans jamais montrer de code. Un refus
 * (partie complete, Chasse lancee, invitation expiree) s'affiche sur la carte. Ignorer
 * la retire de la page, sans rien dire a personne.
 *
 * CE COMPOSANT NE DECIDE RIEN: quelles cartes, et quand, vient de modeles/presence.ts.
 * Il n'en montre aucune pendant une partie: elles attendent le retour aux menus.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, montrer } from '../dom.js';
import type { CarteDInvitation } from '../modeles/presence.js';
import { cartesDInvitation } from '../modeles/presence.js';

/** Les cartes d'invitation, montees. */
export interface InvitationsDAmis {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Monte la region des cartes d'invitation, vide et cachee tant qu'il n'y en a pas. */
export function monterInvitationsDAmis(doc: Document, client: Client): InvitationsDAmis {
  const racine = creer(doc, 'section', {
    classe: 'invitations-d-amis',
    attributs: { 'aria-label': 'Invitations de vos amis', 'aria-live': 'polite' },
  });
  racine.hidden = true;

  /** Les cartes deja dessinees, decrites: elles ne se refont que si elles ont change. */
  let dessinees = '';

  return {
    racine,

    afficher(etat) {
      const cartes = cartesDInvitation(etat);
      const description = JSON.stringify(cartes);

      montrer(racine, cartes.length > 0);

      if (description === dessinees) {
        return;
      }

      dessinees = description;
      racine.replaceChildren(...cartes.map((carte) => carteDInvitation(doc, client, carte)));
    },

    demonter() {
      racine.remove();
    },
  };
}

/** Une carte: qui invite, la partie, les deux gestes, et le refus s'il y en a un. */
function carteDInvitation(doc: Document, client: Client, carte: CarteDInvitation): HTMLElement {
  const rejoindre = bouton(
    doc,
    { classe: 'bouton bouton-primaire', texte: 'Rejoindre', icone: 'play' },
    () => {
      client.rejoindre(undefined, { invitation: carte.id });
    },
  );
  rejoindre.disabled = !carte.peutRejoindre;

  const erreur = creer(doc, 'p', {
    classe: 'invitation-erreur',
    texte: carte.erreur ?? '',
    attributs: { role: 'alert' },
  });
  erreur.hidden = carte.erreur === undefined;

  return creer(
    doc,
    'article',
    { classe: 'panneau invitation-d-ami', attributs: { 'data-invitation': carte.id } },
    creer(
      doc,
      'div',
      { classe: 'invitation-texte' },
      creer(doc, 'p', { classe: 'invitation-titre', texte: carte.titre }),
      creer(doc, 'p', { classe: 'invitation-detail', texte: carte.detail }),
      erreur,
    ),
    creer(
      doc,
      'div',
      { classe: 'invitation-gestes' },
      rejoindre,
      bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Ignorer' }, () => {
        client.ignorerLInvitationDAmi(carte.id);
      }),
    ),
  );
}
