/**
 * Tests des requetes des comptes, avec un envoi d'essai a la place de fetch.
 *
 * Ils verifient la TRADUCTION, dans les deux sens: ce qui part (adresse, methode,
 * corps, jeton en en-tete et jamais dans l'adresse), et ce qui revient (valeur,
 * motifs du serveur, motif lisible quand le serveur ne dit rien ou ne repond pas).
 * Le va-et-vient avec les vraies routes est verifie par
 * tests/client/integration/comptes-serveur.test.ts.
 */

import type { SessionOuverte } from '@neon-ninja/shared';
import { ROUTES_COMPTES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EnvoiHttp } from './api.js';
import {
  JETON_DESSAI,
  MOTIF_INJOIGNABLE,
  STATUT_INJOIGNABLE,
  creerApiComptesHttp,
  progressionDEssai,
} from './api.js';

const ORIGINE = 'https://jeu.exemple';

const SESSION: SessionOuverte = { jeton: JETON_DESSAI, compte: { pseudo: 'Alice', niveau: 1 } };

/** Une requete telle que l'envoi d'essai l'a recue. */
interface RequeteVue {
  readonly adresse: string;
  readonly init: RequestInit;
}

/** Un envoi d'essai qui retient ce qu'on lui demande et rend la reponse fournie. */
function envoiDEssai(reponse: () => Response): {
  readonly vues: RequeteVue[];
  readonly envoyer: EnvoiHttp;
} {
  const vues: RequeteVue[] = [];

  return {
    vues,
    envoyer: async (adresse, init) => {
      vues.push({ adresse, init });
      return reponse();
    },
  };
}

/** Une reponse JSON. */
function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Les en-tetes d'une requete vue, lisibles. */
function entetes(vue: RequeteVue | undefined): Headers {
  return new Headers(vue?.init.headers);
}

describe('les requetes qui partent', () => {
  it('envoient la connexion en JSON, a l adresse de sa route, sans cache', async () => {
    const { vues, envoyer } = envoiDEssai(() => json(200, SESSION));
    const api = creerApiComptesHttp({ url: ORIGINE, envoyer });

    const reponse = await api.connecter({ pseudo: 'Alice', motDePasse: 'correct cheval' });

    expect(reponse).toEqual({ acceptee: true, valeur: SESSION });
    expect(vues[0]?.adresse).toBe(`${ORIGINE}${ROUTES_COMPTES.connexion}`);
    expect(vues[0]?.init.method).toBe('POST');
    expect(vues[0]?.init.cache).toBe('no-store');
    expect(entetes(vues[0]).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(vues[0]?.init.body))).toEqual({
      pseudo: 'Alice',
      motDePasse: 'correct cheval',
    });
  });

  it('envoient l inscription a sa route', async () => {
    const { vues, envoyer } = envoiDEssai(() => json(201, SESSION));
    const api = creerApiComptesHttp({ url: ORIGINE, envoyer });

    expect((await api.inscrire({ pseudo: 'Alice', motDePasse: 'correct cheval' })).acceptee).toBe(
      true,
    );
    expect(vues[0]?.adresse).toBe(`${ORIGINE}${ROUTES_COMPTES.inscription}`);
  });

  it('joignent le jeton en en-tete, et jamais dans l adresse', async () => {
    const { vues, envoyer } = envoiDEssai(() => json(200, progressionDEssai('Alice')));
    const api = creerApiComptesHttp({ url: ORIGINE, envoyer });

    const reponse = await api.moi(JETON_DESSAI);

    expect(reponse).toEqual({ acceptee: true, valeur: progressionDEssai('Alice') });
    expect(vues[0]?.init.method).toBe('GET');
    expect(entetes(vues[0]).get('Authorization')).toBe(`Bearer ${JETON_DESSAI}`);
    expect(vues[0]?.adresse).not.toContain(JETON_DESSAI);
  });

  it('partent vers l origine de la page quand aucune adresse n est donnee', async () => {
    const { vues, envoyer } = envoiDEssai(() => new Response(null, { status: 204 }));
    const api = creerApiComptesHttp({ envoyer });

    expect(await api.deconnecter(JETON_DESSAI)).toEqual({ acceptee: true, valeur: undefined });
    expect(vues[0]?.adresse).toBe(ROUTES_COMPTES.deconnexion);
  });
});

describe('les reponses qui reviennent', () => {
  it('rendent les motifs du serveur quand il refuse', async () => {
    const erreurs = [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris.' }];
    const api = creerApiComptesHttp({ envoyer: envoiDEssai(() => json(409, { erreurs })).envoyer });

    expect(await api.inscrire({ pseudo: 'Alice', motDePasse: 'correct cheval' })).toEqual({
      acceptee: false,
      statut: 409,
      erreurs,
    });
  });

  it('rendent un motif lisible quand le corps du refus ne dit rien', async () => {
    const api = creerApiComptesHttp({
      envoyer: envoiDEssai(() => new Response('Service Unavailable', { status: 503 })).envoyer,
    });

    expect(await api.moi(JETON_DESSAI)).toEqual({
      acceptee: false,
      statut: 503,
      erreurs: [{ champ: 'comptes', motif: 'Les comptes sont indisponibles sur ce serveur.' }],
    });
  });

  it('ne croient pas un corps de refus mal forme', async () => {
    const api = creerApiComptesHttp({
      envoyer: envoiDEssai(() => json(400, { erreurs: [{ champ: 1 }] })).envoyer,
    });

    const reponse = await api.connecter({ pseudo: 'Alice', motDePasse: 'x' });

    expect(reponse.acceptee).toBe(false);
    expect(reponse.acceptee ? [] : reponse.erreurs.map((erreur) => erreur.champ)).toEqual([
      'comptes',
    ]);
  });

  it('rendent un motif lisible quand le serveur ne repond pas, sans lever', async () => {
    const api = creerApiComptesHttp({
      envoyer: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    expect(await api.connecter({ pseudo: 'Alice', motDePasse: 'x' })).toEqual({
      acceptee: false,
      statut: STATUT_INJOIGNABLE,
      erreurs: [{ champ: 'comptes', motif: MOTIF_INJOIGNABLE }],
    });
  });

  it('refusent une reponse acceptee dont la valeur est illisible', async () => {
    const api = creerApiComptesHttp({
      envoyer: envoiDEssai(() => new Response('pas du JSON', { status: 200 })).envoyer,
    });

    expect((await api.moi(JETON_DESSAI)).acceptee).toBe(false);
  });
});
