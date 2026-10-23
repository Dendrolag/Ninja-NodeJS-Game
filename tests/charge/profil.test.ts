/**
 * Le resume d'un profil du processeur (etape 5.10), sur un profil fabrique a la main.
 */

import { describe, expect, it } from 'vitest';

import type { ProfilDuProcesseur } from './profil.ts';
import { resumeEnTexte, resumerLeProfil } from './profil.ts';

/**
 * Une pile de trois fonctions: tick dans moteur.ts appelle releverLesContacts dans
 * contacts.ts, qui appelle distance dans contacts.ts aussi. Quatre echantillons d'une
 * milliseconde: deux dans distance, un dans releverLesContacts, un dans tick.
 */
const PROFIL: ProfilDuProcesseur = {
  nodes: [
    { id: 1, callFrame: { functionName: '(root)', url: '', lineNumber: -1 }, children: [2] },
    {
      id: 2,
      callFrame: { functionName: 'tick', url: 'file:///sim/dist/moteur.js', lineNumber: 9 },
      children: [3],
    },
    {
      id: 3,
      callFrame: {
        functionName: 'releverLesContacts',
        url: 'file:///sim/dist/contacts.js',
        lineNumber: 19,
      },
      children: [4],
    },
    {
      id: 4,
      callFrame: { functionName: 'distance', url: 'file:///sim/dist/contacts.js', lineNumber: 4 },
    },
  ],
  samples: [4, 4, 3, 2],
  timeDeltas: [1000, 1000, 1000, 1000],
};

describe('resumerLeProfil', () => {
  it('range le temps propre par fonction', () => {
    const resume = resumerLeProfil(PROFIL);

    expect(resume.totalMs).toBe(4);
    expect(resume.fonctions[0]).toEqual({ nom: 'distance contacts.js:5', ms: 2, pourCent: 50 });
    expect(resume.fonctions.map((part) => part.ms)).toEqual([2, 1, 1]);
  });

  it('range le temps inclus par fichier, une fois par echantillon', () => {
    const fichiers = new Map(resumerLeProfil(PROFIL).fichiers.map((part) => [part.nom, part.ms]));

    // Deux fonctions de contacts.js sur la pile ne comptent qu'une fois.
    expect(fichiers.get('contacts.js')).toBe(3);
    expect(fichiers.get('moteur.js')).toBe(4);
  });

  it('s ecrit en texte, ses lignes les plus lourdes d abord', () => {
    const texte = resumeEnTexte(resumerLeProfil(PROFIL), 1);

    expect(texte).toContain('50.0 %');
    expect(texte).toContain('distance contacts.js:5');
    expect(texte).not.toContain('releverLesContacts');
  });
});
