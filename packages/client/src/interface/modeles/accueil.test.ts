/**
 * Tests du modele de l'accueil.
 *
 * Ce qu'ils protegent: le joueur ne peut pas envoyer un pseudo que le serveur
 * refuserait pour sa forme, il sait pourquoi, et un refus du serveur ne reste pas
 * affiche sous un pseudo qu'il n'a pas concerne. Depuis la reprise des ecrans du
 * jalon 3: un compte n'a pas de pseudo a choisir, et un lien refuse se dit. Depuis
 * l'etape 5.3: une page d'une autre version que le serveur ne propose que de se
 * recharger.
 */

import type { MaProgression } from '@neon-ninja/shared';
import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { AVIS_SESSION_EXPIREE, modeleAccueil } from './accueil.js';
import { TEXTE_LIEN_PERDU, TEXTE_RETABLISSEMENT } from './lien.js';

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

  it('distingue un lien perdu d un lien qui s etablit, et propose de reessayer sans recharger (etape 2.6)', () => {
    const modele = modeleAccueil({ ...ETAT_INITIAL, connexion: 'perdue' }, 'Alice');

    expect(modele.lien).toBe('perdu');
    expect(modele.texteDuLien).toBe(TEXTE_LIEN_PERDU);
    expect(modele.peutJouer).toBe(false);
    expect(modele.peutRecharger).toBe(false);
    expect(modele.peutReessayer).toBe(true);
    expect(modeleAccueil(ETAT_INITIAL, 'Alice').texteDuLien).toBe('Connexion au serveur…');
  });

  it('dit que le lien se retablit, sans laisser jouer ni rien proposer (etape 2.6)', () => {
    expect(modeleAccueil({ ...CONNECTE, connexion: 'retablissement' }, 'Alice')).toMatchObject({
      lien: 'retablissement',
      texteDuLien: TEXTE_RETABLISSEMENT,
      peutJouer: false,
      peutRecharger: false,
      peutReessayer: false,
      peutContinuerEnInvite: false,
    });
  });

  it('laisse jouer avec un pseudo valide', () => {
    expect(modeleAccueil(CONNECTE, 'Alice')).toEqual({
      lien: 'etabli',
      // Dit aussi quand tout va bien (etape 5.5).
      texteDuLien: 'Connecté au serveur',
      motifDuLien: undefined,
      pseudoRequis: true,
      pseudoDuCompte: undefined,
      pseudo: 'Alice',
      avis: undefined,
      erreur: undefined,
      enAttente: false,
      peutJouer: true,
      peutRecharger: false,
      peutReessayer: false,
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

  it('montre le motif, sans laisser jouer, et propose de reessayer', () => {
    const modele = modeleAccueil(REFUSE, 'Alice');

    expect(modele.lien).toBe('refuse');
    expect(modele.motifDuLien).toBe('Session invalide ou expirée. Reconnectez-vous.');
    expect(modele.peutJouer).toBe(false);
    expect(modele.peutReessayer).toBe(true);
    expect(modele.peutRecharger).toBe(false);
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

describe('modeleAccueil, pendant un retour en partie (etape 2.5)', () => {
  it('dit que la page retourne dans sa partie, sans laisser jouer ailleurs ni rien proposer', () => {
    const modele = modeleAccueil({ ...CONNECTE, connexion: 'retour' }, 'Alice');

    expect(modele.lien).toBe('retour');
    expect(modele.peutJouer).toBe(false);
    expect(modele.peutRecharger).toBe(false);
    expect(modele.peutReessayer).toBe(false);
    expect(modele.peutContinuerEnInvite).toBe(false);
  });

  it('dit pourquoi une place n a pas pu etre reprise, et laisse jouer', () => {
    const modele = modeleAccueil(
      { ...CONNECTE, avisDeRetour: "Cette partie n'est plus en cours." },
      'Alice',
    );

    expect(modele.avis).toBe("Cette partie n'est plus en cours.");
    expect(modele.peutJouer).toBe(true);
  });

  it('fait passer la place perdue avant la session expiree, qui revient ensuite', () => {
    const expiree: EtatClient = {
      ...CONNECTE,
      session: { nature: 'invite', sessionExpiree: true },
    };

    expect(modeleAccueil({ ...expiree, avisDeRetour: 'Place perdue.' }, '').avis).toBe(
      'Place perdue.',
    );
    expect(modeleAccueil(expiree, '').avis).toBe(AVIS_SESSION_EXPIREE);
  });
});

describe('modeleAccueil, pendant le reveil du serveur', () => {
  it('dit que le lien attend, sans rien proposer: la page reessaie d elle-meme', () => {
    expect(modeleAccueil({ ...ETAT_INITIAL, connexion: 'reveil' }, 'Alice')).toMatchObject({
      lien: 'reveil',
      motifDuLien: undefined,
      peutJouer: false,
      peutRecharger: false,
      peutReessayer: false,
      peutContinuerEnInvite: false,
    });
  });
});

describe('modeleAccueil, quand la page n est pas de la version du serveur', () => {
  const PERIMEE: EtatClient = {
    ...ETAT_INITIAL,
    connexion: 'refusee',
    refusDeConnexion: MOTIF_VERSION_DIFFERENTE,
  };

  it('dit de recharger, et ne propose rien d autre', () => {
    const modele = modeleAccueil(PERIMEE, 'Alice');

    expect(modele.motifDuLien).toBe(MOTIF_VERSION_DIFFERENTE);
    expect(modele.peutRecharger).toBe(true);
    expect(modele.peutReessayer).toBe(false);
    expect(modele.peutContinuerEnInvite).toBe(false);
    expect(modele.peutJouer).toBe(false);
  });

  it('ne propose pas de continuer en invite, meme a une page qui presentait une session', () => {
    const modele = modeleAccueil(
      { ...PERIMEE, session: { nature: 'compte', progression: PROGRESSION } },
      '',
    );

    expect(modele.peutContinuerEnInvite).toBe(false);
  });
});
