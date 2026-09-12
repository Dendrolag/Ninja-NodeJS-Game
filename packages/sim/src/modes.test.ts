/**
 * Tests du branchement du mode de jeu sur le moteur (etapes 2.4 et 7.1).
 *
 * Deux modes existent, le Classique et le Tactique. Ces tests verifient que le mode
 * voyage dans l'etat, qu'il ne change pas d'un battement a l'autre, et que le moteur
 * trouve le jeu de regles a partir de lui. Ce que fait le jeu de regles Tactique se
 * teste dans tactique.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { regleClassique, regleTactique } from './contacts.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';
import { REGLES_DES_MODES, tick } from './moteur.js';
import { agirEnTactique } from './tactique.js';

describe('le mode de la partie', () => {
  it('est le Classique quand la creation n en dit rien', () => {
    expect(creerEtatInitial({ graine: 1 }).mode).toBe('classique');
  });

  it('est celui demande a la creation', () => {
    expect(creerEtatInitial({ graine: 1, mode: 'classique' }).mode).toBe('classique');
    expect(creerEtatInitial({ graine: 1, mode: 'tactique' }).mode).toBe('tactique');
  });

  it('ne change pas d un battement a l autre', () => {
    const depart = ajouterJoueur(creerEtatInitial({ graine: 3, mode: 'tactique' }), {
      id: 'alice',
      pseudo: 'Alice',
    });

    expect(tick(depart, {}, 50).mode).toBe('tactique');
  });
});

describe('REGLES_DES_MODES', () => {
  it('donne au Classique sa regle de capture par simple proximite, et aucune action', () => {
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'alice', pseudo: 'Alice' });

    expect(REGLES_DES_MODES.classique.resoudreContacts).toBe(regleClassique);
    expect(REGLES_DES_MODES.classique.agir(etat, {}, 50)).toBe(etat);
  });

  it('donne au Tactique la capture par cone, et des contacts qui ne capturent pas', () => {
    expect(REGLES_DES_MODES.tactique.agir).toBe(agirEnTactique);
    expect(REGLES_DES_MODES.tactique.resoudreContacts).toBe(regleTactique);
  });

  it('ne laisse aucune trace du mode Tactique dans une partie Classique', () => {
    // C'est ce qui garde l'etat d'une partie Classique identique a ce qu'il etait
    // avant l'etape 7.1, et l'empreinte des parties capable de le prouver.
    const depart = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'alice', pseudo: 'Alice' });
    const entrees = {
      alice: { deplacement: { x: 1, y: 0 }, enMouvement: true, capturer: true as const },
    };

    expect('tactique' in tick(depart, entrees, 50)).toBe(false);
  });
});
