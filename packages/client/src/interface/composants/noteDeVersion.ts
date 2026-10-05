/**
 * La fenetre des nouveautes (etape 4.9), sur le modele de celle des credits.
 *
 * Elle s'ouvre d'elle-meme a l'accueil d'un joueur qui revient et n'a pas lu cette
 * version, et se rouvre par le numero du pied de l'accueil. Elle ne fait qu'afficher
 * des notes: le texte vit dans modeles/notesDeVersion.ts, et ce qu'on retient d'une
 * lecture dans souvenirDeVersion.ts.
 *
 * TOUT L'HISTORIQUE, LA DERNIERE NOTE EN TETE (decision du porteur du projet du 5
 * octobre 2026). La fenetre ne montrait que la note de la version servie: les
 * precedentes ne se relisaient plus. Les notes sont courtes, toutes tiennent dans un
 * defilement, et un joueur qui a manque deux versions lit d'un coup ce qu'il a rate.
 *
 * Le titre de la fenetre est lu par un lecteur d'ecran a l'ouverture; chaque note est
 * un titre de niveau trois, son numero puis son nom, et une liste.
 */

import { bouton, creer } from '../dom.js';
import type { NoteDeVersion, PuceDeNote } from '../modeles/notesDeVersion.js';
import type { Fenetre } from './fenetre.js';
import { monterFenetre } from './fenetre.js';

/** Le titre de la fenetre. */
export const TITRE_DES_NOUVEAUTES = 'Nouveautés';

/** Une ligne de la note: son intitule en gras, s'il y en a un, puis le texte. */
function ligne(doc: Document, puce: PuceDeNote): HTMLElement {
  return puce.intitule === undefined
    ? creer(doc, 'li', { texte: puce.texte })
    : creer(
        doc,
        'li',
        {},
        creer(doc, 'strong', { texte: puce.intitule }),
        doc.createTextNode(` ${puce.texte}`),
      );
}

/** Une note sous son titre, « 1.5 · Coups fourrés ». */
function section(doc: Document, note: NoteDeVersion): HTMLElement {
  return creer(
    doc,
    'section',
    { classe: 'note-section' },
    creer(doc, 'h3', { texte: `${note.version} · ${note.titre}` }),
    creer(doc, 'ul', { classe: 'note-liste' }, ...note.puces.map((puce) => ligne(doc, puce))),
  );
}

/**
 * Monte la fenetre des nouveautes, fermee.
 *
 * @param notes        Les notes a montrer, dans l'ordre ou elles s'affichent.
 * @param surFermeture Appele a chaque fermeture: c'est la que la note se retient lue.
 */
export function monterNouveautes(
  doc: Document,
  notes: readonly NoteDeVersion[],
  surFermeture?: () => void,
): Fenetre {
  const fenetre = monterFenetre({
    document: doc,
    titre: TITRE_DES_NOUVEAUTES,
    classe: 'fenetre-note',
    ...(surFermeture === undefined ? {} : { surFermeture }),
  });

  fenetre.corps.append(...notes.map((note) => section(doc, note)));

  fenetre.pied.append(
    bouton(doc, { classe: 'bouton bouton-primaire', texte: 'À l’attaque' }, () => {
      fenetre.fermer();
    }),
  );

  return fenetre;
}
