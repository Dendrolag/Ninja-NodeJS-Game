/**
 * Tests du modele du profil.
 *
 * Ce qu'ils protegent: le profil affiche est celui que la route a rendu, mis en
 * forme sans rien recalculer, et un compte qui n'a jamais joue ne voit pas de zero
 * trompeur.
 */

import type { ProfilDuCompte } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { ETAT_INITIAL } from '../../etat.js';
import { formaterFinDePartie, formaterJour, modeleProfil } from './profil.js';
import { formaterNombre } from './progression.js';

const PROFIL: ProfilDuCompte = {
  pseudo: 'ShadowFox',
  niveau: 2,
  xpTotale: 150,
  pieces: 1280,
  pointsLigue: 320,
  inscritLe: '2026-09-11T12:00:00.000Z',
  statistiques: { partiesJouees: 12, victoires: 4, meilleurScore: 99 },
  dernieresParties: [
    {
      mode: 'classique',
      carte: 'map3',
      modeMiroir: true,
      placement: 1,
      nombreJoueurs: 3,
      points: 42,
      xpGagnee: 150,
      piecesGagnees: 15,
      variationPointsLigue: 20,
      termineeLe: '2026-09-12T18:30:00.000Z',
    },
    {
      mode: 'classique',
      carte: 'map1',
      modeMiroir: false,
      placement: 4,
      nombreJoueurs: 4,
      points: 3,
      xpGagnee: 30,
      piecesGagnees: 3,
      variationPointsLigue: -10,
      termineeLe: '2026-09-12T17:00:00.000Z',
    },
  ],
};

describe('modeleProfil', () => {
  it('attend le profil tant qu il n est pas lu', () => {
    expect(modeleProfil(ETAT_INITIAL)).toEqual({ nature: 'chargement' });
    expect(modeleProfil({ ...ETAT_INITIAL, profil: { statut: 'chargement' } })).toEqual({
      nature: 'chargement',
    });
  });

  it('dit pourquoi le profil n a pas pu etre lu', () => {
    expect(
      modeleProfil({
        ...ETAT_INITIAL,
        profil: { statut: 'echec', motif: 'Le serveur ne répond pas.' },
      }),
    ).toEqual({ nature: 'echec', motif: 'Le serveur ne répond pas.' });
  });

  it('reprend le profil rendu par la route', () => {
    const modele = modeleProfil({ ...ETAT_INITIAL, profil: { statut: 'charge', profil: PROFIL } });

    expect(modele).toMatchObject({
      nature: 'charge',
      pseudo: 'ShadowFox',
      initiales: 'SF',
      palier: 'Or',
      inscription: `Inscrit le ${formaterJour(PROFIL.inscritLe)}`,
      barre: { niveau: 2, pourCent: 25, xp: '50 / 200 XP' },
      statistiques: [
        { libelle: 'Parties jouées', valeur: '12' },
        { libelle: 'Victoires', valeur: '4' },
        { libelle: 'Meilleur score', valeur: '99' },
        { libelle: 'Pièces', valeur: formaterNombre(1280) },
        { libelle: 'Points de ligue', valeur: '320' },
      ],
    });
  });

  it('met en forme chaque partie de l historique, dans l ordre recu', () => {
    const modele = modeleProfil({ ...ETAT_INITIAL, profil: { statut: 'charge', profil: PROFIL } });

    expect(modele.nature === 'charge' ? modele.parties : []).toEqual([
      {
        date: formaterFinDePartie('2026-09-12T18:30:00.000Z'),
        partie: 'Classique · Spirit & Time · Miroir',
        place: '1re sur 3',
        points: '42',
        xp: '+150',
        pieces: '+15',
        ligue: '+20',
        sensDeLaLigue: 'hausse',
      },
      {
        date: formaterFinDePartie('2026-09-12T17:00:00.000Z'),
        partie: 'Classique · Rainy Tokyo',
        place: '4e sur 4',
        points: '3',
        xp: '+30',
        pieces: '+3',
        ligue: '−10',
        sensDeLaLigue: 'baisse',
      },
    ]);
  });

  it('ecrit un tiret, et non un zero, quand aucune partie n a donne de score', () => {
    const modele = modeleProfil({
      ...ETAT_INITIAL,
      profil: {
        statut: 'charge',
        profil: {
          ...PROFIL,
          statistiques: { partiesJouees: 0, victoires: 0 },
          dernieresParties: [],
        },
      },
    });

    expect(modele.nature === 'charge' ? modele.statistiques[2] : undefined).toEqual({
      libelle: 'Meilleur score',
      valeur: '—',
    });
  });
});
