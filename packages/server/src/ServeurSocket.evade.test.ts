/**
 * Tests d'integration de l'Evade, a travers la couche reseau (etape 7.9), avec de vrais
 * clients Socket.IO: il apparait a son heure et chacun en est prevenu, il se fait attraper au
 * contact en Horde, d'un tir en Tactique, d'un coup de katana en Massacre, et le classement
 * final dit qui porte le x2, deja compte double. La Chasse ne l'a pas.
 *
 * Meme cadre que ServeurSocket.horde.test.ts: un vrai serveur sur un vrai port, une horloge
 * manuelle pour le temps du JEU, et des attentes explicites pour celui du RESEAU.
 *
 * UNE PETITE ARENE FERMEE. Sur une carte ouverte, un joueur sans bonus ne rattrape pas
 * l'Evade, plus rapide que lui: c'est la regle (decision du porteur du projet du 25
 * septembre 2026, apres mesure). Ces tests eprouvent le chemin du reseau, pas la difficulte
 * de la poursuite: ils jouent dans un rectangle de 360 sur 260 pixels, ou il se coince vite.
 */

import type {
  DemandeCreation,
  DimensionsCarte,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  Mode,
  Position,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES } from '@neon-ninja/shared';
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

/** Une carte murée, sauf l'arene. */
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
 * Une partie de deux minutes ou rien ne derange: ni objet, ni zone, ni Black Ninja, et le
 * moins de faux ninjas possible. L'Evade apparait entre 30 et 90 secondes.
 */
function partie(mode: Mode): DemandeCreation['configuration'] {
  return {
    mode,
    visibilite: 'publique',
    reglages: {
      carte: 'map1',
      dureePartieS: 120,
      nombreBotsInitial: 10,
      evade: true,
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

/**
 * Ou viser pour lui couper la route: devant lui, sur son cap. Foncer droit sur lui ne suffit
 * pas, meme dans l'arene: plus rapide, il en fait le tour le long des murs.
 */
function evadeDe(room: GameRoom): Position | undefined {
  const evade = room.etat.evade?.surLaCarte;

  return evade === undefined
    ? undefined
    : { x: evade.position.x + evade.cap.x * 120, y: evade.position.y + evade.cap.y * 120 };
}

/**
 * Joue la partie en poursuivant l'Evade des qu'il est la, et en le visant de pres avec
 * l'arme du mode, jusqu'a ce que quelqu'un le porte. Rend l'identifiant du porteur.
 */
function poursuivre(room: GameRoom, id: string, arme: boolean): string | undefined {
  for (let ecoule = 0; ecoule < 110_000 && room.etat.evade?.porteur === undefined; ecoule += 50) {
    const but = evadeDe(room);
    const ici = room.etat.joueurs[id]?.position;

    if (but !== undefined && ici !== undefined) {
      marcherVers(room, id, but);

      const lui = room.etat.evade?.surLaCarte?.position ?? but;
      if (arme && Math.hypot(lui.x - ici.x, lui.y - ici.y) < 45) {
        room.demanderUnTir(id);
      }
    }
    horloge.avancerDe(50);
  }

  return room.etat.evade?.porteur;
}

describe("l'Evade, a travers le reseau", () => {
  for (const [mode, arme] of [
    ['classique', false],
    ['tactique', true],
    ['massacre', true],
  ] as const) {
    it(`apparait, se fait attraper, et double le classement final, en ${mode}`, async () => {
      const hote = await connecterUnClient();
      const salon = await creer(hote, 'Alice', partie(mode));
      const room = roomDe(salon.idRoom);

      expect(salon.reglages.evade).toBe(true);

      const annonces = collecter(hote, 'evade');
      const fin = prochain(hote, 'partieTerminee');
      await lancer(hote);

      const [alice] = Object.keys(room.etat.joueurs);
      if (alice === undefined) {
        throw new Error('Alice devrait etre dans la partie.');
      }

      expect(poursuivre(room, alice, arme)).toBe(alice);
      await jusquA(() => annonces.length >= 2);
      expect(annonces.slice(0, 2)).toEqual([
        { quoi: 'apparu' },
        { quoi: 'attrape', par: alice, parPseudo: 'Alice' },
      ]);

      while (room.statut === 'enCours') {
        horloge.avancerDe(1000);
      }

      const { classement } = await fin;
      expect(classement[0]).toMatchObject({ id: alice, doubleur: true });
      expect(Number(classement[0]?.points) % 2).toBe(0);
    });
  }

  it("n existe pas en Chasse, quoi que l'hote demande", async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', {
      ...partie('chasse'),
      reglages: { ...partie('chasse').reglages, botsNoirs: { actifs: false } },
    });

    expect(salon.reglages.evade).toBe(false);
  });
});
