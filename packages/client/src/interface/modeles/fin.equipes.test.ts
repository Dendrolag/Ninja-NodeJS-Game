/**
 * Tests du modele de l'ecran de fin d'une partie Equipes (etape 7.2): l'issue dite au
 * titre, les equipes a la place du podium, et chaque joueur avec sa part.
 */

import type { LigneClassement } from '@neon-ninja/shared';
import { COULEURS_DES_EQUIPES, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleFin } from './fin.js';

const CYAN = COULEURS_DES_EQUIPES.cyan;
const MAGENTA = COULEURS_DES_EQUIPES.magenta;

/** Une ligne du classement final d'un joueur en equipe. */
function ligne(
  id: string,
  couleur: string,
  botsPortes: number,
  pointsBotsNoirs = 0,
  captures = 0,
): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur,
    points: botsPortes + pointsBotsNoirs,
    botsPortes,
    pointsBotsNoirs,
    captures,
    botsNoirsDetruits: pointsBotsNoirs / 15,
  };
}

/** Moi et Carole en Cyan, trente ninjas et un Black Ninja; Bob seul en Magenta, vingt. */
const CLASSEMENT: readonly LigneClassement[] = [
  ligne('moi', CYAN, 30, 15, 2),
  ligne('bob', MAGENTA, 20),
  ligne('carole', CYAN, 30, 0, 1),
];

/** Un client dont la partie Equipes vient de finir sur ce classement. */
function etat(classement: readonly LigneClassement[], moi = 'moi'): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'fin',
    moi,
    salon: {
      idRoom: 'room-1',
      statut: 'terminee',
      mode: 'equipes',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    fin: { classement },
  };
}

describe('la fin d une partie Equipes', () => {
  it('dit la victoire de notre equipe, et classe les equipes a la place du podium', () => {
    const modele = modeleFin(etat(CLASSEMENT));

    expect(modele?.contexte).toBe('Partie terminée · Équipes · Rainy Tokyo');
    expect(modele?.message).toBe('Victoire de votre équipe !');
    expect(modele?.place).toBeUndefined();
    expect(modele?.podium).toEqual([]);
    expect(modele?.equipes).toEqual([
      { equipe: 'cyan', nom: 'Équipe Cyan', couleur: CYAN, points: 45, captures: 3, mienne: true },
      {
        equipe: 'magenta',
        nom: 'Équipe Magenta',
        couleur: MAGENTA,
        points: 20,
        captures: 0,
        mienne: false,
      },
    ]);
  });

  it('range les joueurs par equipe, chacun avec sa part et son rang d equipe', () => {
    const modele = modeleFin(etat(CLASSEMENT));

    expect(
      modele?.lignes.map(({ id, rang, points, botsPortes, moi }) => ({
        id,
        rang,
        points,
        botsPortes,
        moi,
      })),
    ).toEqual([
      // Trente ninjas pour deux membres: une part de quinze, plus quinze points de Black Ninja.
      { id: 'moi', rang: 1, points: 30, botsPortes: 15, moi: true },
      { id: 'carole', rang: 1, points: 15, botsPortes: 15, moi: false },
      { id: 'bob', rang: 3, points: 20, botsPortes: 20, moi: false },
    ]);
  });

  it('dit la victoire de l autre equipe a un perdant', () => {
    expect(modeleFin(etat(CLASSEMENT, 'bob'))?.message).toBe('Victoire de l’équipe Cyan');
  });

  it('dit l egalite, et place tout le monde au meme rang', () => {
    const modele = modeleFin(etat([ligne('moi', CYAN, 20), ligne('bob', MAGENTA, 20)]));

    expect(modele?.message).toBe('Égalité !');
    expect(modele?.lignes.map((ligneFin) => ligneFin.rang)).toEqual([2, 2]);
  });
});
