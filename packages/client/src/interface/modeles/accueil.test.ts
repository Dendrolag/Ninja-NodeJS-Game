/**
 * Tests du modele de l'accueil.
 *
 * Ce qu'ils protegent: le joueur ne peut pas envoyer un pseudo que le serveur
 * refuserait pour sa forme, il sait pourquoi, et un refus du serveur ne reste pas
 * affiche sous un pseudo qu'il n'a pas concerne.
 */

import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleAccueil } from './accueil.js';

/** Un client dont le lien est etabli. */
const CONNECTE: EtatClient = { ...ETAT_INITIAL, connexion: 'connecte', moi: 'moi' };

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
      erreur: undefined,
      enAttente: false,
      peutJouer: true,
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
