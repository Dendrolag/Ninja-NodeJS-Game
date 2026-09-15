/**
 * Tests des equipes du mode Equipes (etape 7.2): leurs couleurs, et le passage d'une
 * couleur a son equipe.
 */

import { describe, expect, it } from 'vitest';

import {
  CAPACITES,
  COULEURS_DES_EQUIPES,
  COULEURS_JOUEURS,
  EQUIPES,
  MEMBRES_PAR_EQUIPE_MAXIMUM,
} from './constantes.js';
import { equipeDeCouleur } from './equipes.js';

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
