/**
 * Tests du modele de l'ecran de connexion.
 *
 * Ce qu'ils protegent: rien ne part que le serveur refuserait pour sa forme, une
 * faute ne s'affiche qu'une fois le champ visite, et un refus du serveur ne reste
 * affiche que sous la saisie qui l'a provoque.
 */

import { BORNES_MOT_DE_PASSE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import type { SaisieDeCompte } from './connexion.js';
import { INTRO_DU_COMPTE, INTRO_DU_MOT_DE_PASSE_OUBLIE, modeleConnexion } from './connexion.js';

/** Une saisie de connexion valide, modifiable. */
function saisie(modifications: Partial<SaisieDeCompte> = {}): SaisieDeCompte {
  return {
    nature: 'connexion',
    pseudo: 'Alice',
    motDePasse: 'correct cheval',
    codeDeSecours: '',
    pseudoVisite: false,
    motDePasseVisite: false,
    codeVisite: false,
    ...modifications,
  };
}

/** Un etat dont la derniere demande de compte a ete refusee. */
function refusee(
  nature: 'connexion' | 'inscription' | 'reinitialisation',
  champ: string,
  motif: string,
): EtatClient {
  return {
    ...ETAT_INITIAL,
    demandeDeCompte: {
      enCours: false,
      nature,
      pseudo: 'Alice',
      erreurs: [{ champ, motif }],
      acceptee: false,
    },
  };
}

describe('modeleConnexion', () => {
  it('prepare la demande de connexion d une saisie valide', () => {
    const modele = modeleConnexion(ETAT_INITIAL, saisie());

    expect(modele.envoi).toEqual({
      nature: 'connexion',
      demande: { pseudo: 'Alice', motDePasse: 'correct cheval' },
    });
    expect(modele.bouton).toBe('Se connecter');
    expect(modele.autocompletion).toBe('current-password');
    expect(modele.aideMotDePasse).toBeUndefined();
  });

  it('normalise le pseudo comme le serveur', () => {
    const envoi = modeleConnexion(ETAT_INITIAL, saisie({ pseudo: '  Alice ' })).envoi;

    expect(envoi?.demande.pseudo).toBe('Alice');
  });

  it('ne laisse pas partir un mot de passe vide, sans le reprocher', () => {
    const modele = modeleConnexion(
      ETAT_INITIAL,
      saisie({ motDePasse: '', motDePasseVisite: true }),
    );

    expect(modele.envoi).toBeUndefined();
    expect(modele.erreurMotDePasse).toBeUndefined();
  });

  it('n affiche une faute qu une fois le champ visite', () => {
    const avant = modeleConnexion(ETAT_INITIAL, saisie({ pseudo: 'Al<b>' }));
    const apres = modeleConnexion(ETAT_INITIAL, saisie({ pseudo: 'Al<b>', pseudoVisite: true }));

    expect(avant.envoi).toBeUndefined();
    expect(avant.erreurPseudo).toBeUndefined();
    expect(apres.erreurPseudo).toContain("n'accepte que");
  });

  it('a l inscription, exige la longueur du serveur et la rappelle', () => {
    const modele = modeleConnexion(
      ETAT_INITIAL,
      saisie({ nature: 'inscription', motDePasse: 'court', motDePasseVisite: true }),
    );

    expect(modele.envoi).toBeUndefined();
    expect(modele.erreurMotDePasse).toContain(String(BORNES_MOT_DE_PASSE.longueur.minimum));
    expect(modele.aideMotDePasse).toContain(String(BORNES_MOT_DE_PASSE.longueur.minimum));
    expect(modele.autocompletion).toBe('new-password');
    expect(modele.bouton).toBe('Créer le compte');
  });

  it('prepare la demande d inscription d une saisie valide', () => {
    expect(modeleConnexion(ETAT_INITIAL, saisie({ nature: 'inscription' })).envoi).toEqual({
      nature: 'inscription',
      demande: { pseudo: 'Alice', motDePasse: 'correct cheval' },
    });
  });

  it('montre le refus du serveur tant que la saisie est celle qui l a provoque', () => {
    const etat = refusee('connexion', 'connexion', 'Pseudo ou mot de passe incorrect.');

    expect(modeleConnexion(etat, saisie()).erreurGenerale).toBe(
      'Pseudo ou mot de passe incorrect.',
    );
    expect(modeleConnexion(etat, saisie({ pseudo: 'Bob' })).erreurGenerale).toBeUndefined();
    expect(modeleConnexion(etat, saisie({ nature: 'inscription' })).erreurGenerale).toBeUndefined();
  });

  it('range un refus du serveur sous le champ qu il concerne', () => {
    const etat = refusee('inscription', 'pseudo', 'Ce pseudo est déjà pris.');
    const modele = modeleConnexion(etat, saisie({ nature: 'inscription' }));

    expect(modele.erreurPseudo).toBe('Ce pseudo est déjà pris.');
    expect(modele.erreurGenerale).toBeUndefined();
  });

  it('ne laisse rien partir pendant qu une demande attend sa reponse', () => {
    const modele = modeleConnexion(
      {
        ...ETAT_INITIAL,
        demandeDeCompte: {
          enCours: true,
          nature: 'connexion',
          pseudo: 'Alice',
          erreurs: [],
          acceptee: false,
        },
      },
      saisie(),
    );

    expect(modele.enCours).toBe(true);
    expect(modele.envoi).toBeUndefined();
  });

  it('propose les onglets, sans code de secours, pour se connecter ou s inscrire', () => {
    expect(modeleConnexion(ETAT_INITIAL, saisie())).toMatchObject({
      titre: 'Votre compte',
      intro: INTRO_DU_COMPTE,
      onglets: true,
      demandeLeCode: false,
      libelleMotDePasse: 'Mot de passe',
    });
  });
});

describe('modeleConnexion, mot de passe oublie (etape 3.4)', () => {
  /** Une reinitialisation valide, modifiable. */
  function oubli(modifications: Partial<SaisieDeCompte> = {}): SaisieDeCompte {
    return saisie({
      nature: 'reinitialisation',
      codeDeSecours: 'k7qm-3x9d-tp4w-8hne',
      motDePasse: 'nouveau secret',
      ...modifications,
    });
  }

  it('prepare la reinitialisation, code normalise, avec le nouveau mot de passe', () => {
    const modele = modeleConnexion(ETAT_INITIAL, oubli());

    expect(modele.envoi).toEqual({
      nature: 'reinitialisation',
      demande: {
        pseudo: 'Alice',
        codeDeSecours: 'K7QM3X9DTP4W8HNE',
        nouveauMotDePasse: 'nouveau secret',
      },
    });
    expect(modele).toMatchObject({
      titre: 'Mot de passe oublié',
      intro: INTRO_DU_MOT_DE_PASSE_OUBLIE,
      onglets: false,
      demandeLeCode: true,
      libelleMotDePasse: 'Nouveau mot de passe',
      bouton: 'Changer le mot de passe',
      autocompletion: 'new-password',
    });
    expect(modele.aideMotDePasse).toContain(String(BORNES_MOT_DE_PASSE.longueur.minimum));
  });

  it('range ses fautes sous le code et sous le mot de passe, une fois visites', () => {
    const avant = modeleConnexion(
      ETAT_INITIAL,
      oubli({ codeDeSecours: 'abc', motDePasse: 'court' }),
    );
    const apres = modeleConnexion(
      ETAT_INITIAL,
      oubli({
        codeDeSecours: 'abc',
        motDePasse: 'court',
        codeVisite: true,
        motDePasseVisite: true,
      }),
    );

    expect(avant.envoi).toBeUndefined();
    expect([avant.erreurCode, avant.erreurMotDePasse]).toEqual([undefined, undefined]);
    expect(apres.erreurCode).toContain('16');
    expect(apres.erreurMotDePasse).toContain(String(BORNES_MOT_DE_PASSE.longueur.minimum));
  });

  it('montre le refus du code en erreur generale, sous la reinitialisation seulement', () => {
    const etat = refusee(
      'reinitialisation',
      'reinitialisation',
      'Pseudo ou code de secours incorrect.',
    );

    expect(modeleConnexion(etat, oubli()).erreurGenerale).toBe(
      'Pseudo ou code de secours incorrect.',
    );
    expect(modeleConnexion(etat, saisie()).erreurGenerale).toBeUndefined();
  });

  it('range un refus du nouveau mot de passe sous le champ du mot de passe', () => {
    const etat = refusee('reinitialisation', 'nouveauMotDePasse', 'Trop court.');

    expect(modeleConnexion(etat, oubli()).erreurMotDePasse).toBe('Trop court.');
  });
});
