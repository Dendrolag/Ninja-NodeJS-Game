/**
 * Tests d'integration des options de partie (etape 7.6), a travers la couche reseau, avec
 * un vrai client Socket.IO: la pluie, reglage de Tokyo, voyage du salon au lancement; le
 * nombre de faux ninjas depasse 150, jusqu'au plafond de chaque carte, et pas au-dela;
 * l'ancienne carte map2 ne se joue plus.
 *
 * LES MURS SONT LES VRAIS. Trois cents faux ninjas sur Tokyo, c'est une densite que le jeu
 * n'avait jamais connue: le serveur de ces tests decode les images de collision de
 * assets/, comme en production, pour verifier que chacun nait hors des murs.
 *
 * Meme cadre que ServeurSocket.horde.test.ts: un vrai serveur sur un vrai port, une
 * horloge manuelle pour le temps du JEU, et des attentes explicites pour celui du RESEAU.
 */

import type {
  DemandeCreation,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  IdentifiantCarte,
  InfosSalon,
  ResultatValidation,
} from '@neon-ninja/shared';
import { appliquerTrame } from '@neon-ninja/shared';
import { estMur } from '@neon-ninja/sim';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { GameRoom } from './GameRoom.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';
import { ChargeurDeTerrain } from './terrain.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

/** Une Horde publique sur cette carte, avec ces reglages en plus. */
function partie(
  carte: IdentifiantCarte,
  reglages: Omit<NonNullable<DemandeCreation['configuration']['reglages']>, 'carte'> = {},
): DemandeCreation['configuration'] {
  return { mode: 'classique', visibilite: 'publique', reglages: { carte, ...reglages } };
}

/**
 * Les murs des vraies cartes, decodes une fois pour tout le fichier: le decodage d'une
 * image de collision prend plusieurs centaines de millisecondes.
 */
const terrains = new ChargeurDeTerrain();

let serveur: ServeurMonte;
let horloge: HorlogeManuelle;
let port: number;
const clients: ClientTypee[] = [];

beforeAll(() => {
  for (const carte of ['map1', 'map3'] as const) {
    terrains.charger({ carte, modeMiroir: false });
  }
});

beforeEach(async () => {
  horloge = creerHorlogeManuelle();
  serveur = await demarrerServeur(0, { horloge, terrains });

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

/** Demande la creation d'une partie, et rend la reponse telle quelle. */
async function demanderCreation(
  client: ClientTypee,
  configuration: DemandeCreation['configuration'],
): Promise<ResultatValidation<InfosSalon>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande."));
    }, DELAI_ATTENTE_MS);

    client.emit('creerPartie', { pseudo: 'Alice', configuration }, (reponse) => {
      clearTimeout(minuterie);
      resoudre(reponse);
    });
  });
}

/** Cree une partie dont ce client devient l'hote, et rend son salon. */
async function creer(
  client: ClientTypee,
  configuration: DemandeCreation['configuration'],
): Promise<InfosSalon> {
  const reponse = await demanderCreation(client, configuration);

  if (!reponse.valide) {
    throw new Error(`Demande refusee: ${reponse.erreurs.map((erreur) => erreur.motif).join(', ')}`);
  }

  return reponse.valeur;
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

describe('la pluie, reglage de Tokyo (etape 7.6)', () => {
  it('tombe par defaut, et le salon le dit a qui rejoint', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, partie('map1'));

    expect(salon.reglages.pluie).toBe(true);
  });

  it('se coupe au salon, et la partie lancee la garde coupee', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, partie('map1'));

    const reglee = prochain(hote, 'salon');
    hote.emit('reglages', { ...salon.reglages, pluie: false });
    expect((await reglee).reglages.pluie).toBe(false);

    await lancer(hote);

    const room = roomDe(salon.idRoom);
    expect(room.statut).toBe('enCours');
    expect(room.reglages.pluie).toBe(false);
  });
});

describe('plus de 150 faux ninjas, jusqu au plafond de la carte (etape 7.6)', () => {
  /** Lance une partie peuplee au plafond de cette carte, et rend sa room. */
  async function partieAuPlafond(carte: IdentifiantCarte, faux: number): Promise<GameRoom> {
    const hote = await connecterUnClient();
    const salon = await creer(hote, partie(carte, { nombreBotsInitial: faux }));
    await lancer(hote);

    return roomDe(salon.idRoom);
  }

  it.each([
    ['map1', 300],
    ['map3', 500],
  ] as const)('peuple %s de %i faux ninjas, tous hors des murs', async (carte, faux) => {
    const room = await partieAuPlafond(carte, faux);
    const bots = Object.values(room.etat.bots).filter((bot) => bot.type === 'bot');
    const murs = terrains.charger({ carte, modeMiroir: false });

    expect(bots).toHaveLength(faux);
    expect(bots.filter((bot) => estMur(murs, bot.position.x, bot.position.y))).toEqual([]);
  });

  it('diffuse une partie de 300 faux ninjas a ses joueurs', async () => {
    const hote = await connecterUnClient();
    await creer(hote, partie('map1', { nombreBotsInitial: 300 }));
    await lancer(hote);

    const trame = prochain(hote, 'etat');
    horloge.avancerDe(50);

    // La premiere trame d'une partie est une image: elle se lit seule.
    const recu = appliquerTrame(undefined, await trame);

    expect(recu?.entites.filter((entite) => entite.type === 'bot')).toHaveLength(300);
  });

  it('refuse a la creation un nombre au-dela du plafond de Tokyo, en le disant', async () => {
    const hote = await connecterUnClient();
    const reponse = await demanderCreation(hote, partie('map1', { nombreBotsInitial: 301 }));

    expect(reponse.valide ? [] : reponse.erreurs).toEqual([
      {
        champ: 'nombreBotsInitial',
        motif: 'Cette carte accepte au plus 300 PNJ au départ.',
      },
    ]);
  });

  it('refuse au salon de passer a Tokyo avec les 500 faux ninjas de Spirit & Time', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, partie('map3', { nombreBotsInitial: 500 }));

    const refus = prochain(hote, 'refus');
    hote.emit('reglages', { ...salon.reglages, carte: 'map1' });

    expect((await refus).erreurs.map((erreur) => erreur.champ)).toEqual(['nombreBotsInitial']);
    expect(roomDe(salon.idRoom).reglages.carte).toBe('map3');
  });
});

describe('l ancienne carte map2 (etape 7.6)', () => {
  it('ne se joue plus', async () => {
    const hote = await connecterUnClient();
    const reponse = await demanderCreation(hote, {
      mode: 'classique',
      visibilite: 'publique',
      reglages: { carte: 'map2' as IdentifiantCarte },
    });

    expect(reponse.valide ? [] : reponse.erreurs.map((erreur) => erreur.champ)).toEqual(['carte']);
  });
});
