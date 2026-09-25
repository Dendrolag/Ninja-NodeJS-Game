/**
 * Tests du HUD d'une partie Equipes (etape 7.2): le classement y classe les equipes, et
 * marque la notre.
 *
 * Ce que ces tests protegent: qu'aucun ecran ne presente comme un score personnel les
 * points d'un joueur, qui comptent tous les ninjas de son equipe.
 */

import type { InfosSalon, LigneClassement } from '@neon-ninja/shared';
import { COULEURS_DES_EQUIPES, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import type { VuePartie } from '../reconstruction.js';
import { construireHud } from './modele.js';

const CYAN = COULEURS_DES_EQUIPES.cyan;
const MAGENTA = COULEURS_DES_EQUIPES.magenta;

/** Une ligne de classement d'un joueur en equipe. */
function ligne(
  id: string,
  couleur: string,
  botsPortes: number,
  pointsBotsNoirs = 0,
): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur,
    points: botsPortes + pointsBotsNoirs,
    botsPortes,
    pointsBotsNoirs,
    captures: 0,
    botsNoirsDetruits: pointsBotsNoirs / 15,
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

/** Un client en jeu, sur ce classement, dans ce mode. */
function etat(classement: readonly LigneClassement[], mode: InfosSalon['mode']): EtatClient {
  const partie: VuePartie = {
    tick: 1,
    tempsRestantMs: 90_000,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement,
  };

  return { ...ETAT_INITIAL, ecran: 'jeu', moi: 'moi', partie, salon: salon(mode) };
}

/** Moi et Eve en Cyan (vingt ninjas, un Black Ninja pour moi); Bob seul en Magenta (quarante). */
const CLASSEMENT: readonly LigneClassement[] = [
  ligne('bob', MAGENTA, 40),
  ligne('moi', CYAN, 20, 15),
  ligne('eve', CYAN, 20),
];

describe('le classement du HUD en Equipes', () => {
  it('classe les equipes, la meilleure d abord, et marque la notre', () => {
    expect(construireHud(etat(CLASSEMENT, 'equipes'), 0).classement).toEqual([
      {
        id: 'equipe-magenta',
        pseudo: 'Équipe Magenta',
        couleur: MAGENTA,
        points: 40,
        moi: false,
        rang: 1,
        doubleur: false,
      },
      {
        id: 'equipe-cyan',
        pseudo: 'Équipe Cyan',
        couleur: CYAN,
        points: 35,
        moi: true,
        rang: 2,
        doubleur: false,
      },
    ]);
  });

  it('garde le classement des joueurs dans les autres modes', () => {
    const classement = construireHud(etat(CLASSEMENT, 'classique'), 0).classement;

    expect(classement.map((ligneHud) => ligneHud.id)).toEqual(['bob', 'moi', 'eve']);
    expect(classement[1]).toMatchObject({ points: 35, moi: true, rang: 2 });
  });
});

describe("le x2 de l'Evade au classement des equipes (etape 7.9)", () => {
  it('double le score de l equipe du porteur, et la marque', () => {
    const base = etat(CLASSEMENT, 'equipes');
    const avecX2 = {
      ...base,
      partie: {
        ...base.partie!,
        entites: [
          {
            type: 'joueur' as const,
            id: 'eve',
            x: 0,
            y: 0,
            couleur: CYAN,
            direction: 'sud' as const,
            pseudo: 'eve',
            invincible: false,
            protege: false,
            doubleur: true as const,
          },
        ],
      },
    };
    const classement = construireHud(avecX2, 0).classement;

    expect(classement[0]).toMatchObject({ id: 'equipe-cyan', points: 70, doubleur: true });
    expect(classement[1]).toMatchObject({ id: 'equipe-magenta', doubleur: false });
  });
});
