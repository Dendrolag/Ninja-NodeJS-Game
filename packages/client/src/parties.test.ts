/**
 * Tests du cablage de l'etape 2.4 dans le client.
 *
 * Creer une partie, entrer dans une partie precise par son code ou par la liste,
 * et lister les parties publiques. Le transport est le banc d'essai: ces tests
 * verifient ce que le client envoie et ce qu'il fait de la reponse, pas le
 * serveur, joue dans packages/server et dans tests/client/integration.
 */

import type { InfosSalon, PartiePublique } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from './client.js';
import { creerClient } from './client.js';
import { ETAT_INITIAL } from './etat.js';
import { reduire } from './reduction.js';
import type { ReseauFactice } from './reseau.js';
import { creerReseauFactice } from './reseau.js';

/** Le salon d'une partie privee que nous venons de creer. */
const SALON_PRIVE: InfosSalon = {
  idRoom: 'room-3',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'privee',
  code: 'NX7K2P',
  capacite: 12,
  joueurs: [{ id: 'session-de-test', pseudo: 'Alice', hote: true }],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Une partie publique, telle que la liste la montre. */
const PARTIE: PartiePublique = {
  idRoom: 'room-1',
  hote: 'Bob',
  mode: 'classique',
  carte: 'map2',
  modeMiroir: false,
  joueurs: 3,
  capacite: 12,
};

let reseau: ReseauFactice;
let client: Client;

beforeEach(() => {
  reseau = creerReseauFactice();
  client = creerClient({ reseau });
  reseau.simulerConnexion();
});

describe('creer une partie', () => {
  it('envoie le pseudo et la configuration, et attend la reponse', () => {
    client.creerPartie('Alice', { mode: 'classique', visibilite: 'privee' });

    expect(reseau.dernier('creerPartie')?.[0]).toEqual({
      pseudo: 'Alice',
      configuration: { mode: 'classique', visibilite: 'privee' },
    });
    expect(client.etat.entreeEnCours).toBe(true);
  });

  it('entre dans le salon de la partie creee, code compris', () => {
    client.creerPartie('Alice', { mode: 'classique', visibilite: 'privee' });
    reseau.dernier('creerPartie')?.[1]({ valide: true, valeur: SALON_PRIVE });

    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.salon?.code).toBe('NX7K2P');
    expect(client.etat.entreeEnCours).toBe(false);
  });

  it('retient qu un refus repond a la creation, et reste a l accueil', () => {
    const erreurs = [{ champ: 'dureePartieS', motif: 'Trop long.' }];

    client.creerPartie('Alice', { mode: 'classique', visibilite: 'publique' });
    reseau.dernier('creerPartie')?.[1]({ valide: false, erreurs });

    expect(client.etat.refus).toEqual({ action: 'creerPartie', erreurs });
    expect(client.etat.ecran).toBe('accueil');
  });
});

describe('rejoindre une partie precise', () => {
  it('par son code d invitation', () => {
    client.rejoindre('Bob', { code: 'NX7K2P' });

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Bob', code: 'NX7K2P' });
  });

  it('par son identifiant, choisi dans la liste', () => {
    client.rejoindre('Bob', { idRoom: 'room-1' });

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Bob', idRoom: 'room-1' });
  });

  it('sans rien: la partie rapide ne porte que le pseudo', () => {
    client.rejoindre('Bob');

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Bob' });
  });

  it('retient qu un refus repond a une entree', () => {
    const erreurs = [{ champ: 'code', motif: 'Aucune partie ne correspond à ce code.' }];

    client.rejoindre('Bob', { code: 'ZZZZZZ' });
    reseau.dernier('rejoindre')?.[1]({ valide: false, erreurs });

    expect(client.etat.refus).toEqual({ action: 'rejoindre', erreurs });
  });
});

describe('lister les parties publiques', () => {
  it('demande la liste au serveur et la range dans l etat', () => {
    client.listerParties();
    reseau.dernier('listerParties')?.[0]([PARTIE]);

    expect(client.etat.partiesPubliques).toEqual([PARTIE]);
  });

  it('remplace la liste precedente, meme par une liste vide', () => {
    const avecUnePartie = reduire(ETAT_INITIAL, { type: 'partiesListees', parties: [PARTIE] });
    const videe = reduire(avecUnePartie, { type: 'partiesListees', parties: [] });

    expect(videe.partiesPubliques).toEqual([]);
  });

  it('part vide, et se vide quand la connexion tombe', () => {
    const avecUnePartie = reduire(ETAT_INITIAL, { type: 'partiesListees', parties: [PARTIE] });

    expect(ETAT_INITIAL.partiesPubliques).toEqual([]);
    expect(reduire(avecUnePartie, { type: 'connexionPerdue' }).partiesPubliques).toEqual([]);
  });
});
