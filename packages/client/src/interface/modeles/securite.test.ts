/**
 * Tests du modele de la securite du compte, dans le profil (etape 3.4).
 *
 * Ce qu'ils protegent: rien ne part que le serveur refuserait pour sa forme, ni
 * pendant qu'une autre demande attend; une faute ne s'affiche qu'une fois le champ
 * visite; la reponse du serveur ne s'affiche que sous le formulaire qui l'a
 * provoquee, et plus des que le joueur retouche sa saisie.
 */

import { BORNES_MOT_DE_PASSE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { progressionDEssai } from '../../comptes/api.js';
import type { DemandeDeCompte, EtatClient } from '../../etat.js';
import { AUCUNE_DEMANDE_DE_COMPTE, ETAT_INITIAL } from '../../etat.js';
import type { SaisieDeChangement, SaisieDeCode } from './securite.js';
import {
  CONFIRMATION_DU_CHANGEMENT,
  CONFIRMATION_DU_CODE,
  modeleChangementMotDePasse,
  modeleNouveauCode,
} from './securite.js';

/** Un compte connecte, dont la derniere demande est celle-ci. */
function compte(demande: Partial<DemandeDeCompte> = {}): EtatClient {
  return {
    ...ETAT_INITIAL,
    session: { nature: 'compte', progression: progressionDEssai('Alice') },
    demandeDeCompte: { ...AUCUNE_DEMANDE_DE_COMPTE, ...demande },
  };
}

/** Une saisie de changement valide, modifiable. */
function changement(modifications: Partial<SaisieDeChangement> = {}): SaisieDeChangement {
  return {
    motDePasse: 'correct cheval',
    nouveauMotDePasse: 'nouveau secret',
    motDePasseVisite: false,
    nouveauVisite: false,
    modifieeDepuisLEnvoi: false,
    ...modifications,
  };
}

/** Une saisie de nouveau code valide, modifiable. */
function code(modifications: Partial<SaisieDeCode> = {}): SaisieDeCode {
  return {
    motDePasse: 'correct cheval',
    motDePasseVisite: false,
    modifieeDepuisLEnvoi: false,
    ...modifications,
  };
}

describe('modeleChangementMotDePasse', () => {
  it('prepare la demande d une saisie valide, et rappelle la regle du nouveau mot de passe', () => {
    const modele = modeleChangementMotDePasse(compte(), changement());

    expect(modele.envoi).toEqual({
      motDePasse: 'correct cheval',
      nouveauMotDePasse: 'nouveau secret',
    });
    expect(modele.bouton).toBe('Changer le mot de passe');
    expect(modele.aideNouveau).toContain(String(BORNES_MOT_DE_PASSE.longueur.minimum));
    expect(modele.aideNouveau).toContain('autres appareils');
  });

  it('ne laisse pas partir un mot de passe actuel vide, ni un nouveau trop court', () => {
    expect(
      modeleChangementMotDePasse(compte(), changement({ motDePasse: '' })).envoi,
    ).toBeUndefined();
    expect(
      modeleChangementMotDePasse(compte(), changement({ nouveauMotDePasse: 'court' })).envoi,
    ).toBeUndefined();
  });

  it('n affiche une faute qu une fois le champ visite', () => {
    const avant = modeleChangementMotDePasse(compte(), changement({ nouveauMotDePasse: 'court' }));
    const apres = modeleChangementMotDePasse(
      compte(),
      changement({ nouveauMotDePasse: 'court', nouveauVisite: true }),
    );

    expect(avant.erreurNouveau).toBeUndefined();
    expect(apres.erreurNouveau).toContain(String(BORNES_MOT_DE_PASSE.longueur.minimum));
  });

  it('montre un mot de passe faux sous son champ, et l oublie quand la saisie change', () => {
    const etat = compte({
      nature: 'motDePasse',
      erreurs: [{ champ: 'motDePasse', motif: 'Mot de passe incorrect.' }],
    });

    expect(modeleChangementMotDePasse(etat, changement()).erreurMotDePasse).toBe(
      'Mot de passe incorrect.',
    );
    expect(
      modeleChangementMotDePasse(etat, changement({ modifieeDepuisLEnvoi: true })).erreurMotDePasse,
    ).toBeUndefined();
  });

  it('montre un refus general, et jamais celui de l autre formulaire', () => {
    const etat = compte({
      nature: 'motDePasse',
      erreurs: [{ champ: 'tentatives', motif: 'Trop de tentatives.' }],
    });

    expect(modeleChangementMotDePasse(etat, changement()).erreurGenerale).toBe(
      'Trop de tentatives.',
    );
    expect(modeleNouveauCode(etat, code()).erreurGenerale).toBeUndefined();
  });

  it('confirme le changement, jusqu a ce que la saisie change', () => {
    const etat = compte({ nature: 'motDePasse', acceptee: true });

    expect(modeleChangementMotDePasse(etat, changement()).confirmation).toBe(
      CONFIRMATION_DU_CHANGEMENT,
    );
    expect(
      modeleChangementMotDePasse(etat, changement({ modifieeDepuisLEnvoi: true })).confirmation,
    ).toBeUndefined();
    expect(modeleNouveauCode(etat, code()).confirmation).toBeUndefined();
  });

  it('ne laisse rien partir pendant qu une demande attend, et ne dit « un instant » que pour la sienne', () => {
    const attendChangement = compte({ nature: 'motDePasse', enCours: true });
    const attendCode = compte({ nature: 'codeDeSecours', enCours: true });

    expect(modeleChangementMotDePasse(attendChangement, changement())).toMatchObject({
      enCours: true,
      bouton: 'Un instant…',
      envoi: undefined,
    });
    expect(modeleChangementMotDePasse(attendCode, changement())).toMatchObject({
      enCours: false,
      bouton: 'Changer le mot de passe',
      envoi: undefined,
    });
  });
});

describe('modeleNouveauCode', () => {
  it('prepare la demande avec le mot de passe actuel', () => {
    const modele = modeleNouveauCode(compte(), code());

    expect(modele.envoi).toEqual({ motDePasse: 'correct cheval' });
    expect(modele.bouton).toBe('Créer un nouveau code');
  });

  it('ne laisse pas partir un mot de passe vide', () => {
    expect(modeleNouveauCode(compte(), code({ motDePasse: '' })).envoi).toBeUndefined();
  });

  it('montre un mot de passe faux, puis confirme un code cree', () => {
    const refuse = compte({
      nature: 'codeDeSecours',
      erreurs: [{ champ: 'motDePasse', motif: 'Mot de passe incorrect.' }],
    });
    const cree = compte({ nature: 'codeDeSecours', acceptee: true });

    expect(modeleNouveauCode(refuse, code()).erreurMotDePasse).toBe('Mot de passe incorrect.');
    expect(modeleNouveauCode(cree, code()).confirmation).toBe(CONFIRMATION_DU_CODE);
    expect(modeleChangementMotDePasse(refuse, changement()).erreurMotDePasse).toBeUndefined();
  });
});
