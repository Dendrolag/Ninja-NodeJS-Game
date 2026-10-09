// @vitest-environment jsdom
/**
 * Tests des bulles des zones, dans un document (9 octobre 2026). Quelles bulles montrer est
 * couvert par src/guideDesZones.test.ts; ici, ce qui se voit: une bulle posee, deplacee,
 * retiree, et jamais recreee tant qu'elle reste.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AfficheurDeBulles, BulleAAfficher } from './bullesDeZone.js';
import { monterBullesDeZone } from './bullesDeZone.js';

/** La bulle d'une mine de chaos, a cette place. */
function bulleDeMine(x: number, y: number): BulleAAfficher {
  return {
    cle: 'mine:m1',
    genre: 'mine',
    texte: 'Chaos · les ninjas changent de couleur',
    nature: 'chaos',
    x,
    y,
  };
}

let hote: HTMLElement;
let bulles: AfficheurDeBulles;

beforeEach(() => {
  hote = document.createElement('div');
  hote.append(document.createElement('section'));
  document.body.replaceChildren(hote);
  bulles = monterBullesDeZone({ hote });
});

afterEach(() => {
  bulles.demonter();
});

describe('les bulles des zones', () => {
  it('passent sous le reste de l hote: leur calque est son premier enfant', () => {
    expect(hote.firstElementChild?.className).toBe('bulles-de-zone');
  });

  it('posent le texte d une mine a sa place, a la couleur de sa zone', () => {
    bulles.afficher([bulleDeMine(120.4, 80.6)]);

    const ancre = hote.querySelector<HTMLElement>('.bulle-de-zone-ancre');
    const corps = hote.querySelector<HTMLElement>('.bulle-de-zone-mine');

    expect(ancre?.style.transform).toBe('translate(120px, 81px)');
    expect(corps?.textContent).toBe('Chaos · les ninjas changent de couleur');
    expect(corps?.dataset['nature']).toBe('chaos');
    expect(corps?.style.getPropertyValue('--couleur-zone')).toBe('#ff4d4d');
  });

  it('deplacent la meme bulle d une image a l autre, puis la retirent', () => {
    bulles.afficher([bulleDeMine(10, 10)]);
    const premiere = hote.querySelector('.bulle-de-zone-ancre');

    bulles.afficher([bulleDeMine(30, 40)]);

    expect(hote.querySelector('.bulle-de-zone-ancre')).toBe(premiere);
    expect((premiere as HTMLElement).style.transform).toBe('translate(30px, 40px)');

    bulles.afficher([]);
    expect(hote.querySelector('.bulle-de-zone-ancre')).toBeNull();
  });

  it('montrent le masque en pictogramme, sans texte', () => {
    bulles.afficher([
      { cle: 'masque', genre: 'masque', texte: '', nature: 'invisibilite', x: 0, y: 0 },
    ]);

    const masque = hote.querySelector('.bulle-de-zone-masque');

    expect(masque?.querySelector('svg')).not.toBeNull();
    expect(masque?.textContent).toBe('');
  });

  it('posent le texte comme du texte, jamais comme du balisage', () => {
    bulles.afficher([{ ...bulleDeMine(0, 0), texte: '<b>Chaos</b>' }]);

    expect(hote.querySelector('.bulle-de-zone b')).toBeNull();
  });
});
