/**
 * Tests de la mini-carte d'Among Ninjas (decision 24 de la fiche 7.20): notre position, nos
 * stations a faire, ou toutes les stations actives pour un assassin, le gong, et jamais les
 * autres joueurs.
 */

import type { EntiteVue, EtatPriveAmong } from '@neon-ninja/shared';
import { CARTES, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { amongHud } from './among.js';

const TOKYO = CARTES.map1;

/** Un joueur vu a cette place. */
function joueur(id: string, x: number, y: number, couleur = '#FF3030'): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur,
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Trois stations actives, dont la premiere deja faite par la proie. */
const PROIE: EtatPriveAmong = {
  role: 'proie',
  complices: [],
  fantome: false,
  gong: { x: 1000, y: 750 },
  stations: [
    { x: 200, y: 150 },
    { x: 1000, y: 300 },
    { x: 1800, y: 1350 },
  ],
  taches: [
    { station: 0, dureeMs: 5000, faite: true },
    { station: 2, dureeMs: 6000, faite: false },
  ],
  gongUtilise: false,
};

/** Nous, en jeu, a cette place, avec un autre joueur en vue. */
function etat(prive: EtatPriveAmong, miroir = false): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    moi: 'moi',
    salon: {
      idRoom: 'room-1',
      statut: 'enCours',
      mode: 'among',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: { ...REGLAGES_PAR_DEFAUT, carte: 'map1', modeMiroir: miroir },
    },
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites: [joueur('moi', 500, 750, '#2EE6FF'), joueur('autre', 520, 760)],
      objets: [],
      zones: [],
      classement: [],
      among: { phase: 'jeu', restantMs: 0, tachesFaites: 1, tachesTotal: 10 },
    },
    among: { prive, reunion: undefined, morts: [] },
  };
}

describe('la mini-carte d Among Ninjas', () => {
  it('montre a une proie ses stations a faire, le gong et sa place, en part de la carte', () => {
    const minimap = amongHud(etat(PROIE), 0)?.minimap;

    expect(minimap?.stations).toEqual([{ x: 1800 / TOKYO.largeur, y: 1350 / TOKYO.hauteur }]);
    expect(minimap?.gong).toEqual({ x: 0.5, y: 0.5 });
    expect(minimap?.moi).toEqual({ x: 0.25, y: 0.5, couleur: '#2EE6FF' });
    expect(minimap?.proportions).toBeCloseTo(TOKYO.largeur / TOKYO.hauteur);
    expect(minimap?.fond).toMatch(/background/u);
    // Jamais les autres joueurs: la mini-carte n'a qu'un point de joueur, le notre.
    expect(JSON.stringify(minimap)).not.toContain('FF3030');
  });

  it('montre a un assassin toutes les stations actives, celles des proies', () => {
    const assassin: EtatPriveAmong = { ...PROIE, role: 'tueur', complices: [], taches: [] };

    expect(amongHud(etat(assassin), 0)?.minimap.stations).toHaveLength(3);
  });

  it('retourne le fond en miroir, les lieux l etant deja', () => {
    expect(amongHud(etat(PROIE, true), 0)?.minimap.miroir).toBe(true);
    expect(amongHud(etat(PROIE), 0)?.minimap.miroir).toBe(false);
  });
});
