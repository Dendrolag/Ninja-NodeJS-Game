/**
 * Tests de la planification des apparitions.
 *
 * Ce qui est verifie ici est la disparition du defaut X1 de l'audit: les
 * apparitions ne sont plus des minuteries qui se replanifient elles-memes, mais
 * un compte a rebours porte par l'etat. Une partie neuve repart donc de zero,
 * et rien ne survit d'une partie a la suivante.
 */

import { creerAlea } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatPartie } from './etat.js';
import { creerEtatInitial } from './etat.js';
import { avancerUneEcheance, intervalleFixe, intervalleVariable } from './planification.js';

/** Une partie neuve, dont on force le compte a rebours des bonus. */
function partie(restantMs: number): EtatPartie {
  const etat = creerEtatInitial({ graine: 7 });

  return {
    ...etat,
    prochainesApparitions: { ...etat.prochainesApparitions, bonusMs: restantMs },
  };
}

/** Un declencheur qui se contente de compter ses passages, dans le compteur d'identifiants. */
function compter(etat: EtatPartie): EtatPartie {
  return { ...etat, compteurIdentifiants: etat.compteurIdentifiants + 1 };
}

/** Fait avancer le compte a rebours des bonus d'un intervalle fixe d'une seconde. */
function avancer(etat: EtatPartie, dtMs: number): EtatPartie {
  return avancerUneEcheance(etat, dtMs, 'bonusMs', (alea) => intervalleFixe(alea, 1), compter);
}

describe('avancerUneEcheance', () => {
  it('ne declenche rien tant que l echeance n est pas atteinte', () => {
    const apres = avancer(partie(1_000), 999);

    expect(apres.compteurIdentifiants).toBe(0);
    expect(apres.prochainesApparitions.bonusMs).toBe(1);
  });

  it('declenche a l instant exact ou l echeance tombe, et rearme le compteur', () => {
    const apres = avancer(partie(1_000), 1_000);

    expect(apres.compteurIdentifiants).toBe(1);
    expect(apres.prochainesApparitions.bonusMs).toBe(1_000);
  });

  it('rattrape toutes les echeances franchies en un seul battement', () => {
    // Un dt de trois secondes et demie sur un intervalle d'une seconde: quatre
    // echeances, celle du depart et trois de plus. La quatrieme ramene le compte
    // a rebours a zero, et zero declenche aussi, d'ou le rearmement complet.
    const apres = avancer(partie(500), 3_500);

    expect(apres.compteurIdentifiants).toBe(4);
    expect(apres.prochainesApparitions.bonusMs).toBe(1_000);
  });

  it('donne le meme nombre de declenchements quel que soit le decoupage du temps', () => {
    let parPetitsPas = partie(1_000);
    for (let battement = 0; battement < 100; battement += 1) {
      parPetitsPas = avancer(parPetitsPas, 50);
    }

    const enUnSeulPas = avancer(partie(1_000), 5_000);

    expect(parPetitsPas.compteurIdentifiants).toBe(enUnSeulPas.compteurIdentifiants);
    expect(parPetitsPas.prochainesApparitions.bonusMs).toBe(
      enUnSeulPas.prochainesApparitions.bonusMs,
    );
  });

  it('ne touche pas aux autres comptes a rebours', () => {
    const depart = partie(1_000);
    const apres = avancer(depart, 1_000);

    expect(apres.prochainesApparitions.malusMs).toBe(depart.prochainesApparitions.malusMs);
    expect(apres.prochainesApparitions.zoneMs).toBe(depart.prochainesApparitions.zoneMs);
  });

  it('ne boucle pas sans fin quand l intervalle reglé vaut zero', () => {
    // Garde-fou: un intervalle nul est ramene a une milliseconde. Sans cela, le
    // rattrapage tournerait indefiniment.
    const apres = avancerUneEcheance(
      partie(0),
      10,
      'bonusMs',
      (alea) => intervalleFixe(alea, 0),
      compter,
    );

    expect(apres.compteurIdentifiants).toBe(11);
    expect(apres.prochainesApparitions.bonusMs).toBe(1);
  });
});

describe('tirage de l intervalle', () => {
  it('varie de plus ou moins un quart autour de la valeur reglee', () => {
    let alea = creerAlea(2026);
    const tirages: number[] = [];

    for (let essai = 0; essai < 200; essai += 1) {
      const tirage = intervalleVariable(alea, 4);
      tirages.push(tirage.valeur);
      alea = tirage.alea;
    }

    expect(Math.min(...tirages)).toBeGreaterThanOrEqual(3_000);
    expect(Math.max(...tirages)).toBeLessThan(5_000);
    // Le tirage couvre bien toute l'etendue, il ne se serre pas au centre.
    expect(Math.min(...tirages)).toBeLessThan(3_200);
    expect(Math.max(...tirages)).toBeGreaterThan(4_800);
  });

  it('consomme le generateur, donc deux tirages successifs different', () => {
    const premier = intervalleVariable(creerAlea(1), 4);
    const second = intervalleVariable(premier.alea, 4);

    expect(second.valeur).not.toBe(premier.valeur);
  });

  it('rend un intervalle fixe sans consommer le generateur', () => {
    const alea = creerAlea(1);
    const tirage = intervalleFixe(alea, 15);

    expect(tirage.valeur).toBe(15_000);
    expect(tirage.alea).toBe(alea);
  });
});
