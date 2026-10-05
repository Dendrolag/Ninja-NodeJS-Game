/**
 * Tests de la place d'un son sur la carte (etape 4.11): a quel volume et de quel cote
 * s'entend un son situe, et lesquels le sont.
 */

import { describe, expect, it } from 'vitest';

import type { FaitDeJeu } from '../faits.js';
import { fait } from '../faits.js';
import { OREILLE, lieuDuSon, placeDuFait, placeDuSon } from './espace.js';

const ICI = { x: 1_000, y: 800 };

describe('placeDuSon', () => {
  it('joue a plein et au centre un son a notre place', () => {
    expect(placeDuSon(ICI, ICI)).toEqual({ volume: 1, cote: 0 });
  });

  it('garde le plein volume jusqu a la distance proche, assez pour qui est touche par une mine', () => {
    expect(placeDuSon({ x: ICI.x, y: ICI.y + OREILLE.procheePx }, ICI).volume).toBe(1);
    expect(OREILLE.procheePx).toBeGreaterThan(130);
  });

  it('se tait a la portee et au-dela', () => {
    expect(placeDuSon({ x: ICI.x + OREILLE.porteePx, y: ICI.y }, ICI).volume).toBe(0);
    expect(placeDuSon({ x: ICI.x - 3_000, y: ICI.y + 2_000 }, ICI).volume).toBe(0);
  });

  it('est au quart au bord d un ecran d ordinateur, a 800 pixels', () => {
    expect(placeDuSon({ x: ICI.x, y: ICI.y - 800 }, ICI).volume).toBeCloseTo(0.25);
  });

  it('baisse sans jamais remonter quand on s eloigne', () => {
    const volumes = [0, 200, 400, 600, 800, 1_000, 1_200, 1_400].map(
      (ecart) => placeDuSon({ x: ICI.x, y: ICI.y + ecart }, ICI).volume,
    );

    for (let rang = 1; rang < volumes.length; rang += 1) {
      expect(volumes[rang]).toBeLessThanOrEqual(volumes[rang - 1] ?? 1);
    }
  });

  it('place a droite un son a droite, a gauche un son a gauche', () => {
    expect(placeDuSon({ x: ICI.x + 400, y: ICI.y }, ICI).cote).toBeCloseTo(0.4);
    expect(placeDuSon({ x: ICI.x - 400, y: ICI.y }, ICI).cote).toBeCloseTo(-0.4);
  });

  it('ne place un son jamais entierement d un seul cote', () => {
    expect(placeDuSon({ x: ICI.x + 1_200, y: ICI.y }, ICI).cote).toBe(OREILLE.coteMax);
    expect(placeDuSon({ x: ICI.x - 1_200, y: ICI.y }, ICI).cote).toBe(-OREILLE.coteMax);
  });

  it('laisse au centre un son a notre aplomb, au-dessus ou au-dessous', () => {
    expect(placeDuSon({ x: ICI.x, y: ICI.y - 500 }, ICI).cote).toBe(0);
    expect(placeDuSon({ x: ICI.x, y: ICI.y + 500 }, ICI).cote).toBe(0);
  });
});

describe('lieuDuSon', () => {
  const mine = { mine: 'm', poseur: 'bob', x: 300, y: 400 };

  it('situe l armement et l explosion d une mine posee, a la mine', () => {
    expect(lieuDuSon(fait('mineArmee', { ...mine, par: 'carl' }, 0), 'moi', ICI)).toEqual({
      x: 300,
      y: 400,
    });
    expect(
      lieuDuSon(
        fait('mineExplosee', { ...mine, touches: [], botsNoirsTues: 0, botsTues: 0, points: 0 }, 0),
        'moi',
        ICI,
      ),
    ).toEqual({ x: 300, y: 400 });
  });

  it('situe l armement et l ouverture d une mine de zone, a la mine', () => {
    for (const quoi of ['armee', 'ouverte'] as const) {
      expect(
        lieuDuSon(
          fait('mineDeZone', { quoi, mine: 'mz', nature: 'chaos', x: 5, y: 6 }, 0),
          'moi',
          ICI,
        ),
      ).toEqual({ x: 5, y: 6 });
    }
  });

  it('fait venir la fumee d un autre de son bout le plus proche de nous', () => {
    const loinPuisPres = { depart: { x: 0, y: 0 }, arrivee: { x: 1_100, y: 750 } };
    const presPuisLoin = { depart: { x: 1_100, y: 750 }, arrivee: { x: 0, y: 0 } };

    expect(lieuDuSon(fait('fumee', { joueur: 'bob', ...loinPuisPres }, 0), 'moi', ICI)).toEqual({
      x: 1_100,
      y: 750,
    });
    expect(lieuDuSon(fait('fumee', { joueur: 'bob', ...presPuisLoin }, 0), 'moi', ICI)).toEqual({
      x: 1_100,
      y: 750,
    });
  });

  it('ne situe pas notre propre fumee: elle ne concerne que nous', () => {
    const nuage = { depart: { x: 0, y: 0 }, arrivee: { x: 1_100, y: 750 } };

    expect(lieuDuSon(fait('fumee', { joueur: 'moi', ...nuage }, 0), 'moi', ICI)).toBeUndefined();
  });

  it('ne situe ni ce qui ne concerne que nous, ni les annonces a toute la partie', () => {
    const nonSitues: readonly FaitDeJeu[] = [
      fait('minePosee', { mine: 'm', x: 1, y: 1 }, 0),
      fait('evade', { quoi: 'apparu' }, 0),
      fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 0),
      fait('botNoirDetruit', { points: 15, x: 1_000, y: 800 }, 0),
    ];

    for (const unFait of nonSitues) {
      expect(lieuDuSon(unFait, 'moi', ICI)).toBeUndefined();
    }
  });
});

describe('placeDuFait', () => {
  const armee = fait('mineArmee', { mine: 'm', poseur: 'bob', par: 'bob', x: 1_400, y: 800 }, 0);

  it('donne la place du son d un fait situe, vue d ou l on ecoute', () => {
    expect(placeDuFait(armee, 'moi', ICI)).toEqual(placeDuSon({ x: 1_400, y: 800 }, ICI));
  });

  it('ne donne rien sans savoir d ou l on ecoute, ni pour un son qui n est pas situe', () => {
    expect(placeDuFait(armee, 'moi', undefined)).toBeUndefined();
    expect(placeDuFait(fait('evade', { quoi: 'apparu' }, 0), 'moi', ICI)).toBeUndefined();
  });
});
