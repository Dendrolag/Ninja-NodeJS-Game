/**
 * Tests du reveil du serveur.
 *
 * Ce qu'ils protegent: une page ouverte sur un serveur endormi attend son reveil en
 * reessayant d'elle-meme, le dit, et rend la main au joueur au bout d'une minute et
 * demie; un refus du serveur n'est jamais reessaye; un essai du joueur n'est jamais
 * double par un essai automatique.
 */

import { describe, expect, it } from 'vitest';

import { creerClient } from './client.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import { creerMinuterieManuelle } from './minuterie.js';
import { SERVEUR_INJOIGNABLE, creerReseauFactice } from './reseau.js';
import { ATTENTE_ENTRE_DEUX_ESSAIS_MS, DUREE_DU_REVEIL_MS } from './reveil.js';

/** Un client ouvert en invite, avec son transport, sa minuterie et de quoi faire passer le temps. */
function monter() {
  const reseau = creerReseauFactice();
  const horloge = creerHorlogeClientManuelle();
  const minuterie = creerMinuterieManuelle();
  const client = creerClient({ reseau, horloge, minuterie });

  const avancer = (dtMs: number): void => {
    horloge.avancerDe(dtMs);
    minuterie.avancerDe(dtMs);
  };

  client.ouvrir();

  return { reseau, minuterie, client, avancer };
}

describe('le reveil du serveur', () => {
  it('attend un serveur qui ne repond pas, le dit, et rouvre le lien de lui-meme', () => {
    const { reseau, client, avancer } = monter();

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.connexion).toBe('reveil');
    expect(client.etat.refusDeConnexion).toBeUndefined();
    expect(reseau.ouvertures).toHaveLength(1);

    avancer(ATTENTE_ENTRE_DEUX_ESSAIS_MS - 1);
    expect(reseau.ouvertures).toHaveLength(1);

    avancer(1);
    expect(reseau.ouvertures).toHaveLength(2);
    expect(client.etat.connexion).toBe('horsLigne');

    reseau.simulerConnexion('moi');
    expect(client.etat.connexion).toBe('connecte');
  });

  it('rend la main au joueur au bout de la duree du reveil', () => {
    const { reseau, minuterie, client, avancer } = monter();

    for (let ecoule = 0; ecoule < DUREE_DU_REVEIL_MS; ecoule += ATTENTE_ENTRE_DEUX_ESSAIS_MS) {
      reseau.simulerRefus(SERVEUR_INJOIGNABLE);
      expect(client.etat.connexion, `apres ${String(ecoule)} ms`).toBe('reveil');
      avancer(ATTENTE_ENTRE_DEUX_ESSAIS_MS);
    }

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.connexion).toBe('refusee');
    expect(client.etat.refusDeConnexion).toBe(SERVEUR_INJOIGNABLE);
    expect(reseau.ouvertures).toHaveLength(1 + DUREE_DU_REVEIL_MS / ATTENTE_ENTRE_DEUX_ESSAIS_MS);
    expect(minuterie.enAttente).toBe(0);
  });

  it('ouvre une nouvelle serie quand le joueur reessaie apres avoir repris la main', () => {
    const { reseau, client, avancer } = monter();

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    avancer(DUREE_DU_REVEIL_MS);
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    expect(client.etat.connexion).toBe('refusee');

    client.reessayer();
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.connexion).toBe('reveil');
  });

  it('ouvre une nouvelle serie apres un lien etabli', () => {
    const { reseau, client, avancer } = monter();

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    avancer(ATTENTE_ENTRE_DEUX_ESSAIS_MS);
    reseau.simulerConnexion('moi');
    avancer(DUREE_DU_REVEIL_MS * 2);

    client.reessayer();
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.connexion).toBe('reveil');
  });

  it('ne reessaie jamais un refus du serveur', () => {
    const { reseau, minuterie, client, avancer } = monter();

    reseau.simulerRefus('Session invalide ou expirée. Reconnectez-vous.');
    avancer(ATTENTE_ENTRE_DEUX_ESSAIS_MS * 2);

    expect(client.etat.connexion).toBe('refusee');
    expect(client.etat.refusDeConnexion).toBe('Session invalide ou expirée. Reconnectez-vous.');
    expect(reseau.ouvertures).toHaveLength(1);
    expect(minuterie.enAttente).toBe(0);
  });

  it('ne double pas un lien que le joueur a rouvert pendant l attente', () => {
    const { reseau, client, avancer } = monter();

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    client.continuerEnInvite();
    expect(reseau.ouvertures).toHaveLength(2);

    avancer(ATTENTE_ENTRE_DEUX_ESSAIS_MS);

    expect(reseau.ouvertures).toHaveLength(2);
  });

  it('n oublie aucun essai planifie en se fermant', () => {
    const { reseau, minuterie, client } = monter();

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    expect(minuterie.enAttente).toBe(1);

    client.fermer();

    expect(minuterie.enAttente).toBe(0);
  });
});
