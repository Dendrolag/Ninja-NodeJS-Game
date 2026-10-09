/**
 * Tests des statistiques de fin de partie (9 octobre 2026): les colonnes de chaque mode,
 * calculees depuis l'etat de fin, le releve des exploits et l'instant d'entree de chacun.
 *
 * Les etats sont poses a la main, compteurs compris: le calcul ne fait que les lire.
 */

import type { FaitsDePartie, Mode, ReglagesPartiels } from '@neon-ninja/shared';
import {
  COULEURS_DES_EQUIPES,
  MODES,
  STATISTIQUES_DE_FIN,
  STATISTIQUES_PAR_MODE,
} from '@neon-ninja/shared';
import type { EtatPartie, IdentifiantEntite, Joueur } from '@neon-ninja/sim';
import {
  GUERRIER_DE_DEPART,
  ajouterBot,
  ajouterJoueur,
  calculerScores,
  creerEtatInitial,
} from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import { statistiquesDeFin } from './statistiquesDeFin.js';

/** Une partie a deux joueurs, Alice et Bob, dans ce mode. */
function partie(mode: Mode, reglages: ReglagesPartiels = {}): EtatPartie {
  let etat = creerEtatInitial({ graine: 3, mode, reglages: { dureePartieS: 180, ...reglages } });
  etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice' });

  return ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob' });
}

/** Change les compteurs d'un joueur. */
function avec(etat: EtatPartie, id: IdentifiantEntite, compteurs: Partial<Joueur>): EtatPartie {
  return {
    ...etat,
    joueurs: { ...etat.joueurs, [id]: { ...(etat.joueurs[id] as Joueur), ...compteurs } },
  };
}

/** Les statistiques de fin, avec ces faits par joueur et ces instants d'entree. */
function calculer(
  etat: EtatPartie,
  faits: Readonly<Record<IdentifiantEntite, FaitsDePartie>> = {},
  entrees: ReadonlyMap<IdentifiantEntite, number> = new Map(),
): ReturnType<typeof statistiquesDeFin> {
  return statistiquesDeFin(etat, calculerScores(etat), (id) => faits[id] ?? {}, entrees);
}

describe('les colonnes de chaque mode', () => {
  it('existent pour chaque mode, sans doublon, et toutes connues', () => {
    for (const mode of MODES) {
      const colonnes = STATISTIQUES_PAR_MODE[mode];

      expect(colonnes.length, mode).toBeGreaterThan(0);
      expect(new Set(colonnes).size, mode).toBe(colonnes.length);
      expect(
        colonnes.every((colonne) => STATISTIQUES_DE_FIN.includes(colonne)),
        mode,
      ).toBe(true);
    }
  });

  it('ne rendent que les colonnes de la partie, rien de plus', () => {
    const statistiques = calculer(partie('tactique', { evade: false }));

    expect(Object.keys(statistiques.alice ?? {})).toEqual([
      'ninjas',
      'captures',
      'meilleurTir',
      'botsNoirsDetruits',
    ]);
  });
});

describe('les statistiques de la Horde', () => {
  it('lisent les ninjas et les captures dans l etat, le reste dans le releve', () => {
    let etat = avec(partie('classique'), 'alice', { captures: 2, botsNoirsDetruits: 1 });
    for (const numero of [1, 2, 3]) {
      etat = ajouterBot(etat, {
        id: `b${String(numero)}`,
        couleur: (etat.joueurs.alice as Joueur).couleur,
      });
    }

    const statistiques = calculer(etat, {
      alice: { ninjasRallies: 7, meilleurMultiplicateur: 3, evadesAttrapes: 1 },
    });

    expect(statistiques.alice).toEqual({
      ninjas: 3,
      captures: 2,
      ninjasRallies: 7,
      meilleurCombo: 3,
      botsNoirsDetruits: 1,
      evade: 1,
    });
    // Sans combo, rien: la page ecrit un tiret.
    expect(statistiques.bob).toEqual({
      ninjas: 0,
      captures: 0,
      ninjasRallies: 0,
      botsNoirsDetruits: 0,
      evade: 0,
    });
  });
});

describe('les statistiques du Massacre', () => {
  it('separent les PNJ massacres des Black Ninjas, et comptent les joueurs tues', () => {
    let etat = avec(partie('massacre'), 'alice', { captures: 3, botsNoirsDetruits: 2 });
    etat = {
      ...etat,
      massacre: {
        guerriers: { alice: { ...GUERRIER_DE_DEPART, botsTues: 25 } },
        carteVidee: false,
      },
    };

    const statistiques = calculer(etat, { alice: { meilleurMultiplicateur: 4 } });

    expect(statistiques.alice).toEqual({
      ninjasTues: 23,
      joueursTues: 3,
      botsNoirsDetruits: 2,
      meilleurCombo: 4,
      evade: 0,
    });
    expect(statistiques.bob).toEqual({
      ninjasTues: 0,
      joueursTues: 0,
      botsNoirsDetruits: 0,
      evade: 0,
    });
  });
});

describe('les statistiques de la Chasse', () => {
  /** Une Chasse a 100 secondes de jeu: Alice traqueur des le debut, Bob infecte a 40. */
  function chasse(): EtatPartie {
    const etat = avec(partie('chasse'), 'alice', { captures: 1 });

    return {
      ...etat,
      tempsEcouleMs: 100_000,
      chasse: {
        traqueurs: {
          alice: { devenuAMs: 0, vies: 2, orientation: 'est', avantProchainTirMs: 0 },
          bob: { devenuAMs: 40_000, vies: 3, orientation: 'est', avantProchainTirMs: 0 },
        },
        parcours: {},
        traqueursEpuises: false,
      },
    } as EtatPartie;
  }

  it('donnent a une proie infectee le temps tenu, et a un traqueur ses vies', () => {
    const statistiques = calculer(chasse());

    // Alice n'a jamais ete proie: pas de survie.
    expect(statistiques.alice).toEqual({ infections: 1, vies: 2 });
    expect(statistiques.bob).toEqual({ survie: 40_000, infections: 0, vies: 3 });
  });

  it('comptent la survie d une proie depuis son entree en jeu, jusqu a la fin', () => {
    const etat = chasse();
    const sansBob = {
      ...etat,
      chasse: { ...etat.chasse, traqueurs: { alice: etat.chasse?.traqueurs.alice } },
    } as EtatPartie;

    const statistiques = calculer(sansBob, {}, new Map([['bob', 30_000]]));

    // Toujours proie, entree a 30 secondes: soixante-dix secondes tenues, et pas de vies.
    expect(statistiques.bob).toEqual({ survie: 70_000, infections: 0 });
  });
});

describe('les statistiques des Equipes', () => {
  it('donnent a chacun sa part des ninjas de son equipe', () => {
    let etat = partie('equipes');
    etat = avec(etat, 'alice', { couleur: COULEURS_DES_EQUIPES.cyan });
    etat = avec(etat, 'bob', { couleur: COULEURS_DES_EQUIPES.cyan });
    for (const numero of [1, 2, 3, 4, 5]) {
      etat = ajouterBot(etat, { id: `b${String(numero)}`, couleur: COULEURS_DES_EQUIPES.cyan });
    }

    const statistiques = calculer(etat);

    // Cinq ninjas pour deux membres: deux chacun, a l'arrondi inferieur.
    expect(statistiques.alice?.ninjas).toBe(2);
    expect(statistiques.bob?.ninjas).toBe(2);
  });
});
