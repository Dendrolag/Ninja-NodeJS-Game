/**
 * Tests de la configuration de la page.
 *
 * Ce qu'ils protegent: un empaquetage de developpement donne une page qui parle au
 * serveur qui l'a servie, sans version; un empaquetage de production donne une page
 * qui parle au serveur nomme, avec sa version.
 */

import { describe, expect, it } from 'vitest';

import { configurationDeLaPage } from './configuration.js';

describe('configurationDeLaPage', () => {
  it('ne nomme ni serveur ni version pour un empaquetage de developpement', () => {
    expect(configurationDeLaPage('', '')).toEqual({});
  });

  it('nomme le serveur de jeu et la version d un empaquetage de production', () => {
    expect(configurationDeLaPage('https://neon-ninja.onrender.com', '4f48889')).toEqual({
      url: 'https://neon-ninja.onrender.com',
      version: '4f48889',
    });
  });

  it('prend chaque valeur independamment de l autre', () => {
    expect(configurationDeLaPage('https://neon-ninja.onrender.com', '')).toEqual({
      url: 'https://neon-ninja.onrender.com',
    });
    expect(configurationDeLaPage('', '4f48889')).toEqual({ version: '4f48889' });
  });
});
