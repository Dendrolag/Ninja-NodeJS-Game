/**
 * Tests des constantes de jeu.
 *
 * Une constante ne se teste pas pour elle-meme. Ce qui se teste ici, ce sont les
 * valeurs derivees: la conversion des vitesses du legacy, exprimees par pas, en
 * vitesses par seconde. C'est un calcul, donc cela peut se tromper, et c'est le
 * reglage le plus fragile du jeu (point 5 des comportements a preserver).
 */

import { describe, expect, it } from 'vitest';

import { CADENCES_LEGACY_MS, CARTES, DEPLACEMENTS_LEGACY_PAR_PAS, VITESSES } from './constantes.js';

describe('vitesses', () => {
  it('donne 150 pixels par seconde au joueur', () => {
    // 3 pixels envoyes toutes les 20 millisecondes par le client de bureau.
    expect(VITESSES.JOUEUR_PX_PAR_SECONDE).toBe(150);
  });

  it('donne a tous la vitesse commune, 150 pixels par seconde (etape 7.5)', () => {
    // Le jeu d'origine faisait aller le bot a 100 (5 pixels toutes les 50 ms), et le bot
    // noir comme lui. Decision du porteur du projet du 18 septembre 2026: tout le monde va
    // a la vitesse du joueur, Black Ninjas compris, hors bonus.
    expect(VITESSES.BOT_PX_PAR_SECONDE).toBe(150);
    expect(VITESSES.BOT_NOIR_PX_PAR_SECONDE).toBe(150);
    expect(VITESSES.JOUEUR_PX_PAR_SECONDE).toBe(VITESSES.BOT_PX_PAR_SECONDE);
  });

  it('conserve les valeurs par pas du legacy telles quelles', () => {
    expect(DEPLACEMENTS_LEGACY_PAR_PAS).toEqual({ JOUEUR: 3, BOT: 5, BOT_NOIR: 5 });
    expect(CADENCES_LEGACY_MS).toEqual({ ENVOI_DEPLACEMENT_JOUEUR: 20, BOUCLE_SERVEUR: 50 });
  });
});

describe('cartes', () => {
  it('porte les trois cartes du legacy, avec leurs dimensions reelles', () => {
    // Le defaut X5 du legacy renvoyait 2000x1500 meme sur map3. Ici chaque carte
    // porte ses vraies dimensions, et le moteur ne travaille que sur celles-la.
    expect(CARTES.map1).toEqual({ largeur: 2000, hauteur: 1500 });
    expect(CARTES.map2).toEqual({ largeur: 2000, hauteur: 1500 });
    expect(CARTES.map3).toEqual({ largeur: 3000, hauteur: 2000 });
  });
});
