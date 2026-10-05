/**
 * Tests du souvenir des notes de version (etape 4.9).
 *
 * Ce qu'ils protegent: la note s'affiche une fois a un joueur qui revient et n'a pas
 * lu cette version, plus jamais une fois fermee, jamais a un joueur tout nouveau; et
 * un stockage refuse ou absent ne casse rien, ni ne fait revenir la note.
 */

import { describe, expect, it } from 'vitest';

import { CLE_JETON } from '../comptes/coffre.js';
import { stockageEnMemoire, stockageRefuse } from './essais.js';
import type { NoteDeVersion } from './modeles/notesDeVersion.js';
import { CLE_PREFERENCE_SANG, CLE_PREFERENCES_SON } from './preferences.js';
import { CLE_VERSION_VUE, decisionDeLaNote, lireLeSouvenirDeVersion } from './souvenirDeVersion.js';

/** Une note d'essai, pour la version 2.3. */
const NOTE_2_3: NoteDeVersion = {
  version: '2.3',
  titre: 'Du neuf',
  puces: [{ texte: 'Du neuf.' }],
};

/** La note de la version d'avant, et celle d'une version a venir. */
const NOTE_2_2: NoteDeVersion = { ...NOTE_2_3, version: '2.2' };
const NOTE_2_5: NoteDeVersion = { ...NOTE_2_3, version: '2.5' };

/** Un stockage ou un joueur est deja passe, sous cette cle. */
function stockageDUnHabitue(cle: string = CLE_PREFERENCES_SON): Storage {
  const stockage = stockageEnMemoire();
  stockage.setItem(cle, 'quelque chose');

  return stockage;
}

describe('decisionDeLaNote', () => {
  it('montre la note a un joueur qui revient et ne l a pas lue', () => {
    expect(decisionDeLaNote('1.5', true, { versionVue: undefined, dejaVenu: true })).toBe(
      'montrer',
    );
    expect(decisionDeLaNote('1.6', true, { versionVue: '1.5', dejaVenu: true })).toBe('montrer');
    // Une version deja vue suffit a dire qu'il est deja venu.
    expect(decisionDeLaNote('1.6', true, { versionVue: '1.5', dejaVenu: false })).toBe('montrer');
  });

  it('ne la montre plus une fois lue', () => {
    expect(decisionDeLaNote('1.5', true, { versionVue: '1.5', dejaVenu: true })).toBe('rien');
  });

  it('ne la montre pas a un joueur tout nouveau, mais retient la version', () => {
    expect(decisionDeLaNote('1.5', true, { versionVue: undefined, dejaVenu: false })).toBe(
      'retenir',
    );
  });

  it('ne montre rien sans note', () => {
    expect(decisionDeLaNote('1.6', false, { versionVue: '1.5', dejaVenu: true })).toBe('rien');
  });
});

describe('lireLeSouvenirDeVersion', () => {
  it('ouvre la note a un habitue, puis la retient lue a la fermeture', () => {
    for (const cle of [CLE_PREFERENCES_SON, CLE_PREFERENCE_SANG, CLE_JETON]) {
      const stockage = stockageDUnHabitue(cle);
      const souvenir = lireLeSouvenirDeVersion(stockage, '2.3.0', [NOTE_2_3]);

      expect(souvenir.note).toBe(NOTE_2_3);
      expect(souvenir.aMontrer).toBe(true);

      souvenir.marquerLue();

      expect(souvenir.aMontrer).toBe(false);
      expect(stockage.getItem(CLE_VERSION_VUE)).toBe('2.3');
      // Au chargement suivant, elle ne revient pas.
      expect(lireLeSouvenirDeVersion(stockage, '2.3.0', [NOTE_2_3]).aMontrer).toBe(false);
    }
  });

  it('ne revient pas pour un correctif de la meme version', () => {
    const stockage = stockageDUnHabitue();
    stockage.setItem(CLE_VERSION_VUE, '2.3');

    expect(lireLeSouvenirDeVersion(stockage, '2.3.4', [NOTE_2_3]).aMontrer).toBe(false);
  });

  it('montre la note suivante a qui a lu la precedente', () => {
    const stockage = stockageEnMemoire();
    stockage.setItem(CLE_VERSION_VUE, '2.2');

    expect(lireLeSouvenirDeVersion(stockage, '2.3.0', [NOTE_2_3]).aMontrer).toBe(true);
  });

  it('ne montre rien a un joueur tout nouveau, et retient la version tout de suite', () => {
    const stockage = stockageEnMemoire();
    const souvenir = lireLeSouvenirDeVersion(stockage, '2.3.0', [NOTE_2_3]);

    expect(souvenir.aMontrer).toBe(false);
    // La note reste a portee du pied de l'accueil.
    expect(souvenir.note).toBe(NOTE_2_3);
    expect(stockage.getItem(CLE_VERSION_VUE)).toBe('2.3');
  });

  it('ne montre rien sans stockage, et n en fait pas une erreur', () => {
    const sansStockage = lireLeSouvenirDeVersion(undefined, '2.3.0', [NOTE_2_3]);

    expect(sansStockage.aMontrer).toBe(false);
    expect(() => {
      sansStockage.marquerLue();
    }).not.toThrow();
  });

  it('ne montre rien et ne leve pas quand le navigateur refuse le stockage', () => {
    const refuse = lireLeSouvenirDeVersion(stockageRefuse(), '2.3.0', [NOTE_2_3]);

    expect(refuse.aMontrer).toBe(false);
    expect(refuse.note).toBe(NOTE_2_3);
    expect(() => {
      refuse.marquerLue();
    }).not.toThrow();
  });

  it('n a rien a montrer pour une version sans note, mais garde les notes d avant', () => {
    const souvenir = lireLeSouvenirDeVersion(stockageDUnHabitue(), '2.4.0', [NOTE_2_3]);

    expect(souvenir.note).toBeUndefined();
    expect(souvenir.aMontrer).toBe(false);
    expect(souvenir.historique).toEqual([NOTE_2_3]);
  });

  it('garde tout l historique paru, la note servie en tete', () => {
    const souvenir = lireLeSouvenirDeVersion(stockageDUnHabitue(), '2.3.1', [
      NOTE_2_2,
      NOTE_2_3,
      NOTE_2_5,
    ]);

    expect(souvenir.historique).toEqual([NOTE_2_3, NOTE_2_2]);
  });
});
