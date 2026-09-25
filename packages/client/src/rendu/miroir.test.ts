/**
 * Tests du retournement du decor (etape 8.3).
 *
 * Le rendu lui-meme se verifie de bout en bout (tests/e2e/rendu-miroir.spec.ts), sur
 * une vraie carte graphique. Ici, la regle: ou l'image se pose, et dans quel sens.
 */

import { describe, expect, it } from 'vitest';

import { orienterLeDecor } from './miroir.js';

/** Une image du decor deja etiree: 2000 pixels de carte pour 3000 d'image. */
function imageEtiree(): { x: number; scale: { x: number } } {
  return { x: 0, scale: { x: 2000 / 3000 } };
}

describe('orienterLeDecor', () => {
  it('laisse le decor d une partie normale tel quel', () => {
    const image = imageEtiree();

    orienterLeDecor(image, 2000, false);

    expect(image.x).toBe(0);
    expect(image.scale.x).toBeCloseTo(2000 / 3000);
  });

  it('retourne le decor d une partie en miroir, pose au bord droit de la carte', () => {
    const image = imageEtiree();

    orienterLeDecor(image, 2000, true);

    // Une echelle negative dessine l'image vers la gauche depuis sa position: elle
    // couvre donc toujours la carte, de 2000 a 0.
    expect(image.x).toBe(2000);
    expect(image.scale.x).toBeCloseTo(-2000 / 3000);
  });

  it('garde la taille, et ne retourne pas deux fois une image deja retournee', () => {
    const image = imageEtiree();

    orienterLeDecor(image, 2000, true);
    orienterLeDecor(image, 2000, true);

    expect(image.x).toBe(2000);
    expect(image.scale.x).toBeCloseTo(-2000 / 3000);
  });

  it('remet dans le bon sens une image retournee', () => {
    const image = imageEtiree();

    orienterLeDecor(image, 2000, true);
    orienterLeDecor(image, 2000, false);

    expect(image.x).toBe(0);
    expect(image.scale.x).toBeCloseTo(2000 / 3000);
  });
});
