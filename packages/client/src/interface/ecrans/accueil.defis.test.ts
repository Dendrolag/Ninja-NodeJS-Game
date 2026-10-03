// @vitest-environment jsdom
/**
 * Tests du bloc des defis de la semaine sur l'accueil (etape 3.10), dans un document.
 *
 * Un compte y voit ses trois defis, leur recompense, leur jauge et le temps qui reste;
 * un invite n'y voit rien.
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { ApiComptesFactice } from '../../comptes/api.js';
import { JETON_DESSAI, creerApiComptesFactice } from '../../comptes/api.js';
import { creerCoffreDeJeton } from '../../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import { creerReseauFactice } from '../../reseau.js';
import { contexteDEssai, estCache, obligatoire } from '../essais.js';
import { monterAccueil } from './accueil.js';
import type { EcranAffiche } from './types.js';

let client: Client;
let ecran: EcranAffiche;
let desabonner: () => void;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Monte l'accueil, pour un compte si un jeton est garde, lien etabli. */
async function monter(avecUnCompte: boolean): Promise<ApiComptesFactice> {
  const reseau = creerReseauFactice();
  const api = creerApiComptesFactice();
  const coffre = creerCoffreDeJeton();

  if (avecUnCompte) {
    coffre.garder(JETON_DESSAI);
  }

  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
  client.ouvrir();
  await laisserRepondre();
  reseau.simulerConnexion();

  ecran = monterAccueil(contexteDEssai(client));
  document.body.append(ecran.racine);
  ecran.afficher(client.etat);
  desabonner = client.abonner(() => {
    ecran.afficher(client.etat);
  });

  return api;
}

/** Le bloc des defis. */
function bloc(): HTMLElement {
  return obligatoire(document, '.accueil-defis');
}

afterEach(() => {
  desabonner();
  ecran.demonter();
  client.fermer();
});

describe('les defis de la semaine sur l accueil', () => {
  it('montrent a un compte ses trois defis, leur recompense et le temps restant', async () => {
    await monter(true);

    expect(estCache(bloc())).toBe(false);
    expect(obligatoire(bloc(), 'h2').textContent).toBe('Défis de la semaine');

    const lignes = [...bloc().querySelectorAll('.defi')];

    expect(lignes).toHaveLength(3);
    expect(lignes.map((ligne) => ligne.getAttribute('data-famille'))).toEqual([
      'assiduite',
      'action',
      'exploit',
    ]);
    expect(lignes.map((ligne) => ligne.querySelector('.defi-xp')?.textContent)).toEqual([
      '+300 XP',
      '+400 XP',
      '+500 XP',
    ]);
    expect(obligatoire(bloc(), '.defi-avancee').textContent).toBe('0 / 3');
    expect(obligatoire(bloc(), '.accueil-defis-bilan').textContent).toBe('0 défi relevé sur 3');
    expect(obligatoire(bloc(), '.accueil-defis-renouvellement').textContent).toMatch(
      /^Nouveaux défis/,
    );
  });

  it('restent absents pour un invite', async () => {
    const api = await monter(false);

    expect(estCache(bloc())).toBe(true);
    expect(api.appels.some((appel) => appel.nom === 'defis')).toBe(false);
  });
});
