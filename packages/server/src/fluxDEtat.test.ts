/**
 * Tests du flux d'etat d'une partie: quelle trame part, et a qui.
 *
 * Le format lui-meme est teste dans @neon-ninja/shared. Ici on verifie la
 * politique: une image au debut et a intervalle regulier, des deltas entre deux,
 * et une image pour qui arrive en cours de route. Chaque verification decode les
 * trames comme le ferait un client, et compare a l'instantane arrondi du serveur.
 *
 * Depuis l'etape 2.9, la meme politique vue par vue: une trame par vue, une image a qui
 * change de vue, et chaque client qui reconstruit exactement la sienne.
 */

import type { InstantanePartie } from '@neon-ninja/shared';
import { appliquerTrame, lireEnTete, quantifierInstantane } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EnvoiDeTrame } from './fluxDEtat.js';
import { BATTEMENTS_ENTRE_DEUX_IMAGES, FluxDEtat, FluxParVue } from './fluxDEtat.js';

/** L'instantane d'un battement: un bot qui avance d'un peu plus de trois pixels. */
function battement(tick: number): InstantanePartie {
  return {
    tick,
    tempsRestantMs: 180_000 - tick * 50.3,
    enPause: false,
    entites: [
      { type: 'bot', id: 'b1', x: 100 + tick * 3.3, y: 200, couleur: '#FFFFFF', direction: 'est' },
    ],
    objets: [],
    zones: [],
    classement: [],
  };
}

describe('flux d etat d une partie', () => {
  it('ouvre par une image, puis envoie des deltas', () => {
    const flux = new FluxDEtat();

    expect(lireEnTete(flux.trameDuBattement(battement(1))).nature).toBe('image');
    expect(lireEnTete(flux.trameDuBattement(battement(2)))).toEqual({
      nature: 'delta',
      tick: 2,
      base: 1,
    });
  });

  it('renvoie une image a toute la salle a intervalle regulier', () => {
    const flux = new FluxDEtat(4);
    const natures = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
      (tick) => lireEnTete(flux.trameDuBattement(battement(tick))).nature,
    );

    expect(natures).toEqual([
      'image',
      'delta',
      'delta',
      'delta',
      'image',
      'delta',
      'delta',
      'delta',
      'image',
    ]);
    expect(BATTEMENTS_ENTRE_DEUX_IMAGES).toBe(100);
  });

  it('permet a un client present depuis le debut de suivre chaque battement', () => {
    const flux = new FluxDEtat(10);
    let partie: InstantanePartie | undefined;

    for (let tick = 1; tick <= 35; tick += 1) {
      partie = appliquerTrame(partie, flux.trameDuBattement(battement(tick)));

      expect(partie).toEqual(quantifierInstantane(battement(tick)));
    }
  });

  it('donne a un nouveau venu l image du battement, apres le delta qu il ignore', () => {
    const flux = new FluxDEtat();
    flux.trameDuBattement(battement(1));
    flux.trameDuBattement(battement(2));

    flux.attendreUneImage('nouveau');
    const delta = flux.trameDuBattement(battement(3));
    const attendues = flux.imagesAttendues();

    expect(appliquerTrame(undefined, delta)).toBeUndefined();
    expect(attendues?.destinataires).toEqual(['nouveau']);

    const image = attendues?.image as Uint8Array;
    expect(lireEnTete(image)).toEqual({ nature: 'image', tick: 3, base: undefined });

    // Le nouveau venu suit ensuite les deltas de la salle.
    let partie = appliquerTrame(undefined, image);
    partie = appliquerTrame(partie, flux.trameDuBattement(battement(4)));
    expect(partie).toEqual(quantifierInstantane(battement(4)));
  });

  it('ne donne chaque image qu une fois, et a personne quand personne n attend', () => {
    const flux = new FluxDEtat();
    flux.trameDuBattement(battement(1));
    flux.trameDuBattement(battement(2));

    expect(flux.imagesAttendues()).toBeUndefined();

    flux.attendreUneImage('a');
    flux.attendreUneImage('b');
    flux.attendreUneImage('a');

    expect(flux.imagesAttendues()?.destinataires).toEqual(['a', 'b']);
    expect(flux.imagesAttendues()).toBeUndefined();
  });

  it('ne double pas l image d un battement qui en envoyait deja une a toute la salle', () => {
    const flux = new FluxDEtat(3);
    flux.trameDuBattement(battement(1));
    flux.trameDuBattement(battement(2));
    flux.trameDuBattement(battement(3));

    flux.attendreUneImage('nouveau');
    expect(lireEnTete(flux.trameDuBattement(battement(4))).nature).toBe('image');

    expect(flux.imagesAttendues()).toBeUndefined();
  });

  it('n a rien a donner avant le premier battement: la premiere trame est une image', () => {
    const flux = new FluxDEtat();
    flux.attendreUneImage('tot');

    expect(flux.imagesAttendues()).toBeUndefined();
  });

  it('refuse une cadence d images absurde', () => {
    expect(() => new FluxDEtat(0)).toThrow();
    expect(() => new FluxDEtat(2.5)).toThrow();
  });
});

/** La vue d'un battement: le bot commun, et un marqueur qui dit de quelle vue il s'agit. */
function vue(tick: number, marqueur: string): InstantanePartie {
  return {
    ...battement(tick),
    entites: [
      ...battement(tick).entites,
      { type: 'bot', id: marqueur, x: 50, y: 50, couleur: '#ABCDEF', direction: 'sud' },
    ],
  };
}

/** Les vues A et B d'un battement. */
function vuesDuBattement(tick: number): ReadonlyMap<string, InstantanePartie> {
  return new Map([
    ['A', vue(tick, 'a')],
    ['B', vue(tick, 'b')],
  ]);
}

/** La nature de chaque envoi, avec ses destinataires. */
function natures(envois: readonly EnvoiDeTrame[]): readonly [readonly string[], string][] {
  return envois.map((envoi) => [envoi.destinataires, lireEnTete(envoi.trame).nature]);
}

/**
 * Des clients qui appliquent les trames recues, comme la page: chacun garde la partie que
 * sa derniere trame a reconstruite, et compte ses trames.
 */
function clients(): {
  recevoir(envois: readonly EnvoiDeTrame[]): void;
  partie(id: string): InstantanePartie | undefined;
  trames(id: string): number;
} {
  const parties = new Map<string, InstantanePartie | undefined>();
  const comptes = new Map<string, number>();

  return {
    recevoir(envois) {
      for (const envoi of envois) {
        for (const id of envoi.destinataires) {
          parties.set(id, appliquerTrame(parties.get(id), envoi.trame) ?? parties.get(id));
          comptes.set(id, (comptes.get(id) ?? 0) + 1);
        }
      }
    },
    partie: (id) => parties.get(id),
    trames: (id) => comptes.get(id) ?? 0,
  };
}

describe('flux d etat par vue (etape 2.9)', () => {
  it('envoie une seule trame a tous ceux qui partagent une vue', () => {
    const flux = new FluxParVue();
    const destinataires = new Map([
      ['alice', 'A'],
      ['bob', 'A'],
    ]);

    flux.envoisDuBattement(vuesDuBattement(1), destinataires);

    expect(natures(flux.envoisDuBattement(vuesDuBattement(2), destinataires))).toEqual([
      [['alice', 'bob'], 'delta'],
    ]);
  });

  it('ouvre chaque vue par une seule image, a tous ceux qui la recoivent', () => {
    const envois = new FluxParVue().envoisDuBattement(
      vuesDuBattement(1),
      new Map([
        ['alice', 'A'],
        ['bob', 'A'],
        ['carole', 'B'],
      ]),
    );

    expect(natures(envois)).toEqual([
      [['alice', 'bob'], 'image'],
      [['carole'], 'image'],
    ]);
  });

  it('fait reconstruire a chaque client exactement sa vue, changements de vue compris', () => {
    const flux = new FluxParVue(10);
    const recus = clients();
    // Alice reste en A; Bob passe de A a B au battement 5, et revient en A au 12.
    const vueDeBob = (tick: number): string => (tick >= 5 && tick < 12 ? 'B' : 'A');

    for (let tick = 1; tick <= 30; tick += 1) {
      const destinataires = new Map([
        ['alice', 'A'],
        ['bob', vueDeBob(tick)],
      ]);
      recus.recevoir(flux.envoisDuBattement(vuesDuBattement(tick), destinataires));

      expect(recus.partie('alice')).toEqual(quantifierInstantane(vue(tick, 'a')));
      expect(recus.partie('bob')).toEqual(
        quantifierInstantane(vue(tick, vueDeBob(tick).toLowerCase())),
      );
    }

    // Une trame par battement, jamais deux: qui change de vue recoit l'image, pas le delta.
    expect(recus.trames('alice')).toBe(30);
    expect(recus.trames('bob')).toBe(30);
  });

  it('ne donne a qui change de vue que l image de sa nouvelle vue', () => {
    const flux = new FluxParVue();
    flux.envoisDuBattement(vuesDuBattement(1), new Map([['bob', 'A']]));
    flux.envoisDuBattement(vuesDuBattement(2), new Map([['bob', 'A']]));

    const envois = flux.envoisDuBattement(vuesDuBattement(3), new Map([['bob', 'B']]));

    expect(natures(envois)).toEqual([[['bob'], 'image']]);
    expect(lireEnTete(envois[0]?.trame as Uint8Array).tick).toBe(3);
  });

  it('donne son image a un nouveau venu, et le delta aux autres', () => {
    const flux = new FluxParVue();
    flux.envoisDuBattement(vuesDuBattement(1), new Map([['alice', 'A']]));

    const envois = flux.envoisDuBattement(
      vuesDuBattement(2),
      new Map([
        ['alice', 'A'],
        ['bob', 'A'],
      ]),
    );

    expect(natures(envois)).toEqual([
      [['alice'], 'delta'],
      [['bob'], 'image'],
    ]);
  });

  it('donne une image a qui l attend, meme sans avoir change de vue, puis les deltas', () => {
    const flux = new FluxParVue();
    const destinataires = new Map([['alice', 'A']]);
    flux.envoisDuBattement(vuesDuBattement(1), destinataires);

    flux.attendreUneImage('alice');

    expect(natures(flux.envoisDuBattement(vuesDuBattement(2), destinataires))).toEqual([
      [['alice'], 'image'],
    ]);
    expect(natures(flux.envoisDuBattement(vuesDuBattement(3), destinataires))).toEqual([
      [['alice'], 'delta'],
    ]);
  });

  it('garde l attente d une connexion absente du battement', () => {
    const flux = new FluxParVue();
    flux.envoisDuBattement(vuesDuBattement(1), new Map([['bob', 'A']]));
    flux.attendreUneImage('bob');

    flux.envoisDuBattement(vuesDuBattement(2), new Map([['alice', 'A']]));

    expect(
      natures(
        flux.envoisDuBattement(
          vuesDuBattement(3),
          new Map([
            ['alice', 'A'],
            ['bob', 'A'],
          ]),
        ),
      ),
    ).toEqual([
      [['alice'], 'delta'],
      [['bob'], 'image'],
    ]);
  });

  it('suit la cadence des images vue par vue', () => {
    const flux = new FluxParVue(3);
    const suite: string[] = [];

    for (let tick = 1; tick <= 7; tick += 1) {
      const envois = flux.envoisDuBattement(vuesDuBattement(tick), new Map([['alice', 'A']]));
      suite.push(lireEnTete(envois[0]?.trame as Uint8Array).nature);
    }

    expect(suite).toEqual(['image', 'delta', 'delta', 'image', 'delta', 'delta', 'image']);
  });

  it('oublie une vue que plus personne ne recoit, qui repart d une image', () => {
    const flux = new FluxParVue();
    flux.envoisDuBattement(vuesDuBattement(1), new Map([['bob', 'B']]));
    flux.envoisDuBattement(vuesDuBattement(2), new Map([['bob', 'A']]));

    const envois = flux.envoisDuBattement(
      vuesDuBattement(3),
      new Map([
        ['bob', 'A'],
        ['carole', 'B'],
      ]),
    );

    expect(natures(envois)).toEqual([
      [['bob'], 'delta'],
      [['carole'], 'image'],
    ]);
  });

  it('n envoie rien a une partie sans destinataire', () => {
    expect(new FluxParVue().envoisDuBattement(vuesDuBattement(1), new Map())).toEqual([]);
  });

  it('refuse une vue attendue qui n est pas fournie, et une cadence absurde', () => {
    expect(() =>
      new FluxParVue().envoisDuBattement(vuesDuBattement(1), new Map([['alice', 'C']])),
    ).toThrow(/« C »/u);
    expect(() => new FluxParVue(0)).toThrow();
  });
});
