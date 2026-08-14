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
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  InstantanePartie,
  ResultatValidation,
} from '@neon-ninja/shared';
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

      // @ts-expect-error une entree en partie sans pseudo n'a pas de sens
      client.emit('rejoindre', {}, () => undefined);

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
      'entites',
      'objets',
      'tempsRestantMs',
      'tick',
      'zones',
    ]);
  });
});
