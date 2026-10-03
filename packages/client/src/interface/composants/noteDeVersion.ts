/**
 * La fenetre de la note de version (etape 4.9), sur le modele de celle des credits.
 *
 * Elle s'ouvre d'elle-meme a l'accueil d'un joueur qui revient et n'a pas lu cette
 * version, et se rouvre par le numero du pied de l'accueil. Elle ne fait qu'afficher
 * une note: le texte vit dans modeles/notesDeVersion.ts, et ce qu'on retient d'une
 * lecture dans souvenirDeVersion.ts.
 *
 * Le titre de la fenetre est celui de la note, lu par un lecteur d'ecran a
 * l'ouverture; chaque section est un titre de niveau trois et une liste.
 */

import { bouton, creer } from '../dom.js';
import type { NoteDeVersion, PuceDeNote } from '../modeles/notesDeVersion.js';
import type { Fenetre } from './fenetre.js';
import { monterFenetre } from './fenetre.js';

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

/**
 * Monte la fenetre d'une note, fermee.
 *
 * @param surFermeture Appele a chaque fermeture: c'est la que la note se retient lue.
 */
export function monterNoteDeVersion(
  doc: Document,
  note: NoteDeVersion,
  surFermeture?: () => void,
): Fenetre {
  const fenetre = monterFenetre({
    document: doc,
    titre: note.titre,
    classe: 'fenetre-note',
    ...(surFermeture === undefined ? {} : { surFermeture }),
  });

  fenetre.corps.append(
    ...note.sections.map((section) =>
      creer(
        doc,
        'section',
        { classe: 'note-section' },
        creer(doc, 'h3', { texte: section.titre }),
        creer(
          doc,
          'ul',
          { classe: 'note-liste' },
          ...section.puces.map((puce) => ligne(doc, puce)),
        ),
      ),
    ),
  );

  fenetre.pied.append(
    bouton(doc, { classe: 'bouton bouton-primaire', texte: 'Compris' }, () => {
      fenetre.fermer();
    }),
  );

  return fenetre;
}
