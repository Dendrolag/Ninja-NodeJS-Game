/**
 * Tests du modele de la fiche d'un joueur (etape 3.5).
 *
 * Ce qu'ils protegent: la fenetre suit l'etat de la fiche, et la fiche lue se met en
 * forme comme le profil, sans rien recalculer.
 */

import type { FicheJoueur } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { ETAT_INITIAL } from '../../etat.js';
import { modeleFiche } from './fiche.js';
import { formaterJour } from './profil.js';
import { formaterNombre } from './progression.js';

const FICHE: FicheJoueur = {
  pseudo: 'ShadowFox',
  inscritLe: '2026-09-11T12:00:00.000Z',
  niveau: 12,
  palier: 'platine',
  relation: 'aucune',
  statistiques: {
    partiesJouees: 40,
    partiesAPlusieurs: 38,
    victoires: 12,
    modePrefere: 'tactique',
    parMode: [
      {
        mode: 'tactique',
        partiesJouees: 30,
        partiesAPlusieurs: 29,
        victoires: 10,
        meilleurScore: 1280,
        meilleurScoreSeul: 900,
      },
      { mode: 'equipes', partiesJouees: 10, partiesAPlusieurs: 9, victoires: 2, meilleurScore: 64 },
    ],
  },
};

describe('modeleFiche', () => {
  it('est fermee sans fiche ouverte', () => {
    expect(modeleFiche(ETAT_INITIAL)).toEqual({ nature: 'fermee' });
  });

  it('dit quelle fiche se lit, et pourquoi elle n a pas pu l etre', () => {
    expect(
      modeleFiche({ ...ETAT_INITIAL, fiche: { statut: 'chargement', pseudo: 'Bob' } }),
    ).toEqual({ nature: 'chargement', pseudo: 'Bob' });
    expect(
      modeleFiche({
        ...ETAT_INITIAL,
        fiche: { statut: 'echec', pseudo: 'Bob', motif: 'Aucun compte ne porte ce pseudo.' },
      }),
    ).toEqual({ nature: 'echec', pseudo: 'Bob', motif: 'Aucun compte ne porte ce pseudo.' });
  });

  it('met en forme la fiche lue: identite, tuiles et tableau par mode', () => {
    expect(
      modeleFiche({
        ...ETAT_INITIAL,
        fiche: { statut: 'chargee', pseudo: 'shadowfox', fiche: FICHE },
      }),
    ).toEqual({
      nature: 'chargee',
      // L'ecriture du compte, pas celle de la demande.
      pseudo: 'ShadowFox',
      initiales: 'SF',
      niveau: 'Niveau 12',
      palier: 'Platine',
      inscription: `Membre depuis le ${formaterJour(FICHE.inscritLe)}`,
      statistiques: [
        { libelle: 'Parties jouées', valeur: '40' },
        { libelle: 'Victoires', valeur: '12', detail: 'sur 38 parties à plusieurs' },
        { libelle: 'Mode préféré', valeur: 'Tactique' },
      ],
      parMode: [
        {
          mode: 'Tactique',
          parties: '30',
          victoires: '10 sur 29',
          meilleurScore: formaterNombre(1280),
          meilleurScoreSeul: '900',
        },
        {
          mode: 'Équipes',
          parties: '10',
          victoires: '2 sur 9',
          meilleurScore: '64',
          meilleurScoreSeul: '—',
        },
      ],
    });
  });
});
