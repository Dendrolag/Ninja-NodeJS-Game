/**
 * Tests du coffre du jeton de session.
 *
 * Ce qu'ils protegent: le jeton survit a la page, un contenu trafique n'est jamais
 * presente au serveur, et un navigateur qui refuse le stockage n'empeche ni de se
 * connecter ni de jouer.
 */

import { describe, expect, it } from 'vitest';

import { JETON_DESSAI } from './api.js';
import { CLE_JETON, creerCoffreDeJeton } from './coffre.js';

/** Un stockage de navigateur, en memoire. */
function stockageEnMemoire(): Storage {
  const valeurs = new Map<string, string>();

  return {
    get length() {
      return valeurs.size;
    },
    clear: () => {
      valeurs.clear();
    },
    getItem: (cle) => valeurs.get(cle) ?? null,
    key: (index) => [...valeurs.keys()][index] ?? null,
    removeItem: (cle) => {
      valeurs.delete(cle);
    },
    setItem: (cle, valeur) => {
      valeurs.set(cle, valeur);
    },
  };
}

/** Un stockage qui leve a chaque acces, comme un navigateur qui refuse les donnees de site. */
function stockageRefuse(): Storage {
  const refuser = (): never => {
    throw new Error('SecurityError');
  };

  return {
    get length() {
      return refuser();
    },
    clear: refuser,
    getItem: refuser,
    key: refuser,
    removeItem: refuser,
    setItem: refuser,
  };
}

describe('le coffre du jeton', () => {
  it('garde le jeton dans le stockage, le relit, puis l oublie', () => {
    const stockage = stockageEnMemoire();
    const coffre = creerCoffreDeJeton(stockage);

    coffre.garder(JETON_DESSAI);

    expect(stockage.getItem(CLE_JETON)).toBe(JETON_DESSAI);
    expect(coffre.lire()).toBe(JETON_DESSAI);

    coffre.oublier();

    expect(stockage.getItem(CLE_JETON)).toBeNull();
    expect(coffre.lire()).toBeUndefined();
  });

  it('retrouve le jeton d une visite precedente', () => {
    const stockage = stockageEnMemoire();
    creerCoffreDeJeton(stockage).garder(JETON_DESSAI);

    expect(creerCoffreDeJeton(stockage).lire()).toBe(JETON_DESSAI);
  });

  it('ignore un contenu qui n a pas la forme d un jeton', () => {
    const stockage = stockageEnMemoire();
    stockage.setItem(CLE_JETON, '<script>alert(1)</script>');

    expect(creerCoffreDeJeton(stockage).lire()).toBeUndefined();
  });

  it('garde le jeton en memoire quand le navigateur refuse le stockage, sans jamais lever', () => {
    const coffre = creerCoffreDeJeton(stockageRefuse());

    expect(coffre.lire()).toBeUndefined();

    coffre.garder(JETON_DESSAI);
    expect(coffre.lire()).toBe(JETON_DESSAI);

    coffre.oublier();
    expect(coffre.lire()).toBeUndefined();
  });

  it('garde le jeton en memoire sans stockage du tout', () => {
    const coffre = creerCoffreDeJeton();

    coffre.garder(JETON_DESSAI);

    expect(coffre.lire()).toBe(JETON_DESSAI);
  });
});
