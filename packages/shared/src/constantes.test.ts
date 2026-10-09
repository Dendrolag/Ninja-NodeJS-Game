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
  COULEURS_JOUEURS,
  DEPLACEMENTS_LEGACY_PAR_PAS,
  LUMINANCE_MINIMUM_PNJ,
  PLAFONDS_DE_FAUX_NINJAS,
  VITESSES,
  luminance,
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
  it('porte les cinq cartes jouables, avec leurs dimensions reelles', () => {
    // Le defaut X5 du legacy renvoyait 2000x1500 meme sur map3. Ici chaque carte
    // porte ses vraies dimensions, et le moteur ne travaille que sur celles-la.
    // Le Quartier s'est ajoute a l'etape 8.2: c'est la carte de travail, la seule
    // dessinee pour ce jeu-ci et non heritee du jeu d'origine. Spirit & Time est passee
    // de 3000x2000 a 2400x1760 avec son nouveau decor, a l'etape 8.8. La Station lunaire
    // s'est ajoutee a l'etape 8.9, a la taille de ses images. Prison Island a l'etape 8.11,
    // agrandie de 30 pour cent depuis ses images pour que ses portes laissent passer un ninja.
    expect(CARTES).toEqual({
      map1: { largeur: 2000, hauteur: 1500 },
      map3: { largeur: 2400, hauteur: 1760 },
      quartier: { largeur: 2400, hauteur: 1800 },
      station: { largeur: 2000, hauteur: 1524 },
      prison: { largeur: 2390, hauteur: 1738 },
    });
  });

  it('garde map2 parmi les cartes enregistrees, sans la rendre jouable (etape 7.6)', () => {
    // L'enumeration de la base en est tiree: perdre map2 rendrait illisibles les
    // parties jouees sur l'ancienne Tokyo sans pluie.
    expect(CARTES_ENREGISTREES).toEqual(['map1', 'map2', 'map3', 'quartier', 'station', 'prison']);
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
    // par Mpx donnent 345, arrondis a 340. Spirit & Time, reduite a l'etape 8.8, a 2,73
    // Mpx tenables: 360 (decision du 2 octobre 2026). La Station lunaire, 1,43 Mpx
    // tenables a l'etape 8.9: 190, la meme densite. Prison Island, 0,94 Mpx tenables a
    // l'etape 8.11: 125.
    expect(PLAFONDS_DE_FAUX_NINJAS).toEqual({
      map1: 300,
      map3: 360,
      quartier: 340,
      station: 190,
      prison: 125,
    });
    expect(Math.max(...Object.values(PLAFONDS_DE_FAUX_NINJAS))).toBe(
      BORNES_REGLAGES.nombreBotsInitial.maximum,
    );
  });
});

describe('la luminance des couleurs (etape 5.8)', () => {
  it('va de zero pour le noir a un pour le blanc', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 10);
  });

  it('pese le vert plus que le rouge, et le rouge plus que le bleu, comme l oeil', () => {
    expect(luminance('#00FF00')).toBeCloseTo(0.7152, 4);
    expect(luminance('#FF0000')).toBeCloseTo(0.2126, 4);
    expect(luminance('#0000FF')).toBeCloseTo(0.0722, 4);
  });

  it('classe sous le seuil les couleurs proches du noir, au-dessus les couleurs vives', () => {
    for (const sombre of ['#5A3A1A', '#8B4513', '#00008B', '#7F0000', '#2A3150', '#0000FF']) {
      expect(luminance(sombre)).toBeLessThan(LUMINANCE_MINIMUM_PNJ);
    }
    for (const vive of ['#FF0000', '#808080', '#3D7DFF', '#FFA500']) {
      expect(luminance(vive)).toBeGreaterThanOrEqual(LUMINANCE_MINIMUM_PNJ);
    }
  });

  it('remplace le bleu pur de la palette par un bleu neon eclairci', () => {
    expect(COULEURS_JOUEURS).toContain('#3D7DFF');
    expect(COULEURS_JOUEURS).not.toContain('#0000FF');
  });
});
