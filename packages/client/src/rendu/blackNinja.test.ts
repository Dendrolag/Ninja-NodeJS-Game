/**
 * Tests des marques du Black Ninja (etape 5.8): son aura de fumee et la lueur de ses yeux,
 * choisies par le porteur du projet sur la planche docs/design/etape-5-8/.
 */

import { describe, expect, it } from 'vitest';

import { AURA_DU_BLACK_NINJA, YEUX_DU_BLACK_NINJA } from './apparence.js';
import { marquesDuBlackNinja } from './blackNinja.js';

describe('les marques du Black Ninja', () => {
  it('l entourent de volutes sombres, puis de la lueur de ses yeux', () => {
    const marques = marquesDuBlackNinja('noir-1', 500, 400, 0);
    const volutes = marques.filter((disque) => disque.id.startsWith('noir-1:volute'));

    expect(volutes).toHaveLength(AURA_DU_BLACK_NINJA.volutes);
    expect(marques.at(-1)?.id).toBe('noir-1:yeux');
    expect(marques.at(-1)?.remplissage?.couleur).toBe(YEUX_DU_BLACK_NINJA.couleur);
    for (const volute of volutes) {
      expect(volute.remplissage?.couleur).toBe(AURA_DU_BLACK_NINJA.couleur);
      expect(Math.hypot(volute.x - 500, volute.y - 400)).toBeLessThan(30);
    }
  });

  it('font tourner l aura, et respirer la lueur, avec le temps', () => {
    const avant = marquesDuBlackNinja('noir-1', 500, 400, 0);
    const apres = marquesDuBlackNinja('noir-1', 500, 400, 700);

    expect(apres[0]?.x).not.toBeCloseTo(avant[0]?.x ?? 0, 3);
    expect(apres.at(-1)?.remplissage?.alpha).not.toBeCloseTo(
      avant.at(-1)?.remplissage?.alpha ?? 0,
      3,
    );
  });

  it('reviennent au meme dessin apres un tour entier', () => {
    expect(marquesDuBlackNinja('noir-1', 0, 0, AURA_DU_BLACK_NINJA.tourMs)[0]?.x).toBeCloseTo(
      marquesDuBlackNinja('noir-1', 0, 0, 0)[0]?.x ?? 0,
      6,
    );
  });
});
