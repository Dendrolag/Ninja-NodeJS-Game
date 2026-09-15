/**
 * Le chat du salon.
 *
 * LE TEXTE D'UN MESSAGE EST POSE AVEC textContent, comme tout texte venu d'un
 * joueur. Le serveur signe chaque message avec la session qui parle (faille S3 du
 * legacy): le pseudo affiche est donc celui de l'auteur reel, jamais un nom choisi
 * par le client qui envoie.
 *
 * LE CLIENT REFLETE LA REGLE. Un message trop long est signale avant d'etre
 * envoye, avec le motif de validerMessageChat, la fonction meme du serveur. Un
 * message vide est simplement ignore, comme le prevoit la maquette. Un refus du
 * serveur, par exemple pour un debit excessif, s'affiche au meme endroit.
 */

import type { Refus } from '@neon-ninja/shared';
import { BORNES_CHAT, normaliserTexte, validerMessageChat } from '@neon-ninja/shared';

import type { Client } from '../../client.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { icone } from '../icones.js';
import type { MessageDuChat } from '../modeles/salon.js';

/** Un chat monte. */
export interface Chat {
  readonly racine: HTMLElement;
  /** Met les messages affiches en accord avec ceux recus, et montre un refus du serveur. */
  afficher(messages: readonly MessageDuChat[], refus: Refus | undefined): void;
  demonter(): void;
}

/**
 * Une identite de pure forme, pour verifier un message avant de l'envoyer.
 *
 * validerMessageChat signe le message avec la session; cote client, seule la
 * verification du texte nous interesse, et la signature est jetee.
 */
const SESSION_DE_VERIFICATION = { id: '', pseudo: '' };

/** Monte le chat. */
export function monterChat(doc: Document, client: Client): Chat {
  const liste = creer(doc, 'ol', { classe: 'chat-messages', attributs: { 'aria-live': 'polite' } });
  const saisie = creer(doc, 'input', {
    classe: 'champ-texte',
    attributs: {
      type: 'text',
      name: 'message',
      maxlength: String(BORNES_CHAT.longueur.maximum),
      placeholder: 'Écrire un message…',
      autocomplete: 'off',
      'aria-label': 'Message',
    },
  });
  const erreur = creer(doc, 'p', { classe: 'chat-erreur', attributs: { role: 'alert' } });
  erreur.hidden = true;

  const formulaire = creer(
    doc,
    'form',
    { classe: 'chat-formulaire' },
    saisie,
    bouton(doc, {
      classe: 'bouton-icone bouton-envoyer',
      icone: 'send',
      etiquette: 'Envoyer',
      type: 'submit',
    }),
  );

  const racine = creer(
    doc,
    'aside',
    { classe: 'chat panneau' },
    creer(
      doc,
      'header',
      { classe: 'chat-entete' },
      icone(doc, 'chat'),
      creer(doc, 'h2', { texte: 'Chat du salon' }),
    ),
    liste,
    formulaire,
    erreur,
  );

  /** Les elements deja affiches, retrouves par la cle de leur message. */
  const affiches = new Map<string, HTMLElement>();
  let derniersMessages: readonly MessageDuChat[] | undefined;
  /** Le refus deja vu au moment du dernier envoi, qui ne concerne plus le joueur. */
  let refusDepasse: Refus | undefined;
  let refusCourant: Refus | undefined;

  const signaler = (motif: string | undefined): void => {
    ecrireTexte(erreur, motif ?? '');
    montrer(erreur, motif !== undefined);
  };

  const surEnvoi = (evenement: Event): void => {
    evenement.preventDefault();
    const texte = saisie.value;

    if (normaliserTexte(texte) === '') {
      signaler(undefined);
      return;
    }

    const verdict = validerMessageChat(SESSION_DE_VERIFICATION, { texte });

    if (!verdict.valide) {
      signaler(verdict.erreurs[0]?.motif);
      return;
    }

    client.parler(verdict.valeur.texte);
    saisie.value = '';
    refusDepasse = refusCourant;
    signaler(undefined);
  };

  formulaire.addEventListener('submit', surEnvoi);

  return {
    racine,

    afficher(messages, refus) {
      refusCourant = refus;

      if (refus !== undefined && refus !== refusDepasse) {
        signaler(refus.erreurs.map((ligne) => ligne.motif).join(' '));
      }

      if (messages === derniersMessages) {
        return;
      }

      derniersMessages = messages;
      const presentes = new Set<string>();

      for (const message of messages) {
        presentes.add(message.cle);

        if (affiches.has(message.cle)) {
          continue;
        }

        const element = creer(
          doc,
          'li',
          { classe: message.moi ? 'chat-message moi' : 'chat-message' },
          creer(doc, 'span', { classe: 'chat-pseudo', texte: message.pseudo }),
          creer(doc, 'span', { classe: 'chat-texte', texte: message.texte }),
        );
        affiches.set(message.cle, element);
        liste.append(element);
      }

      // Le fil est borne a cent messages: les plus anciens sortent du magasin, ils
      // sortent aussi de la page.
      for (const [cle, element] of affiches) {
        if (!presentes.has(cle)) {
          element.remove();
          affiches.delete(cle);
        }
      }

      liste.scrollTop = liste.scrollHeight;
    },

    demonter() {
      formulaire.removeEventListener('submit', surEnvoi);
      affiches.clear();
      racine.remove();
    },
  };
}
