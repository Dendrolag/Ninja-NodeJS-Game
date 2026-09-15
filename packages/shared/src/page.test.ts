/**
 * Tests de la politique de securite du contenu de la page.
 *
 * Ce qu'ils protegent: la page servie par le serveur de jeu garde exactement la
 * politique qu'elle avait avant l'etape 5.3, et la page servie ailleurs n'ouvre ses
 * connexions qu'au serveur de jeu nomme, jamais a une adresse mal ecrite.
 */

import { describe, expect, it } from 'vitest';

import { origineValide, politiqueDeContenu } from './page.js';

/** La politique de la page servie par le serveur de jeu lui-meme, telle qu'avant l'etape 5.3. */
const POLITIQUE_MEME_ORIGINE =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; " +
  "media-src 'self'; font-src 'self'; connect-src 'self' data:; worker-src 'self' blob:; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** La directive des connexions d'une politique. */
function connexions(politique: string): string | undefined {
  return politique.split('; ').find((directive) => directive.startsWith('connect-src'));
}

describe('politiqueDeContenu', () => {
  it('ne laisse joindre que l hebergement de la page quand il sert aussi le jeu', () => {
    expect(politiqueDeContenu()).toBe(POLITIQUE_MEME_ORIGINE);
  });

  it('ajoute le serveur de jeu en HTTPS et en WebSocket chiffre, et rien d autre', () => {
    const politique = politiqueDeContenu('https://neon-ninja.onrender.com');

    expect(connexions(politique)).toBe(
      "connect-src 'self' data: https://neon-ninja.onrender.com wss://neon-ninja.onrender.com",
    );
    expect(politique.replace(connexions(politique) ?? '', '')).toBe(
      POLITIQUE_MEME_ORIGINE.replace("connect-src 'self' data:", ''),
    );
  });

  it('garde le port, et ne chiffre pas le WebSocket d un serveur qui ne l est pas', () => {
    expect(connexions(politiqueDeContenu('http://localhost:3000'))).toBe(
      "connect-src 'self' data: http://localhost:3000 ws://localhost:3000",
    );
  });

  it('refuse ce qui n est pas une origine', () => {
    for (const adresse of [
      'neon-ninja.onrender.com',
      'https://neon-ninja.onrender.com/',
      'https://neon-ninja.onrender.com/api',
      'https://Neon-Ninja.onrender.com',
      'ftp://neon-ninja.onrender.com',
      "https://neon-ninja.onrender.com 'unsafe-inline'",
      '',
    ]) {
      expect(() => politiqueDeContenu(adresse), adresse).toThrow(/doit etre une origine/u);
    }
  });
});

describe('origineValide', () => {
  it('reconnait une origine, avec ou sans port', () => {
    expect(origineValide('https://neon-ninja.onrender.com')).toBe(true);
    expect(origineValide('http://127.0.0.1:3000')).toBe(true);
  });

  it('refuse un chemin, une barre finale ou un autre protocole', () => {
    expect(origineValide('https://neon-ninja.onrender.com/')).toBe(false);
    expect(origineValide('wss://neon-ninja.onrender.com')).toBe(false);
    expect(origineValide('neon-ninja.onrender.com')).toBe(false);
  });
});
