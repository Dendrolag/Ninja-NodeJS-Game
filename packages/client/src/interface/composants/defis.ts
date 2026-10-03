/**
 * Les defis de la semaine, dessines (etape 3.10): une ligne par defi, avec son icone de
 * famille, son texte, sa recompense et sa jauge. L'accueil et la fin de partie s'en
 * servent.
 *
 * Tout est texte, pose par creer: le texte d'un defi ne vient que du paquet partage, mais
 * rien ici ne s'ecrit en HTML.
 */

import { creer } from '../dom.js';
import { icone } from '../icones.js';
import type { DefiAffiche, DefiReleveAffiche } from '../modeles/defis.js';

/** Les defis de la semaine, un par ligne. */
export function listeDeDefis(doc: Document, defis: readonly DefiAffiche[]): HTMLElement {
  return creer(
    doc,
    'ul',
    { classe: 'defis-liste' },
    ...defis.map((defi) => {
      const remplissage = creer(doc, 'span', { classe: 'barre-remplie' });
      remplissage.style.setProperty('--remplissage', `${String(defi.pourCent)}%`);

      return creer(
        doc,
        'li',
        {
          classe: 'defi',
          attributs: { 'data-famille': defi.famille, 'data-accompli': String(defi.accompli) },
        },
        creer(
          doc,
          'span',
          { classe: 'defi-icone', attributs: { title: defi.nomDeFamille } },
          icone(doc, defi.accompli ? 'check' : defi.icone, 16),
        ),
        creer(
          doc,
          'div',
          { classe: 'defi-corps' },
          creer(
            doc,
            'div',
            { classe: 'defi-ligne' },
            creer(doc, 'span', { classe: 'defi-texte', texte: defi.texte }),
            creer(doc, 'span', { classe: 'defi-xp', texte: defi.xp }),
          ),
          creer(
            doc,
            'div',
            { classe: 'defi-ligne' },
            creer(
              doc,
              'span',
              {
                classe: 'barre defi-barre',
                attributs: {
                  role: 'progressbar',
                  'aria-label': defi.texte,
                  'aria-valuemin': '0',
                  'aria-valuemax': '100',
                  'aria-valuenow': String(defi.pourCent),
                },
              },
              remplissage,
            ),
            creer(doc, 'span', { classe: 'defi-avancee', texte: defi.avancee }),
          ),
        ),
      );
    }),
  );
}

/** Les defis qu'une partie vient de relever, un par ligne, avec leur XP. */
export function listeDeDefisReleves(
  doc: Document,
  releves: readonly DefiReleveAffiche[],
): HTMLElement {
  return creer(
    doc,
    'ul',
    { classe: 'defis-releves' },
    ...releves.map((releve) =>
      creer(
        doc,
        'li',
        { classe: 'defi-releve' },
        icone(doc, 'check', 20),
        creer(doc, 'span', { classe: 'defi-releve-texte', texte: releve.texte }),
        creer(doc, 'strong', { classe: 'defi-releve-xp', texte: releve.xp }),
      ),
    ),
  );
}
