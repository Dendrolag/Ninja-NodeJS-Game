/**
 * Tests d'integration de la poche et de la fumee, a travers la couche reseau (etape 7.10),
 * avec de vrais clients Socket.IO: un joueur met une fumee en poche, s'en sert par le
 * message utiliserLaPoche, et chacun voit le nuage; le flux montre la poche a tous, puis
 * plus rien une fois la fumee utilisee.
 *
 * Meme cadre que ServeurSocket.evade.test.ts: un vrai serveur sur un vrai port, une horloge
 * manuelle pour le temps du JEU, des attentes explicites pour celui du RESEAU, et une petite
 * arene fermee, ou le joueur trouve vite la fumee qui y apparait.
 */

import type {
  DemandeCreation,
  DimensionsCarte,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  InstantanePartie,
  Mode,
  Position,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES, appliquerTrame } from '@neon-ninja/shared';
import type { CarteCollisions } from '@neon-ninja/sim';
import { creerCarteCollisions } from '@neon-ninja/sim';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GameRoom } from './GameRoom.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Le rectangle praticable, au milieu de la carte: tout le reste est mur. */
const ARENE = { gauche: 820, haut: 620, largeur: 360, hauteur: 260 } as const;

/** Une carte muree, sauf l'arene. */
function arene(dimensions: DimensionsCarte): CarteCollisions {
  return creerCarteCollisions(
    dimensions,
    (x, y) =>
      x < ARENE.gauche ||
      x >= ARENE.gauche + ARENE.largeur ||
      y < ARENE.haut ||
      y >= ARENE.haut + ARENE.hauteur,
  );
}

/**
 * Une partie de deux minutes ou seule la fumee apparait, a chaque tentative: ni autre
 * objet, ni zone, ni Black Ninja, ni Evade.
 */
function partie(mode: Mode = 'classique'): DemandeCreation['configuration'] {
  return {
    mode,
    visibilite: 'publique',
    reglages: {
      carte: 'map1',
      dureePartieS: 120,
      nombreBotsInitial: 10,
      evade: false,
      bonus: {
        intervalleApparitionS: 2,
        types: {
          vitesse: { actif: false },
          invincibilite: { actif: false },
          revelation: { actif: false },
        },
      },
      malus: { actifs: false },
      zones: { actives: false },
      botsNoirs: { actifs: false },
      objetsDePoche: { fumee: { actif: true, tauxApparitionPourCent: 100 } },
    },
  };
}

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

let serveur: ServeurMonte;
let horloge: HorlogeManuelle;
let port: number;
const clients: ClientTypee[] = [];

beforeEach(async () => {
  horloge = creerHorlogeManuelle();
  serveur = await demarrerServeur(0, {
    horloge,
    terrains: { charger: ({ carte }) => arene(CARTES[carte]) },
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

/** Le salon d'une reponse acceptee, ou un echec de test explicite. */
function salonAccepte(reponse: ResultatValidation<InfosSalon>): InfosSalon {
  if (!reponse.valide) {
    throw new Error(`Demande refusee: ${reponse.erreurs.map((erreur) => erreur.motif).join(', ')}`);
  }

  return reponse.valeur;
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

/** Fait entrer ce client dans le salon d'une partie. */
async function entrer(client: ClientTypee, pseudo: string, idRoom: string): Promise<void> {
  salonAccepte(
    await attendreAccuse<ResultatValidation<InfosSalon>>((accuse) => {
      client.emit('rejoindre', { pseudo, idRoom }, accuse);
    }),
  );
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

/** Suit le flux d'etat d'un client, reconstruit trame apres trame. */
function suivreLeFlux(client: ClientTypee): { partie: InstantanePartie | undefined } {
  const suivi: { partie: InstantanePartie | undefined } = { partie: undefined };

  client.on('etat', (trame) => {
    suivi.partie = appliquerTrame(suivi.partie, new Uint8Array(trame as ArrayBuffer));
  });

  return suivi;
}

/** Fait marcher ce joueur vers la fumee la plus proche, jusqu'a ce qu'il l'ait en poche. */
function allerChercherLaFumee(room: GameRoom, id: string): void {
  for (
    let ecoule = 0;
    ecoule < 30_000 && room.etat.joueurs[id]?.poche === undefined;
    ecoule += 50
  ) {
    const ici = room.etat.joueurs[id]?.position;
    const fumees = Object.values(room.etat.objets).filter((objet) => objet.nature === 'fumee');

    if (ici !== undefined && fumees.length > 0) {
      const but = fumees
        .map((objet) => objet.position)
        .reduce((meilleure: Position, autre: Position) =>
          Math.hypot(autre.x - ici.x, autre.y - ici.y) <
          Math.hypot(meilleure.x - ici.x, meilleure.y - ici.y)
            ? autre
            : meilleure,
        );
      const ecart = Math.max(Math.hypot(but.x - ici.x, but.y - ici.y), 1);
      room.enregistrerIntention(id, {
        deplacement: { x: (but.x - ici.x) / ecart, y: (but.y - ici.y) / ecart },
        enMouvement: true,
      });
    }

    horloge.avancerDe(50);
  }

  room.enregistrerIntention(id, { deplacement: { x: 0, y: 0 }, enMouvement: false });
}

describe('la poche et la fumee, a travers le reseau', () => {
  it('met la fumee en poche, la montre a tous, puis fait fuir le joueur dans un nuage vu de tous', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();
    const salon = await creer(hote, 'Alice', partie());
    await entrer(invite, 'Bob', salon.idRoom);
    const room = roomDe(salon.idRoom);

    expect(salon.reglages.objetsDePoche.fumee.actif).toBe(true);

    const flux = suivreLeFlux(invite);
    const empoche = prochain(hote, 'objetEmpoche');
    await lancer(hote);

    const alice = hote.id as string;
    allerChercherLaFumee(room, alice);

    expect(room.etat.joueurs[alice]?.poche).toBe('fumee');
    expect(await empoche).toEqual({ nature: 'fumee' });

    // Bob voit la fumee dans la poche d'Alice.
    await jusquA(() => flux.partie?.tick === room.etat.tick);
    expect(flux.partie?.entites.find((entite) => entite.id === alice)).toMatchObject({
      poche: 'fumee',
    });

    const depart = room.etat.joueurs[alice]?.position;
    const chezLHote = prochain(hote, 'fumee');
    const chezLInvite = prochain(invite, 'fumee');
    hote.emit('utiliserLaPoche');
    // La demande n'a pas d'accuse: on attend qu'elle ait atteint la room, en avancant le jeu.
    await jusquA(() => {
      horloge.avancerDe(50);
      return room.etat.joueurs[alice]?.poche === undefined;
    });

    const nuage = await chezLInvite;
    expect(await chezLHote).toEqual(nuage);
    expect(nuage.joueur).toBe(alice);
    expect(nuage.depart).toEqual({ x: depart?.x, y: depart?.y });
    expect(room.etat.joueurs[alice]?.position).toEqual(nuage.arrivee);

    await jusquA(() => flux.partie?.tick === room.etat.tick);
    expect(flux.partie?.entites.find((entite) => entite.id === alice)).not.toHaveProperty('poche');
  });

  it('ignore une demande sur une poche vide, sans rien envoyer', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', {
      ...partie(),
      reglages: { ...partie().reglages, objetsDePoche: { fumee: { actif: false } } },
    });
    const room = roomDe(salon.idRoom);
    await lancer(hote);

    const alice = hote.id as string;
    const depart = room.etat.joueurs[alice]?.position;
    const recus: unknown[] = [];
    hote.on('fumee', (fumee) => {
      recus.push(fumee);
    });

    hote.emit('utiliserLaPoche');
    for (let battement = 0; battement < 10; battement += 1) {
      await new Promise((resoudre) => setTimeout(resoudre, 5));
      horloge.avancerDe(50);
    }

    expect(room.etat.joueurs[alice]?.position).toEqual(depart);
    expect(recus).toEqual([]);
  });
});
