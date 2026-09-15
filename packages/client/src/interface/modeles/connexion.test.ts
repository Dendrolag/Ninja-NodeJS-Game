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
import { modeleConnexion } from './connexion.js';

/** Une saisie de connexion valide, modifiable. */
function saisie(modifications: Partial<SaisieDeCompte> = {}): SaisieDeCompte {
  return {
    nature: 'connexion',
    pseudo: 'Alice',
    motDePasse: 'correct cheval',
    pseudoVisite: false,
    motDePasseVisite: false,
    ...modifications,
  };
}

/** Un etat dont la derniere demande de compte a ete refusee. */
function refusee(nature: 'connexion' | 'inscription', champ: string, motif: string): EtatClient {
  return {
    ...ETAT_INITIAL,
    demandeDeCompte: { enCours: false, nature, pseudo: 'Alice', erreurs: [{ champ, motif }] },
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
        demandeDeCompte: { enCours: true, nature: 'connexion', pseudo: 'Alice', erreurs: [] },
      },
      saisie(),
    );

    expect(modele.enCours).toBe(true);
    expect(modele.envoi).toBeUndefined();
  });
});
