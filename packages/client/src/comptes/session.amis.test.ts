/**
 * Tests des amis dans la session du client (etape 3.6).
 *
 * Ce qu'ils protegent: la liste se lit a l'ouverture d'une session de compte, a chaque
 * navigation et au retour d'une partie, jamais pour un invite ni deux fois a la fois;
 * un geste part avec le jeton, ne repart pas pendant qu'un autre attend, et son
 * resultat arrive dans l'etat; la fiche d'un joueur devenu ami se relit pour montrer
 * les parties jouees ensemble; une session que le serveur ne reconnait plus se traite
 * comme a la lecture du profil.
 */

import type { InfosSalon, ListeDAmis } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { ApiComptesFactice } from './api.js';
import { JETON_DESSAI, LISTE_D_AMIS_VIDE, creerApiComptesFactice, ficheDEssai } from './api.js';
import type { CoffreDeJeton } from './coffre.js';
import { creerCoffreDeJeton } from './coffre.js';

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [
    { id: 'moi', pseudo: 'Alice', hote: true, compte: { niveau: 1 } },
    { id: 'bob', pseudo: 'Bob', hote: false, compte: { niveau: 3 } },
  ],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Une liste ou Bob attend une reponse. */
const BOB_DEMANDE: ListeDAmis = { ...LISTE_D_AMIS_VIDE, recues: [{ pseudo: 'Bob', niveau: 3 }] };

/** Une liste ou Bob est un ami. */
const BOB_AMI: ListeDAmis = { ...LISTE_D_AMIS_VIDE, amis: [{ pseudo: 'Bob', niveau: 3 }] };

/** Le refus d'une session que le serveur ne reconnait plus. */
const SESSION_EXPIREE = {
  acceptee: false as const,
  statut: 401,
  erreurs: [{ champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' }],
};

let reseau: ReseauFactice;
let api: ApiComptesFactice;
let coffre: CoffreDeJeton;
let client: Client;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Les requetes de ce nom faites aux comptes, avec leur argument. */
function appels(nom: string): unknown[] {
  return api.appels.filter((appel) => appel.nom === nom).map((appel) => appel.argument);
}

/** Entre dans le salon, sous le compte. */
function entrerAuSalon(): void {
  reseau.recevoir('placeAttribuee', { joueur: 'moi', jetonDeRetour: 'M'.repeat(43) });
  client.rejoindre(undefined);
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
}

beforeEach(() => {
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  coffre = creerCoffreDeJeton();
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
});

describe('les amis d un compte', () => {
  beforeEach(async () => {
    api.reponses.amis = async () => ({ acceptee: true, valeur: BOB_DEMANDE });
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion();
  });

  it('se lisent a l ouverture de la session, avec son jeton', () => {
    expect(appels('amis')).toEqual([JETON_DESSAI]);
    expect(client.etat.amis.liste).toEqual(BOB_DEMANDE);
    expect(client.etat.amis.lecture).toBeUndefined();
  });

  it('se relisent a chaque navigation, et au retour d une partie', async () => {
    client.naviguer('parties');
    await laisserRepondre();
    client.naviguer('amis');
    await laisserRepondre();
    entrerAuSalon();
    client.quitter();
    await laisserRepondre();

    expect(appels('amis')).toHaveLength(4);
    expect(client.etat.ecran).toBe('accueil');
  });

  it('ne se relisent pas pendant qu une lecture attend', () => {
    api.reponses.amis = () => new Promise(() => undefined);

    client.chargerLesAmis();
    client.chargerLesAmis();

    expect(appels('amis')).toHaveLength(2);
    expect(client.etat.amis.lecture).toBeDefined();
    // La liste deja lue reste affichee pendant ce temps.
    expect(client.etat.amis.liste).toEqual(BOB_DEMANDE);
  });

  it('ne remplacent pas la liste rendue par un geste fait pendant leur lecture', async () => {
    let repondre: (() => void) | undefined;
    api.reponses.amis = () =>
      new Promise((resoudre) => {
        repondre = () => {
          resoudre({ acceptee: true, valeur: BOB_DEMANDE });
        };
      });
    api.reponses.gesteDAmitie = async () => ({
      acceptee: true,
      valeur: { pseudo: 'Bob', relation: 'ami', amis: BOB_AMI },
    });

    client.chargerLesAmis();
    client.faireUnGeste('accepter', 'Bob');
    await laisserRepondre();
    repondre?.();
    await laisserRepondre();

    expect(client.etat.amis.liste).toEqual(BOB_AMI);
    // Une lecture neuve peut repartir.
    client.chargerLesAmis();
    expect(appels('amis')).toHaveLength(3);
  });

  it('disent pourquoi la lecture a echoue', async () => {
    api.reponses.amis = async () => ({
      acceptee: false,
      statut: 0,
      erreurs: [{ champ: 'comptes', motif: 'Le serveur ne répond pas.' }],
    });

    client.chargerLesAmis();
    await laisserRepondre();

    expect(client.etat.amis.motifDEchec).toBe('Le serveur ne répond pas.');
    expect(client.etat.amis.liste).toEqual(BOB_DEMANDE);
  });

  it('ramenent en invite, hors partie, pour une session expiree', async () => {
    api.reponses.amis = async () => SESSION_EXPIREE;

    client.naviguer('amis');
    await laisserRepondre();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.amis.liste).toBeUndefined();
  });
});

describe('un geste d amitie', () => {
  beforeEach(async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion();
  });

  it('part avec le jeton, et son resultat arrive dans l etat avec la liste a jour', async () => {
    api.reponses.gesteDAmitie = async () => ({
      acceptee: true,
      valeur: { pseudo: 'Bob', relation: 'ami', amis: BOB_AMI },
    });

    client.faireUnGeste('accepter', 'Bob');

    expect(client.etat.amis.geste).toEqual({ statut: 'enCours', geste: 'accepter', pseudo: 'Bob' });

    await laisserRepondre();

    expect(appels('gesteDAmitie')).toEqual([
      { jeton: JETON_DESSAI, demande: { geste: 'accepter', pseudo: 'Bob' } },
    ]);
    expect(client.etat.amis.geste).toEqual({
      statut: 'fait',
      geste: 'accepter',
      pseudo: 'Bob',
      relation: 'ami',
    });
    expect(client.etat.amis.liste).toEqual(BOB_AMI);
  });

  it('ne repart pas pendant qu un autre attend sa reponse', () => {
    api.reponses.gesteDAmitie = () => new Promise(() => undefined);

    client.faireUnGeste('demander', 'Bob');
    client.faireUnGeste('bloquer', 'Carole');

    expect(appels('gesteDAmitie')).toHaveLength(1);
  });

  it('dit le motif du serveur quand il est refuse', async () => {
    api.reponses.gesteDAmitie = async () => ({
      acceptee: false,
      statut: 409,
      erreurs: [{ champ: 'geste', motif: 'Vous avez bloqué ce compte. Débloquez-le d’abord.' }],
    });

    client.faireUnGeste('demander', 'Bob');
    await laisserRepondre();

    expect(client.etat.amis.geste).toEqual({
      statut: 'refuse',
      geste: 'demander',
      pseudo: 'Bob',
      motif: 'Vous avez bloqué ce compte. Débloquez-le d’abord.',
    });
  });

  it('relit la fiche ouverte d un joueur devenu ami, sans repasser par la lecture', async () => {
    client.ouvrirLaFiche('bob');
    await laisserRepondre();
    api.reponses.joueur = async () => ({
      acceptee: true,
      valeur: {
        ...ficheDEssai('Bob'),
        relation: 'ami',
        ensemble: { partiesEnsemble: 2, devant: 1, derriere: 1 },
      },
    });
    api.reponses.gesteDAmitie = async () => ({
      acceptee: true,
      valeur: { pseudo: 'Bob', relation: 'ami', amis: BOB_AMI },
    });

    client.faireUnGeste('accepter', 'Bob');
    await laisserRepondre();
    // La relation suit aussitot, sans que la fiche repasse en lecture.
    expect(client.etat.fiche.statut).toBe('chargee');
    await laisserRepondre();

    expect(appels('joueur')).toEqual([
      { jeton: JETON_DESSAI, pseudo: 'bob' },
      { jeton: JETON_DESSAI, pseudo: 'bob' },
    ]);
    expect(client.etat.fiche).toMatchObject({
      statut: 'chargee',
      fiche: { relation: 'ami', ensemble: { partiesEnsemble: 2 } },
    });
  });

  it('ne relit pas la fiche pour un geste qui ne fait pas d ami', async () => {
    client.ouvrirLaFiche('Bob');
    await laisserRepondre();

    client.faireUnGeste('demander', 'Bob');
    await laisserRepondre();
    await laisserRepondre();

    expect(appels('joueur')).toHaveLength(1);
    expect(client.etat.fiche).toMatchObject({ fiche: { relation: 'demandeEnvoyee' } });
  });

  it('se fait depuis le salon, et une session expiree ne fait pas quitter la partie', async () => {
    entrerAuSalon();
    api.reponses.gesteDAmitie = async () => SESSION_EXPIREE;

    client.faireUnGeste('demander', 'Bob');
    await laisserRepondre();

    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.amis.geste).toMatchObject({ statut: 'refuse' });
    expect(coffre.lire()).toBe(JETON_DESSAI);
  });

  it('ramene en invite, hors partie, pour une session expiree', async () => {
    api.reponses.gesteDAmitie = async () => SESSION_EXPIREE;

    client.faireUnGeste('demander', 'Bob');
    await laisserRepondre();

    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
  });

  it('ignore une reponse arrivee apres un changement de session', async () => {
    let repondre: (() => void) | undefined;
    api.reponses.gesteDAmitie = () =>
      new Promise((resoudre) => {
        repondre = () => {
          resoudre({ acceptee: true, valeur: { pseudo: 'Bob', relation: 'ami', amis: BOB_AMI } });
        };
      });

    client.faireUnGeste('accepter', 'Bob');
    client.seDeconnecter();
    repondre?.();
    await laisserRepondre();

    expect(client.etat.session.nature).toBe('invite');
    expect(client.etat.amis.liste).toBeUndefined();
  });
});

describe('les amis d un invite', () => {
  beforeEach(() => {
    client.ouvrir();
    reseau.simulerConnexion();
  });

  it('ne se lisent pas, et aucun geste ne part', () => {
    client.chargerLesAmis();
    client.naviguer('parties');
    client.faireUnGeste('demander', 'Bob');

    expect(appels('amis')).toEqual([]);
    expect(appels('gesteDAmitie')).toEqual([]);
    expect(client.etat.amis.geste).toEqual({ statut: 'aucun' });
  });

  it('menent a la connexion', () => {
    client.naviguer('amis');

    expect(client.etat.ecran).toBe('connexion');
  });
});
