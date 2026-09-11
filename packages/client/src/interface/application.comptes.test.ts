// @vitest-environment jsdom
/**
 * Tests de l'application avec des comptes: l'en-tete, la connexion et l'accueil.
 *
 * Comme les tests de navigation, ils montent l'application entiere dans un document,
 * avec un vrai client relie au banc d'essai du transport, et ici a des comptes
 * d'essai. Ils verifient ce que le joueur voit: de quoi se connecter, son compte une
 * fois connecte, et un lien refuse dit a l'accueil.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import type { ApiComptesFactice } from '../comptes/api.js';
import { JETON_DESSAI, creerApiComptesFactice } from '../comptes/api.js';
import type { CoffreDeJeton } from '../comptes/coffre.js';
import { creerCoffreDeJeton } from '../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { Application } from './application.js';
import { monterApplication } from './application.js';
import {
  boutonNomme,
  boutonObligatoire,
  estCache,
  jeuDEssai,
  obligatoire,
  saisir,
  soumettre,
} from './essais.js';
import { AVIS_SESSION_EXPIREE } from './modeles/accueil.js';

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true, compte: { niveau: 1 } }],
  reglages: REGLAGES_PAR_DEFAUT,
};

let hote: HTMLElement;
let reseau: ReseauFactice;
let api: ApiComptesFactice;
let coffre: CoffreDeJeton;
let client: Client;
let application: Application;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** L'ecran affiche par l'application. */
function ecranAffiche(): string | undefined {
  return obligatoire(hote, '.application').dataset['ecran'];
}

beforeEach(() => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);

  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  coffre = creerCoffreDeJeton();
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });

  application = monterApplication({
    hote,
    client,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeuDEssai().monteur,
    recharger: () => undefined,
  });
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('l en-tete et la connexion', () => {
  it('mene un invite a l ecran de connexion, puis lui montre son compte', async () => {
    client.ouvrir();
    reseau.simulerConnexion('invite');

    const seConnecter = obligatoire(hote, '.entete-connexion');
    expect(estCache(seConnecter)).toBe(false);

    seConnecter.click();

    expect(ecranAffiche()).toBe('connexion');
    expect(obligatoire(hote, '.marque-ecran').textContent).toBe('Compte');
    // L'en-tete ne propose pas d'aller la ou l'on est deja.
    expect(estCache(seConnecter)).toBe(true);

    saisir(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]'), 'Alice');
    saisir(obligatoire<HTMLInputElement>(hote, 'input[name="mot-de-passe"]'), 'correct cheval');
    soumettre(obligatoire<HTMLFormElement>(hote, '.connexion-formulaire'));
    await laisserRepondre();

    expect(ecranAffiche()).toBe('accueil');
    expect(obligatoire(hote, '.carte-compte-pseudo').textContent).toBe('Alice');
    expect(obligatoire(hote, '.carte-compte-palier').textContent).toBe('Bronze');
    expect(estCache(obligatoire(hote, '.pastille-pieces'))).toBe(false);
    expect(reseau.ouvertures.at(-1)).toEqual({ jeton: JETON_DESSAI });
  });

  it('ne demande plus de pseudo a un compte, qui entre sans en envoyer', async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion('moi');

    expect(estCache(obligatoire(hote, '.champ-pseudo'))).toBe(true);
    expect(obligatoire(hote, '.accueil-compte').textContent).toBe(
      'Vous jouez avec votre compte, Alice.',
    );

    boutonObligatoire(hote, 'Jouer').click();

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({});
  });

  it('garde le compte dans l en-tete pendant la partie, sans y mener', async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion('moi');
    boutonObligatoire(hote, 'Jouer').click();
    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    const carte = obligatoire<HTMLButtonElement>(hote, '.carte-compte');

    expect(ecranAffiche()).toBe('salon');
    expect(estCache(carte)).toBe(false);
    expect(carte.disabled).toBe(true);
  });
});

describe('l accueil et la session', () => {
  it('dit qu un lien est refuse, et laisse reessayer ou continuer en invite', async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerRefus('Session invalide ou expirée. Reconnectez-vous.');

    expect(obligatoire(hote, '.accueil-lien').textContent).toBe(
      'Session invalide ou expirée. Reconnectez-vous.',
    );
    expect(boutonNomme(hote, 'Réessayer')).toBeDefined();
    expect(boutonNomme(hote, 'Recharger la page')).toBeUndefined();

    boutonObligatoire(hote, 'Continuer en invité').click();

    expect(reseau.ouvertures.at(-1)).toEqual({});
    expect(coffre.lire()).toBeUndefined();
    expect(boutonNomme(hote, 'Continuer en invité')).toBeUndefined();
    expect(estCache(obligatoire(hote, '.champ-pseudo'))).toBe(false);
  });

  it('annonce qu une session gardee a expire', async () => {
    coffre.garder(JETON_DESSAI);
    api.reponses.moi = async () => ({
      acceptee: false,
      statut: 401,
      erreurs: [{ champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' }],
    });

    client.ouvrir();
    await laisserRepondre();

    const avis = obligatoire(hote, '.accueil-avis');

    expect(estCache(avis)).toBe(false);
    expect(avis.textContent).toBe(AVIS_SESSION_EXPIREE);
  });
});
