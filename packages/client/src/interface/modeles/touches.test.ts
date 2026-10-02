/** Tests du rappel de la touche de la poche (etapes 7.10 et 7.11). */

import { describe, expect, it } from 'vitest';

import { toucheDeLaPoche } from './touches.js';

const objets = (fumee: boolean, mine: boolean) => ({
  fumee: { actif: fumee, tauxApparitionPourCent: 15 },
  mine: { actif: mine, tauxApparitionPourCent: 15 },
});

describe('toucheDeLaPoche', () => {
  it('nomme l objet en jeu, ou la poche quand les deux le sont', () => {
    expect(toucheDeLaPoche(objets(true, true))).toBe(' · E pour la poche');
    expect(toucheDeLaPoche(objets(true, false))).toBe(' · E pour la fumée');
    expect(toucheDeLaPoche(objets(false, true))).toBe(' · E pour poser la mine');
    expect(toucheDeLaPoche(objets(false, false))).toBe('');
  });
});
