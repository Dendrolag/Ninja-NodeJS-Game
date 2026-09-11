/**
 * Tests d'integration de la couche reseau, avec de vrais clients Socket.IO.
 *
 * Ce sont les tests que la fiche de l'etape 2.2 exige, et ils tournent contre un
 * vrai serveur qui ecoute sur un vrai port: rien n'est simule, sauf le TEMPS. Le
 * serveur recoit une horloge manuelle, si bien qu'un compte a rebours de cinq
 * secondes et une partie de trois minutes passent en quelques millisecondes.
 * C'est ce qui permet d'ecrire des tests de reseau qui restent rapides.
 *
 * ATTENTION EN LISANT CES TESTS: le temps du JEU est manuel, celui du RESEAU ne
 * l'est pas. Un message met un vrai aller-retour a arriver, donc chaque
 * verification passe par une attente explicite. Faire avancer l'horloge ne suffit
 * pas a avoir recu.
 *
 * Consequence a connaitre: les seaux a jetons se remplissent avec l'horloge
 * manuelle. Tant qu'un test ne la fait pas avancer, chaque connexion ne dispose
 * que de sa rafale de depart. C'est voulu, et c'est ce qui rend le test de
 * limitation de debit possible sans attendre une seconde reelle.
 */

import type {
  DemandeCreation,
  DemandeRejoindre,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  InstantanePartie,
  PartiePublique,
  ResultatValidation,
} from '@neon-ninja/shared';
import { BORNES_CODE_INVITATION, CAPACITES } from '@neon-ninja/shared';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

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
  serveur = await demarrerServeur(0, { horloge });

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

/** Collecte tous les messages de ce nom recus pendant l'appel. */
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

/** Demande a entrer dans une partie, et attend le verdict du serveur. */
async function rejoindre(
  client: ClientTypee,
  pseudo: string,
  idRoom?: string,
): Promise<ResultatValidation<InfosSalon>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande d'entree."));
    }, DELAI_ATTENTE_MS);

    client.emit(
      'rejoindre',
      idRoom === undefined ? { pseudo } : { pseudo, idRoom },
      (reponse: ResultatValidation<InfosSalon>) => {
        clearTimeout(minuterie);
        resoudre(reponse);
      },
    );
  });
}

/** Laisse le reseau acheminer ce qui est deja parti. */
async function laisserPasserLesMessages(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 30));
}

/** Fait entrer un client dans une partie et rend l'identifiant de celle-ci. */
async function entrer(client: ClientTypee, pseudo: string, idRoom?: string): Promise<string> {
  const reponse = await rejoindre(client, pseudo, idRoom);

  if (!reponse.valide) {
    throw new Error(`Entree refusee: ${reponse.erreurs.map((erreur) => erreur.motif).join(', ')}`);
  }

  return reponse.valeur.idRoom;
}

/** Lance la partie pour de bon: decompte complet, puis premier battement. */
async function lancerLaPartie(hote: ClientTypee): Promise<void> {
  const lancee = prochain(hote, 'partieLancee');

  hote.emit('demarrer');
  await laisserPasserLesMessages();

  horloge.avancerDe(5000);
  await lancee;
}

describe('entree en partie', () => {
  it('accepte un joueur et lui rend l etat du salon', async () => {
    const client = await connecterUnClient();

    const reponse = await rejoindre(client, 'Alice');

    expect(reponse.valide).toBe(true);
    if (!reponse.valide) {
      return;
    }

    expect(reponse.valeur.statut).toBe('salon');
    expect(reponse.valeur.joueurs).toEqual([
      { id: expect.any(String), pseudo: 'Alice', hote: true },
    ]);
    expect(reponse.valeur.reglages.carte).toBe('map1');
  });

  it('refuse un pseudo invalide sans creer quoi que ce soit', async () => {
    const client = await connecterUnClient();

    const reponse = await rejoindre(client, '   ');

    expect(reponse.valide).toBe(false);
    if (reponse.valide) {
      return;
    }

    expect(reponse.erreurs[0]?.champ).toBe('pseudo');
    expect(serveur.jeu.rooms.nombreDeRooms).toBe(0);
  });

  it('refuse le pseudo deja porte dans la meme partie, et l accepte dans une autre', async () => {
    const premier = await connecterUnClient();
    const second = await connecterUnClient();
    const troisieme = await connecterUnClient();

    const idRoom = await entrer(premier, 'Alice');
    const refusee = await rejoindre(second, 'alice', idRoom);

    expect(refusee.valide).toBe(false);

    const autre = serveur.jeu.ouvrirUneRoom();
    const acceptee = await rejoindre(troisieme, 'Alice', autre.id);

    expect(acceptee.valide).toBe(true);
  });

  it('refuse un identifiant de partie inconnu', async () => {
    const client = await connecterUnClient();

    const reponse = await rejoindre(client, 'Alice', 'room-inconnue');

    expect(reponse.valide).toBe(false);
    if (reponse.valide) {
      return;
    }

    expect(reponse.erreurs[0]?.champ).toBe('idRoom');
  });

  it('refuse une deuxieme entree pour la meme connexion', async () => {
    const client = await connecterUnClient();

    await entrer(client, 'Alice');
    const seconde = await rejoindre(client, 'Alice2');

    expect(seconde.valide).toBe(false);
    if (seconde.valide) {
      return;
    }

    expect(seconde.erreurs[0]?.champ).toBe('session');
  });

  it('previent les presents de l arrivee d un nouveau', async () => {
    const premier = await connecterUnClient();
    const second = await connecterUnClient();

    const idRoom = await entrer(premier, 'Alice');
    const arrivee = prochain(premier, 'joueurArrive');

    await entrer(second, 'Bob', idRoom);

    expect(await arrivee).toEqual({ id: expect.any(String), pseudo: 'Bob', hote: false });
  });

  it('bascule tout de suite vers le jeu celui qui rejoint une partie commencee', async () => {
    const hote = await connecterUnClient();
    const retardataire = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    const lancee = prochain(retardataire, 'partieLancee');
    await entrer(retardataire, 'Bob', idRoom);

    await expect(lancee).resolves.toBeUndefined();
  });
});

describe('flux d etat et notifications', () => {
  it('diffuse un instantane a chaque battement', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    const instantane = prochain(hote, 'etat');
    horloge.avancerDe(50);

    const recu = await instantane;

    expect(recu.tick).toBeGreaterThan(0);
    expect(recu.tempsRestantMs).toBeGreaterThan(0);
    expect(recu.entites.some((entite) => entite.type === 'joueur')).toBe(true);
    expect(recu.classement).toHaveLength(1);
  });

  it('deplace le joueur dans la direction demandee, et pas plus vite s il insiste', async () => {
    const bavard = await connecterUnClient();
    const discret = await connecterUnClient();

    const idRoom = await entrer(bavard, 'Bavard');
    await entrer(discret, 'Discret', idRoom);
    await lancerLaPartie(bavard);

    const room = serveur.jeu.rooms.room(idRoom);
    const departBavard = room?.etat.joueurs[bavard.id ?? '']?.position;
    const departDiscret = room?.etat.joueurs[discret.id ?? '']?.position;

    // Le bavard emet cinq fois, le discret une seule. Ils doivent parcourir la
    // meme distance: c'est la faille S2 du legacy, tenue a distance.
    for (let envoi = 0; envoi < 5; envoi += 1) {
      bavard.emit('deplacer', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    }
    discret.emit('deplacer', { deplacement: { x: 1, y: 0 }, enMouvement: true });

    await laisserPasserLesMessages();
    horloge.avancerDe(50);
    await laisserPasserLesMessages();

    const arriveeBavard = room?.etat.joueurs[bavard.id ?? '']?.position;
    const arriveeDiscret = room?.etat.joueurs[discret.id ?? '']?.position;

    const parcouruBavard = (arriveeBavard?.x ?? 0) - (departBavard?.x ?? 0);
    const parcouruDiscret = (arriveeDiscret?.x ?? 0) - (departDiscret?.x ?? 0);

    expect(parcouruBavard).toBeGreaterThan(0);
    expect(parcouruBavard).toBeCloseTo(parcouruDiscret, 6);
  });

  it('ignore une intention de deplacement mal formee sans rien casser', async () => {
    const hote = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    const room = serveur.jeu.rooms.room(idRoom);
    const depart = room?.etat.joueurs[hote.id ?? '']?.position;

    // Une coordonnee non finie empoisonnerait toutes les distances de la partie.
    hote.emit('deplacer', {
      deplacement: { x: Number.NaN, y: 0 },
      enMouvement: true,
    } as never);

    await laisserPasserLesMessages();
    horloge.avancerDe(50);
    await laisserPasserLesMessages();

    const arrivee = room?.etat.joueurs[hote.id ?? '']?.position;

    expect(Number.isFinite(arrivee?.x)).toBe(true);
    expect(arrivee?.x).toBe(depart?.x);
  });

  it('annonce la fin de la partie avec son classement', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    hote.emit('reglages', { dureePartieS: 30 });
    await laisserPasserLesMessages();

    await lancerLaPartie(hote);

    const fin = prochain(hote, 'partieTerminee');
    horloge.avancerDe(31_000);

    const recu = await fin;

    expect(recu.classement).toHaveLength(1);
    expect(recu.classement[0]?.pseudo).toBe('Alice');
  });

  it('cesse de diffuser une fois la partie finie', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    hote.emit('reglages', { dureePartieS: 30 });
    await laisserPasserLesMessages();
    await lancerLaPartie(hote);

    const fin = prochain(hote, 'partieTerminee');
    horloge.avancerDe(31_000);
    await fin;
    await laisserPasserLesMessages();

    const instantanes = collecter(hote, 'etat');
    horloge.avancerDe(5000);
    await laisserPasserLesMessages();

    expect(instantanes).toHaveLength(0);
  });
});

describe('isolation entre parties', () => {
  it('ne fait sortir aucun message d une partie vers une autre', async () => {
    const ici = await connecterUnClient();
    const ailleurs = await connecterUnClient();

    const premiere = serveur.jeu.ouvrirUneRoom();
    const seconde = serveur.jeu.ouvrirUneRoom();

    await entrer(ici, 'Alice', premiere.id);
    await entrer(ailleurs, 'Bob', seconde.id);

    const etatsAilleurs = collecter(ailleurs, 'etat');
    const salonsAilleurs = collecter(ailleurs, 'salon');
    const chatsAilleurs = collecter(ailleurs, 'chat');

    await lancerLaPartie(ici);
    ici.emit('chat', { texte: 'Bonjour' });

    horloge.avancerDe(200);
    await laisserPasserLesMessages();

    expect(etatsAilleurs).toHaveLength(0);
    expect(salonsAilleurs).toHaveLength(0);
    expect(chatsAilleurs).toHaveLength(0);
  });

  it('fait tourner deux parties cote a cote sans qu elles se voient', async () => {
    const ici = await connecterUnClient();
    const ailleurs = await connecterUnClient();

    const premiere = serveur.jeu.ouvrirUneRoom();
    const seconde = serveur.jeu.ouvrirUneRoom();

    await entrer(ici, 'Alice', premiere.id);
    await entrer(ailleurs, 'Bob', seconde.id);

    await lancerLaPartie(ici);

    expect(premiere.statut).toBe('enCours');
    expect(seconde.statut).toBe('salon');
  });
});

describe('chat', () => {
  it('diffuse le message a la partie, signe par la session', async () => {
    const premier = await connecterUnClient();
    const second = await connecterUnClient();

    const idRoom = await entrer(premier, 'Alice');
    await entrer(second, 'Bob', idRoom);

    const recu = prochain(second, 'chat');
    premier.emit('chat', { texte: 'Bonjour' });

    expect(await recu).toEqual({ auteur: premier.id, pseudo: 'Alice', texte: 'Bonjour' });
  });

  it('ignore le pseudo que le message pretend porter', async () => {
    const premier = await connecterUnClient();
    const second = await connecterUnClient();

    const idRoom = await entrer(premier, 'Alice');
    await entrer(second, 'Bob', idRoom);

    const recu = prochain(second, 'chat');
    // C'est la faille S3 du legacy: il rediffusait ce champ tel quel.
    premier.emit('chat', { texte: 'Coucou', pseudo: 'Bob' } as never);

    expect((await recu).pseudo).toBe('Alice');
  });

  it('refuse un message vide en l expliquant a son auteur', async () => {
    const client = await connecterUnClient();

    await entrer(client, 'Alice');

    const refus = prochain(client, 'refus');
    client.emit('chat', { texte: '   ' });

    const recu = await refus;

    expect(recu.action).toBe('chat');
    expect(recu.erreurs[0]?.champ).toBe('message.texte');
  });

  it('refuse un debit de chat excessif', async () => {
    const client = await connecterUnClient();

    await entrer(client, 'Alice');

    const refus = prochain(client, 'refus');

    // La rafale de chat vaut cinq jetons, et l'horloge manuelle n'avance pas:
    // le sixieme message se presente donc devant un seau vide.
    for (let envoi = 0; envoi < 6; envoi += 1) {
      client.emit('chat', { texte: `message ${String(envoi)}` });
    }

    expect((await refus).action).toBe('chat');
  });
});

describe('reglages et autorite de l hote', () => {
  it('laisse l hote changer les reglages et les rediffuse a la partie', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await entrer(invite, 'Bob', idRoom);

    const salon = prochain(invite, 'salon');
    hote.emit('reglages', { dureePartieS: 120, nombreBotsInitial: 42 });

    const recu = await salon;

    expect(recu.reglages.dureePartieS).toBe(120);
    expect(recu.reglages.nombreBotsInitial).toBe(42);
    expect(recu.joueurs).toHaveLength(2);
  });

  it('refuse a un invite de changer les reglages', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await entrer(invite, 'Bob', idRoom);

    const refus = prochain(invite, 'refus');
    invite.emit('reglages', { dureePartieS: 120 });

    const recu = await refus;

    expect(recu.action).toBe('reglages');
    expect(recu.erreurs[0]?.champ).toBe('hote');
  });

  it('refuse un reglage hors bornes en nommant le champ fautif', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');

    const refus = prochain(hote, 'refus');
    hote.emit('reglages', { dureePartieS: 99_999 });

    const recu = await refus;

    expect(recu.action).toBe('reglages');
    expect(recu.erreurs[0]?.champ).toBe('dureePartieS');
  });

  it('garde les joueurs en place quand les reglages changent', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await entrer(invite, 'Bob', idRoom);

    hote.emit('reglages', { carte: 'map3' });
    await laisserPasserLesMessages();

    const room = serveur.jeu.rooms.room(idRoom);

    expect(room?.joueurs.map((joueur) => joueur.pseudo)).toEqual(['Alice', 'Bob']);
    expect(room?.reglages.carte).toBe('map3');
    expect(room?.etat.carte.largeur).toBe(3000);
  });

  it('refuse de changer les reglages une fois la partie commencee', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    const refus = prochain(hote, 'refus');
    hote.emit('reglages', { dureePartieS: 120 });

    expect((await refus).erreurs[0]?.champ).toBe('reglages');
  });
});

describe('compte a rebours de demarrage', () => {
  it('annonce la sequence complete a toute la partie', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await entrer(invite, 'Bob', idRoom);

    const annonces = collecter(invite, 'compteARebours');
    const lancee = prochain(invite, 'partieLancee');

    hote.emit('demarrer');
    await laisserPasserLesMessages();
    horloge.avancerDe(5000);
    await lancee;

    expect(annonces).toEqual([
      { secondesRestantes: 5, annulable: true },
      { secondesRestantes: 4, annulable: true },
      { secondesRestantes: 3, annulable: true },
      { secondesRestantes: 2, annulable: false },
      { secondesRestantes: 1, annulable: false },
      { secondesRestantes: 0, annulable: false },
    ]);
  });

  it('laisse l hote annuler tant qu il reste plus de deux secondes', async () => {
    const hote = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');

    const annule = prochain(hote, 'demarrageAnnule');
    hote.emit('demarrer');
    await laisserPasserLesMessages();

    horloge.avancerDe(2000);
    hote.emit('annulerDemarrage');
    await annule;

    horloge.avancerDe(10_000);
    await laisserPasserLesMessages();

    expect(serveur.jeu.rooms.room(idRoom)?.statut).toBe('salon');
  });

  it('refuse l annulation passe le seuil, et la partie part quand meme', async () => {
    const hote = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');

    const lancee = prochain(hote, 'partieLancee');
    hote.emit('demarrer');
    await laisserPasserLesMessages();

    horloge.avancerDe(3000);
    const refus = prochain(hote, 'refus');
    hote.emit('annulerDemarrage');

    expect((await refus).action).toBe('annulerDemarrage');

    horloge.avancerDe(2000);
    await lancee;

    expect(serveur.jeu.rooms.room(idRoom)?.statut).toBe('enCours');
  });

  it('refuse a un invite de lancer la partie', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await entrer(invite, 'Bob', idRoom);

    const refus = prochain(invite, 'refus');
    invite.emit('demarrer');

    const recu = await refus;

    expect(recu.action).toBe('demarrer');
    expect(recu.erreurs[0]?.champ).toBe('hote');
    expect(serveur.jeu.rooms.room(idRoom)?.statut).toBe('salon');
  });
});

describe('sortie et deconnexion', () => {
  it('retire le joueur et previent les autres', async () => {
    const premier = await connecterUnClient();
    const second = await connecterUnClient();

    const idRoom = await entrer(premier, 'Alice');
    await entrer(second, 'Bob', idRoom);

    const depart = prochain(second, 'joueurParti');
    premier.emit('quitter');

    expect(await depart).toMatchObject({ pseudo: 'Alice', hote: true });

    const room = serveur.jeu.rooms.room(idRoom);

    expect(room?.joueurs.map((joueur) => joueur.pseudo)).toEqual(['Bob']);
  });

  it('transfere la propriete du salon au plus ancien des restants', async () => {
    const premier = await connecterUnClient();
    const second = await connecterUnClient();

    const idRoom = await entrer(premier, 'Alice');
    await entrer(second, 'Bob', idRoom);

    const salon = prochain(second, 'salon');
    premier.emit('quitter');

    expect((await salon).joueurs).toEqual([{ id: second.id, pseudo: 'Bob', hote: true }]);
  });

  it('detruit la partie quand son dernier joueur se deconnecte', async () => {
    const client = await connecterUnClient();

    const idRoom = await entrer(client, 'Alice');

    expect(serveur.jeu.rooms.room(idRoom)).toBeDefined();

    client.disconnect();
    await laisserPasserLesMessages();

    expect(serveur.jeu.rooms.room(idRoom)).toBeUndefined();
    expect(serveur.jeu.rooms.nombreDeRooms).toBe(0);
  });

  it('arrete le decompte quand la partie se vide', async () => {
    const client = await connecterUnClient();

    const idRoom = await entrer(client, 'Alice');
    client.emit('demarrer');
    await laisserPasserLesMessages();

    client.disconnect();
    await laisserPasserLesMessages();

    // Sans arret du decompte, ce saut ferait partir une partie sans personne.
    expect(() => {
      horloge.avancerDe(10_000);
    }).not.toThrow();
    expect(serveur.jeu.rooms.room(idRoom)).toBeUndefined();
  });

  it('laisse la partie vivante tant qu il reste quelqu un', async () => {
    const premier = await connecterUnClient();
    const second = await connecterUnClient();

    const idRoom = await entrer(premier, 'Alice');
    await entrer(second, 'Bob', idRoom);

    premier.disconnect();
    await laisserPasserLesMessages();

    expect(serveur.jeu.rooms.room(idRoom)).toBeDefined();
  });

  it('ne fait rien quand une connexion hors partie demande a sortir', async () => {
    const client = await connecterUnClient();

    client.emit('quitter');
    await laisserPasserLesMessages();

    expect(serveur.jeu.rooms.nombreDeRooms).toBe(0);
  });
});

describe('extinction', () => {
  it('ferme toutes les parties et arrete tout ce qui bat', async () => {
    const client = await connecterUnClient();

    await entrer(client, 'Alice');
    await lancerLaPartie(client);

    serveur.jeu.fermer();

    expect(serveur.jeu.rooms.nombreDeRooms).toBe(0);

    // Plus rien ne doit repartir quand le temps passe.
    expect(() => {
      horloge.avancerDe(60_000);
    }).not.toThrow();
  });
});

describe('contrats typés', () => {
  it('rejette a la compilation une charge utile non conforme', async () => {
    const client = await connecterUnClient();

    // Ces lignes ne s'executent pas: ce test verifie qu'elles ne COMPILENT pas.
    // Si l'une d'elles devenait valide, @ts-expect-error deviendrait lui-meme une
    // erreur et « pnpm typecheck » echouerait. C'est la prevention de regression
    // que l'etape 2.2 devait poser: le contrat se verifie tout seul, a chaque
    // compilation, sans que personne ait a y penser.
    const jamais = false;
    if (jamais) {
      // @ts-expect-error un evenement qui n'existe pas dans le contrat
      client.emit('teleporter', { x: 0, y: 0 });

      // @ts-expect-error le deplacement attend un vecteur, pas un nombre
      client.emit('deplacer', { deplacement: 3, enMouvement: true });

      // @ts-expect-error l'indicateur de mouvement est obligatoire
      client.emit('deplacer', { deplacement: { x: 1, y: 0 } });

      // @ts-expect-error un message de chat n'a pas de champ pseudo: la session le signe
      client.emit('chat', { texte: 'Bonjour', pseudo: 'quelqu un d autre' });

      // @ts-expect-error un pseudo est du texte. Il peut manquer depuis l'etape 3.2
      // (un compte entre sous le sien), mais jamais etre d'un autre type.
      client.emit('rejoindre', { pseudo: 42 }, () => undefined);

      // @ts-expect-error un reglage inconnu du contrat
      client.emit('reglages', { vitesseDuJoueur: 999 });
    }

    expect(client.connected).toBe(true);
  });

  it('donne au flux d etat la forme que l etape 2.3 convertira en binaire', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    const instantane = prochain(hote, 'etat');
    horloge.avancerDe(50);

    // Le type est verifie a la compilation; la forme reelle l'est ici.
    const recu: InstantanePartie = await instantane;

    expect(Object.keys(recu).sort()).toEqual([
      'classement',
      'enPause',
      'entites',
      'objets',
      'tempsRestantMs',
      'tick',
      'zones',
    ]);
  });
});

describe('pause de la partie', () => {
  it('suspend la partie a la demande de l hote et previent tout le monde', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await entrer(invite, 'Bob', idRoom);
    await lancerLaPartie(hote);

    const chezLHote = prochain(hote, 'partieEnPause');
    const chezLInvite = prochain(invite, 'partieEnPause');

    hote.emit('mettreEnPause');

    expect(await chezLHote).toEqual({ parPseudo: 'Alice' });
    expect(await chezLInvite).toEqual({ parPseudo: 'Alice' });
  });

  it('porte la suspension dans le flux d etat, pour qui n a pas vu l annonce', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    hote.emit('mettreEnPause');
    await laisserPasserLesMessages();

    const instantane = prochain(hote, 'etat');
    horloge.avancerDe(50);

    expect((await instantane).enPause).toBe(true);
  });

  it('arrete le temps de jeu sans arreter la diffusion', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    hote.emit('reglages', { dureePartieS: 30 });
    await laisserPasserLesMessages();
    await lancerLaPartie(hote);

    hote.emit('mettreEnPause');
    await laisserPasserLesMessages();

    const etats = collecter(hote, 'etat');
    horloge.avancerDe(10_000);
    await laisserPasserLesMessages();

    // Le battement continue, donc des instantanes arrivent; le temps restant,
    // lui, n'a pas bouge d'une milliseconde.
    expect(etats.length).toBeGreaterThan(0);
    expect(new Set(etats.map((etat) => etat.tempsRestantMs)).size).toBe(1);
  });

  it('empeche une partie suspendue de se terminer, et la laisse finir apres la reprise', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    hote.emit('reglages', { dureePartieS: 30 });
    await laisserPasserLesMessages();
    await lancerLaPartie(hote);

    const fins = collecter(hote, 'partieTerminee');

    hote.emit('mettreEnPause');
    await laisserPasserLesMessages();
    horloge.avancerDe(60_000);
    await laisserPasserLesMessages();

    expect(fins).toHaveLength(0);

    const fin = prochain(hote, 'partieTerminee');

    hote.emit('reprendre');
    await laisserPasserLesMessages();
    horloge.avancerDe(31_000);

    await fin;
  });

  it('annonce la reprise', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    hote.emit('mettreEnPause');
    await laisserPasserLesMessages();

    const reprise = prochain(hote, 'partieReprise');

    hote.emit('reprendre');
    await reprise;
  });

  it('refuse la demande a qui n est pas l hote, sans toucher a la partie', async () => {
    // Le legacy laissait n'importe qui suspendre la partie de tous les autres,
    // et reservait la reprise a celui qui l'avait suspendue. Ici la pause suit
    // la meme autorite que les reglages et le lancement.
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const idRoom = await entrer(hote, 'Alice');
    await entrer(invite, 'Bob', idRoom);
    await lancerLaPartie(hote);

    const refuse = prochain(invite, 'refus');

    invite.emit('mettreEnPause');
    const recu = await refuse;

    expect(recu.action).toBe('mettreEnPause');
    expect(recu.erreurs[0]?.champ).toBe('hote');
    expect(serveur.jeu.rooms.room(idRoom)?.enPause).toBe(false);
  });

  it('refuse la demande tant que la partie n a pas commence', async () => {
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');

    const refuse = prochain(hote, 'refus');

    hote.emit('mettreEnPause');
    const recu = await refuse;

    expect(recu.action).toBe('mettreEnPause');
    expect(recu.erreurs[0]?.champ).toBe('partie');
  });

  it('ne rediffuse rien quand la demande ne change rien', async () => {
    // Sans cette porte, un client qui reemet sa demande ferait clignoter le
    // bandeau de tous les autres.
    const hote = await connecterUnClient();

    await entrer(hote, 'Alice');
    await lancerLaPartie(hote);

    const annonces = collecter(hote, 'partieEnPause');

    hote.emit('mettreEnPause');
    await laisserPasserLesMessages();
    hote.emit('mettreEnPause');
    await laisserPasserLesMessages();

    expect(annonces).toHaveLength(1);
  });

  it('ne franchit pas la frontiere d une partie vers une autre', async () => {
    const hote = await connecterUnClient();
    const voisin = await connecterUnClient();

    await entrer(hote, 'Alice');
    await entrer(voisin, 'Bob', serveur.jeu.ouvrirUneRoom().id);
    await lancerLaPartie(hote);

    const annonces = collecter(voisin, 'partieEnPause');

    hote.emit('mettreEnPause');
    await laisserPasserLesMessages();

    expect(annonces).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// Parties publiques et privees (etape 2.4)
// --------------------------------------------------------------------------

/** Attend l'accuse de reception d'une demande, ou echoue si le serveur ne repond pas. */
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

/** Demande a entrer avec une demande complete: code, identifiant, ou rien. */
async function rejoindreAvec(
  client: ClientTypee,
  demande: DemandeRejoindre,
): Promise<ResultatValidation<InfosSalon>> {
  return attendreAccuse((accuse) => {
    client.emit('rejoindre', demande, accuse);
  });
}

/** Demande a creer une partie. */
async function creer(
  client: ClientTypee,
  demande: DemandeCreation,
): Promise<ResultatValidation<InfosSalon>> {
  return attendreAccuse((accuse) => {
    client.emit('creerPartie', demande, accuse);
  });
}

/** Demande la liste des parties publiques ouvertes. */
async function lister(client: ClientTypee): Promise<readonly PartiePublique[]> {
  return attendreAccuse((accuse) => {
    client.emit('listerParties', accuse);
  });
}

/** Le salon d'une reponse acceptee, ou un echec de test explicite. */
function salonAccepte(reponse: ResultatValidation<InfosSalon>): InfosSalon {
  if (!reponse.valide) {
    throw new Error(`Refus inattendu: ${reponse.erreurs.map((erreur) => erreur.motif).join(', ')}`);
  }

  return reponse.valeur;
}

/** Les champs refuses d'une reponse, ou un echec de test explicite. */
function champsDuRefus(reponse: ResultatValidation<InfosSalon>): readonly string[] {
  if (reponse.valide) {
    throw new Error('Acceptation inattendue.');
  }

  return reponse.erreurs.map((erreur) => erreur.champ);
}

/** Une partie privee aux reglages par defaut. */
const PARTIE_PRIVEE: DemandeCreation['configuration'] = { mode: 'classique', visibilite: 'privee' };

/** Une partie publique aux reglages par defaut. */
const PARTIE_PUBLIQUE: DemandeCreation['configuration'] = {
  mode: 'classique',
  visibilite: 'publique',
};

describe('parties privees', () => {
  it('cree une partie privee avec un code, et la fait rejoindre par ce code', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const salon = salonAccepte(
      await creer(hote, { pseudo: 'Alice', configuration: PARTIE_PRIVEE }),
    );

    expect(salon.visibilite).toBe('privee');
    expect(salon.code).toMatch(BORNES_CODE_INVITATION.forme);
    expect(salon.joueurs).toEqual([{ id: expect.any(String), pseudo: 'Alice', hote: true }]);

    // Un code se tape souvent en minuscules, avec des espaces autour.
    const saisi = ` ${(salon.code ?? '').toLowerCase()} `;
    const rejoint = salonAccepte(await rejoindreAvec(invite, { pseudo: 'Bob', code: saisi }));

    expect(rejoint.idRoom).toBe(salon.idRoom);
    expect(rejoint.joueurs.map((joueur) => joueur.pseudo)).toEqual(['Alice', 'Bob']);
  });

  it('refuse un code inconnu ou mal forme, en nommant le code', async () => {
    const hote = await connecterUnClient();
    const curieux = await connecterUnClient();

    await creer(hote, { pseudo: 'Alice', configuration: PARTIE_PRIVEE });

    expect(champsDuRefus(await rejoindreAvec(curieux, { pseudo: 'Eve', code: 'ZZZZZZ' }))).toEqual([
      'code',
    ]);
    expect(champsDuRefus(await rejoindreAvec(curieux, { pseudo: 'Eve', code: 'abc' }))).toEqual([
      'code',
    ]);
  });

  it('ne se rejoint pas par son identifiant, et repond comme pour une partie inexistante', async () => {
    const hote = await connecterUnClient();
    const curieux = await connecterUnClient();

    const salon = salonAccepte(
      await creer(hote, { pseudo: 'Alice', configuration: PARTIE_PRIVEE }),
    );

    const parIdentifiant = await rejoindre(curieux, 'Eve', salon.idRoom);
    const inexistante = await rejoindre(curieux, 'Eve', 'room-inconnue');

    expect(champsDuRefus(parIdentifiant)).toEqual(['idRoom']);
    expect(parIdentifiant).toEqual(inexistante);
  });

  it('n apparait ni dans la liste ni dans la partie rapide', async () => {
    const hote = await connecterUnClient();
    const passant = await connecterUnClient();

    const privee = salonAccepte(
      await creer(hote, { pseudo: 'Alice', configuration: PARTIE_PRIVEE }),
    );

    expect(await lister(passant)).toEqual([]);

    const rapide = salonAccepte(await rejoindreAvec(passant, { pseudo: 'Bob' }));

    expect(rapide.idRoom).not.toBe(privee.idRoom);
    expect(rapide.visibilite).toBe('publique');
  });

  it('reserve le lancement a l hote, et diffuse ses reglages aux membres sans perdre le code', async () => {
    const hote = await connecterUnClient();
    const invite = await connecterUnClient();

    const salon = salonAccepte(
      await creer(hote, { pseudo: 'Alice', configuration: PARTIE_PRIVEE }),
    );
    salonAccepte(await rejoindreAvec(invite, { pseudo: 'Bob', code: salon.code ?? '' }));
    await laisserPasserLesMessages();

    const refusAuLancement = prochain(invite, 'refus');
    invite.emit('demarrer');

    expect((await refusAuLancement).erreurs[0]?.champ).toBe('hote');

    const salonMisAJour = prochain(invite, 'salon');
    hote.emit('reglages', { carte: 'map2' });

    expect(await salonMisAJour).toMatchObject({
      code: salon.code,
      visibilite: 'privee',
      reglages: { carte: 'map2' },
    });
  });
});

describe('parties publiques', () => {
  it('cree une partie publique, la montre dans la liste, et la fait rejoindre depuis la liste', async () => {
    const hote = await connecterUnClient();
    const passant = await connecterUnClient();

    const salon = salonAccepte(
      await creer(hote, {
        pseudo: 'Alice',
        configuration: { ...PARTIE_PUBLIQUE, reglages: { carte: 'map2' } },
      }),
    );

    expect(salon).not.toHaveProperty('code');

    const liste = await lister(passant);

    expect(liste).toEqual([
      {
        idRoom: salon.idRoom,
        hote: 'Alice',
        mode: 'classique',
        carte: 'map2',
        modeMiroir: false,
        joueurs: 1,
        capacite: CAPACITES.classique,
      },
    ]);

    const rejoint = salonAccepte(await rejoindre(passant, 'Bob', liste[0]?.idRoom));

    expect(rejoint.idRoom).toBe(salon.idRoom);
    expect((await lister(passant))[0]?.joueurs).toBe(2);
  });

  it('retire de la liste une partie lancee', async () => {
    const hote = await connecterUnClient();
    const passant = await connecterUnClient();

    await creer(hote, { pseudo: 'Alice', configuration: PARTIE_PUBLIQUE });
    await lancerLaPartie(hote);

    expect(await lister(passant)).toEqual([]);
  });

  it('refuse le joueur de trop, et ne montre plus une partie pleine', async () => {
    const hote = await connecterUnClient();
    const salon = salonAccepte(
      await creer(hote, { pseudo: 'Hote', configuration: PARTIE_PUBLIQUE }),
    );

    for (let rang = 1; rang < CAPACITES.classique; rang += 1) {
      const joueur = await connecterUnClient();
      salonAccepte(await rejoindre(joueur, `Joueur ${String(rang)}`, salon.idRoom));
    }

    const retardataire = await connecterUnClient();

    expect(await rejoindre(retardataire, 'Tard', salon.idRoom)).toEqual({
      valide: false,
      erreurs: [{ champ: 'partie', motif: 'Cette partie est complète.' }],
    });
    expect(await lister(retardataire)).toEqual([]);

    // La partie rapide ne l'envoie pas non plus dans la partie pleine.
    const rapide = salonAccepte(await rejoindreAvec(retardataire, { pseudo: 'Tard' }));

    expect(rapide.idRoom).not.toBe(salon.idRoom);
  });
});

describe('creation de partie refusee', () => {
  it('refuse une configuration aberrante sans rien creer', async () => {
    const client = await connecterUnClient();

    const tropLongue = await creer(client, {
      pseudo: 'Alice',
      configuration: { ...PARTIE_PUBLIQUE, reglages: { dureePartieS: 5000 } },
    });

    // Un client modifie peut envoyer un mode que le contrat ne connait pas.
    const modeInconnu = {
      pseudo: 'Alice',
      configuration: { mode: 'chasse', visibilite: 'publique' },
    } as unknown as DemandeCreation;

    expect(champsDuRefus(tropLongue)).toEqual(['dureePartieS']);
    expect(champsDuRefus(await creer(client, modeInconnu))).toEqual(['configuration.mode']);
    expect(serveur.jeu.rooms.nombreDeRooms).toBe(0);
  });

  it('refuse de creer depuis une connexion deja entree dans une partie', async () => {
    const client = await connecterUnClient();

    await creer(client, { pseudo: 'Alice', configuration: PARTIE_PUBLIQUE });

    expect(
      champsDuRefus(await creer(client, { pseudo: 'Alice', configuration: PARTIE_PRIVEE })),
    ).toEqual(['session']);
    expect(serveur.jeu.rooms.nombreDeRooms).toBe(1);
  });
});
