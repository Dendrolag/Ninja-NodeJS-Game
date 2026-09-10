// @vitest-environment jsdom
/**
 * Tests du panneau de reglages, dans un document.
 *
 * LE TEST EXIGE PAR LA FICHE 4.3: une configuration invalide est signalee cote
 * client, et elle ne part pas. Le motif affiche est celui que le serveur donnerait;
 * cette identite est verifiee contre un vrai serveur dans
 * tests/client/integration/reglages-serveur.test.ts.
 */

import type { ReglagesPartie } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT, completerReglages } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { boutonObligatoire, cocher, estCache, obligatoire, saisir, soumettre } from '../essais.js';
import type { PanneauReglages } from './reglages.js';
import { monterPanneauReglages } from './reglages.js';

let panneau: PanneauReglages;
let enregistres: ReglagesPartie[];

/** La saisie d'un reglage, retrouvee par son chemin. */
function champ(chemin: string): HTMLInputElement {
  return obligatoire<HTMLInputElement>(panneau.racine, `[data-chemin="${chemin}"]`);
}

/** Le motif affiche sous un reglage, ou rien s'il est cache. */
function motif(chemin: string): string | undefined {
  const element = champ(chemin).closest('label, .champ-carte')?.querySelector('.champ-erreur');

  return element === null || element === undefined || estCache(element)
    ? undefined
    : (element.textContent ?? undefined);
}

beforeEach(() => {
  document.body.replaceChildren();
  enregistres = [];
  panneau = monterPanneauReglages({
    document,
    surEnregistrer: (reglages) => {
      enregistres.push(reglages);
    },
  });
  document.body.append(panneau.racine);
  panneau.ouvrirAvec(REGLAGES_PAR_DEFAUT);
});

afterEach(() => {
  panneau.demonter();
});

describe('le panneau de reglages', () => {
  it('s ouvre rempli avec les reglages de la partie', () => {
    expect(panneau.ouvert).toBe(true);
    expect(champ('dureePartieS').value).toBe('180');
    expect(champ('bonus.types.vitesse.dureeS').value).toBe('10');
    expect(champ('botsNoirs.actifs').checked).toBe(true);
    expect(obligatoire<HTMLInputElement>(panneau.racine, 'input[value="map1"]').checked).toBe(true);
  });

  it('signale une configuration invalide sur son champ, avec le motif du serveur', () => {
    saisir(champ('bonus.types.vitesse.dureeS'), '50');

    expect(motif('bonus.types.vitesse.dureeS')).toBe(
      'Ce réglage doit se trouver entre 5 et 30, bornes comprises.',
    );
    expect(champ('bonus.types.vitesse.dureeS').hasAttribute('aria-invalid')).toBe(true);
    expect(boutonObligatoire(panneau.racine, 'Enregistrer').disabled).toBe(true);
  });

  it('n envoie pas une configuration invalide, ni par le bouton ni par la touche Entree', () => {
    saisir(champ('malus.intervalleApparitionS'), '');

    boutonObligatoire(panneau.racine, 'Enregistrer').click();
    soumettre(obligatoire<HTMLFormElement>(panneau.racine, 'form'));

    expect(enregistres).toEqual([]);
    expect(panneau.ouvert).toBe(true);
    expect(motif('malus.intervalleApparitionS')).toBe('Ce réglage doit être un nombre entier.');
  });

  it('signale une duree minimale de zone plus longue que la maximale', () => {
    saisir(champ('zones.dureeMinimumS'), '40');

    expect(motif('zones.dureeMinimumS')).toBe(
      "La durée minimale d'une zone ne peut pas dépasser sa durée maximale.",
    );
  });

  it('efface le motif des que la saisie redevient valide', () => {
    saisir(champ('bonus.types.vitesse.dureeS'), '50');
    saisir(champ('bonus.types.vitesse.dureeS'), '20');

    expect(motif('bonus.types.vitesse.dureeS')).toBeUndefined();
    expect(boutonObligatoire(panneau.racine, 'Enregistrer').disabled).toBe(false);
  });

  it('enregistre les reglages saisis, complets, et se ferme', () => {
    cocher(obligatoire<HTMLInputElement>(panneau.racine, 'input[value="map3"]'), true);
    cocher(champ('modeMiroir'), true);
    saisir(champ('nombreBotsInitial'), '120');
    cocher(champ('zones.types.chaos'), false);

    boutonObligatoire(panneau.racine, 'Enregistrer').click();

    expect(enregistres).toEqual([
      completerReglages({
        carte: 'map3',
        modeMiroir: true,
        nombreBotsInitial: 120,
        zones: { types: { chaos: false } },
      }),
    ]);
    expect(panneau.ouvert).toBe(false);
  });

  it('remet les valeurs par defaut sur demande', () => {
    saisir(champ('dureePartieS'), '60');

    boutonObligatoire(panneau.racine, 'Valeurs par défaut').click();

    expect(champ('dureePartieS').value).toBe('180');
  });
});
