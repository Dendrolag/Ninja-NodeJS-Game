// @vitest-environment jsdom
/**
 * Tests de la fenetre « Comment jouer » (etape 5.5).
 *
 * Les bonus et les malus y etaient illisibles sur le fond sombre, et chaque icone
 * se montrait en double: l'aide posait la planche entiere, deux images cote a cote,
 * dans un carre. Elle montre maintenant une image a la fois, animee comme en partie,
 * sur un halo clair.
 */

import { IMAGES_PAR_OBJET } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { CADENCE_OBJET_MS } from '../../rendu/apparence.js';
import { monterAide } from './aide.js';

describe('les objets de l aide', () => {
  it('montrent une seule image de leur planche, animee a la cadence du jeu, sur un halo', () => {
    const aide = monterAide(document);
    const icones = [...aide.racine.querySelectorAll<HTMLElement>('.aide-icone')];

    expect(icones.length).toBeGreaterThan(0);
    expect(aide.racine.querySelector('img.aide-icone')).toBeNull();

    for (const icone of icones) {
      // Les icones du jeu d'origine en PNG, celles du Tactique en SVG (etape 7.7).
      expect(icone.style.backgroundImage).toMatch(/objets\/.+\.(?:png|svg)/u);
      expect(icone.style.getPropertyValue('--images')).toBe(String(IMAGES_PAR_OBJET));
      expect(icone.style.getPropertyValue('--duree')).toBe(
        `${String(CADENCE_OBJET_MS * IMAGES_PAR_OBJET)}ms`,
      );
      expect(icone.parentElement?.classList.contains('aide-halo')).toBe(true);
    }
  });
});

describe('les textes de l aide', () => {
  /** Le texte visible de l'aide, espaces ramenes a un seul. */
  function texteDeLAide(): string {
    return (monterAide(document).corps.textContent ?? '').replace(/\s+/gu, ' ');
  }

  it('ecrivent en lettres les petits nombres tires des constantes', () => {
    const texte = texteDeLAide();

    expect(texte).toContain('Cinq charges, une revient toutes les cinq secondes.');
    expect(texte).toContain('Un Black Ninja encaisse trois tirs avant de tomber.');
    expect(texte).toContain('et à la troisième ils sont éliminés.');
    expect(texte).toContain('Leurs charges mettent dix secondes à revenir.');
    expect(texte).toContain('la zone s’ouvre trois secondes plus tard.');
    expect(texte).not.toMatch(/undefined|NaN/u);
  });

  it('laissent l Evade a decouvrir, et donnent une section aux Black Ninjas', () => {
    const titres = [...monterAide(document).corps.querySelectorAll('h3')].map(
      (h3) => h3.textContent,
    );
    const texte = texteDeLAide();

    expect(titres.slice(0, 3)).toEqual(['Le principe', 'Les Black Ninjas', 'L’Évadé']);
    expect(texte).toContain('peut-être vaudrait-il le coup de l’attraper…');
    expect(texte).not.toContain('x2');
  });
});
