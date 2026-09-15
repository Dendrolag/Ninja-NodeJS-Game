/**
 * Tests des equipes du mode Equipes (etape 7.2): leurs couleurs, le classement des
 * equipes, la place et les points qu'il donne a chacun, l'equipe d'un arrivant, et la
 * validation d'une equipe demandee.
 *
 * Les attentes sont les decisions du porteur du projet du 15 septembre 2026 et les
 * micro-decisions de la fiche 7.2, ecrites en toutes lettres.
 */

import { describe, expect, it } from 'vitest';

import {
  CAPACITES,
  COULEURS_DES_EQUIPES,
  COULEURS_JOUEURS,
  EQUIPES,
  MEMBRES_PAR_EQUIPE_MAXIMUM,
} from './constantes.js';
import type { LigneDeJoueurEnEquipe } from './equipes.js';
import {
  classementDesEquipes,
  equipeDArrivee,
  equipeDeCouleur,
  placeDansLesEquipes,
  pointsEnEquipe,
} from './equipes.js';
import type { PlaceEnFinDePartie } from './progression.js';
import { recompensesDePartie } from './progression.js';
import { validerEquipe } from './validation.js';

const CYAN = COULEURS_DES_EQUIPES.cyan;
const MAGENTA = COULEURS_DES_EQUIPES.magenta;

/** Trois minutes, la duree par defaut d'une partie. */
const TROIS_MINUTES = 180_000;

/** Une ligne de classement de joueur. */
function ligne(
  id: string,
  couleur: string,
  botsPortes: number,
  pointsBotsNoirs = 0,
  captures = 0,
): LigneDeJoueurEnEquipe {
  return { id, couleur, botsPortes, pointsBotsNoirs, captures };
}

describe('les equipes', () => {
  it('portent chacune une couleur de la palette des joueurs, differente de l autre', () => {
    // Etre dans la palette les met a l'abri des bots, qui ne naissent jamais d'une
    // couleur de la palette.
    const couleurs = EQUIPES.map((equipe) => COULEURS_DES_EQUIPES[equipe]);

    expect(new Set(couleurs).size).toBe(EQUIPES.length);
    for (const couleur of couleurs) {
      expect(COULEURS_JOUEURS).toContain(couleur);
    }
  });

  it('tiennent pleines dans la capacite du mode', () => {
    expect(EQUIPES.length * MEMBRES_PAR_EQUIPE_MAXIMUM).toBe(CAPACITES.equipes);
  });
});

describe('equipeDeCouleur', () => {
  it('retrouve l equipe de chaque couleur d equipe', () => {
    for (const equipe of EQUIPES) {
      expect(equipeDeCouleur(COULEURS_DES_EQUIPES[equipe])).toBe(equipe);
    }
  });

  it('ne tient pas compte de la casse', () => {
    expect(equipeDeCouleur('#00ffff')).toBe('cyan');
    expect(equipeDeCouleur('#ff00FF')).toBe('magenta');
  });

  it('ne donne aucune equipe a une autre couleur', () => {
    expect(equipeDeCouleur('#FF0000')).toBeUndefined();
    expect(equipeDeCouleur('#FFFFFF')).toBeUndefined();
  });
});

describe('classementDesEquipes', () => {
  it('fait le score d une equipe de ses bots et des points de bots noirs de ses membres', () => {
    const classement = classementDesEquipes([
      ligne('c1', CYAN, 10, 15, 2),
      ligne('m1', MAGENTA, 30),
      ligne('c2', CYAN, 10, 0, 1),
    ]);

    expect(classement.equipes).toEqual([
      {
        equipe: 'magenta',
        points: 30,
        botsPortes: 30,
        pointsBotsNoirs: 0,
        captures: 0,
        membres: ['m1'],
      },
      {
        equipe: 'cyan',
        points: 25,
        botsPortes: 10,
        pointsBotsNoirs: 15,
        captures: 3,
        membres: ['c1', 'c2'],
      },
    ]);
    expect(classement.issue).toEqual({ type: 'victoire', gagnante: 'magenta' });
  });

  it('declare une egalite a scores egaux, sans autre critere, les equipes dans leur ordre', () => {
    const classement = classementDesEquipes([
      ligne('m1', MAGENTA, 20, 0, 5),
      ligne('c1', CYAN, 20),
    ]);

    expect(classement.issue).toEqual({ type: 'egalite' });
    expect(classement.equipes.map((equipe) => equipe.equipe)).toEqual(['cyan', 'magenta']);
  });

  it('fait gagner la seule equipe qui a des membres', () => {
    const classement = classementDesEquipes([ligne('m1', MAGENTA, 0)]);

    expect(classement.equipes.map((equipe) => equipe.equipe)).toEqual(['magenta']);
    expect(classement.issue).toEqual({ type: 'victoire', gagnante: 'magenta' });
  });

  it('ne fait gagner personne quand aucune equipe n a de membre', () => {
    expect(classementDesEquipes([])).toEqual({ equipes: [], issue: { type: 'egalite' } });
  });

  it('ne compte pas un joueur qui ne porte la couleur d aucune equipe', () => {
    const classement = classementDesEquipes([ligne('c1', CYAN, 3), ligne('x', '#FF0000', 50)]);

    expect(classement.equipes).toHaveLength(1);
    expect(classement.equipes[0]?.membres).toEqual(['c1']);
  });
});

describe('placeDansLesEquipes', () => {
  /** Trois Cyan qui gagnent, deux Magenta qui perdent; un sixieme joueur a abandonne. */
  const victoire = classementDesEquipes([
    ligne('c1', CYAN, 40),
    ligne('c2', CYAN, 40),
    ligne('c3', CYAN, 40),
    ligne('m1', MAGENTA, 10),
    ligne('m2', MAGENTA, 10),
  ]);

  /** Deux contre deux a egalite; un cinquieme joueur a abandonne. */
  const egalite = classementDesEquipes([
    ligne('c1', CYAN, 20),
    ligne('c2', CYAN, 20),
    ligne('m1', MAGENTA, 20),
    ligne('m2', MAGENTA, 20),
  ]);

  it('place un vainqueur premier, devancant tous ceux qui ne sont pas de son equipe', () => {
    expect(placeDansLesEquipes(victoire, 'cyan', 6)).toEqual({
      placement: 1,
      devancement: { joueursDevances: 3, partDevancee: 1 },
    });
  });

  it('place un perdant juste apres les vainqueurs presents, ne devancant que les abandons', () => {
    expect(placeDansLesEquipes(victoire, 'magenta', 6)).toEqual({
      placement: 4,
      devancement: { joueursDevances: 1, partDevancee: 0 },
    });
  });

  it('met tous les presents au milieu en cas d egalite, sans jamais la premiere place', () => {
    expect(placeDansLesEquipes(egalite, 'cyan', 5)).toEqual({
      placement: 3,
      devancement: { joueursDevances: 2, partDevancee: 0.5 },
    });
    expect(placeDansLesEquipes(egalite, 'magenta', 5)).toEqual(
      placeDansLesEquipes(egalite, 'cyan', 5),
    );
  });

  it('donne a un vainqueur, un perdant et une egalite les recompenses de leur rang', () => {
    /** Les gains d'une place, pour un compte present les trois minutes. */
    function gains(place: ReturnType<typeof placeDansLesEquipes>, nombreJoueurs: number) {
      const enFin: PlaceEnFinDePartie = {
        ...place,
        nombreJoueurs,
        tempsJoueMs: TROIS_MINUTES,
        dureePartieMs: TROIS_MINUTES,
        abandon: false,
      };
      return recompensesDePartie(enFin);
    }

    // Trois minutes a 10 XP, plus 20 XP par joueur devance et par minute.
    expect(gains(placeDansLesEquipes(victoire, 'cyan', 6), 6)).toEqual({
      xp: 210,
      pieces: 21,
      variationPointsLigue: 20,
    });
    expect(gains(placeDansLesEquipes(victoire, 'magenta', 6), 6)).toEqual({
      xp: 90,
      pieces: 9,
      variationPointsLigue: -10,
    });
    expect(gains(placeDansLesEquipes(egalite, 'cyan', 5), 5)).toEqual({
      xp: 150,
      pieces: 15,
      variationPointsLigue: 5,
    });
  });
});

describe('pointsEnEquipe', () => {
  it('retient d un joueur sa part des bots de son equipe, plus ses points de bots noirs', () => {
    const classement = classementDesEquipes([
      ligne('c1', CYAN, 40, 15),
      ligne('c2', CYAN, 40),
      ligne('c3', CYAN, 40),
    ]);

    // Quarante bots pour trois membres: une part de treize.
    expect(pointsEnEquipe(classement, ligne('c1', CYAN, 40, 15))).toBe(28);
    expect(pointsEnEquipe(classement, ligne('c2', CYAN, 40))).toBe(13);
  });

  it('ne retient que ses points de bots noirs d un joueur hors de toute equipe', () => {
    expect(pointsEnEquipe(classementDesEquipes([]), ligne('x', '#FF0000', 50, 30))).toBe(30);
  });
});

describe('equipeDArrivee', () => {
  it('choisit l equipe la moins nombreuse', () => {
    expect(equipeDArrivee({ cyan: 2, magenta: 1 }, { cyan: 0, magenta: 90 })).toBe('magenta');
  });

  it('a nombre egal, choisit l equipe qui a le moins de points', () => {
    expect(equipeDArrivee({ cyan: 2, magenta: 2 }, { cyan: 10, magenta: 5 })).toBe('magenta');
  });

  it('a nombre et points egaux, choisit la premiere equipe', () => {
    expect(equipeDArrivee({ cyan: 1, magenta: 1 }, { cyan: 7, magenta: 7 })).toBe('cyan');
  });
});

describe('recompensesDePartie avec un devancement', () => {
  /** La place d'un compte present les trois minutes d'une partie de six joueurs. */
  function place(surcharge: Partial<PlaceEnFinDePartie>): PlaceEnFinDePartie {
    return {
      placement: 1,
      nombreJoueurs: 6,
      tempsJoueMs: TROIS_MINUTES,
      dureePartieMs: TROIS_MINUTES,
      abandon: false,
      ...surcharge,
    };
  }

  it('sans devancement, rend exactement ce que dit le placement', () => {
    for (let placement = 1; placement <= 6; placement += 1) {
      expect(recompensesDePartie(place({ placement }))).toEqual(
        recompensesDePartie(
          place({
            placement,
            devancement: { joueursDevances: 6 - placement, partDevancee: (6 - placement) / 5 },
          }),
        ),
      );
    }
  });

  it('ignore le devancement d un abandon, toujours compte dernier', () => {
    expect(
      recompensesDePartie(
        place({ abandon: true, devancement: { joueursDevances: 5, partDevancee: 1 } }),
      ),
    ).toEqual({ xp: 0, pieces: 0, variationPointsLigue: -10 });
  });

  it('refuse un devancement que le serveur n a pas pu produire', () => {
    for (const devancement of [
      { joueursDevances: 6, partDevancee: 1 },
      { joueursDevances: -1, partDevancee: 0 },
      { joueursDevances: 1.5, partDevancee: 0 },
      { joueursDevances: 2, partDevancee: 1.2 },
      { joueursDevances: 2, partDevancee: Number.NaN },
    ]) {
      expect(() => recompensesDePartie(place({ devancement }))).toThrow(/Devancement impossible/u);
    }
  });
});

describe('validerEquipe', () => {
  it('accepte l identifiant de chaque equipe', () => {
    for (const equipe of EQUIPES) {
      expect(validerEquipe(equipe)).toEqual({ valide: true, valeur: equipe });
    }
  });

  it('refuse ce qui n est pas une equipe', () => {
    for (const brut of ['jaune', 'Cyan', '', 3, undefined, { equipe: 'cyan' }]) {
      expect(validerEquipe(brut)).toEqual({
        valide: false,
        erreurs: [{ champ: 'equipe', motif: "Cette équipe n'existe pas." }],
      });
    }
  });
});
