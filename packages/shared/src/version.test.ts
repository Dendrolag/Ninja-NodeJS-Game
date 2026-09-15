/**
 * Tests du controle de version entre la page et le serveur.
 *
 * Ce qu'ils protegent: un serveur construit d'un commit n'accepte que la page du
 * meme commit, quoi que la page envoie; un serveur sans version accepte tout.
 */

import { describe, expect, it } from 'vitest';

import { versionAcceptee } from './version.js';

const VERSION = '4f48889c1d2e';

describe('versionAcceptee', () => {
  it('accepte la page construite du meme commit', () => {
    expect(versionAcceptee(VERSION, { version: VERSION })).toBe(true);
    expect(versionAcceptee(VERSION, { version: VERSION, jeton: 'j'.repeat(43) })).toBe(true);
  });

  it('refuse la page d un autre commit', () => {
    expect(versionAcceptee(VERSION, { version: 'autre' })).toBe(false);
    expect(versionAcceptee(VERSION, { version: 42 })).toBe(false);
  });

  it('refuse une page qui ne dit pas sa version', () => {
    expect(versionAcceptee(VERSION, {})).toBe(false);
    expect(versionAcceptee(VERSION, { jeton: 'j'.repeat(43) })).toBe(false);
    expect(versionAcceptee(VERSION, undefined)).toBe(false);
    expect(versionAcceptee(VERSION, null)).toBe(false);
    expect(versionAcceptee(VERSION, VERSION)).toBe(false);
  });

  it('ne lit pas une version heritee plutot que portee', () => {
    const heritee: unknown = Object.create({ version: VERSION });

    expect(versionAcceptee(VERSION, heritee)).toBe(false);
  });

  it('laisse un serveur sans version accepter toute page', () => {
    expect(versionAcceptee(undefined, undefined)).toBe(true);
    expect(versionAcceptee(undefined, { version: 'n importe laquelle' })).toBe(true);
  });
});
