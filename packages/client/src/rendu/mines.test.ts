/**
 * Tests du rendu des mines (etape 7.11): qui voit la mine pleine, qui n'en voit qu'un reflet,
 * la mine armee et son rayon, l'explosion.
 */

import type { MineVue } from '@neon-ninja/shared';
import { COULEUR_DES_TRAQUEURS, MINES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { fait } from '../faits.js';
import { APPARENCE_MINE } from './apparence.js';
import type { Spectateur } from './mines.js';
import { bouleDeFeu, diodeArmee, estDeMonCamp, minesDeLaScene, reflet } from './mines.js';

/** Une mine de ce poseur, a cette couleur, armee ou non. */
function mine(poseur = 'bob', couleur = '#0000FF', avantExplosionMs?: number): MineVue {
  return {
    type: 'mine',
    id: `mine-${poseur}`,
    x: 500,
    y: 400,
    couleur,
    direction: 'immobile',
    poseur,
    ...(avantExplosionMs === undefined ? {} : { avantExplosionMs }),
  };
}

/** Un spectateur rouge, en Horde, sans Revelation. */
function spectateur(champs: Partial<Spectateur> = {}): Spectateur {
  return { moi: 'alice', couleur: '#FF0000', mode: 'classique', revelation: false, ...champs };
}

/** Les mines d'une image, et rien au journal. */
function image(mines: readonly MineVue[], qui: Spectateur, maintenant = 0) {
  return minesDeLaScene(
    mines.map((une) => ({ mine: une, x: une.x, y: une.y })),
    [],
    qui,
    maintenant,
  );
}

describe('le camp d une mine', () => {
  it('est celui de son poseur seul, en Horde, en Tactique et en Massacre', () => {
    expect(estDeMonCamp(mine('alice'), spectateur())).toBe(true);
    expect(estDeMonCamp(mine('bob', '#FF0000'), spectateur())).toBe(false);
    expect(estDeMonCamp(mine('bob', '#FF0000'), spectateur({ mode: 'massacre' }))).toBe(false);
  });

  it('est l equipe du poseur, en Equipes', () => {
    const equipes = spectateur({ mode: 'equipes' });

    expect(estDeMonCamp(mine('carole', '#FF0000'), equipes)).toBe(true);
    expect(estDeMonCamp(mine('bob', '#0000FF'), equipes)).toBe(false);
  });

  it('est le role du poseur, en Chasse', () => {
    const traqueur = spectateur({ mode: 'chasse', couleur: COULEUR_DES_TRAQUEURS });
    const proie = spectateur({ mode: 'chasse', couleur: '#00FF00' });

    expect(estDeMonCamp(mine('tom', COULEUR_DES_TRAQUEURS), traqueur)).toBe(true);
    expect(estDeMonCamp(mine('bob', '#0000FF'), traqueur)).toBe(false);
    expect(estDeMonCamp(mine('bob', '#0000FF'), proie)).toBe(true);
    expect(estDeMonCamp(mine('tom', COULEUR_DES_TRAQUEURS), proie)).toBe(false);
  });

  it('n est pas le notre tant qu on ne sait pas qui on est', () => {
    expect(estDeMonCamp(mine(), spectateur({ moi: undefined, couleur: undefined }))).toBe(false);
  });
});

describe('une mine posee', () => {
  it('se voit pleine de son poseur: metal cerne, anneau a sa couleur, diode', () => {
    const { sol } = image([mine('alice', '#FF0000')], spectateur());

    expect(sol.disques.map((disque) => disque.id)).toEqual([
      'mine-alice:metal',
      'mine-alice:anneau',
      'mine-alice:eclat',
      'mine-alice:halo',
      'mine-alice:diode',
    ]);
    expect(sol.disques[1]?.contour?.couleur).toBe(0xff0000);
    expect(sol.traits).toEqual([]);
  });

  it('ne laisse a un adversaire qu un reflet, deux dixiemes de seconde toutes les deux secondes', () => {
    const adverse = mine('bob');
    const vus = Array.from({ length: 200 }, (_, rang) => rang * 10).filter(
      (instant) => image([adverse], spectateur(), instant).sol.traits.length > 0,
    );

    expect(image([adverse], spectateur(), 0).sol.disques).toEqual([]);
    expect(vus.length * 10).toBe(APPARENCE_MINE.reflet.dureeMs);
  });

  it('brille a son propre rythme: deux mines ne brillent pas ensemble', () => {
    const instantsVisibles = (id: string): number[] =>
      Array.from({ length: 200 }, (_, rang) => rang * 10).filter(
        (instant) => reflet(id, 0, 0, instant).length > 0,
      );

    expect(instantsVisibles('mine-1')).not.toEqual(instantsVisibles('mine-2'));
  });

  it('se voit pleine sous la Revelation, cernee de violet', () => {
    const { sol } = image([mine('bob')], spectateur({ revelation: true }));

    expect(sol.disques.map((disque) => disque.id)).toContain('mine-bob:revelation');
    expect(sol.disques.map((disque) => disque.id)).toContain('mine-bob:metal');
  });
});

describe('une mine armee', () => {
  it('se voit pleine de tous, avec son rayon d explosion en pointilles', () => {
    const { sol } = image([mine('bob', '#0000FF', 900)], spectateur());
    const rayon = sol.disques.find((disque) => disque.id === 'mine-bob:rayon');

    expect(rayon?.rayon).toBe(MINES.RAYON_EXPLOSION_PX);
    expect(sol.disques.map((disque) => disque.id)).toContain('mine-bob:metal');
    expect(sol.traits.length).toBeGreaterThan(30);

    for (const trait of sol.traits) {
      const [x, y] = trait.points as [number, number];
      expect(Math.hypot(x - 500, y - 400)).toBeCloseTo(MINES.RAYON_EXPLOSION_PX, 6);
    }
  });

  it('clignote de plus en plus vite a mesure que l explosion approche', () => {
    const changements = (avantExplosionMs: number): number => {
      let changes = 0;
      for (let instant = 1; instant < 1000; instant += 1) {
        if (diodeArmee(avantExplosionMs, instant) !== diodeArmee(avantExplosionMs, instant - 1)) {
          changes += 1;
        }
      }
      return changes;
    };

    expect(changements(100)).toBeGreaterThan(changements(1400) * 3);
  });
});

describe('l explosion', () => {
  it('gonfle jusqu au rayon, puis palit, et s efface', () => {
    const debut = bouleDeFeu('m', 0, 0, 50);
    const plein = bouleDeFeu('m', 0, 0, APPARENCE_MINE.explosion.gonflementMs);
    const fin = bouleDeFeu('m', 0, 0, APPARENCE_MINE.explosion.dureeMs - 10);
    const centre = (disques: typeof debut) => disques.find((disque) => disque.id === 'm:feu0');

    expect(centre(debut)?.rayon).toBeLessThan(centre(plein)?.rayon ?? 0);
    expect(centre(plein)?.remplissage?.alpha).toBe(1);
    expect(centre(fin)?.remplissage?.alpha).toBeLessThan(0.3);
    expect(centre(debut)?.remplissage?.couleur).toBe(APPARENCE_MINE.explosion.orange);
    expect(centre(plein)?.remplissage?.couleur).toBe(APPARENCE_MINE.explosion.rouge);

    const etendue = Math.max(
      ...plein.map((disque) => Math.hypot(disque.x, disque.y) + disque.rayon),
    );
    expect(etendue).toBeLessThanOrEqual(MINES.RAYON_EXPLOSION_PX + 5);
    expect(etendue).toBeGreaterThan(MINES.RAYON_EXPLOSION_PX - 20);
  });

  it('se lit dans le journal, pendant sa duree seulement', () => {
    const journal = [
      fait(
        'mineExplosee',
        {
          mine: 'mine-1',
          poseur: 'bob',
          x: 10,
          y: 20,
          touches: [],
          botsNoirsTues: 0,
          botsTues: 0,
          points: 0,
        },
        1000,
      ),
    ];
    const a = (instant: number) => minesDeLaScene([], journal, spectateur(), instant).explosions;

    expect(a(999)).toEqual([]);
    expect(a(1100).length).toBeGreaterThan(0);
    expect(a(1000 + APPARENCE_MINE.explosion.dureeMs)).toEqual([]);
  });
});
