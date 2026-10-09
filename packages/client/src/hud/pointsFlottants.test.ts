// @vitest-environment jsdom
/**
 * Tests de l'affichage des points flottants, dans un document.
 *
 * Le calcul des points est couvert par src/pointsFlottants.test.ts. Ici, ce qui se
 * voit: un point pose a sa place, qui file vers notre score une fois monte, puis
 * disparait. Les animations ne jouent pas dans un document de test: on annonce
 * leur fin a la main, comme le ferait le navigateur.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AfficheurDePoints } from './pointsFlottants.js';
import { monterPointsFlottants } from './pointsFlottants.js';

/** Un rectangle d'element, tel que le navigateur le mesurerait. */
function rectangle(gauche: number, haut: number, largeur: number, hauteur: number): DOMRect {
  return {
    left: gauche,
    top: haut,
    width: largeur,
    height: hauteur,
    right: gauche + largeur,
    bottom: haut + hauteur,
    x: gauche,
    y: haut,
    toJSON: () => ({}),
  };
}

let hote: HTMLElement;
let score: HTMLElement | null;
let afficheur: AfficheurDePoints;

/** Les points actuellement poses. */
function points(): HTMLElement[] {
  return [...hote.querySelectorAll<HTMLElement>('.point-flottant')];
}

/** Annonce la fin de l'animation en cours d'un point. */
function finirLAnimation(point: HTMLElement | undefined): void {
  point?.dispatchEvent(new Event('animationend'));
}

beforeEach(() => {
  hote = document.createElement('div');
  hote.getBoundingClientRect = () => rectangle(10, 5, 1280, 720);
  document.body.append(hote);

  score = document.createElement('span');
  score.getBoundingClientRect = () => rectangle(310, 25, 20, 10);
  hote.append(score);

  afficheur = monterPointsFlottants({ hote, document, cible: () => score });
});

afterEach(() => {
  afficheur.demonter();
  hote.remove();
});

describe('monterPointsFlottants', () => {
  it('pose le gain a l endroit indique, avec son texte, et le fait monter', () => {
    afficheur.montrer({ texte: '+1', genre: 'bot', niveau: 1, x: 120, y: 80 });

    const [point] = points();

    expect(point?.textContent).toBe('+1');
    expect(point?.classList.contains('point-flottant-bot')).toBe(true);
    expect(point?.classList.contains('monte')).toBe(true);
    expect(point?.style.left).toBe('120px');
    expect(point?.style.top).toBe('80px');
  });

  it('porte le niveau du combo, qui en decide la couleur et la taille (etape 7.5)', () => {
    afficheur.montrer({ texte: '+4', genre: 'bot', niveau: 4, x: 0, y: 0 });

    expect(points()[0]?.dataset['niveau']).toBe('4');
  });

  it('file vers le milieu de notre score une fois monte, puis disparait', () => {
    afficheur.montrer({ texte: '+15', genre: 'botNoir', niveau: 1, x: 100, y: 200 });
    const [point] = points();

    finirLAnimation(point);

    // Le milieu du score, dans le repere de l'hote: (310 + 10 - 10, 25 + 5 - 5).
    expect(point?.classList.contains('rejoint')).toBe(true);
    expect(point?.style.getPropertyValue('--cible-x')).toBe('210px');
    expect(point?.style.getPropertyValue('--cible-y')).toBe('-175px');

    finirLAnimation(point);

    expect(points()).toHaveLength(0);
  });

  it('disparait des qu il est monte quand notre score n est pas affiche', () => {
    score = null;
    afficheur.montrer({ texte: '+7', genre: 'joueur', niveau: 1, x: 100, y: 200 });

    finirLAnimation(points()[0]);

    expect(points()).toHaveLength(0);
  });

  it('pose le texte comme du texte, jamais comme du balisage', () => {
    afficheur.montrer({ texte: '<b>+1</b>', genre: 'bot', niveau: 1, x: 0, y: 0 });

    expect(points()[0]?.querySelector('b')).toBeNull();
  });

  it('retire tous les points au demontage', () => {
    afficheur.montrer({ texte: '+1', genre: 'bot', niveau: 1, x: 0, y: 0 });
    afficheur.montrer({ texte: '+1', genre: 'bot', niveau: 1, x: 5, y: 5 });

    afficheur.demonter();

    expect(points()).toHaveLength(0);
  });
});

describe('le palier d un combo (9 octobre 2026)', () => {
  /** Un palier x3 sur notre ninja, au centre de l'hote. */
  const palier = { texte: 'Combo x3', genre: 'combo', niveau: 3, x: 640, y: 360 } as const;

  it('nait au-dessus de notre ninja, a la couleur de son cran, et s efface sans filer', () => {
    afficheur.montrer(palier);

    const [point] = points();

    expect(point?.className).toBe('point-flottant point-flottant-combo palier');
    expect(point?.dataset['niveau']).toBe('3');
    expect(point?.textContent).toBe('Combo x3');

    finirLAnimation(point);

    expect(points()).toEqual([]);
  });

  it('se pose sous notre ninja quand un grand titre occupe deja sa place', () => {
    const titre = document.createElement('div');
    titre.className = 'grand-titre';
    // Le bas du titre descend a 300 pixels, au-dessus de notre ninja pose a 365.
    titre.getBoundingClientRect = () => rectangle(300, 200, 680, 100);
    document.body.append(titre);

    afficheur.montrer(palier);

    expect(points()[0]?.classList.contains('dessous')).toBe(true);
    titre.remove();
  });

  it('reste au-dessus quand le grand titre est plus haut que sa place', () => {
    const titre = document.createElement('div');
    titre.className = 'grand-titre';
    titre.getBoundingClientRect = () => rectangle(300, 40, 680, 100);
    document.body.append(titre);

    afficheur.montrer(palier);

    expect(points()[0]?.classList.contains('dessous')).toBe(false);
    titre.remove();
  });
});
