/**
 * Tests du branchement du mode de jeu sur le moteur (etapes 2.4, 7.1 et 7.2).
 *
 * Cinq modes existent, le Classique (la Horde depuis l'etape 7.5), le Tactique, les Equipes, la Chasse et le Massacre. Ces tests verifient
 * que le mode voyage dans l'etat, qu'il ne change pas d'un battement a l'autre, et que
 * le moteur trouve le jeu de regles a partir de lui. Ce que font les jeux de regles
 * Tactique, Equipes et Chasse se teste dans tactique.test.ts, equipes.test.ts et
 * chasse.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { perteClassique } from './bots.js';
import { regleHorde, regleTactique } from './contacts.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';
import { agirEnHorde } from './horde.js';
import { REGLES_DES_MODES, evaluerFinDePartie, lancerLaPartie, tick } from './moteur.js';
import { malusClassique } from './objets.js';
import { agirEnTactique } from './tactique.js';

describe('le mode de la partie', () => {
  it('est le Classique quand la creation n en dit rien', () => {
    expect(creerEtatInitial({ graine: 1 }).mode).toBe('classique');
  });

  it('est celui demande a la creation', () => {
    expect(creerEtatInitial({ graine: 1, mode: 'classique' }).mode).toBe('classique');
    expect(creerEtatInitial({ graine: 1, mode: 'tactique' }).mode).toBe('tactique');
    expect(creerEtatInitial({ graine: 1, mode: 'equipes' }).mode).toBe('equipes');
    expect(creerEtatInitial({ graine: 1, mode: 'chasse' }).mode).toBe('chasse');
    expect(creerEtatInitial({ graine: 1, mode: 'massacre' }).mode).toBe('massacre');
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
  it('donne au Classique, devenu la Horde, la capture par simple proximite et le combo', () => {
    // Etape 7.5: la regle de la Horde est celle du Classique, plus le combo, qui ne vit
    // que dans une partie lancee. Au salon, agir ne fait rien.
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'alice', pseudo: 'Alice' });

    expect(REGLES_DES_MODES.classique.resoudreContacts).toBe(regleHorde);
    expect(REGLES_DES_MODES.classique.agir).toBe(agirEnHorde);
    expect(REGLES_DES_MODES.classique.agir(etat, {}, 50)).toBe(etat);
  });

  it('donne au Tactique la capture par cone, et des contacts qui ne capturent pas', () => {
    expect(REGLES_DES_MODES.tactique.agir).toBe(agirEnTactique);
    expect(REGLES_DES_MODES.tactique.resoudreContacts).toBe(regleTactique);
  });

  it('garde au Classique et au Tactique la perte face au bot noir et le malus d avant', () => {
    // Le jeu de regles s'est elargi a l'etape 7.2 pour le mode Equipes: ces deux modes y
    // recoivent exactement le code qui s'appliquait avant.
    for (const mode of ['classique', 'tactique'] as const) {
      expect(REGLES_DES_MODES[mode].perteFaceAuBotNoir).toBe(perteClassique);
      expect(REGLES_DES_MODES[mode].victimeDuMalus).toBe(malusClassique);
    }
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

  it('ne prepare rien au lancement et ne decide rien avant le terme, en Tactique et en Equipes', () => {
    // Le jeu de regles s'est elargi a l'etape 7.3 pour la Chasse, puis a servi au Massacre
    // (etape 7.4) et a la Horde (etape 7.5, voir horde.test.ts): les deux autres modes
    // rendent l'etat tel quel, sans aucun tirage, et seul le temps les decide.
    for (const mode of ['tactique', 'equipes'] as const) {
      const etat = ajouterJoueur(creerEtatInitial({ graine: 1, mode }), {
        id: 'alice',
        pseudo: 'Alice',
      });

      expect(lancerLaPartie(etat)).toBe(etat);
      expect(REGLES_DES_MODES[mode].estDecidee(etat)).toBe(false);
      expect(evaluerFinDePartie(etat).terminee).toBe(false);
    }
  });

  it('ne laisse aucune trace de la Chasse dans une partie Classique', () => {
    const depart = lancerLaPartie(
      ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'alice', pseudo: 'Alice' }),
    );

    expect('chasse' in tick(depart, {}, 50)).toBe(false);
  });

  it('ne laisse aucune trace du Massacre dans une partie Classique', () => {
    const depart = lancerLaPartie(
      ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'alice', pseudo: 'Alice' }),
    );
    const entrees = {
      alice: { deplacement: { x: 1, y: 0 }, enMouvement: true, capturer: true as const },
    };

    expect('massacre' in tick(depart, entrees, 50)).toBe(false);
  });
});
