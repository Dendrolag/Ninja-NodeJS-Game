/**
 * Tests d'integration du mode Chasse a travers la couche reseau (etape 7.3), avec de vrais
 * clients Socket.IO: la condition de lancement, l'entree refusee dans une chasse lancee,
 * une chasse jouee jusqu'a l'infection de la derniere proie par un tir, qui la termine, et
 * la vie perdue annoncee au traqueur.
 *
 * Meme cadre que ServeurSocket.equipes.test.ts: un vrai serveur sur un vrai port, une
 * horloge manuelle pour le temps du JEU, et des attentes explicites pour celui du RESEAU.
 * Le terrain est une carte sans mur, pour qu'un traqueur puisse marcher droit sur sa proie.
 */

import type {
  DemandeCreation,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES, CHASSE, COULEUR_DES_TRAQUEURS, DUREES } from '@neon-ninja/shared';
import { carteSansMur, estTraqueur } from '@neon-ninja/sim';
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
 * Une partie Chasse publique, sans rien qui derange un joueur qui marche: ni objet, ni
 * zone. Les bots noirs, eux, sont absents par le mode.
 */
const PARTIE_CHASSE: DemandeCreation['configuration'] = {
  mode: 'chasse',
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

/** Une chasse creee par Alice, ou Bob est entre. */
async function salonAAlice(): Promise<{
  readonly hote: ClientTypee;
  readonly invite: ClientTypee;
  readonly salon: InfosSalon;
}> {
  const hote = await connecterUnClient();
  const invite = await connecterUnClient();
  const cree = await creer(hote, 'Alice', PARTIE_CHASSE);
  const salon = await entrer(invite, 'Bob', cree.idRoom);

  return { hote, invite, salon };
}

/** Lance la partie du salon d'Alice, decompte compris. */
async function lancer(hote: ClientTypee): Promise<void> {
  const lancee = prochain(hote, 'partieLancee');
  const decompte = prochain(hote, 'compteARebours');
  hote.emit('demarrer');
  await decompte;
  horloge.avancerDe(5000);
  await lancee;
}

describe('le salon d une partie Chasse, a travers le reseau', () => {
  it('refuse le demarrage a un seul joueur', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', PARTIE_CHASSE);

    const refus = prochain(hote, 'refus');
    hote.emit('demarrer');

    expect(await refus).toEqual({
      action: 'demarrer',
      erreurs: [
        { champ: 'joueurs', motif: 'Il faut au moins deux joueurs pour lancer une chasse.' },
      ],
    });
    expect(roomDe(salon.idRoom).statut).toBe('salon');
  });

  it('annule le decompte si le salon retombe a un joueur avant son terme', async () => {
    const { hote, invite, salon } = await salonAAlice();

    const decompte = prochain(hote, 'compteARebours');
    hote.emit('demarrer');
    await decompte;

    const vu = salonQui(hote, (etat) => etat.joueurs.length === 1);
    invite.emit('quitter');
    await vu;

    const annule = prochain(hote, 'demarrageAnnule');
    horloge.avancerDe(5000);
    await annule;

    expect(roomDe(salon.idRoom).statut).toBe('salon');
  });

  it('annonce des reglages sans bots noirs, meme demandes', async () => {
    const hote = await connecterUnClient();
    const salon = await creer(hote, 'Alice', {
      ...PARTIE_CHASSE,
      reglages: { ...PARTIE_CHASSE.reglages, botsNoirs: { actifs: true } },
    });

    expect(salon.reglages.botsNoirs.actifs).toBe(false);
  });
});

describe('une partie Chasse, a travers le reseau', () => {
  it('ferme la porte aux nouveaux venus une fois lancee', async () => {
    const { hote, salon } = await salonAAlice();
    await lancer(hote);

    const carole = await connecterUnClient();
    const reponse = await attendreAccuse<ResultatValidation<InfosSalon>>((accuse) => {
      carole.emit('rejoindre', { pseudo: 'Carole', idRoom: salon.idRoom }, accuse);
    });

    expect(reponse).toEqual({
      valide: false,
      erreurs: [{ champ: 'partie', motif: 'Cette chasse a déjà commencé.' }],
    });
  });

  it('se joue jusqu a l infection de la derniere proie par un tir, qui termine la partie', async () => {
    const { hote, invite, salon } = await salonAAlice();
    const room = roomDe(salon.idRoom);
    await lancer(hote);

    const traqueurId = Object.keys(room.etat.joueurs).find((id) => estTraqueur(room.etat, id));
    const proieId = Object.keys(room.etat.joueurs).find((id) => !estTraqueur(room.etat, id));
    if (traqueurId === undefined || proieId === undefined) {
      throw new Error('Un traqueur et une proie devraient etre tires.');
    }
    const [traqueur, proie] = salon.joueurs[0]?.id === traqueurId ? [hote, invite] : [invite, hote];

    // Le delai du traqueur et la protection de la proie passent.
    horloge.avancerDe(Math.max(CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS, DUREES.PROTECTION_SPAWN_MS) + 50);

    const position = (id: string): { x: number; y: number } => {
      const joueur = room.etat.joueurs[id];
      if (joueur === undefined) {
        throw new Error(`Le joueur ${id} devrait etre sur la carte.`);
      }
      return joueur.position;
    };
    const ecart = (): number => {
      const cible = position(proieId);
      const depart = position(traqueurId);
      return Math.hypot(cible.x - depart.x, cible.y - depart.y);
    };

    // Il marche droit sur la proie, qui ne bouge pas, jusqu'a la toucher presque: aucun
    // faux ninja ne peut alors etre plus proche d'elle dans son cone.
    const cible = position(proieId);
    const depart = position(traqueurId);
    const distance = ecart();
    const deplacement = { x: (cible.x - depart.x) / distance, y: (cible.y - depart.y) / distance };
    const intentions = vi.spyOn(room, 'enregistrerIntention');
    const tirs = vi.spyOn(room, 'demanderUnTir');
    const infections = collecter(proie, 'captureSubie');
    const fin = prochain(proie, 'partieTerminee');

    traqueur.emit('deplacer', { deplacement, enMouvement: true });
    await jusquA(() => intentions.mock.calls.length > 0);

    for (let ecoule = 0; ecoule < 40_000 && ecart() > 12; ecoule += 50) {
      horloge.avancerDe(50);
    }

    traqueur.emit('deplacer', { deplacement, enMouvement: false });
    await jusquA(() => intentions.mock.calls.length > 1);
    traqueur.emit('capturer');
    await jusquA(() => tirs.mock.calls.length > 0);
    horloge.avancerDe(50);

    expect(room.statut).toBe('terminee');
    expect(room.etat.tempsEcouleMs).toBeLessThan(room.etat.dureeMs);

    // La proie est prevenue qu'elle est devenue traqueur, et la fin arrive a tous.
    await jusquA(() => infections.length === 1);
    expect(infections[0]?.nouvelleCouleur).toBe(COULEUR_DES_TRAQUEURS);
    const { classement } = await fin;
    expect(classement.every((ligne) => ligne.couleur === COULEUR_DES_TRAQUEURS)).toBe(true);
  });

  it('previent le seul traqueur d une vie perdue', async () => {
    const { hote, invite, salon } = await salonAAlice();
    const room = roomDe(salon.idRoom);
    await lancer(hote);

    const traqueurId = Object.keys(room.etat.joueurs).find((id) => estTraqueur(room.etat, id));
    if (traqueurId === undefined) {
      throw new Error('Un traqueur devrait etre tire.');
    }
    const [traqueur, proie] = salon.joueurs[0]?.id === traqueurId ? [hote, invite] : [invite, hote];
    const chezLeTraqueur = collecter(traqueur, 'vieDeTraqueurPerdue');
    const chezLaProie = collecter(proie, 'vieDeTraqueurPerdue');
    horloge.avancerDe(CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS + 50);

    // La cible est l'affaire du moteur, teste a part: ici, la room fait marcher le traqueur
    // droit sur le faux ninja le plus proche, et tirer une fois colle a lui.
    for (
      let ecoule = 0;
      ecoule < 40_000 &&
      room.etat.evenements.every((evenement) => evenement.type !== 'vieDeTraqueurPerdue');
      ecoule += 50
    ) {
      const lui = room.etat.joueurs[traqueurId];
      if (lui === undefined) {
        throw new Error('Le traqueur devrait etre sur la carte.');
      }
      const ecartA = (x: number, y: number): number =>
        Math.hypot(x - lui.position.x, y - lui.position.y);
      const ninja = Object.values(room.etat.bots)
        .filter((bot) => bot.type === 'bot')
        .sort(
          (un, autre) =>
            ecartA(un.position.x, un.position.y) - ecartA(autre.position.x, autre.position.y),
        )[0];
      if (ninja === undefined) {
        throw new Error('Des faux ninjas devraient etre sur la carte.');
      }
      const ecart = ecartA(ninja.position.x, ninja.position.y);

      room.enregistrerIntention(traqueurId, {
        deplacement: {
          x: (ninja.position.x - lui.position.x) / Math.max(ecart, 1),
          y: (ninja.position.y - lui.position.y) / Math.max(ecart, 1),
        },
        enMouvement: ecart > 12,
      });
      if (ecart <= 12) {
        room.demanderUnTir(traqueurId);
      }
      horloge.avancerDe(50);
    }

    await jusquA(() => chezLeTraqueur.length === 1);
    expect(chezLeTraqueur[0]).toEqual({ viesRestantes: 2 });
    expect(chezLaProie).toEqual([]);
  });
});
