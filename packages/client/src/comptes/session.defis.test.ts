/**
 * Tests de la lecture des defis de la semaine par la session du client (etape 3.10).
 *
 * Ce qu'ils protegent: les defis se lisent a l'ouverture d'une session de compte et a
 * chaque arrivee sur l'accueil, jamais pour un invite; une fin de partie enregistree les
 * rend inconnus, puisqu'elle les a fait avancer; un refus ne se montre pas.
 */

import type { ProgressionEnregistree } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { ApiComptesFactice } from './api.js';
import { JETON_DESSAI, creerApiComptesFactice, defisDEssai } from './api.js';
import type { CoffreDeJeton } from './coffre.js';
import { creerCoffreDeJeton } from './coffre.js';

let reseau: ReseauFactice;
let api: ApiComptesFactice;
let coffre: CoffreDeJeton;
let client: Client;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Combien de fois les defis ont ete demandes. */
function lecturesDesDefis(): number {
  return api.appels.filter((appel) => appel.nom === 'defis').length;
}

beforeEach(() => {
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  coffre = creerCoffreDeJeton();
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
});

describe('les defis d un compte', () => {
  beforeEach(async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion();
  });

  it('se lisent a l ouverture de la session', () => {
    expect(lecturesDesDefis()).toBe(1);
    expect(client.etat.defis).toEqual({ statut: 'charge', defis: defisDEssai() });
  });

  it('se relisent a chaque arrivee sur l accueil, sans disparaitre pendant la lecture', () => {
    client.naviguer('profil');
    client.naviguer('accueil');

    expect(lecturesDesDefis()).toBe(2);
    expect(client.etat.defis.statut).toBe('charge');
  });

  it('redeviennent inconnus apres une partie enregistree', () => {
    const recapitulatif: ProgressionEnregistree = {
      enregistree: true,
      placement: 1,
      nombreJoueurs: 2,
      xpGagnee: 60,
      piecesGagnees: 6,
      variationPointsLigue: 0,
      avant: { xpTotale: 0, niveau: 1, pieces: 0, pointsLigue: 0, palier: 'bronze' },
      apres: { xpTotale: 60, niveau: 1, pieces: 6, pointsLigue: 0, palier: 'bronze' },
      succes: { debloques: [] },
      defis: { releves: [], defis: defisDEssai().defis },
    };

    reseau.recevoir('progressionDeFin', recapitulatif);

    expect(client.etat.defis).toEqual({ statut: 'inconnu' });
  });

  it('ne disent rien d un refus: le bloc de l accueil reste absent', async () => {
    api.reponses.defis = async () => ({
      acceptee: false,
      statut: 503,
      erreurs: [{ champ: 'comptes', motif: 'Indisponible.' }],
    });

    client.naviguer('profil');
    client.naviguer('accueil');
    await laisserRepondre();

    expect(client.etat.defis).toEqual({ statut: 'echec', motif: 'Indisponible.' });
  });
});

describe('un invite', () => {
  it('ne lit jamais de defis', async () => {
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion();
    client.naviguer('profil');
    client.naviguer('accueil');

    expect(lecturesDesDefis()).toBe(0);
    expect(client.etat.defis).toEqual({ statut: 'inconnu' });
  });
});
