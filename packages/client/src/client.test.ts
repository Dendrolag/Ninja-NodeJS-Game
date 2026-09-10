/**
 * Tests du cablage entre le transport et le magasin.
 *
 * Ils utilisent le banc d'essai de reseau.ts: le test delivre les messages
 * lui-meme, ce qui permet de verifier des situations qu'un vrai serveur ne
 * produirait qu'au prix d'une mise en scene compliquee. Ce que ces tests
 * verifient, c'est que CHAQUE evenement du contrat est branche et qu'il aboutit
 * au bon endroit de l'etat: un evenement recu que personne n'ecoute est un
 * silence qu'on ne remarquerait qu'en jouant.
 *
 * Le va-et-vient avec un vrai serveur, lui, est verifie par
 * tests/client/integration/client-serveur.test.ts.
 */

import type { InfosSalon, InstantanePartie, ResultatValidation } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from './client.js';
import { creerClient } from './client.js';
import type { HorlogeClientManuelle } from './horloge.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import type { ReseauFactice } from './reseau.js';
import { creerReseauFactice } from './reseau.js';

let reseau: ReseauFactice;
let horloge: HorlogeClientManuelle;
let client: Client;

/** Un salon minimal. */
function salon(modifications: Partial<InfosSalon> = {}): InfosSalon {
  return {
    idRoom: 'partie-1',
    statut: 'salon',
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [{ id: 'session-de-test', pseudo: 'Alice', hote: true }],
    reglages: REGLAGES_PAR_DEFAUT,
    ...modifications,
  };
}

/** Un instantane minimal. */
function instantane(modifications: Partial<InstantanePartie> = {}): InstantanePartie {
  return {
    tick: 1,
    tempsRestantMs: 180_000,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement: [],
    ...modifications,
  };
}

/**
 * Repond a la demande d'entree que le client vient d'emettre.
 *
 * L'accuse de reception est le deuxieme argument du message rejoindre: le banc
 * d'essai le retient, le test l'appelle quand il veut.
 */
function repondreALEntree(reponse: ResultatValidation<InfosSalon>): void {
  const demande = reseau.dernier('rejoindre');

  if (demande === undefined) {
    throw new Error("Le client n'a demande a entrer nulle part.");
  }

  demande[1](reponse);
}

/** Amene le client jusqu'au debut d'une partie. */
function entrerEtLancer(): void {
  reseau.simulerConnexion();
  client.rejoindre('Alice');
  repondreALEntree({ valide: true, valeur: salon() });
  reseau.recevoir('partieLancee');
}

beforeEach(() => {
  reseau = creerReseauFactice();
  horloge = creerHorlogeClientManuelle();
  client = creerClient({ reseau, horloge });
});

describe('le lien', () => {
  it('enregistre la connexion et l identifiant recu', () => {
    reseau.simulerConnexion('session-42');

    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.moi).toBe('session-42');
  });

  it('enregistre la perte du lien', () => {
    reseau.simulerConnexion();
    reseau.simulerDeconnexion();

    expect(client.etat.connexion).toBe('perdue');
    expect(client.etat.ecran).toBe('accueil');
  });
});

describe('les commandes du joueur', () => {
  it('emet la demande d entree avec le pseudo saisi', () => {
    reseau.simulerConnexion();
    client.rejoindre('Alice');

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ pseudo: 'Alice' });
    expect(client.etat.pseudoDemande).toBe('Alice');
  });

  it('joint l identifiant de partie seulement quand il y en a un', () => {
    reseau.simulerConnexion();
    client.rejoindre('Alice', { idRoom: 'partie-7' });

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ pseudo: 'Alice', idRoom: 'partie-7' });
  });

  it('entre dans le salon quand le serveur accepte', () => {
    reseau.simulerConnexion();
    client.rejoindre('Alice');
    repondreALEntree({ valide: true, valeur: salon() });

    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.salon?.idRoom).toBe('partie-1');
  });

  it('reste a l accueil et montre le motif quand le serveur refuse', () => {
    reseau.simulerConnexion();
    client.rejoindre('Alice');
    repondreALEntree({
      valide: false,
      erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris dans cette partie.' }],
    });

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.refus?.action).toBe('rejoindre');
  });

  it('emet chaque commande sur son evenement de contrat', () => {
    entrerEtLancer();

    client.deplacer({ deplacement: { x: 1, y: 0 }, enMouvement: true });
    client.parler('salut');
    client.changerReglages({ dureePartieS: 120 });
    client.demarrer();
    client.annulerDemarrage();
    client.mettreEnPause();
    client.reprendre();
    client.quitter();

    expect(reseau.emis.map((message) => message.nom)).toEqual([
      'rejoindre',
      'deplacer',
      'chat',
      'reglages',
      'demarrer',
      'annulerDemarrage',
      'mettreEnPause',
      'reprendre',
      'quitter',
    ]);
    expect(reseau.dernier('deplacer')?.[0]).toEqual({
      deplacement: { x: 1, y: 0 },
      enMouvement: true,
    });
    expect(reseau.dernier('chat')?.[0]).toEqual({ texte: 'salut' });
  });

  it('envoie l intention telle que le joueur la demande, sans jamais l inverser', () => {
    // Piege connu: le malus de controles inverses est applique par le MOTEUR
    // depuis l'etape 1.4. L'appliquer aussi ici l'annulerait.
    entrerEtLancer();
    reseau.recevoir('malusSubi', {
      nature: 'controlesInverses',
      dureeMs: 5000,
      parPseudo: 'Bob',
    });

    client.deplacer({ deplacement: { x: 0, y: -1 }, enMouvement: true });

    expect(reseau.dernier('deplacer')?.[0]).toEqual({
      deplacement: { x: 0, y: -1 },
      enMouvement: true,
    });
  });

  it('revient a l accueil quand le joueur quitte', () => {
    entrerEtLancer();
    client.quitter();

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.salon).toBeUndefined();
  });
});

describe('les messages du serveur', () => {
  it('suit le salon, les arrivees et les departs', () => {
    reseau.simulerConnexion();
    client.rejoindre('Alice');
    repondreALEntree({ valide: true, valeur: salon() });

    reseau.recevoir('joueurArrive', { id: 'autre', pseudo: 'Bob', hote: false });
    reseau.recevoir('salon', {
      ...salon(),
      joueurs: [
        { id: 'session-de-test', pseudo: 'Alice', hote: true },
        { id: 'autre', pseudo: 'Bob', hote: false },
      ],
    });
    reseau.recevoir('joueurParti', { id: 'autre', pseudo: 'Bob', hote: false });

    expect(client.etat.salon?.joueurs).toHaveLength(2);
    expect(client.etat.journal.map((entree) => entree.nature)).toEqual([
      'joueurArrive',
      'joueurParti',
    ]);
  });

  it('date les messages de chat sur l horloge locale', () => {
    entrerEtLancer();
    horloge.avancerDe(500);
    reseau.recevoir('chat', { auteur: 'autre', pseudo: 'Bob', texte: 'salut' });

    expect(client.etat.messages[0]?.recuA).toBe(1500);
  });

  it('suit le compte a rebours et son annulation', () => {
    reseau.simulerConnexion();
    client.rejoindre('Alice');
    repondreALEntree({ valide: true, valeur: salon() });

    reseau.recevoir('compteARebours', { secondesRestantes: 5, annulable: true });
    expect(client.etat.compteARebours?.secondesRestantes).toBe(5);

    reseau.recevoir('demarrageAnnule');
    expect(client.etat.compteARebours).toBeUndefined();
  });

  it('reconstruit l etat de la partie a partir du flux', () => {
    entrerEtLancer();
    reseau.recevoir('etat', instantane({ tick: 1, tempsRestantMs: 180_000 }));
    reseau.recevoir('etat', instantane({ tick: 2, tempsRestantMs: 179_500 }));

    expect(client.etat.ecran).toBe('jeu');
    expect(client.etat.partie?.tick).toBe(2);
    expect(client.etat.partie?.tempsRestantMs).toBe(179_500);
  });

  it('suit la pause et la reprise', () => {
    entrerEtLancer();
    reseau.recevoir('partieEnPause', { parPseudo: 'Alice' });
    reseau.recevoir('etat', instantane({ tick: 4, enPause: true }));

    expect(client.etat.pausePar).toBe('Alice');
    expect(client.etat.partie?.enPause).toBe(true);

    reseau.recevoir('partieReprise');
    expect(client.etat.pausePar).toBeUndefined();
  });

  it('branche les sept notifications adressees', () => {
    entrerEtLancer();

    reseau.recevoir('captureSubie', {
      parPseudo: 'Bob',
      nouvelleCouleur: '#00FF00',
      botsPerdus: 4,
    });
    reseau.recevoir('captureReussie', { victimePseudo: 'Bob', botsGagnes: 4, capturesTotal: 1 });
    reseau.recevoir('captureParBotNoir', { botsPerdus: 2 });
    reseau.recevoir('botNoirDetruit', { points: 15, x: 10, y: 20 });
    reseau.recevoir('bonusActive', { nature: 'vitesse', dureeMs: 10_000 });
    reseau.recevoir('malusRamasse', { nature: 'flou', dureeMs: 5000 });
    reseau.recevoir('malusSubi', { nature: 'negatif', dureeMs: 5000, parPseudo: 'Bob' });

    expect(client.etat.journal.map((entree) => entree.nature)).toEqual([
      'captureSubie',
      'captureReussie',
      'captureParBotNoir',
      'botNoirDetruit',
      'bonusActive',
      'malusRamasse',
      'malusSubi',
    ]);
    // Trois d'entre elles portent un effet a afficher.
    expect(client.etat.effets).toHaveLength(3);
  });

  it('garde le classement definitif quand la partie se termine', () => {
    entrerEtLancer();
    reseau.recevoir('partieTerminee', {
      classement: [
        {
          id: 'session-de-test',
          pseudo: 'Alice',
          couleur: '#FF0000',
          points: 30,
          botsPortes: 27,
          pointsBotsNoirs: 3,
          captures: 2,
          botsNoirsDetruits: 1,
        },
      ],
    });

    expect(client.etat.ecran).toBe('fin');
    expect(client.etat.fin?.classement).toHaveLength(1);
  });

  it('garde le dernier refus', () => {
    entrerEtLancer();
    reseau.recevoir('refus', {
      action: 'chat',
      erreurs: [{ champ: 'chat', motif: 'Trop de messages. Ralentissez.' }],
    });

    expect(client.etat.refus?.action).toBe('chat');
  });
});

describe('fermeture', () => {
  it('retire toutes les ecoutes', () => {
    entrerEtLancer();
    client.fermer();

    reseau.recevoir('etat', instantane({ tick: 99 }));

    // Le banc d'essai a bien delivre le message; plus personne ne l'ecoutait.
    expect(client.etat.partie).toBeUndefined();
    expect(reseau.connecte).toBe(false);
  });

  it('laisse deux clients cohabiter sans se voir', () => {
    const autreReseau = creerReseauFactice();
    const autre = creerClient({ reseau: autreReseau, horloge });

    reseau.simulerConnexion('un');
    autreReseau.simulerConnexion('deux');

    expect(client.etat.moi).toBe('un');
    expect(autre.etat.moi).toBe('deux');
  });
});

describe('abonnement', () => {
  it('previent l abonne a chaque changement d etat', () => {
    let appels = 0;
    const desabonner = client.abonner(() => (appels += 1));

    reseau.simulerConnexion();
    client.rejoindre('Alice');

    expect(appels).toBeGreaterThan(0);

    const avant = appels;
    desabonner();
    reseau.recevoir('partieLancee');

    expect(appels).toBe(avant);
  });
});
