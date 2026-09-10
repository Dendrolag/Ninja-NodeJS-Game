/**
 * Tests de la camera.
 *
 * Deux defauts du client d'origine sont couverts ici, parce qu'ils se voient a
 * l'ecran et ne se voyaient nulle part ailleurs: la camera qui sort de la carte
 * et montre du vide, et le suivi dont la vitesse depend de la cadence
 * d'affichage.
 */

import { describe, expect, it } from 'vitest';

import { borner, cameraSur, echellePour, suivre, versEcran, zoneVisible } from './camera.js';

const CARTE = { largeur: 2_000, hauteur: 1_500 };
const ECRAN = { largeur: 1_600, hauteur: 900 };

describe('echellePour', () => {
  it('montre a peu pres la meme portion de terrain quelle que soit la fenetre', () => {
    const petite = echellePour({ largeur: 800, hauteur: 450 }, CARTE, false);
    const grande = echellePour({ largeur: 1_600, hauteur: 900 }, CARTE, false);

    // Deux fois plus de pixels d'ecran, deux fois plus de grossissement: la
    // hauteur de vue, exprimee en pixels de carte, reste la meme.
    expect(450 / petite).toBeCloseTo(900 / grande);
    expect(900 / grande).toBeCloseTo(900);
  });

  it('serre le cadrage sur mobile', () => {
    const bureau = echellePour({ largeur: 400, hauteur: 800 }, CARTE, false);
    const mobile = echellePour({ largeur: 400, hauteur: 800 }, CARTE, true);

    expect(mobile).toBeGreaterThan(bureau);
  });
});

describe('borner', () => {
  const camera = { x: 0, y: 0, echelle: 1 };

  it('empeche la camera de montrer du vide au bord de la carte', () => {
    const borne = borner({ x: 0, y: 0 }, ECRAN, camera, CARTE);

    expect(borne.x).toBe(ECRAN.largeur / 2);
    expect(borne.y).toBe(ECRAN.hauteur / 2);
  });

  it('laisse la camera libre au milieu de la carte', () => {
    const borne = borner({ x: 1_000, y: 750 }, ECRAN, camera, CARTE);

    expect(borne).toEqual({ x: 1_000, y: 750 });
  });

  it('centre la carte quand la vue est plus grande qu elle', () => {
    // Le jeu d'origine ne traitait pas ce cas: sur une petite carte en plein
    // ecran, ses limites basses depassaient ses limites hautes et la camera
    // sautait d'un bord a l'autre.
    const grandEcran = { largeur: 4_000, hauteur: 3_000 };
    const borne = borner({ x: 10, y: 10 }, grandEcran, camera, CARTE);

    expect(borne).toEqual({ x: 1_000, y: 750 });
  });
});

describe('suivre', () => {
  it('avance vers la cible sans jamais la depasser', () => {
    let camera = cameraSur({ x: 500, y: 500 }, ECRAN, CARTE, false);
    const cible = { x: 1_000, y: 750 };

    for (let pas = 0; pas < 200; pas += 1) {
      camera = suivre(camera, cible, ECRAN, CARTE, 16);
      expect(camera.x).toBeLessThanOrEqual(cible.x);
    }

    expect(camera.x).toBeCloseTo(cible.x, 1);
    expect(camera.y).toBeCloseTo(cible.y, 1);
  });

  it('avance a la meme vitesse quelle que soit la cadence d affichage', () => {
    // Le defaut du client d'origine: il rattrapait huit pour cent de l'ecart par
    // IMAGE. Sur un ecran a 144 hertz la camera collait au joueur, sur un ecran a
    // 30 hertz elle trainait. Ici, une seconde de jeu donne le meme resultat quel
    // que soit le nombre d'images qui la composent.
    const depart = cameraSur({ x: 500, y: 750 }, ECRAN, CARTE, false);
    const cible = { x: 1_500, y: 750 };

    let rapide = depart;
    for (let pas = 0; pas < 120; pas += 1) {
      rapide = suivre(rapide, cible, ECRAN, CARTE, 1000 / 120);
    }

    let lente = depart;
    for (let pas = 0; pas < 30; pas += 1) {
      lente = suivre(lente, cible, ECRAN, CARTE, 1000 / 30);
    }

    expect(rapide.x).toBeCloseTo(lente.x, 0);
  });

  it('garde le grossissement inchange', () => {
    const camera = cameraSur({ x: 1_000, y: 750 }, ECRAN, CARTE, false);
    const suivie = suivre(camera, { x: 1_200, y: 750 }, ECRAN, CARTE, 16);

    expect(suivie.echelle).toBe(camera.echelle);
  });

  it('ne bouge pas quand aucun temps ne s est ecoule', () => {
    const camera = cameraSur({ x: 1_000, y: 750 }, ECRAN, CARTE, false);
    const suivie = suivre(camera, { x: 1_500, y: 750 }, ECRAN, CARTE, 0);

    expect(suivie.x).toBeCloseTo(camera.x);
  });
});

describe('versEcran', () => {
  it('place le centre de la camera au centre de l ecran', () => {
    const camera = { x: 1_000, y: 750, echelle: 1 };

    expect(versEcran({ x: 1_000, y: 750 }, camera, ECRAN)).toEqual({
      x: ECRAN.largeur / 2,
      y: ECRAN.hauteur / 2,
    });
  });

  it('tient compte du grossissement', () => {
    const camera = { x: 0, y: 0, echelle: 2 };

    expect(versEcran({ x: 100, y: 0 }, camera, ECRAN).x).toBe(200 + ECRAN.largeur / 2);
  });
});

describe('zoneVisible', () => {
  it('decrit la portion de carte montree a l ecran', () => {
    const visible = zoneVisible({ x: 1_000, y: 750, echelle: 1 }, ECRAN);

    expect(visible).toEqual({ gauche: 200, haut: 300, droite: 1_800, bas: 1_200 });
  });

  it('elargit la zone de la marge demandee', () => {
    const visible = zoneVisible({ x: 1_000, y: 750, echelle: 1 }, ECRAN, 50);

    expect(visible.gauche).toBe(150);
    expect(visible.droite).toBe(1_850);
  });
});
