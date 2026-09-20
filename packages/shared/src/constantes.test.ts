/**
 * Tests des constantes de jeu.
 *
 * Une constante ne se teste pas pour elle-meme. Ce qui se teste ici, ce sont les
 * valeurs derivees: la conversion des vitesses du legacy, exprimees par pas, en
 * vitesses par seconde. C'est un calcul, donc cela peut se tromper, et c'est le
 * reglage le plus fragile du jeu (point 5 des comportements a preserver).
 */

import { describe, expect, it } from 'vitest';

import { BORNES_REGLAGES } from './bornes.js';
import {
  CADENCES_LEGACY_MS,
  CARTES,
  CARTES_ENREGISTREES,
  DEPLACEMENTS_LEGACY_PAR_PAS,
  PLAFONDS_DE_FAUX_NINJAS,
  VITESSES,
} from './constantes.js';
import type { CarteEnregistree, IdentifiantCarte } from './constantes.js';

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
  it('porte les trois cartes jouables, avec leurs dimensions reelles', () => {
    // Le defaut X5 du legacy renvoyait 2000x1500 meme sur map3. Ici chaque carte
    // porte ses vraies dimensions, et le moteur ne travaille que sur celles-la.
    // Le Quartier s'est ajoute a l'etape 8.2: c'est la carte de travail, la seule
    // dessinee pour ce jeu-ci et non heritee du jeu d'origine.
    expect(CARTES).toEqual({
      map1: { largeur: 2000, hauteur: 1500 },
      map3: { largeur: 3000, hauteur: 2000 },
      quartier: { largeur: 2400, hauteur: 1800 },
    });
  });

  it('garde map2 parmi les cartes enregistrees, sans la rendre jouable (etape 7.6)', () => {
    // L'enumeration de la base en est tiree: perdre map2 rendrait illisibles les
    // parties jouees sur l'ancienne Tokyo sans pluie.
    expect(CARTES_ENREGISTREES).toEqual(['map1', 'map2', 'map3', 'quartier']);
    expect(Object.hasOwn(CARTES, 'map2')).toBe(false);
  });

  it('enregistre toute carte jouable', () => {
    const jouables = Object.keys(CARTES) as IdentifiantCarte[];
    const enregistrables: readonly CarteEnregistree[] = jouables;

    expect(enregistrables.every((carte) => CARTES_ENREGISTREES.includes(carte))).toBe(true);
  });

  it('donne un plafond de faux ninjas a chaque carte, dans la borne des reglages', () => {
    // Decision du porteur du projet du 18 septembre 2026: 300 sur Tokyo, 500 sur Spirit
    // & Time, la meme densite a peu pres. Le Quartier suit la meme densite, appliquee a
    // sa surface reellement tenable, mesuree a l'etape 8.2: 2,60 Mpx a 133 faux ninjas
    // par Mpx donnent 345, arrondis a 340.
    expect(PLAFONDS_DE_FAUX_NINJAS).toEqual({ map1: 300, map3: 500, quartier: 340 });
    expect(Math.max(...Object.values(PLAFONDS_DE_FAUX_NINJAS))).toBe(
      BORNES_REGLAGES.nombreBotsInitial.maximum,
    );
  });
});
