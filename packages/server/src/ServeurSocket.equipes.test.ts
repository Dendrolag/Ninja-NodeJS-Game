/**
 * Tests d'integration du mode Equipes a travers la couche reseau (etape 7.2), avec de
 * vrais clients Socket.IO: le choix des equipes au salon, la condition de lancement,
 * et une partie Equipes jouee jusqu'a une capture.
 *
 * Meme cadre que ServeurSocket.test.ts, dont l'en-tete explique les precautions: un
 * vrai serveur sur un vrai port, une horloge manuelle pour le temps du JEU, et des
 * attentes explicites pour celui du RESEAU. Le terrain est une carte sans mur, pour
 * qu'un joueur puisse marcher droit sur un adversaire.
 */

import type {
  DemandeCreation,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES, COULEURS_DES_EQUIPES, DUREES } from '@neon-ninja/shared';
import { carteSansMur } from '@neon-ninja/sim';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
 * Une partie Equipes publique, sans rien qui derange un joueur qui marche: ni bot noir,
 * ni objet, ni zone.
 */
const PARTIE_EQUIPES: DemandeCreation['configuration'] = {
  mode: 'equipes',
  visibilite: 'publique',
  reglages: {
    carte: 'map3',
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

/** Une partie Classique publique aux reglages par defaut. */
const PARTIE_CLASSIQUE: DemandeCreation['configuration'] = {
  mode: 'classique',
  visibilite: 'publique',
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

/** Attend un etat du salon qui remplit cette condition. */
async function salonQui(
  client: ClientTypee,
  condition: (salon: InfosSalon) => boolean,
): Promise<InfosSalon> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error('Le salon attendu n est pas arrive.'));
    }, DELAI_ATTENTE_MS);

    const ecouter = (salon: InfosSalon): void => {
      if (condition(salon)) {
        clearTimeout(minuterie);
        client.off('salon', ecouter);
        resoudre(salon);
      }
    };

    client.on('salon', ecouter);
  });
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

/** Une partie Equipes creee par Alice, ou Bob est entre: Alice en Cyan, Bob en Magenta. */
async function salonAAlice(): Promise<{
  readonly hote: ClientTypee;
  readonly invite: ClientTypee;
  readonly salon: InfosSalon;
}> {
  const hote = await connecterUnClient();
  const invite = await connecterUnClient();
  const cree = await creer(hote, 'Alice', PARTIE_EQUIPES);
  const salon = await entrer(invite, 'Bob', cree.idRoom);

  return { hote, invite, salon };
}

describe('le salon d une partie Equipes, a travers le reseau', () => {
  it('annonce l equipe de chaque membre, et diffuse un changement d equipe', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();
    const cree = await creer(hote, 'Alice', PARTIE_EQUIPES);

    expect(cree.joueurs).toEqual([
      { id: expect.any(String) as string, pseudo: 'Alice', hote: true, equipe: 'cyan' },
    ]);

    const salon = await entrer(invite, 'Bob', cree.idRoom);
    expect(salon.joueurs.map((joueur) => [joueur.pseudo, joueur.equipe])).toEqual([
      ['Alice', 'cyan'],
      ['Bob', 'magenta'],
    ]);

    const vu = salonQui(hote, (etat) =>
      etat.joueurs.some((joueur) => joueur.pseudo === 'Bob' && joueur.equipe === 'cyan'),
    );
    invite.emit('changerDEquipe', 'cyan');

    await vu;
  });

  it('refuse un changement d equipe hors du mode Equipes', async () => {
    const hote = await connecterUnClient();
    await creer(hote, 'Alice', PARTIE_CLASSIQUE);

    const refus = prochain(hote, 'refus');
    hote.emit('changerDEquipe', 'magenta');

    expect(await refus).toEqual({
      action: 'changerDEquipe',
      erreurs: [{ champ: 'equipe', motif: 'Cette partie ne se joue pas en équipes.' }],
    });
  });

  it('refuse une equipe qui n existe pas', async () => {
    const { invite } = await salonAAlice();

    const refus = prochain(invite, 'refus');
    // Un client modifie peut envoyer n'importe quoi.
    invite.emit('changerDEquipe', 'jaune' as never);

    expect(await refus).toEqual({
      action: 'changerDEquipe',
      erreurs: [{ champ: 'equipe', motif: "Cette équipe n'existe pas." }],
    });
  });

  it('refuse le demarrage tant qu une equipe est vide', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', PARTIE_EQUIPES);

    const refus = prochain(hote, 'refus');
    hote.emit('demarrer');

    expect(await refus).toEqual({
      action: 'demarrer',
      erreurs: [{ champ: 'equipes', motif: 'Il faut au moins un joueur dans chaque équipe.' }],
    });
    expect(roomDe(salon.idRoom).statut).toBe('salon');
  });

  it('annule le decompte si une equipe s est videe avant son terme', async () => {
    const { hote, invite, salon } = await salonAAlice();

    const decompte = prochain(hote, 'compteARebours');
    hote.emit('demarrer');
    await decompte;

    const vu = salonQui(hote, (etat) => etat.joueurs.every((joueur) => joueur.equipe === 'cyan'));
    invite.emit('changerDEquipe', 'cyan');
    await vu;

    const annule = prochain(hote, 'demarrageAnnule');
    horloge.avancerDe(5000);
    await annule;

    expect(roomDe(salon.idRoom).statut).toBe('salon');
  });
});

describe('une partie Equipes, a travers le reseau', () => {
  it('se joue jusqu a une capture, ou la victime garde la couleur de son equipe', async () => {
    const { hote, invite, salon } = await salonAAlice();
    const room = roomDe(salon.idRoom);
    const [alice, bob] = salon.joueurs.map((joueur) => joueur.id);
    if (alice === undefined || bob === undefined) {
      throw new Error('Alice et Bob devraient etre dans le salon.');
    }

    const lancee = prochain(hote, 'partieLancee');
    const decompte = prochain(hote, 'compteARebours');
    hote.emit('demarrer');
    await decompte;
    horloge.avancerDe(5000);
    await lancee;

    // Les protections d'apparition passent, puis Bob marche droit sur Alice.
    horloge.avancerDe(DUREES.PROTECTION_SPAWN_MS + 50);
    const cible = room.etat.joueurs[alice]?.position;
    const depart = room.etat.joueurs[bob]?.position;
    if (cible === undefined || depart === undefined) {
      throw new Error('Alice et Bob devraient etre sur la carte.');
    }

    const distance = Math.hypot(cible.x - depart.x, cible.y - depart.y);
    const deplacement = { x: (cible.x - depart.x) / distance, y: (cible.y - depart.y) / distance };
    const intentions = vi.spyOn(room, 'enregistrerIntention');
    const chezAlice = collecter(hote, 'captureSubie');
    const chezBob = collecter(invite, 'captureSubie');

    invite.emit('deplacer', { deplacement, enMouvement: true });
    await jusquA(() => intentions.mock.calls.length > 0);

    const captures = (): number =>
      Object.values(room.etat.joueurs).reduce((total, joueur) => total + joueur.captures, 0);
    for (let ecoule = 0; ecoule < 40_000 && captures() === 0; ecoule += 50) {
      horloge.avancerDe(50);
    }

    expect(captures()).toBe(1);
    expect(room.equipeDe(alice)).toBe('cyan');
    expect(room.equipeDe(bob)).toBe('magenta');

    // La victime est prevenue, avec la couleur de son equipe.
    await jusquA(() => chezAlice.length + chezBob.length === 1);
    const [victime, annonce] =
      chezAlice.length === 1
        ? (['cyan', chezAlice[0]] as const)
        : (['magenta', chezBob[0]] as const);

    expect(annonce?.nouvelleCouleur).toBe(COULEURS_DES_EQUIPES[victime]);
  });
});
