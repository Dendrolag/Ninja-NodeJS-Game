// @vitest-environment jsdom
/**
 * Tests de la ligne d'etat du lien, dans un document (etape 2.6).
 *
 * Ils montent un vrai client sur le banc d'essai du transport, avec une horloge et une
 * minuterie manuelles, et verifient que la ligne se cache quand tout va bien, dit que
 * le lien se retablit, puis qu'il est perdu avec « Réessayer », qui relance les essais,
 * et ne propose que de recharger une page d'une autre version.
 */

import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { HorlogeClientManuelle } from '../../horloge.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { MinuterieManuelle } from '../../minuterie.js';
import { creerMinuterieManuelle } from '../../minuterie.js';
import type { ReseauFactice } from '../../reseau.js';
import { SERVEUR_INJOIGNABLE, creerReseauFactice } from '../../reseau.js';
import { DUREE_DU_RETABLISSEMENT_MS } from '../../retablissement.js';
import { boutonNomme, boutonObligatoire, estCache, obligatoire } from '../essais.js';
import { TEXTE_LIEN_PERDU, TEXTE_RETABLISSEMENT } from '../modeles/lien.js';
import type { LigneDuLien } from './lien.js';
import { monterLigneDuLien } from './lien.js';

let reseau: ReseauFactice;
let horloge: HorlogeClientManuelle;
let minuterie: MinuterieManuelle;
let client: Client;
let ligne: LigneDuLien;
let desabonner: () => void;
let recharges: number;

/** Le texte de la ligne. */
function texte(): string | null {
  return obligatoire(ligne.racine, '.ligne-lien-texte').textContent;
}

beforeEach(() => {
  document.body.replaceChildren();
  reseau = creerReseauFactice();
  horloge = creerHorlogeClientManuelle();
  minuterie = creerMinuterieManuelle();
  client = creerClient({ reseau, horloge, minuterie });
  recharges = 0;

  client.ouvrir();
  reseau.simulerConnexion();
  client.naviguer('creation');

  ligne = monterLigneDuLien(document, client, () => {
    recharges += 1;
  });
  document.body.append(ligne.racine);
  ligne.afficher(client.etat);
  desabonner = client.abonner((etat) => {
    ligne.afficher(etat);
  });
});

afterEach(() => {
  desabonner();
  ligne.demonter();
  client.fermer();
});

describe('la ligne d etat du lien', () => {
  it('reste cachee tant que le lien va bien', () => {
    expect(estCache(ligne.racine)).toBe(true);
  });

  it('dit que le lien se retablit, sans rien proposer, puis se cache quand il revient', () => {
    reseau.simulerDeconnexion();

    expect(estCache(ligne.racine)).toBe(false);
    expect(texte()).toBe(TEXTE_RETABLISSEMENT);
    expect(boutonNomme(ligne.racine, 'Réessayer')).toBeUndefined();
    expect(boutonNomme(ligne.racine, 'Recharger la page')).toBeUndefined();
    expect(boutonNomme(ligne.racine, 'Continuer en invité')).toBeUndefined();

    reseau.simulerConnexion();

    expect(estCache(ligne.racine)).toBe(true);
  });

  it('dit la perte au bout de la minute et demie, et Réessayer relance les essais sans recharger', () => {
    reseau.simulerDeconnexion();
    horloge.avancerDe(DUREE_DU_RETABLISSEMENT_MS);
    minuterie.avancerDe(DUREE_DU_RETABLISSEMENT_MS);
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(texte()).toBe(TEXTE_LIEN_PERDU);
    const ouvertures = reseau.ouvertures.length;

    boutonObligatoire(ligne.racine, 'Réessayer').click();

    expect(client.etat.connexion).toBe('retablissement');
    expect(reseau.ouvertures).toHaveLength(ouvertures + 1);
    expect(texte()).toBe(TEXTE_RETABLISSEMENT);
    expect(recharges).toBe(0);
  });

  it('ne propose que de recharger une page d une autre version', () => {
    reseau.simulerDeconnexion();
    reseau.simulerRefus(MOTIF_VERSION_DIFFERENTE);

    expect(texte()).toBe(MOTIF_VERSION_DIFFERENTE);
    expect(boutonNomme(ligne.racine, 'Réessayer')).toBeUndefined();

    boutonObligatoire(ligne.racine, 'Recharger la page').click();

    expect(recharges).toBe(1);
  });
});
