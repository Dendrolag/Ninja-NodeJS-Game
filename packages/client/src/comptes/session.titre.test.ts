/**
 * Tests du choix du titre par la session du client (etape 3.9).
 *
 * Ce qu'ils protegent: le choix part avec la session du compte, un seul a la fois; le
 * profil lu prend le titre accepte sans se relire; un refus se dit, et le titre porte ne
 * change pas; une session expiree se traite comme a la lecture du profil; un invite ne
 * choisit rien.
 */

import type { ProfilDuCompte } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { AUCUN_CHOIX_DE_TITRE, ETAT_INITIAL } from '../etat.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import { reduire } from '../reduction.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { ApiComptesFactice } from './api.js';
import { JETON_DESSAI, creerApiComptesFactice, profilDEssai } from './api.js';
import type { CoffreDeJeton } from './coffre.js';
import { creerCoffreDeJeton } from './coffre.js';

let reseau: ReseauFactice;
let api: ApiComptesFactice;
let coffre: CoffreDeJeton;
let client: Client;

/** Un profil qui a obtenu « Premier pas » et « Première prise », et porte le premier. */
const PROFIL: ProfilDuCompte = {
  ...profilDEssai('Alice'),
  succes: profilDEssai('Alice').succes.map((succes) =>
    succes.id === 'premier-pas' || succes.id === 'premiere-prise'
      ? { ...succes, debloqueLe: '2026-09-20T10:00:00.000Z' }
      : succes,
  ),
  titre: 'premier-pas',
};

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Les requetes de titre faites aux comptes, dans l'ordre. */
function choixEnvoyes(): unknown[] {
  return api.appels.filter((appel) => appel.nom === 'titre').map((appel) => appel.argument);
}

/** Le titre du profil lu, s'il est lu. */
function titreDuProfil(): string | undefined {
  const profil = client.etat.profil;

  return profil.statut === 'charge' ? profil.profil.titre : undefined;
}

beforeEach(() => {
  reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  coffre = creerCoffreDeJeton();
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
});

describe('le choix du titre d un compte', () => {
  beforeEach(async () => {
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion();
    api.reponses.profil = async () => ({ acceptee: true, valeur: PROFIL });
    client.naviguer('profil');
    await laisserRepondre();
  });

  it('part avec la session, et le profil lu prend le titre accepte', async () => {
    client.choisirUnTitre('premiere-prise');

    expect(client.etat.choixDuTitre).toEqual({ statut: 'enCours' });

    await laisserRepondre();

    expect(choixEnvoyes()).toEqual([{ jeton: JETON_DESSAI, demande: { titre: 'premiere-prise' } }]);
    expect(client.etat.choixDuTitre).toEqual(AUCUN_CHOIX_DE_TITRE);
    expect(titreDuProfil()).toBe('premiere-prise');
    // Le profil ne se relit pas: une seule lecture, celle de l'arrivee.
    expect(api.appels.filter((appel) => appel.nom === 'profil')).toHaveLength(1);
  });

  it('retire le titre avec null', async () => {
    client.choisirUnTitre(null);
    await laisserRepondre();

    expect(choixEnvoyes()).toEqual([{ jeton: JETON_DESSAI, demande: { titre: null } }]);
    expect(client.etat.profil.statut === 'charge' && 'titre' in client.etat.profil.profil).toBe(
      false,
    );
  });

  it('dit un refus, sans changer le titre porte, et l oublie au profil relu', async () => {
    api.reponses.titre = async () => ({
      acceptee: false,
      statut: 409,
      erreurs: [{ champ: 'titre', motif: 'Ce succès n’est pas encore obtenu.' }],
    });

    client.choisirUnTitre('centurion');
    await laisserRepondre();

    expect(client.etat.choixDuTitre).toEqual({
      statut: 'refuse',
      motif: 'Ce succès n’est pas encore obtenu.',
    });
    expect(titreDuProfil()).toBe('premier-pas');

    client.chargerLeProfil();

    expect(client.etat.choixDuTitre).toEqual(AUCUN_CHOIX_DE_TITRE);
  });

  it('ne part pas une seconde fois pendant qu un choix attend', () => {
    api.reponses.titre = () => new Promise(() => undefined);

    client.choisirUnTitre('premiere-prise');
    client.choisirUnTitre('premier-pas');

    expect(choixEnvoyes()).toHaveLength(1);
  });

  it('ramene en invite, en le disant, quand la session a expire', async () => {
    api.reponses.titre = async () => ({
      acceptee: false,
      statut: 401,
      erreurs: [{ champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' }],
    });

    client.choisirUnTitre('premiere-prise');
    await laisserRepondre();

    expect(coffre.lire()).toBeUndefined();
    expect(client.etat.session).toEqual({ nature: 'invite', sessionExpiree: true });
    expect(client.etat.choixDuTitre).toEqual(AUCUN_CHOIX_DE_TITRE);
  });
});

describe('le choix du titre d un invite', () => {
  it('ne part pas', () => {
    client.ouvrir();
    reseau.simulerConnexion();

    client.choisirUnTitre('premier-pas');

    expect(choixEnvoyes()).toEqual([]);
    expect(client.etat.choixDuTitre).toEqual(AUCUN_CHOIX_DE_TITRE);
  });
});

describe('la reduction du choix du titre', () => {
  it('ne touche pas un profil qui n est pas lu', () => {
    const etat = reduire(ETAT_INITIAL, {
      type: 'titreChoisi',
      titre: { titre: 'premier-pas' },
    });

    expect(etat.profil).toEqual({ statut: 'inconnu' });
    expect(etat.choixDuTitre).toEqual(AUCUN_CHOIX_DE_TITRE);
  });

  it('s oublie quand la session change', () => {
    const refuse = reduire(ETAT_INITIAL, { type: 'titreRefuse', motif: 'Non.' });

    expect(reduire(refuse, { type: 'sessionDInvite', expiree: false }).choixDuTitre).toEqual(
      AUCUN_CHOIX_DE_TITRE,
    );
    expect(reduire(refuse, { type: 'sessionDeCompte', progression: PROFIL }).choixDuTitre).toEqual(
      AUCUN_CHOIX_DE_TITRE,
    );
  });
});
