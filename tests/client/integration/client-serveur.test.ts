/**
 * Test d'integration du client contre un vrai serveur.
 *
 * POURQUOI IL EXISTE, ET POURQUOI IL EST ICI. Les tests de packages/client
 * pilotent un banc d'essai de transport: ils verifient le cablage, pas le
 * transport. Or la definition de terminee de l'etape 4.1 demande que la connexion
 * reseau typee FONCTIONNE. Il faut donc au moins un test qui monte les deux
 * paquets ensemble et fasse voyager de vrais messages. Il ne peut vivre ni dans
 * packages/client, qui n'a pas a dependre du serveur, ni dans packages/server,
 * qui n'a pas a dependre du client: il vit donc dans tests/, comme tous les
 * essais transverses du depot.
 *
 * CE QU'IL COUVRE: le parcours reel d'un joueur, de la connexion au premier
 * instantane recu, plus le va-et-vient du chat. Ce qu'il ne couvre pas, ce sont
 * les regles du serveur, deja verifiees par ses propres tests d'integration.
 *
 * COMME AILLEURS DANS CE DEPOT, LE TEMPS EST SIMULE ET LE RESEAU NE L'EST PAS.
 * Le serveur recoit une horloge manuelle: un compte a rebours de cinq secondes
 * passe en un appel. Mais un message met un vrai aller-retour a arriver, donc
 * chaque verification passe par une attente explicite.
 */

import type { Client } from '@neon-ninja/client';
import { creerClient, creerReseauSocketIo } from '@neon-ninja/client';
import type { HorlogeManuelle, ServeurMonte } from '@neon-ninja/server';
import { creerHorlogeManuelle, demarrerServeur } from '@neon-ninja/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Delai au-dela duquel on considere qu'une attente ne sera jamais satisfaite. */
const DELAI_ATTENTE_MS = 3000;

/** Intervalle entre deux verifications d'une attente. */
const PAS_ATTENTE_MS = 10;

let serveur: ServeurMonte;
let horloge: HorlogeManuelle;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  horloge = creerHorlogeManuelle();
  serveur = await demarrerServeur(0, { horloge });

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

  await attendreQue(() => client.etat.connexion === 'connecte');

  return client;
}

/** Attend qu'une condition devienne vraie, ou echoue en le disant. */
async function attendreQue(
  condition: () => boolean,
  quoi = 'la condition attendue',
): Promise<void> {
  const limite = Date.now() + DELAI_ATTENTE_MS;

  while (!condition()) {
    if (Date.now() > limite) {
      throw new Error(`Delai depasse en attendant ${quoi}.`);
    }

    await new Promise((resoudre) => setTimeout(resoudre, PAS_ATTENTE_MS));
  }
}

describe('le client parle a un vrai serveur', () => {
  it('recoit son identifiant de session a la connexion', async () => {
    const client = await connecterUnClient();

    expect(client.etat.moi).toBeTruthy();
    expect(client.etat.ecran).toBe('accueil');
  });

  it('entre dans une partie et recoit son salon', async () => {
    const client = await connecterUnClient();

    client.rejoindre('Alice');
    await attendreQue(() => client.etat.salon !== undefined, 'le salon');

    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.salon?.joueurs.map((joueur) => joueur.pseudo)).toEqual(['Alice']);
    // Le premier arrive commande la partie.
    expect(client.etat.salon?.joueurs[0]?.hote).toBe(true);
    // Les reglages complets voyagent avec le salon, valeurs par defaut comprises.
    expect(client.etat.salon?.reglages.dureePartieS).toBeGreaterThan(0);
  });

  it('se voit refuser un pseudo deja pris, sans quitter l accueil', async () => {
    const premier = await connecterUnClient();
    premier.rejoindre('Alice');
    await attendreQue(() => premier.etat.salon !== undefined, 'le salon du premier');

    const second = await connecterUnClient();
    second.rejoindre('Alice', premier.etat.salon?.idRoom);
    await attendreQue(() => second.etat.refus !== undefined, 'le refus');

    expect(second.etat.ecran).toBe('accueil');
    expect(second.etat.refus?.action).toBe('rejoindre');
    expect(second.etat.refus?.erreurs[0]?.champ).toBe('pseudo');
  });

  it('voit arriver le second joueur dans son salon', async () => {
    const premier = await connecterUnClient();
    premier.rejoindre('Alice');
    await attendreQue(() => premier.etat.salon !== undefined, 'le salon');

    const second = await connecterUnClient();
    second.rejoindre('Bob', premier.etat.salon?.idRoom);

    await attendreQue(() => premier.etat.salon?.joueurs.length === 2, 'le second joueur');

    expect(premier.etat.journal.map((entree) => entree.nature)).toContain('joueurArrive');
    expect(second.etat.salon?.joueurs.map((joueur) => joueur.pseudo)).toEqual(['Alice', 'Bob']);
  });

  it('fait voyager un message de chat, signe par la session', async () => {
    const premier = await connecterUnClient();
    premier.rejoindre('Alice');
    await attendreQue(() => premier.etat.salon !== undefined, 'le salon');

    const second = await connecterUnClient();
    second.rejoindre('Bob', premier.etat.salon?.idRoom);
    await attendreQue(() => second.etat.salon !== undefined, 'le salon du second');

    second.parler('salut');
    await attendreQue(() => premier.etat.messages.length > 0, 'le message de chat');

    expect(premier.etat.messages[0]?.texte).toBe('salut');
    // Le pseudo est celui de la session, jamais un champ fourni par le message.
    expect(premier.etat.messages[0]?.pseudo).toBe('Bob');
    expect(premier.etat.messages[0]?.recuA).toBeGreaterThan(0);
  });

  it('traverse le compte a rebours, la partie et le flux d etat', async () => {
    const client = await connecterUnClient();
    client.rejoindre('Alice');
    await attendreQue(() => client.etat.salon !== undefined, 'le salon');

    client.demarrer();
    await attendreQue(() => client.etat.compteARebours !== undefined, 'le compte a rebours');

    expect(client.etat.compteARebours?.annulable).toBe(true);

    // Le decompte de cinq secondes passe en un appel: l'horloge du serveur est
    // manuelle, le reseau ne l'est pas.
    horloge.avancerDe(6000);
    await attendreQue(() => client.etat.ecran === 'jeu', 'le lancement de la partie');

    expect(client.etat.compteARebours).toBeUndefined();

    // La boucle bat: le flux arrive, et le client reconstruit la partie.
    horloge.avancerDe(200);
    await attendreQue(() => client.etat.partie !== undefined, 'le premier instantane');

    const partie = client.etat.partie;
    expect(partie?.tempsRestantMs).toBeGreaterThan(0);
    expect(partie?.enPause).toBe(false);
    // Les bots sont entres en jeu au lancement: il y a du monde a l'ecran.
    expect(partie?.entites.length).toBeGreaterThan(1);
    // Nous sommes parmi eux, et c'est ce que la camera suivra.
    expect(partie?.entites.some((entite) => entite.id === client.etat.moi)).toBe(true);
  });

  it('suit la pause demandee par l hote, jusque dans le flux', async () => {
    const client = await connecterUnClient();
    client.rejoindre('Alice');
    await attendreQue(() => client.etat.salon !== undefined, 'le salon');

    client.demarrer();
    await attendreQue(() => client.etat.compteARebours !== undefined, 'le compte a rebours');
    horloge.avancerDe(6000);
    await attendreQue(() => client.etat.ecran === 'jeu', 'le lancement de la partie');

    client.mettreEnPause();
    await attendreQue(() => client.etat.pausePar !== undefined, 'l annonce de pause');

    expect(client.etat.pausePar).toBe('Alice');

    horloge.avancerDe(200);
    await attendreQue(() => client.etat.partie?.enPause === true, 'le flux qui dit la pause');

    client.reprendre();
    await attendreQue(() => client.etat.pausePar === undefined, 'la reprise');
  });

  it('revient a l accueil quand le lien tombe', async () => {
    const client = await connecterUnClient();
    client.rejoindre('Alice');
    await attendreQue(() => client.etat.salon !== undefined, 'le salon');

    await serveur.fermer();
    await attendreQue(() => client.etat.connexion === 'horsLigne', 'la perte du lien');

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.salon).toBeUndefined();
    // Le pseudo saisi survit, pour reproposer la saisie.
    expect(client.etat.pseudoDemande).toBe('Alice');
  });
});
