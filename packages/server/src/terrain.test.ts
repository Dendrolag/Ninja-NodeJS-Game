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

import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IdentifiantCarte } from '@neon-ninja/shared';
import { CARTES, REGLAGES_PAR_DEFAUT, cheminCarte, creerAlea } from '@neon-ninja/shared';
import {
  carteSansMur,
  dansLeMorceauPrincipal,
  estMur,
  positionDApparition,
  positionTenable,
} from '@neon-ninja/sim';
import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';

import { creerServeur } from './serveur.js';
import type { CleDeTerrain, SourceDeTerrain } from './terrain.js';
import {
  ChargeurDeTerrain,
  SANS_TERRAIN,
  racineRessources,
  redimensionner,
  retournerHorizontalement,
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

  it('en miroir, place le mur de l autre cote', () => {
    const image = imagePng(4, 2, (x) => x === 0);
    const normal = terrainDepuisImage(image, { largeur: 4, hauteur: 2 });
    const miroir = terrainDepuisImage(image, { largeur: 4, hauteur: 2 }, true);

    expect(estMur(normal, 0, 1)).toBe(true);
    expect(estMur(normal, 3, 1)).toBe(false);
    expect(estMur(miroir, 0, 1)).toBe(false);
    expect(estMur(miroir, 3, 1)).toBe(true);
  });

  it('en miroir, rend les murs qu aurait donnes l image livree deja retournee', () => {
    // C'est la garantie de l'etape 8.3: le calcul refait ce que faisait l'image du
    // dossier mirror. Le cas difficile est un etirement a echelle non entiere, qui
    // n'est pas symetrique: retourner apres l'etirement deplacerait des murs. Une
    // image de 7 sur 5 ramenee a 3 sur 2, avec des motifs qui ne se ressemblent pas
    // de gauche a droite.
    const motif = (x: number, y: number): boolean => (x * 3 + y * 5) % 4 === 0 || x === 6;
    const dimensions = { largeur: 3, hauteur: 2 };

    const calcule = terrainDepuisImage(imagePng(7, 5, motif), dimensions, true);
    const livre = terrainDepuisImage(
      imagePng(7, 5, (x, y) => motif(6 - x, y)),
      dimensions,
    );

    expect([...calcule.murs]).toEqual([...livre.murs]);
  });
});

describe('retournerHorizontalement', () => {
  /** Une image de 3 sur 2, chaque pixel portant son numero dans ses quatre octets. */
  const numerotee = Uint8Array.from({ length: 6 * 4 }, (_, octet) => Math.floor(octet / 4));

  it('echange les colonnes de chaque ligne, sans toucher aux lignes', () => {
    const retournee = retournerHorizontalement(numerotee, { largeur: 3, hauteur: 2 });
    const pixels = Array.from({ length: 6 }, (_, pixel) => retournee[pixel * 4]);

    expect(pixels).toEqual([2, 1, 0, 5, 4, 3]);
  });

  it('garde les quatre octets de chaque pixel ensemble', () => {
    const couleur = Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80]);

    expect([...retournerHorizontalement(couleur, { largeur: 2, hauteur: 1 })]).toEqual([
      50, 60, 70, 80, 10, 20, 30, 40,
    ]);
  });

  it('retournee deux fois, l image revient telle quelle', () => {
    const dimensions = { largeur: 3, hauteur: 2 };
    const deuxFois = retournerHorizontalement(
      retournerHorizontalement(numerotee, dimensions),
      dimensions,
    );

    expect([...deuxFois]).toEqual([...numerotee]);
  });

  it('ne modifie pas l image recue', () => {
    const copie = Uint8Array.from(numerotee);
    retournerHorizontalement(numerotee, { largeur: 3, hauteur: 2 });

    expect([...numerotee]).toEqual([...copie]);
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
    const chemin = cheminCarte('map1', 'collision');
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

  it('precharge toutes les cartes, dans les deux sens', () => {
    // Etape 8.10: le serveur decode tout au demarrage, pour qu'aucune partie en cours ne
    // s'arrete le temps de decoder la carte d'une autre.
    const racine = mkdtempSync(join(tmpdir(), 'neon-terrain-'));
    const cartes = Object.keys(CARTES) as IdentifiantCarte[];

    for (const carte of cartes) {
      const chemin = cheminCarte(carte, 'collision');
      mkdirSync(join(racine, chemin, '..'), { recursive: true });
      writeFileSync(
        join(racine, chemin),
        imagePng(20, 15, (x) => x < 10),
      );
    }

    const chargeur = new ChargeurDeTerrain(racine);
    chargeur.prechargerTout();

    expect(chargeur.tailleDuCache).toBe(cartes.length * 2);
  }, 60_000);

  it('tire la carte et son miroir d une seule image', () => {
    // Etape 8.3: plus de seconde image. Le mur est a gauche sur l'image, donc a
    // gauche sur la normale et a droite sur le miroir.
    const racine = mkdtempSync(join(tmpdir(), 'neon-terrain-'));
    const chemin = cheminCarte('map1', 'collision');
    mkdirSync(join(racine, chemin, '..'), { recursive: true });
    writeFileSync(
      join(racine, chemin),
      imagePng(20, 15, (x) => x < 10),
    );

    const chargeur = new ChargeurDeTerrain(racine);
    const normale = chargeur.charger({ carte: 'map1', modeMiroir: false });
    const miroir = chargeur.charger({ carte: 'map1', modeMiroir: true });
    const droite = CARTES.map1.largeur - 10;

    expect(estMur(normale, 10, 10)).toBe(true);
    expect(estMur(normale, droite, 10)).toBe(false);
    expect(estMur(miroir, 10, 10)).toBe(false);
    expect(estMur(miroir, droite, 10)).toBe(true);
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
        // quoi le jeu tournait jusqu'ici. Et il y a du sol: une carte toute en
        // mur passerait aussi (etape 8.8, voir le test suivant).
        let murs = 0;
        let sol = 0;
        for (let y = 0; y < terrain.hauteur; y += 20) {
          for (let x = 0; x < terrain.largeur; x += 20) {
            if (estMur(terrain, x, y)) {
              murs += 1;
            } else {
              sol += 1;
            }
          }
        }

        expect(murs).toBeGreaterThan(0);
        expect(sol).toBeGreaterThan(0);
      });
    }

    /**
     * Le piege de l'etape 8.8. La collision de Spirit & Time a ete livree en noir sur
     * transparent: des murs noirs opaques, un sol noir transparent. Le decodage ignore
     * l'opacite, et ne lit que la luminosite: telle quelle, toute la carte aurait ete un
     * mur. Elle est entree dans le depot posee sur du blanc. Une image de collision doit
     * donc etre opaque partout, et ce test le dit avant qu'une carte ne se joue.
     */
    it(`${carte}: l image des murs est opaque partout`, () => {
      const image = PNG.sync.read(
        readFileSync(join(racineRessources(), cheminCarte(carte, 'collision'))),
      );
      let transparents = 0;

      for (let octet = 3; octet < image.data.length; octet += 4) {
        if ((image.data[octet] ?? 0) < 255) {
          transparents += 1;
        }
      }

      expect(transparents).toBe(0);
    });
  }
});

/**
 * Les murs de chaque carte, dans les deux sens, figes par leur empreinte.
 *
 * LA PREUVE DE L'ETAPE 8.3. Jusque-la, chaque carte livrait une seconde image de
 * collision, deja retournee, dans un dossier mirror. Ces images sont supprimees et
 * le serveur retourne l'image normale. Les empreintes du miroir de Tokyo et du
 * Quartier ont ete relevees AVANT la suppression, en decodant les images livrees:
 * le calcul doit les retrouver a l'octet pres, et il les retrouve. Une partie en
 * miroir sur ces cartes se joue donc exactement comme avant.
 *
 * SPIRIT & TIME EST L'EXCEPTION, ET C'EST UN DEFAUT CORRIGE (X37 de l'audit). Son
 * dossier mirror contenait les images normales, a l'identique, deja dans le jeu
 * d'origine: son miroir n'a jamais ete retourne. Son empreinte d'avant etait celle de
 * la carte normale; celle de l'etape 8.3 etait celle du vrai retournement.
 *
 * Ses empreintes ont change a l'etape 8.8: la carte a pris le decor livre par le
 * porteur du projet, reduit a 2400 sur 1760.
 *
 * Celles de la Station lunaire (etape 8.9) sont relevees sur son image, murs trop fins
 * epaissis (assets/README.md). Elle n'a jamais eu de miroir dessine.
 */
describe('les murs de chaque carte, figes', () => {
  const chargeur = new ChargeurDeTerrain(racineRessources());

  const EMPREINTES: Readonly<Record<IdentifiantCarte, { normal: string; miroir: string }>> = {
    map1: {
      normal: '51aaad6d714977d065a12a9f5e51c96bfa9a09cfa76c16c5efe5891dd3f94d92',
      miroir: '64a4e7a9fca1a144532d0d8417b6c0f8475d6030fa0b2207a62f1aa50370cdc2',
    },
    map3: {
      normal: '0fd426e02c914194ca2374f3b6c9b827a7ae78cc494c8070299912587ca56c99',
      miroir: '16e0ccbb4f8bafee4fdb4d8101da52f7d12af807d7606b007a11e30a1aec7206',
    },
    quartier: {
      normal: '026fa8f87fc252fa759680379f20dd26eab96cbc83f7b1e61a8992ec7f8c6543',
      miroir: '4570ba7ecb389fbe71d38ede65f1622d211c6444581b9c618a4e5079502499db',
    },
    station: {
      normal: '90cee70d884fb972c8b9058da989d830f1d2f5995b4c1cf77d1d357fa4b9e2a9',
      miroir: '462b734f013eee33562897d3e035a8d70998045cd795b09199755fecdb71a443',
    },
  };

  /** L'empreinte des murs d'un terrain, bit a bit. */
  const empreinte = (carte: IdentifiantCarte, modeMiroir: boolean): string =>
    createHash('sha256').update(chargeur.charger({ carte, modeMiroir }).murs).digest('hex');

  for (const carte of Object.keys(CARTES) as IdentifiantCarte[]) {
    it(`${carte}: les murs normaux et ceux du miroir sont ceux attendus`, () => {
      expect(empreinte(carte, false)).toBe(EMPREINTES[carte].normal);
      expect(empreinte(carte, true)).toBe(EMPREINTES[carte].miroir);
    });
  }

  // Le test de l'etape 8.3 verifiait que le miroir de Spirit & Time differait de moins d'un
  // pour mille: l'ancienne carte etait symetrique. La nouvelle ne l'est plus (le dome est
  // decale, les murs traces a la main), ni la Station lunaire (le quai est sous le toit,
  // a droite): on verifie directement le retournement, pixel a pixel. Leurs images ont la
  // taille de la carte, l'etirement ne change rien.
  for (const carte of ['map3', 'station'] as const) {
    it(`${carte} en miroir est sa carte normale retournee, mur pour mur`, () => {
      const normal = chargeur.charger({ carte, modeMiroir: false });
      const miroir = chargeur.charger({ carte, modeMiroir: true });
      let ecarts = 0;

      for (let y = 0; y < normal.hauteur; y += 1) {
        for (let x = 0; x < normal.largeur; x += 1) {
          if (estMur(normal, x, y) !== estMur(miroir, normal.largeur - 1 - x, y)) {
            ecarts += 1;
          }
        }
      }

      expect(ecarts).toBe(0);
      expect(empreinte(carte, true)).not.toBe(empreinte(carte, false));
    });
  }
});

/**
 * Le Quartier est la carte de travail de l'etape 8.2, et la seule dessinee pour ce
 * jeu-ci: un programme du depot la produit (docs/mesures/dessiner-le-quartier.mjs).
 * Ce test garde l'invariant qui la rendrait injouable si elle etait redessinee de
 * travers, et que l'oeil ne voit pas sur l'image.
 *
 * La Station lunaire (etape 8.9) y passe aussi: son quai ne tient au toit que par les
 * passages des monte-charges, et une collision relivree qui les fermerait ferait du quai
 * une prison.
 */
describe('les cartes a passages etroits', () => {
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

  for (const [carte, modeMiroir] of [
    ['quartier', false],
    ['quartier', true],
    ['station', false],
    ['station', true],
  ] as const) {
    it(`${carte} n enferme personne ${modeMiroir ? 'en miroir' : 'en normal'}`, () => {
      const terrain = chargeur.charger({ carte, modeMiroir });

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

describe('les poches closes des vraies cartes (etape 8.10)', () => {
  const chargeur = new ChargeurDeTerrain(racineRessources());

  /**
   * Les points entiers ou une entite tient, mais hors du morceau principal: les poches. Le
   * morceau principal n'est fait que de points tenables: la difference les compte.
   */
  function placesEnPoche(cle: CleDeTerrain): number {
    const terrain = chargeur.charger(cle);
    let tenables = 0;
    let dansLeMorceau = 0;

    for (let y = 0; y < terrain.hauteur; y += 1) {
      for (let x = 0; x < terrain.largeur; x += 1) {
        if (positionTenable(terrain, { x, y })) {
          tenables += 1;
        }
      }
    }

    for (const octet of terrain.morceauPrincipal ?? []) {
      for (let bit = octet; bit !== 0; bit &= bit - 1) {
        dansLeMorceau += 1;
      }
    }

    return tenables - dansLeMorceau;
  }

  for (const modeMiroir of [false, true]) {
    it(`Tokyo garde ses poches hors du morceau principal ${modeMiroir ? 'en miroir' : 'en normal'}`, () => {
      // Mesure de l'etape 8.10: seize poches en normal, quinze en miroir, au pied des murs
      // fins, de une a cent six places. Elles y sont depuis le jeu d'origine.
      const enPoche = placesEnPoche({ carte: 'map1', modeMiroir });

      expect(enPoche).toBeGreaterThan(150);
      expect(enPoche).toBeLessThan(250);
    });

    for (const carte of ['map3', 'quartier', 'station'] as const) {
      it(`${carte} n a aucune poche ${modeMiroir ? 'en miroir' : 'en normal'}`, () => {
        expect(placesEnPoche({ carte, modeMiroir })).toBe(0);
      });
    }
  }

  it('aucune apparition ne tombe dans une poche de Tokyo', () => {
    const terrain = chargeur.charger({ carte: 'map1', modeMiroir: false });
    let alea = creerAlea(810);

    for (let index = 0; index < 1000; index += 1) {
      const tirage = positionDApparition(alea, terrain);
      expect(dansLeMorceauPrincipal(terrain, tirage.valeur)).toBe(true);
      alea = tirage.alea;
    }
  });
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
