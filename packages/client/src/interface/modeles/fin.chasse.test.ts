/**
 * Tests du modele de l'ecran de fin d'une partie Chasse (etape 7.3): le classement et le
 * podium du Classique, aux points, quel que soit le camp.
 */

import type { LigneClassement } from '@neon-ninja/shared';
import { COULEUR_DES_TRAQUEURS, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleFin } from './fin.js';

/** Une ligne du classement final. */
function ligne(id: string, couleur: string, points: number): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur,
    points,
    botsPortes: 0,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

/** Bob, traqueur, a le plus de points; moi, proie, suis deuxieme. */
const CLASSEMENT: readonly LigneClassement[] = [
  ligne('bob', COULEUR_DES_TRAQUEURS, 125),
  ligne('moi', '#FF0000', 80),
  ligne('eve', COULEUR_DES_TRAQUEURS, 40),
];

/** Un client dont la Chasse vient de finir sur ce classement. */
function etat(): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'fin',
    moi: 'moi',
    salon: {
      idRoom: 'room-1',
      statut: 'terminee',
      mode: 'chasse',
      visibilite: 'publique',
      capacite: 10,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    fin: { classement: CLASSEMENT },
  };
}

describe('la fin d une partie Chasse', () => {
  it('classe chacun aux points, avec un podium, comme en Classique', () => {
    const modele = modeleFin(etat());

    expect(modele?.contexte).toBe('Partie terminée · Chasse · Tokyo');
    expect(modele?.place).toEqual({ nombre: 2, suffixe: 'e' });
    expect(modele?.equipes).toBeUndefined();
    expect(modele?.podium.map((marche) => marche.pseudo)).toEqual(['moi', 'bob', 'eve']);
    expect(modele?.lignes.map((une) => [une.rang, une.points])).toEqual([
      [1, 125],
      [2, 80],
      [3, 40],
    ]);
  });

  it('montre la survie, les infections et les vies, un tiret pour ce qui est sans objet', () => {
    const modele = modeleFin({
      ...etat(),
      fin: {
        classement: CLASSEMENT,
        statistiques: {
          // Bob a tenu une minute et cinq secondes avant d'etre infecte.
          bob: { survie: 65_000, infections: 2, vies: 3 },
          // Moi, proie jusqu'au bout: pas de vies de traqueur.
          moi: { survie: 180_000, infections: 0 },
          // Eve, traqueuse des le debut: elle n'a jamais ete proie.
          eve: { infections: 0, vies: 1 },
        },
      },
    });

    expect(modele?.colonnes.map((colonne) => [colonne.entete, colonne.description])).toEqual([
      ['Survie', 'Temps tenu comme proie'],
      ['Infections', 'Proies infectées'],
      ['Vies', 'Vies restantes du traqueur'],
    ]);
    expect(modele?.lignes.map((une) => une.statistiques)).toEqual([
      ['1:05', '2', '3'],
      ['3:00', '0', '—'],
      ['—', '0', '1'],
    ]);
  });
});
