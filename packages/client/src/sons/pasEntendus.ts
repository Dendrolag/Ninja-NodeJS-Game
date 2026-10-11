/**
 * Les pas des autres, dans Among Ninjas (etape 7.23): ou on les entend, et quand.
 *
 * FONCTIONS PURES, TESTABLES SANS HAUT-PARLEUR, comme espace.ts. Les jouer est le travail
 * de lecteur.ts.
 *
 * DEUX SORTES DE PAS.
 *
 *   - Ceux qu'on n'entend que: le serveur les envoie dans le bloc du mode, en direction
 *     arrondie et en palier (AmongVu.pas), sans position ni marcheur. Ils se placent au milieu
 *     de leur secteur et de leur palier (ecartDUnPas), une fois par trame.
 *   - Ceux qu'on voit: un vivant affiche qui marche fait ses pas a sa place exacte, a la cadence
 *     de nos propres pas. Le mouvement est celui du lissage, comme pour les notres: un joueur
 *     bloque contre un mur ne fait pas de bruit. Les PNJ et les fantomes sont muets.
 *
 * Le volume baisse avec la distance jusqu'a la portee des pas, et un pas d'autrui s'entend
 * toujours moins fort que les notres. Le cote suit la direction seule, pas la distance: un pas
 * a l'est s'entend a droite, de pres comme de loin.
 */

import type { PasEntendu, Position } from '@neon-ninja/shared';
import { AMONG, ecartDUnPas } from '@neon-ninja/shared';

import type { PlaceDuSon } from './espace.js';
import { OREILLE } from './espace.js';

/**
 * Les reglages de l'oreille pour les pas d'autrui, en part du volume des effets.
 *
 *   - procheePx: le plus fort jusque-la, deux ninjas et demi.
 *   - volumeProche: ce plus fort, la moitie de nos propres pas, qu'on ne confonde pas les siens.
 *   - volumeALaPortee: le plus faible, a la portee des pas: un pas lointain s'entend encore.
 */
export const OREILLE_DES_PAS = {
  procheePx: 100,
  volumeProche: 0.5,
  volumeALaPortee: 0.1,
} as const;

/** L'intervalle entre deux pas d'un meme marcheur qu'on voit: la cadence des notres. */
export const INTERVALLE_DES_PAS_VUS_MS = 250;

/**
 * Comment s'entend un pas fait a cet ecart de nous (de nous vers lui). Silence au-dela de la
 * portee des pas.
 */
export function placeDUnPas(ecart: Position): PlaceDuSon {
  const distance = Math.hypot(ecart.x, ecart.y);

  if (distance > AMONG.PORTEE_DES_PAS_PX) {
    return { volume: 0, cote: 0 };
  }

  const part = Math.min(
    Math.max(
      (distance - OREILLE_DES_PAS.procheePx) /
        (AMONG.PORTEE_DES_PAS_PX - OREILLE_DES_PAS.procheePx),
      0,
    ),
    1,
  );
  const volume =
    OREILLE_DES_PAS.volumeProche -
    part * (OREILLE_DES_PAS.volumeProche - OREILLE_DES_PAS.volumeALaPortee);
  const cote = distance === 0 ? 0 : (ecart.x / distance) * OREILLE.coteMax;

  return { volume, cote };
}

/** Comment s'entend un pas que le serveur nous fait entendre sans montrer son marcheur. */
export function placeDUnPasEntendu(pas: PasEntendu): PlaceDuSon {
  return placeDUnPas(ecartDUnPas(pas));
}

/** Un ninja affiche, tel que le lissage le donne. */
export interface NinjaAffiche {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Un joueur, et non un PNJ. */
  readonly joueur: boolean;
  readonly fantome: boolean;
  readonly enMouvement: boolean;
}

/** Les pas des marcheurs qu'on voit, a jouer a cette image. */
export interface PasDesMarcheurs {
  /** L'instant du dernier pas de chaque marcheur: ceux qui marchent encore. */
  readonly derniers: ReadonlyMap<string, number>;
  readonly places: readonly PlaceDuSon[];
}

/**
 * Les pas des vivants qu'on voit marcher: un a leur premiere foulee, puis un par intervalle.
 * Un marcheur qui s'arrete est oublie: il refait un pas des qu'il repart, comme nous.
 *
 * @param derniers L'instant du dernier pas de chaque marcheur, a l'image precedente.
 * @param moi      Notre identifiant: nos pas sont joues a part.
 * @param auditeur D'ou l'on ecoute: notre personnage.
 */
export function pasDesMarcheurs(
  derniers: ReadonlyMap<string, number>,
  ninjas: readonly NinjaAffiche[],
  moi: string | undefined,
  auditeur: Position,
  maintenant: number,
): PasDesMarcheurs {
  const suivants = new Map<string, number>();
  const places: PlaceDuSon[] = [];

  for (const ninja of ninjas) {
    if (!ninja.joueur || ninja.fantome || !ninja.enMouvement || ninja.id === moi) {
      continue;
    }

    const dernier = derniers.get(ninja.id);

    if (dernier !== undefined && maintenant - dernier < INTERVALLE_DES_PAS_VUS_MS) {
      suivants.set(ninja.id, dernier);
      continue;
    }

    suivants.set(ninja.id, maintenant);
    const place = placeDUnPas({ x: ninja.x - auditeur.x, y: ninja.y - auditeur.y });

    if (place.volume > 0) {
      places.push(place);
    }
  }

  return { derniers: suivants, places };
}
