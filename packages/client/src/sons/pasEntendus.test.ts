/**
 * Tests des pas des autres dans Among Ninjas (etape 7.23): ou on les entend, et quand.
 */

import { AMONG } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { OREILLE } from './espace.js';
import type { NinjaAffiche } from './pasEntendus.js';
import {
  INTERVALLE_DES_PAS_VUS_MS,
  OREILLE_DES_PAS,
  pasDesMarcheurs,
  placeDUnPas,
  placeDUnPasEntendu,
} from './pasEntendus.js';

/** Un vivant qui marche, a cette place. */
function marcheur(id: string, x: number, y = 0): NinjaAffiche {
  return { id, x, y, joueur: true, fantome: false, enMouvement: true };
}

const ICI = { x: 0, y: 0 };

describe('la place d un pas d autrui', () => {
  it('s entend le plus fort de pres, moitie moins que nos propres pas', () => {
    expect(placeDUnPas({ x: 0, y: 0 })).toEqual({ volume: OREILLE_DES_PAS.volumeProche, cote: 0 });
    expect(placeDUnPas({ x: 0, y: OREILLE_DES_PAS.procheePx }).volume).toBe(0.5);
  });

  it('baisse avec la distance, s entend encore a la portee, et se tait au-dela', () => {
    const volumes = [150, 300, 450, AMONG.PORTEE_DES_PAS_PX].map(
      (distance) => placeDUnPas({ x: 0, y: distance }).volume,
    );

    expect([...volumes].sort((un, autre) => autre - un)).toEqual(volumes);
    expect(volumes.at(-1)).toBeCloseTo(OREILLE_DES_PAS.volumeALaPortee);
    expect(placeDUnPas({ x: 0, y: AMONG.PORTEE_DES_PAS_PX + 1 }).volume).toBe(0);
  });

  it('prend son cote de la direction seule, de pres comme de loin', () => {
    expect(placeDUnPas({ x: 50, y: 0 }).cote).toBeCloseTo(OREILLE.coteMax);
    expect(placeDUnPas({ x: 450, y: 0 }).cote).toBeCloseTo(OREILLE.coteMax);
    expect(placeDUnPas({ x: -200, y: 0 }).cote).toBeCloseTo(-OREILLE.coteMax);
    expect(placeDUnPas({ x: 0, y: -300 }).cote).toBeCloseTo(0);
  });

  it('place un pas entendu au milieu de son secteur et de son palier', () => {
    const procheALEst = placeDUnPasEntendu({ secteur: 0, palier: 0 });
    const loinAuNord = placeDUnPasEntendu({ secteur: 6, palier: 2 });

    expect(procheALEst).toEqual({ volume: OREILLE_DES_PAS.volumeProche, cote: OREILLE.coteMax });
    expect(loinAuNord.cote).toBeCloseTo(0);
    expect(loinAuNord.volume).toBeLessThan(procheALEst.volume);
    expect(loinAuNord.volume).toBeGreaterThan(0);
  });
});

describe('les pas des marcheurs qu on voit', () => {
  it('font un pas a la premiere foulee, puis un par intervalle', () => {
    let derniers: ReadonlyMap<string, number> = new Map();
    const instants: number[] = [];

    for (let maintenant = 0; maintenant <= 1_000; maintenant += 50) {
      const pas = pasDesMarcheurs(derniers, [marcheur('bob', 200)], 'moi', ICI, maintenant);
      derniers = pas.derniers;

      if (pas.places.length > 0) {
        instants.push(maintenant);
      }
    }

    expect(INTERVALLE_DES_PAS_VUS_MS).toBe(250);
    expect(instants).toEqual([0, 250, 500, 750, 1_000]);
  });

  it('donnent a chaque marcheur sa cadence, et oublient qui s arrete', () => {
    const premier = pasDesMarcheurs(new Map(), [marcheur('bob', 200)], 'moi', ICI, 0);
    const second = pasDesMarcheurs(
      premier.derniers,
      [marcheur('bob', 200), marcheur('eve', -200)],
      'moi',
      ICI,
      100,
    );

    expect(second.places).toEqual([placeDUnPas({ x: -200, y: 0 })]);

    const arrete = pasDesMarcheurs(
      second.derniers,
      [{ ...marcheur('bob', 200), enMouvement: false }],
      'moi',
      ICI,
      150,
    );
    expect(arrete.derniers.has('bob')).toBe(false);
    expect(arrete.derniers.has('eve')).toBe(false);

    // Il repart: un pas tout de suite, comme nous.
    expect(
      pasDesMarcheurs(arrete.derniers, [marcheur('bob', 200)], 'moi', ICI, 160).places,
    ).toHaveLength(1);
  });

  it('taisent les PNJ, les fantomes, nous-memes, et qui est hors de portee', () => {
    const muets: NinjaAffiche[] = [
      { ...marcheur('pnj-1', 100), joueur: false },
      { ...marcheur('ombre', 100), fantome: true },
      marcheur('moi', 0),
    ];

    expect(pasDesMarcheurs(new Map(), muets, 'moi', ICI, 0)).toEqual({
      derniers: new Map(),
      places: [],
    });

    const loin = pasDesMarcheurs(new Map(), [marcheur('bob', 900)], 'moi', ICI, 0);
    expect(loin.places).toEqual([]);
  });
});
