/**
 * Tests du controle de version a l'ouverture d'une connexion (etape 5.3).
 *
 * De vrais clients Socket.IO contre un vrai serveur. Ce qu'ils protegent: un
 * serveur construit d'un commit ne parle qu'a une page construite du meme commit,
 * et dit a toute autre de se recharger; un serveur sans version, celui du
 * developpement et des tests, accepte toute page.
 */

import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';
import type { Socket } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Delai au-dela duquel on considere qu'une ouverture n'aboutira pas. */
const DELAI_ATTENTE_MS = 3000;

/** La version du serveur de ces tests. */
const VERSION = '4f48889c1d2e';

let serveur: ServeurMonte | undefined;
const clients: Socket[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await serveur?.fermer();
  serveur = undefined;
});

/** Monte un serveur, avec ou sans version, et rend son adresse. */
async function monter(version?: string): Promise<string> {
  serveur = await demarrerServeur(0, version === undefined ? {} : { version });

  const adresse = serveur.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  return `http://localhost:${String(adresse.port)}`;
}

/**
 * Ouvre une connexion avec ce qu'elle joint, et rend son issue: undefined si elle
 * est acceptee, le motif du refus sinon.
 */
async function issueDeLOuverture(
  url: string,
  authentification?: Record<string, unknown>,
): Promise<string | undefined> {
  const client = connecter(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...(authentification === undefined ? {} : { auth: authentification }),
  });
  clients.push(client);

  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("L'ouverture de la connexion n'a pas abouti."));
    }, DELAI_ATTENTE_MS);

    client.on('connect', () => {
      clearTimeout(minuterie);
      resoudre(undefined);
    });
    client.on('connect_error', (erreur) => {
      clearTimeout(minuterie);
      resoudre(erreur.message);
    });
  });
}

describe('le controle de version a l ouverture', () => {
  it('accepte la page construite du meme commit', async () => {
    const url = await monter(VERSION);

    expect(await issueDeLOuverture(url, { version: VERSION })).toBeUndefined();
    expect(serveur?.jeu.nombreDeConnexions).toBe(1);
  });

  it('refuse la page d un autre commit, en disant de recharger', async () => {
    const url = await monter(VERSION);

    expect(await issueDeLOuverture(url, { version: 'un-autre-commit' })).toBe(
      MOTIF_VERSION_DIFFERENTE,
    );
    expect(serveur?.jeu.nombreDeConnexions).toBe(0);
  });

  it('refuse une page qui ne dit pas sa version', async () => {
    const url = await monter(VERSION);

    expect(await issueDeLOuverture(url)).toBe(MOTIF_VERSION_DIFFERENTE);
    expect(await issueDeLOuverture(url, {})).toBe(MOTIF_VERSION_DIFFERENTE);
  });

  it('controle la version avant la session', async () => {
    // Ce serveur n'a pas de comptes: sans le controle de version, le jeton serait
    // refuse avec un autre motif.
    const url = await monter(VERSION);

    expect(await issueDeLOuverture(url, { jeton: 'j'.repeat(43), version: 'autre' })).toBe(
      MOTIF_VERSION_DIFFERENTE,
    );
  });

  it('laisse un serveur sans version accepter toute page', async () => {
    const url = await monter();

    expect(await issueDeLOuverture(url)).toBeUndefined();
    expect(await issueDeLOuverture(url, { version: 'n-importe-laquelle' })).toBeUndefined();
  });
});
