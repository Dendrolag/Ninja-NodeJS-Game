/**
 * Tests du rafraichissement de la liste des parties.
 *
 * MANQUE CONNU DU HANDOFF 5.3, retenu par le porteur du projet a la recette de
 * l'etape 5.4: la liste ne se redemandait qu'a l'arrivee sur l'ecran et sur le
 * bouton « Actualiser ». Un joueur qui attendait devant elle voyait des salons deja
 * pleins ou lances, et jamais ceux qui s'ouvraient.
 */

import type { PartiePublique } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerClient } from './client.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import { creerMinuterieManuelle } from './minuterie.js';
import { INTERVALLE_DE_RAFRAICHISSEMENT_MS } from './rafraichissement.js';
import { creerReseauFactice } from './reseau.js';

const PARTIE: PartiePublique = {
  idRoom: 'room-1',
  hote: 'KageOni',
  mode: 'classique',
  carte: 'map1',
  modeMiroir: false,
  joueurs: 3,
  capacite: 12,
};

/** Un client connecte, sa minuterie, et le compte de ses demandes de liste. */
function monter() {
  const reseau = creerReseauFactice();
  const minuterie = creerMinuterieManuelle();
  const client = creerClient({ reseau, horloge: creerHorlogeClientManuelle(), minuterie });

  client.ouvrir();
  reseau.simulerConnexion('moi');

  const demandes = (): number =>
    reseau.emis.filter((message) => message.nom === 'listerParties').length;
  const repondre = (parties: readonly PartiePublique[]): void => {
    reseau.dernier('listerParties')?.[0](parties);
  };

  return { minuterie, client, demandes, repondre };
}

describe('la liste des parties vivante', () => {
  it('se redemande d elle-meme tant que l ecran des parties est affiche', () => {
    const { minuterie, client, demandes, repondre } = monter();

    client.naviguer('parties');
    repondre([PARTIE]);
    expect(demandes()).toBe(1);

    minuterie.avancerDe(INTERVALLE_DE_RAFRAICHISSEMENT_MS - 1);
    expect(demandes()).toBe(1);

    minuterie.avancerDe(1);
    expect(demandes()).toBe(2);

    repondre([]);
    minuterie.avancerDe(INTERVALLE_DE_RAFRAICHISSEMENT_MS);

    expect(demandes()).toBe(3);
    expect(client.etat.partiesPubliques).toEqual([]);
  });

  it('se rafraichit sans montrer la recherche: la liste affichee reste en place', () => {
    const { minuterie, client, repondre } = monter();

    client.naviguer('parties');
    repondre([PARTIE]);
    minuterie.avancerDe(INTERVALLE_DE_RAFRAICHISSEMENT_MS);

    expect(client.etat.listeEnCours).toBe(false);
    expect(client.etat.partiesPubliques).toEqual([PARTIE]);
  });

  it('ne se redemande pas tant que la reponse precedente n est pas arrivee', () => {
    const { minuterie, client, demandes } = monter();

    client.naviguer('parties');
    minuterie.avancerDe(INTERVALLE_DE_RAFRAICHISSEMENT_MS * 3);

    expect(demandes()).toBe(1);
  });

  it('cesse de se redemander quand on quitte l ecran', () => {
    const { minuterie, client, demandes, repondre } = monter();

    client.naviguer('parties');
    repondre([PARTIE]);
    client.naviguer('accueil');
    minuterie.avancerDe(INTERVALLE_DE_RAFRAICHISSEMENT_MS * 3);

    expect(demandes()).toBe(1);
    expect(minuterie.enAttente).toBe(0);
  });

  it('ne laisse aucun rafraichissement planifie quand le client se ferme', () => {
    const { minuterie, client } = monter();

    client.naviguer('parties');
    client.fermer();

    expect(minuterie.enAttente).toBe(0);
  });
});
