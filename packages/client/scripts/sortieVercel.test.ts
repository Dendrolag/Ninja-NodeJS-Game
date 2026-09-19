/**
 * Tests de la configuration de la sortie Vercel.
 *
 * Ce qu'ils protegent: la page mise en ligne porte la meme politique de securite
 * que celle du serveur de developpement, ouverte au seul serveur de jeu nomme; les
 * polices se gardent, le reste se revalide; ni les cartes de sources ni les images
 * de collision ne partent en ligne; l'alias de Vercel renvoie a l'adresse canonique
 * (etape 5.6).
 */

import { politiqueDeContenu } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { ADRESSE_CANONIQUE, ALIAS_VERCEL } from './adresses.ts';
import { configurationVercel, fichierDeLaPagePublie, ressourcePubliee } from './sortieVercel.ts';

const SERVEUR = 'https://neon-ninja.onrender.com';

describe('configurationVercel', () => {
  it('pose la politique de securite du serveur de jeu nomme sur toutes les adresses', () => {
    const configuration = configurationVercel(SERVEUR);

    expect(configuration.version).toBe(3);
    expect(configuration.routes).toContainEqual({
      src: '/(.*)',
      headers: {
        'Content-Security-Policy': politiqueDeContenu(SERVEUR),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
      continue: true,
    });
  });

  it('garde un an les polices, dont le nom porte une empreinte, et elles seules', () => {
    const regles = configurationVercel(SERVEUR).routes.filter(
      (route) => 'headers' in route && 'Cache-Control' in route.headers,
    );

    expect(regles).toEqual([
      {
        src: '/polices/(.*)',
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        continue: true,
      },
    ]);
  });

  it('renvoie l alias de Vercel, et lui seul, a l adresse canonique, avant tout le reste', () => {
    const [premiere, ...suivantes] = configurationVercel(SERVEUR).routes;

    expect(premiere).toEqual({
      src: '^/(.*)$',
      has: [{ type: 'host', value: 'neon-ninja-jeu.vercel.app' }],
      status: 308,
      headers: { Location: 'https://ninja.dendrolag.fr/$1' },
    });
    expect(ALIAS_VERCEL).toBe('neon-ninja-jeu.vercel.app');
    expect(ADRESSE_CANONIQUE).toBe('https://ninja.dendrolag.fr');
    // Aucune autre regle ne redirige: l'adresse canonique et celles des
    // deploiements servent la page.
    expect(suivantes.filter((route) => 'status' in route)).toEqual([]);
  });

  it('laisse servir les fichiers apres les en-tetes', () => {
    expect(configurationVercel(SERVEUR).routes.at(-1)).toEqual({ handle: 'filesystem' });
  });

  it('refuse un serveur de jeu qui n est pas une origine', () => {
    expect(() => configurationVercel('https://neon-ninja.onrender.com/')).toThrow(
      /doit etre une origine/u,
    );
  });
});

describe('ce qui part en ligne', () => {
  it('garde la page et laisse les cartes de sources', () => {
    expect(fichierDeLaPagePublie('/web/app.js')).toBe(true);
    expect(fichierDeLaPagePublie('/web/polices/space-mono-latin-400-normal-FIR2AEI6.woff2')).toBe(
      true,
    );
    expect(fichierDeLaPagePublie('/web/app.js.map')).toBe(false);
    expect(fichierDeLaPagePublie('/web/styles.css.map')).toBe(false);
  });

  it('garde les ressources que la page demande, sans les murs ni la documentation', () => {
    expect(ressourcePubliee('/assets/cartes/map1/normal/background.png')).toBe(true);
    expect(ressourcePubliee('/assets/sons/game-start.wav')).toBe(true);
    expect(ressourcePubliee('/assets/cartes')).toBe(true);
    expect(ressourcePubliee('/assets/cartes/map1/normal/collision.png')).toBe(false);
    expect(ressourcePubliee('/assets/README.md')).toBe(false);
  });
});
