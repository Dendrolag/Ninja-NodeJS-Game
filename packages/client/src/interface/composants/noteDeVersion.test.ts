// @vitest-environment jsdom
/**
 * Tests de la fenetre de la note de version (etape 4.9), dans un document.
 *
 * Son ouverture a l'accueil et par le pied est jouee par les tests de l'application.
 * Ici: ce qu'elle dit, comment elle se lit au lecteur d'ecran, et qu'elle previent a
 * chaque fermeture, quelle qu'en soit la facon.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { boutonObligatoire, obligatoire } from '../essais.js';
import { noteDeLaVersion } from '../modeles/notesDeVersion.js';
import type { Fenetre } from './fenetre.js';
import { monterNoteDeVersion } from './noteDeVersion.js';

let fenetre: Fenetre;
let fermetures: number;

/** Monte la note 1.5 dans le document. */
function monter(): Fenetre {
  const note = noteDeLaVersion('1.5.0');

  if (note === undefined) {
    throw new Error('La note 1.5 manque.');
  }

  fermetures = 0;
  fenetre = monterNoteDeVersion(document, note, () => {
    fermetures += 1;
  });
  document.body.append(fenetre.racine);

  return fenetre;
}

afterEach(() => {
  fenetre.demonter();
  document.body.replaceChildren();
});

describe('la fenetre de la note de version', () => {
  it('se monte fermee, et porte le titre de la note', () => {
    monter();

    expect(fenetre.ouverte).toBe(false);
    expect(obligatoire(fenetre.racine, '[role="dialog"]').getAttribute('aria-label')).toBe(
      'Nouveautés de la version 1.5',
    );
  });

  it('dit chaque section sous son titre, et chaque nouveaute en puce', () => {
    monter();

    const titres = [...fenetre.corps.querySelectorAll('h3')].map((h3) => h3.textContent);
    const puces = [...fenetre.corps.querySelectorAll('li')];

    expect(titres).toEqual(['Objets, poche et mines', 'L’Évadé']);
    expect(puces).toHaveLength(5);
    expect(puces[0]?.querySelector('strong')?.textContent).toBe('La poche.');
    expect(puces[0]?.textContent).toMatch(/^La poche\. Elle garde un objet ramassé/);
    // L'Evade n'a pas d'intitule: pas de gras vide.
    expect(puces[4]?.querySelector('strong')).toBeNull();
    expect(puces[4]?.textContent).toMatch(/^Un ninja rayé rouge et blanc/);
  });

  it('se ferme par son bouton, sa croix et Echap, et previent a chaque fois', () => {
    monter();

    fenetre.ouvrir();
    boutonObligatoire(fenetre.racine, 'Compris').click();
    expect(fenetre.ouverte).toBe(false);

    fenetre.ouvrir();
    boutonObligatoire(fenetre.racine, 'Fermer').click();
    expect(fenetre.ouverte).toBe(false);

    fenetre.ouvrir();
    obligatoire(fenetre.racine, '[role="dialog"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(fenetre.ouverte).toBe(false);

    expect(fermetures).toBe(3);
  });
});
