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
