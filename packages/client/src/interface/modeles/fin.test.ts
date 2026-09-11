/**
 * Tests du modele de l'ecran de fin.
 *
 * Le test exige par la fiche 4.3: les donnees affichees correspondent au
 * recapitulatif recu. Ce recapitulatif est le classement definitif de
 * partieTerminee, et, pour un compte, la progression de progressionDeFin (etape
 * 3.3, affichee depuis la reprise des ecrans du jalon 3). Le meme test est rejoue
 * sur la page construite dans ecrans/fin.test.ts et ecrans/fin.progression.test.ts.
 */

import type { LigneClassement, MaProgression, ProgressionEnregistree } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleFin } from './fin.js';
import { formaterNombre } from './progression.js';

/** Une ligne de classement. */
function ligne(id: string, pseudo: string, points: number): LigneClassement {
  return {
    id,
    pseudo,
    couleur: '#FF0000',
    points,
    botsPortes: points,
    pointsBotsNoirs: 0,
    captures: 1,
    botsNoirsDetruits: 0,
  };
}

const CLASSEMENT: readonly LigneClassement[] = [
  ligne('alice', 'Alice', 30),
  ligne('moi', 'Moi', 20),
  ligne('carol', 'Carol', 10),
  ligne('dan', 'Dan', 5),
];

/** Un client dont la partie vient de finir sur ce classement. */
function etat(classement: readonly LigneClassement[], moi = 'moi'): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'fin',
    moi,
    salon: {
      idRoom: 'room-1',
      statut: 'terminee',
      mode: 'classique',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    fin: { classement },
  };
}

describe('modeleFin', () => {
  it('ne rend rien tant que la partie n est pas finie', () => {
    expect(modeleFin(ETAT_INITIAL)).toBeUndefined();
  });

  it('reprend le classement recu, dans son ordre et avec ses nombres', () => {
    const modele = modeleFin(etat(CLASSEMENT));

    expect(
      modele?.lignes.map(({ rang, pseudo, points, botsPortes, captures }) => ({
        rang,
        pseudo,
        points,
        botsPortes,
        captures,
      })),
    ).toEqual(
      CLASSEMENT.map((recue, index) => ({
        rang: index + 1,
        pseudo: recue.pseudo,
        points: recue.points,
        botsPortes: recue.botsPortes,
        captures: recue.captures,
      })),
    );
  });

  it('donne notre place et le mot qui va avec', () => {
    const modele = modeleFin(etat(CLASSEMENT));

    expect(modele?.place).toEqual({ nombre: 2, suffixe: 'e' });
    expect(modele?.message).toBe('Bien joué !');
  });

  it('ecrit la premiere place avec son suffixe', () => {
    const modele = modeleFin(etat(CLASSEMENT, 'alice'));

    expect(modele?.place).toEqual({ nombre: 1, suffixe: 're' });
    expect(modele?.message).toBe('Victoire !');
  });

  it('range le podium comme un vrai podium: deuxieme, premier, troisieme', () => {
    expect(modeleFin(etat(CLASSEMENT))?.podium.map((marche) => marche.pseudo)).toEqual([
      'Moi',
      'Alice',
      'Carol',
    ]);
  });

  it('se contente de deux marches a deux joueurs', () => {
    expect(modeleFin(etat(CLASSEMENT.slice(0, 2)))?.podium.map((marche) => marche.pseudo)).toEqual([
      'Moi',
      'Alice',
    ]);
  });

  it('dit le mode et la carte de la partie', () => {
    expect(modeleFin(etat(CLASSEMENT))?.contexte).toBe('Partie terminée · Classique · Rainy Tokyo');
  });

  it('ne donne aucune place a qui ne figure pas au classement', () => {
    const modele = modeleFin(etat(CLASSEMENT, 'spectateur'));

    expect(modele?.place).toBeUndefined();
    expect(modele?.message).toBe('Partie terminée');
  });
});

describe('la progression de fin', () => {
  const COMPTE: MaProgression = {
    pseudo: 'Moi',
    niveau: 1,
    xpTotale: 90,
    pieces: 1200,
    pointsLigue: 90,
    inscritLe: '2026-09-11T10:00:00.000Z',
  };

  /** Le recapitulatif d'une partie qui fait passer du niveau 1 au 2 et de Bronze a Argent. */
  const ENREGISTREE: ProgressionEnregistree = {
    enregistree: true,
    placement: 2,
    nombreJoueurs: 4,
    xpGagnee: 150,
    piecesGagnees: 1500,
    variationPointsLigue: 10,
    avant: { xpTotale: 90, niveau: 1, pieces: 1200, pointsLigue: 90, palier: 'bronze' },
    apres: { xpTotale: 240, niveau: 2, pieces: 2700, pointsLigue: 100, palier: 'argent' },
  };

  /** Un compte dont la partie vient de finir, avec ou sans recapitulatif. */
  function etatDuCompte(modifications: Partial<EtatClient> = {}): EtatClient {
    return {
      ...etat(CLASSEMENT),
      session: { nature: 'compte', progression: COMPTE },
      ...modifications,
    };
  }

  it('n existe pas pour un invite, qui n a que le classement', () => {
    expect(modeleFin(etat(CLASSEMENT))?.progression).toBeUndefined();
  });

  it('dit qu elle s enregistre tant que le recapitulatif n est pas arrive', () => {
    expect(modeleFin(etatDuCompte())?.progression).toEqual({ nature: 'attente' });
  });

  it('reprend exactement le recapitulatif recu', () => {
    const progression = modeleFin(etatDuCompte({ progressionDeFin: ENREGISTREE }))?.progression;

    // 240 XP: le niveau 2 commence a 100 et coute 200.
    expect(progression).toEqual({
      nature: 'enregistree',
      xp: '+150 XP',
      barre: { niveau: 2, pourCent: 70, xp: '140 / 200 XP' },
      passageDeNiveau: 'Niveau 2 atteint !',
      pieces: `+${formaterNombre(1500)}`,
      variationLigue: '+10',
      sensDeLaLigue: 'hausse',
      palier: 'Argent · 100 points',
      changementDePalier: 'Bronze → Argent',
    });
  });

  it('ne parle ni de niveau ni de palier quand ils n ont pas change, et signe une perte', () => {
    const progression = modeleFin(
      etatDuCompte({
        progressionDeFin: {
          ...ENREGISTREE,
          xpGagnee: 0,
          piecesGagnees: 0,
          variationPointsLigue: -10,
          avant: { ...ENREGISTREE.avant, pointsLigue: 90 },
          apres: { ...ENREGISTREE.avant, pointsLigue: 80 },
        },
      }),
    )?.progression;

    expect(progression).toMatchObject({
      nature: 'enregistree',
      xp: '+0 XP',
      passageDeNiveau: undefined,
      variationLigue: '−10',
      sensDeLaLigue: 'baisse',
      palier: 'Bronze · 80 points',
      changementDePalier: undefined,
    });
  });

  it('dit pourquoi une partie n a pas ete enregistree', () => {
    const progression = modeleFin(
      etatDuCompte({
        progressionDeFin: {
          enregistree: false,
          motif: "Cette partie n'a pas pu être enregistrée.",
        },
      }),
    )?.progression;

    expect(progression).toEqual({
      nature: 'nonEnregistree',
      motif: "Cette partie n'a pas pu être enregistrée.",
    });
  });
});
