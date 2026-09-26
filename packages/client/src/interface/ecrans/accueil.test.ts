// @vitest-environment jsdom
/**
 * Tests de l'ecran d'accueil ouvert par un lien d'invitation (etape 2.7), dans un
 * document.
 *
 * Le reste de l'accueil est joue par les tests de l'application, qui le montent avec
 * tout le reste. Ce qu'on verifie ici: l'invitation s'annonce, le bouton principal
 * rejoint la partie par son code, « Ignorer » rend l'accueil ordinaire, et un lien
 * mal forme se dit sans rien envoyer.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { Invitation } from '../../invitation.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import {
  boutonNomme,
  boutonObligatoire,
  contexteDEssai,
  estCache,
  obligatoire,
  saisir,
} from '../essais.js';
import { monterAccueil } from './accueil.js';
import type { EcranAffiche } from './types.js';

let reseau: ReseauFactice;
let client: Client;
let ecran: EcranAffiche;
let desabonner: () => void;

/** Monte l'accueil d'une page ouverte avec cette invitation, lien etabli. */
function monter(invitation: Invitation): void {
  reseau = creerReseauFactice();
  client = creerClient({ reseau, invitation });
  reseau.simulerConnexion();

  ecran = monterAccueil(contexteDEssai(client));
  document.body.append(ecran.racine);
  ecran.afficher(client.etat);
  desabonner = client.abonner(() => {
    ecran.afficher(client.etat);
  });
}

/** Le bloc qui annonce l'invitation. */
function bloc(): HTMLElement {
  return obligatoire(document, '.accueil-invitation');
}

afterEach(() => {
  desabonner();
  ecran.demonter();
  client.fermer();
});

describe('l accueil ouvert par un lien bien forme', () => {
  beforeEach(() => {
    monter({ nature: 'code', code: 'K7XM3Q' });
  });

  it('annonce la partie privee et son code, et propose de la rejoindre', () => {
    expect(estCache(bloc())).toBe(false);
    expect(obligatoire(bloc(), '.accueil-invitation-texte').textContent).toBe(
      'Une partie privée vous attend.',
    );
    expect(obligatoire(bloc(), '.accueil-invitation-valeur').textContent).toBe('K7XM3Q');
    expect(boutonNomme(document, 'Partie rapide')).toBeUndefined();
    // Un invite doit d'abord choisir son pseudo.
    expect(boutonObligatoire(document, 'Rejoindre la partie').disabled).toBe(true);
  });

  it('rejoint la partie par son code, sous le pseudo choisi', () => {
    saisir(obligatoire<HTMLInputElement>(document, 'input[name="pseudo"]'), 'Bob');
    boutonObligatoire(document, 'Rejoindre la partie').click();

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Bob', code: 'K7XM3Q' });
  });

  it('montre le refus du serveur sous le formulaire, et laisse reessayer', () => {
    saisir(obligatoire<HTMLInputElement>(document, 'input[name="pseudo"]'), 'Bob');
    boutonObligatoire(document, 'Rejoindre la partie').click();
    reseau.dernier('rejoindre')?.[1]({
      valide: false,
      erreurs: [{ champ: 'code', motif: 'Aucune partie ne porte ce code.' }],
    });

    const erreur = obligatoire(document, '.accueil-erreur');
    expect(estCache(erreur)).toBe(false);
    expect(erreur.textContent).toBe('Aucune partie ne porte ce code.');
    expect(boutonObligatoire(document, 'Rejoindre la partie').disabled).toBe(false);
  });

  it('ignore l invitation: l accueil redevient celui de tous les jours', () => {
    boutonObligatoire(bloc(), 'Ignorer').click();

    expect(estCache(bloc())).toBe(true);
    expect(client.etat.invitation).toBeUndefined();

    saisir(obligatoire<HTMLInputElement>(document, 'input[name="pseudo"]'), 'Bob');
    boutonObligatoire(document, 'Partie rapide').click();

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Bob' });
  });
});

describe('l accueil ouvert par un lien mal forme', () => {
  beforeEach(() => {
    monter({ nature: 'malFormee', motif: "Un code d'invitation compte 6 lettres ou chiffres." });
  });

  it('dit que le lien ne vaut rien, sans code, et garde la partie rapide', () => {
    expect(estCache(bloc())).toBe(false);
    expect(bloc().dataset['invitation']).toBe('malFormee');
    expect(obligatoire(bloc(), '.accueil-invitation-titre').textContent).toBe(
      "Ce lien d'invitation n'est pas valable.",
    );
    expect(obligatoire(bloc(), '.accueil-invitation-texte').textContent).toBe(
      "Un code d'invitation compte 6 lettres ou chiffres.",
    );
    expect(estCache(obligatoire(bloc(), '.accueil-invitation-code'))).toBe(true);

    saisir(obligatoire<HTMLInputElement>(document, 'input[name="pseudo"]'), 'Bob');
    boutonObligatoire(document, 'Partie rapide').click();

    // Rien du lien ne part au serveur.
    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Bob' });
  });
});

describe('l accueil sans invitation', () => {
  it('ne montre aucun bloc d invitation', () => {
    reseau = creerReseauFactice();
    client = creerClient({ reseau });
    ecran = monterAccueil(contexteDEssai(client));
    document.body.append(ecran.racine);
    ecran.afficher(client.etat);
    desabonner = () => undefined;

    expect(estCache(bloc())).toBe(true);
    expect(boutonNomme(document, 'Partie rapide')).toBeDefined();
  });
});
