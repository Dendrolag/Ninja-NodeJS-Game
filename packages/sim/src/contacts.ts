/**
 * Qui touche qui, a la fin d'un battement.
 *
 * Portage de la partie entite contre entite de detectCollisions
 * (legacy/server.js:1671). Le legacy melait dans cette meme fonction trois
 * choses: constater un contact, en tirer les consequences (capturer, changer une
 * couleur), et ramasser les bonus et malus. Ici elles sont separees.
 *
 *   - detecterContacts constate. C'est de la geometrie, elle ne change rien.
 *   - resoudreContacts decide. C'est la regle du jeu, et elle change avec le
 *     mode: le mode Classique capture par simple proximite, le mode tactique
 *     prevu plus tard capturera par cone. Le point de branchement existe donc
 *     des maintenant, la ou le legacy melangeait tout.
 *   - Le ramassage des bonus et des malus n'est pas un contact entre entites:
 *     il arrive avec l'etape 1.4.
 *
 * Le legacy appelait detectCollisions sur la seule entite qui venait de bouger,
 * ce qui donnait un avantage a celle dont le message arrivait en dernier. Ici
 * tout le monde avance dans le meme battement, et les contacts sont donc des
 * paires sans vainqueur designe: c'est la resolution de l'etape 1.3 qui dira,
 * selon les regles du jeu et non selon l'ordre des messages, qui capture qui.
 */

import type { EtatPartie, IdentifiantEntite } from './etat.js';

/**
 * En dessous de cette distance, en pixels, deux entites se touchent. Valeur du
 * legacy (server.js:1679), comparee en inegalite stricte: a vingt pixels pile,
 * il n'y a pas contact.
 */
export const SEUIL_CONTACT_PX = 20;

/** Deux entites qui se touchent, et de combien elles sont proches. */
export interface Contact {
  readonly premier: IdentifiantEntite;
  readonly second: IdentifiantEntite;
  /** Distance entre les deux centres, en pixels. */
  readonly distance: number;
}

/**
 * Releve tous les contacts de la partie.
 *
 * Chaque paire n'apparait qu'une fois. L'ordre du releve suit celui des joueurs
 * dans l'etat, qui est celui de leur arrivee: a etat egal, la liste produite est
 * toujours la meme, ce qui est indispensable au rejeu d'une partie.
 *
 * Seuls les joueurs existent a ce stade du portage. Les bots et les bots noirs
 * entreront dans le meme releve a l'etape 1.5, sans changer sa forme.
 */
export function detecterContacts(etat: EtatPartie): readonly Contact[] {
  const entites = Object.values(etat.joueurs);
  const contacts: Contact[] = [];

  for (const [rang, unePart] of entites.entries()) {
    for (const autrePart of entites.slice(rang + 1)) {
      const distance = Math.hypot(
        unePart.position.x - autrePart.position.x,
        unePart.position.y - autrePart.position.y,
      );

      if (distance < SEUIL_CONTACT_PX) {
        contacts.push({ premier: unePart.id, second: autrePart.id, distance });
      }
    }
  }

  return contacts;
}

/**
 * Applique les consequences des contacts releves.
 *
 * C'est le point ou se branche la regle de resolution d'un mode de jeu. En
 * Classique, un contact entre deux joueurs devient une capture, et un contact
 * entre un joueur et un bot fait changer le bot de couleur.
 *
 * AUCUNE DE CES CONSEQUENCES N'EXISTE ENCORE: la capture et le score sont
 * l'etape 1.3, les bots l'etape 1.5. La fonction renvoie donc l'etat inchange.
 * Elle est la pour que le releve des contacts soit deja branche dans le
 * battement, et pour que l'etape 1.3 ait un seul endroit ou ecrire.
 */
export function resoudreContacts(etat: EtatPartie, _contacts: readonly Contact[]): EtatPartie {
  return etat;
}
