/**
 * Tests d'integration du retour en partie apres une coupure (etape 2.5).
 *
 * De vrais clients Socket.IO contre un vrai serveur, comme ServeurSocket.test.ts:
 * rien n'est simule, sauf le temps du jeu, et donc le delai de retour, qui se compte
 * sur l'horloge manuelle du serveur. Le temps du reseau, lui, est reel: chaque
 * verification attend la preuve que le serveur a traite ce qui lui a ete envoye.
 *
 * UNE COUPURE SE JOUE EN FERMANT LA CONNEXION DU CLIENT, et un retour en ouvrant une
 * connexion neuve: c'est exactement ce que fait une page rechargee. Aucun client de
 * ces tests ne se reconnecte de lui-meme.
 */

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  InstantanePartie,
  PlaceEnPartie,
  ResultatValidation,
} from '@neon-ninja/shared';
import { BORNES_JETON, DELAI_DE_RETOUR_MS, appliquerTrame } from '@neon-ninja/shared';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CADENCE_BATTEMENT_MS } from './GameRoom.js';
import type { GameRoom } from './GameRoom.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import { RETOUR_REFUSE } from './places.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

let serveur: ServeurMonte;
let horloge: HorlogeManuelle;
let url: string;
const clients: ClientTypee[] = [];

beforeEach(async () => {
  horloge = creerHorlogeManuelle();
  serveur = await demarrerServeur(0, { horloge });

  const adresse = serveur.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  url = `http://localhost:${String(adresse.port)}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await serveur.fermer();
});

/** Ouvre une connexion cliente, sans reconnexion automatique, et attend qu'elle soit etablie. */
async function connecterUnClient(): Promise<ClientTypee> {
  const client: ClientTypee = connecter(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
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

/** Laisse le reseau acheminer ce qui est deja parti. */
async function laisserPasserLesMessages(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 30));
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

/** Une entree acceptee: la partie, et la place remise au joueur. */
interface Entree {
  readonly salon: InfosSalon;
  readonly place: PlaceEnPartie;
  /** Les deux messages, dans l'ordre ou le client les a recus. */
  readonly ordre: readonly string[];
}

/** Entre dans une partie, et rend le salon et la place recue. */
async function entrer(client: ClientTypee, pseudo: string, idRoom?: string): Promise<Entree> {
  const ordre: string[] = [];
  const place = new Promise<PlaceEnPartie>((resoudre) => {
    client.once('placeAttribuee', (recue) => {
      ordre.push('placeAttribuee');
      resoudre(recue);
    });
  });

  const reponse = await new Promise<ResultatValidation<InfosSalon>>((resoudre) => {
    client.emit('rejoindre', idRoom === undefined ? { pseudo } : { pseudo, idRoom }, (recue) => {
      ordre.push('reponse');
      resoudre(recue);
    });
  });

  if (!reponse.valide) {
    throw new Error(`Entree refusee: ${reponse.erreurs.map((erreur) => erreur.motif).join(', ')}`);
  }

  return { salon: reponse.valeur, place: await place, ordre };
}

/** Demande a revenir avec ce jeton, et attend le verdict. */
async function revenir(
  client: ClientTypee,
  jeton: unknown,
): Promise<ResultatValidation<InfosSalon>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande de retour."));
    }, DELAI_ATTENTE_MS);

    client.emit('revenir', { jeton } as never, (reponse: ResultatValidation<InfosSalon>) => {
      clearTimeout(minuterie);
      resoudre(reponse);
    });
  });
}

/** Le champ du premier motif d'un refus, ou un echec de test si c'etait accepte. */
function refus(reponse: ResultatValidation<InfosSalon>): {
  readonly champ: string | undefined;
  readonly motif: string | undefined;
} {
  if (reponse.valide) {
    throw new Error('Attendu un refus, recu un retour accepte.');
  }

  return { champ: reponse.erreurs[0]?.champ, motif: reponse.erreurs[0]?.motif };
}

/**
 * Lance une partie longue et peu peuplee: decompte complet, puis premier battement.
 *
 * Deux minutes: le delai de retour y tient plusieurs fois. Dix bots: le serveur n'a
 * pas a faire battre cent entites pendant les trente secondes de chaque delai.
 */
async function lancerLaPartie(hote: ClientTypee, dureePartieS = 120): Promise<void> {
  const reglee = salonQui(hote, (salon) => salon.reglages.dureePartieS === dureePartieS);
  hote.emit('reglages', { dureePartieS, nombreBotsInitial: 10 });
  await reglee;

  const decompte = prochain(hote, 'compteARebours');
  const lancee = prochain(hote, 'partieLancee');
  hote.emit('demarrer');
  await decompte;

  horloge.avancerDe(5000);
  await lancee;
}

/** Suit le flux d'etat d'un client, comme le fait le vrai client. */
function suivreLeFlux(client: ClientTypee): { partie: InstantanePartie | undefined } {
  const suivi: { partie: InstantanePartie | undefined } = { partie: undefined };

  client.on('etat', (trame) => {
    suivi.partie = appliquerTrame(suivi.partie, trame) ?? suivi.partie;
  });

  return suivi;
}

/** La partie de ce salon, telle que le serveur la tient. */
function partieDe(idRoom: string): GameRoom {
  const room = serveur.jeu.rooms.room(idRoom);

  if (room === undefined) {
    throw new Error(`La partie ${idRoom} n'existe pas.`);
  }

  return room;
}

/** Deux joueurs dans une partie lancee: Alice, hote, et Bob. */
async function aliceEtBobEnPartie(dureePartieS?: number): Promise<{
  readonly alice: ClientTypee;
  readonly bob: ClientTypee;
  readonly idRoom: string;
  readonly placeDeBob: PlaceEnPartie;
}> {
  const alice = await connecterUnClient();
  const bob = await connecterUnClient();
  const { salon } = await entrer(alice, 'Alice');
  const { place } = await entrer(bob, 'Bob', salon.idRoom);

  await lancerLaPartie(alice, dureePartieS);

  return { alice, bob, idRoom: salon.idRoom, placeDeBob: place };
}

/** Coupe la connexion de ce client, et attend que le serveur l'ait constate. */
async function couper(client: ClientTypee): Promise<void> {
  const nombre = serveur.jeu.nombreDeConnexions;
  client.disconnect();
  await jusquA(() => serveur.jeu.nombreDeConnexions < nombre);
}

describe('place en partie (etape 2.5)', () => {
  it('remet a qui entre son identifiant de joueur et un jeton de retour, avant la reponse', async () => {
    const alice = await connecterUnClient();

    const { salon, place, ordre } = await entrer(alice, 'Alice');

    expect(ordre).toEqual(['placeAttribuee', 'reponse']);
    expect(place.joueur).toBe(salon.joueurs[0]?.id);
    expect(place.joueur).toBe(alice.id);
    expect(BORNES_JETON.forme.test(place.jetonDeRetour)).toBe(true);
  });

  it('ne met pas le jeton de retour dans ce que les autres recoivent', async () => {
    const alice = await connecterUnClient();
    const bob = await connecterUnClient();
    const { salon } = await entrer(alice, 'Alice');
    const salonsDAlice = collecter(alice, 'salon');
    const arrivees = collecter(alice, 'joueurArrive');

    const { place } = await entrer(bob, 'Bob', salon.idRoom);
    await laisserPasserLesMessages();

    expect(JSON.stringify([salonsDAlice, arrivees])).not.toContain(place.jetonDeRetour);
  });
});

describe('retour dans une partie en cours (etape 2.5)', () => {
  it('garde le joueur deconnecte dans la partie, absent et a sa place', async () => {
    const { bob, idRoom, placeDeBob } = await aliceEtBobEnPartie();
    const partie = partieDe(idRoom);
    const avant = partie.etat.joueurs[placeDeBob.joueur];

    await couper(bob);

    expect(partie.estAbsent(placeDeBob.joueur)).toBe(true);
    expect(partie.etat.joueurs[placeDeBob.joueur]?.couleur).toBe(avant?.couleur);
    expect(partie.joueurs.map((joueur) => joueur.pseudo)).toEqual(['Alice', 'Bob']);
  });

  it('rend sa place a qui revient dans le delai: meme joueur, meme couleur, flux recu', async () => {
    const { bob, idRoom, placeDeBob } = await aliceEtBobEnPartie();
    const partie = partieDe(idRoom);
    const couleur = partie.etat.joueurs[placeDeBob.joueur]?.couleur;

    await couper(bob);
    horloge.avancerDe(DELAI_DE_RETOUR_MS - 1000);

    const bobRevenu = await connecterUnClient();
    const flux = suivreLeFlux(bobRevenu);
    const nouvellePlace = prochain(bobRevenu, 'placeAttribuee');
    const lancee = prochain(bobRevenu, 'partieLancee');

    const reponse = await revenir(bobRevenu, placeDeBob.jetonDeRetour);
    await lancee;

    expect(reponse.valide).toBe(true);
    expect(reponse.valide && reponse.valeur.statut).toBe('enCours');
    const place = await nouvellePlace;
    expect(place.joueur).toBe(placeDeBob.joueur);
    expect(place.jetonDeRetour).not.toBe(placeDeBob.jetonDeRetour);
    expect(partie.estAbsent(placeDeBob.joueur)).toBe(false);

    // Au battement suivant, il recoit une image, et s'y retrouve avec sa couleur.
    horloge.avancerDe(CADENCE_BATTEMENT_MS);
    await jusquA(() => flux.partie !== undefined);

    const vu = flux.partie?.entites.find((entite) => entite.id === placeDeBob.joueur);
    expect(vu?.couleur).toBe(couleur);

    // Et le delai qui courait ne le fait plus sortir.
    horloge.avancerDe(DELAI_DE_RETOUR_MS);
    expect(partie.etat.joueurs[placeDeBob.joueur]).toBeDefined();
  });

  it('le revenu commande de nouveau son joueur', async () => {
    const { bob, idRoom, placeDeBob } = await aliceEtBobEnPartie();
    const partie = partieDe(idRoom);

    await couper(bob);
    const bobRevenu = await connecterUnClient();
    expect((await revenir(bobRevenu, placeDeBob.jetonDeRetour)).valide).toBe(true);

    const depart = partie.etat.joueurs[placeDeBob.joueur]?.position.x ?? 0;
    bobRevenu.emit('deplacer', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    await jusquA(() => {
      horloge.avancerDe(CADENCE_BATTEMENT_MS);
      return (partie.etat.joueurs[placeDeBob.joueur]?.position.x ?? 0) !== depart;
    });

    expect(partie.etat.joueurs[placeDeBob.joueur]?.position.x).not.toBe(depart);
  });

  it('refuse le retour au-dela du delai: le joueur est parti, et c est un abandon', async () => {
    const { alice, bob, idRoom, placeDeBob } = await aliceEtBobEnPartie();
    const partie = partieDe(idRoom);

    await couper(bob);
    const depart = prochain(alice, 'joueurParti');
    horloge.avancerDe(DELAI_DE_RETOUR_MS);

    expect((await depart).pseudo).toBe('Bob');
    expect(partie.etat.joueurs[placeDeBob.joueur]).toBeUndefined();

    const bobRevenu = await connecterUnClient();
    expect(refus(await revenir(bobRevenu, placeDeBob.jetonDeRetour))).toEqual({
      champ: 'retour',
      motif: RETOUR_REFUSE,
    });
    expect(partie.bilan().joueurs.filter((joueur) => joueur.abandon)).toHaveLength(1);
  });

  it('refuse un jeton inconnu, mal forme, ou deja servi, sans rien prendre a personne', async () => {
    const { bob, idRoom, placeDeBob } = await aliceEtBobEnPartie();
    const partie = partieDe(idRoom);

    await couper(bob);
    const bobRevenu = await connecterUnClient();
    expect((await revenir(bobRevenu, placeDeBob.jetonDeRetour)).valide).toBe(true);

    const intrus = await connecterUnClient();
    expect(refus(await revenir(intrus, placeDeBob.jetonDeRetour)).champ).toBe('retour');
    expect(refus(await revenir(intrus, 'Z'.repeat(43))).champ).toBe('retour');
    expect(refus(await revenir(intrus, 'trop-court')).champ).toBe('retour');

    expect(partie.estAbsent(placeDeBob.joueur)).toBe(false);
    expect(intrus.connected).toBe(true);
  });

  it('reprend la place a une connexion qui la tient encore, qui en est prevenue sans etre coupee', async () => {
    const { bob, idRoom, placeDeBob } = await aliceEtBobEnPartie();
    const partie = partieDe(idRoom);

    const reprise = prochain(bob, 'placeReprise');
    const autrePage = await connecterUnClient();
    expect((await revenir(autrePage, placeDeBob.jetonDeRetour)).valide).toBe(true);
    await reprise;

    // L'ancienne page ne recoit plus rien de la partie, et ne la commande plus.
    const tramesDeLAncienne = collecter(bob, 'etat');
    const position = partie.etat.joueurs[placeDeBob.joueur]?.position;
    bob.emit('deplacer', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    await laisserPasserLesMessages();
    horloge.avancerDe(CADENCE_BATTEMENT_MS * 4);
    await laisserPasserLesMessages();

    expect(tramesDeLAncienne).toEqual([]);
    expect(partie.etat.joueurs[placeDeBob.joueur]?.position).toEqual(position);
    expect(bob.connected).toBe(true);

    // Sa fermeture ne fait sortir personne.
    await couper(bob);
    expect(partie.estAbsent(placeDeBob.joueur)).toBe(false);
  });

  it('refuse a une connexion deja dans une partie de revenir dans une autre', async () => {
    const { bob, placeDeBob } = await aliceEtBobEnPartie();

    await couper(bob);
    const bobAilleurs = await connecterUnClient();
    await entrer(bobAilleurs, 'Bobby');

    expect(refus(await revenir(bobAilleurs, placeDeBob.jetonDeRetour)).champ).toBe('session');
  });

  it('refuse le retour dans une partie terminee pendant l absence', async () => {
    const { bob, idRoom, placeDeBob } = await aliceEtBobEnPartie(30);
    const partie = partieDe(idRoom);

    horloge.avancerDe(25_000);
    await couper(bob);
    horloge.avancerDe(6000);
    expect(partie.statut).toBe('terminee');

    const bobRevenu = await connecterUnClient();
    expect(refus(await revenir(bobRevenu, placeDeBob.jetonDeRetour))).toEqual({
      champ: 'partie',
      motif: "Cette partie n'est plus en cours.",
    });
  });

  it('un hote qui s absente passe la main a un joueur present, qui peut suspendre', async () => {
    const { alice, bob } = await aliceEtBobEnPartie();

    const salon = salonQui(
      bob,
      (infos) => infos.joueurs.find((joueur) => joueur.hote)?.pseudo === 'Bob',
    );
    await couper(alice);
    await salon;

    const pause = prochain(bob, 'partieEnPause');
    bob.emit('mettreEnPause');
    expect((await pause).parPseudo).toBe('Bob');
  });
});

describe('ce qui reste un depart immediat (etape 2.5)', () => {
  it('dans le salon, une deconnexion fait sortir aussitot, et le jeton ne rouvre rien', async () => {
    const alice = await connecterUnClient();
    const bob = await connecterUnClient();
    const { salon } = await entrer(alice, 'Alice');
    const { place } = await entrer(bob, 'Bob', salon.idRoom);

    const depart = prochain(alice, 'joueurParti');
    bob.disconnect();
    expect((await depart).pseudo).toBe('Bob');

    const bobRevenu = await connecterUnClient();
    expect(refus(await revenir(bobRevenu, place.jetonDeRetour)).champ).toBe('retour');
  });

  it('un depart volontaire en pleine partie rend la place aussitot', async () => {
    const { alice, bob, idRoom, placeDeBob } = await aliceEtBobEnPartie();

    const depart = prochain(alice, 'joueurParti');
    bob.emit('quitter');
    await depart;

    expect(partieDe(idRoom).etat.joueurs[placeDeBob.joueur]).toBeUndefined();
    expect(refus(await revenir(bob, placeDeBob.jetonDeRetour)).champ).toBe('retour');
  });

  it('la derniere expiration d une partie dont tout le monde est parti la ferme', async () => {
    const { alice, bob, idRoom } = await aliceEtBobEnPartie();

    await couper(alice);
    await couper(bob);
    expect(serveur.jeu.rooms.room(idRoom)).toBeDefined();

    horloge.avancerDe(DELAI_DE_RETOUR_MS);

    expect(serveur.jeu.rooms.room(idRoom)).toBeUndefined();
  });
});
