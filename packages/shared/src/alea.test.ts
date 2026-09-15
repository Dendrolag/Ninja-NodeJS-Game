/**
 * Tests du generateur a graine.
 *
 * Ce qui est verifie ici n'est pas la qualite statistique du hasard, mais la
 * seule propriete dont le jeu depend: la reproductibilite. Meme graine, meme
 * suite de tirages, toujours.
 */

import { describe, expect, it } from 'vitest';

import { creerAlea, element, entier, nombre, reel } from './alea.js';

/** Tire une suite de nombres a partir d'une graine, en enchainant les generateurs. */
function suite(graine: number, longueur: number): number[] {
  let alea = creerAlea(graine);
  const valeurs: number[] = [];

  for (let index = 0; index < longueur; index += 1) {
    const tirage = nombre(alea);
    valeurs.push(tirage.valeur);
    alea = tirage.alea;
  }

  return valeurs;
}

describe('determinisme', () => {
  it('produit la meme suite pour la meme graine', () => {
    expect(suite(42, 20)).toEqual(suite(42, 20));
  });

  it('produit des suites differentes pour des graines differentes', () => {
    expect(suite(42, 20)).not.toEqual(suite(43, 20));
  });

  it('ne modifie pas le generateur qu on lui passe', () => {
    // Point central de la conception: un tirage ne mute rien. Tirer deux fois
    // depuis le meme generateur donne deux fois le meme resultat, ce qui rend
    // impossible l'etat global mutable que le legacy avait partout.
    const depart = creerAlea(7);

    expect(nombre(depart).valeur).toBe(nombre(depart).valeur);
    expect(depart.etat).toBe(creerAlea(7).etat);
  });

  it('avance vraiment quand on enchaine les generateurs', () => {
    const premier = nombre(creerAlea(7));
    const second = nombre(premier.alea);

    expect(second.valeur).not.toBe(premier.valeur);
  });
});

describe('nombre', () => {
  it('reste dans l intervalle [0, 1)', () => {
    for (const valeur of suite(1234, 500)) {
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThan(1);
    }
  });
});

describe('entier', () => {
  it('reste dans les bornes demandees', () => {
    let alea = creerAlea(99);

    for (let index = 0; index < 500; index += 1) {
      const tirage = entier(alea, 6);
      expect(Number.isInteger(tirage.valeur)).toBe(true);
      expect(tirage.valeur).toBeGreaterThanOrEqual(0);
      expect(tirage.valeur).toBeLessThan(6);
      alea = tirage.alea;
    }
  });

  it('couvre toutes les valeurs possibles sur un grand nombre de tirages', () => {
    let alea = creerAlea(2026);
    const vus = new Set<number>();

    for (let index = 0; index < 500; index += 1) {
      const tirage = entier(alea, 6);
      vus.add(tirage.valeur);
      alea = tirage.alea;
    }

    expect(vus.size).toBe(6);
  });

  it('refuse une borne qui n est pas un entier positif', () => {
    expect(() => entier(creerAlea(1), 0)).toThrow();
    expect(() => entier(creerAlea(1), 2.5)).toThrow();
  });
});

describe('reel', () => {
  it('reste entre les bornes demandees', () => {
    let alea = creerAlea(5);

    for (let index = 0; index < 200; index += 1) {
      const tirage = reel(alea, 100, 200);
      expect(tirage.valeur).toBeGreaterThanOrEqual(100);
      expect(tirage.valeur).toBeLessThan(200);
      alea = tirage.alea;
    }
  });
});

describe('element', () => {
  it('tire un element de la liste', () => {
    const couleurs = ['rouge', 'vert', 'bleu'] as const;
    let alea = creerAlea(3);

    for (let index = 0; index < 100; index += 1) {
      const tirage = element(alea, couleurs);
      expect(couleurs).toContain(tirage.valeur);
      alea = tirage.alea;
    }
  });

  it('tire le meme element pour la meme graine', () => {
    const couleurs = ['rouge', 'vert', 'bleu'] as const;

    expect(element(creerAlea(11), couleurs).valeur).toBe(element(creerAlea(11), couleurs).valeur);
  });

  it('refuse une liste vide', () => {
    expect(() => element(creerAlea(1), [])).toThrow();
  });
});
