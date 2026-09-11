/**
 * La coherence entre le formulaire de reglages et le serveur, verifiee pour de vrai.
 *
 * LE TEST EXIGE PAR LA FICHE 4.3 dit: une configuration invalide est signalee cote
 * client, de facon coherente avec le refus du serveur. Les tests du panneau
 * verifient la premiere moitie dans un document. Celui-ci verifie la seconde: on
 * fait partir la configuration que le formulaire refuse, en contournant le
 * formulaire comme le ferait un client modifie, et le vrai serveur doit la
 * refuser avec exactement les memes motifs, sur les memes champs.
 *
 * Le jour ou le serveur ajoutera une regle que le client ne reflete pas, ou
 * l'inverse, c'est ce test qui le dira.
 */

import type { Client } from '@neon-ninja/client';
import {
  creerClient,
  creerReseauSocketIo,
  reglagesDepuisValeurs,
  valeursDepuisReglages,
  verifierLesValeurs,
} from '@neon-ninja/client';
import type { ServeurMonte } from '@neon-ninja/server';
import { creerHorlogeManuelle, demarrerServeur } from '@neon-ninja/server';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Delai au-dela duquel on considere qu'une attente ne sera jamais satisfaite. */
const DELAI_ATTENTE_MS = 3000;

let serveur: ServeurMonte;
let client: Client;

/** Attend qu'une condition devienne vraie, ou echoue en le disant. */
async function attendreQue(condition: () => boolean, quoi: string): Promise<void> {
  const limite = Date.now() + DELAI_ATTENTE_MS;

  while (!condition()) {
    if (Date.now() > limite) {
      throw new Error(`Delai depasse en attendant ${quoi}.`);
    }

    await new Promise((resoudre) => setTimeout(resoudre, 10));
  }
}

beforeEach(async () => {
  serveur = await demarrerServeur(0, { horloge: creerHorlogeManuelle() });
  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  client = creerClient({
    reseau: creerReseauSocketIo({ url: `http://localhost:${String(adresse.port)}` }),
  });
  client.ouvrir();

  await attendreQue(() => client.etat.connexion === 'connecte', 'la connexion');
  client.rejoindre('Alice');
  await attendreQue(() => client.etat.salon !== undefined, 'l entree dans le salon');
});

afterEach(async () => {
  client.fermer();
  await serveur.fermer();
});

describe('le formulaire de reglages et le serveur', () => {
  it('refusent la meme configuration, avec les memes motifs sur les memes champs', async () => {
    const valeurs = {
      ...valeursDepuisReglages(REGLAGES_PAR_DEFAUT),
      dureePartieS: '700',
      'bonus.types.vitesse.dureeS': '',
      nombreBotsInitial: '12.5',
      'botsNoirs.rayonDetectionPx': '20',
    };
    const verdictDuFormulaire = verifierLesValeurs(valeurs);

    expect(verdictDuFormulaire.valide).toBe(false);

    // Le formulaire n'aurait rien envoye: on envoie quand meme.
    client.changerReglages(reglagesDepuisValeurs(valeurs));
    await attendreQue(() => client.etat.refus?.action === 'reglages', 'le refus du serveur');

    expect(client.etat.refus?.erreurs).toEqual(
      verdictDuFormulaire.valide ? [] : verdictDuFormulaire.erreurs,
    );
  });

  it('refusent tous deux une duree minimale de zone plus longue que la maximale', async () => {
    const valeurs = {
      ...valeursDepuisReglages(REGLAGES_PAR_DEFAUT),
      'zones.dureeMinimumS': '60',
      'zones.dureeMaximumS': '30',
    };
    const verdictDuFormulaire = verifierLesValeurs(valeurs);

    client.changerReglages(reglagesDepuisValeurs(valeurs));
    await attendreQue(() => client.etat.refus?.action === 'reglages', 'le refus du serveur');

    expect(client.etat.refus?.erreurs).toEqual(
      verdictDuFormulaire.valide ? [] : verdictDuFormulaire.erreurs,
    );
  });

  it('acceptent tous deux une configuration valide, que le salon reprend', async () => {
    const verdictDuFormulaire = verifierLesValeurs({
      ...valeursDepuisReglages(REGLAGES_PAR_DEFAUT),
      dureePartieS: '60',
      carte: 'map3',
    });

    expect(verdictDuFormulaire.valide).toBe(true);

    if (verdictDuFormulaire.valide) {
      client.changerReglages(verdictDuFormulaire.valeur);
    }

    await attendreQue(
      () => client.etat.salon?.reglages.carte === 'map3',
      'les reglages repris par le salon',
    );

    expect(client.etat.salon?.reglages.dureePartieS).toBe(60);
    expect(client.etat.refus).toBeUndefined();
  });
});
