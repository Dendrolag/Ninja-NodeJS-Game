// @vitest-environment jsdom
/**
 * Tests de la fenetre des nouveautes (etape 4.9), dans un document.
 *
 * Son ouverture a l'accueil et par le pied est jouee par les tests de l'application.
 * Ici: ce qu'elle dit, dans quel ordre, comment elle se lit au lecteur d'ecran, et
 * qu'elle previent a chaque fermeture, quelle qu'en soit la facon.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { boutonObligatoire, obligatoire } from '../essais.js';
import { notesParues } from '../modeles/notesDeVersion.js';
import type { Fenetre } from './fenetre.js';
import { monterNouveautes } from './noteDeVersion.js';

let fenetre: Fenetre;
let fermetures: number;

/** Monte dans le document les nouveautes parues jusqu'a la version 1.7. */
function monter(): Fenetre {
  fermetures = 0;
  fenetre = monterNouveautes(document, notesParues('1.7.0'), () => {
    fermetures += 1;
  });
  document.body.append(fenetre.racine);

  return fenetre;
}

/** Les lignes de la note de ce rang, la plus recente etant la premiere. */
function puces(rang: number): HTMLLIElement[] {
  const section = fenetre.corps.querySelectorAll('.note-section')[rang];

  return section === undefined ? [] : [...section.querySelectorAll('li')];
}

afterEach(() => {
  fenetre.demonter();
  document.body.replaceChildren();
});

describe('la fenetre des nouveautes', () => {
  it('se monte fermee, sous le titre Nouveautés', () => {
    monter();

    expect(fenetre.ouverte).toBe(false);
    expect(obligatoire(fenetre.racine, '[role="dialog"]').getAttribute('aria-label')).toBe(
      'Nouveautés',
    );
  });

  it('montre tout l historique, la derniere note en tete, chacune sous son numero', () => {
    monter();

    const titres = [...fenetre.corps.querySelectorAll('h3')].map((h3) => h3.textContent);

    expect(titres).toEqual([
      '1.7 · Le lundi, c’est défis',
      '1.6 · On a marché sur la Lune',
      '1.5 · Coups fourrés',
    ]);
  });

  it('dit chaque nouveaute en puce, son intitule en gras', () => {
    monter();

    const coupsFourres = puces(2);
    const defis = puces(0);

    expect(coupsFourres).toHaveLength(5);
    expect(coupsFourres[0]?.querySelector('strong')?.textContent).toBe('La poche.');
    expect(coupsFourres[0]?.textContent).toMatch(/^La poche\. Ramassez un objet/);
    // La derniere ligne des defis n'a pas d'intitule: pas de gras vide.
    expect(defis[2]?.querySelector('strong')).toBeNull();
    expect(defis[2]?.textContent).toMatch(/^Pour les joueurs connectés/);
  });

  it('se ferme par son bouton, sa croix et Echap, et previent a chaque fois', () => {
    monter();

    fenetre.ouvrir();
    boutonObligatoire(fenetre.racine, 'À l’attaque').click();
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
