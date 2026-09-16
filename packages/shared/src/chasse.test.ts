/**
 * Tests du mode Chasse vu de toutes les couches (etape 7.3): le camp d'une couleur,
 * l'issue d'une Chasse, les proies restantes et la place de chacun pour ses recompenses.
 *
 * Les attentes sont les decisions du porteur du projet du 16 septembre 2026
 * (docs/plan/etape-7-3.md): deux camps, et les recompenses par camp des Equipes.
 */

import { describe, expect, it } from 'vitest';

import { placeDansUnCamp } from './camps.js';
import { campDeCouleur, campVainqueur, placeDansLaChasse, proiesRestantes } from './chasse.js';
import { COULEUR_DES_TRAQUEURS } from './constantes.js';
import { recompensesDePartie } from './progression.js';

const TRAQUEUR = { couleur: COULEUR_DES_TRAQUEURS };
const ROUGE = { couleur: '#FF0000' };
const VERT = { couleur: '#00FF00' };

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

describe('campVainqueur et proiesRestantes', () => {
  it('donne la victoire aux proies s il en reste une', () => {
    expect(campVainqueur([TRAQUEUR, ROUGE, TRAQUEUR])).toBe('proies');
    expect(proiesRestantes([TRAQUEUR, ROUGE, TRAQUEUR])).toBe(1);
  });

  it('donne la victoire aux traqueurs quand toutes les proies sont tombees', () => {
    expect(campVainqueur([TRAQUEUR, TRAQUEUR])).toBe('traqueurs');
    expect(proiesRestantes([TRAQUEUR, TRAQUEUR])).toBe(0);
  });
});

describe('placeDansLaChasse', () => {
  it('place les proies survivantes premieres, devant tous les autres, abandons compris', () => {
    // Deux proies survivent, trois traqueurs, et un abandon: six joueurs.
    const classement = [ROUGE, VERT, TRAQUEUR, TRAQUEUR, TRAQUEUR];

    expect(placeDansLaChasse(classement, '#FF0000', 6)).toEqual({
      placement: 1,
      devancement: { joueursDevances: 4, partDevancee: 1 },
    });
  });

  it('place les traqueurs juste apres les proies survivantes, ne devancant que les abandons', () => {
    const classement = [ROUGE, VERT, TRAQUEUR, TRAQUEUR, TRAQUEUR];

    expect(placeDansLaChasse(classement, COULEUR_DES_TRAQUEURS, 6)).toEqual({
      placement: 3,
      devancement: { joueursDevances: 1, partDevancee: 0 },
    });
  });

  it('place tous les traqueurs premiers quand aucune proie ne survit', () => {
    expect(placeDansLaChasse([TRAQUEUR, TRAQUEUR, TRAQUEUR], COULEUR_DES_TRAQUEURS, 4)).toEqual({
      placement: 1,
      devancement: { joueursDevances: 1, partDevancee: 1 },
    });
  });

  it('donne a une proie survivante les recompenses du premier, au traqueur celles du dernier', () => {
    const classement = [ROUGE, TRAQUEUR];
    const partie = { nombreJoueurs: 2, tempsJoueMs: 180_000, dureePartieMs: 180_000 };
    const proie = placeDansLaChasse(classement, '#FF0000', 2);
    const traqueur = placeDansLaChasse(classement, COULEUR_DES_TRAQUEURS, 2);

    expect(recompensesDePartie({ ...partie, ...proie, abandon: false })).toEqual(
      recompensesDePartie({ ...partie, placement: 1, abandon: false }),
    );
    expect(recompensesDePartie({ ...partie, ...traqueur, abandon: false })).toEqual(
      recompensesDePartie({ ...partie, placement: 2, abandon: false }),
    );
  });
});

describe('placeDansUnCamp', () => {
  it('ne fait devancer a un perdant aucun abandon quand il n y en a pas', () => {
    expect(
      placeDansUnCamp({ vainqueur: false, vainqueursPresents: 2, nombreJoueurs: 4, presents: 4 }),
    ).toEqual({ placement: 3, devancement: { joueursDevances: 0, partDevancee: 0 } });
  });
});
