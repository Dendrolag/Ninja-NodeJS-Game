/**
 * Ce que les zones font, dit au joueur (9 octobre 2026): les retours des joueurs disaient
 * qu'on ne comprenait pas ce que faisaient les zones ouvertes par les mines de zone.
 *
 * Trois moments, choisis par le porteur du projet:
 *
 *   - AVANT: pres d'une mine de zone, une bulle au-dessus d'elle dit sa nature et son effet;
 *   - PENDANT: en entrant dans une zone, la meme phrase flotte un instant au-dessus de notre
 *     ninja, et la zone rejoint nos effets en cours, avec ce qu'il lui reste;
 *   - APRES: ce que la zone nous a fait, les ninjas que le chaos nous a pris, et un masque
 *     au-dessus de notre ninja tant que l'invisibilite le cache.
 *
 * L'EFFET NE S'EXPLIQUE QUE LES PREMIERES FOIS. Une fois la phrase lue trois fois pour une
 * nature de zone, seul son nom reste: le joueur a appris, la bulle ne le gene plus.
 *
 * FONCTIONS PURES. Les textes, la mine la plus proche, les zones qui nous couvrent, les
 * ninjas que le chaos vient de repeindre: tout se deduit des vues recues. Ce qu'il faut se
 * rappeler d'une image a l'autre est dans guideDesZones.ts.
 */

import type { EntiteVue, Mode, MineDeZoneVue, TypeZone, ZoneVue } from '@neon-ninja/shared';
import { COULEUR_BOT_NEUTRE } from '@neon-ninja/shared';

import type { VuePartie } from './reconstruction.js';

/** Le nom d'une nature de zone et ce qu'elle fait, dans les mots du porteur du projet. */
export const EXPLICATIONS_DES_ZONES: Readonly<
  Record<TypeZone, { readonly nom: string; readonly effet: string }>
> = {
  chaos: { nom: 'Chaos', effet: 'les ninjas changent de couleur' },
  repulsion: { nom: 'Répulsion', effet: 'les ninjas te fuient' },
  attraction: { nom: 'Attraction', effet: 'attire les ninjas vers toi' },
  invisibilite: { nom: 'Invisibilité', effet: 'personne ne te voit' },
};

/** Combien de fois l'effet d'une nature de zone s'explique avant que son nom suffise. */
export const EXPLICATIONS_AVANT_LE_NOM_SEUL = 3;

/** La distance, en pixels, en deca de laquelle une mine de zone montre sa bulle. */
export const PORTEE_DE_LA_BULLE_PX = 250;

/**
 * Ce qu'une bulle dit d'une nature de zone: son nom et son effet, « Chaos · les ninjas
 * changent de couleur », tant que l'effet s'est explique moins de trois fois; son nom seul
 * ensuite.
 */
export function texteDeLaZone(type: TypeZone, explicationsDejaLues: number): string {
  const { nom, effet } = EXPLICATIONS_DES_ZONES[type];

  return explicationsDejaLues < EXPLICATIONS_AVANT_LE_NOM_SEUL ? `${nom} · ${effet}` : nom;
}

/** Une position sur la carte. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** La mine de zone la plus proche de nous, a portee de bulle. Rien si aucune ne l'est. */
export function mineLaPlusProche<M extends Point & { readonly entite: EntiteVue }>(
  mines: readonly M[],
  moi: Point,
): (M & { readonly entite: MineDeZoneVue }) | undefined {
  let meilleure: (M & { readonly entite: MineDeZoneVue }) | undefined;
  let meilleureDistance = PORTEE_DE_LA_BULLE_PX;

  for (const mine of mines) {
    if (mine.entite.type !== 'mineDeZone') {
      continue;
    }

    const distance = Math.hypot(mine.x - moi.x, mine.y - moi.y);

    if (distance < meilleureDistance) {
      meilleureDistance = distance;
      meilleure = mine as M & { readonly entite: MineDeZoneVue };
    }
  }

  return meilleure;
}

/** Les zones ouvertes qui couvrent cette position: celles ou nous nous tenons. */
export function zonesQuiCouvrent(zones: readonly ZoneVue[], position: Point): readonly ZoneVue[] {
  return zones.filter((zone) => Math.hypot(position.x - zone.x, position.y - zone.y) <= zone.rayon);
}

/** Les modes ou nos ninjas sont a notre couleur, et ou le chaos peut donc nous en prendre. */
const MODES_OU_LE_CHAOS_PREND: readonly Mode[] = ['classique', 'tactique', 'equipes'];

/**
 * Combien de nos ninjas une zone de chaos vient de repeindre, entre deux vues.
 *
 * Un ninja compte s'il etait a notre couleur, qu'il porte desormais une couleur qui n'est
 * celle d'aucun joueur, ni le blanc d'un ninja neutralise par un Black Ninja, et qu'il se
 * trouve dans une zone de chaos: c'est exactement ce que fait le chaos (packages/sim,
 * zones.ts), et rien d'autre ne le fait. Un ninja pris par un joueur ou par contagion porte
 * la couleur d'un joueur, et ne compte pas.
 */
export function ninjasRepeintsParLeChaos(
  avant: VuePartie | undefined,
  apres: VuePartie | undefined,
  moi: string | undefined,
  mode: Mode | undefined,
): number {
  if (
    avant === undefined ||
    apres === undefined ||
    avant === apres ||
    mode === undefined ||
    !MODES_OU_LE_CHAOS_PREND.includes(mode)
  ) {
    return 0;
  }

  const chaos = apres.zones.filter((zone) => zone.type === 'chaos');
  const maCouleur = avant.entites.find((entite) => entite.id === moi)?.couleur;

  if (chaos.length === 0 || maCouleur === undefined) {
    return 0;
  }

  const couleursDesJoueurs = new Set(
    apres.entites.filter((entite) => entite.type === 'joueur').map((entite) => entite.couleur),
  );
  const anciennes = new Map(avant.entites.map((entite) => [entite.id, entite.couleur]));
  let repeints = 0;

  for (const entite of apres.entites) {
    if (
      entite.type === 'bot' &&
      anciennes.get(entite.id) === maCouleur &&
      entite.couleur !== maCouleur &&
      entite.couleur !== COULEUR_BOT_NEUTRE &&
      !couleursDesJoueurs.has(entite.couleur) &&
      zonesQuiCouvrent(chaos, entite).length > 0
    ) {
      repeints += 1;
    }
  }

  return repeints;
}
