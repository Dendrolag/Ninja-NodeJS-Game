/**
 * Tests des effets portes par un joueur.
 *
 * La reference de comportement est tests/caracterisation/effets.test.ts, qui
 * s'execute contre le legacy. Deux points y sont capitaux et se retrouvent ici:
 * les durees de bonus se cumulent (comportement a preserver numero 10), et un
 * effet est actif tant qu'il lui reste du temps.
 */

import { TYPES_BONUS, TYPES_MALUS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import {
  AUCUN_BONUS,
  AUCUN_MALUS,
  bonusEnCours,
  cumuler,
  estActif,
  fairePasserLeTemps,
  malusEnCours,
  remplacer,
} from './effets.js';

describe('table des durees restantes', () => {
  it('part a zero sur toutes les natures', () => {
    expect(Object.keys(AUCUN_BONUS).sort()).toEqual([...TYPES_BONUS].sort());
    expect(Object.keys(AUCUN_MALUS).sort()).toEqual([...TYPES_MALUS].sort());
    expect(Object.values(AUCUN_BONUS)).toEqual([0, 0, 0]);
    expect(Object.values(AUCUN_MALUS)).toEqual([0, 0, 0]);
  });

  it('declare actif un effet auquel il reste du temps, meme une milliseconde', () => {
    expect(estActif(AUCUN_BONUS, 'vitesse')).toBe(false);
    expect(estActif({ ...AUCUN_BONUS, vitesse: 1 }, 'vitesse')).toBe(true);
  });

  it('ne modifie pas la table qu on lui passe', () => {
    const depart = AUCUN_BONUS;
    cumuler(depart, 'vitesse', 10_000);
    fairePasserLeTemps(depart, 50);

    expect(depart).toEqual({ vitesse: 0, invincibilite: 0, revelation: 0 });
  });
});

describe('cumul des bonus', () => {
  it('arme la duree du bonus ramasse', () => {
    expect(cumuler(AUCUN_BONUS, 'vitesse', 10_000).vitesse).toBe(10_000);
  });

  it('ajoute la duree au lieu de la remplacer', () => {
    // Comportement a preserver numero 10 de CLAUDE.md: deux bonus de vitesse
    // coup sur coup donnent vingt secondes, pas dix.
    const premier = cumuler(AUCUN_BONUS, 'vitesse', 10_000);
    const second = cumuler(premier, 'vitesse', 10_000);

    expect(second.vitesse).toBe(20_000);
  });

  it('laisse les autres natures intactes', () => {
    const apres = cumuler(AUCUN_BONUS, 'vitesse', 10_000);

    expect(apres.invincibilite).toBe(0);
    expect(apres.revelation).toBe(0);
  });
});

describe('renouvellement des malus', () => {
  it('arme la duree du malus subi', () => {
    expect(remplacer(AUCUN_MALUS, 'flou', 12_000).flou).toBe(12_000);
  });

  it('repart de la duree pleine sans additionner', () => {
    const entame = fairePasserLeTemps(remplacer(AUCUN_MALUS, 'flou', 12_000), 8_000);
    const renouvele = remplacer(entame, 'flou', 12_000);

    expect(entame.flou).toBe(4_000);
    expect(renouvele.flou).toBe(12_000);
  });

  it('ne raccourcit jamais un effet en cours', () => {
    const long = remplacer(AUCUN_MALUS, 'flou', 12_000);

    expect(remplacer(long, 'flou', 5_000).flou).toBe(12_000);
  });
});

describe('ecoulement du temps', () => {
  it('retranche le temps ecoule a chaque effet', () => {
    const depart = cumuler(cumuler(AUCUN_BONUS, 'vitesse', 10_000), 'revelation', 4_000);
    const apres = fairePasserLeTemps(depart, 1_000);

    expect(apres).toEqual({ vitesse: 9_000, invincibilite: 0, revelation: 3_000 });
  });

  it('eteint l effet a l instant exact ou sa duree est epuisee', () => {
    const depart = cumuler(AUCUN_BONUS, 'invincibilite', 10_000);

    expect(estActif(fairePasserLeTemps(depart, 9_999), 'invincibilite')).toBe(true);
    expect(estActif(fairePasserLeTemps(depart, 10_000), 'invincibilite')).toBe(false);
  });

  it('ne descend jamais sous zero', () => {
    const depart = cumuler(AUCUN_BONUS, 'vitesse', 100);

    expect(fairePasserLeTemps(depart, 10_000).vitesse).toBe(0);
  });
});

describe('liste des effets en cours', () => {
  it('rend les natures actives dans l ordre du catalogue', () => {
    const durees = cumuler(cumuler(AUCUN_BONUS, 'revelation', 1_000), 'vitesse', 1_000);

    expect(bonusEnCours(durees)).toEqual(['vitesse', 'revelation']);
  });

  it('rend une liste vide quand rien n est actif', () => {
    expect(bonusEnCours(AUCUN_BONUS)).toEqual([]);
    expect(malusEnCours(AUCUN_MALUS)).toEqual([]);
  });

  it('vaut aussi pour les malus', () => {
    expect(malusEnCours(remplacer(AUCUN_MALUS, 'negatif', 14_000))).toEqual(['negatif']);
  });
});
