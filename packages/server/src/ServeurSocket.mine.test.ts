/**
 * Tests d'integration de la mine posee, a travers la couche reseau (etape 7.11), avec de
 * vrais clients Socket.IO: un joueur ramasse une mine, la pose par le message
 * utiliserLaPoche, un adversaire l'arme en marchant dessus, et elle saute. Chacun voit la
 * mine dans le flux d'etat, l'armement et l'explosion; la pose n'est dite qu'au poseur.
 *
 * Meme cadre que ServeurSocket.poche.test.ts: un vrai serveur sur un vrai port, une horloge
 * manuelle pour le temps du JEU, des attentes explicites pour celui du RESEAU, et une petite
 * arene fermee, ou le joueur trouve vite la mine qui y apparait.
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
 * Une partie de deux minutes ou seule la mine apparait, a chaque tentative: ni autre objet,
 * ni zone, ni Black Ninja, ni Evade.
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
      objetsDePoche: {
        fumee: { actif: false },
        mine: { actif: true, tauxApparitionPourCent: 100 },
      },
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

/** Fait marcher ce joueur vers la mine posee au sol la plus proche, jusqu'a l'avoir en poche. */
function allerChercherLaMine(room: GameRoom, id: string): void {
  for (
    let ecoule = 0;
    ecoule < 30_000 && room.etat.joueurs[id]?.poche === undefined;
    ecoule += 50
  ) {
    const ici = room.etat.joueurs[id]?.position;
    const fumees = Object.values(room.etat.objets).filter((objet) => objet.nature === 'mine');

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

/**
 * Fait marcher ce joueur jusqu'a ce point, a moins de huit pixels: un pas de 50 ms en fait
 * 7,5, et une tolerance plus fine le ferait osciller autour du point sans jamais s'arreter.
 */
function allerA(room: GameRoom, id: string, but: Position): void {
  for (let ecoule = 0; ecoule < 10_000; ecoule += 50) {
    const ici = room.etat.joueurs[id]?.position;

    if (ici === undefined || Math.hypot(but.x - ici.x, but.y - ici.y) < 8) {
      break;
    }

    const ecart = Math.hypot(but.x - ici.x, but.y - ici.y);
    room.enregistrerIntention(id, {
      deplacement: { x: (but.x - ici.x) / ecart, y: (but.y - ici.y) / ecart },
      enMouvement: true,
    });
    horloge.avancerDe(50);
  }

  room.enregistrerIntention(id, { deplacement: { x: 0, y: 0 }, enMouvement: false });
}

/** Les quatre coins de l'arene, a vingt pixels des murs. */
const COINS: readonly Position[] = [
  { x: ARENE.gauche + 20, y: ARENE.haut + 20 },
  { x: ARENE.gauche + ARENE.largeur - 20, y: ARENE.haut + 20 },
  { x: ARENE.gauche + 20, y: ARENE.haut + ARENE.hauteur - 20 },
  { x: ARENE.gauche + ARENE.largeur - 20, y: ARENE.haut + ARENE.hauteur - 20 },
];

/** Le coin de l'arene le plus eloigne de tous ces points: on s'y met a l'ecart d'eux. */
function coinLoinDe(...points: readonly Position[]): Position {
  const eloignement = (coin: Position): number =>
    Math.min(...points.map((point) => Math.hypot(coin.x - point.x, coin.y - point.y)));

  return COINS.reduce((meilleur, coin) =>
    eloignement(coin) > eloignement(meilleur) ? coin : meilleur,
  );
}

/**
 * Alice ramasse une mine, Bob s'ecarte dans le coin le plus loin d'elle et y perd sa
 * protection d'apparition, Alice pose la mine ou elle est, puis s'eloigne de la mine et de
 * Bob, laissant Bob la rejoindre. Rend l'identifiant et la place de la mine, qui attend encore.
 */
async function preparerLaMine(
  hote: ClientTypee,
  room: GameRoom,
  alice: string,
  bob: string,
): Promise<{ readonly id: string; readonly position: Position }> {
  allerChercherLaMine(room, alice);
  expect(room.etat.joueurs[alice]?.poche).toBe('mine');

  allerA(room, bob, coinLoinDe(room.etat.joueurs[alice]?.position ?? { x: 0, y: 0 }));
  horloge.avancerDe(3000);

  // On attend la mine posee, pas la poche vide: Alice peut ramasser une autre mine dans le
  // battement meme ou elle pose la sienne.
  hote.emit('utiliserLaPoche');
  await jusquA(() => {
    horloge.avancerDe(50);
    return Object.keys(room.etat.minesPosees ?? {}).length > 0;
  });

  const [mine] = Object.values(room.etat.minesPosees ?? {});
  if (mine === undefined) {
    throw new Error('Une mine devrait etre posee.');
  }

  // Alice s'eloigne de sa mine et de Bob: le toucher le capturerait, en Horde, et il
  // reapparaitrait protege.
  allerA(
    room,
    alice,
    coinLoinDe(mine.position, room.etat.joueurs[bob]?.position ?? { x: 0, y: 0 }),
  );
  // Personne ne l'a encore armee: c'est Bob qui va le faire.
  expect(room.etat.minesPosees?.[mine.id]?.avantExplosionMs).toBeUndefined();

  return { id: mine.id, position: mine.position };
}

describe('la mine, a travers le reseau', () => {
  it('se pose, se voit de tous, s arme sous un adversaire et saute, en Horde', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();
    const salon = await creer(hote, 'Alice', partie());
    await entrer(invite, 'Bob', salon.idRoom);
    const room = roomDe(salon.idRoom);

    expect(salon.reglages.objetsDePoche.mine.actif).toBe(true);

    const flux = suivreLeFlux(invite);
    const posesChezLInvite = collecter(invite, 'minePosee');
    await lancer(hote);

    const alice = hote.id as string;
    const bob = invite.id as string;
    const posee = prochain(hote, 'minePosee');
    const mine = await preparerLaMine(hote, room, alice, bob);

    // La pose n'est dite qu'au poseur; la mine, elle, part a tous dans le flux.
    expect(await posee).toEqual({ mine: mine.id, x: mine.position.x, y: mine.position.y });
    await jusquA(() => flux.partie?.tick === room.etat.tick);
    expect(flux.partie?.entites.find((entite) => entite.id === mine.id)).toMatchObject({
      type: 'mine',
      poseur: alice,
    });
    expect(posesChezLInvite).toEqual([]);

    const armeeChezLHote = prochain(hote, 'mineArmee');
    const armeeChezLInvite = prochain(invite, 'mineArmee');
    allerA(room, bob, mine.position);
    const armee = await armeeChezLInvite;
    expect(await armeeChezLHote).toEqual(armee);
    expect(armee).toMatchObject({ mine: mine.id, poseur: alice, par: bob });

    // Bob reste dessus: elle saute 1,5 seconde plus tard, et le touche.
    const exploseeChezLHote = prochain(hote, 'mineExplosee');
    const exploseeChezLInvite = prochain(invite, 'mineExplosee');
    horloge.avancerDe(1500);
    const explosee = await exploseeChezLInvite;

    expect(await exploseeChezLHote).toEqual(explosee);
    expect(explosee.touches.map((touche) => touche.joueur)).toEqual([bob]);
    expect(explosee.touches[0]?.effet).toBe('ninjasPerdus');
    expect(room.etat.minesPosees).toBeUndefined();
  });

  it('tue en Massacre, et rapporte au poseur la moitie des points de sa victime', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();
    const salon = await creer(hote, 'Alice', partie('massacre'));
    await entrer(invite, 'Bob', salon.idRoom);
    const room = roomDe(salon.idRoom);
    await lancer(hote);

    const alice = hote.id as string;
    const bob = invite.id as string;
    const mine = await preparerLaMine(hote, room, alice, bob);

    const pointsDeBob = room.etat.massacre?.guerriers[bob]?.points ?? 0;
    const pointsDAlice = room.etat.massacre?.guerriers[alice]?.points ?? 0;
    const explosee = prochain(invite, 'mineExplosee');
    allerA(room, bob, mine.position);
    horloge.avancerDe(1500);
    const fait = await explosee;
    const vole = Math.floor(pointsDeBob / 2);

    expect(fait.touches).toEqual([{ joueur: bob, effet: 'tue', quantite: vole }]);
    expect(room.etat.massacre?.guerriers[alice]?.points).toBeGreaterThanOrEqual(
      pointsDAlice + vole,
    );
    expect(room.etat.joueurs[alice]?.captures).toBe(1);
  });
});
