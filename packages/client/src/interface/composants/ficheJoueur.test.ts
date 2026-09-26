// @vitest-environment jsdom
/**
 * Tests de la fiche d'un joueur, dans un document (etape 3.5).
 *
 * L'application entiere est montee, avec un client de compte relie au banc d'essai du
 * transport et a des comptes d'essai: la fiche s'ouvre depuis le salon et le
 * classement de fin comme en jeu, d'un clic sur un pseudo, et se lit par la requete
 * des comptes. Depuis l'etape 3.6, elle propose les gestes d'amitie que la relation
 * permet, et montre a un ami les parties jouees ensemble.
 */

import type { FicheJoueur, InfosSalon, LigneClassement } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { ApiComptesFactice } from '../../comptes/api.js';
import { JETON_DESSAI, creerApiComptesFactice, ficheDEssai } from '../../comptes/api.js';
import { creerCoffreDeJeton } from '../../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import type { Application } from '../application.js';
import { monterApplication } from '../application.js';
import { boutonNomme, boutonObligatoire, estCache, jeuDEssai, obligatoire } from '../essais.js';

/** Un salon ou Alice (nous) et Bob ont un compte, et Eve est invitee. */
const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [
    { id: 'moi', pseudo: 'Alice', hote: true, compte: { niveau: 1 } },
    { id: 'bob', pseudo: 'Bob', hote: false, compte: { niveau: 4 } },
    { id: 'eve', pseudo: 'Eve', hote: false },
  ],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** La fiche de Bob, telle que le serveur la rend. */
const FICHE_DE_BOB: FicheJoueur = {
  pseudo: 'Bob',
  inscritLe: '2026-09-11T10:00:00.000Z',
  niveau: 4,
  palier: 'argent',
  relation: 'aucune',
  statistiques: {
    partiesJouees: 7,
    partiesAPlusieurs: 6,
    victoires: 2,
    modePrefere: 'chasse',
    parMode: [
      {
        mode: 'classique',
        partiesJouees: 3,
        partiesAPlusieurs: 2,
        victoires: 1,
        meilleurScore: 80,
      },
      {
        mode: 'chasse',
        partiesJouees: 4,
        partiesAPlusieurs: 4,
        victoires: 1,
        meilleurScore: 210,
      },
    ],
  },
};

/** Une ligne du classement de fin. */
function ligne(id: string, pseudo: string, points: number): LigneClassement {
  return {
    id,
    pseudo,
    couleur: '#00FFFF',
    points,
    botsPortes: points,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

let hote: HTMLElement;
let reseau: ReseauFactice;
let api: ApiComptesFactice;
let client: Client;
let application: Application;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** La fenetre de la fiche, montee par l'application. */
function fenetre(): HTMLElement {
  return obligatoire(hote, '.fenetre-fiche');
}

/** Monte l'application pour un compte, ou pour un invite, et entre dans le salon. */
async function entrerAuSalon(avecUnCompte: boolean): Promise<void> {
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
  reseau.recevoir('placeAttribuee', { joueur: 'moi', jetonDeRetour: 'M'.repeat(43) });
  client.rejoindre(avecUnCompte ? undefined : 'Alice');
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
}

beforeEach(() => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  api.reponses.joueur = async (_jeton, pseudo) => ({
    acceptee: true,
    valeur: pseudo === 'Bob' ? FICHE_DE_BOB : ficheDEssai(pseudo),
  });
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('la fiche d un joueur, au salon', () => {
  it('s ouvre d un clic sur le pseudo d un compte, et montre ce que le serveur a rendu', async () => {
    await entrerAuSalon(true);

    expect(estCache(fenetre())).toBe(true);

    boutonObligatoire(hote, 'Bob, voir sa fiche').click();

    expect(estCache(fenetre())).toBe(false);
    expect(obligatoire(fenetre(), '.fiche-chargement').textContent).toBe(
      'Lecture de la fiche de Bob…',
    );
    expect(api.appels.at(-1)).toEqual({
      nom: 'joueur',
      argument: { jeton: JETON_DESSAI, pseudo: 'Bob' },
    });

    await laisserRepondre();

    expect(estCache(obligatoire(fenetre(), '.fiche-chargement'))).toBe(true);
    expect(obligatoire(fenetre(), '.fiche-pseudo').textContent).toBe('Bob');
    expect(obligatoire(fenetre(), '.fiche-niveau').textContent).toBe('Niveau 4');
    expect(obligatoire(fenetre(), '.badge-palier').textContent).toBe('Argent');
    expect(obligatoire(fenetre(), '.fiche-inscription').textContent).toMatch(/^Membre depuis le /);
    expect(
      [...fenetre().querySelectorAll('.statistique')].map((tuile) => tuile.textContent),
    ).toEqual(['7Parties jouées', '2Victoiressur 6 parties à plusieurs', 'ChasseMode préféré']);
    expect(
      [...fenetre().querySelectorAll('.tableau-par-mode tbody tr')].map((rangee) =>
        [...rangee.children].map((cellule) => cellule.textContent),
      ),
    ).toEqual([
      ['Horde', '3', '1 sur 2', '80', '—'],
      ['Chasse', '4', '1 sur 4', '210', '—'],
    ]);
    // Ce que la fiche ne montre jamais.
    expect(fenetre().textContent).not.toMatch(/Pièces|Points de ligue|Dernières parties/);
  });

  it('n offre aucune fiche pour un invite, et ouvre la sienne a qui la demande', async () => {
    await entrerAuSalon(true);

    expect(boutonNomme(hote, 'Eve, voir sa fiche')).toBeUndefined();
    expect(obligatoire(hote, '[data-joueur="eve"] .carte-joueur-pseudo').tagName).toBe('SPAN');

    boutonObligatoire(hote, 'Alice, voir sa fiche').click();
    await laisserRepondre();

    expect(obligatoire(fenetre(), '.fiche-pseudo').textContent).toBe('Alice');
    expect(estCache(obligatoire(fenetre(), '.fiche-vide'))).toBe(false);
    expect(estCache(obligatoire(fenetre(), '.fiche-par-mode-tableau'))).toBe(true);
  });

  it('se ferme par son bouton, et la fiche quitte l etat', async () => {
    await entrerAuSalon(true);
    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();

    boutonObligatoire(fenetre(), 'Fermer').click();

    expect(estCache(fenetre())).toBe(true);
    expect(client.etat.fiche).toEqual({ statut: 'fermee' });
  });

  it('dit pourquoi elle n a pas pu etre lue, et se relit sur demande', async () => {
    await entrerAuSalon(true);
    api.reponses.joueur = async () => ({
      acceptee: false,
      statut: 404,
      erreurs: [{ champ: 'pseudo', motif: 'Aucun compte ne porte ce pseudo.' }],
    });

    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();

    expect(obligatoire(fenetre(), '.fiche-echec').textContent).toContain(
      'Aucun compte ne porte ce pseudo.',
    );
    expect(estCache(obligatoire(fenetre(), '.fiche-contenu'))).toBe(true);

    api.reponses.joueur = async () => ({ acceptee: true, valeur: FICHE_DE_BOB });
    boutonObligatoire(fenetre(), 'Réessayer').click();
    await laisserRepondre();

    expect(obligatoire(fenetre(), '.fiche-pseudo').textContent).toBe('Bob');
  });

  it('se ferme d elle-meme quand la partie se lance', async () => {
    await entrerAuSalon(true);
    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();

    reseau.recevoir('partieLancee');

    expect(client.etat.fiche).toEqual({ statut: 'fermee' });
    expect(estCache(fenetre())).toBe(true);
  });

  it('n offre aucune fiche a un invite', async () => {
    await entrerAuSalon(false);

    expect(hote.querySelectorAll('.lien-fiche')).toHaveLength(0);
  });
});

describe('la fiche d un joueur, a la fin', () => {
  it('s ouvre depuis le classement, pour les joueurs du salon qui ont un compte', async () => {
    await entrerAuSalon(true);
    reseau.recevoir('partieLancee');
    reseau.recevoir('partieTerminee', {
      classement: [ligne('bob', 'Bob', 40), ligne('moi', 'Alice', 30), ligne('eve', 'Eve', 5)],
    });

    expect(obligatoire(hote, '.application').dataset['ecran']).toBe('fin');
    expect(boutonNomme(hote, 'Eve, voir sa fiche')).toBeUndefined();

    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();

    expect(estCache(fenetre())).toBe(false);
    expect(obligatoire(fenetre(), '.fiche-pseudo').textContent).toBe('Bob');
  });

  it('n offre aucune fiche a un invite', async () => {
    await entrerAuSalon(false);
    reseau.recevoir('partieLancee');
    reseau.recevoir('partieTerminee', {
      classement: [ligne('bob', 'Bob', 40), ligne('moi', 'Alice', 30)],
    });

    expect(hote.querySelectorAll('.lien-fiche')).toHaveLength(0);
  });
});

describe('l amitie, sur la fiche (etape 3.6)', () => {
  /** Les libelles des gestes proposes par la fiche, dans l'ordre. */
  function gestes(): string[] {
    return [...fenetre().querySelectorAll('.fiche-gestes button')].map(
      (element) => element.textContent,
    );
  }

  it('propose d ajouter un compte sans relation, et suit la demande envoyee', async () => {
    await entrerAuSalon(true);
    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();

    expect(gestes()).toEqual(['Ajouter en ami', 'Bloquer']);
    expect(estCache(obligatoire(fenetre(), '.fiche-relation'))).toBe(true);
    expect(estCache(obligatoire(fenetre(), '.fiche-ensemble'))).toBe(true);

    api.reponses.gesteDAmitie = async () => ({
      acceptee: true,
      valeur: {
        pseudo: 'Bob',
        relation: 'demandeEnvoyee',
        amis: { amis: [], recues: [], envoyees: [{ pseudo: 'Bob', niveau: 4 }], bloques: [] },
      },
    });
    boutonObligatoire(fenetre(), 'Ajouter en ami').click();

    expect(api.appels.at(-1)).toEqual({
      nom: 'gesteDAmitie',
      argument: { jeton: JETON_DESSAI, demande: { geste: 'demander', pseudo: 'Bob' } },
    });
    // Le geste attend sa reponse: les boutons ne repartent pas.
    expect(boutonObligatoire(fenetre(), 'Bloquer').disabled).toBe(true);

    await laisserRepondre();

    expect(obligatoire(fenetre(), '.fiche-relation').textContent).toBe(
      'Demande envoyée, en attente de réponse.',
    );
    expect(gestes()).toEqual(['Annuler la demande', 'Bloquer']);
    expect(boutonObligatoire(fenetre(), 'Bloquer').disabled).toBe(false);
  });

  it('dit pourquoi un geste est refuse', async () => {
    await entrerAuSalon(true);
    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();
    api.reponses.gesteDAmitie = async () => ({
      acceptee: false,
      statut: 409,
      erreurs: [{ champ: 'geste', motif: 'Ce compte a déjà 200 amis.' }],
    });

    boutonObligatoire(fenetre(), 'Ajouter en ami').click();
    await laisserRepondre();

    expect(obligatoire(fenetre(), '.fiche-erreur-geste').textContent).toBe(
      'Ce compte a déjà 200 amis.',
    );
  });

  it('montre a un ami les parties jouees ensemble', async () => {
    api.reponses.joueur = async () => ({
      acceptee: true,
      valeur: {
        ...FICHE_DE_BOB,
        relation: 'ami',
        ensemble: { partiesEnsemble: 14, devant: 9, derriere: 4 },
      },
    });
    await entrerAuSalon(true);
    boutonObligatoire(hote, 'Bob, voir sa fiche').click();
    await laisserRepondre();

    expect(obligatoire(fenetre(), '.fiche-relation').textContent).toBe('Vous êtes amis.');
    expect(gestes()).toEqual(['Retirer des amis', 'Bloquer']);
    expect(
      [...obligatoire(fenetre(), '.fiche-ensemble').querySelectorAll('.statistique')].map(
        (tuile) => tuile.textContent,
      ),
    ).toEqual(['14Parties ensemble', '9Vous devant', '4Bob devant']);
  });

  it('ne propose rien sur sa propre fiche', async () => {
    api.reponses.joueur = async (_jeton, pseudo) => ({
      acceptee: true,
      valeur: { ...ficheDEssai(pseudo), relation: 'soi' },
    });
    await entrerAuSalon(true);
    boutonObligatoire(hote, 'Alice, voir sa fiche').click();
    await laisserRepondre();

    expect(estCache(obligatoire(fenetre(), '.fiche-amitie'))).toBe(true);
    expect(gestes()).toEqual([]);
  });
});
