/**
 * Purger la console (etape 7.27), la premiere moitie des deux cles de la surchauffe. La pression
 * monte sans cesse; un coup de vanne, quand elle est dans la bande, la fait retomber. Trois coups
 * au bon moment la ramenent dans le vert. Un coup hors de la bande ne fait rien; la pression au
 * plein fait sauter la soupape, et la pression repart du depart, les coups deja donnes gardes.
 * Au pointeur, on touche la vanne; au clavier, Espace.
 *
 * LE RYTHME. La pression part de 0,55 et monte de 0,4 par seconde; la bande commence a 0,8, et
 * chaque coup la fait retomber de 0,3: 2,1 secondes au plus vite, puis le dernier coup se joue,
 * au-dessus des 2 secondes du serveur.
 */

import type { AvancementDuGeste } from './commun.js';
import type { BaseDeReparation, CommandeDeReparation } from './communDesReparations.js';
import { avecEchoDeReparation } from './communDesReparations.js';

/** La pression au depart, et apres une soupape sautee. */
export const PRESSION_DE_DEPART = 0.55;

/** Ce que la pression monte par seconde. */
export const MONTEE_DE_LA_PRESSION = 0.4;

/** La bande ou donner un coup de vanne. */
export const BANDE_DE_LA_VANNE = { bas: 0.8, haut: 0.95 } as const;

/** Ce que la pression retombe a chaque coup de vanne. */
export const CHUTE_D_UN_COUP = 0.3;

/** Le nombre de coups de vanne. */
export const COUPS_DE_VANNE = 3;

/** Ce que dure un coup de vanne. */
export const COUP_MS = 250;

/** Ou en est la purge. */
export interface EtatPurge extends BaseDeReparation {
  readonly nature: 'purge';
  /** La pression au dernier changement, et son instant: elle monte depuis. */
  readonly base: number;
  readonly baseA?: number;
  /** Les coups de vanne donnes. */
  readonly coups: number;
  /** La fin du dernier coup. */
  readonly finDuCoup: number;
}

/** Une console sous pression. */
export function creerPurge(): EtatPurge {
  return { nature: 'purge', base: PRESSION_DE_DEPART, coups: 0, finDuCoup: 0, echos: [] };
}

/** La pression a cet instant. Elle ne monte plus une fois la purge faite. */
export function pressionDeLaPurge(etat: EtatPurge, maintenant: number): number {
  if (etat.baseA === undefined || etat.coups >= COUPS_DE_VANNE) {
    return etat.base;
  }

  return etat.base + (MONTEE_DE_LA_PRESSION * Math.max(maintenant - etat.baseA, 0)) / 1000;
}

/** Un coup de vanne: dans la bande, la pression retombe; ailleurs, il ne fait rien. */
function frapper(etat: EtatPurge, maintenant: number): EtatPurge {
  if (etat.coups >= COUPS_DE_VANNE || etat.baseA === undefined) {
    return etat;
  }

  const pression = pressionDeLaPurge(etat, maintenant);

  if (pression < BANDE_DE_LA_VANNE.bas || pression > BANDE_DE_LA_VANNE.haut) {
    return avecEchoDeReparation(etat, 'ratee');
  }

  return avecEchoDeReparation(
    {
      ...etat,
      base: pression - CHUTE_D_UN_COUP,
      baseA: maintenant,
      coups: etat.coups + 1,
      finDuCoup: maintenant + COUP_MS,
    },
    'vanne',
  );
}

/** La purge apres une commande. Le premier instant connu fait partir la pression. */
export function appliquerPurge(
  etat: EtatPurge,
  commande: CommandeDeReparation,
  maintenant: number,
): EtatPurge {
  const partie = etat.baseA === undefined ? { ...etat, baseA: maintenant } : etat;

  switch (commande.type) {
    case 'temps':
      // Au plein, la soupape saute, et la pression repart du depart.
      return pressionDeLaPurge(partie, maintenant) >= 1
        ? avecEchoDeReparation({ ...partie, base: PRESSION_DE_DEPART, baseA: maintenant }, 'ratee')
        : partie;

    case 'molette':
      return partie;

    case 'touche':
      return commande.enfoncee && commande.touche === 'espace'
        ? frapper(partie, maintenant)
        : partie;

    case 'pointeur':
      return commande.phase === 'bas' ? frapper(partie, maintenant) : partie;
  }
}

/** La purge est-elle finie: trois coups, le dernier joue. */
export function purgeFinie(etat: EtatPurge, maintenant: number): boolean {
  return etat.coups >= COUPS_DE_VANNE && maintenant >= etat.finDuCoup;
}

/** Les coups de vanne donnes. */
export function avancementDeLaPurge(etat: EtatPurge): AvancementDuGeste {
  return { faits: etat.coups, total: COUPS_DE_VANNE };
}
