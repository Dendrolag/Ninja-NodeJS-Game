/**
 * Tests d'integration de la Horde, le mode d'identifiant `classique`, a travers la couche
 * reseau (etape 7.5), avec un vrai client Socket.IO: les ralliements d'un joueur lui sont
 * annonces, a lui seul, et ce qu'ils disent de sa prime est ce que le serveur a range.
 *
 * Meme cadre que ServeurSocket.massacre.test.ts: un vrai serveur sur un vrai port, une
 * horloge manuelle pour le temps du JEU, et des attentes explicites pour celui du RESEAU.
 */

import type {
  DemandeCreation,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  Position,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES } from '@neon-ninja/shared';
import { carteSansMur, rallieurDe } from '@neon-ninja/sim';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GameRoom } from './GameRoom.js';
import { classementDe } from './instantane.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

/**
 * Une Horde publique de dix minutes, sans rien qui derange un joueur qui marche: ni objet,
 * ni zone, ni Black Ninja. Trente faux ninjas, sur la petite carte.
 */
const PARTIE_HORDE: DemandeCreation['configuration'] = {
  mode: 'classique',
  visibilite: 'publique',
  reglages: {
    carte: 'map1',
    dureePartieS: 600,
    nombreBotsInitial: 30,
    bonus: {
      types: {
        vitesse: { actif: false },
        invincibilite: { actif: false },
        revelation: { actif: false },
      },
    },
    malus: { actifs: false },
    zones: { actives: false },
    botsNoirs: { actifs: false },
  },
};

let serveur: ServeurMonte;
let horloge: HorlogeManuelle;
let port: number;
const clients: ClientTypee[] = [];

beforeEach(async () => {
  horloge = creerHorlogeManuelle();
  serveur = await demarrerServeur(0, {
    horloge,
    terrains: { charger: ({ carte }) => carteSansMur(CARTES[carte]) },
  });

  const adresse = serveur.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  port = adresse.port;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await serveur.fermer();
});

/** Ouvre une connexion cliente et attend qu'elle soit etablie. */
async function connecterUnClient(): Promise<ClientTypee> {
  const client: ClientTypee = connecter(`http://localhost:${String(port)}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  clients.push(client);

  await new Promise<void>((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error('La connexion du client n a pas abouti.'));
    }, DELAI_ATTENTE_MS);

    client.on('connect', () => {
      clearTimeout(minuterie);
      resoudre();
    });
  });

  return client;
}

/** Attend le prochain message de ce nom, et rend sa charge utile. */
async function prochain<Nom extends keyof EvenementsServeurVersClient>(
  client: ClientTypee,
  nom: Nom,
): Promise<Parameters<EvenementsServeurVersClient[Nom]>[0]> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error(`Aucun message « ${String(nom)} » n est arrive.`));
    }, DELAI_ATTENTE_MS);

    client.once(
      nom,
      // Le contrat garantit l'accord entre le nom et la charge; la signature
      // generique de once ne sait pas l'exprimer.
      ((charge: Parameters<EvenementsServeurVersClient[Nom]>[0]) => {
        clearTimeout(minuterie);
        resoudre(charge);
      }) as never,
    );
  });
}

/** Collecte tous les messages de ce nom recus a partir de maintenant. */
function collecter<Nom extends keyof EvenementsServeurVersClient>(
  client: ClientTypee,
  nom: Nom,
): Parameters<EvenementsServeurVersClient[Nom]>[0][] {
  const recus: Parameters<EvenementsServeurVersClient[Nom]>[0][] = [];

  client.on(nom, ((charge: Parameters<EvenementsServeurVersClient[Nom]>[0]) => {
    recus.push(charge);
  }) as never);

  return recus;
}

/** Envoie une demande a accuse de reception, et attend la reponse. */
async function attendreAccuse<T>(emettre: (accuse: (reponse: T) => void) => void): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande."));
    }, DELAI_ATTENTE_MS);

    emettre((reponse) => {
      clearTimeout(minuterie);
      resoudre(reponse);
    });
  });
}

/** Cree une partie dont ce client devient l'hote, et rend son salon. */
async function creer(
  client: ClientTypee,
  pseudo: string,
  configuration: DemandeCreation['configuration'],
): Promise<InfosSalon> {
  return salonAccepte(
    await attendreAccuse<ResultatValidation<InfosSalon>>((accuse) => {
      client.emit('creerPartie', { pseudo, configuration }, accuse);
    }),
  );
}

/** Le salon d'une reponse acceptee, ou un echec de test explicite. */
function salonAccepte(reponse: ResultatValidation<InfosSalon>): InfosSalon {
  if (!reponse.valide) {
    throw new Error(`Demande refusee: ${reponse.erreurs.map((erreur) => erreur.motif).join(', ')}`);
  }

  return reponse.valeur;
}

/** Attend que cette condition sur le serveur soit remplie. */
async function jusquA(condition: () => boolean): Promise<void> {
  const limite = Date.now() + DELAI_ATTENTE_MS;

  while (!condition()) {
    if (Date.now() > limite) {
      throw new Error("La condition attendue n'a jamais ete remplie.");
    }

    await new Promise((resoudre) => setTimeout(resoudre, 5));
  }
}

/** La room d'un identifiant, dont on sait qu'elle existe. */
function roomDe(idRoom: string): GameRoom {
  const room = serveur.jeu.rooms.room(idRoom);
  if (room === undefined) {
    throw new Error(`La partie ${idRoom} devrait exister.`);
  }
  return room;
}

/** Lance la partie du salon de cet hote, decompte compris. */
async function lancer(hote: ClientTypee): Promise<void> {
  const lancee = prochain(hote, 'partieLancee');
  const decompte = prochain(hote, 'compteARebours');
  hote.emit('demarrer');
  await decompte;
  horloge.avancerDe(5000);
  await lancee;
}

/** La position d'un joueur de la room, dont on sait qu'il y est. */
function positionDe(room: GameRoom, id: string): Position {
  const joueur = room.etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre sur la carte.`);
  }
  return joueur.position;
}

/** Fait marcher ce joueur vers un point pendant un battement. */
function marcherVers(room: GameRoom, id: string, but: Position): void {
  const ici = positionDe(room, id);
  const ecart = Math.max(Math.hypot(but.x - ici.x, but.y - ici.y), 1);

  room.enregistrerIntention(id, {
    deplacement: { x: (but.x - ici.x) / ecart, y: (but.y - ici.y) / ecart },
    enMouvement: true,
  });
}

/** Le faux ninja le plus proche de ce joueur qui ne porte pas sa couleur. */
function ninjaARallier(room: GameRoom, id: string): Position | undefined {
  const joueur = room.etat.joueurs[id];
  if (joueur === undefined) {
    return undefined;
  }
  const distance = (position: Position): number =>
    Math.hypot(position.x - joueur.position.x, position.y - joueur.position.y);

  return Object.values(room.etat.bots)
    .filter((bot) => bot.type === 'bot' && bot.couleur !== joueur.couleur)
    .map((bot) => bot.position)
    .sort((une, autre) => distance(une) - distance(autre))[0];
}

describe('une partie Horde, a travers le reseau', () => {
  it('annonce ses ralliements au joueur, et leur prime est celle du classement', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', PARTIE_HORDE);
    const room = roomDe(salon.idRoom);
    await lancer(hote);

    const [alice] = Object.keys(room.etat.joueurs);
    if (alice === undefined) {
      throw new Error('Alice devrait etre dans la partie.');
    }
    const ralliements = collecter(hote, 'ralliement');

    for (let ecoule = 0; ecoule < 60_000; ecoule += 50) {
      const but = ninjaARallier(room, alice);
      if (but !== undefined) {
        marcherVers(room, alice, but);
      }
      horloge.avancerDe(50);
    }

    const rallies = (): number =>
      ralliements.reduce((total, ralliement) => total + ralliement.ninjas.length, 0);
    const prime = rallieurDe(room.etat, alice).prime;
    const ligne = classementDe(room.etat).find((une) => une.id === alice);

    // Seule, sans Black Ninja, Alice ne perd aucun ninja, ni aucune prime: chaque ninja
    // rallie a rapporte son multiplicateur moins un. La graine de la partie est tiree au
    // hasard par le serveur: la prime peut rester nulle, et les paliers se testent dans le
    // moteur (horde.test.ts). Ce qui se teste ici, c'est l'accord entre ce que le joueur
    // apprend, ce que le serveur range et ce que dit le classement.
    await jusquA(
      () =>
        rallies() > 0 &&
        ralliements.reduce(
          (total, ralliement) =>
            total + ralliement.ninjas.reduce((somme, ninja) => somme + ninja.multiplicateur - 1, 0),
          0,
        ) === prime,
    );
    expect(ligne?.points).toBe(
      Object.values(room.etat.bots).filter(
        (bot) => bot.couleur === room.etat.joueurs[alice]?.couleur,
      ).length + prime,
    );
  });
});
