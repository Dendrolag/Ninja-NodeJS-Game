/**
 * Tests de la fabrication des codes de secours et de leur empreinte (etape 3.4).
 */

import { BORNES_CODE_DE_SECOURS, validerCodeDeSecours } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { empreinteDuCode, fabriquerCodeDeSecours } from './codeDeSecours.js';

describe('fabriquerCodeDeSecours', () => {
  it('fabrique un code normalise, que la validation accepte tel quel', () => {
    const code = fabriquerCodeDeSecours();

    expect(code).toMatch(BORNES_CODE_DE_SECOURS.forme);
    expect(validerCodeDeSecours(code)).toEqual({ valide: true, valeur: code });
  });

  it('ne fabrique jamais deux fois le meme code', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => fabriquerCodeDeSecours()));

    expect(codes.size).toBe(2000);
  });

  it('se sert de tout l alphabet, a toutes les positions', () => {
    const codes = Array.from({ length: 2000 }, () => fabriquerCodeDeSecours());
    const { alphabet, longueur } = BORNES_CODE_DE_SECOURS;

    // 2000 tirages par position: un caractere absent d'une position trahirait un
    // bit jamais lu (sa probabilite est negligeable pour un tirage uniforme).
    for (let position = 0; position < longueur; position += 1) {
      const vus = new Set(codes.map((code) => code.charAt(position)));
      expect(vus.size).toBe(alphabet.length);
    }
  });
});

describe('empreinteDuCode', () => {
  it('rend un SHA-256 hexadecimal, le meme pour le meme code', () => {
    const code = fabriquerCodeDeSecours();

    expect(empreinteDuCode(code)).toMatch(/^[0-9a-f]{64}$/u);
    expect(empreinteDuCode(code)).toBe(empreinteDuCode(code));
  });

  it('distingue deux codes', () => {
    expect(empreinteDuCode(fabriquerCodeDeSecours())).not.toBe(
      empreinteDuCode(fabriquerCodeDeSecours()),
    );
  });
});
