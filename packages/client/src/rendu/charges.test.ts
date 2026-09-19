/**
 * Tests de l'arc des charges du Tactique (etape 7.7): ce que montre chacun des cinq points,
 * et le symbole de l'effet qui joue sur l'arme.
 */

import type { RestesDesEffetsTactiques } from '@neon-ninja/shared';
import { AUCUN_EFFET_TACTIQUE, TACTIQUE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { APPARENCE_CHARGES, arcDesCharges, effetDeLArc } from './charges.js';

/** Des effets du Tactique: aucun, sauf ceux donnes. */
function effets(restes: Partial<RestesDesEffetsTactiques>): RestesDesEffetsTactiques {
  return { ...AUCUN_EFFET_TACTIQUE, ...restes };
}

/** Les couleurs des points pleins de l'arc, dans l'ordre. */
function pleins(arc: ReturnType<typeof arcDesCharges>): number[] {
  return arc.disques
    .filter((disque) => disque.id.endsWith(':pleine'))
    .map((disque) => disque.remplissage?.couleur ?? -1);
}

const ARME_PLEINE = { charges: 5, avantProchaineChargeMs: TACTIQUE.RECHARGE_MS };

describe('arcDesCharges', () => {
  it('pose cinq points sous le ninja, tous pleins aux charges pleines', () => {
    const arc = arcDesCharges('moi', 100, 200, ARME_PLEINE, AUCUN_EFFET_TACTIQUE);
    const fonds = arc.disques.filter((disque) => !disque.id.endsWith(':pleine'));

    expect(fonds).toHaveLength(TACTIQUE.CHARGES_MAXIMUM);
    expect(pleins(arc)).toEqual(Array<number>(5).fill(APPARENCE_CHARGES.pleine));
    for (const point of fonds) {
      expect(point.y).toBeGreaterThan(200);
      expect(Math.hypot(point.x - 100, point.y - 200)).toBeCloseTo(APPARENCE_CHARGES.rayonDeLArc);
    }
    expect(arc.parts).toEqual([]);
    expect(arc.traits).toEqual([]);
  });

  it('remplit la charge qui revient a proportion de l attente ecoulee', () => {
    const arc = arcDesCharges(
      'moi',
      0,
      0,
      { charges: 2, avantProchaineChargeMs: 1250 },
      AUCUN_EFFET_TACTIQUE,
    );

    expect(pleins(arc)).toHaveLength(2);
    expect(arc.parts).toHaveLength(1);
    // Trois quarts de l'attente ecoules: la part couvre trois quarts du tour.
    expect(arc.parts[0]?.demiOuverture).toBeCloseTo(0.75 * Math.PI);
    expect(arc.parts[0]?.id).toBe('moi:charge:2:recharge');
  });

  it('colore la charge qui revient de l effet de recharge, et montre son symbole', () => {
    const arme = { charges: 1, avantProchaineChargeMs: 2500 };
    const rapide = arcDesCharges('moi', 0, 0, arme, effets({ rechargeRapide: 4000 }));
    const lente = arcDesCharges('moi', 0, 0, arme, effets({ rechargeLente: 4000 }));

    expect(rapide.parts[0]?.remplissage.couleur).toBe(APPARENCE_CHARGES.effets.rechargeRapide);
    expect(lente.parts[0]?.remplissage.couleur).toBe(APPARENCE_CHARGES.effets.rechargeLente);
    expect(rapide.traits.length).toBeGreaterThan(0);
    expect(rapide.traits.every((trait) => trait.id.startsWith('moi:symbole'))).toBe(true);
  });

  it('passe tout l arc a l orange pendant une Rafale, meme sans charge', () => {
    const arc = arcDesCharges(
      'moi',
      0,
      0,
      { charges: 0, avantProchaineChargeMs: 3000 },
      effets({ rafale: 2000 }),
    );

    expect(pleins(arc)).toEqual(Array<number>(5).fill(APPARENCE_CHARGES.effets.rafale));
    expect(arc.parts).toEqual([]);
  });

  it('barre les quatre charges gelees d un Tir unique', () => {
    const arc = arcDesCharges(
      'moi',
      0,
      0,
      { charges: 1, avantProchaineChargeMs: TACTIQUE.RECHARGE_MS },
      effets({ tirUnique: 8000 }),
    );
    const barres = arc.traits.filter((trait) => trait.id.includes(':barre'));

    expect(pleins(arc)).toHaveLength(1);
    expect(barres).toHaveLength(8);
  });

  it('revient a l arc ordinaire quand un bonus et son contraire s annulent', () => {
    const annule = arcDesCharges(
      'moi',
      0,
      0,
      ARME_PLEINE,
      effets({ rafale: 2000, tirUnique: 5000 }),
    );

    expect(annule).toEqual(arcDesCharges('moi', 0, 0, ARME_PLEINE, AUCUN_EFFET_TACTIQUE));
  });
});

describe('effetDeLArc', () => {
  it('ne montre qu un symbole: la Rafale d abord, la visee jamais', () => {
    expect(effetDeLArc(AUCUN_EFFET_TACTIQUE)).toBeUndefined();
    expect(effetDeLArc(effets({ viseeLarge: 1000 }))).toBeUndefined();
    expect(effetDeLArc(effets({ rechargeLente: 1000, rafale: 1000 }))).toBe('rafale');
    expect(effetDeLArc(effets({ rechargeLente: 1000, tirUnique: 1000 }))).toBe('tirUnique');
  });
});
