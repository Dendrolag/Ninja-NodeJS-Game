/**
 * Les charges flottantes du Tactique (etape 7.7): un arc de cinq points sous notre ninja.
 *
 * Rendu A des maquettes, choisi par le porteur du projet le 19 septembre 2026
 * (docs/design/etape-7-7/1-charges-flottantes.png). Les charges se lisaient jusque-la sur
 * le bouton « Capturer », dans un coin de l'ecran: loin du regard, qui suit le ninja. Elles
 * se lisent maintenant a ses pieds, pour soi seul.
 *
 *   - Un point plein par charge en main; celui de la charge qui revient se remplit comme
 *     une horloge, de la couleur de l'effet de recharge s'il y en a un.
 *   - Pendant une Rafale, l'arc passe a l'orange: aucun tir ne coute.
 *   - Sous Tir unique, les points des charges gelees sont barres.
 *   - Un petit symbole a droite de l'arc dit l'effet qui joue sur l'arme: l'infini pour la
 *     Rafale, « 1 » pour le Tir unique, un double chevron pour la Recharge rapide, un
 *     sablier pour la Recharge lente. La visee, elle, se voit au cone.
 *
 * FONCTIONS PURES: une position, des charges et des effets donnent des formes a dessiner,
 * en coordonnees de carte. Le rendu PixiJS ne fait que les tracer.
 */

import type { RestesDesEffetsTactiques } from '@neon-ninja/shared';
import { TACTIQUE, effetQuiAgit } from '@neon-ninja/shared';

import type { ConeScene, DisqueScene, TraitScene } from './scene.js';

/** Les formes de l'arc des charges. Vide hors du Tactique. */
export interface IndicateurScene {
  readonly disques: readonly DisqueScene[];
  /** Les parts de disque: la charge qui revient. */
  readonly parts: readonly ConeScene[];
  /** Les traits: les points barres et le symbole de l'effet. */
  readonly traits: readonly TraitScene[];
}

/** Aucun indicateur. */
export const AUCUN_INDICATEUR: IndicateurScene = { disques: [], parts: [], traits: [] };

/** L'etat de l'arme que l'arc montre: celui que le flux porte pour notre joueur. */
export interface ArmeAffichee {
  readonly charges: number;
  readonly avantProchaineChargeMs: number;
}

/** La geometrie et les couleurs de l'arc, en pixels de carte. Valeurs de la maquette. */
export const APPARENCE_CHARGES = {
  /** Distance entre le centre du ninja et chaque point. */
  rayonDeLArc: 21,
  /** Rayon d'un point. */
  rayonDUnPoint: 2.3,
  /** L'ecart d'angle entre deux points voisins, en radians. */
  ecart: 0.36,
  /** Ou se pose le symbole de l'effet, en radians depuis le bas: a droite de l'arc. */
  angleDuSymbole: Math.PI / 2 - 1.05,
  /** La demi-taille du symbole. */
  tailleDuSymbole: 3.6,
  fond: { couleur: 0x000000, alpha: 0.55 },
  bord: { couleur: 0xffffff, alpha: 0.18, epaisseur: 0.5 },
  pleine: 0xffffff,
  /** Les points barres d'un Tir unique. */
  gelee: { couleur: 0xffffff, alpha: 0.35, epaisseur: 0.7 },
  /** La couleur de chaque effet sur l'arc. */
  effets: {
    rafale: 0xffae2e,
    tirUnique: 0xffae2e,
    rechargeRapide: 0x3ee6ff,
    rechargeLente: 0x9c8cff,
  },
} as const;

/** Les effets qui ont un symbole sur l'arc, dans l'ordre ou l'un passe devant l'autre. */
const EFFETS_DE_L_ARC = ['rafale', 'tirUnique', 'rechargeRapide', 'rechargeLente'] as const;

/** Un effet qui se lit sur l'arc. */
type EffetDeLArc = (typeof EFFETS_DE_L_ARC)[number];

/** Ce qu'un point de l'arc montre. */
type Point =
  | { readonly nature: 'pleine'; readonly couleur: number }
  | { readonly nature: 'enRecharge'; readonly part: number; readonly couleur: number }
  | { readonly nature: 'vide' }
  | { readonly nature: 'gelee' };

/**
 * L'arc des charges sous un ninja place en (x, y).
 *
 * @param arme    Les charges en main et l'attente de la suivante, telles que le flux les porte.
 * @param effets  Nos effets du Tactique, et ce qu'il reste de chacun.
 */
export function arcDesCharges(
  id: string,
  x: number,
  y: number,
  arme: ArmeAffichee,
  effets: RestesDesEffetsTactiques,
): IndicateurScene {
  const a = APPARENCE_CHARGES;
  const disques: DisqueScene[] = [];
  const parts: ConeScene[] = [];
  const traits: TraitScene[] = [];

  pointsDeLArc(arme, effets).forEach((point, rang) => {
    const angle = Math.PI / 2 + (2 - rang) * a.ecart;
    const px = x + a.rayonDeLArc * Math.cos(angle);
    const py = y + a.rayonDeLArc * Math.sin(angle);
    const cle = `${id}:charge:${String(rang)}`;

    disques.push({
      id: cle,
      x: px,
      y: py,
      rayon: a.rayonDUnPoint,
      remplissage: a.fond,
      contour: a.bord,
    });

    if (point.nature === 'pleine') {
      disques.push({
        id: `${cle}:pleine`,
        x: px,
        y: py,
        rayon: a.rayonDUnPoint,
        remplissage: { couleur: point.couleur, alpha: 1 },
        contour: undefined,
      });
    } else if (point.nature === 'enRecharge' && point.part > 0) {
      // Une part qui se remplit dans le sens des aiguilles, depuis midi.
      parts.push({
        id: `${cle}:recharge`,
        x: px,
        y: py,
        angle: -Math.PI / 2 + point.part * Math.PI,
        demiOuverture: point.part * Math.PI,
        rayon: a.rayonDUnPoint,
        remplissage: { couleur: point.couleur, alpha: 1 },
        contour: undefined,
      });
    } else if (point.nature === 'gelee') {
      const d = a.rayonDUnPoint * 0.6;
      traits.push(
        trait(`${cle}:barre1`, [px - d, py - d, px + d, py + d], a.gelee),
        trait(`${cle}:barre2`, [px + d, py - d, px - d, py + d], a.gelee),
      );
    }
  });

  const effet = effetDeLArc(effets);

  if (effet !== undefined) {
    const sx = x + a.rayonDeLArc * Math.cos(a.angleDuSymbole);
    const sy = y + a.rayonDeLArc * Math.sin(a.angleDuSymbole);
    traits.push(...symbole(`${id}:symbole`, effet, sx, sy));
  }

  return { disques, parts, traits };
}

/** Ce que montre chacun des cinq points. */
function pointsDeLArc(arme: ArmeAffichee, effets: RestesDesEffetsTactiques): readonly Point[] {
  const a = APPARENCE_CHARGES;
  const points: Point[] = [];

  if (effetQuiAgit(effets, 'rafale')) {
    for (let rang = 0; rang < TACTIQUE.CHARGES_MAXIMUM; rang += 1) {
      points.push({ nature: 'pleine', couleur: a.effets.rafale });
    }
    return points;
  }

  const tirUnique = effetQuiAgit(effets, 'tirUnique');
  const enMain = tirUnique ? 1 : TACTIQUE.CHARGES_MAXIMUM;
  const couleurDeRecharge = effetQuiAgit(effets, 'rechargeRapide')
    ? a.effets.rechargeRapide
    : effetQuiAgit(effets, 'rechargeLente')
      ? a.effets.rechargeLente
      : a.pleine;
  const part = Math.min(Math.max(1 - arme.avantProchaineChargeMs / TACTIQUE.RECHARGE_MS, 0), 1);

  for (let rang = 0; rang < TACTIQUE.CHARGES_MAXIMUM; rang += 1) {
    if (rang >= enMain) {
      points.push({ nature: 'gelee' });
    } else if (rang < arme.charges) {
      points.push({ nature: 'pleine', couleur: a.pleine });
    } else if (rang === arme.charges) {
      points.push({ nature: 'enRecharge', part, couleur: couleurDeRecharge });
    } else {
      points.push({ nature: 'vide' });
    }
  }

  return points;
}

/** L'effet dont l'arc montre le symbole: le premier qui agit, dans l'ordre de l'arc. */
export function effetDeLArc(effets: RestesDesEffetsTactiques): EffetDeLArc | undefined {
  return EFFETS_DE_L_ARC.find((nature) => effetQuiAgit(effets, nature));
}

/** Un trait d'une couleur donnee. */
function trait(
  id: string,
  points: readonly number[],
  style: { readonly couleur: number; readonly alpha: number; readonly epaisseur: number },
): TraitScene {
  return { id, points, couleur: style.couleur, alpha: style.alpha, epaisseur: style.epaisseur };
}

/** Le symbole d'un effet, centre en (x, y). */
function symbole(id: string, effet: EffetDeLArc, x: number, y: number): readonly TraitScene[] {
  const t = APPARENCE_CHARGES.tailleDuSymbole;
  const style = { couleur: APPARENCE_CHARGES.effets[effet], alpha: 1, epaisseur: 1.2 };
  const vers = (points: readonly number[]): number[] =>
    points.map((valeur, rang) => (rang % 2 === 0 ? x : y) + valeur * t);

  switch (effet) {
    case 'rafale': {
      // Une lemniscate: le signe de l'infini.
      const points: number[] = [];
      for (let pas = 0; pas <= 32; pas += 1) {
        const u = (pas / 32) * Math.PI * 2;
        const d = 1 + Math.sin(u) ** 2;
        points.push(Math.cos(u) / d, (Math.sin(u) * Math.cos(u)) / d);
      }
      return [trait(id, vers(points), style)];
    }
    case 'tirUnique':
      return [trait(id, vers([-0.35, -0.45, 0.1, -0.9, 0.1, 0.9, -0.4, 0.9, 0.6, 0.9]), style)];
    case 'rechargeRapide':
      return [
        trait(`${id}:1`, vers([-0.85, -0.7, -0.15, 0, -0.85, 0.7]), style),
        trait(`${id}:2`, vers([0.15, -0.7, 0.85, 0, 0.15, 0.7]), style),
      ];
    case 'rechargeLente':
      return [
        trait(id, vers([-0.65, -0.85, 0.65, -0.85, -0.65, 0.85, 0.65, 0.85, -0.65, -0.85]), style),
      ];
  }
}
