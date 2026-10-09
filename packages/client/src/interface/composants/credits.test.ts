// @vitest-environment jsdom
/**
 * Tests de la fenetre des credits (etape 4.7), dans un document.
 *
 * Son ouverture depuis le pied de l'accueil est jouee par les tests de
 * l'application. Ici: ce qu'elle dit, comment elle se ferme, et le lien sur que
 * devient un nom avec une adresse, que les credits du jeu n'ont pas encore.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { boutonObligatoire, obligatoire } from '../essais.js';
import type { Credits } from '../modeles/credits.js';
import { monterCredits } from './credits.js';
import type { Fenetre } from './fenetre.js';

let fenetre: Fenetre;

/** Monte la fenetre dans le document, avec ces credits ou ceux du jeu. */
function monter(credits?: Credits): Fenetre {
  fenetre = monterCredits(document, credits);
  document.body.append(fenetre.racine);

  return fenetre;
}

afterEach(() => {
  fenetre.demonter();
  document.body.replaceChildren();
});

describe('la fenetre des credits', () => {
  it('se monte fermee, et porte le titre Credits', () => {
    monter();

    expect(fenetre.ouverte).toBe(false);
    expect(obligatoire(fenetre.racine, '[role="dialog"]').getAttribute('aria-label')).toBe(
      'Crédits',
    );
  });

  it('dit les deux lignes arretees avec le porteur du projet', () => {
    monter();

    const lignes = [...fenetre.corps.querySelectorAll('p')].map((p) => p.textContent);

    expect(lignes).toEqual([
      'Neon Ninja est une création originale de Dendrolag.',
      'Avec l’aimable participation de Bribz pour la carte Tokyo et les ninjas.',
      'Avec l’aimable participation de 2-Minute Tabletop pour les cartes Station lunaire et Prison Island, sous licence CC BY-NC 4.0.',
    ]);
  });

  it('ne fait pas du nom un lien, tant qu aucune adresse n est donnee', () => {
    monter();

    const bribz = [...fenetre.corps.querySelectorAll('p')][1];

    expect(bribz?.querySelector('a')).toBeNull();
    expect(obligatoire(fenetre.corps, 'strong').textContent).toBe('Bribz');
  });

  it('renvoie a l auteur de la Station lunaire et a sa licence (etape 8.9)', () => {
    monter();

    const liens = [...fenetre.corps.querySelectorAll('a')].map((lien) => [
      lien.textContent,
      lien.getAttribute('href'),
      lien.rel,
    ]);

    expect(liens).toEqual([
      ['2-Minute Tabletop', 'https://www.patreon.com/2minutetabletop', 'noopener noreferrer'],
      ['CC BY-NC 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/', 'noopener noreferrer'],
    ]);
  });

  it('fait d un nom avec adresse un lien vers elle, dans un nouvel onglet, sans rien transmettre', () => {
    monter({
      creation: 'Un jeu.',
      participations: [{ nom: 'Artiste', apport: 'le décor', adresse: 'https://exemple.org/@a' }],
    });

    const lien = obligatoire<HTMLAnchorElement>(fenetre.corps, 'a');

    expect(lien.textContent).toBe('Artiste');
    expect(lien.getAttribute('href')).toBe('https://exemple.org/@a');
    expect(lien.target).toBe('_blank');
    expect(lien.rel).toBe('noopener noreferrer');
    expect(lien.closest('p')?.textContent).toBe(
      'Avec l’aimable participation de Artiste pour le décor.',
    );
  });

  it('se ferme par Echap et par sa croix', () => {
    monter();

    fenetre.ouvrir();
    expect(fenetre.ouverte).toBe(true);

    obligatoire(fenetre.racine, '[role="dialog"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(fenetre.ouverte).toBe(false);

    fenetre.ouvrir();
    boutonObligatoire(fenetre.racine, 'Fermer').click();
    expect(fenetre.ouverte).toBe(false);
  });
});
