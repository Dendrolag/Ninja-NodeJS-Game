/**
 * Tests du decodage du terrain.
 *
 * Ils couvrent la frontiere entre le disque et le moteur: une image entre, une
 * carte de murs sort. Deux familles de tests, pour deux risques differents.
 *
 *   1. Sur des images FABRIQUEES ICI, dont on connait chaque pixel: c'est la
 *      seule maniere de verifier que le seuil, le redimensionnement et
 *      l'orientation sont justes, sans dependre du contenu des cartes.
 *   2. Sur les VRAIES images du jeu, pour verifier qu'elles se lisent, qu'elles
 *      donnent les bonnes dimensions, et qu'elles contiennent bien des murs. Ce
 *      dernier point compte: pendant toutes les etapes precedentes, le jeu
 *      tournait sur une carte vide sans que rien ne le signale.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IdentifiantCarte } from '@neon-ninja/shared';
import { CARTES, REGLAGES_PAR_DEFAUT, cheminCarte } from '@neon-ninja/shared';
import { carteSansMur, estMur, positionTenable } from '@neon-ninja/sim';
import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';

import { creerServeur } from './serveur.js';
import type { CleDeTerrain, SourceDeTerrain } from './terrain.js';
import {
  ChargeurDeTerrain,
  SANS_TERRAIN,
  racineRessources,
  redimensionner,
  terrainDepuisImage,
} from './terrain.js';

/**
 * Fabrique une image PNG dont chaque pixel est decide par une fonction.
 *
 * @param peindre Rend true pour un pixel noir (un mur), false pour un blanc.
 */
function imagePng(
  largeur: number,
  hauteur: number,
  peindre: (x: number, y: number) => boolean,
): Buffer {
  const png = new PNG({ width: largeur, height: hauteur });

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const depart = (y * largeur + x) * 4;
      const valeur = peindre(x, y) ? 0 : 255;
      png.data[depart] = valeur;
      png.data[depart + 1] = valeur;
      png.data[depart + 2] = valeur;
      png.data[depart + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

describe('terrainDepuisImage', () => {
  it('fait un mur d un pixel sombre et du sol d un pixel clair', () => {
    const image = imagePng(4, 4, (x) => x < 2);
    const terrain = terrainDepuisImage(image, { largeur: 4, hauteur: 4 });

    expect(estMur(terrain, 0, 0)).toBe(true);
    expect(estMur(terrain, 1, 3)).toBe(true);
    expect(estMur(terrain, 2, 0)).toBe(false);
    expect(estMur(terrain, 3, 3)).toBe(false);
  });

  it('lit l image dans le bon sens, ligne par ligne depuis le coin superieur gauche', () => {
    // Une seule case noire, en bas a droite. Une lecture inversee la placerait
    // ailleurs, et ce test est le seul a pouvoir le dire.
    const image = imagePng(3, 2, (x, y) => x === 2 && y === 1);
    const terrain = terrainDepuisImage(image, { largeur: 3, hauteur: 2 });

    expect(estMur(terrain, 2, 1)).toBe(true);
    expect(estMur(terrain, 0, 0)).toBe(false);
    expect(estMur(terrain, 2, 0)).toBe(false);
    expect(estMur(terrain, 0, 1)).toBe(false);
  });

  it('ramene l image aux dimensions de la carte quand elles different', () => {
    // Moitie gauche noire sur une image deux fois trop large: apres reduction,
    // la moitie gauche de la carte doit toujours etre un mur.
    const image = imagePng(8, 4, (x) => x < 4);
    const terrain = terrainDepuisImage(image, { largeur: 4, hauteur: 2 });

    expect(terrain.largeur).toBe(4);
    expect(terrain.hauteur).toBe(2);
    expect(estMur(terrain, 0, 0)).toBe(true);
    expect(estMur(terrain, 1, 1)).toBe(true);
    expect(estMur(terrain, 2, 0)).toBe(false);
    expect(estMur(terrain, 3, 1)).toBe(false);
  });

  it('refuse une image dont les dimensions ne collent pas apres redimensionnement', () => {
    // Le redimensionnement ne peut pas inventer de pixels: une image d'une
    // largeur nulle n'existe pas, mais une carte de dimensions absurdes doit
    // etre refusee par le moteur, pas silencieusement acceptee.
    const image = imagePng(4, 4, () => false);

    expect(() => terrainDepuisImage(image, { largeur: 0, hauteur: 4 })).toThrow();
  });
});

describe('redimensionner', () => {
  it('rend l image telle quelle quand les dimensions sont deja les bonnes', () => {
    const pixels = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const rendu = redimensionner(pixels, { largeur: 2, hauteur: 1 }, { largeur: 2, hauteur: 1 });

    expect(rendu).toBe(pixels);
  });

  it('moyenne les pixels source au lieu d en prelever un seul', () => {
    // Deux pixels source pour un pixel de destination: un noir, un blanc. Un
    // simple prelevement rendrait 0 ou 255; la moyenne rend le gris du milieu.
    // C'est ce qui evite qu'un mur fin disparaisse a la reduction.
    const pixels = Uint8Array.from([0, 0, 0, 255, 255, 255, 255, 255]);
    const rendu = redimensionner(pixels, { largeur: 2, hauteur: 1 }, { largeur: 1, hauteur: 1 });

    expect([...rendu]).toEqual([128, 128, 128, 255]);
  });
});

describe('ChargeurDeTerrain', () => {
  it('decode une carte depuis le disque et la garde en memoire', () => {
    const racine = mkdtempSync(join(tmpdir(), 'neon-terrain-'));
    const chemin = cheminCarte('map1', false, 'collision');
    mkdirSync(join(racine, chemin, '..'), { recursive: true });
    writeFileSync(
      join(racine, chemin),
      imagePng(20, 15, (x) => x < 10),
    );

    const chargeur = new ChargeurDeTerrain(racine);
    expect(chargeur.tailleDuCache).toBe(0);

    const premier = chargeur.charger({ carte: 'map1', modeMiroir: false });
    const second = chargeur.charger({ carte: 'map1', modeMiroir: false });

    expect(premier.largeur).toBe(CARTES.map1.largeur);
    expect(premier.hauteur).toBe(CARTES.map1.hauteur);
    // La meme carte demandee deux fois n'est decodee qu'une, et c'est la meme
    // donnee qui est partagee: la carte est en lecture seule, la partager est
    // sans risque et economise plusieurs megaoctets par partie.
    expect(second).toBe(premier);
    expect(chargeur.tailleDuCache).toBe(1);
  });

  it('distingue la carte normale de sa version miroir', () => {
    const racine = mkdtempSync(join(tmpdir(), 'neon-terrain-'));

    for (const modeMiroir of [false, true]) {
      const chemin = cheminCarte('map1', modeMiroir, 'collision');
      mkdirSync(join(racine, chemin, '..'), { recursive: true });
      // Le mur est a gauche sur la normale, a droite sur la miroir.
      writeFileSync(
        join(racine, chemin),
        imagePng(20, 15, (x) => (modeMiroir ? x >= 10 : x < 10)),
      );
    }

    const chargeur = new ChargeurDeTerrain(racine);
    const normale = chargeur.charger({ carte: 'map1', modeMiroir: false });
    const miroir = chargeur.charger({ carte: 'map1', modeMiroir: true });

    expect(estMur(normale, 10, 10)).toBe(true);
    expect(estMur(miroir, 10, 10)).toBe(false);
    expect(chargeur.tailleDuCache).toBe(2);
  });

  it('leve une erreur quand l image de collision manque', () => {
    const chargeur = new ChargeurDeTerrain(join(tmpdir(), 'neon-terrain-inexistant'));

    expect(() => chargeur.charger({ carte: 'map1', modeMiroir: false })).toThrow();
  });
});

describe('SANS_TERRAIN', () => {
  it('ne fournit aucun mur, sans lever d erreur', () => {
    expect(SANS_TERRAIN.charger({ carte: 'map1', modeMiroir: false })).toBeUndefined();
  });
});

describe('les vraies cartes du jeu', () => {
  const chargeur = new ChargeurDeTerrain(racineRessources());

  // Toutes les cartes jouables, et non une liste ecrite a la main: une carte
  // ajoutee sans image se signalerait ici plutot qu'a l'ecran (etape 8.2).
  for (const carte of Object.keys(CARTES) as IdentifiantCarte[]) {
    for (const modeMiroir of [false, true]) {
      it(`decode ${carte} ${modeMiroir ? 'miroir' : 'normale'} avec de vrais murs`, () => {
        const terrain = chargeur.charger({ carte, modeMiroir });

        expect(terrain.largeur).toBe(CARTES[carte].largeur);
        expect(terrain.hauteur).toBe(CARTES[carte].hauteur);

        // Le point du test: il y a des murs. Une carte vide passerait toutes
        // les verifications de dimensions ci-dessus, et c'est exactement ce sur
        // quoi le jeu tournait jusqu'ici.
        let murs = 0;
        for (let y = 0; y < terrain.hauteur; y += 20) {
          for (let x = 0; x < terrain.largeur; x += 20) {
            if (estMur(terrain, x, y)) {
              murs += 1;
            }
          }
        }

        expect(murs).toBeGreaterThan(0);
      });
    }
  }
});

/**
 * Le Quartier est la carte de travail de l'etape 8.2, et la seule dessinee pour ce
 * jeu-ci: un programme du depot la produit (docs/mesures/dessiner-le-quartier.mjs).
 * Ce test garde l'invariant qui la rendrait injouable si elle etait redessinee de
 * travers, et que l'oeil ne voit pas sur l'image.
 */
describe('la carte de travail Quartier', () => {
  const chargeur = new ChargeurDeTerrain(racineRessources());

  /** Les huit voisines d'une case, diagonales comprises. */
  const VOISINES = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;

  for (const modeMiroir of [false, true]) {
    it(`n enferme personne ${modeMiroir ? 'en miroir' : 'en normal'}`, () => {
      const terrain = chargeur.charger({ carte: 'quartier', modeMiroir });

      // UNE COUR DONT L'UNIQUE OUVERTURE DONNE SUR LE BORD DE LA CARTE EST UN
      // PIEGE: le dehors est un mur, la cour devient un morceau a part, et un
      // joueur qui y apparait y passe la partie entiere. C'est arrive au premier
      // dessin, et cela ne se voyait pas sur l'image. Ici on parcourt la carte
      // depuis un seul point et on verifie qu'on atteint tout le reste.
      // Quatre pixels, et les diagonales admises: c'est le modele de
      // docs/mesures/mesurer-les-cartes.mjs, qui a servi a juger la carte. Un pas
      // plus large isolerait des cases que le jeu relie, et dirait la carte cassee
      // alors qu'elle ne l'est pas.
      const pas = 4;
      const largeur = Math.floor(terrain.largeur / pas);
      const hauteur = Math.floor(terrain.hauteur / pas);
      const tenable = new Uint8Array(largeur * hauteur);
      let total = 0;

      for (let ligne = 0; ligne < hauteur; ligne += 1) {
        for (let colonne = 0; colonne < largeur; colonne += 1) {
          const position = { x: colonne * pas + pas / 2, y: ligne * pas + pas / 2 };

          if (positionTenable(terrain, position)) {
            tenable[ligne * largeur + colonne] = 1;
            total += 1;
          }
        }
      }

      expect(total).toBeGreaterThan(0);

      const depart = tenable.indexOf(1);
      const vues = new Uint8Array(largeur * hauteur);
      const pile = [depart];
      vues[depart] = 1;
      let atteintes = 1;

      while (pile.length > 0) {
        const case_ = pile.pop() as number;
        const colonne = case_ % largeur;
        const ligne = (case_ - colonne) / largeur;

        for (const [dx, dy] of VOISINES) {
          const voisineColonne = colonne + dx;
          const voisineLigne = ligne + dy;

          if (
            voisineColonne < 0 ||
            voisineColonne >= largeur ||
            voisineLigne < 0 ||
            voisineLigne >= hauteur
          ) {
            continue;
          }

          const voisine = voisineLigne * largeur + voisineColonne;

          if (tenable[voisine] === 1 && vues[voisine] === 0) {
            vues[voisine] = 1;
            atteintes += 1;
            pile.push(voisine);
          }
        }
      }

      expect(atteintes).toBe(total);
    });
  }
});

describe('le serveur demande le terrain de la carte jouee', () => {
  /**
   * Une source qui note ce qu'on lui demande.
   *
   * Ce que ce test protege est un cablage, pas un calcul: le decodage est couvert
   * plus haut, mais rien ne garantissait jusqu'ici que quelqu'un l'appelle. C'est
   * exactement la forme du defaut que ce projet trainait depuis l'etape 2.1: le
   * moteur savait tenir un terrain, personne ne lui en donnait.
   */
  function sourceEspionne(): SourceDeTerrain & { demandes: CleDeTerrain[] } {
    const demandes: CleDeTerrain[] = [];

    return {
      demandes,
      charger(cle) {
        demandes.push(cle);
        return carteSansMur(CARTES[cle.carte]);
      },
    };
  }

  it('charge le terrain a l ouverture d une partie', async () => {
    const terrains = sourceEspionne();
    const serveur = creerServeur({ terrains });

    serveur.jeu.ouvrirUneRoom({ reglages: { carte: 'map3', modeMiroir: true } });

    expect(terrains.demandes).toEqual([{ carte: 'map3', modeMiroir: true }]);

    await serveur.fermer();
  });

  it('prend la carte par defaut quand l hote n en choisit pas', async () => {
    const terrains = sourceEspionne();
    const serveur = creerServeur({ terrains });

    serveur.jeu.ouvrirUneRoom();

    expect(terrains.demandes).toEqual([
      { carte: REGLAGES_PAR_DEFAUT.carte, modeMiroir: REGLAGES_PAR_DEFAUT.modeMiroir },
    ]);

    await serveur.fermer();
  });

  it('joue sans mur plutot que de tomber quand le terrain est illisible', async () => {
    const terrains: SourceDeTerrain = {
      charger() {
        throw new Error('image absente');
      },
    };

    // L'incident est journalise, et c'est voulu en production. Ici on verifie
    // qu'il l'est, sans laisser la trace polluer la sortie des tests.
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const serveur = creerServeur({ terrains });

    expect(() => serveur.jeu.ouvrirUneRoom()).not.toThrow();
    expect(avertissement).toHaveBeenCalledOnce();

    avertissement.mockRestore();
    await serveur.fermer();
  });
});
