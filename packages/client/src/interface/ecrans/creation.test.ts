// @vitest-environment jsdom
/**
 * Tests de l'ecran de creation, dans un document.
 *
 * Le test exige par la fiche pour le formulaire de creation: une configuration
 * invalide est signalee cote client sur son champ, et elle ne part pas. On y verifie
 * aussi qu'une partie privee se cree aux reglages choisis et mene a son salon, code
 * compris, et qu'un seul mode est propose.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { completerReglages } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import type { Application } from '../application.js';
import { monterApplication } from '../application.js';
import { boutonObligatoire, cocher, estCache, jeuDEssai, obligatoire, saisir } from '../essais.js';

let hote: HTMLElement;
let reseau: ReseauFactice;
let client: Client;
let application: Application;

/** L'ecran affiche par l'application. */
function ecranAffiche(): string | undefined {
  return obligatoire(hote, '.application').dataset['ecran'];
}

/** Une saisie de l'ecran. */
function champ(selecteur: string): HTMLInputElement {
  return obligatoire<HTMLInputElement>(hote, selecteur);
}

/** Le bouton de creation. */
function creerLeSalon(): HTMLButtonElement {
  return boutonObligatoire(hote, 'Créer le salon');
}

beforeEach(() => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);

  reseau = creerReseauFactice();
  client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
  application = monterApplication({
    hote,
    client,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeuDEssai().monteur,
    recharger: () => undefined,
  });
  reseau.simulerConnexion('moi');

  saisir(champ('input[name="pseudo"]'), 'Alice');
  boutonObligatoire(hote, 'Créer une partie').click();
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('l ecran de creation', () => {
  it('ne propose que le mode Classique, et annonce les autres sans les proposer', () => {
    expect(ecranAffiche()).toBe('creation');
    expect(obligatoire(hote, '.tuile-choisie').textContent).toContain('Classique');

    const aVenir = obligatoire(hote, '.tuile-a-venir');

    expect(aVenir.getAttribute('aria-disabled')).toBe('true');
    expect(aVenir.querySelector('input')).toBeNull();
  });

  it('signale une configuration invalide sur son champ, et ne la laisse pas partir', () => {
    const duree = champ('[data-chemin="bonus.types.vitesse.dureeS"]');

    saisir(duree, '50');

    const motif = duree.closest('label')?.querySelector('.champ-erreur');

    expect(motif === null || motif === undefined ? true : estCache(motif)).toBe(false);
    expect(motif?.textContent).toBe('Ce réglage doit se trouver entre 5 et 30, bornes comprises.');
    expect(creerLeSalon().disabled).toBe(true);

    creerLeSalon().click();

    expect(reseau.dernier('creerPartie')).toBeUndefined();
  });

  it('cree une partie privee aux reglages choisis, et mene a son salon, code compris', () => {
    cocher(champ('input[name="visibilite"][value="privee"]'), true);
    cocher(champ('input[value="map3"]'), true);

    expect(obligatoire(hote, '.creation-recapitulatif h2').textContent).toBe(
      'Classique · Spirit & Time',
    );

    creerLeSalon().click();

    expect(reseau.dernier('creerPartie')?.[0]).toEqual({
      pseudo: 'Alice',
      configuration: {
        mode: 'classique',
        visibilite: 'privee',
        reglages: completerReglages({ carte: 'map3' }),
      },
    });

    const salon: InfosSalon = {
      idRoom: 'room-7',
      statut: 'salon',
      mode: 'classique',
      visibilite: 'privee',
      code: 'NX7K2P',
      capacite: 12,
      joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true }],
      reglages: completerReglages({ carte: 'map3' }),
    };
    reseau.dernier('creerPartie')?.[1]({ valide: true, valeur: salon });

    expect(ecranAffiche()).toBe('salon');
    expect(obligatoire(hote, '.salon-code-valeur').textContent).toBe('NX7K2P');
  });

  it('montre le refus du serveur sans quitter l ecran', () => {
    creerLeSalon().click();
    reseau.dernier('creerPartie')?.[1]({
      valide: false,
      erreurs: [{ champ: 'configuration.mode', motif: "Ce mode de jeu n'existe pas." }],
    });

    expect(ecranAffiche()).toBe('creation');
    expect(obligatoire(hote, '.creation-erreur').textContent).toBe("Ce mode de jeu n'existe pas.");
  });

  it('replie les reglages avances, sans les retirer', () => {
    const avances = obligatoire<HTMLDetailsElement>(hote, '.reglages-avances');

    expect(avances.open).toBe(false);
    expect(avances.querySelector('[data-chemin="zones.actives"]')).not.toBeNull();
  });
});
