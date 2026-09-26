/**
 * La section « Inviter des amis » du salon (etape 2.8).
 *
 * Elle liste les amis en ligne qui ne sont pas deja dans la partie, avec leur presence
 * et un bouton Inviter. L'invitation part au serveur, qui la verifie et la transmet a
 * chaque page de l'ami; la ligne dit ensuite qu'elle est partie, ou pourquoi elle a
 * ete refusee. L'ami qui accepte arrive dans la liste des joueurs, comme tout arrivant.
 *
 * CE COMPOSANT NE DECIDE RIEN: la liste et ses mots viennent de modeles/presence.ts.
 * Un invite, qui n'a pas d'amis, ne voit pas la section.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { AmiAInviter } from '../modeles/presence.js';
import { modeleInvitationsDuSalon } from '../modeles/presence.js';

/** La section montee. */
export interface SectionInviterDesAmis {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
}

/** Monte la section, cachee tant qu'elle n'a rien a montrer. */
export function monterInviterDesAmis(doc: Document, client: Client): SectionInviterDesAmis {
  const liste = creer(doc, 'ul', { classe: 'salon-amis-liste' });
  const vide = creer(doc, 'p', { classe: 'salon-amis-vide' });
  const racine = creer(
    doc,
    'section',
    { classe: 'panneau salon-amis', attributs: { 'aria-label': 'Inviter des amis' } },
    creer(doc, 'h2', { texte: 'Inviter des amis' }),
    liste,
    vide,
  );
  racine.hidden = true;

  /** Les lignes deja dessinees, decrites: elles ne se refont que si elles ont change. */
  let dessinees = '';

  return {
    racine,

    afficher(etat) {
      const modele = modeleInvitationsDuSalon(etat);

      montrer(racine, modele !== undefined);

      if (modele === undefined) {
        return;
      }

      ecrireTexte(vide, modele.vide);
      montrer(vide, modele.amis.length === 0);
      montrer(liste, modele.amis.length > 0);

      const description = JSON.stringify(modele);

      if (description !== dessinees) {
        dessinees = description;
        liste.replaceChildren(
          ...modele.amis.map((ami) => ligneDAmi(doc, client, ami, modele.lienEtabli)),
        );
      }
    },
  };
}

/** Une ligne: l'avatar, le pseudo et sa presence, le bouton, et la note de l'invitation. */
function ligneDAmi(
  doc: Document,
  client: Client,
  ami: AmiAInviter,
  lienEtabli: boolean,
): HTMLElement {
  const inviter = bouton(
    doc,
    {
      classe: 'bouton bouton-secondaire bouton-compact',
      texte: ami.libelle,
      icone: 'send',
      etiquette: `${ami.libelle} ${ami.pseudo}`,
    },
    () => {
      client.inviter(ami.pseudo);
    },
  );
  inviter.disabled = ami.enCours || !lienEtabli;

  return creer(
    doc,
    'li',
    { classe: 'salon-ami' },
    creer(doc, 'span', {
      classe: 'avatar',
      texte: ami.initiales,
      attributs: { 'aria-hidden': 'true' },
    }),
    creer(
      doc,
      'div',
      { classe: 'salon-ami-identite' },
      creer(doc, 'span', { classe: 'salon-ami-pseudo', texte: ami.pseudo }),
      creer(doc, 'span', {
        classe: 'ligne-ami-presence',
        texte: ami.presence.texte,
        attributs: { 'data-presence': ami.presence.etat },
      }),
      ami.note === undefined
        ? undefined
        : creer(doc, 'span', {
            classe: ami.refusee ? 'salon-ami-note salon-ami-refus' : 'salon-ami-note',
            texte: ami.note,
            attributs: { role: ami.refusee ? 'alert' : 'status' },
          }),
    ),
    inviter,
  );
}
