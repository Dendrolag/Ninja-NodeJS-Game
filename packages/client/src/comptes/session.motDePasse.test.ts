/**
 * Tests de la gestion du mot de passe par la session du client (etape 3.4).
 *
 * Ils montent un vrai client sur le banc d'essai du transport et des comptes
 * d'essai, et verifient: le code de secours qui se montre a chaque emission et
 * s'oublie une fois note; la reinitialisation qui ouvre la session obtenue; les
 * demandes du profil, qui gardent la session, sauf quand le serveur ne la reconnait
 * plus.
 */

import type { ErreurValidation } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { ETAT_INITIAL } from '../etat.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import { reduire } from '../reduction.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { ApiComptesFactice, ReponseDesComptes } from './api.js';
import { CODE_DESSAI, JETON_DESSAI, STATUT_INJOIGNABLE, creerApiComptesFactice } from './api.js';
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

/** Une reponse refusee des comptes, avec ce motif. */
function refusee<T>(statut: number, erreur: ErreurValidation): ReponseDesComptes<T> {
  return { acceptee: false, statut, erreurs: [erreur] };
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

/** Demarre en invite, lien etabli. */
async function demarrerEnInvite(): Promise<void> {
  client.ouvrir();
  await laisserRepondre();
  reseau.simulerConnexion();
}

/** Demarre avec la session d'Alice, lien etabli. */
async function demarrerAvecUnCompte(): Promise<void> {
  coffre.garder(JETON_DESSAI);
  client.ouvrir();
  await laisserRepondre();
  reseau.simulerConnexion();
  await laisserRepondre();
}

describe('le code de secours', () => {
  it('se montre apres une inscription, et s oublie une fois note', async () => {
    await demarrerEnInvite();

    client.sInscrire({ pseudo: 'Alice', motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(client.etat.session.nature).toBe('compte');
    expect(client.etat.codeDeSecours).toBe(CODE_DESSAI);

    client.noterLeCodeDeSecours();

    expect(client.etat.codeDeSecours).toBeUndefined();
  });

  it('se montre meme si la progression ne peut pas etre lue apres l inscription', async () => {
    await demarrerEnInvite();
    api.reponses.moi = async () =>
      refusee(STATUT_INJOIGNABLE, { champ: 'comptes', motif: 'Le serveur ne répond pas.' });

    client.sInscrire({ pseudo: 'Alice', motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(client.etat.session.nature).toBe('invite');
    expect(client.etat.codeDeSecours).toBe(CODE_DESSAI);
  });

  it('n est pas montre apres une simple connexion', async () => {
    await demarrerEnInvite();

    client.seConnecter({ pseudo: 'Alice', motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(client.etat.session.nature).toBe('compte');
    expect(client.etat.codeDeSecours).toBeUndefined();
  });

  it('survit a la perte du lien, a un retour refuse et a une sortie, tant qu il n est pas note', () => {
    const avecCode = { ...ETAT_INITIAL, codeDeSecours: CODE_DESSAI };

    expect(reduire(avecCode, { type: 'connexionPerdue' }).codeDeSecours).toBe(CODE_DESSAI);
    expect(reduire(avecCode, { type: 'retourRefuse', motif: 'x' }).codeDeSecours).toBe(CODE_DESSAI);
    expect(reduire(avecCode, { type: 'sortie' }).codeDeSecours).toBe(CODE_DESSAI);
  });
});

describe('la reinitialisation', () => {
  const DEMANDE = {
    pseudo: 'Alice',
    codeDeSecours: 'K7QM3X9DTP4W8HNE',
    nouveauMotDePasse: 'nouveau secret',
  };

  it('ouvre la session obtenue, garde son jeton, montre le nouveau code et rouvre le lien', async () => {
    await demarrerEnInvite();
    client.naviguer('connexion');

    client.reinitialiserMotDePasse(DEMANDE);

    expect(client.etat.demandeDeCompte).toMatchObject({
      enCours: true,
      nature: 'reinitialisation',
      pseudo: 'Alice',
    });

    await laisserRepondre();

    // La session ouverte lit aussi ses amis (etape 3.6).
    expect(requetes()).toEqual(['reinitialiser', 'moi', 'amis']);
    expect(api.appels[0]?.argument).toEqual(DEMANDE);
    expect(coffre.lire()).toBe(JETON_DESSAI);
    expect(client.etat.session.nature).toBe('compte');
    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.codeDeSecours).toBe(CODE_DESSAI);
    expect(reseau.ouvertures.at(-1)).toEqual({ jeton: JETON_DESSAI });
  });

  it('garde le refus du serveur sous la demande, sans session ni code', async () => {
    await demarrerEnInvite();
    const motif = { champ: 'reinitialisation', motif: 'Pseudo ou code de secours incorrect.' };
    api.reponses.reinitialiser = async () => refusee(401, motif);

    client.reinitialiserMotDePasse(DEMANDE);
    await laisserRepondre();

    expect(client.etat.demandeDeCompte).toEqual({
      enCours: false,
      nature: 'reinitialisation',
      pseudo: 'Alice',
      erreurs: [motif],
      acceptee: false,
    });
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: false });
    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.codeDeSecours).toBeUndefined();
  });
});

describe('les demandes du profil', () => {
  const CHANGEMENT = { motDePasse: 'correct cheval', nouveauMotDePasse: 'nouveau secret' };

  it('change le mot de passe avec le jeton de la session, montre le code, et garde la session', async () => {
    await demarrerAvecUnCompte();
    const ouvertures = reseau.ouvertures.length;

    client.changerMotDePasse(CHANGEMENT);

    expect(client.etat.demandeDeCompte).toMatchObject({ enCours: true, nature: 'motDePasse' });

    await laisserRepondre();

    expect(api.appels.at(-1)).toEqual({
      nom: 'changerMotDePasse',
      argument: { jeton: JETON_DESSAI, demande: CHANGEMENT },
    });
    expect(client.etat.demandeDeCompte).toEqual({
      enCours: false,
      nature: 'motDePasse',
      pseudo: undefined,
      erreurs: [],
      acceptee: true,
    });
    expect(client.etat.codeDeSecours).toBe(CODE_DESSAI);
    expect(client.etat.session.nature).toBe('compte');
    expect(coffre.lire()).toBe(JETON_DESSAI);
    expect(reseau.ouvertures).toHaveLength(ouvertures);
  });

  it('demande un nouveau code avec le jeton de la session', async () => {
    await demarrerAvecUnCompte();

    client.demanderUnCodeDeSecours({ motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(api.appels.at(-1)).toEqual({
      nom: 'nouveauCodeDeSecours',
      argument: { jeton: JETON_DESSAI, demande: { motDePasse: 'correct cheval' } },
    });
    expect(client.etat.demandeDeCompte).toMatchObject({ nature: 'codeDeSecours', acceptee: true });
    expect(client.etat.codeDeSecours).toBe(CODE_DESSAI);
  });

  it('garde la session sur un mot de passe faux, et montre le refus', async () => {
    await demarrerAvecUnCompte();
    const motif = { champ: 'motDePasse', motif: 'Mot de passe incorrect.' };
    api.reponses.changerMotDePasse = async () => refusee(403, motif);

    client.changerMotDePasse(CHANGEMENT);
    await laisserRepondre();

    expect(client.etat.session.nature).toBe('compte');
    expect(coffre.lire()).toBe(JETON_DESSAI);
    expect(client.etat.demandeDeCompte).toMatchObject({ erreurs: [motif], acceptee: false });
    expect(client.etat.codeDeSecours).toBeUndefined();
  });

  it('oublie une session que le serveur ne reconnait plus, et rouvre en invite', async () => {
    await demarrerAvecUnCompte();
    api.reponses.nouveauCodeDeSecours = async () =>
      refusee(401, { champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' });

    client.demanderUnCodeDeSecours({ motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
    expect(reseau.ouvertures.at(-1)).toEqual({});
  });

  it('ne fait rien pour un invite, ni pendant qu une autre demande attend', async () => {
    await demarrerEnInvite();

    client.changerMotDePasse(CHANGEMENT);

    expect(requetes()).toEqual([]);

    client.fermer();
    reseau = creerReseauFactice();
    client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
    await demarrerAvecUnCompte();
    api.reponses.changerMotDePasse = () => new Promise(() => undefined);

    client.changerMotDePasse(CHANGEMENT);
    client.demanderUnCodeDeSecours({ motDePasse: 'correct cheval' });

    expect(requetes().filter((nom) => nom !== 'moi' && nom !== 'amis')).toEqual([
      'changerMotDePasse',
    ]);
  });
});
