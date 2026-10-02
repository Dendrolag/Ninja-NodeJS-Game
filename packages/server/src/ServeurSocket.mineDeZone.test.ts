/**
 * Tests d'integration des mines de zone, a travers la couche reseau (etape 7.12), avec de
 * vrais clients Socket.IO: la carte pose une mine de zone, que tous voient dans le flux
 * d'etat; un joueur l'arme en marchant dessus, et sa zone s'ouvre trois secondes plus tard.
 * Chaque etape est dite a tous. Une partie aux zones coupees n'en pose aucune.
 *
 * Meme cadre que ServeurSocket.mine.test.ts: un vrai serveur sur un vrai port, une horloge
 * manuelle pour le temps du JEU, des attentes explicites pour celui du RESEAU, et une petite
 * arene fermee, ou la mine se pose forcement.
 */

import type {
  DemandeCreation,
  DimensionsCarte,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  InstantanePartie,
  Position,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES, MINES_DE_ZONE, ZONES, appliquerTrame } from '@neon-ninja/shared';
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
 * Une partie de deux minutes ou seules les mines de zone apparaissent, toutes les cinq
 * secondes, une seule a la fois, et toujours de repulsion: ni objet, ni Black Ninja, ni Evade.
 */
function partie(zonesActives = true): DemandeCreation['configuration'] {
  return {
    mode: 'classique',
    visibilite: 'publique',
    reglages: {
      carte: 'map1',
      dureePartieS: 120,
      nombreBotsInitial: 10,
      evade: false,
      bonus: {
        types: {
          vitesse: { actif: false },
          invincibilite: { actif: false },
          revelation: { actif: false },
        },
      },
      malus: { actifs: false },
      zones: {
        actives: zonesActives,
        intervalleApparitionS: 5,
        minesMaximum: 1,
        types: { chaos: false, repulsion: true, attraction: false, invisibilite: false },
      },
      botsNoirs: { actifs: false },
      objetsDePoche: { fumee: { actif: false }, mine: { actif: false } },
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

describe('les mines de zone, a travers le reseau', () => {
  it('se posent, se voient de tous, s arment sous un joueur et ouvrent leur zone', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();
    const salon = await creer(hote, 'Alice', partie());
    await entrer(invite, 'Bob', salon.idRoom);
    const room = roomDe(salon.idRoom);

    expect(salon.reglages.zones.minesMaximum).toBe(1);

    const flux = suivreLeFlux(invite);
    await lancer(hote);
    const bob = invite.id as string;

    // La carte pose sa mine au bout de l'intervalle, et le dit a tous.
    const poseeChezLHote = prochain(hote, 'mineDeZone');
    const poseeChezLInvite = prochain(invite, 'mineDeZone');
    horloge.avancerDe(5000);
    const posee = await poseeChezLInvite;
    expect(await poseeChezLHote).toEqual(posee);
    expect(posee).toMatchObject({ quoi: 'posee', nature: 'repulsion' });

    const [mine] = Object.values(room.etat.minesDeZone ?? {});
    if (mine === undefined) {
      throw new Error('Une mine de zone devrait etre posee.');
    }
    expect(posee).toEqual({
      quoi: 'posee',
      mine: mine.id,
      nature: 'repulsion',
      x: mine.position.x,
      y: mine.position.y,
    });
    await jusquA(() => flux.partie?.tick === room.etat.tick);
    expect(flux.partie?.entites.find((entite) => entite.id === mine.id)).toMatchObject({
      type: 'mineDeZone',
      nature: 'repulsion',
    });
    expect(flux.partie?.zones).toEqual([]);

    // Bob marche dessus: elle s'arme, et tous le savent.
    const armeeChezLHote = prochain(hote, 'mineDeZone');
    const armeeChezLInvite = prochain(invite, 'mineDeZone');
    allerA(room, bob, mine.position);
    const armee = await armeeChezLInvite;
    expect(await armeeChezLHote).toEqual(armee);
    expect(armee).toMatchObject({ quoi: 'armee', mine: mine.id, par: bob });
    await jusquA(() => flux.partie?.tick === room.etat.tick);
    expect(flux.partie?.entites.find((entite) => entite.id === mine.id)).toHaveProperty(
      'avantOuvertureMs',
    );

    // Trois secondes plus tard, la zone s'ouvre a sa place.
    const ouverteChezLHote = prochain(hote, 'mineDeZone');
    const ouverteChezLInvite = prochain(invite, 'mineDeZone');
    horloge.avancerDe(MINES_DE_ZONE.DELAI_AVANT_OUVERTURE_MS);
    const ouverte = await ouverteChezLInvite;
    expect(await ouverteChezLHote).toEqual(ouverte);
    expect(ouverte).toEqual({
      quoi: 'ouverte',
      mine: mine.id,
      nature: 'repulsion',
      x: mine.position.x,
      y: mine.position.y,
    });

    await jusquA(() => flux.partie?.tick === room.etat.tick);
    expect(flux.partie?.entites.some((entite) => entite.id === mine.id)).toBe(false);
    expect(flux.partie?.zones).toHaveLength(1);
    expect(flux.partie?.zones[0]).toMatchObject({ type: 'repulsion', rayon: ZONES.RAYON_PX });
    expect(flux.partie?.zones[0]?.x).toBeCloseTo(mine.position.x, 0);
    expect(flux.partie?.zones[0]?.y).toBeCloseTo(mine.position.y, 0);
  });

  it('ne pose aucune mine quand les zones sont coupees', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', partie(false));
    const room = roomDe(salon.idRoom);
    const flux = suivreLeFlux(hote);
    const faits = collecter(hote, 'mineDeZone');
    await lancer(hote);

    horloge.avancerDe(30_000);
    await jusquA(() => flux.partie?.tick === room.etat.tick);

    expect(room.etat.minesDeZone).toBeUndefined();
    expect(flux.partie?.entites.some((entite) => entite.type === 'mineDeZone')).toBe(false);
    expect(flux.partie?.zones).toEqual([]);
    expect(faits).toEqual([]);
  });
});
