/**
 * Tests du rendu des zones et des mines de zone (etape 7.12): le motif vivant de chaque nature,
 * le pictogramme, la fin qui palit et clignote, la mine de zone posee et armee, et la zone qui
 * gonfle a son ouverture. Rendus choisis par le porteur du projet sur les planches
 * docs/design/etape-7-12/.
 */

import type { MineDeZoneVue, TypeZone, ZoneVue } from '@neon-ninja/shared';
import { MINES_DE_ZONE, TYPES_ZONE, ZONES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { fait } from '../faits.js';
import { APPARENCE_MINE_DE_ZONE, APPARENCE_ZONE, APPARENCE_ZONES } from './apparence.js';
import type { ZoneScene } from './zones.js';
import {
  bruit,
  clignotement,
  ecouleDepuisLOuverture,
  mineDeZoneVivante,
  pictogramme,
  zoneQuiGonfle,
  zoneVivante,
} from './zones.js';

/** Une zone ouverte, au rayon du jeu. */
function zone(type: TypeZone, dureeRestanteMs = 12_000): ZoneVue {
  return { id: `zone-${type}`, type, x: 1000, y: 700, rayon: ZONES.RAYON_PX, dureeRestanteMs };
}

/** Une mine de zone, armee ou non. */
function mine(nature: TypeZone = 'repulsion', avantOuvertureMs?: number): MineDeZoneVue {
  return {
    id: 'mineDeZone-4',
    type: 'mineDeZone',
    x: 600,
    y: 500,
    couleur: '#FFFFFF',
    direction: 'immobile',
    nature,
    ...(avantOuvertureMs === undefined ? {} : { avantOuvertureMs }),
  };
}

/** Tous les points des traits d'un dessin, en couples. */
function points(scene: ZoneScene): readonly (readonly [number, number])[] {
  return scene.couches.flatMap((couche) =>
    couche.traits.flatMap((trait) =>
      trait.points.flatMap((valeur, rang, tous) =>
        rang % 2 === 0 ? [[valeur, tous[rang + 1] ?? 0] as const] : [],
      ),
    ),
  );
}

/** Un disque du dessin, par la fin de son identifiant. */
function disque(scene: ZoneScene, suffixe: string) {
  return scene.couches
    .flatMap((couche) => couche.disques)
    .find((element) => element.id.endsWith(`:${suffixe}`));
}

describe('une zone ouverte', () => {
  it.each(TYPES_ZONE)(
    'se dessine a sa couleur, son pictogramme sur le bord en haut (%s)',
    (type) => {
      const dessin = zoneVivante(zone(type), 1_000);
      const couleur = APPARENCE_ZONE[type].couleur;

      expect(disque(dessin, 'fond')).toMatchObject({ x: 1000, y: 700, rayon: 220 });
      expect(disque(dessin, 'fond')?.remplissage?.couleur).toBe(couleur);
      expect(disque(dessin, 'bord')?.contour?.couleur).toBe(couleur);
      expect(disque(dessin, 'fond')?.remplissage?.alpha).toBe(APPARENCE_ZONES.fond);
      // Le pictogramme est la derniere couche, dessinee par-dessus le motif.
      expect(dessin.couches.at(-1)?.disques[0]).toMatchObject({ x: 1000, y: 700 - 220 });
    },
  );

  it('garde son motif a l interieur du disque', () => {
    for (const type of TYPES_ZONE) {
      const motif = {
        ...zoneVivante(zone(type), 2_345),
        couches: [zoneVivante(zone(type), 2_345).couches[0]!],
      };

      for (const [x, y] of points(motif)) {
        expect(Math.hypot(x - 1000, y - 700)).toBeLessThanOrEqual(220 + 1e-6);
      }
    }
  });

  it('montre l effet de chaque nature par son motif', () => {
    const traits = (type: TypeZone): readonly string[] =>
      zoneVivante(zone(type), 500).couches[0]!.traits.map((trait) => trait.id.split(':')[1] ?? '');

    expect(traits('chaos').every((nom) => nom.startsWith('eclair'))).toBe(true);
    expect(traits('chaos')).toHaveLength(APPARENCE_ZONES.chaos.eclairs);
    expect(traits('repulsion').filter((nom) => nom.startsWith('chevron'))).toHaveLength(8);
    expect(traits('attraction').filter((nom) => nom.startsWith('chevron'))).toHaveLength(8);
    expect(traits('invisibilite').every((nom) => nom.startsWith('brume'))).toBe(true);
    expect(disque(zoneVivante(zone('invisibilite'), 500), 'voile')).toBeDefined();
  });

  it('fait partir les ondes de la repulsion et revenir celles de l attraction', () => {
    const onde = (type: TypeZone, instant: number): number =>
      disque(zoneVivante(zone(type), instant), 'onde0')?.rayon ?? Number.NaN;

    expect(onde('repulsion', 600)).toBeGreaterThan(onde('repulsion', 300));
    expect(onde('attraction', 600)).toBeLessThan(onde('attraction', 300));
  });

  it('fait crepiter les eclairs du chaos: d autres places a la periode suivante', () => {
    const premier = (instant: number): readonly number[] =>
      zoneVivante(zone('chaos'), instant).couches[0]!.traits[0]!.points;

    expect(premier(10)).toEqual(premier(170));
    expect(premier(10)).not.toEqual(premier(200));
  });

  it('se dessine pareil au meme instant: rien n est garde d une image a l autre', () => {
    expect(zoneVivante(zone('chaos'), 4_321)).toEqual(zoneVivante(zone('chaos'), 4_321));
  });

  it('palit et fait clignoter son bord les trois dernieres secondes', () => {
    const { clignotementMs, palit } = APPARENCE_ZONES.fin;
    const finissante = zone('attraction', 2_000);

    expect(disque(zoneVivante(finissante, 0), 'fond')?.remplissage?.alpha).toBeCloseTo(
      APPARENCE_ZONES.fond * palit,
    );
    const allume = disque(zoneVivante(finissante, 0), 'bord')?.contour?.alpha ?? 0;
    const eteint = disque(zoneVivante(finissante, clignotementMs), 'bord')?.contour?.alpha ?? 0;
    expect(eteint).toBeLessThan(allume);
    // Avant les trois dernieres secondes, le bord ne clignote pas.
    expect(disque(zoneVivante(zone('attraction'), clignotementMs), 'bord')?.contour?.alpha).toBe(
      APPARENCE_ZONES.bord.alpha,
    );
  });
});

describe('le pictogramme', () => {
  it('s inscrit dans son disque blanc, pour chaque nature', () => {
    for (const type of TYPES_ZONE) {
      const dessin = pictogramme(type, 'p', 50, 60, 20);

      expect(dessin.disques[0]).toMatchObject({ x: 50, y: 60, rayon: 20 });
      for (const trait of dessin.traits) {
        for (let rang = 0; rang < trait.points.length; rang += 2) {
          expect(
            Math.hypot((trait.points[rang] ?? 0) - 50, (trait.points[rang + 1] ?? 0) - 60),
          ).toBeLessThan(20);
        }
      }
    }
  });

  it('distingue les fleches qui sortent de celles qui rentrent', () => {
    expect(pictogramme('repulsion', 'p', 0, 0, 20).traits).not.toEqual(
      pictogramme('attraction', 'p', 0, 0, 20).traits,
    );
    expect(pictogramme('invisibilite', 'p', 0, 0, 20).disques).toHaveLength(2);
  });
});

describe('une mine de zone', () => {
  it('se dessine en mine ronde, l anneau a la couleur de la zone qu elle cache', () => {
    for (const nature of TYPES_ZONE) {
      const dessin = mineDeZoneVivante({ mine: mine(nature), x: 600, y: 500 }, 0);

      expect(disque(dessin, 'metal')).toMatchObject({ x: 600, y: 500, rayon: 11 });
      expect(disque(dessin, 'anneau')?.contour?.couleur).toBe(APPARENCE_ZONE[nature].couleur);
      expect(dessin.couches.at(-1)?.disques[0]?.rayon).toBe(
        APPARENCE_MINE_DE_ZONE.rayonPictogramme,
      );
    }
  });

  it('ne trace aucun bord tant qu elle attend, et son halo respire', () => {
    const posee = mineDeZoneVivante({ mine: mine(), x: 600, y: 500 }, 0);

    expect(disque(posee, 'aVenir')).toBeUndefined();
    expect(
      disque(mineDeZoneVivante({ mine: mine(), x: 600, y: 500 }, 400), 'halo')?.remplissage,
    ).not.toEqual(disque(posee, 'halo')?.remplissage);
  });

  it('trace le bord de sa zone a mesure que l ouverture approche, depuis le haut', () => {
    const trace = (avant: number) =>
      mineDeZoneVivante({ mine: mine('chaos', avant), x: 600, y: 500 }, 0).couches[0]?.traits[0];

    expect(
      disque(mineDeZoneVivante({ mine: mine('chaos', 3_000), x: 600, y: 500 }, 0), 'aVenir'),
    ).toMatchObject({ x: 600, y: 500, rayon: ZONES.RAYON_PX });
    expect(trace(MINES_DE_ZONE.DELAI_AVANT_OUVERTURE_MS)).toBeUndefined();

    const demiTour = trace(1_500)!.points;
    // Le trace part du haut, et a mi-delai il est arrive en bas.
    expect(demiTour.slice(0, 2)).toEqual([600, 500 - ZONES.RAYON_PX]);
    expect(demiTour.at(-2)).toBeCloseTo(600);
    expect(demiTour.at(-1)).toBeCloseTo(500 + ZONES.RAYON_PX);
    expect(trace(500)!.points.length).toBeGreaterThan(demiTour.length);
  });

  it('clignote de plus en plus vite a mesure que l ouverture approche', () => {
    const changements = (avant: number): number => {
      let compte = 0;
      for (let instant = 1; instant < 1_000; instant += 1) {
        if (clignotement(avant, instant) !== clignotement(avant, instant - 1)) {
          compte += 1;
        }
      }
      return compte;
    };

    expect(changements(200)).toBeGreaterThan(changements(2_800));
  });
});

describe('l ouverture d une zone', () => {
  const ouverte = (x: number, y: number, instant: number, nature: TypeZone = 'chaos') =>
    fait('mineDeZone', { quoi: 'ouverte', mine: 'mz', nature, x, y }, instant);

  it('se retrouve dans le journal par la place et la nature de la mine', () => {
    const laZone = zone('chaos');

    expect(ecouleDepuisLOuverture(laZone, [ouverte(1000, 700, 2_000)], 2_100)).toBe(100);
    expect(
      ecouleDepuisLOuverture(laZone, [ouverte(1000, 700, 2_000, 'repulsion')], 2_100),
    ).toBeUndefined();
    expect(ecouleDepuisLOuverture(laZone, [ouverte(900, 700, 2_000)], 2_100)).toBeUndefined();
    expect(ecouleDepuisLOuverture(laZone, [], 2_100)).toBeUndefined();
  });

  it('fait gonfler la zone de rien a son rayon, en ralentissant a l arrivee', () => {
    const { gonflementMs } = APPARENCE_MINE_DE_ZONE;
    const rayon = (ecoule: number | undefined): number =>
      zoneQuiGonfle(zone('chaos'), ecoule).rayon;

    expect(rayon(0)).toBe(0);
    expect(rayon(gonflementMs / 2)).toBeGreaterThan(220 / 2);
    expect(rayon(gonflementMs)).toBe(220);
    expect(rayon(undefined)).toBe(220);
  });
});

describe('le hasard du rendu', () => {
  it('rend toujours le meme nombre pour les memes cles, entre zero et un', () => {
    const tirages = Array.from({ length: 200 }, (_, rang) => bruit('zone-3', rang, 1));

    expect(bruit('zone-3', 7, 1)).toBe(bruit('zone-3', 7, 1));
    expect(tirages.every((valeur) => valeur >= 0 && valeur < 1)).toBe(true);
    expect(new Set(tirages).size).toBeGreaterThan(190);
  });
});
