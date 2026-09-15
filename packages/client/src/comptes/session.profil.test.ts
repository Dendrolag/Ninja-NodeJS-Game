/**
 * Tests de la lecture du profil par la session du client.
 *
 * Ce qu'ils protegent: le profil se lit a l'arrivee sur son ecran et seulement pour
 * un compte, l'en-tete suit la progression qu'il porte, et une session expiree
 * decouverte a ce moment-la se traite comme au demarrage.
 */

import type { ProfilDuCompte } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { ApiComptesFactice } from './api.js';
import { JETON_DESSAI, creerApiComptesFactice, profilDEssai } from './api.js';
import type { CoffreDeJeton } from './coffre.js';
import { creerCoffreDeJeton } from './coffre.js';

let reseau: ReseauFactice;
let api: ApiComptesFactice;
let coffre: CoffreDeJeton;
let client: Client;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Les noms des requetes faites aux comptes, dans l'ordre. */
function requetes(): string[] {
  return api.appels.map((appel) => appel.nom);
}

beforeEach(() => {
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  coffre = creerCoffreDeJeton();
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
});

describe('le profil d un compte', () => {
  beforeEach(async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion('moi');
  });

  it('se lit a l arrivee sur son ecran, et l en-tete suit la progression qu il porte', async () => {
    const profil: ProfilDuCompte = {
      ...profilDEssai('Alice'),
      xpTotale: 150,
      niveau: 2,
      pieces: 15,
    };
    api.reponses.profil = async () => ({ acceptee: true, valeur: profil });

    client.naviguer('profil');

    expect(client.etat.ecran).toBe('profil');
    expect(client.etat.profil).toEqual({ statut: 'chargement' });

    await laisserRepondre();

    expect(client.etat.profil).toEqual({ statut: 'charge', profil });
    expect(requetes()).toEqual(['moi', 'profil']);
    expect(client.etat.session).toEqual({
      nature: 'compte',
      progression: {
        pseudo: 'Alice',
        niveau: 2,
        xpTotale: 150,
        pieces: 15,
        pointsLigue: 0,
        inscritLe: profil.inscritLe,
      },
    });
  });

  it('dit pourquoi il n a pas pu etre lu, et se relit sur demande', async () => {
    api.reponses.profil = async () => ({
      acceptee: false,
      statut: 500,
      erreurs: [{ champ: 'comptes', motif: 'Le serveur a rencontré une erreur.' }],
    });

    client.naviguer('profil');
    await laisserRepondre();

    expect(client.etat.profil).toEqual({
      statut: 'echec',
      motif: 'Le serveur a rencontré une erreur.',
    });

    api.reponses.profil = async () => ({ acceptee: true, valeur: profilDEssai('Alice') });
    client.chargerLeProfil();
    await laisserRepondre();

    expect(client.etat.profil.statut).toBe('charge');
  });

  it('ramene en invite, en le disant, quand la session a expire', async () => {
    api.reponses.profil = async () => ({
      acceptee: false,
      statut: 401,
      erreurs: [{ champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' }],
    });

    client.naviguer('profil');
    await laisserRepondre();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
    expect(client.etat.ecran).toBe('accueil');
    expect(reseau.ouvertures.at(-1)).toEqual({});
  });

  it('ne part pas une seconde fois pendant qu une lecture attend', () => {
    api.reponses.profil = () => new Promise(() => undefined);

    client.naviguer('profil');
    client.chargerLeProfil();

    expect(requetes()).toEqual(['moi', 'profil']);
  });

  it('se quitte en se deconnectant, vers l accueil', async () => {
    client.naviguer('profil');
    await laisserRepondre();

    client.seDeconnecter();

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.profil).toEqual({ statut: 'inconnu' });
  });
});

describe('le profil d un invite', () => {
  it('n existe pas: l invite est mene a la connexion, sans requete', () => {
    client.ouvrir();
    reseau.simulerConnexion('invite');

    client.naviguer('profil');

    expect(client.etat.ecran).toBe('connexion');
    expect(requetes()).toEqual([]);
  });
});
