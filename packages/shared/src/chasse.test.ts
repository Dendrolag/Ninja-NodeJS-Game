/**
 * Tests du mode Chasse vu de toutes les couches (etape 7.3): le camp d'une couleur et les
 * proies restantes.
 */

import { describe, expect, it } from 'vitest';

import { placeDansUnCamp } from './camps.js';
import { campDeCouleur, proiesRestantes } from './chasse.js';
import { COULEUR_DES_TRAQUEURS } from './constantes.js';

const TRAQUEUR = { couleur: COULEUR_DES_TRAQUEURS };
const ROUGE = { couleur: '#FF0000' };

describe('campDeCouleur', () => {
  it('reconnait la couleur des traqueurs, quelle que soit la casse', () => {
    expect(campDeCouleur(COULEUR_DES_TRAQUEURS)).toBe('traqueurs');
    expect(campDeCouleur(COULEUR_DES_TRAQUEURS.toLowerCase())).toBe('traqueurs');
  });

  it('range toute autre couleur parmi les proies', () => {
    expect(campDeCouleur('#FF0000')).toBe('proies');
    expect(campDeCouleur('#123456')).toBe('proies');
  });
});

describe('proiesRestantes', () => {
  it('compte les joueurs qui ne portent pas la couleur des traqueurs', () => {
    expect(proiesRestantes([TRAQUEUR, ROUGE, TRAQUEUR])).toBe(1);
    expect(proiesRestantes([TRAQUEUR, TRAQUEUR])).toBe(0);
  });
});

describe('placeDansUnCamp', () => {
  it('place un vainqueur premier, devant tous ceux qui ne sont pas de son camp', () => {
    expect(
      placeDansUnCamp({ vainqueur: true, vainqueursPresents: 2, nombreJoueurs: 5, presents: 4 }),
    ).toEqual({ placement: 1, devancement: { joueursDevances: 3, partDevancee: 1 } });
  });

  it('place un perdant juste apres les vainqueurs, ne devancant que les abandons', () => {
    expect(
      placeDansUnCamp({ vainqueur: false, vainqueursPresents: 2, nombreJoueurs: 5, presents: 4 }),
    ).toEqual({ placement: 3, devancement: { joueursDevances: 1, partDevancee: 0 } });
    expect(
      placeDansUnCamp({ vainqueur: false, vainqueursPresents: 2, nombreJoueurs: 4, presents: 4 }),
    ).toEqual({ placement: 3, devancement: { joueursDevances: 0, partDevancee: 0 } });
  });
});
