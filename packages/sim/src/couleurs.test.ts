/**
 * Tests de l'attribution des couleurs.
 *
 * Comportement de reference: getRandomColor (legacy/server.js:1512) et
 * getUniqueColor (:1521). Ce qui change, c'est la source du hasard, pas la
 * regle: tant qu'une couleur de la palette est libre, on la prend.
 */

import {
  COULEURS_JOUEURS,
  COULEUR_BOT_NEUTRE,
  COULEUR_BOT_NOIR,
  creerAlea,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { couleurAleatoire, couleurDeBot, couleurUnique } from './couleurs.js';

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

// Dans le legacy, un bot nait avec une couleur quelconque: le constructeur
// d'Entity appelle getRandomColor (legacy/server.js:838). Le portage les faisait
// naitre blancs, ecart releve a la recette de l'etape 5.4.
describe('couleurDeBot', () => {
  it('tire une couleur quelconque, differente d un tirage a l autre', () => {
    let alea = creerAlea(12);
    const couleurs = new Set<string>();

    for (let tirage = 0; tirage < 20; tirage += 1) {
      const resultat = couleurDeBot(alea, []);
      expect(resultat.valeur).toMatch(/^#[0-9A-F]{6}$/);
      couleurs.add(resultat.valeur);
      alea = resultat.alea;
    }

    expect(couleurs.size).toBeGreaterThan(15);
  });

  it('ne donne jamais une couleur qui appartiendrait deja a quelqu un', () => {
    const exclue = '#123456';
    const interdites = [...COULEURS_JOUEURS, COULEUR_BOT_NEUTRE, COULEUR_BOT_NOIR, exclue];

    // Le hasard ne tombera pas de lui-meme sur ces huit couleurs parmi seize
    // millions: on verifie donc aussi le filtre en le forcant, plus bas.
    for (let graine = 0; graine < 200; graine += 1) {
      expect(interdites).not.toContain(couleurDeBot(creerAlea(graine), [exclue]).valeur);
    }
  });

  it('tire a nouveau quand le premier tirage tombe sur une couleur exclue', () => {
    const premier = couleurAleatoire(creerAlea(8)).valeur;

    expect(couleurDeBot(creerAlea(8), [premier]).valeur).not.toBe(premier);
  });

  it('donne la meme couleur pour la meme graine', () => {
    expect(couleurDeBot(creerAlea(40), []).valeur).toBe(couleurDeBot(creerAlea(40), []).valeur);
  });
});
