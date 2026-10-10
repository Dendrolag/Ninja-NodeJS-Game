/**
 * Tests d'integration du mode Among Ninjas a travers la couche reseau (etape 7.20), avec de
 * vrais clients Socket.IO: la condition de lancement a cinq, l'entree refusee une fois la
 * partie lancee, le role annonce a chacun seul, ce que chaque vivant recoit du flux (rien
 * hors de son disque, aucun fantome, aucun role), puis une partie jouee jusqu'au bout: un
 * meurtre, un signalement, le chat par canal, un vote qui ejecte le tueur, et la victoire des
 * proies. Et une tache courte (etape 7.21): ouverte a l'appui, une fin trop tot refusee, puis
 * faite.
 *
 * Meme cadre que ServeurSocket.chasse.test.ts: un vrai serveur sur un vrai port, une horloge
 * manuelle pour le temps du JEU, et des attentes explicites pour celui du RESEAU. Le terrain
 * est une carte sans mur, pour qu'un joueur puisse marcher droit sur un autre.
 */

import type {
  DemandeCreation,
  EtatPriveAmong,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  InstantanePartie,
  Position,
  ResultatValidation,
} from '@neon-ninja/shared';
import {
  AMONG,
  CARTES,
  DUREES_MINIMALES_DES_TACHES_MS,
  RAYONS_DE_VISION,
  appliquerTrame,
} from '@neon-ninja/shared';
import { carteSansMur, estTueur } from '@neon-ninja/sim';
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

/** Une partie Among Ninjas publique, sans foule: rien ne gene un joueur qui marche. */
const PARTIE_AMONG: DemandeCreation['configuration'] = {
  mode: 'among',
  visibilite: 'publique',
  reglages: { carte: 'map3', among: { foule: 0 } },
};

/** Les pseudos des cinq joueurs, l'hote en premier. */
const PSEUDOS = ['Alice', 'Bob', 'Carole', 'David', 'Eve'] as const;

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

    client.once(nom, ((charge: Parameters<EvenementsServeurVersClient[Nom]>[0]) => {
      clearTimeout(minuterie);
      resoudre(charge);
    }) as never);
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

/** Un joueur de la partie: sa connexion, son identifiant et son pseudo. */
interface JoueurDeTest {
  readonly client: ClientTypee;
  readonly id: string;
  readonly pseudo: string;
}

/** Un salon Among Ninjas cree par Alice, avec tant de joueurs en tout. */
async function salonA(nombre: number): Promise<{
  readonly joueurs: readonly JoueurDeTest[];
  readonly salon: InfosSalon;
}> {
  const joueurs: JoueurDeTest[] = [];
  let salon: InfosSalon | undefined;

  for (const pseudo of PSEUDOS.slice(0, nombre)) {
    const client = await connecterUnClient();
    salon =
      salon === undefined
        ? salonAccepte(
            await attendreAccuse<ResultatValidation<InfosSalon>>((accuse) => {
              client.emit('creerPartie', { pseudo, configuration: PARTIE_AMONG }, accuse);
            }),
          )
        : salonAccepte(
            await attendreAccuse<ResultatValidation<InfosSalon>>((accuse) => {
              client.emit('rejoindre', { pseudo, idRoom: (salon as InfosSalon).idRoom }, accuse);
            }),
          );
    const id = salon.joueurs.find((joueur) => joueur.pseudo === pseudo)?.id;
    if (id === undefined) {
      throw new Error(`${pseudo} devrait etre dans le salon.`);
    }
    joueurs.push({ client, id, pseudo });
  }

  return { joueurs, salon: salon as InfosSalon };
}

/** Lance la partie de l'hote, decompte compris. */
/**
 * Chaque joueur dit avoir charge la carte, comme sa page le fait (etape 7.20), et la revelation
 * commence: le serveur l'attendait.
 */
async function chargerLaCarte(joueurs: readonly JoueurDeTest[], room: GameRoom): Promise<void> {
  for (const joueur of joueurs) {
    joueur.client.emit('carteChargee');
  }

  await jusquA(() => {
    horloge.avancerDe(50);

    return room.etat.among?.phase !== 'chargement';
  });
  expect(room.etat.among?.phase).toBe('revelation');
}

async function lancer(hote: ClientTypee): Promise<void> {
  const lancee = prochain(hote, 'partieLancee');
  const decompte = prochain(hote, 'compteARebours');
  hote.emit('demarrer');
  await decompte;
  horloge.avancerDe(5000);
  await lancee;
}

/** Les trames recues par un client, reconstruites comme le ferait sa page. */
function suivreLeFlux(client: ClientTypee): InstantanePartie[] {
  const parties: InstantanePartie[] = [];
  let detenue: InstantanePartie | undefined;

  client.on('etat', (trame) => {
    const partie = appliquerTrame(detenue, trame);

    if (partie !== undefined) {
      detenue = partie;
      parties.push(partie);
    }
  });

  return parties;
}

/** La position d'un joueur sur le serveur. */
function position(room: GameRoom, id: string): Position {
  const joueur = room.etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre sur la carte.`);
  }
  return joueur.position;
}

/** Fait marcher ce joueur droit vers une place, jusqu'a en etre a cette distance. */
async function marcherVers(
  room: GameRoom,
  joueur: JoueurDeTest,
  cible: () => Position,
  distanceVoulue: number,
): Promise<void> {
  const ecart = (): number => {
    const ici = position(room, joueur.id);
    return Math.hypot(cible().x - ici.x, cible().y - ici.y);
  };
  const depart = position(room, joueur.id);
  const longueur = ecart();
  const deplacement = {
    x: (cible().x - depart.x) / longueur,
    y: (cible().y - depart.y) / longueur,
  };
  const intentions = vi.spyOn(room, 'enregistrerIntention');
  const avant = intentions.mock.calls.length;

  joueur.client.emit('deplacer', { deplacement, enMouvement: true });
  await jusquA(() => intentions.mock.calls.length > avant);

  for (let ecoule = 0; ecoule < 20_000 && ecart() > distanceVoulue; ecoule += 50) {
    horloge.avancerDe(50);
  }

  joueur.client.emit('deplacer', { deplacement, enMouvement: false });
  await jusquA(() => intentions.mock.calls.length > avant + 1);
}

describe('le salon d une partie Among Ninjas, a travers le reseau', () => {
  it('refuse le demarrage a quatre joueurs', async () => {
    const { joueurs, salon } = await salonA(4);
    const hote = joueurs[0] as JoueurDeTest;

    const refus = prochain(hote.client, 'refus');
    hote.client.emit('demarrer');

    expect(await refus).toEqual({
      action: 'demarrer',
      erreurs: [
        {
          champ: 'joueurs',
          motif: 'Il faut au moins 5 joueurs pour lancer une partie Among Ninjas.',
        },
      ],
    });
    expect(roomDe(salon.idRoom).statut).toBe('salon');
  });

  it('annonce les reglages que le mode impose: Tokyo, et ses propres reglages', async () => {
    const { salon } = await salonA(1);

    expect(salon.reglages.carte).toBe('map1');
    expect(salon.reglages.among?.foule).toBe(0);
    expect(salon.reglages.botsNoirs.actifs).toBe(false);
  });
});

describe('une partie Among Ninjas, a travers le reseau', () => {
  it('annonce a chacun son role, a lui seul, et ferme la porte aux nouveaux venus', async () => {
    const { joueurs, salon } = await salonA(5);
    const roles = joueurs.map((joueur) => prochain(joueur.client, 'amongNinjas'));
    await lancer((joueurs[0] as JoueurDeTest).client);
    const recus: EtatPriveAmong[] = await Promise.all(roles);

    expect(recus.filter((prive) => prive.role === 'tueur')).toHaveLength(1);
    for (const [rang, prive] of recus.entries()) {
      const id = (joueurs[rang] as JoueurDeTest).id;
      expect(prive.role === 'tueur').toBe(estTueur(roomDe(salon.idRoom).etat, id));
      expect(prive.complices).toEqual([]);
      expect(prive.fantome).toBe(false);
      expect(prive.taches).toHaveLength(prive.role === 'tueur' ? 0 : 5);
    }

    const frank = await connecterUnClient();
    const reponse = await attendreAccuse<ResultatValidation<InfosSalon>>((accuse) => {
      frank.emit('rejoindre', { pseudo: 'Frank', idRoom: salon.idRoom }, accuse);
    });
    expect(reponse).toEqual({
      valide: false,
      erreurs: [{ champ: 'partie', motif: 'Cette partie a déjà commencé.' }],
    });
  });

  it('ne montre a un vivant que son disque, sans fantome ni role', async () => {
    const { joueurs, salon } = await salonA(5);
    const room = roomDe(salon.idRoom);
    await lancer((joueurs[0] as JoueurDeTest).client);
    const flux = joueurs.map((joueur) => suivreLeFlux(joueur.client));

    await chargerLaCarte(joueurs, room);
    horloge.avancerDe(AMONG.DUREE_REVELATION_MS + 500);
    await jusquA(() => flux.every((parties) => parties.length > 5));

    for (const [rang, parties] of flux.entries()) {
      const id = (joueurs[rang] as JoueurDeTest).id;
      const tueur = estTueur(room.etat, id);
      const rayon = RAYONS_DE_VISION[tueur ? 'tueur' : 'proie'].normale;

      for (const partie of parties) {
        const moi = partie.entites.find((entite) => entite.id === id);
        expect(moi).toBeDefined();
        expect(moi?.type === 'joueur' && moi.tactique !== undefined).toBe(tueur);
        for (const entite of partie.entites) {
          expect(entite.type === 'joueur' && entite.fantome === true).toBe(false);
          expect(
            entite.type !== 'joueur' || entite.id === id || entite.tactique === undefined,
          ).toBe(true);
          expect(
            Math.hypot(entite.x - (moi?.x ?? 0), entite.y - (moi?.y ?? 0)),
          ).toBeLessThanOrEqual(rayon + 1);
        }
        expect(partie.classement.every((ligne) => ligne.points === 0)).toBe(true);
        expect(partie.among?.tachesTotal).toBe(20);
        expect(JSON.stringify(partie)).not.toMatch(/tueur|proie/u);
      }
    }
  });

  it('se joue jusqu a la victoire des proies: meurtre, signalement, chat, vote', async () => {
    const { joueurs, salon } = await salonA(5);
    const room = roomDe(salon.idRoom);
    await lancer((joueurs[0] as JoueurDeTest).client);

    const tueur = joueurs.find((joueur) => estTueur(room.etat, joueur.id)) as JoueurDeTest;
    const proies = joueurs.filter((joueur) => joueur !== tueur);
    const [victime, temoin] = proies as [JoueurDeTest, JoueurDeTest];

    // Le chat des vivants est ferme pendant le jeu.
    const ferme = prochain(temoin.client, 'refus');
    temoin.client.emit('chat', { texte: 'Qui est le tueur ?' });
    expect((await ferme).erreurs[0]?.motif).toBe('Le chat ne s’ouvre qu’en réunion.');

    // Le chargement, la revelation, puis la recharge du debut du tour.
    await chargerLaCarte(joueurs, room);
    horloge.avancerDe(AMONG.DUREE_REVELATION_MS + AMONG.RECHARGE_DEBUT_DE_TOUR_MS + 100);

    // Le meurtre, au contact.
    const meurtres = collecter(victime.client, 'meurtre');
    await marcherVers(room, tueur, () => position(room, victime.id), 25);
    const tirs = vi.spyOn(room, 'demanderUnTir');
    tueur.client.emit('capturer');
    await jusquA(() => tirs.mock.calls.length > 0);
    horloge.avancerDe(50);

    expect(room.etat.among?.joueurs[victime.id]?.fantome).toBe(true);
    await jusquA(() => meurtres.length === 1);
    expect(meurtres[0]).toMatchObject({ tueur: tueur.id, victime: victime.id });

    // Le fantome parle aux fantomes seuls.
    const parLesVivants = collecter(temoin.client, 'chat');
    const parLeFantome = prochain(victime.client, 'chat');
    victime.client.emit('chat', { texte: 'Je suis mort.' });
    expect(await parLeFantome).toMatchObject({ pseudo: victime.pseudo, canal: 'fantomes' });

    // Le temoin trouve le cadavre et le signale.
    const reunions = joueurs.map((joueur) => collecter(joueur.client, 'reunion'));
    const cadavre = Object.values(room.etat.among?.cadavres ?? {})[0]?.position as Position;
    await marcherVers(room, temoin, () => cadavre, 60);
    const actions = vi.spyOn(room, 'tenirLAction');
    temoin.client.emit('agir', true);
    await jusquA(() => actions.mock.calls.length > 0);
    horloge.avancerDe(50);
    temoin.client.emit('agir', false);

    expect(room.etat.among?.phase).toBe('discussion');
    await jusquA(() => reunions.every((recues) => recues.length > 0));
    for (const recues of reunions) {
      expect(recues[0]).toEqual({
        quoi: 'ouverte',
        numero: 1,
        par: temoin.id,
        motif: 'cadavre',
        cadavre: victime.id,
        morts: [victime.id],
      });
    }

    // En reunion, un vivant parle a tous, et le fantome le lit.
    const luParLeFantome = prochain(victime.client, 'chat');
    temoin.client.emit('chat', { texte: 'J ai trouve un corps.' });
    expect(await luParLeFantome).toMatchObject({
      pseudo: temoin.pseudo,
      texte: 'J ai trouve un corps.',
    });
    expect(parLesVivants.every((message) => message.canal === undefined)).toBe(true);

    // La discussion passe, puis tous les vivants votent: les proies contre le tueur.
    horloge.avancerDe(45_000);
    expect(room.etat.among?.phase).toBe('vote');
    const votes = vi.spyOn(room, 'voter');
    const vivantes = proies.filter((proie) => proie !== victime);
    for (const proie of vivantes) {
      proie.client.emit('voter', { cible: tueur.id });
    }
    tueur.client.emit('voter', { cible: null });
    await jusquA(() => votes.mock.calls.length === vivantes.length + 1);

    const fin = prochain(temoin.client, 'partieTerminee');
    horloge.avancerDe(50);
    expect(room.etat.among?.ejection?.ejecte).toBe(tueur.id);
    horloge.avancerDe(AMONG.DUREE_EJECTION_MS);

    expect(room.statut).toBe('terminee');
    const { among, classement } = await fin;
    expect(among?.vainqueur).toBe('proies');
    expect(among?.joueurs.find((joueur) => joueur.id === tueur.id)?.role).toBe('tueur');
    expect(classement.at(-1)?.id).toBe(tueur.id);
    await jusquA(() =>
      reunions.every((recues) => recues.some((reunion) => reunion.quoi === 'resultat')),
    );
    const resultat = reunions[1]?.find((reunion) => reunion.quoi === 'resultat');
    expect(resultat).toMatchObject({ quoi: 'resultat', ejecte: tueur.id });
    expect(JSON.stringify(resultat)).not.toMatch(/tueur|proie/u);
  });

  it('fait une tache: ouverte a l appui, une fin trop tot refusee, puis faite', async () => {
    const { joueurs, salon } = await salonA(5);
    const room = roomDe(salon.idRoom);
    await lancer((joueurs[0] as JoueurDeTest).client);
    await chargerLaCarte(joueurs, room);
    horloge.avancerDe(AMONG.DUREE_REVELATION_MS + 100);

    const proie = joueurs.find((joueur) => !estTueur(room.etat, joueur.id)) as JoueurDeTest;
    const among = room.etat.among;
    const tache = among?.joueurs[proie.id]?.taches[0];
    const station = tache === undefined ? undefined : among?.stations[tache.station];
    if (tache === undefined || station === undefined) {
      throw new Error('La proie devrait avoir une tache a une station.');
    }
    const etats = collecter(proie.client, 'amongNinjas');

    await marcherVers(room, proie, () => station, 20);
    const actions = vi.spyOn(room, 'tenirLAction');
    proie.client.emit('agir', true);
    await jusquA(() => actions.mock.calls.length > 0);
    horloge.avancerDe(50);
    proie.client.emit('agir', false);
    await jusquA(() => actions.mock.calls.length > 1);

    expect(room.etat.among?.joueurs[proie.id]?.tacheEnCours?.indice).toBe(0);
    await jusquA(() => etats.some((etat) => etat.tacheEnCours === 0));

    // Une fin annoncee tout de suite est refusee: la tache reste ouverte.
    const annonces = vi.spyOn(room, 'annoncerLaTache');
    proie.client.emit('tache', 'finie');
    await jusquA(() => annonces.mock.calls.length === 1);
    horloge.avancerDe(50);
    expect(room.etat.among?.joueurs[proie.id]?.taches[0]?.faite).toBe(false);
    expect(room.etat.among?.joueurs[proie.id]?.tacheEnCours?.indice).toBe(0);

    // Une annonce mal formee ne passe pas.
    (proie.client.emit as (nom: string, valeur: unknown) => void)('tache', 'gagnee');

    horloge.avancerDe(DUREES_MINIMALES_DES_TACHES_MS[tache.nature]);
    proie.client.emit('tache', 'finie');
    await jusquA(() => annonces.mock.calls.length === 2);
    horloge.avancerDe(50);

    expect(annonces.mock.calls.map((appel) => appel[1])).toEqual(['finie', 'finie']);
    expect(room.etat.among?.joueurs[proie.id]?.taches[0]?.faite).toBe(true);
    await jusquA(() => etats.some((etat) => etat.taches[0]?.faite === true));
    expect(etats.at(-1)?.taches[0]).toEqual({ station: 0, nature: tache.nature, faite: true });
  });
});
