// @vitest-environment jsdom
/**
 * Tests de la surcouche du HUD: les cartes des effets en cours (etape 4.6).
 *
 * Une carte par effet, a la couleur et avec l'icone de son objet, et une jauge. Les
 * cartes sont reutilisees d'une image a l'autre: reconstruite a chaque image, une carte
 * ferait repartir son clignotement de fin a zero, et il ne se verrait jamais.
 */

import { describe, expect, it } from 'vitest';

import type { EffetHud, Hud } from './modele.js';
import { HUD_VIDE } from './modele.js';
import { monterSurcouche } from './surcouche.js';

/** Un effet affiche. */
function effet(modifications: Partial<EffetHud> = {}): EffetHud {
  return {
    nature: 'vitesse',
    categorie: 'bonus',
    libelle: 'Boost',
    couleur: 0x00ff00,
    resteMs: 4_000,
    resteS: 4,
    part: 0.4,
    finProche: false,
    auxAutres: false,
    icone: '/assets/objets/speed.png',
    ...modifications,
  };
}

/** Un HUD de partie avec ces effets. */
function hud(effets: readonly EffetHud[]): Hud {
  return { ...HUD_VIDE, temps: '2:00', effets };
}

/** Une surcouche montee dans un hote neuf. */
function surcouche() {
  const hote = document.createElement('div');
  const monte = monterSurcouche({ hote, carte: { largeur: 2000, hauteur: 1500 } });

  return { hote, monte };
}

describe('les cartes des effets', () => {
  it('pose une carte par effet, avec sa couleur, son icone, son reste et sa jauge', () => {
    const { hote, monte } = surcouche();

    monte.afficher(hud([effet()]));

    const carte = hote.querySelector<HTMLElement>('.hud-effet');

    expect(carte?.classList.contains('hud-effet-bonus')).toBe(true);
    expect(carte?.style.getPropertyValue('--couleur-effet')).toBe('#00ff00');
    expect(carte?.style.getPropertyValue('--part')).toBe('0.4');
    expect(carte?.querySelector('.hud-effet-libelle')?.textContent).toBe('Boost');
    expect(carte?.querySelector('.hud-effet-reste')?.textContent).toBe('4s');
    expect(
      carte?.querySelector<HTMLElement>('.hud-effet-pictogramme')?.style.backgroundImage,
    ).toContain('/assets/objets/speed.png');
    expect(carte?.querySelector('.hud-effet-jauge')).not.toBeNull();
  });

  it('reutilise la carte d une image a l autre, et la fait clignoter en fin d effet', () => {
    const { hote, monte } = surcouche();

    monte.afficher(hud([effet()]));
    const avant = hote.querySelector('.hud-effet');
    monte.afficher(hud([effet({ resteMs: 2_000, resteS: 2, part: 0.2, finProche: true })]));
    const apres = hote.querySelector('.hud-effet');

    expect(apres).toBe(avant);
    expect(apres?.classList.contains('fin-proche')).toBe(true);
    expect(apres?.querySelector('.hud-effet-reste')?.textContent).toBe('2s');
  });

  it('retire la carte d un effet fini', () => {
    const { hote, monte } = surcouche();

    monte.afficher(hud([effet()]));
    monte.afficher(hud([]));

    expect(hote.querySelector('.hud-effet')).toBeNull();
  });

  it('dit d un malus que nous infligeons qu il frappe les autres', () => {
    const { hote, monte } = surcouche();

    monte.afficher(
      hud([
        effet({
          nature: 'negatif',
          categorie: 'malus',
          libelle: 'Vision négative',
          couleur: 0xaa44ff,
          auxAutres: true,
        }),
      ]),
    );

    const carte = hote.querySelector('.hud-effet');

    expect(carte?.classList.contains('hud-effet-malus')).toBe(true);
    expect(carte?.classList.contains('aux-autres')).toBe(true);
    expect(carte?.querySelector('.hud-effet-cible')?.textContent).toBe('aux autres');
  });

  it('range les cartes du plus proche de sa fin au plus lointain', () => {
    const { hote, monte } = surcouche();

    monte.afficher(
      hud([effet({ nature: 'invincibilite', libelle: 'Invincibilité', resteMs: 1_000 }), effet()]),
    );

    const ordres = [...hote.querySelectorAll<HTMLElement>('.hud-effet')].map((carte) => [
      carte.querySelector('.hud-effet-libelle')?.textContent,
      carte.style.order,
    ]);

    expect(ordres).toEqual([
      ['Invincibilité', '0'],
      ['Boost', '1'],
    ]);
  });
});
