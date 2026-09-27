/**
 * Les succes, dessines (etape 3.7): la liste de ceux qu'on a obtenus, pour la fiche et
 * la fin de partie, et les paliers du profil, obtenus ou non.
 *
 * Tout est texte, pose par creer: un nom de succes ne vient que du paquet partage, mais
 * rien ici ne s'ecrit en HTML.
 */

import { creer } from '../dom.js';
import { icone } from '../icones.js';
import type {
  PalierAffiche,
  SuccesAffiche,
  SuccesDeFicheAffiche,
  SuccesObtenuAffiche,
} from '../modeles/succes.js';

/**
 * Des succes obtenus, un par ligne: le trophee, le nom, la description, et la rarete
 * quand elle est connue (sur la fiche).
 */
export function listeDeSuccesObtenus(
  doc: Document,
  succes: readonly (SuccesObtenuAffiche | SuccesDeFicheAffiche)[],
): HTMLElement {
  return creer(
    doc,
    'ul',
    { classe: 'succes-liste' },
    ...succes.map((un) =>
      creer(
        doc,
        'li',
        { classe: 'succes succes-obtenu', attributs: { 'data-palier': un.palier } },
        creer(doc, 'span', { classe: 'succes-icone' }, icone(doc, 'trophy', 18)),
        creer(
          doc,
          'div',
          { classe: 'succes-texte' },
          creer(doc, 'strong', { classe: 'succes-nom', texte: un.nom }),
          creer(doc, 'span', { classe: 'succes-palier', texte: un.nomDuPalier }),
          creer(doc, 'span', { classe: 'succes-description', texte: un.description }),
          'rarete' in un
            ? creer(doc, 'span', { classe: 'succes-rarete', texte: `Obtenu par ${un.rarete}` })
            : undefined,
        ),
      ),
    ),
  );
}

/** Les paliers du profil, chacun avec ses succes. */
export function paliersDeSucces(doc: Document, paliers: readonly PalierAffiche[]): HTMLElement[] {
  return paliers.map((palier) =>
    creer(
      doc,
      'section',
      { classe: 'succes-palier-bloc', attributs: { 'data-palier': palier.palier } },
      creer(
        doc,
        'h3',
        {},
        creer(doc, 'span', { texte: palier.nom }),
        creer(doc, 'span', { classe: 'succes-compte', texte: palier.compte }),
      ),
      creer(
        doc,
        'ul',
        { classe: 'succes-grille' },
        ...palier.succes.map((succes) => carteDeSucces(doc, succes)),
      ),
    ),
  );
}

/** Un succes du profil: obtenu en couleur avec sa date, sinon grise avec sa progression. */
function carteDeSucces(doc: Document, succes: SuccesAffiche): HTMLElement {
  return creer(
    doc,
    'li',
    {
      classe: `panneau succes ${succes.obtenu ? 'succes-obtenu' : 'succes-verrouille'}`,
      attributs: { 'data-palier': succes.palier },
    },
    creer(
      doc,
      'span',
      { classe: 'succes-icone' },
      icone(doc, succes.obtenu ? 'trophy' : 'cadenas', 18),
    ),
    creer(
      doc,
      'div',
      { classe: 'succes-texte' },
      creer(doc, 'strong', { classe: 'succes-nom', texte: succes.nom }),
      succes.description === undefined
        ? undefined
        : creer(doc, 'span', { classe: 'succes-description', texte: succes.description }),
      succes.date === undefined
        ? undefined
        : creer(doc, 'span', { classe: 'succes-date', texte: succes.date }),
      succes.progression === undefined
        ? undefined
        : creer(
            doc,
            'span',
            { classe: 'succes-progression' },
            jauge(doc, succes.progression.pourCent),
            creer(doc, 'span', { texte: succes.progression.texte }),
          ),
      succes.rarete === undefined
        ? undefined
        : creer(doc, 'span', { classe: 'succes-rarete', texte: `Obtenu par ${succes.rarete}` }),
    ),
  );
}

/** Une jauge, que le lecteur d'ecran ignore: le texte qui la suit dit la meme chose. */
function jauge(doc: Document, pourCent: number): HTMLElement {
  const remplie = creer(doc, 'span', { classe: 'barre-remplie' });
  remplie.style.setProperty('--remplissage', `${String(pourCent)}%`);

  return creer(doc, 'span', { classe: 'barre', attributs: { 'aria-hidden': 'true' } }, remplie);
}
