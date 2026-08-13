/**
 * Tests de l'attribution des couleurs.
 *
 * Comportement de reference: getRandomColor (legacy/server.js:1512) et
 * getUniqueColor (:1521). Ce qui change, c'est la source du hasard, pas la
 * regle: tant qu'une couleur de la palette est libre, on la prend.
 */

import { COULEURS_JOUEURS, creerAlea } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { couleurAleatoire, couleurUnique } from './couleurs.js';

describe('couleurAleatoire', () => {
  it('produit une couleur hexadecimale a six chiffres', () => {
    expect(couleurAleatoire(creerAlea(1)).valeur).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('produit la meme couleur pour la meme graine', () => {
    expect(couleurAleatoire(creerAlea(77)).valeur).toBe(couleurAleatoire(creerAlea(77)).valeur);
  });

  it('fait avancer le generateur de six tirages', () => {
    // Six chiffres tires, donc six tirages: la couleur suivante differe.
    const premiere = couleurAleatoire(creerAlea(5));
    const seconde = couleurAleatoire(premiere.alea);

    expect(seconde.valeur).not.toBe(premiere.valeur);
  });
});

describe('couleurUnique', () => {
  it('puise dans la palette des joueurs tant qu elle a une couleur libre', () => {
    expect(COULEURS_JOUEURS).toContain(couleurUnique(creerAlea(3), []).valeur);
  });

  it('n attribue jamais une couleur exclue', () => {
    const exclues = COULEURS_JOUEURS.slice(0, 5);

    for (let graine = 0; graine < 50; graine += 1) {
      const couleur = couleurUnique(creerAlea(graine), exclues).valeur;
      expect(exclues).not.toContain(couleur);
    }
  });

  it('donne la derniere couleur libre quand il n en reste qu une', () => {
    const exclues = COULEURS_JOUEURS.slice(0, 5);
    const attendue = COULEURS_JOUEURS[5];

    expect(couleurUnique(creerAlea(9), exclues).valeur).toBe(attendue);
  });

  it('sort de la palette une fois toutes ses couleurs prises', () => {
    const resultat = couleurUnique(creerAlea(4), COULEURS_JOUEURS);

    expect(resultat.valeur).toMatch(/^#[0-9A-F]{6}$/);
    expect(COULEURS_JOUEURS).not.toContain(resultat.valeur);
  });

  it('attribue la meme couleur pour la meme graine et les memes exclusions', () => {
    const premiere = couleurUnique(creerAlea(21), ['#FF0000']);
    const seconde = couleurUnique(creerAlea(21), ['#FF0000']);

    expect(premiere.valeur).toBe(seconde.valeur);
  });
});
