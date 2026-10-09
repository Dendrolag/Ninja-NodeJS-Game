/**
 * Tests des notes de version (etape 4.9).
 *
 * Ce qu'ils protegent: la regle d'avancement du numero. Une version mineure
 * s'accompagne toujours d'une note: avancer le numero sans l'ecrire fait echouer
 * ce fichier. L'historique que la fenetre des nouveautes fait defiler. Et les textes
 * arretes avec le porteur du projet le 5 octobre 2026.
 */

import { NUMERO_DE_VERSION, versionMineure } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { NoteDeVersion } from './notesDeVersion.js';
import { NOTES_DE_VERSION, noteDeLaVersion, notesParues } from './notesDeVersion.js';

/** Une note d'essai, sans autre texte que son numero. */
function noteDEssai(version: string): NoteDeVersion {
  return { version, titre: version, puces: [{ texte: 'Du neuf.' }] };
}

describe('les notes de version', () => {
  it('ont une note pour la version mineure servie: un numero mineur ne va pas sans sa note', () => {
    expect(noteDeLaVersion(NUMERO_DE_VERSION)?.version).toBe(versionMineure(NUMERO_DE_VERSION));
  });

  it('ont une note par version mineure, jamais deux', () => {
    const versions = NOTES_DE_VERSION.map((note) => note.version);

    expect(new Set(versions).size).toBe(versions.length);
    expect(versions.every((version) => /^\d+\.\d+$/.test(version))).toBe(true);
  });

  it('ne laissent ni note vide ni texte vide', () => {
    for (const note of NOTES_DE_VERSION) {
      expect(note.titre).not.toBe('');
      expect(note.puces.length).toBeGreaterThan(0);
      expect(note.puces.every((puce) => puce.texte.trim() !== '')).toBe(true);
    }
  });

  it('donnent a un correctif la note de sa version mineure, et rien a une version sans note', () => {
    expect(noteDeLaVersion('1.5.0')?.titre).toBe('Coups fourrés');
    expect(noteDeLaVersion('1.5.4')?.titre).toBe('Coups fourrés');
    expect(noteDeLaVersion('0.9.0')).toBeUndefined();
  });

  it('disent les textes arretes avec le porteur du projet', () => {
    expect(noteDeLaVersion('1.5.0')?.puces.map((puce) => puce.intitule)).toEqual([
      'La poche.',
      'La fumée.',
      'La mine.',
      'Les mines de zone.',
      'L’Évadé.',
    ]);
    expect(noteDeLaVersion('1.6.0')?.titre).toBe('On a marché sur la Lune');
    expect(noteDeLaVersion('1.6.0')?.puces.map((puce) => puce.intitule)).toEqual([
      'La Station lunaire.',
      'Jour ou nuit.',
      'Un vaisseau.',
    ]);
    expect(noteDeLaVersion('1.7.0')?.titre).toBe('Le lundi, c’est défis');
    expect(noteDeLaVersion('1.8.0')?.titre).toBe('Derrière les barreaux');
    expect(noteDeLaVersion('1.8.0')?.puces.map((puce) => puce.intitule)).toEqual([
      'Prison Island.',
      'Jour ou nuit.',
      'Des cachettes.',
    ]);
  });
});

describe('notesParues', () => {
  it('rend tout l historique jusqu a la version servie, la plus recente en tete', () => {
    expect(notesParues('1.7.2').map((note) => note.version)).toEqual(['1.7', '1.6', '1.5']);
  });

  it('ne rend pas les notes d une version a venir', () => {
    expect(notesParues('1.6.0').map((note) => note.version)).toEqual(['1.6', '1.5']);
    expect(notesParues('1.4.0')).toEqual([]);
  });

  it('range 1.10 apres 1.9, et 2.0 apres les deux', () => {
    const notes = ['1.9', '2.0', '1.10'].map(noteDEssai);

    expect(notesParues('2.0.0', notes).map((note) => note.version)).toEqual(['2.0', '1.10', '1.9']);
  });
});
