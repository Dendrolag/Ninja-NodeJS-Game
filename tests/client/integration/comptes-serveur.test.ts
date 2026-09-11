/**
 * Test d'integration des comptes: le vrai client contre un vrai serveur.
 *
 * POURQUOI IL EXISTE. La session du client est verifiee avec des pieces d'essai
 * (packages/client/src/comptes), les routes et la connexion authentifiee du serveur
 * avec des clients nus (etape 3.2). Il faut au moins un test qui monte les deux et
 * prouve que les requetes HTTP, le jeton garde et l'ouverture du lien s'accordent
 * pour de vrai: le jeton rendu par une route est bien celui que Socket.IO accepte,
 * et un jeton refuse l'est des deux cotes.
 *
 * Le serveur a des comptes en memoire (tests/outils/comptes-en-memoire.ts): ce qui
 * se verifie ici est le dialogue, pas la base, eprouvee dans tests/base.
 */

import { createServer } from 'node:http';
import type { Server } from 'node:http';

import type { Client, CoffreDeJeton } from '@neon-ninja/client';
import {
  SERVEUR_INJOIGNABLE,
  creerApiComptesHttp,
  creerClient,
  creerCoffreDeJeton,
  creerReseauSocketIo,
} from '@neon-ninja/client';
import type { ServeurMonte } from '@neon-ninja/server';
import { creerHorlogeManuelle, demarrerServeur } from '@neon-ninja/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ComptesEnMemoire } from '../../outils/comptes-en-memoire.js';
import { creerComptesEnMemoire } from '../../outils/comptes-en-memoire.js';

/** Delai au-dela duquel on considere qu'une attente ne sera jamais satisfaite. */
const DELAI_ATTENTE_MS = 5000;

const MOT_DE_PASSE = 'correct cheval pile agrafe';

let serveur: ServeurMonte;
let comptes: ComptesEnMemoire;
let url: string;
const clients: Client[] = [];
const autresServeurs: Server[] = [];

/** L'adresse d'un serveur HTTP qui ecoute. */
function adresseDe(http: Server): string {
  const adresse = http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  return `http://localhost:${String(adresse.port)}`;
}

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

/** Monte un client relie au serveur de test, avec ses comptes et son coffre. */
function monterUnClient(
  coffre: CoffreDeJeton = creerCoffreDeJeton(),
  options: { readonly sansComptes?: boolean; readonly adresse?: string } = {},
): Client {
  const adresse = options.adresse ?? url;
  const client = creerClient({
    reseau: creerReseauSocketIo({ url: adresse }),
    coffre,
    ...(options.sansComptes === true ? {} : { comptes: creerApiComptesHttp({ url: adresse }) }),
  });
  clients.push(client);

  return client;
}

/** Monte un client, l'ouvre, et attend que le lien soit etabli. */
async function ouvrirUnClient(coffre?: CoffreDeJeton): Promise<Client> {
  const client = monterUnClient(coffre);
  client.ouvrir();
  await attendreQue(() => client.etat.connexion === 'connecte', 'le lien');

  return client;
}

/** Inscrit un compte depuis ce client, et attend que le lien soit rouvert avec sa session. */
async function inscrire(client: Client, pseudo: string): Promise<void> {
  client.sInscrire({ pseudo, motDePasse: MOT_DE_PASSE });
  await attendreQue(
    () => client.etat.session.nature === 'compte' && client.etat.connexion === 'connecte',
    'la session du compte',
  );
}

beforeEach(async () => {
  comptes = creerComptesEnMemoire();
  serveur = await demarrerServeur(0, { horloge: creerHorlogeManuelle(), comptes });
  url = adresseDe(serveur.http);
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.fermer();
  }

  for (const autre of autresServeurs.splice(0)) {
    await new Promise((resoudre) => autre.close(resoudre));
  }

  await serveur.fermer();
});

describe('les comptes, du client au serveur', () => {
  it('un joueur s inscrit, puis entre en partie sous le pseudo de son compte sans en envoyer', async () => {
    const client = await ouvrirUnClient();

    await inscrire(client, 'Alice');
    client.rejoindre(undefined);
    await attendreQue(() => client.etat.salon !== undefined, 'le salon');

    expect(client.etat.salon?.joueurs).toEqual([
      { id: client.etat.moi, pseudo: 'Alice', hote: true, compte: { niveau: 1 } },
    ]);
  });

  it('retrouve la session gardee a la visite suivante', async () => {
    const coffre = creerCoffreDeJeton();
    const premiere = await ouvrirUnClient(coffre);
    await inscrire(premiere, 'Alice');
    premiere.fermer();

    const seconde = monterUnClient(coffre);
    seconde.ouvrir();
    await attendreQue(
      () => seconde.etat.session.nature === 'compte' && seconde.etat.connexion === 'connecte',
      'la session retrouvee',
    );

    seconde.rejoindre(undefined);
    await attendreQue(() => seconde.etat.salon !== undefined, 'le salon');

    expect(seconde.etat.salon?.joueurs[0]?.pseudo).toBe('Alice');
  });

  it('oublie un jeton qui n ouvre plus rien, et entre en invite en le disant', async () => {
    const coffre = creerCoffreDeJeton();
    coffre.garder('x'.repeat(43));

    const client = await ouvrirUnClient(coffre);

    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
    expect(coffre.lire()).toBeUndefined();
  });

  it('se voit refuser le lien quand il presente un jeton inconnu, et peut continuer en invite', async () => {
    const coffre = creerCoffreDeJeton();
    coffre.garder('x'.repeat(43));
    // Sans les requetes des comptes, le client ne peut pas verifier la session:
    // c'est le serveur de jeu qui la refuse, a l'ouverture du lien.
    const client = monterUnClient(coffre, { sansComptes: true });

    client.ouvrir();
    await attendreQue(() => client.etat.connexion === 'refusee', 'le refus du lien');

    expect(client.etat.refusDeConnexion).toBe('Session invalide ou expirée. Reconnectez-vous.');

    client.continuerEnInvite();
    await attendreQue(() => client.etat.connexion === 'connecte', 'le lien en invite');

    expect(client.etat.session.nature).toBe('invite');
  });

  it('rend les motifs du serveur quand la connexion est refusee', async () => {
    const inscrit = await ouvrirUnClient();
    await inscrire(inscrit, 'Alice');

    const autre = await ouvrirUnClient();
    autre.seConnecter({ pseudo: 'Alice', motDePasse: 'pas le bon mot de passe' });
    await attendreQue(() => autre.etat.demandeDeCompte.erreurs.length > 0, 'le refus');

    expect(autre.etat.demandeDeCompte.erreurs).toEqual([
      { champ: 'connexion', motif: 'Pseudo ou mot de passe incorrect.' },
    ]);
    expect(autre.etat.session.nature).toBe('invite');
  });

  it('ferme la session cote serveur a la deconnexion, et rouvre le lien en invite', async () => {
    const coffre = creerCoffreDeJeton();
    const client = await ouvrirUnClient(coffre);
    await inscrire(client, 'Alice');
    const jeton = coffre.lire() ?? '';

    client.seDeconnecter();
    await attendreQue(
      () => client.etat.session.nature === 'invite' && client.etat.connexion === 'connecte',
      'le lien en invite',
    );
    await attendreQue(() => comptes.compteNomme('Alice') !== undefined, 'le compte');

    expect(await comptes.compteDeSession(jeton)).toBeUndefined();
  });

  it('dit que le serveur de jeu ne repond pas', async () => {
    // Un serveur HTTP qui coupe toute demande de lien, sans faire attendre.
    const muet = createServer();
    muet.on('upgrade', (_requete, socket) => {
      socket.destroy();
    });
    autresServeurs.push(muet);
    await new Promise<void>((resoudre) => muet.listen(0, resoudre));

    const client = monterUnClient(creerCoffreDeJeton(), { adresse: adresseDe(muet) });
    client.ouvrir();
    await attendreQue(() => client.etat.connexion === 'refusee', 'le refus du lien');

    expect(client.etat.refusDeConnexion).toBe(SERVEUR_INJOIGNABLE);
  });
});
