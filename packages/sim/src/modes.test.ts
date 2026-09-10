/**
 * Tests du branchement du mode de jeu sur le moteur (etape 2.4).
 *
 * Un seul mode existe, le Classique. Ces tests verifient que le mode voyage dans
 * l'etat, qu'il ne change pas d'un battement a l'autre, et que le moteur trouve la
 * regle de resolution des contacts a partir de lui. Ajouter un mode ajoutera ici
 * ses propres attentes.
 */

import { describe, expect, it } from 'vitest';

import { regleClassique } from './contacts.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';
import { REGLES_DES_MODES, tick } from './moteur.js';

describe('le mode de la partie', () => {
  it('est le Classique quand la creation n en dit rien', () => {
    expect(creerEtatInitial({ graine: 1 }).mode).toBe('classique');
  });

  it('est celui demande a la creation', () => {
    expect(creerEtatInitial({ graine: 1, mode: 'classique' }).mode).toBe('classique');
  });

  it('ne change pas d un battement a l autre', () => {
    const depart = ajouterJoueur(creerEtatInitial({ graine: 3 }), { id: 'alice', pseudo: 'Alice' });

    expect(tick(depart, {}, 50).mode).toBe(depart.mode);
  });
});

describe('REGLES_DES_MODES', () => {
  it('donne au Classique sa regle de capture par simple proximite', () => {
    expect(REGLES_DES_MODES.classique).toBe(regleClassique);
  });
});
