/**
 * Tests du cercle de vision d'Among Ninjas (etape 7.20): le masque du decor eteint contient
 * toujours le disque en entier, meme au bord de la carte. Sur la carte seule, un disque qui
 * debordait ne se decoupait plus, et le decor eteint recouvrait tout (retour d'essai du porteur
 * du projet, 10 octobre 2026).
 */

import { CARTES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { cadreDuMasque } from './among.js';

const TOKYO = CARTES.map1;

describe('le masque du cercle de vision', () => {
  it('contient le disque en entier, au milieu comme contre chaque bord et dans les coins', () => {
    const rayon = 380;
    const places = [
      { x: TOKYO.largeur / 2, y: TOKYO.hauteur / 2 },
      { x: 16, y: TOKYO.hauteur / 2 },
      { x: TOKYO.largeur - 16, y: TOKYO.hauteur / 2 },
      { x: TOKYO.largeur / 2, y: 16 },
      { x: TOKYO.largeur / 2, y: TOKYO.hauteur - 16 },
      { x: 0, y: 0 },
      { x: TOKYO.largeur, y: TOKYO.hauteur },
    ];

    for (const place of places) {
      const cadre = cadreDuMasque(TOKYO, { ...place, rayon });

      expect(cadre.x).toBeLessThan(place.x - rayon);
      expect(cadre.y).toBeLessThan(place.y - rayon);
      expect(cadre.x + cadre.largeur).toBeGreaterThan(place.x + rayon);
      expect(cadre.y + cadre.hauteur).toBeGreaterThan(place.y + rayon);
    }
  });

  it('couvre toute la carte', () => {
    const cadre = cadreDuMasque(TOKYO, { x: 1000, y: 750, rayon: 200 });

    expect(cadre.x).toBeLessThanOrEqual(0);
    expect(cadre.y).toBeLessThanOrEqual(0);
    expect(cadre.x + cadre.largeur).toBeGreaterThanOrEqual(TOKYO.largeur);
    expect(cadre.y + cadre.hauteur).toBeGreaterThanOrEqual(TOKYO.hauteur);
  });
});
