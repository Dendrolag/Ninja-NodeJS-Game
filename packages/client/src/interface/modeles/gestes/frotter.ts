/**
 * Frotter jusqu'a effacer (etape 7.21): ce qu'ont en commun les lunettes et le sang. Chaque
 * zone a frotter part sale et s'efface sous le chiffon ou l'eponge: au pointeur, en frottant
 * dedans; au clavier, les fleches choisissent la zone et Espace, tenu, la frotte.
 *
 * UNE ZONE S'EFFACE AU PLUS VITE EN `msParZone`, si fort qu'on frotte: c'est ce qui regle le
 * geste sur la duree minimale du serveur. Au pointeur, il faut aussi avoir frotte une certaine
 * distance (DISTANCE_PAR_ZONE): tenir le doigt immobile n'efface rien.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste, PointDuGeste } from './commun.js';
import { distance } from './commun.js';

/** Une zone a frotter: un disque de l'espace du geste. */
export interface ZoneAFrotter extends PointDuGeste {
  readonly rayon: number;
}

/** La distance a frotter au pointeur pour effacer une zone, en unites. */
const DISTANCE_PAR_ZONE = 500;

/** En dessous, une zone est propre. */
const PROPRE = 0.02;

/** Ou en est le frottement. */
export interface EtatFrotte extends BaseDeGeste {
  readonly zones: readonly ZoneAFrotter[];
  /** Ce qu'il reste a effacer de chaque zone, de un (sale) a zero (propre). */
  readonly sale: readonly number[];
  /** La zone que le clavier frotte. */
  readonly choisie: number;
  /** Le pointeur pose: sa derniere place et son dernier instant. */
  readonly pointeur?: PointDuGeste & { readonly instant: number };
  /** Espace tenue depuis cet instant, au dernier compte. */
  readonly espaceDepuis?: number;
}

/** Des zones toutes sales, la premiere choisie. */
export function zonesSales(zones: readonly ZoneAFrotter[]): Omit<EtatFrotte, 'echos'> {
  return { zones, sale: zones.map(() => 1), choisie: 0 };
}

/** La premiere zone encore sale a partir de celle-ci, dans l'ordre, ou celle-ci. */
function prochaineSale(sale: readonly number[], depart: number): number {
  for (let pas = 0; pas < sale.length; pas += 1) {
    const rang = (depart + pas) % sale.length;

    if ((sale[rang] ?? 0) > 0) {
      return rang;
    }
  }

  return depart;
}

/** Efface cette part d'une zone; une zone presque propre l'est. */
function effacer<E extends EtatFrotte>(etat: E, rang: number, part: number): E {
  const reste = Math.max((etat.sale[rang] ?? 0) - part, 0);
  const sale = etat.sale.map((avant, autre) =>
    autre === rang ? (reste < PROPRE ? 0 : reste) : avant,
  );

  return {
    ...etat,
    sale,
    choisie: (sale[rang] ?? 0) > 0 ? etat.choisie : prochaineSale(sale, rang),
  };
}

/** Le rang de la zone qui contient ce point, ou -1. */
function zoneSous(etat: EtatFrotte, point: PointDuGeste): number {
  return etat.zones.findIndex((zone) => distance(zone, point) <= zone.rayon);
}

/** Le frottement apres une commande, chaque zone s'effacant au plus vite en msParZone. */
export function appliquerFrotte<E extends EtatFrotte>(
  etat: E,
  commande: CommandeDeGeste,
  maintenant: number,
  msParZone: number,
): E {
  if (commande.type === 'temps') {
    return frotterAuClavier(etat, maintenant, msParZone);
  }

  if (commande.type === 'touche') {
    return toucher(frotterAuClavier(etat, maintenant, msParZone), commande, maintenant);
  }

  const { pointeur: _leve, ...sansPointeur } = etat;
  const ici = { x: commande.x, y: commande.y, instant: maintenant };

  switch (commande.phase) {
    case 'bas':
      return { ...etat, pointeur: ici };

    case 'deplace': {
      if (etat.pointeur === undefined) {
        return etat;
      }

      const rang = zoneSous(etat, commande);
      const avance = { ...etat, pointeur: ici };

      if (rang < 0 || (etat.sale[rang] ?? 0) === 0) {
        return avance;
      }

      const part = Math.min(
        distance(etat.pointeur, commande) / DISTANCE_PAR_ZONE,
        Math.max(maintenant - etat.pointeur.instant, 0) / msParZone,
      );

      return effacer(avance, rang, part);
    }

    case 'haut':
      return sansPointeur as E;
  }
}

/** Espace tenue frotte la zone choisie, du temps passe depuis le dernier compte. */
function frotterAuClavier<E extends EtatFrotte>(etat: E, maintenant: number, msParZone: number): E {
  if (etat.espaceDepuis === undefined) {
    return etat;
  }

  const part = Math.max(maintenant - etat.espaceDepuis, 0) / msParZone;

  return { ...effacer(etat, etat.choisie, part), espaceDepuis: maintenant };
}

/** Une touche: les fleches changent de zone, Espace frotte tant qu'elle est tenue. */
function toucher<E extends EtatFrotte>(
  etat: E,
  commande: Extract<CommandeDeGeste, { type: 'touche' }>,
  maintenant: number,
): E {
  if (commande.touche === 'espace') {
    if (commande.enfoncee) {
      return etat.espaceDepuis === undefined ? { ...etat, espaceDepuis: maintenant } : etat;
    }

    const { espaceDepuis: _relachee, ...sansEspace } = etat;

    return sansEspace as E;
  }

  if (!commande.enfoncee) {
    return etat;
  }

  const sens = commande.touche === 'gauche' || commande.touche === 'haut' ? -1 : 1;
  const nombre = etat.zones.length;

  return { ...etat, choisie: (etat.choisie + sens + nombre) % nombre };
}

/** Toutes les zones sont-elles propres. */
export function frotteFini(etat: EtatFrotte): boolean {
  return etat.sale.every((reste) => reste === 0);
}

/** Les zones propres. */
export function avancementDuFrotte(etat: EtatFrotte): AvancementDuGeste {
  return { faits: etat.sale.filter((reste) => reste === 0).length, total: etat.zones.length };
}
