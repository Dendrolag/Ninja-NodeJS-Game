/**
 * Tests de la resolution du deplacement contre le terrain.
 *
 * Le comportement de reference est celui du gestionnaire move du legacy, fige
 * par tests/caracterisation/collisions.test.ts. Deux ecarts assumes y sont
 * signales: le glissement enchaine au lieu de deux axes appliques ensemble, et
 * les directions de contournement relatives au cap voulu.
 */

import { RAYON_ENTITE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { carteSansMur, creerCarteCollisions, positionTenable } from './collisions.js';
import { resoudreDeplacement } from './deplacement.js';

/** Carte de 600 sur 400, mur plein a partir de l'abscisse 300. */
const MUR_A_DROITE = creerCarteCollisions({ largeur: 600, hauteur: 400 }, (x) => x >= 300);

/** La meme carte, degagee. */
const DEGAGEE = carteSansMur({ largeur: 600, hauteur: 400 });

describe('deplacement libre', () => {
  it('applique le pas demande quand rien ne gene', () => {
    const position = resoudreDeplacement(DEGAGEE, { x: 100, y: 100 }, { x: 10, y: -4 });

    expect(position).toEqual({ x: 110, y: 96 });
  });

  it('ne bouge pas d un pas nul', () => {
    const position = resoudreDeplacement(MUR_A_DROITE, { x: 100, y: 100 }, { x: 0, y: 0 });

    expect(position).toEqual({ x: 100, y: 100 });
  });

  it('laisse sur place une entite posee dans un mur, sans tourner en rond', () => {
    // Une position imposee de l'exterieur peut tomber dans un mur. Aucun
    // deplacement ne l'en sort, et un pas nul ne declenche pas la recherche de
    // contournement, qui n'aurait aucune direction a explorer.
    const dansLeMur = { x: 400, y: 200 };

    expect(resoudreDeplacement(MUR_A_DROITE, dansLeMur, { x: 0, y: 0 })).toEqual(dansLeMur);
    expect(resoudreDeplacement(MUR_A_DROITE, dansLeMur, { x: -10, y: 0 })).toEqual(dansLeMur);
  });
});

describe('glissement le long d un mur', () => {
  it('garde la composante libre et abandonne celle qui est bloquee', () => {
    // Colle au mur, une poussee vers le sud-est ne conserve que le sud.
    const depart = { x: 283, y: 200 };
    const position = resoudreDeplacement(MUR_A_DROITE, depart, { x: 4, y: 4 });

    expect(position.x).toBe(283);
    expect(position.y).toBe(204);
  });

  it('glisse aussi le long d un bord de carte', () => {
    const depart = { x: 16, y: 200 };
    const position = resoudreDeplacement(DEGAGEE, depart, { x: -4, y: -4 });

    expect(position.x).toBe(16);
    expect(position.y).toBe(196);
  });

  it('n arrive jamais a un endroit que le mouvement complet a refuse', () => {
    // DIFFERENCE ASSUMEE AVEC LE LEGACY. Il testait les deux axes depuis le
    // meme depart puis appliquait les deux resultats, ce qui reposait l'entite
    // sur la diagonale refusee: elle coupait l'angle du mur. Ici les deux axes
    // s'enchainent, donc la position atteinte est toujours accessible.
    const encoignure = creerCarteCollisions(
      { largeur: 600, hauteur: 400 },
      (x, y) => x >= 300 && y >= 200,
    );
    const depart = { x: 260, y: 160 };
    const position = resoudreDeplacement(encoignure, depart, { x: 40, y: 40 });

    expect(position).not.toEqual({ x: 300, y: 200 });
    expect(positionTenable(encoignure, position, RAYON_ENTITE)).toBe(true);
  });
});

describe('contournement quand les deux axes sont bloques', () => {
  it('part de cote plutot que de rester plante', () => {
    // Couloir vertical: le joueur pousse vers l'est contre le mur du fond, les
    // deux axes echouent, et un ecart de trente degres le fait repartir.
    const couloir = creerCarteCollisions(
      { largeur: 600, hauteur: 400 },
      (x, y) => x >= 300 || y <= 100 || y >= 300,
    );
    const depart = { x: 280, y: 200 };
    const position = resoudreDeplacement(couloir, depart, { x: 4, y: 0 });

    expect(position).not.toEqual(depart);
    expect(positionTenable(couloir, position, RAYON_ENTITE)).toBe(true);
  });

  it('cherche autour de la direction voulue, et non autour de l est', () => {
    // DIFFERENCE ASSUMEE AVEC LE LEGACY. Il calculait ses six directions de
    // secours a partir de l'axe des abscisses, si bien qu'un joueur bloque en
    // allant vers l'ouest repartait vers l'est. Ici, un joueur qui pousse vers
    // l'ouest s'ecarte au plus de soixante degres de l'ouest.
    const couloir = creerCarteCollisions(
      { largeur: 600, hauteur: 400 },
      (x, y) => x <= 100 || y <= 100 || y >= 300,
    );
    const depart = { x: 120, y: 200 };
    const position = resoudreDeplacement(couloir, depart, { x: -4, y: 0 });

    expect(position).not.toEqual(depart);
    expect(position.x).toBeLessThanOrEqual(depart.x);
  });

  it('ne bouge pas du tout quand aucune direction n est praticable', () => {
    // Coince dans l'angle superieur gauche: le rayon deborde de la carte des
    // que l'entite tente quoi que ce soit. Meme situation que le legacy.
    const depart = { x: 0, y: 0 };
    const position = resoudreDeplacement(DEGAGEE, depart, { x: -4, y: -4 });

    expect(position).toEqual(depart);
  });
});

describe('trajets longs', () => {
  it('ne traverse pas un mur fin, meme d un seul grand pas', () => {
    const murFin = creerCarteCollisions(
      { largeur: 600, hauteur: 400 },
      (x) => x === 300 || x === 301,
    );
    const position = resoudreDeplacement(murFin, { x: 200, y: 200 }, { x: 200, y: 0 });

    expect(position.x).toBeLessThan(300);
  });

  it('donne une position toujours tenable, quel que soit le pas', () => {
    const damier = creerCarteCollisions(
      { largeur: 600, hauteur: 400 },
      (x, y) => x % 120 < 20 && y % 120 < 20,
    );

    let position = { x: 300, y: 200 };
    for (let pas = 0; pas < 40; pas += 1) {
      const angle = pas * 0.7;
      position = resoudreDeplacement(damier, position, {
        x: Math.cos(angle) * 30,
        y: Math.sin(angle) * 30,
      });
      expect(positionTenable(damier, position, RAYON_ENTITE)).toBe(true);
    }
  });
});
