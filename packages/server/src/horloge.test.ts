/**
 * Tests de l'horloge injectable.
 *
 * L'horloge manuelle n'est pas un accessoire de confort: c'est elle qui permet
 * de jouer trois minutes de partie en une milliseconde de test. Si elle mentait
 * sur l'heure, tous les tests de boucle mentiraient avec elle. D'ou ces tests,
 * qui verifient qu'elle declenche le bon nombre de rappels, au bon moment.
 */

import { describe, expect, it } from 'vitest';

import { creerHorlogeManuelle } from './horloge.js';

describe('horloge manuelle', () => {
  it('ne bouge pas toute seule', () => {
    const horloge = creerHorlogeManuelle();

    expect(horloge.maintenant()).toBe(horloge.maintenant());
  });

  it('avance du temps demande', () => {
    const horloge = creerHorlogeManuelle(1000);

    horloge.avancerDe(250);

    expect(horloge.maintenant()).toBe(1250);
  });

  it('declenche un rappel a chaque intervalle ecoule', () => {
    const horloge = creerHorlogeManuelle();
    let appels = 0;

    horloge.repeter(() => {
      appels += 1;
    }, 50);
    horloge.avancerDe(200);

    expect(appels).toBe(4);
  });

  it('ne declenche rien avant la premiere echeance', () => {
    const horloge = creerHorlogeManuelle();
    let appels = 0;

    horloge.repeter(() => {
      appels += 1;
    }, 50);
    horloge.avancerDe(49);

    expect(appels).toBe(0);
  });

  it("donne a chaque rappel l'heure de son echeance, et non celle de l'arrivee", () => {
    const horloge = creerHorlogeManuelle(1000);
    const heures: number[] = [];

    horloge.repeter(() => {
      heures.push(horloge.maintenant());
    }, 50);
    horloge.avancerDe(200);

    expect(heures).toEqual([1050, 1100, 1150, 1200]);
  });

  it('reprend le decompte la ou il en etait entre deux avances', () => {
    const horloge = creerHorlogeManuelle();
    let appels = 0;

    horloge.repeter(() => {
      appels += 1;
    }, 50);
    horloge.avancerDe(30);
    horloge.avancerDe(30);

    expect(appels).toBe(1);
  });

  it('arrete un rappel quand on le lui demande', () => {
    const horloge = creerHorlogeManuelle();
    let appels = 0;

    const arreter = horloge.repeter(() => {
      appels += 1;
    }, 50);
    horloge.avancerDe(100);
    arreter();
    horloge.avancerDe(1000);

    expect(appels).toBe(2);
  });

  it("supporte qu'un rappel s'arrete lui-meme", () => {
    const horloge = creerHorlogeManuelle();
    let appels = 0;

    const arreter = horloge.repeter(() => {
      appels += 1;
      arreter();
    }, 50);
    horloge.avancerDe(1000);

    expect(appels).toBe(1);
  });

  it('arreter deux fois ne fait rien de plus', () => {
    const horloge = creerHorlogeManuelle();
    const arreter = horloge.repeter(() => {}, 50);

    arreter();

    expect(() => {
      arreter();
    }).not.toThrow();
  });

  it('fait battre plusieurs rappels de cadences differentes', () => {
    const horloge = creerHorlogeManuelle();
    let rapides = 0;
    let lents = 0;

    horloge.repeter(() => {
      rapides += 1;
    }, 50);
    horloge.repeter(() => {
      lents += 1;
    }, 200);
    horloge.avancerDe(400);

    expect([rapides, lents]).toEqual([8, 2]);
  });

  it('refuse un intervalle nul ou negatif', () => {
    const horloge = creerHorlogeManuelle();

    expect(() => horloge.repeter(() => {}, 0)).toThrow();
    expect(() => horloge.repeter(() => {}, -1)).toThrow();
  });

  it('refuse de reculer', () => {
    const horloge = creerHorlogeManuelle();

    expect(() => {
      horloge.avancerDe(-1);
    }).toThrow();
  });
});
