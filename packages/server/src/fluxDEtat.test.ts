/**
 * Tests du flux d'etat d'une partie: quelle trame part, et a qui.
 *
 * Le format lui-meme est teste dans @neon-ninja/shared. Ici on verifie la
 * politique: une image au debut et a intervalle regulier, des deltas entre deux,
 * et une image pour qui arrive en cours de route. Chaque verification decode les
 * trames comme le ferait un client, et compare a l'instantane arrondi du serveur.
 */

import type { InstantanePartie } from '@neon-ninja/shared';
import { appliquerTrame, lireEnTete, quantifierInstantane } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { BATTEMENTS_ENTRE_DEUX_IMAGES, FluxDEtat } from './fluxDEtat.js';

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
