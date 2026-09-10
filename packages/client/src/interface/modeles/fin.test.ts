/**
 * Tests du modele de l'ecran de fin.
 *
 * Le test exige par la fiche 4.3: les donnees affichees correspondent au
 * recapitulatif recu. En jalon 1, ce recapitulatif est le classement definitif de
 * partieTerminee; la progression arrive avec l'etape 3.3. Le meme test est rejoue
 * sur la page construite dans ecrans/fin.test.ts.
 */

import type { LigneClassement } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleFin } from './fin.js';

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
