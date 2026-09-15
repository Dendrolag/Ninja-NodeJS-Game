/**
 * Tests de ce qu'on dit du lien avec le serveur (etape 2.6).
 *
 * Ce qu'ils protegent: un lien perdu que la page retablit se dit sans rien proposer,
 * et dit le salon quand c'est la qu'on retourne; un lien que la page n'a pas pu
 * retablir propose de reessayer, pas de recharger; un refus dit son motif, et une
 * page d'une autre version ne propose que de se recharger; la ligne d'etat commune ne
 * se montre ni sur l'accueil, ni en jeu, ni quand tout va bien.
 */

import type { MaProgression } from '@neon-ninja/shared';
import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Ecran } from '../../ecrans.js';
import type { EtatClient, EtatConnexion } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import {
  TEXTE_LIEN_PERDU,
  TEXTE_RETABLISSEMENT,
  TEXTE_RETABLISSEMENT_DU_SALON,
  lienAMontrer,
  modeleDuLien,
} from './lien.js';

const PROGRESSION: MaProgression = {
  pseudo: 'Alice',
  niveau: 2,
  xpTotale: 150,
  pieces: 15,
  pointsLigue: 20,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

/** Un etat du client avec ce lien, sur cet ecran. */
function etat(connexion: EtatConnexion, ecran: Ecran = 'accueil'): EtatClient {
  return { ...ETAT_INITIAL, connexion, ecran };
}

describe('modeleDuLien', () => {
  it('dit que la page retablit le lien, sans rien proposer, et parle du salon quand on y retourne', () => {
    expect(modeleDuLien(etat('retablissement', 'parties'))).toEqual({
      lien: 'retablissement',
      texte: TEXTE_RETABLISSEMENT,
      motif: undefined,
      peutRecharger: false,
      peutReessayer: false,
      peutContinuerEnInvite: false,
    });
    expect(modeleDuLien(etat('retablissement', 'salon')).texte).toBe(TEXTE_RETABLISSEMENT_DU_SALON);
  });

  it('propose de reessayer un lien que la page n a pas pu retablir, sans recharger', () => {
    expect(modeleDuLien(etat('perdue'))).toMatchObject({
      lien: 'perdu',
      texte: TEXTE_LIEN_PERDU,
      peutReessayer: true,
      peutRecharger: false,
      peutContinuerEnInvite: false,
    });
  });

  it('dit le motif d un refus, et propose de continuer en invite a qui presentait une session', () => {
    const refuse: EtatClient = { ...etat('refusee'), refusDeConnexion: 'Session invalide.' };

    expect(modeleDuLien(refuse)).toMatchObject({
      lien: 'refuse',
      texte: 'Session invalide.',
      motif: 'Session invalide.',
      peutReessayer: true,
      peutRecharger: false,
      peutContinuerEnInvite: false,
    });
    expect(
      modeleDuLien({ ...refuse, session: { nature: 'compte', progression: PROGRESSION } })
        .peutContinuerEnInvite,
    ).toBe(true);
  });

  it('ne propose que de recharger une page d une autre version', () => {
    const perimee: EtatClient = {
      ...etat('refusee'),
      refusDeConnexion: MOTIF_VERSION_DIFFERENTE,
      session: { nature: 'compte', progression: PROGRESSION },
    };

    expect(modeleDuLien(perimee)).toMatchObject({
      peutRecharger: true,
      peutReessayer: false,
      peutContinuerEnInvite: false,
    });
  });

  it('ne dit rien d un lien etabli', () => {
    expect(modeleDuLien(etat('connecte')).texte).toBe('');
  });
});

describe('lienAMontrer', () => {
  const AUTRES_ECRANS: readonly Ecran[] = [
    'parties',
    'creation',
    'connexion',
    'profil',
    'salon',
    'fin',
  ];
  const LIENS_QUI_NE_VONT_PAS: readonly EtatConnexion[] = [
    'horsLigne',
    'perdue',
    'refusee',
    'reveil',
    'retablissement',
  ];

  it('se montre sur les autres ecrans des que le lien ne va pas', () => {
    for (const ecran of AUTRES_ECRANS) {
      for (const connexion of LIENS_QUI_NE_VONT_PAS) {
        expect(lienAMontrer(etat(connexion, ecran)), `${ecran}, ${connexion}`).toBe(true);
      }
    }
  });

  it('ne se montre ni sur l accueil, ni en jeu, ni quand le lien va bien ou revient en partie', () => {
    for (const connexion of LIENS_QUI_NE_VONT_PAS) {
      expect(lienAMontrer(etat(connexion, 'accueil'))).toBe(false);
      expect(lienAMontrer(etat(connexion, 'jeu'))).toBe(false);
    }

    for (const ecran of AUTRES_ECRANS) {
      expect(lienAMontrer(etat('connecte', ecran))).toBe(false);
      expect(lienAMontrer(etat('retour', ecran))).toBe(false);
    }
  });
});
