/**
 * Tests de la lecture de la fiche d'un joueur par la session du client (etape 3.5).
 *
 * Ce qu'ils protegent: la fiche ne se lit que pour un compte, avec son jeton; une
 * lecture en cours ne repart pas; une reponse arrivee apres un changement de session
 * est ignoree; et une session que le serveur ne reconnait plus ne fait pas quitter une
 * partie, mais se traite, hors partie, comme a la lecture du profil.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { ApiComptesFactice } from './api.js';
import { JETON_DESSAI, creerApiComptesFactice, ficheDEssai } from './api.js';
import type { CoffreDeJeton } from './coffre.js';
import { creerCoffreDeJeton } from './coffre.js';

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [
    { id: 'moi', pseudo: 'Alice', hote: true, compte: { niveau: 1 } },
    { id: 'bob', pseudo: 'Bob', hote: false, compte: { niveau: 3 } },
  ],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Le refus d'une session que le serveur ne reconnait plus. */
const SESSION_EXPIREE = {
  acceptee: false as const,
  statut: 401,
  erreurs: [{ champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' }],
};

let reseau: ReseauFactice;
let api: ApiComptesFactice;
let coffre: CoffreDeJeton;
let client: Client;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Les requetes de fiche faites aux comptes, dans l'ordre. */
function lectures(): unknown[] {
  return api.appels.filter((appel) => appel.nom === 'joueur').map((appel) => appel.argument);
}

/** Entre dans le salon, sous le compte. */
function entrerAuSalon(): void {
  reseau.recevoir('placeAttribuee', { joueur: 'moi', jetonDeRetour: 'M'.repeat(43) });
  client.rejoindre(undefined);
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
}

beforeEach(() => {
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  coffre = creerCoffreDeJeton();
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
});

describe('la fiche d un joueur, pour un compte', () => {
  beforeEach(async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion();
  });

  it('se lit avec le jeton de la session, et arrive dans l etat', async () => {
    entrerAuSalon();

    client.ouvrirLaFiche('Bob');

    expect(client.etat.fiche).toEqual({ statut: 'chargement', pseudo: 'Bob' });
    expect(lectures()).toEqual([{ jeton: JETON_DESSAI, pseudo: 'Bob' }]);

    await laisserRepondre();

    expect(client.etat.fiche).toEqual({
      statut: 'chargee',
      pseudo: 'Bob',
      fiche: ficheDEssai('Bob'),
    });
  });

  it('ne repart pas pendant que la meme fiche se lit, mais lit une autre fiche aussitot', () => {
    api.reponses.joueur = () => new Promise(() => undefined);
    entrerAuSalon();

    client.ouvrirLaFiche('Bob');
    client.ouvrirLaFiche('Bob');
    client.ouvrirLaFiche('Alice');

    expect(lectures()).toEqual([
      { jeton: JETON_DESSAI, pseudo: 'Bob' },
      { jeton: JETON_DESSAI, pseudo: 'Alice' },
    ]);
    expect(client.etat.fiche).toEqual({ statut: 'chargement', pseudo: 'Alice' });
  });

  it('dit le motif du serveur quand la fiche est refusee', async () => {
    api.reponses.joueur = async () => ({
      acceptee: false,
      statut: 404,
      erreurs: [{ champ: 'pseudo', motif: 'Aucun compte ne porte ce pseudo.' }],
    });
    entrerAuSalon();

    client.ouvrirLaFiche('Bob');
    await laisserRepondre();

    expect(client.etat.fiche).toEqual({
      statut: 'echec',
      pseudo: 'Bob',
      motif: 'Aucun compte ne porte ce pseudo.',
    });
  });

  it('ne fait pas quitter le salon pour une session expiree: la fiche le dit', async () => {
    api.reponses.joueur = async () => SESSION_EXPIREE;
    entrerAuSalon();

    client.ouvrirLaFiche('Bob');
    await laisserRepondre();

    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.session.nature).toBe('compte');
    expect(client.etat.fiche).toMatchObject({ statut: 'echec', pseudo: 'Bob' });
  });

  it('ramene en invite, hors partie, pour une session expiree', async () => {
    api.reponses.joueur = async () => SESSION_EXPIREE;

    client.ouvrirLaFiche('Bob');
    await laisserRepondre();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
    expect(client.etat.fiche).toEqual({ statut: 'fermee' });
  });

  it('ignore une reponse arrivee apres un changement de session', async () => {
    let repondre: (() => void) | undefined;
    api.reponses.joueur = (_jeton, pseudo) =>
      new Promise((resoudre) => {
        repondre = () => {
          resoudre({ acceptee: true, valeur: ficheDEssai(pseudo) });
        };
      });

    client.ouvrirLaFiche('Bob');
    client.seDeconnecter();
    repondre?.();
    await laisserRepondre();

    expect(client.etat.fiche).toEqual({ statut: 'fermee' });
  });

  it('se ferme sur demande', async () => {
    entrerAuSalon();
    client.ouvrirLaFiche('Bob');
    await laisserRepondre();

    client.fermerLaFiche();

    expect(client.etat.fiche).toEqual({ statut: 'fermee' });
  });
});

describe('la fiche d un joueur, pour un invite', () => {
  it('ne s ouvre pas, et rien ne part au serveur', () => {
    client.ouvrir();
    reseau.simulerConnexion();

    client.ouvrirLaFiche('Bob');

    expect(client.etat.fiche).toEqual({ statut: 'fermee' });
    expect(lectures()).toEqual([]);
  });
});

describe('la fiche d un joueur, sans comptes joignables', () => {
  it('ne s ouvre pas: la session n y devient jamais celle d un compte', () => {
    coffre.garder(JETON_DESSAI);
    client = creerClient({ reseau, coffre, horloge: creerHorlogeClientManuelle() });
    client.ouvrir();
    reseau.simulerConnexion();
    // Sans requetes des comptes, la session gardee reste en verification: le serveur de
    // jeu l'a acceptee, mais la page ne peut pas lire la progression.
    expect(client.etat.session.nature).toBe('verification');

    client.ouvrirLaFiche('Bob');

    expect(client.etat.fiche).toEqual({ statut: 'fermee' });
  });
});
