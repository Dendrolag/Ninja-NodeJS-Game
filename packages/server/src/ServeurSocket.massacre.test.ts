/**
 * Tests d'integration du mode Massacre a travers la couche reseau (etape 7.4), avec de vrais
 * clients Socket.IO: une partie lancee seul, un coup de katana annonce avec ses morts, la
 * carte videe qui termine la partie avec son bonus, et un joueur tue a deux.
 *
 * Meme cadre que ServeurSocket.chasse.test.ts: un vrai serveur sur un vrai port, une horloge
 * manuelle pour le temps du JEU, et des attentes explicites pour celui du RESEAU. Le terrain
 * est une carte sans mur, pour qu'un joueur puisse marcher droit sur ce qu'il vise.
 */

import type {
  DemandeCreation,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  Position,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES, DUREES, MASSACRE } from '@neon-ninja/shared';
import { carteSansMur, guerrierDe } from '@neon-ninja/sim';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GameRoom } from './GameRoom.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

/**
 * Une partie Massacre publique de dix minutes, sans rien qui derange un joueur qui marche:
 * ni objet, ni zone, ni Black Ninja. Dix bots, le moins que les reglages permettent.
 */
const PARTIE_MASSACRE: DemandeCreation['configuration'] = {
  mode: 'massacre',
  visibilite: 'publique',
  reglages: {
    carte: 'map3',
    dureePartieS: 600,
    nombreBotsInitial: 10,
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

/** Fait entrer ce client dans une partie par son identifiant, et rend le salon. */
async function entrer(client: ClientTypee, pseudo: string, idRoom: string): Promise<InfosSalon> {
  return salonAccepte(
    await attendreAccuse<ResultatValidation<InfosSalon>>((accuse) => {
      client.emit('rejoindre', { pseudo, idRoom }, accuse);
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

/**
 * Fait marcher ce joueur vers un point pendant un battement, et frapper des qu'il en est assez
 * pres. La cible est l'affaire du moteur, teste a part: ici, la room recoit les memes demandes
 * qu'un client enverrait.
 */
function marcherEtFrapper(room: GameRoom, id: string, but: Position): void {
  const ici = positionDe(room, id);
  const ecart = Math.hypot(but.x - ici.x, but.y - ici.y);
  const pres = ecart <= MASSACRE.PORTEE_DU_KATANA_PX / 2;

  room.enregistrerIntention(id, {
    deplacement: {
      x: (but.x - ici.x) / Math.max(ecart, 1),
      y: (but.y - ici.y) / Math.max(ecart, 1),
    },
    enMouvement: !pres,
  });

  if (pres) {
    room.demanderUnTir(id);
  }
}

/** Le bot ordinaire le plus proche de ce joueur, ou rien si la carte est vide. */
function botLePlusProche(room: GameRoom, id: string): Position | undefined {
  const ici = positionDe(room, id);
  const distance = (position: Position): number =>
    Math.hypot(position.x - ici.x, position.y - ici.y);

  return Object.values(room.etat.bots)
    .filter((bot) => bot.type === 'bot')
    .map((bot) => bot.position)
    .sort((une, autre) => distance(une) - distance(autre))[0];
}

describe('le salon d une partie Massacre, a travers le reseau', () => {
  it('se lance seul, sans zone de chaos, meme demandee', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', {
      ...PARTIE_MASSACRE,
      reglages: { ...PARTIE_MASSACRE.reglages, zones: { types: { chaos: true } } },
    });

    expect(salon.capacite).toBe(8);
    expect(salon.reglages.zones.types.chaos).toBe(false);

    await lancer(hote);
    expect(roomDe(salon.idRoom).statut).toBe('enCours');
  });
});

describe('une partie Massacre, a travers le reseau', () => {
  it('annonce les coups et leurs morts, puis se termine quand la carte est vide', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', PARTIE_MASSACRE);
    const room = roomDe(salon.idRoom);
    await lancer(hote);

    const [alice] = Object.keys(room.etat.joueurs);
    if (alice === undefined) {
      throw new Error('Alice devrait etre dans la partie.');
    }
    const coups = collecter(hote, 'coupDeKatana');
    const carte = prochain(hote, 'carteVidee');
    const fin = prochain(hote, 'partieTerminee');

    for (let ecoule = 0; ecoule < 590_000 && room.statut === 'enCours'; ecoule += 50) {
      const but = botLePlusProche(room, alice);
      if (but !== undefined) {
        marcherEtFrapper(room, alice, but);
      }
      horloge.avancerDe(50);
    }

    expect(room.statut).toBe('terminee');
    const { bonus, tempsRestantMs } = await carte;
    expect(tempsRestantMs).toBeGreaterThan(0);
    expect(bonus).toBe(Math.floor(tempsRestantMs / 1000) * MASSACRE.POINTS_PAR_SECONDE_RESTANTE);

    // Les coups sont arrives, avec leurs morts: les dix bots, tous tues par Alice.
    await jusquA(() => coups.reduce((total, coup) => total + coup.morts.length, 0) === 10);
    expect(coups.every((coup) => coup.frappeur === alice)).toBe(true);

    const { classement } = await fin;
    const points = guerrierDe(room.etat, alice).points;
    expect(classement[0]?.points).toBe(points);
    expect(points).toBeGreaterThanOrEqual(100 + bonus);

    // Le temps joue est le temps reellement joue: la carte videe ne paie pas le reste.
    const [ligne] = room.bilan().joueurs;
    expect(ligne?.tempsJoueMs).toBe(room.etat.tempsEcouleMs);
    expect(ligne?.tempsJoueMs).toBeLessThan(room.etat.dureeMs);
  });

  it('annonce a tous un joueur tue, et le compte au tueur', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();
    const cree = await creer(hote, 'Alice', PARTIE_MASSACRE);
    await entrer(invite, 'Bob', cree.idRoom);
    const room = roomDe(cree.idRoom);
    await lancer(hote);

    const [alice, bob] = Object.keys(room.etat.joueurs);
    if (alice === undefined || bob === undefined) {
      throw new Error('Alice et Bob devraient etre dans la partie.');
    }
    const chezAlice = collecter(hote, 'joueurTranche');
    const chezBob = collecter(invite, 'joueurTranche');
    horloge.avancerDe(DUREES.PROTECTION_SPAWN_MS + 50);

    for (
      let ecoule = 0;
      ecoule < 60_000 &&
      room.etat.evenements.every((evenement) => evenement.type !== 'joueurTranche');
      ecoule += 50
    ) {
      marcherEtFrapper(room, alice, positionDe(room, bob));
      horloge.avancerDe(50);
    }

    await jusquA(() => chezAlice.length === 1 && chezBob.length === 1);
    expect(chezBob[0]).toEqual(chezAlice[0]);
    expect(chezAlice[0]).toMatchObject({
      attaquant: alice,
      attaquantPseudo: 'Alice',
      victime: bob,
      victimePseudo: 'Bob',
    });
    expect(room.etat.joueurs[alice]?.captures).toBe(1);
  });
});
