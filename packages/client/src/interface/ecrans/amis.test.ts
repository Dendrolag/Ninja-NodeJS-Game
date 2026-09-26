// @vitest-environment jsdom
/**
 * Tests de l'ecran Amis, dans un document (etape 3.6).
 *
 * L'application entiere est montee, avec un client de compte et des comptes d'essai:
 * l'ecran s'ouvre par la navigation, dont l'entree porte la pastille des demandes
 * recues; il ajoute par pseudo, repond aux demandes, annule, debloque, et ouvre la
 * fiche d'un joueur d'un clic sur son pseudo.
 */

import type { ListeDAmis } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { ApiComptesFactice } from '../../comptes/api.js';
import { JETON_DESSAI, LISTE_D_AMIS_VIDE, creerApiComptesFactice } from '../../comptes/api.js';
import { creerCoffreDeJeton } from '../../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import type { Application } from '../application.js';
import { monterApplication } from '../application.js';
import { boutonObligatoire, estCache, jeuDEssai, obligatoire, saisir } from '../essais.js';

/** Carole attend une reponse, Bob est un ami, David attend celle qu'on lui a demandee. */
const LISTE: ListeDAmis = {
  amis: [{ pseudo: 'Bob', niveau: 4 }],
  recues: [{ pseudo: 'Carole', niveau: 2 }],
  envoyees: [{ pseudo: 'David', niveau: 7 }],
  bloques: [{ pseudo: 'Eve', niveau: 1 }],
};

let hote: HTMLElement;
let reseau: ReseauFactice;
let api: ApiComptesFactice;
let client: Client;
let application: Application;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** L'ecran affiche. */
function ecranAffiche(): string | undefined {
  return obligatoire(hote, '.application').dataset['ecran'];
}

/** La navigation laterale. */
function navigation(): HTMLElement {
  return obligatoire(hote, '.navigation');
}

/** Les pseudos d'une section de l'ecran. */
function pseudos(section: string): string[] {
  return [...obligatoire(hote, `.${section}`).querySelectorAll('.ligne-ami-pseudo')].map(
    (element) => element.textContent,
  );
}

/** Monte l'application, pour un compte ou pour un invite. */
async function monter(avecUnCompte: boolean): Promise<void> {
  const coffre = creerCoffreDeJeton();

  if (avecUnCompte) {
    coffre.garder(JETON_DESSAI);
  }

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
}

beforeEach(() => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  api.reponses.amis = async () => ({ acceptee: true, valeur: LISTE });
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('la navigation vers les amis', () => {
  it('porte la pastille des demandes recues, et mene a l ecran', async () => {
    await monter(true);

    const entree = boutonObligatoire(navigation(), 'Amis, 1 demande reçue');
    expect(obligatoire(entree, '.navigation-pastille').textContent).toBe('1');
    expect(estCache(obligatoire(entree, '.navigation-pastille'))).toBe(false);

    entree.click();
    await laisserRepondre();

    expect(ecranAffiche()).toBe('amis');
    expect(obligatoire(hote, '.ecran-amis .sous-titre-ecran').textContent).toBe('1 sur 200 amis');
  });

  it('mene un invite a la connexion, sans pastille', async () => {
    await monter(false);

    expect(estCache(obligatoire(navigation(), '.navigation-pastille'))).toBe(true);
    boutonObligatoire(navigation(), 'Amis').click();

    expect(ecranAffiche()).toBe('connexion');
    expect(api.appels.filter((appel) => appel.nom === 'amis')).toEqual([]);
  });
});

describe('l ecran Amis', () => {
  beforeEach(async () => {
    await monter(true);
    boutonObligatoire(navigation(), 'Amis, 1 demande reçue').click();
    await laisserRepondre();
  });

  it('range les demandes recues, les amis, les demandes envoyees et les blocages', () => {
    expect(pseudos('amis-recues')).toEqual(['Carole']);
    expect(pseudos('amis-amis')).toEqual(['Bob']);
    expect(pseudos('amis-envoyees')).toEqual(['David']);
    expect(pseudos('amis-bloques')).toEqual(['Eve']);
    expect(obligatoire(hote, '.amis-recues .ligne-ami-niveau').textContent).toBe('Niv. 2');
    expect(boutonObligatoire(obligatoire(hote, '.amis-recues'), 'Accepter')).toBeDefined();
    expect(
      boutonObligatoire(obligatoire(hote, '.amis-envoyees'), 'Annuler la demande'),
    ).toBeDefined();
    expect(boutonObligatoire(obligatoire(hote, '.amis-bloques'), 'Débloquer')).toBeDefined();
  });

  it('envoie une demande par pseudo, l annonce, et vide le champ', async () => {
    api.reponses.gesteDAmitie = async () => ({
      acceptee: true,
      valeur: {
        pseudo: 'Léa B.',
        relation: 'demandeEnvoyee',
        amis: { ...LISTE, envoyees: [...LISTE.envoyees, { pseudo: 'Léa B.', niveau: 3 }] },
      },
    });
    const champ = obligatoire<HTMLInputElement>(hote, 'input[name="ami"]');

    saisir(champ, '  Léa B.  ');
    obligatoire<HTMLFormElement>(hote, '.amis-ajout').requestSubmit();

    expect(api.appels.at(-1)).toEqual({
      nom: 'gesteDAmitie',
      argument: { jeton: JETON_DESSAI, demande: { geste: 'demander', pseudo: 'Léa B.' } },
    });
    expect(boutonObligatoire(hote, 'Envoyer la demande').disabled).toBe(true);

    await laisserRepondre();

    expect(obligatoire(hote, '.amis-annonce').textContent).toBe(
      'Votre demande à Léa B. est envoyée.',
    );
    expect(champ.value).toBe('');
    expect(pseudos('amis-envoyees')).toEqual(['David', 'Léa B.']);
  });

  it('dit pourquoi une demande est refusee, et garde la saisie', async () => {
    api.reponses.gesteDAmitie = async () => ({
      acceptee: false,
      statut: 404,
      erreurs: [{ champ: 'pseudo', motif: 'Aucun compte ne porte ce pseudo.' }],
    });
    const champ = obligatoire<HTMLInputElement>(hote, 'input[name="ami"]');

    saisir(champ, 'Personne');
    obligatoire<HTMLFormElement>(hote, '.amis-ajout').requestSubmit();
    await laisserRepondre();

    expect(obligatoire(hote, '.amis-erreur').textContent).toBe('Aucun compte ne porte ce pseudo.');
    expect(estCache(obligatoire(hote, '.amis-erreur'))).toBe(false);
    expect(champ.value).toBe('Personne');
    expect(champ.hasAttribute('aria-invalid')).toBe(true);
  });

  it('accepte une demande recue, et la pastille s eteint', async () => {
    api.reponses.gesteDAmitie = async () => ({
      acceptee: true,
      valeur: {
        pseudo: 'Carole',
        relation: 'ami',
        amis: { ...LISTE, recues: [], amis: [...LISTE.amis, { pseudo: 'Carole', niveau: 2 }] },
      },
    });

    boutonObligatoire(obligatoire(hote, '.amis-recues'), 'Accepter').click();
    await laisserRepondre();

    expect(api.appels.at(-1)?.argument).toEqual({
      jeton: JETON_DESSAI,
      demande: { geste: 'accepter', pseudo: 'Carole' },
    });
    expect(obligatoire(hote, '.amis-annonce').textContent).toBe('Carole et vous êtes amis.');
    expect(pseudos('amis-amis')).toEqual(['Bob', 'Carole']);
    expect(estCache(obligatoire(hote, '.amis-recues'))).toBe(true);
    expect(estCache(obligatoire(navigation(), '.navigation-pastille'))).toBe(true);
  });

  it('ouvre la fiche d un joueur d un clic sur son pseudo', async () => {
    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();

    expect(estCache(obligatoire(hote, '.fenetre-fiche'))).toBe(false);
    expect(obligatoire(hote, '.fiche-pseudo').textContent).toBe('Bob');
  });

  it('dit qu il n y a encore aucun ami, et cache les sections vides', async () => {
    api.reponses.amis = async () => ({ acceptee: true, valeur: LISTE_D_AMIS_VIDE });
    client.chargerLesAmis();
    await laisserRepondre();

    expect(estCache(obligatoire(hote, '.amis-amis .amis-vide'))).toBe(false);
    expect(estCache(obligatoire(hote, '.amis-recues'))).toBe(true);
    expect(estCache(obligatoire(hote, '.amis-envoyees'))).toBe(true);
    expect(estCache(obligatoire(hote, '.amis-bloques'))).toBe(true);
  });
});

describe('une premiere lecture qui echoue', () => {
  it('le dit, et se relit sur demande', async () => {
    api.reponses.amis = async () => ({
      acceptee: false,
      statut: 0,
      erreurs: [{ champ: 'comptes', motif: 'Le serveur ne répond pas.' }],
    });
    await monter(true);
    boutonObligatoire(navigation(), 'Amis').click();
    await laisserRepondre();

    expect(obligatoire(hote, '.amis-echec').textContent).toContain('Le serveur ne répond pas.');
    expect(estCache(obligatoire(hote, '.amis-listes'))).toBe(true);

    api.reponses.amis = async () => ({ acceptee: true, valeur: LISTE });
    boutonObligatoire(hote, 'Réessayer').click();
    await laisserRepondre();

    expect(estCache(obligatoire(hote, '.amis-echec'))).toBe(true);
    expect(pseudos('amis-amis')).toEqual(['Bob']);
  });
});
