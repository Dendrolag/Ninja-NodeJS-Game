/**
 * La coherence entre l'ecran de creation et le serveur, verifiee pour de vrai.
 *
 * LE TEST EXIGE PAR LA FICHE de la reprise des ecrans du jalon 3: une configuration
 * invalide est signalee cote client, de facon coherente avec le refus du serveur.
 * Les tests de l'ecran verifient la premiere moitie dans un document. Celui-ci
 * verifie la seconde: on fait partir la creation que l'ecran refuse, en contournant
 * l'ecran comme le ferait un client modifie, et le vrai serveur doit la refuser avec
 * exactement les memes motifs, sur les memes champs. Puis la creation que l'ecran
 * prepare doit etre acceptee telle quelle.
 */

import type { Client } from '@neon-ninja/client';
import {
  creerClient,
  creerReseauSocketIo,
  modeleCreation,
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
  client.saisirPseudo('Alice');
});

afterEach(async () => {
  client.fermer();
  await serveur.fermer();
});

describe('l ecran de creation et le serveur', () => {
  it('refusent la meme creation, avec les memes motifs sur les memes champs', async () => {
    const valeurs = {
      ...valeursDepuisReglages(REGLAGES_PAR_DEFAUT),
      dureePartieS: '700',
      'bonus.types.vitesse.dureeS': '',
      'botsNoirs.rayonDetectionPx': '20',
    };
    const verdictDeLEcran = verifierLesValeurs(valeurs);

    expect(
      modeleCreation(client.etat, { mode: 'classique', visibilite: 'privee', valeurs }).envoi,
    ).toBeUndefined();
    expect(verdictDeLEcran.valide).toBe(false);

    // Contourner l'ecran, comme un client modifie.
    client.creerPartie('Alice', {
      mode: 'classique',
      visibilite: 'privee',
      reglages: reglagesDepuisValeurs(valeurs),
    });
    await attendreQue(() => client.etat.refus !== undefined, 'le refus du serveur');

    expect(client.etat.refus).toEqual({
      action: 'creerPartie',
      erreurs: verdictDeLEcran.valide ? [] : verdictDeLEcran.erreurs,
    });
    expect(client.etat.salon).toBeUndefined();
  });

  it('acceptent la creation que l ecran prepare, et le salon la decrit', async () => {
    const envoi = modeleCreation(client.etat, {
      mode: 'classique',
      visibilite: 'privee',
      valeurs: { ...valeursDepuisReglages(REGLAGES_PAR_DEFAUT), carte: 'map3', dureePartieS: '60' },
    }).envoi;

    expect(envoi).toBeDefined();

    client.creerPartie(
      envoi?.pseudo,
      envoi?.configuration ?? { mode: 'classique', visibilite: 'publique' },
    );
    await attendreQue(() => client.etat.salon !== undefined, 'le salon');

    expect(client.etat.salon).toMatchObject({
      visibilite: 'privee',
      reglages: { carte: 'map3', dureePartieS: 60 },
      joueurs: [{ pseudo: 'Alice', hote: true }],
    });
    expect(client.etat.salon?.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/u);
  });
});
