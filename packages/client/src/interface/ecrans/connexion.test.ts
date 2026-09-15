// @vitest-environment jsdom
/**
 * Tests de l'ecran de connexion, dans un document.
 *
 * Ils jouent les gestes du joueur (saisir, changer d'onglet, envoyer) sur un vrai
 * client relie au banc d'essai du transport et a des comptes d'essai, et verifient
 * ce que la page montre et ce qui part.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { ApiComptesFactice } from '../../comptes/api.js';
import { creerApiComptesFactice } from '../../comptes/api.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import { creerReseauFactice } from '../../reseau.js';
import {
  boutonObligatoire,
  contexteDEssai,
  estCache,
  obligatoire,
  saisir,
  soumettre,
} from '../essais.js';
import { monterConnexion } from './connexion.js';
import type { EcranAffiche } from './types.js';

let api: ApiComptesFactice;
let client: Client;
let ecran: EcranAffiche;
let desabonner: () => void;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Un champ du formulaire, par son nom. */
function champ(nom: string): HTMLInputElement {
  return obligatoire<HTMLInputElement>(document, `input[name="${nom}"]`);
}

/** Le formulaire de l'ecran. */
function formulaire(): HTMLFormElement {
  return obligatoire<HTMLFormElement>(document, '.connexion-formulaire');
}

/** Le bouton d'envoi du formulaire. */
function envoi(): HTMLButtonElement {
  return obligatoire<HTMLButtonElement>(formulaire(), 'button[type="submit"]');
}

/** Les motifs visibles sous les champs. */
function fautesVisibles(): string[] {
  return [...document.querySelectorAll('.champ-erreur')]
    .filter((element) => !estCache(element))
    .map((element) => element.textContent ?? '');
}

beforeEach(() => {
  document.body.replaceChildren();
  const reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  client = creerClient({ reseau, comptes: api, horloge: creerHorlogeClientManuelle() });
  client.ouvrir();
  reseau.simulerConnexion('moi');
  client.naviguer('connexion');

  ecran = monterConnexion(contexteDEssai(client));
  document.body.append(ecran.racine);
  desabonner = client.abonner((etat) => {
    ecran.afficher(etat);
  });
  ecran.afficher(client.etat);
});

afterEach(() => {
  desabonner();
  ecran.demonter();
  client.fermer();
});

describe('l ecran de connexion', () => {
  it('se connecte avec la saisie', async () => {
    saisir(champ('pseudo'), 'Alice');
    saisir(champ('mot-de-passe'), 'correct cheval');
    soumettre(formulaire());
    await laisserRepondre();

    expect(api.appels[0]).toEqual({
      nom: 'connecter',
      argument: { pseudo: 'Alice', motDePasse: 'correct cheval' },
    });
    expect(client.etat.session.nature).toBe('compte');
  });

  it('montre toutes les fautes a la tentative d envoi, sans rien envoyer', () => {
    boutonObligatoire(document, 'Créer un compte').click();
    saisir(champ('pseudo'), 'Al<b>');
    saisir(champ('mot-de-passe'), 'court');

    // Pas de reproche pendant la saisie.
    expect(fautesVisibles()).toEqual([]);

    soumettre(formulaire());

    expect(fautesVisibles()).toHaveLength(2);
    expect(api.appels).toEqual([]);
  });

  it('affiche le refus du serveur, et l oublie quand le pseudo change', async () => {
    api.reponses.connecter = async () => ({
      acceptee: false,
      statut: 401,
      erreurs: [{ champ: 'connexion', motif: 'Pseudo ou mot de passe incorrect.' }],
    });

    saisir(champ('pseudo'), 'Alice');
    saisir(champ('mot-de-passe'), 'mauvais');
    soumettre(formulaire());
    await laisserRepondre();

    const erreur = obligatoire(document, '.connexion-erreur');

    expect(estCache(erreur)).toBe(false);
    expect(erreur.textContent).toBe('Pseudo ou mot de passe incorrect.');

    saisir(champ('pseudo'), 'Bob');

    expect(estCache(erreur)).toBe(true);
  });

  it('passe a l inscription, avec les indications du gestionnaire de mots de passe', () => {
    const onglet = boutonObligatoire(document, 'Créer un compte');
    onglet.click();

    expect(onglet.getAttribute('aria-selected')).toBe('true');
    expect(boutonObligatoire(document, 'Se connecter').getAttribute('aria-selected')).toBe('false');
    expect(champ('mot-de-passe').getAttribute('autocomplete')).toBe('new-password');
    expect(envoi().textContent).toBe('Créer le compte');
    expect(estCache(obligatoire(document, '.connexion-aide'))).toBe(false);
  });

  it('bloque l envoi pendant que la demande attend sa reponse', () => {
    api.reponses.connecter = () => new Promise(() => undefined);

    saisir(champ('pseudo'), 'Alice');
    saisir(champ('mot-de-passe'), 'correct cheval');
    soumettre(formulaire());

    expect(envoi().disabled).toBe(true);
    expect(envoi().textContent).toBe('Un instant…');
  });

  it('propose de continuer en invite', () => {
    boutonObligatoire(document, 'Continuer en invité').click();

    expect(client.etat.ecran).toBe('accueil');
  });
});
