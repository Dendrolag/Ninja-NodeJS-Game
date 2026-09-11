// @vitest-environment jsdom
/**
 * Tests de la navigation laterale et des passages entre les ecrans de menu.
 *
 * Le test de navigation exige par la fiche de la reprise des ecrans du jalon 3:
 * l'accueil, les parties, la creation, le profil et la connexion s'atteignent par la
 * navigation; aucun ecran de menu ne s'atteint pendant une partie; et le pseudo d'un
 * invite le suit d'un ecran a l'autre.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { Application } from './application.js';
import { monterApplication } from './application.js';
import { boutonObligatoire, estCache, jeuDEssai, obligatoire, saisir } from './essais.js';

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true }],
  reglages: REGLAGES_PAR_DEFAUT,
};

let hote: HTMLElement;
let reseau: ReseauFactice;
let client: Client;
let application: Application;

/** L'ecran affiche par l'application. */
function ecranAffiche(): string | undefined {
  return obligatoire(hote, '.application').dataset['ecran'];
}

/** La navigation laterale. */
function navigation(): HTMLElement {
  return obligatoire(hote, '.navigation');
}

/** Le libelle de l'entree marquee comme courante. */
function entreeCourante(): string | null | undefined {
  return navigation().querySelector('[aria-current="page"]')?.textContent;
}

beforeEach(() => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);

  reseau = creerReseauFactice();
  client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
  application = monterApplication({
    hote,
    client,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeuDEssai().monteur,
    recharger: () => undefined,
  });
  reseau.simulerConnexion('moi');
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('la navigation laterale', () => {
  it('est proposee a l accueil, et marque l ecran affiche', () => {
    expect(estCache(navigation())).toBe(false);
    expect(obligatoire(hote, '.application').dataset['menu']).toBe('true');
    expect(entreeCourante()).toBe('Jouer');
  });

  it('mene a chaque ecran de menu', () => {
    boutonObligatoire(navigation(), 'Parties').click();
    expect([ecranAffiche(), entreeCourante()]).toEqual(['parties', 'Parties']);
    expect(reseau.dernier('listerParties')).toBeDefined();

    boutonObligatoire(navigation(), 'Créer').click();
    expect([ecranAffiche(), entreeCourante()]).toEqual(['creation', 'Créer']);

    boutonObligatoire(navigation(), 'Jouer').click();
    expect([ecranAffiche(), entreeCourante()]).toEqual(['accueil', 'Jouer']);
  });

  it('mene un invite du profil a l ecran de connexion', () => {
    boutonObligatoire(navigation(), 'Profil').click();

    expect([ecranAffiche(), entreeCourante()]).toEqual(['connexion', 'Profil']);
  });

  it('disparait pendant une partie, pour qu aucun clic ne la fasse quitter', () => {
    saisir(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]'), 'Alice');
    boutonObligatoire(hote, 'Partie rapide').click();
    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    expect(ecranAffiche()).toBe('salon');
    expect(estCache(navigation())).toBe(true);
    expect(obligatoire(hote, '.application').dataset['menu']).toBe('false');

    client.naviguer('parties');

    expect(ecranAffiche()).toBe('salon');
  });

  it('garde le pseudo d un invite d un ecran a l autre', () => {
    saisir(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]'), 'Alice');

    boutonObligatoire(navigation(), 'Parties').click();
    expect(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]').value).toBe('Alice');

    boutonObligatoire(navigation(), 'Créer').click();
    expect(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]').value).toBe('Alice');
  });

  it('efface un refus d entree en changeant d ecran', () => {
    saisir(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]'), 'Alice');
    boutonObligatoire(hote, 'Partie rapide').click();
    reseau.dernier('rejoindre')?.[1]({
      valide: false,
      erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris dans cette partie.' }],
    });

    boutonObligatoire(navigation(), 'Parties').click();

    expect(estCache(obligatoire(hote, '.parties-erreur'))).toBe(true);
  });
});
