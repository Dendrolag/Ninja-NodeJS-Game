/**
 * Tests du terrain.
 *
 * Ils suivent la caracterisation du legacy (tests/caracterisation/collisions.test.ts),
 * a une exception pres, signalee et expliquee: le balayage du trajet, qui corrige
 * le defaut X15 de l'audit au lieu de le reproduire.
 */

import { CARTES, RAYON_ENTITE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import {
  carteDepuisPixels,
  carteSansMur,
  creerCarteCollisions,
  dansLeMorceauPrincipal,
  estMur,
  pointsTenables,
  positionTenable,
  trajetTenable,
} from './collisions.js';

/** Petite carte de 200 sur 150, mur plein a partir de l'abscisse 100. */
const AVEC_MUR = creerCarteCollisions({ largeur: 200, hauteur: 150 }, (x) => x >= 100);

/** La meme carte, sans aucun mur. */
const SANS_MUR = carteSansMur({ largeur: 200, hauteur: 150 });

/** Fabrique les pixels d'une image de collision, quatre octets par pixel. */
function pixels(
  largeur: number,
  hauteur: number,
  teinte: (x: number, y: number) => readonly [number, number, number],
): Uint8ClampedArray {
  const donnees = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const [rouge, vert, bleu] = teinte(x, y);
      const index = (y * largeur + x) * 4;
      donnees[index] = rouge;
      donnees[index + 1] = vert;
      donnees[index + 2] = bleu;
      donnees[index + 3] = 255;
    }
  }
  return donnees;
}

/** Les pixels d'une image d'un seul point, d'une teinte donnee. */
function unPixel(rouge: number, vert: number, bleu: number): Uint8ClampedArray {
  return new Uint8ClampedArray([rouge, vert, bleu, 255]);
}

describe('carteDepuisPixels', () => {
  it('traite un pixel comme un mur quand sa luminosite moyenne est sous 128', () => {
    const carte = carteDepuisPixels(unPixel(127, 127, 127), { largeur: 1, hauteur: 1 });

    expect(estMur(carte, 0, 0)).toBe(true);
  });

  it('traite un pixel comme libre a partir d une luminosite moyenne de 128', () => {
    // Cas limite fige par la caracterisation: la comparaison exclut la borne.
    const carte = carteDepuisPixels(unPixel(128, 128, 128), { largeur: 1, hauteur: 1 });

    expect(estMur(carte, 0, 0)).toBe(false);
  });

  it('juge sur la moyenne des trois composantes, pas sur une seule', () => {
    // Bleu pur: moyenne 85, donc un mur, alors que sa composante bleue est au
    // maximum. Jaune pur: moyenne 170, donc du sol.
    const bleu = carteDepuisPixels(unPixel(0, 0, 255), { largeur: 1, hauteur: 1 });
    const jaune = carteDepuisPixels(unPixel(255, 255, 0), { largeur: 1, hauteur: 1 });

    expect(estMur(bleu, 0, 0)).toBe(true);
    expect(estMur(jaune, 0, 0)).toBe(false);
  });

  it('place chaque mur au bon endroit, quelle que soit la taille de la carte', () => {
    const carte = carteDepuisPixels(
      pixels(300, 200, (x) => (x >= 150 ? [0, 0, 0] : [255, 255, 255])),
      { largeur: 300, hauteur: 200 },
    );

    expect(estMur(carte, 149, 100)).toBe(false);
    expect(estMur(carte, 150, 100)).toBe(true);
  });

  it('refuse des pixels qui ne correspondent pas aux dimensions annoncees', () => {
    expect(() => carteDepuisPixels(unPixel(0, 0, 0), { largeur: 2, hauteur: 2 })).toThrow();
  });

  it('refuse des dimensions absurdes', () => {
    expect(() => creerCarteCollisions({ largeur: 0, hauteur: 10 })).toThrow();
    expect(() => creerCarteCollisions({ largeur: 10.5, hauteur: 10 })).toThrow();
    expect(() => creerCarteCollisions({ largeur: 10, hauteur: -1 })).toThrow();
    expect(() => creerCarteCollisions({ largeur: 10, hauteur: 2.5 })).toThrow();
  });
});

describe('estMur', () => {
  it('considere tout point hors de la carte comme un mur', () => {
    expect(estMur(SANS_MUR, -1, 75)).toBe(true);
    expect(estMur(SANS_MUR, 200, 75)).toBe(true);
    expect(estMur(SANS_MUR, 100, 150)).toBe(true);
    expect(estMur(SANS_MUR, 100, -1)).toBe(true);
  });

  it('prend le pixel qui contient le point, les coordonnees etant continues', () => {
    expect(estMur(AVEC_MUR, 99.9, 75)).toBe(false);
    expect(estMur(AVEC_MUR, 100.1, 75)).toBe(true);
  });

  it('lit correctement un mur isole, quel que soit son bit dans l octet', () => {
    // Un pixel de mur tous les trois pixels: si l'indexation par bit etait
    // fausse, la carte serait decalee et ce test le montrerait.
    const damier = creerCarteCollisions({ largeur: 40, hauteur: 3 }, (x) => x % 3 === 0);

    for (let x = 0; x < 40; x += 1) {
      expect(estMur(damier, x, 1)).toBe(x % 3 === 0);
    }
  });
});

describe('positionTenable', () => {
  it('refuse une position dont le centre tombe dans le mur', () => {
    expect(positionTenable(AVEC_MUR, { x: 120, y: 75 })).toBe(false);
  });

  it('accepte une position loin du mur', () => {
    expect(positionTenable(AVEC_MUR, { x: 60, y: 75 })).toBe(true);
  });

  it('bloque des le rayon de l entite, avant que le centre touche le mur', () => {
    // A 84, le point de contour situe a l'est vaut exactement 100: c'est deja le
    // mur. A 83, il vaut 99, donc encore du sol. Valeurs de la caracterisation.
    expect(positionTenable(AVEC_MUR, { x: 84, y: 75 }, RAYON_ENTITE)).toBe(false);
    expect(positionTenable(AVEC_MUR, { x: 83, y: 75 }, RAYON_ENTITE)).toBe(true);
  });

  it('tient compte du rayon demande', () => {
    expect(positionTenable(AVEC_MUR, { x: 90, y: 75 }, 4)).toBe(true);
    expect(positionTenable(AVEC_MUR, { x: 90, y: 75 }, RAYON_ENTITE)).toBe(false);
  });

  it('refuse une position au bord, parce que le rayon deborde de la carte', () => {
    expect(positionTenable(SANS_MUR, { x: 5, y: 75 })).toBe(false);
    expect(positionTenable(SANS_MUR, { x: 20, y: 75 })).toBe(true);
  });

  it('produit l instantane de reference des positions tenables autour du mur', () => {
    // Meme releve que la caracterisation du legacy: une ligne par ordonnee, un
    // caractere par abscisse, le point pour une position tenable et le diese
    // pour une position refusee. Cet instantane doit rester identique a celui de
    // tests/caracterisation/__snapshots__/collisions.test.ts.snap.
    const releve: string[] = [];
    for (let y = 20; y <= 120; y += 20) {
      let ligne = '';
      for (let x = 0; x <= 120; x += 4) {
        ligne += positionTenable(AVEC_MUR, { x, y }, RAYON_ENTITE) ? '.' : '#';
      }
      releve.push(ligne);
    }

    expect(releve).toMatchSnapshot();
  });
});

describe('trajetTenable', () => {
  it('accepte un deplacement qui reste au large', () => {
    expect(trajetTenable(AVEC_MUR, { x: 50, y: 75 }, { x: 60, y: 75 })).toBe(true);
  });

  it('refuse un deplacement dont l arrivee est dans le mur', () => {
    expect(trajetTenable(AVEC_MUR, { x: 50, y: 75 }, { x: 120, y: 75 })).toBe(false);
  });

  it('refuse un deplacement dont la cible sort de la carte', () => {
    expect(trajetTenable(SANS_MUR, { x: 100, y: 75 }, { x: 250, y: 75 })).toBe(false);
    expect(trajetTenable(SANS_MUR, { x: 100, y: 75 }, { x: 100, y: -10 })).toBe(false);
  });

  it('accepte un deplacement nul depuis une position tenable', () => {
    expect(trajetTenable(SANS_MUR, { x: 100, y: 75 }, { x: 100, y: 75 })).toBe(true);
  });

  it('ne laisse pas traverser un mur fin, contrairement au legacy', () => {
    // C'EST LA CORRECTION DU DEFAUT X15. Le legacy ne testait que l'arrivee, si
    // bien qu'un mur de deux pixels se traversait d'un bond: la caracterisation
    // le montre et le signale comme une limite de methode, pas comme un reglage
    // de jeu. Le balayage du trajet ferme ce passage.
    const murFin = creerCarteCollisions(
      { largeur: 200, hauteur: 150 },
      (x) => x === 100 || x === 101,
    );

    expect(trajetTenable(murFin, { x: 90, y: 75 }, { x: 115, y: 75 })).toBe(false);
  });

  it('tient compte du point de depart, contrairement au legacy', () => {
    // Deuxieme moitie du defaut X15: les deux premiers arguments de canMove
    // n'etaient lus nulle part, donc atteindre un point depuis la gauche ou
    // depuis le bas revenait au meme. Ici, meme arrivee, deux verdicts: le
    // trajet venant de la gauche traverse le pilier, celui venant du bas non.
    const pilier = creerCarteCollisions(
      { largeur: 200, hauteur: 150 },
      (x, y) => x >= 40 && x <= 60 && y <= 75,
    );
    const arrivee = { x: 80, y: 20 };

    expect(trajetTenable(pilier, { x: 20, y: 20 }, arrivee)).toBe(false);
    expect(trajetTenable(pilier, { x: 80, y: 120 }, arrivee)).toBe(true);
  });
});

describe('dansLeMorceauPrincipal', () => {
  /**
   * Une carte de 300 sur 150 coupee par un trait de mur d'un pixel, a l'abscisse 200. Le
   * morceau de gauche est le plus grand. Au pied du trait, des places a cheval sur lui
   * tiennent (aucun des dix-sept points du disque ne tombe sur le trait), mais on ne peut
   * pas y aller: ce sont les poches de l'etape 8.10.
   */
  const COUPEE = creerCarteCollisions({ largeur: 300, hauteur: 150 }, (x) => x === 200);

  it('n a rien a restreindre sur une carte sans mur', () => {
    expect(SANS_MUR.morceauPrincipal).toBeUndefined();
    expect(dansLeMorceauPrincipal(SANS_MUR, { x: 100.5, y: 75.5 })).toBe(true);
  });

  it('refuse une place qui ne tient pas', () => {
    expect(dansLeMorceauPrincipal(COUPEE, { x: 200.5, y: 75 })).toBe(false);
    expect(dansLeMorceauPrincipal(AVEC_MUR, { x: 120, y: 75 })).toBe(false);
  });

  it('accepte une place du plus grand morceau, a coordonnees reelles', () => {
    expect(dansLeMorceauPrincipal(COUPEE, { x: 100.37, y: 75.81 })).toBe(true);
    expect(dansLeMorceauPrincipal(COUPEE, { x: 183.9, y: 16.2 })).toBe(true);
  });

  it('refuse une place tenable de l autre morceau', () => {
    expect(positionTenable(COUPEE, { x: 250, y: 75 })).toBe(true);
    expect(dansLeMorceauPrincipal(COUPEE, { x: 250, y: 75 })).toBe(false);
  });

  it('refuse une place a cheval sur le trait, qu on ne peut pas atteindre', () => {
    // A 190, le disque deborde sur le trait de 200, mais aucun de ses points n'y tombe: la
    // place tient. Pour y venir depuis la gauche, il faudrait passer par 184, ou le bord du
    // disque touche le trait. C'est exactement une poche close au pied d'un mur fin.
    const aCheval = { x: 190, y: 75 };

    expect(positionTenable(COUPEE, aCheval)).toBe(true);
    expect(positionTenable(COUPEE, { x: 184, y: 75 })).toBe(false);
    expect(dansLeMorceauPrincipal(COUPEE, aCheval)).toBe(false);
  });

  it('garde le premier morceau dans l ordre de lecture a egalite', () => {
    // 301 de large, trait a 150: deux morceaux de meme taille, de 16 a 133 et de 167 a 284.
    const symetrique = creerCarteCollisions({ largeur: 301, hauteur: 100 }, (x) => x === 150);

    expect(dansLeMorceauPrincipal(symetrique, { x: 50, y: 50 })).toBe(true);
    expect(positionTenable(symetrique, { x: 250, y: 50 })).toBe(true);
    expect(dansLeMorceauPrincipal(symetrique, { x: 250, y: 50 })).toBe(false);
  });

  it('juge chaque point entier exactement comme positionTenable', () => {
    // Le morceau se calcule sur une copie des murs, avec des decalages precalcules, pour
    // aller vite. Des pixels de mur semes partout, bords et premieres colonnes compris, ou
    // la virgule flottante a ses caprices: le verdict doit rester celui du moteur.
    const semee = creerCarteCollisions(
      { largeur: 240, hauteur: 160 },
      (x, y) => (x * 7 + y * 13) % 151 === 0,
    );
    const tenables = pointsTenables(semee);
    let ecarts = 0;
    let places = 0;

    for (let y = 0; y < semee.hauteur; y += 1) {
      for (let x = 0; x < semee.largeur; x += 1) {
        const attendu = positionTenable(semee, { x, y });
        places += attendu ? 1 : 0;
        if (attendu !== (tenables[y * semee.largeur + x] === 1)) {
          ecarts += 1;
        }
      }
    }

    expect(places).toBeGreaterThan(1000);
    expect(ecarts).toBe(0);
  });

  it('n a aucune place quand rien ne tient', () => {
    const pleine = creerCarteCollisions({ largeur: 50, hauteur: 50 }, () => true);

    expect(pleine.morceauPrincipal?.every((octet) => octet === 0)).toBe(true);
    expect(dansLeMorceauPrincipal(pleine, { x: 25, y: 25 })).toBe(false);
  });

  it('se calcule aussi sur une carte lue depuis une image', () => {
    const image = carteDepuisPixels(
      pixels(300, 150, (x) => (x === 200 ? [0, 0, 0] : [255, 255, 255])),
      { largeur: 300, hauteur: 150 },
    );

    expect(image.morceauPrincipal).toEqual(COUPEE.morceauPrincipal);
  });
});

describe('cartes de tailles differentes', () => {
  it('reste correct sur la grande carte de 2400 sur 1760', () => {
    const grande = creerCarteCollisions(CARTES.map3, (x) => x >= 2200);

    expect(estMur(grande, 2199, 1000)).toBe(false);
    expect(estMur(grande, 2200, 1000)).toBe(true);
    expect(positionTenable(grande, { x: 1500, y: 1000 })).toBe(true);
    expect(positionTenable(grande, { x: 2190, y: 1000 })).toBe(false);
    expect(estMur(grande, 2399, 1759)).toBe(true);
    expect(estMur(grande, 2400, 1000)).toBe(true);
  });

  it('borne chaque carte a ses propres dimensions', () => {
    const petite = carteSansMur(CARTES.map1);
    const grande = carteSansMur(CARTES.map3);

    // Un point valable sur la grande carte est hors de la petite: deux parties
    // sur deux cartes differentes ne peuvent plus se melanger, ce que le legacy
    // ne garantissait pas (defaut X5).
    expect(positionTenable(grande, { x: 2200, y: 1600 })).toBe(true);
    expect(positionTenable(petite, { x: 2200, y: 1600 })).toBe(false);
  });

  it('couvre le dernier pixel des cartes dont la surface ne tombe pas juste', () => {
    // 25 sur 3 fait 75 pixels, soit neuf octets et trois bits: le dernier octet
    // est incomplet, et c'est exactement la ou une erreur d'arrondi se verrait.
    const carte = creerCarteCollisions({ largeur: 25, hauteur: 3 }, (x, y) => x === 24 && y === 2);

    expect(estMur(carte, 24, 2)).toBe(true);
    expect(estMur(carte, 23, 2)).toBe(false);
  });
});
