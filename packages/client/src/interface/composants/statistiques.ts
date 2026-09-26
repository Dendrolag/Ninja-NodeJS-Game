/**
 * Les statistiques d'un joueur, dessinees: des tuiles, et un tableau par mode
 * (etape 3.5). Le profil et la fiche les dessinent de la meme facon, a partir du meme
 * modele (modeles/statistiques.ts).
 */

import { creer } from '../dom.js';
import type { LigneDUnMode, StatistiqueAffichee } from '../modeles/statistiques.js';

/** Les colonnes du tableau par mode. */
const COLONNES = ['Mode', 'Parties', 'Victoires', 'Meilleur score', 'Seul'] as const;

/** Une tuile par statistique: la valeur en grand, son libelle, et sa precision s'il y en a une. */
export function tuilesDeStatistiques(
  doc: Document,
  tuiles: readonly StatistiqueAffichee[],
): HTMLElement[] {
  return tuiles.map((tuile) =>
    creer(
      doc,
      'li',
      { classe: 'panneau statistique' },
      creer(doc, 'strong', { texte: tuile.valeur }),
      creer(doc, 'span', { texte: tuile.libelle }),
      tuile.detail === undefined
        ? undefined
        : creer(doc, 'span', { classe: 'statistique-detail', texte: tuile.detail }),
    ),
  );
}

/**
 * Le tableau par mode, qui defile sur un ecran etroit plutot que de faire deborder la
 * page. La colonne « Seul » est le meilleur score d'une partie jouee seul.
 */
export function tableauParMode(doc: Document, lignes: readonly LigneDUnMode[]): HTMLElement {
  return creer(
    doc,
    'div',
    { classe: 'tableau-defilant' },
    creer(
      doc,
      'table',
      { classe: 'tableau tableau-par-mode' },
      creer(
        doc,
        'thead',
        {},
        creer(
          doc,
          'tr',
          {},
          ...COLONNES.map((colonne) =>
            creer(doc, 'th', { texte: colonne, attributs: { scope: 'col' } }),
          ),
        ),
      ),
      creer(
        doc,
        'tbody',
        {},
        ...lignes.map((ligne) =>
          creer(
            doc,
            'tr',
            {},
            creer(doc, 'th', { texte: ligne.mode, attributs: { scope: 'row' } }),
            creer(doc, 'td', { classe: 'nombre', texte: ligne.parties }),
            creer(doc, 'td', { classe: 'nombre', texte: ligne.victoires }),
            creer(doc, 'td', { classe: 'nombre', texte: ligne.meilleurScore }),
            creer(doc, 'td', { classe: 'nombre', texte: ligne.meilleurScoreSeul }),
          ),
        ),
      ),
    ),
  );
}
