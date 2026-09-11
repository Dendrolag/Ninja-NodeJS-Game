/**
 * Tests des jetons de session.
 */

import { BORNES_JETON } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { empreinteDuJeton, fabriquerJeton } from './jetons.js';

describe('fabriquerJeton', () => {
  it('fabrique des jetons de la forme que le serveur accepte', () => {
    for (let essai = 0; essai < 50; essai += 1) {
      expect(BORNES_JETON.forme.test(fabriquerJeton())).toBe(true);
    }
  });

  it('ne fabrique jamais deux fois le meme jeton', () => {
    const jetons = new Set(Array.from({ length: 1000 }, () => fabriquerJeton()));

    expect(jetons.size).toBe(1000);
  });
});

describe('empreinteDuJeton', () => {
  it('donne toujours la meme empreinte au meme jeton, et une autre a un autre', () => {
    const jeton = fabriquerJeton();

    expect(empreinteDuJeton(jeton)).toBe(empreinteDuJeton(jeton));
    expect(empreinteDuJeton(jeton)).not.toBe(empreinteDuJeton(fabriquerJeton()));
  });

  it('rend soixante-quatre chiffres hexadecimaux, qui ne contiennent pas le jeton', () => {
    const jeton = fabriquerJeton();
    const empreinte = empreinteDuJeton(jeton);

    expect(empreinte).toMatch(/^[0-9a-f]{64}$/u);
    expect(empreinte).not.toContain(jeton);
  });
});
