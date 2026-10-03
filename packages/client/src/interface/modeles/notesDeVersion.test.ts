/**
 * Tests des notes de version (etape 4.9).
 *
 * Ce qu'ils protegent: la regle d'avancement du numero. Une version mineure
 * s'accompagne toujours d'une note: avancer le numero sans l'ecrire fait echouer
 * ce fichier. Et le texte de la note 1.5, arrete avec le porteur du projet.
 */

import { NUMERO_DE_VERSION, versionMineure } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { NOTES_DE_VERSION, noteDeLaVersion } from './notesDeVersion.js';

describe('les notes de version', () => {
  it('ont une note pour la version mineure servie: un numero mineur ne va pas sans sa note', () => {
    expect(noteDeLaVersion(NUMERO_DE_VERSION)?.version).toBe(versionMineure(NUMERO_DE_VERSION));
  });

  it('ont une note par version mineure, jamais deux', () => {
    const versions = NOTES_DE_VERSION.map((note) => note.version);

    expect(new Set(versions).size).toBe(versions.length);
    expect(versions.every((version) => /^\d+\.\d+$/.test(version))).toBe(true);
  });

  it('ne laissent ni section vide ni texte vide', () => {
    for (const note of NOTES_DE_VERSION) {
      expect(note.titre).not.toBe('');
      expect(note.sections.length).toBeGreaterThan(0);

      for (const section of note.sections) {
        expect(section.puces.length).toBeGreaterThan(0);
        expect(section.puces.every((puce) => puce.texte.trim() !== '')).toBe(true);
      }
    }
  });

  it('donnent a un correctif la note de sa version mineure, et rien a une version sans note', () => {
    expect(noteDeLaVersion('1.5.0')?.titre).toBe('Nouveautés de la version 1.5');
    expect(noteDeLaVersion('1.5.4')?.titre).toBe('Nouveautés de la version 1.5');
    expect(noteDeLaVersion('0.9.0')).toBeUndefined();
  });

  it('disent de la version 1.5 le texte arrete avec le porteur du projet', () => {
    const note = noteDeLaVersion('1.5.0');

    expect(note?.sections.map((section) => section.titre)).toEqual([
      'Objets, poche et mines',
      'L’Évadé',
    ]);
    expect(note?.sections[0]?.puces.map((puce) => puce.intitule)).toEqual([
      'La poche.',
      'La fumée.',
      'La mine.',
      'Les mines de zone.',
    ]);
    expect(note?.sections[1]?.puces[0]?.texte).toContain('double son score jusqu’à la fin');
  });
});
