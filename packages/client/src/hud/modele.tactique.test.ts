/**
 * Tests du HUD d'une partie Tactique (etape 7.7): un radar qui ne montre que les joueurs
 * proches.
 *
 * Ce que ces tests protegent: la vue plus proche du Tactique. Un radar qui montrerait tout
 * le monde, meme sur son bord, dirait ou chercher, et le zoom ne cacherait plus rien.
 */

import type { EntiteVue, InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { PORTEE_DU_RADAR_TACTIQUE_PX, construireHud } from './modele.js';

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

/**
 * Nous au milieu de la carte, un voisin, un joueur au bord du rayon, un autre au loin, sous
 * notre Revelation, sans laquelle il n'y a pas de radar.
 */
function etat(mode: InfosSalon['mode']): EtatClient {
  return {
    ...ETAT_INITIAL,
    effets: [
      {
        categorie: 'bonus',
        nature: 'revelation',
        surMoi: true,
        finPrevueA: 10_000,
        dureeMs: 10_000,
      },
    ],
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
        joueur('bord', 1000, 1000 + PORTEE_DU_RADAR_TACTIQUE_PX),
        joueur('loin', 2500, 1000),
      ],
      objets: [],
      zones: [],
      classement: [],
    },
  };
}

describe('le radar d une partie Tactique', () => {
  it('ne montre que les joueurs a portee, nous compris, et rien sur son bord', () => {
    const hud = construireHud(etat('tactique'), 0);

    expect(hud.radar?.map((point) => point.id)).toEqual(['moi', 'voisin', 'bord']);
    expect(hud.radar?.map((point) => point.auBord)).toEqual([false, false, false]);
    expect(hud.radar?.find((point) => point.id === 'bord')).toMatchObject({ x: 0, y: 1 });
  });

  it('montre tout le monde dans les autres modes, au bord au-dela de sa portee', () => {
    const hud = construireHud(etat('classique'), 0);

    expect(hud.radar?.map((point) => point.id)).toEqual(['moi', 'voisin', 'bord', 'loin']);
    expect(hud.radar?.find((point) => point.id === 'loin')).toMatchObject({
      x: 1,
      y: 0,
      auBord: true,
    });
  });
});
