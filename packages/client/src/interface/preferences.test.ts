/**
 * Tests des preferences de son.
 *
 * Le stockage du navigateur est une entree comme une autre: modifiable a la main,
 * parfois vide, parfois ecrit par une autre version du jeu. Ces tests verifient
 * qu'aucune de ces situations n'empeche le jeu de demarrer avec un son sense.
 */

import { describe, expect, it } from 'vitest';

import {
  PREFERENCES_SON_PAR_DEFAUT,
  ecrirePreferencesSon,
  lirePreferencesSon,
} from './preferences.js';

describe('lirePreferencesSon', () => {
  it('rend les valeurs par defaut quand rien n est enregistre', () => {
    expect(lirePreferencesSon(null)).toEqual(PREFERENCES_SON_PAR_DEFAUT);
    expect(lirePreferencesSon(undefined)).toEqual(PREFERENCES_SON_PAR_DEFAUT);
  });

  it('rend les valeurs par defaut quand l enregistrement est illisible', () => {
    expect(lirePreferencesSon('{pas du json')).toEqual(PREFERENCES_SON_PAR_DEFAUT);
    expect(lirePreferencesSon('42')).toEqual(PREFERENCES_SON_PAR_DEFAUT);
  });

  it('remplace une valeur abimee sans perdre les autres', () => {
    const lues = lirePreferencesSon(
      JSON.stringify({ volumeMusique: 2, volumeSons: 0.2, coupe: 'oui' }),
    );

    expect(lues).toEqual({
      volumeMusique: PREFERENCES_SON_PAR_DEFAUT.volumeMusique,
      volumeSons: 0.2,
      coupe: PREFERENCES_SON_PAR_DEFAUT.coupe,
    });
  });

  it('relit ce qui a ete ecrit', () => {
    const preferences = { volumeMusique: 0, volumeSons: 1, coupe: true };

    expect(lirePreferencesSon(ecrirePreferencesSon(preferences))).toEqual(preferences);
  });
});
