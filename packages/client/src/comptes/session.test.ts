/**
 * Tests de la session du client: invite ou compte, et le lien qui va avec.
 *
 * Ils montent un vrai client sur le banc d'essai du transport et sur des comptes
 * d'essai, et verifient l'ordre qui fait tout: savoir quelle session on a, puis
 * ouvrir le lien avec elle. Le va-et-vient avec un vrai serveur est verifie par
 * tests/client/integration/comptes-serveur.test.ts.
 */

import type { InfosSalon, MaProgression, SessionOuverte } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { ApiComptesFactice, ReponseDesComptes } from './api.js';
import { JETON_DESSAI, STATUT_INJOIGNABLE, creerApiComptesFactice } from './api.js';
import type { CoffreDeJeton } from './coffre.js';
import { creerCoffreDeJeton } from './coffre.js';

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true, compte: { niveau: 1 } }],
  reglages: REGLAGES_PAR_DEFAUT,
};

let reseau: ReseauFactice;
let api: ApiComptesFactice;
let coffre: CoffreDeJeton;
let client: Client;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Une reponse refusee des comptes. */
function refusee<T>(statut: number, motif: string): ReponseDesComptes<T> {
  return { acceptee: false, statut, erreurs: [{ champ: 'comptes', motif }] };
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

describe('au demarrage', () => {
  it('ouvre le lien en invite quand aucune session n est gardee', async () => {
    client.ouvrir();
    await laisserRepondre();

    expect(reseau.ouvertures).toEqual([{}]);
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: false });
    expect(requetes()).toEqual([]);
  });

  it('verifie la session gardee avant d ouvrir, puis ouvre avec son jeton', async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();

    // Tant que la progression n'est pas lue, le lien n'est pas ouvert.
    expect(client.etat.session.nature).toBe('verification');
    expect(reseau.ouvertures).toEqual([]);

    await laisserRepondre();

    expect(client.etat.session.nature).toBe('compte');
    expect(reseau.ouvertures).toEqual([{ jeton: JETON_DESSAI }]);
    expect(api.appels).toEqual([{ nom: 'moi', argument: JETON_DESSAI }]);
  });

  it('oublie une session expiree, ouvre en invite, et retient qu il faudra le dire', async () => {
    coffre.garder(JETON_DESSAI);
    api.reponses.moi = async () => refusee(401, 'Session absente ou expirée. Connectez-vous.');

    client.ouvrir();
    await laisserRepondre();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
    expect(reseau.ouvertures).toEqual([{}]);
  });

  it('garde la session quand les comptes ne repondent pas, et relit la progression une fois le lien etabli', async () => {
    coffre.garder(JETON_DESSAI);
    const reponseNormale = api.reponses.moi;
    api.reponses.moi = async () => refusee(STATUT_INJOIGNABLE, 'Le serveur ne répond pas.');

    client.ouvrir();
    await laisserRepondre();

    expect(reseau.ouvertures).toEqual([{ jeton: JETON_DESSAI }]);
    expect(client.etat.session.nature).toBe('verification');
    expect(coffre.lire()).toBe(JETON_DESSAI);

    api.reponses.moi = reponseNormale;
    reseau.simulerConnexion('moi');
    await laisserRepondre();

    expect(client.etat.session.nature).toBe('compte');
  });

  it('enregistre le refus du lien avec son motif, sans se rabattre en invite', async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();

    reseau.simulerRefus('Session invalide ou expirée. Reconnectez-vous.');

    expect(client.etat.connexion).toBe('refusee');
    expect(client.etat.refusDeConnexion).toBe('Session invalide ou expirée. Reconnectez-vous.');
    expect(client.etat.session.nature).toBe('compte');
    expect(reseau.ouvertures).toHaveLength(1);
  });
});

describe('apres un refus du lien', () => {
  beforeEach(async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerRefus('La session n’a pas pu être vérifiée. Réessayez.');
  });

  it('reessaie avec la session gardee', async () => {
    client.reessayer();
    await laisserRepondre();

    expect(reseau.ouvertures.at(-1)).toEqual({ jeton: JETON_DESSAI });
    expect(client.etat.connexion).toBe('horsLigne');
    expect(client.etat.refusDeConnexion).toBeUndefined();
  });

  it('continue en invite sans fermer la session cote serveur', () => {
    client.continuerEnInvite();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: false });
    expect(reseau.ouvertures.at(-1)).toEqual({});
    expect(requetes()).not.toContain('deconnecter');
  });
});

describe('se connecter et s inscrire', () => {
  beforeEach(() => {
    client.ouvrir();
    reseau.simulerConnexion('invite-1');
    client.naviguer('connexion');
  });

  it('se connecte, garde le jeton, lit la progression, et rouvre le lien avec la session', async () => {
    client.seConnecter({ pseudo: 'Alice', motDePasse: 'correct cheval' });

    expect(client.etat.demandeDeCompte).toEqual({
      enCours: true,
      nature: 'connexion',
      pseudo: 'Alice',
      erreurs: [],
    });

    await laisserRepondre();

    expect(requetes()).toEqual(['connecter', 'moi']);
    expect(coffre.lire()).toBe(JETON_DESSAI);
    expect(client.etat.session.nature).toBe('compte');
    expect(client.etat.demandeDeCompte.enCours).toBe(false);
    expect(reseau.ouvertures.at(-1)).toEqual({ jeton: JETON_DESSAI });
    // L'ecran de connexion a fait son travail.
    expect(client.etat.ecran).toBe('accueil');
  });

  it('s inscrit par la route d inscription', async () => {
    client.sInscrire({ pseudo: 'Bob', motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(requetes()).toEqual(['inscrire', 'moi']);
    expect(
      client.etat.session.nature === 'compte' ? client.etat.session.progression.pseudo : '',
    ).toBe('Bob');
  });

  it('retient le refus, sans garder de jeton ni rouvrir le lien', async () => {
    api.reponses.connecter = async () => ({
      acceptee: false,
      statut: 401,
      erreurs: [{ champ: 'connexion', motif: 'Pseudo ou mot de passe incorrect.' }],
    });

    client.seConnecter({ pseudo: 'Alice', motDePasse: 'mauvais' });
    await laisserRepondre();

    expect(client.etat.demandeDeCompte).toEqual({
      enCours: false,
      nature: 'connexion',
      pseudo: 'Alice',
      erreurs: [{ champ: 'connexion', motif: 'Pseudo ou mot de passe incorrect.' }],
    });
    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.ecran).toBe('connexion');
    expect(reseau.ouvertures).toHaveLength(1);
  });

  it('ne garde pas une session dont la progression ne se lit pas', async () => {
    api.reponses.moi = async () => refusee(500, 'Le serveur a rencontré une erreur.');

    client.seConnecter({ pseudo: 'Alice', motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session.nature).toBe('invite');
    expect(client.etat.demandeDeCompte.erreurs[0]?.motif).toBe(
      'Le serveur a rencontré une erreur.',
    );
  });

  it('ignore une seconde demande tant que la premiere attend sa reponse', async () => {
    let repondre: (reponse: ReponseDesComptes<SessionOuverte>) => void = () => undefined;
    api.reponses.connecter = () =>
      new Promise((resoudre) => {
        repondre = resoudre;
      });

    client.seConnecter({ pseudo: 'Alice', motDePasse: 'correct cheval' });
    client.seConnecter({ pseudo: 'Alice', motDePasse: 'correct cheval' });

    expect(requetes()).toEqual(['connecter']);

    repondre({
      acceptee: true,
      valeur: { jeton: JETON_DESSAI, compte: { pseudo: 'Alice', niveau: 1 } },
    });
    await laisserRepondre();

    expect(client.etat.session.nature).toBe('compte');
  });

  it('dit qu il n y a pas de comptes quand le client n en a pas', () => {
    const sansComptes = creerClient({ reseau: creerReseauFactice() });

    sansComptes.seConnecter({ pseudo: 'Alice', motDePasse: 'correct cheval' });

    expect(sansComptes.etat.demandeDeCompte.erreurs).toEqual([
      { champ: 'comptes', motif: 'Les comptes sont indisponibles.' },
    ]);
  });
});

describe('se deconnecter', () => {
  it('oublie le jeton, rouvre en invite, et ferme la session cote serveur', async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();

    client.seDeconnecter();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: false });
    expect(reseau.ouvertures.at(-1)).toEqual({});
    expect(api.appels.at(-1)).toEqual({ nom: 'deconnecter', argument: JETON_DESSAI });
  });
});

describe('pendant une partie', () => {
  const PROGRESSION: MaProgression = {
    pseudo: 'Alice',
    niveau: 1,
    xpTotale: 0,
    pieces: 0,
    pointsLigue: 0,
    inscritLe: '2026-09-11T10:00:00.000Z',
  };

  beforeEach(async () => {
    coffre.garder(JETON_DESSAI);
    api.reponses.moi = async () => ({ acceptee: true, valeur: PROGRESSION });
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion('moi');
  });

  it('un compte entre sans envoyer de pseudo', () => {
    client.rejoindre(undefined);

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({});
  });

  it('rien ne change de session, pour ne pas faire sortir le joueur de sa partie', async () => {
    client.rejoindre(undefined);
    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
    const ouvertures = reseau.ouvertures.length;

    client.seDeconnecter();
    client.continuerEnInvite();
    client.reessayer();
    client.seConnecter({ pseudo: 'Bob', motDePasse: 'correct cheval' });
    await laisserRepondre();

    expect(reseau.ouvertures).toHaveLength(ouvertures);
    expect(coffre.lire()).toBe(JETON_DESSAI);
    expect(client.etat.session.nature).toBe('compte');
    expect(requetes()).toEqual(['moi']);
  });
});
