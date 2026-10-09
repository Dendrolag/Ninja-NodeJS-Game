/**
 * Tests de ce que la page retient d'une partie Among Ninjas hors du flux (etape 7.20): l'etat
 * prive, la reunion, les morts connus, notre vote, et le bouton d'action tenu.
 */

import type { EtatPriveAmong } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import { AMONG_INCONNU, apresLaReunion, avecMonVote } from './among.js';
import { Controles } from './controles/controles.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { fait } from './faits.js';
import { reduire } from './reduction.js';

/** L'etat apres ces actions. */
function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

/** L'etat prive d'une proie. */
const PROIE: EtatPriveAmong = {
  role: 'proie',
  complices: [],
  fantome: false,
  gong: { x: 1145, y: 630 },
  stations: [{ x: 990, y: 190 }],
  taches: [{ station: 0, dureeMs: 6000, faite: false }],
  gongUtilise: false,
};

describe('la reunion vue de la page', () => {
  const ouverte = apresLaReunion(AMONG_INCONNU, {
    quoi: 'ouverte',
    numero: 1,
    par: 'a',
    motif: 'cadavre',
    cadavre: 'b',
    morts: ['b'],
  });

  it('retient l ouverture et les morts annonces', () => {
    expect(ouverte.reunion).toEqual({
      numero: 1,
      par: 'a',
      motif: 'cadavre',
      cadavre: 'b',
      votants: [],
    });
    expect(ouverte.morts).toEqual(['b']);
    expect(apresLaReunion(ouverte, { quoi: 'voteOuvert' })).toBe(ouverte);
  });

  it('compte chaque votant une fois', () => {
    const vote = apresLaReunion(apresLaReunion(ouverte, { quoi: 'aVote', votant: 'c' }), {
      quoi: 'aVote',
      votant: 'c',
    });

    expect(vote.reunion?.votants).toEqual(['c']);
    expect(apresLaReunion(AMONG_INCONNU, { quoi: 'aVote', votant: 'c' })).toBe(AMONG_INCONNU);
  });

  it('ajoute l ejecte aux morts, une fois', () => {
    const resultat = apresLaReunion(ouverte, {
      quoi: 'resultat',
      ejecte: 'b',
      decompte: [{ cible: 'b', voix: 2 }],
    });

    expect(resultat.morts).toEqual(['b']);
    expect(resultat.reunion?.resultat?.ejecte).toBe('b');
    expect(apresLaReunion(ouverte, { quoi: 'resultat', decompte: [] }).morts).toEqual(['b']);
    expect(
      apresLaReunion(AMONG_INCONNU, { quoi: 'resultat', ejecte: 'x', decompte: [] }).reunion,
    ).toBeUndefined();
  });

  it('retient notre vote une seule fois, et seulement en reunion', () => {
    expect(avecMonVote(ouverte, null).reunion?.monVote).toBeNull();
    expect(avecMonVote(avecMonVote(ouverte, 'c'), null).reunion?.monVote).toBe('c');
    expect(avecMonVote(AMONG_INCONNU, 'c')).toBe(AMONG_INCONNU);
  });
});

describe('le reducteur', () => {
  it('retient l etat prive, la reunion et notre vote, et oublie tout au lancement', () => {
    const etat = apres([
      { type: 'amongNinjas', prive: PROIE, instant: 0 },
      {
        type: 'fait',
        fait: fait(
          'reunion',
          { quoi: 'ouverte', numero: 1, motif: 'gong', par: 'a', morts: [] },
          1,
        ),
      },
      { type: 'monVote', cible: 'a' },
    ]);

    expect(etat.among.prive).toBe(PROIE);
    expect(etat.among.reunion?.monVote).toBe('a');
    expect(etat.journal).toHaveLength(1);
    expect(apres([{ type: 'partieLancee', graineDuDecor: 1 }], etat).among).toBe(AMONG_INCONNU);
  });
});

describe('le bouton d action tenu', () => {
  it('part a l appui et au relachement, de la touche E ou du doigt', () => {
    const controles = new Controles();

    expect(controles.actionAEmettre()).toBeUndefined();
    controles.enfoncer('E');
    expect(controles.actionAEmettre()).toBe(true);
    expect(controles.actionAEmettre()).toBeUndefined();
    controles.relacher('e');
    expect(controles.actionAEmettre()).toBe(false);

    controles.tenirLAction(true);
    expect(controles.actionAEmettre()).toBe(true);
    controles.toutRelacher();
    expect(controles.actionTenue()).toBe(false);
    expect(controles.actionAEmettre()).toBe(false);

    controles.tenirLAction(true);
    controles.reinitialiser();
    expect(controles.actionAEmettre()).toBeUndefined();
  });

  it('annonce un appui bref, enfonce puis lache entre deux images', () => {
    const controles = new Controles();

    controles.enfoncer('e');
    controles.relacher('e');
    expect(controles.actionAEmettre()).toBe(true);
    expect(controles.actionAEmettre()).toBe(false);

    controles.tenirLAction(true);
    controles.tenirLAction(false);
    expect(controles.actionAEmettre()).toBe(true);
    expect(controles.actionAEmettre()).toBe(false);
  });
});
