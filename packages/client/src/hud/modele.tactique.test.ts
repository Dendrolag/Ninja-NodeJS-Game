/**
 * Tests du HUD d'une partie Tactique (etape 7.7): une minimap qui ne montre que les joueurs
 * proches.
 *
 * Ce que ces tests protegent: la vue plus proche du Tactique. Une minimap qui montrerait
 * tout le monde dirait ou chercher, et le zoom ne cacherait plus rien.
 */

import type { EntiteVue, InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { RAYON_MINIMAP_TACTIQUE_PX, construireHud } from './modele.js';

/** Un joueur sur la carte, a cet endroit. */
function joueur(id: string, x: number, y: number): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur: '#FF0000',
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Le salon d'une partie en cours, dans ce mode. */
function salon(mode: InfosSalon['mode']): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'enCours',
    mode,
    visibilite: 'publique',
    capacite: 12,
    joueurs: [],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Nous au milieu de la carte, un voisin, un joueur au bord du rayon, un autre au loin. */
function etat(mode: InfosSalon['mode']): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    moi: 'moi',
    salon: salon(mode),
    partie: {
      tick: 1,
      tempsRestantMs: 60_000,
      enPause: false,
      entites: [
        joueur('moi', 1000, 1000),
        joueur('voisin', 1300, 1000),
        joueur('bord', 1000, 1000 + RAYON_MINIMAP_TACTIQUE_PX),
        joueur('loin', 2500, 1000),
      ],
      objets: [],
      zones: [],
      classement: [],
    },
  };
}

describe('la minimap d une partie Tactique', () => {
  it('ne montre que les joueurs a portee, nous compris', () => {
    const hud = construireHud(etat('tactique'), 0);

    expect(hud.minimap.map((point) => point.id)).toEqual(['moi', 'voisin', 'bord']);
    expect(hud.portee).toEqual({ x: 1000, y: 1000, rayon: RAYON_MINIMAP_TACTIQUE_PX });
  });

  it('montre tout le monde dans les autres modes, sans disque', () => {
    const hud = construireHud(etat('classique'), 0);

    expect(hud.minimap).toHaveLength(4);
    expect(hud.portee).toBeUndefined();
  });
});
