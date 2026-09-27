// @vitest-environment jsdom
/**
 * Tests des amis en direct dans un document (etape 2.8).
 *
 * L'application entiere est montee, avec un client de compte, des comptes d'essai et
 * le banc d'essai du reseau: l'ecran Amis montre la presence et rejoint la partie
 * publique d'un ami. Les cartes d'invitation se montrent sur les menus, pas au salon,
 * rejoignent et s'ignorent. Le salon invite un ami en ligne. La fiche d'un ami dit ou
 * il est.
 */

import type { InfosSalon, ListeDAmis } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import type { ApiComptesFactice } from '../comptes/api.js';
import { JETON_DESSAI, creerApiComptesFactice, ficheDEssai } from '../comptes/api.js';
import { creerCoffreDeJeton } from '../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { Application } from './application.js';
import { monterApplication } from './application.js';
import { boutonNomme, boutonObligatoire, estCache, jeuDEssai, obligatoire } from './essais.js';

const LISTE: ListeDAmis = {
  amis: [
    { pseudo: 'Alice', niveau: 4 },
    { pseudo: 'Carole', niveau: 2 },
    { pseudo: 'David', niveau: 7 },
  ],
  recues: [],
  envoyees: [],
  bloques: [],
};

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'privee',
  code: 'NX7K2P',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Bob', hote: true, compte: { niveau: 1 } }],
  reglages: REGLAGES_PAR_DEFAUT,
};

let hote: HTMLElement;
let reseau: ReseauFactice;
let api: ApiComptesFactice;
let client: Client;
let application: Application;

async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

function ecranAffiche(): string | undefined {
  return obligatoire(hote, '.application').dataset['ecran'];
}

/** La region des cartes d'invitation. */
function cartes(): HTMLElement {
  return obligatoire(hote, '.invitations-d-amis');
}

/** Entre dans le salon, sous le compte. */
function entrerAuSalon(): void {
  reseau.recevoir('placeAttribuee', { joueur: 'moi', jetonDeRetour: 'M'.repeat(43) });
  client.rejoindre(undefined);
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
}

beforeEach(async () => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  api.reponses.amis = async () => ({ acceptee: true, valeur: LISTE });

  const coffre = creerCoffreDeJeton();
  coffre.garder(JETON_DESSAI);
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
  application = monterApplication({
    hote,
    client,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeuDEssai().monteur,
    recharger: () => undefined,
  });

  client.ouvrir();
  await laisserRepondre();
  reseau.simulerConnexion();
  await laisserRepondre();
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('l ecran Amis, en direct', () => {
  beforeEach(async () => {
    reseau.recevoir('presenceDesAmis', [
      { pseudo: 'David', lieu: { etat: 'enLigne' } },
      {
        pseudo: 'Carole',
        lieu: {
          etat: 'salon',
          partie: {
            visibilite: 'publique',
            idRoom: 'room-7',
            mode: 'classique',
            joueurs: 2,
            capacite: 12,
          },
        },
      },
    ]);
    client.naviguer('amis');
    await laisserRepondre();
  });

  it('montre ou est chaque ami, les plus joignables d abord', () => {
    const lignes = [...hote.querySelectorAll('.amis-amis .ligne-ami')];

    expect(lignes.map((ligne) => ligne.querySelector('.ligne-ami-pseudo')?.textContent)).toEqual([
      'Carole',
      'David',
      'Alice',
    ]);
    expect(lignes.map((ligne) => ligne.querySelector('.ligne-ami-presence')?.textContent)).toEqual([
      'Dans un salon · Horde · 2 sur 12',
      'En ligne',
      'Hors ligne',
    ]);
    expect(
      obligatoire(lignes[0] ?? hote, '.ligne-ami-presence').getAttribute('data-presence'),
    ).toBe('salon');
  });

  it('rejoint le salon public d un ami d un clic', () => {
    boutonObligatoire(obligatoire(hote, '.amis-amis'), 'Rejoindre').click();

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ idRoom: 'room-7' });
  });

  it('dit pourquoi le salon d un ami n a pas pu etre rejoint', () => {
    boutonObligatoire(obligatoire(hote, '.amis-amis'), 'Rejoindre').click();
    reseau.dernier('rejoindre')?.[1]({
      valide: false,
      erreurs: [{ champ: 'capacite', motif: 'Cette partie est complète.' }],
    });

    expect(obligatoire(hote, '.amis-erreur').textContent).toBe('Cette partie est complète.');
    expect(estCache(obligatoire(hote, '.amis-erreur'))).toBe(false);
  });

  it('suit la presence poussee, sans naviguer', () => {
    reseau.recevoir('presenceDesAmis', []);

    expect(
      [...hote.querySelectorAll('.amis-amis .ligne-ami-presence')].map(
        (element) => element.textContent,
      ),
    ).toEqual(['Hors ligne', 'Hors ligne', 'Hors ligne']);
    expect(boutonNomme(obligatoire(hote, '.amis-amis'), 'Rejoindre')).toBeUndefined();
  });
});

describe('les cartes d invitation', () => {
  beforeEach(() => {
    reseau.recevoir('invitationRecue', {
      id: 'i'.repeat(43),
      de: 'Alice',
      mode: 'classique',
      visibilite: 'privee',
      joueurs: 2,
      capacite: 12,
    });
  });

  it('se montrent sur les menus, et rejoignent par l invitation', () => {
    expect(estCache(cartes())).toBe(false);
    expect(obligatoire(cartes(), '.invitation-titre').textContent).toBe('Alice vous invite');
    expect(obligatoire(cartes(), '.invitation-detail').textContent).toBe(
      'Horde · partie privée · 2 sur 12',
    );

    boutonObligatoire(cartes(), 'Rejoindre').click();
    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ invitation: 'i'.repeat(43) });

    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
    expect(ecranAffiche()).toBe('salon');
    expect(estCache(cartes())).toBe(true);
  });

  it('disent le refus sur la carte, et pas sous le formulaire de l accueil', () => {
    boutonObligatoire(cartes(), 'Rejoindre').click();
    reseau.dernier('rejoindre')?.[1]({
      valide: false,
      erreurs: [{ champ: 'invitation', motif: 'Cette invitation n’est plus valable.' }],
    });

    expect(obligatoire(cartes(), '.invitation-erreur').textContent).toBe(
      'Cette invitation n’est plus valable.',
    );
    expect(hote.querySelector('.ecran-accueil')?.textContent).not.toContain(
      'Cette invitation n’est plus valable.',
    );
  });

  it('s ignorent, et disparaissent quand le serveur les retire', () => {
    reseau.recevoir('invitationRecue', {
      id: 'j'.repeat(43),
      de: 'Carole',
      mode: 'classique',
      visibilite: 'publique',
      joueurs: 1,
      capacite: 12,
    });
    expect(cartes().querySelectorAll('.invitation-d-ami')).toHaveLength(2);

    boutonObligatoire(obligatoire(cartes(), '[data-invitation^="j"]'), 'Ignorer').click();
    reseau.recevoir('invitationRetiree', { id: 'i'.repeat(43) });

    expect(cartes().querySelectorAll('.invitation-d-ami')).toHaveLength(0);
    expect(estCache(cartes())).toBe(true);
  });

  it('attendent pendant une partie, et reviennent aux menus', () => {
    entrerAuSalon();
    expect(estCache(cartes())).toBe(true);

    boutonObligatoire(hote, 'Quitter le salon').click();
    expect(estCache(cartes())).toBe(false);
  });
});

describe('le salon invite les amis en ligne', () => {
  beforeEach(() => {
    reseau.recevoir('presenceDesAmis', [
      { pseudo: 'Alice', lieu: { etat: 'enLigne' } },
      { pseudo: 'Carole', lieu: { etat: 'enPartie', partie: { visibilite: 'privee' } } },
    ]);
    entrerAuSalon();
  });

  it('liste les amis en ligne, et invite celui qu on choisit', () => {
    const section = obligatoire(hote, '.salon-amis');

    expect(estCache(section)).toBe(false);
    expect(
      [...section.querySelectorAll('.salon-ami-pseudo')].map((element) => element.textContent),
    ).toEqual(['Alice', 'Carole']);

    boutonObligatoire(section, 'Inviter Alice').click();
    expect(reseau.dernier('inviter')?.[0]).toEqual({ pseudo: 'Alice' });
    expect(boutonObligatoire(section, 'Inviter Alice').disabled).toBe(true);

    reseau.dernier('inviter')?.[1]({ valide: true, valeur: { pseudo: 'Alice' } });
    expect(obligatoire(section, '.salon-ami-note').textContent).toBe('Invitation envoyée.');
    expect(boutonObligatoire(section, 'Réinviter Alice').disabled).toBe(false);
  });

  it('dit pourquoi une invitation est refusee', () => {
    const section = obligatoire(hote, '.salon-amis');

    boutonObligatoire(section, 'Inviter Carole').click();
    reseau.dernier('inviter')?.[1]({
      valide: false,
      erreurs: [{ champ: 'pseudo', motif: 'Carole n’est pas en ligne.' }],
    });

    expect(obligatoire(section, '.salon-ami-refus').textContent).toBe('Carole n’est pas en ligne.');
  });

  it('retire de la liste un ami qui arrive dans la partie', () => {
    reseau.recevoir('salon', {
      ...SALON,
      joueurs: [
        ...SALON.joueurs,
        { id: 'alice', pseudo: 'Alice', hote: false, compte: { niveau: 4 } },
      ],
    });

    expect(
      [...obligatoire(hote, '.salon-amis').querySelectorAll('.salon-ami-pseudo')].map(
        (element) => element.textContent,
      ),
    ).toEqual(['Carole']);
  });
});

describe('la fiche d un ami', () => {
  it('dit ou il est', async () => {
    api.reponses.joueur = async () => ({
      acceptee: true,
      valeur: { ...ficheDEssai('Alice'), relation: 'ami' },
    });
    reseau.recevoir('presenceDesAmis', [{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);

    client.ouvrirLaFiche('Alice');
    await laisserRepondre();

    const presence = obligatoire(hote, '.fiche-presence');
    expect(presence.textContent).toBe('En ligne');
    expect(presence.dataset['presence']).toBe('enLigne');
    expect(estCache(presence)).toBe(false);
  });

  it('ne le dit pas d un compte qui n est pas ami', async () => {
    api.reponses.joueur = async () => ({ acceptee: true, valeur: ficheDEssai('Zoe') });

    client.ouvrirLaFiche('Zoe');
    await laisserRepondre();

    expect(estCache(obligatoire(hote, '.fiche-presence'))).toBe(true);
  });
});
