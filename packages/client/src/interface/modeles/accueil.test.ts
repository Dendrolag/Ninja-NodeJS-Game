/**
 * Tests du modele de l'accueil.
 *
 * Ce qu'ils protegent: le joueur ne peut pas envoyer un pseudo que le serveur
 * refuserait pour sa forme, il sait pourquoi, et un refus du serveur ne reste pas
 * affiche sous un pseudo qu'il n'a pas concerne. Depuis la reprise des ecrans du
 * jalon 3: un compte n'a pas de pseudo a choisir, et un lien refuse se dit.
 */

import type { MaProgression } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { AVIS_SESSION_EXPIREE, modeleAccueil } from './accueil.js';

/** Un client dont le lien est etabli. */
const CONNECTE: EtatClient = { ...ETAT_INITIAL, connexion: 'connecte', moi: 'moi' };

const PROGRESSION: MaProgression = {
  pseudo: 'Alice',
  niveau: 2,
  xpTotale: 150,
  pieces: 15,
  pointsLigue: 20,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

/** Un compte dont le lien est etabli. */
const COMPTE: EtatClient = {
  ...CONNECTE,
  session: { nature: 'compte', progression: PROGRESSION },
};

describe('modeleAccueil', () => {
  it('attend que le lien soit etabli pour laisser jouer', () => {
    const modele = modeleAccueil(ETAT_INITIAL, 'Alice');

    expect(modele.lien).toBe('enCours');
    expect(modele.peutJouer).toBe(false);
  });

  it('distingue un lien perdu d un lien qui s etablit', () => {
    const modele = modeleAccueil({ ...ETAT_INITIAL, connexion: 'perdue' }, 'Alice');

    expect(modele.lien).toBe('perdu');
    expect(modele.peutJouer).toBe(false);
  });

  it('laisse jouer avec un pseudo valide', () => {
    expect(modeleAccueil(CONNECTE, 'Alice')).toEqual({
      lien: 'etabli',
      motifDuLien: undefined,
      pseudoRequis: true,
      pseudoDuCompte: undefined,
      pseudo: 'Alice',
      avis: undefined,
      erreur: undefined,
      enAttente: false,
      peutJouer: true,
      peutContinuerEnInvite: false,
    });
  });

  it('ne laisse pas redemander pendant qu une entree attend sa reponse', () => {
    const modele = modeleAccueil({ ...CONNECTE, entreeEnCours: true }, 'Alice');

    expect(modele.enAttente).toBe(true);
    expect(modele.peutJouer).toBe(false);
  });

  it('ne signale rien tant que le champ est vide, sans laisser jouer', () => {
    const modele = modeleAccueil(CONNECTE, '   ');

    expect(modele.erreur).toBeUndefined();
    expect(modele.peutJouer).toBe(false);
  });

  it('refuse un pseudo avec le motif meme du serveur', () => {
    // Le balisage dans un pseudo est l'origine de la faille S1: il ne doit pas
    // pouvoir partir.
    const modele = modeleAccueil(CONNECTE, 'Alice<b>');

    expect(modele.peutJouer).toBe(false);
    expect(modele.erreur).toContain("n'accepte que");
  });

  it('montre le refus du serveur pour le pseudo demande, et l oublie quand la saisie change', () => {
    const refuse: EtatClient = {
      ...CONNECTE,
      pseudoDemande: 'Alice',
      refus: {
        action: 'rejoindre',
        erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris dans cette partie.' }],
      },
    };

    expect(modeleAccueil(refuse, ' Alice ').erreur).toBe(
      'Ce pseudo est déjà pris dans cette partie.',
    );
    expect(modeleAccueil(refuse, 'Alicia').erreur).toBeUndefined();
  });
});

describe('modeleAccueil, pour un compte', () => {
  it('ne demande pas de pseudo, et laisse jouer sans', () => {
    const modele = modeleAccueil(COMPTE, '');

    expect(modele.pseudoRequis).toBe(false);
    expect(modele.pseudoDuCompte).toBe('Alice');
    expect(modele.peutJouer).toBe(true);
  });

  it('ignore ce qui traine dans le champ du pseudo, qui ne partira pas', () => {
    const modele = modeleAccueil(COMPTE, 'Al<b>');

    expect(modele.erreur).toBeUndefined();
    expect(modele.peutJouer).toBe(true);
  });

  it('montre le refus d entree du serveur, faute de pseudo auquel le rattacher', () => {
    const modele = modeleAccueil(
      {
        ...COMPTE,
        refus: {
          action: 'rejoindre',
          erreurs: [{ champ: 'rejoindre', motif: 'Cette partie est complète.' }],
        },
      },
      '',
    );

    expect(modele.erreur).toBe('Cette partie est complète.');
  });

  it('ne demande pas de pseudo pendant que la session gardee se verifie', () => {
    const modele = modeleAccueil({ ...CONNECTE, session: { nature: 'verification' } }, '');

    expect(modele.pseudoRequis).toBe(false);
    expect(modele.pseudoDuCompte).toBeUndefined();
  });
});

describe('modeleAccueil, quand le lien est refuse', () => {
  const REFUSE: EtatClient = {
    ...ETAT_INITIAL,
    connexion: 'refusee',
    refusDeConnexion: 'Session invalide ou expirée. Reconnectez-vous.',
  };

  it('montre le motif, sans laisser jouer', () => {
    const modele = modeleAccueil(REFUSE, 'Alice');

    expect(modele.lien).toBe('refuse');
    expect(modele.motifDuLien).toBe('Session invalide ou expirée. Reconnectez-vous.');
    expect(modele.peutJouer).toBe(false);
  });

  it('ne propose de continuer en invite que si le lien presentait une session', () => {
    expect(modeleAccueil(REFUSE, '').peutContinuerEnInvite).toBe(false);
    expect(
      modeleAccueil({ ...REFUSE, session: { nature: 'verification' } }, '').peutContinuerEnInvite,
    ).toBe(true);
    expect(
      modeleAccueil({ ...REFUSE, session: { nature: 'compte', progression: PROGRESSION } }, '')
        .peutContinuerEnInvite,
    ).toBe(true);
  });

  it('dit a un invite que sa session gardee a expire', () => {
    const modele = modeleAccueil(
      { ...CONNECTE, session: { nature: 'invite', sessionExpiree: true } },
      '',
    );

    expect(modele.avis).toBe(AVIS_SESSION_EXPIREE);
  });
});
