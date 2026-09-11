/**
 * Tests du compte dans l'en-tete.
 *
 * Ce qu'ils protegent: ce que l'en-tete montre d'un compte se deduit de sa
 * progression par les regles partagees, et rien n'y mene hors d'une partie en
 * cours.
 */

import type { MaProgression } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleCompteDeLEntete } from './entete.js';
import { formaterNombre } from './progression.js';

const PROGRESSION: MaProgression = {
  pseudo: 'ShadowFox',
  niveau: 2,
  xpTotale: 150,
  pieces: 1280,
  pointsLigue: 120,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

const COMPTE: EtatClient = {
  ...ETAT_INITIAL,
  session: { nature: 'compte', progression: PROGRESSION },
};

describe('modeleCompteDeLEntete', () => {
  it('ne montre rien pendant que la session se verifie', () => {
    expect(modeleCompteDeLEntete({ ...ETAT_INITIAL, session: { nature: 'verification' } })).toEqual(
      { nature: 'aucun' },
    );
  });

  it('propose a un invite de se connecter, hors partie et hors de l ecran de connexion', () => {
    expect(modeleCompteDeLEntete(ETAT_INITIAL)).toEqual({
      nature: 'invite',
      peutSeConnecter: true,
    });
    expect(modeleCompteDeLEntete({ ...ETAT_INITIAL, ecran: 'connexion' })).toEqual({
      nature: 'invite',
      peutSeConnecter: false,
    });
    expect(modeleCompteDeLEntete({ ...ETAT_INITIAL, ecran: 'salon' })).toEqual({
      nature: 'invite',
      peutSeConnecter: false,
    });
  });

  it('montre le niveau, son avancement, le palier et les pieces d un compte', () => {
    const modele = modeleCompteDeLEntete(COMPTE);

    // 150 XP: le niveau 2 commence a 100 et coute 200.
    expect(modele).toMatchObject({
      nature: 'compte',
      pseudo: 'ShadowFox',
      initiales: 'SF',
      niveau: 2,
      avancementPourCent: 25,
      xp: '50 / 200 XP',
      palier: 'Argent',
      pieces: formaterNombre(1280),
    });
  });
});
