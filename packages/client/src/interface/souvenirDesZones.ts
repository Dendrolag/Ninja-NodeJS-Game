/**
 * Le souvenir des zones deja expliquees (9 octobre 2026), dans le navigateur: combien de fois
 * l'effet de chaque nature de zone a deja ete dit au joueur, pour ne plus le dire passe la
 * troisieme (zonesExpliquees.ts).
 *
 * IL NE VOYAGE PAS AVEC LE COMPTE, comme le souvenir des notes de version: un joueur qui
 * change de navigateur relit trois fois chaque effet, sans dommage.
 *
 * LE STOCKAGE PEUT MANQUER (navigation privee, donnees de site refusees). Le souvenir vit
 * alors en memoire, le temps de la page: les effets se reexpliquent a la visite suivante.
 * Toute lecture ou ecriture est protegee.
 */

import type { TypeZone } from '@neon-ninja/shared';
import { TYPES_ZONE } from '@neon-ninja/shared';

/** La cle sous laquelle les comptes sont ranges. */
export const CLE_ZONES_EXPLIQUEES = 'neon-ninja.zones-expliquees';

/** Ce que le guide des zones demande au souvenir. */
export interface SouvenirDesZones {
  /** Combien de fois l'effet de cette nature de zone a deja ete explique. */
  explications(type: TypeZone): number;
  /** Retient qu'il vient de l'etre une fois de plus. */
  retenirUneExplication(type: TypeZone): void;
}

/** Le souvenir des zones, range dans ce stockage s'il y en a un, en memoire sinon. */
export function creerSouvenirDesZones(stockage?: Storage): SouvenirDesZones {
  const comptes = lire(stockage);

  return {
    explications: (type) => comptes[type],
    retenirUneExplication(type) {
      comptes[type] += 1;

      try {
        stockage?.setItem(CLE_ZONES_EXPLIQUEES, JSON.stringify(comptes));
      } catch {
        // Un stockage plein ou refuse: le souvenir reste en memoire.
      }
    },
  };
}

/** Les comptes ranges, ou zero partout. Une valeur abimee compte pour zero. */
function lire(stockage: Storage | undefined): Record<TypeZone, number> {
  const comptes = Object.fromEntries(TYPES_ZONE.map((type) => [type, 0])) as Record<
    TypeZone,
    number
  >;

  try {
    const brut: unknown = JSON.parse(stockage?.getItem(CLE_ZONES_EXPLIQUEES) ?? '{}');

    if (typeof brut === 'object' && brut !== null) {
      for (const type of TYPES_ZONE) {
        const valeur = (brut as Record<string, unknown>)[type];

        if (typeof valeur === 'number' && Number.isInteger(valeur) && valeur > 0) {
          comptes[type] = valeur;
        }
      }
    }
  } catch {
    // Rien de lisible: tout recommence a zero.
  }

  return comptes;
}
