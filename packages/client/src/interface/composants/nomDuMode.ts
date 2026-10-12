/**
 * Le nom d'un mode tel que le presentent les cartes des modes: a l'accueil, a la creation
 * d'une partie et dans l'aide. Un mode encore en essai porte la mention « Beta » (demande du
 * porteur du projet du 12 octobre 2026, pour Among Ninjas).
 */

import type { Mode } from '@neon-ninja/shared';

import { creer } from '../dom.js';
import { MODES_EN_BETA, NOMS_DES_MODES } from '../modeles/cartes.js';

/** Le titre d'une carte de mode, dans cette balise, avec sa mention « Beta » s'il en a une. */
export function nomDuMode(doc: Document, balise: 'h2' | 'h3' | 'strong', mode: Mode): HTMLElement {
  return creer(
    doc,
    balise,
    { texte: NOMS_DES_MODES[mode] },
    // Une espace avant la mention: le titre se lit « Among Ninjas Beta », comme la page statique.
    MODES_EN_BETA.includes(mode) ? doc.createTextNode(' ') : undefined,
    MODES_EN_BETA.includes(mode)
      ? creer(doc, 'span', {
          classe: 'mode-beta',
          texte: 'Beta',
          attributs: { title: 'Mode en essai' },
        })
      : undefined,
  );
}
