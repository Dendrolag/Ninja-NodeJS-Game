/**
 * L'estimation du filtrage par zone d'interet (etape 5.10): ce qui est dans le rectangle
 * d'un joueur est garde, le reste ecarte, et la trame filtree se decode.
 */

import { describe, expect, it } from 'vitest';

import type { BotVu, InstantanePartie } from '../../packages/shared/dist/index.js';
import { appliquerTrame, encoderImage } from '../../packages/shared/dist/index.js';

import { ZONE_D_INTERET, dansLaZone, vueFiltree } from './zoneDInteret.ts';

/** Un faux ninja a cet endroit. */
function bot(id: string, x: number, y: number): BotVu {
  return { id, type: 'bot', x, y, couleur: '#FF0000', direction: 'immobile' };
}

/** Une vue de trois faux ninjas: un pres du joueur, un au bord du rectangle, un loin. */
function vue(): InstantanePartie {
  return {
    tick: 3,
    tempsRestantMs: 60_000,
    enPause: false,
    entites: [bot('pres', 5100, 5100), bot('bord', 6200, 4400), bot('loin', 9000, 1000)],
    objets: [],
    zones: [],
    classement: [],
  };
}

const CENTRE = { x: 5000, y: 5000 };

describe('dansLaZone', () => {
  it('garde un point du rectangle, bords compris, et ecarte un point dehors', () => {
    expect(dansLaZone(CENTRE, { x: 5100, y: 5100 })).toBe(true);
    expect(dansLaZone(CENTRE, { x: 5000 + ZONE_D_INTERET.demiLargeur, y: 5000 })).toBe(true);
    expect(dansLaZone(CENTRE, { x: 5000, y: 5000 - ZONE_D_INTERET.demiHauteur - 1 })).toBe(false);
    expect(dansLaZone(CENTRE, { x: 9000, y: 1000 })).toBe(false);
  });

  it('couvre l ecran le plus large retenu, un 21:9 de 900 pixels de haut, et sa marge', () => {
    expect(ZONE_D_INTERET.demiHauteur * 2).toBeGreaterThan(900);
    expect(ZONE_D_INTERET.demiLargeur * 2).toBeGreaterThan((900 * 21) / 9);
  });
});

describe('vueFiltree', () => {
  it('compte les entites du rectangle et ecarte les autres', () => {
    const filtree = vueFiltree(vue(), CENTRE);

    expect(filtree.entites.map((entite) => entite.id)).toEqual(['pres', 'bord']);
    expect(filtree.tick).toBe(3);
  });

  it('donne une trame qui se decode, plus courte que celle de toute la partie', () => {
    const entiere = encoderImage(vue());
    const filtree = encoderImage(vueFiltree(vue(), CENTRE));
    const decodee = appliquerTrame(undefined, filtree.octets);

    expect(decodee?.entites.map((entite) => entite.id)).toEqual(['pres', 'bord']);
    expect(filtree.octets.byteLength).toBeLessThan(entiere.octets.byteLength);
  });
});
