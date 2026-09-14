/**
 * Test d'integration du controle de version: le vrai client contre un vrai serveur
 * (etape 5.3).
 *
 * POURQUOI IL EXISTE. Le serveur refuse une page d'une autre version, et le modele
 * de l'accueil sait quoi proposer devant ce refus. Il faut au moins un test qui
 * prouve que la version jointe par le transport est bien celle que le serveur lit,
 * et que le motif du refus arrive au client tel que l'accueil le reconnait.
 */

import type { Client } from '@neon-ninja/client';
import { creerClient, creerReseauSocketIo } from '@neon-ninja/client';
import type { ServeurMonte } from '@neon-ninja/server';
import { creerHorlogeManuelle, demarrerServeur } from '@neon-ninja/server';
import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Delai au-dela duquel on considere qu'une attente ne sera jamais satisfaite. */
const DELAI_ATTENTE_MS = 5000;

/** La version du serveur de ce test. */
const VERSION = '4f48889c1d2e';

let serveur: ServeurMonte;
let url: string;
const clients: Client[] = [];

/** Attend qu'une condition devienne vraie, ou echoue en le disant. */
async function attendreQue(condition: () => boolean, quoi: string): Promise<void> {
  const limite = Date.now() + DELAI_ATTENTE_MS;

  while (!condition()) {
    if (Date.now() > limite) {
      throw new Error(`Delai depasse en attendant ${quoi}.`);
    }

    await new Promise((resoudre) => setTimeout(resoudre, 10));
  }
}

/** Monte un client de cette version, et l'ouvre. */
function ouvrirUnClient(version?: string): Client {
  const client = creerClient({
    reseau: creerReseauSocketIo({ url, ...(version === undefined ? {} : { version }) }),
  });
  clients.push(client);
  client.ouvrir();

  return client;
}

beforeEach(async () => {
  serveur = await demarrerServeur(0, { horloge: creerHorlogeManuelle(), version: VERSION });

  const adresse = serveur.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  url = `http://localhost:${String(adresse.port)}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.fermer();
  }

  await serveur.fermer();
});

describe('la version, du client au serveur', () => {
  it('ouvre le lien d une page de la version du serveur', async () => {
    const client = ouvrirUnClient(VERSION);

    await attendreQue(() => client.etat.connexion === 'connecte', 'le lien');
  });

  it('refuse le lien d une page d une autre version, avec le motif que l accueil reconnait', async () => {
    const client = ouvrirUnClient('un-autre-commit');

    await attendreQue(() => client.etat.connexion === 'refusee', 'le refus du lien');

    expect(client.etat.refusDeConnexion).toBe(MOTIF_VERSION_DIFFERENTE);
  });

  it('refuse le lien d une page de developpement, qui ne dit pas sa version', async () => {
    const client = ouvrirUnClient();

    await attendreQue(() => client.etat.connexion === 'refusee', 'le refus du lien');

    expect(client.etat.refusDeConnexion).toBe(MOTIF_VERSION_DIFFERENTE);
  });
});
