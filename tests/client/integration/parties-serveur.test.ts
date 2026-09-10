/**
 * Test d'integration des parties de l'etape 2.4: le vrai client contre un vrai serveur.
 *
 * POURQUOI IL EXISTE. Les regles des parties sont verifiees dans packages/server,
 * avec des clients Socket.IO nus; le cablage du client l'est dans packages/client,
 * avec un banc d'essai. Il faut au moins un test qui monte les deux paquets
 * ensemble et prouve que les commandes du client (creer, rejoindre par code,
 * lister) parlent vraiment au serveur, accuses de reception compris.
 *
 * Comme dans client-serveur.test.ts, le temps est simule et le reseau ne l'est
 * pas: chaque verification passe par une attente explicite.
 */

import type { Client } from '@neon-ninja/client';
import { creerClient, creerReseauSocketIo } from '@neon-ninja/client';
import type { ServeurMonte } from '@neon-ninja/server';
import { creerHorlogeManuelle, demarrerServeur } from '@neon-ninja/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Delai au-dela duquel on considere qu'une attente ne sera jamais satisfaite. */
const DELAI_ATTENTE_MS = 3000;

/** Intervalle entre deux verifications d'une attente. */
const PAS_ATTENTE_MS = 10;

let serveur: ServeurMonte;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  serveur = await demarrerServeur(0, { horloge: creerHorlogeManuelle() });

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

/** Monte un client relie au serveur de test, et attend que le lien soit etabli. */
async function connecterUnClient(): Promise<Client> {
  const client = creerClient({ reseau: creerReseauSocketIo({ url }) });
  clients.push(client);

  await attendreQue(() => client.etat.connexion === 'connecte', 'la connexion');

  return client;
}

/** Attend qu'une condition devienne vraie, ou echoue en le disant. */
async function attendreQue(condition: () => boolean, quoi: string): Promise<void> {
  const limite = Date.now() + DELAI_ATTENTE_MS;

  while (!condition()) {
    if (Date.now() > limite) {
      throw new Error(`Delai depasse en attendant ${quoi}.`);
    }

    await new Promise((resoudre) => setTimeout(resoudre, PAS_ATTENTE_MS));
  }
}

describe('les parties, du client au serveur', () => {
  it('cree une partie privee, et un second joueur la rejoint par son code', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    hote.creerPartie('Alice', { mode: 'classique', visibilite: 'privee' });
    await attendreQue(() => hote.etat.salon !== undefined, 'le salon de la partie creee');

    const code = hote.etat.salon?.code ?? '';

    expect(hote.etat.ecran).toBe('salon');
    expect(code).not.toBe('');

    invite.rejoindre('Bob', { code });
    await attendreQue(() => invite.etat.salon !== undefined, 'le salon rejoint par code');

    expect(invite.etat.salon?.idRoom).toBe(hote.etat.salon?.idRoom);
    await attendreQue(() => hote.etat.salon?.joueurs.length === 2, 'l arrivee de Bob chez l hote');
  });

  it('liste les parties publiques, et les rejoint depuis la liste', async () => {
    const hote = await connecterUnClient();
    const passant = await connecterUnClient();

    hote.creerPartie('Alice', { mode: 'classique', visibilite: 'publique' });
    await attendreQue(() => hote.etat.salon !== undefined, 'le salon de la partie creee');

    passant.listerParties();
    await attendreQue(() => passant.etat.partiesPubliques.length === 1, 'la liste des parties');

    const partie = passant.etat.partiesPubliques[0];

    expect(partie).toMatchObject({ hote: 'Alice', joueurs: 1, mode: 'classique' });

    passant.rejoindre('Bob', { idRoom: partie?.idRoom ?? '' });
    await attendreQue(() => passant.etat.salon !== undefined, 'le salon rejoint depuis la liste');

    expect(passant.etat.salon?.idRoom).toBe(hote.etat.salon?.idRoom);
  });

  it('montre au joueur le refus d un code inconnu, sans quitter l accueil', async () => {
    const client = await connecterUnClient();

    client.rejoindre('Eve', { code: 'ZZZZZZ' });
    await attendreQue(() => client.etat.refus !== undefined, 'le refus');

    expect(client.etat.refus?.action).toBe('rejoindre');
    expect(client.etat.refus?.erreurs[0]?.champ).toBe('code');
    expect(client.etat.ecran).toBe('accueil');
  });
});
