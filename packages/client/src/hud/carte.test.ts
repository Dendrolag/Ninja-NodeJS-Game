/**
 * Tests de la carte plein ecran d'Among Ninjas et de notre liste de taches (etape 7.21): nos
 * stations avec leur nom et leur tache, faites cochees, toutes les stations pour un assassin,
 * jamais les autres joueurs; et la station ou un assassin ferait semblant.
 */

import type { EntiteVue, EtatPriveAmong } from '@neon-ninja/shared';
import { CARTES, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { amongHud, carteAmongDe, feinteAPortee } from './among.js';

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

/** Deux stations, la premiere faite par la proie. */
const PROIE: EtatPriveAmong = {
  role: 'proie',
  complices: [],
  fantome: false,
  gong: { x: 1145, y: 630 },
  stations: [
    { x: 170, y: 180, nom: 'Pierre du jardin zen', natures: ['katana'] },
    { x: 630, y: 1295, nom: 'Cuisine du restaurant', natures: ['sang', 'katana'] },
  ],
  taches: [
    { station: 0, nature: 'katana', faite: true },
    { station: 1, nature: 'sang', faite: false },
  ],
  gongUtilise: false,
};

const ASSASSIN: EtatPriveAmong = { ...PROIE, role: 'tueur', taches: [] };

/** Nous, en jeu, a cette place, avec un autre joueur pres de nous, et un cadavre. */
function etat(
  prive: EtatPriveAmong,
  ici = { x: 500, y: 750 },
  phase: 'jeu' | 'vote' = 'jeu',
): EtatClient {
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
      reglages: { ...REGLAGES_PAR_DEFAUT, carte: 'map1' },
    },
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites: [joueur('moi', ici.x, ici.y, '#2EE6FF'), joueur('autre', ici.x + 300, ici.y)],
      objets: [],
      zones: [],
      classement: [],
      among: { phase, restantMs: 0, tachesFaites: 1, tachesTotal: 10 },
    },
    among: { prive, reunion: undefined, morts: [] },
  };
}

describe('la carte plein ecran', () => {
  it('montre a une proie toutes ses stations, leur nom et leur tache, faites cochees', () => {
    const carte = carteAmongDe(etat(PROIE));

    expect(carte?.camp).toBe('proie');
    expect(carte?.reperes).toEqual([
      {
        x: 170 / TOKYO.largeur,
        y: 180 / TOKYO.hauteur,
        titre: 'Aiguiser un katana',
        station: 'Pierre du jardin zen',
        faite: true,
      },
      {
        x: 630 / TOKYO.largeur,
        y: 1295 / TOKYO.hauteur,
        titre: 'Nettoyer du sang',
        station: 'Cuisine du restaurant',
        faite: false,
      },
    ]);
    expect(carte?.titreDeLaListe).toBe('Mes tâches 1 sur 2');
    expect(carte?.liste).toHaveLength(2);
    expect(carte?.moi).toEqual({
      x: 500 / TOKYO.largeur,
      y: 750 / TOKYO.hauteur,
      couleur: '#2EE6FF',
    });
  });

  it('montre a un assassin toutes les stations et leurs taches possibles, sans liste', () => {
    const carte = carteAmongDe(etat(ASSASSIN));

    expect(carte?.camp).toBe('tueur');
    expect(carte?.reperes.map((repere) => repere.titre)).toEqual([
      'Aiguiser un katana',
      'Nettoyer du sang, Aiguiser un katana',
    ]);
    expect(carte?.liste).toEqual([]);
    expect(carte?.titreDeLaListe).toBe('Les tâches des proies');
  });

  it('ne montre jamais les autres joueurs', () => {
    expect(JSON.stringify(carteAmongDe(etat(PROIE)))).not.toContain('FF3030');
  });

  it('n existe pas hors d Among Ninjas, ni avant que la page sache notre role', () => {
    const autreMode = etat(PROIE);

    expect(
      carteAmongDe({
        ...autreMode,
        salon:
          autreMode.salon === undefined ? undefined : { ...autreMode.salon, mode: 'classique' },
      }),
    ).toBeUndefined();
    expect(
      carteAmongDe({ ...autreMode, among: { prive: undefined, reunion: undefined, morts: [] } }),
    ).toBeUndefined();
  });
});

describe('notre liste de taches', () => {
  it('dit chaque tache et sa station, dans l ordre, pour une proie seulement', () => {
    expect(amongHud(etat(PROIE))?.liste).toEqual([
      { titre: 'Aiguiser un katana', station: 'Pierre du jardin zen', faite: true },
      { titre: 'Nettoyer du sang', station: 'Cuisine du restaurant', faite: false },
    ]);
    expect(amongHud(etat(ASSASSIN))?.liste).toEqual([]);
  });
});

describe('la feinte a portee', () => {
  it('est la station d un assassin vivant qui s y tient, en jeu', () => {
    expect(feinteAPortee(etat(ASSASSIN, { x: 640, y: 1290 }))).toBe(1);
    expect(feinteAPortee(etat(ASSASSIN, { x: 900, y: 900 }))).toBeUndefined();
    expect(feinteAPortee(etat(ASSASSIN, { x: 640, y: 1290 }, 'vote'))).toBeUndefined();
  });

  it('n est jamais celle d une proie ni d un assassin fantome', () => {
    expect(feinteAPortee(etat(PROIE, { x: 640, y: 1290 }))).toBeUndefined();
    expect(
      feinteAPortee(etat({ ...ASSASSIN, fantome: true }, { x: 640, y: 1290 })),
    ).toBeUndefined();
  });

  it('cede au gong, qui passe devant', () => {
    const auGong = {
      ...ASSASSIN,
      stations: [{ x: 1150, y: 640, nom: 'Pres du gong', natures: ['mines' as const] }],
    };

    expect(feinteAPortee(etat(auGong, { x: 1150, y: 640 }))).toBeUndefined();
  });
});
