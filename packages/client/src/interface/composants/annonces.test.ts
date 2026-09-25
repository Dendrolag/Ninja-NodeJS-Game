// @vitest-environment jsdom
/**
 * Tests du fil des annonces et du grand titre des objets (etape 4.6).
 *
 * Le grand titre ne passe pas par le fil: il se pose seul au centre de l'ecran, et le
 * suivant remplace le precedent. Son texte est pose comme du texte, jamais comme du
 * balisage: un pseudo de joueur peut s'y trouver.
 */

import { describe, expect, it } from 'vitest';

import type { Annonce } from '../../annonces.js';
import { ANNONCES_VISIBLES_MAXIMUM, monterFilDAnnonces } from './annonces.js';

/** L'annonce d'un malus subi, avec son grand titre. */
function malus(parPseudo: string): Annonce {
  return {
    texte: `${parPseudo} vous a volé vos lunettes`,
    ton: 'alerte',
    grandTitre: {
      surtitre: 'Malus',
      titre: 'Vision floue',
      ligne: `${parPseudo} vous a volé vos lunettes`,
      couleur: 0x44aaff,
      icone: '/assets/objets/blur.png',
      brouille: true,
    },
  };
}

describe('le fil des annonces', () => {
  it('pose une annonce ordinaire dans le fil, sans grand titre', () => {
    const fil = monterFilDAnnonces(document);

    fil.ajouter({ texte: 'Eve a rejoint la partie', ton: 'info' });

    expect(fil.racine.querySelectorAll('.annonces .annonce')).toHaveLength(1);
    expect(fil.racine.querySelector('.grand-titre')).toBeNull();
  });

  it('borne le fil a quatre annonces', () => {
    const fil = monterFilDAnnonces(document);

    for (let rang = 0; rang < 6; rang += 1) {
      fil.ajouter({ texte: `Annonce ${String(rang)}`, ton: 'info' });
    }

    expect(fil.racine.querySelectorAll('.annonce')).toHaveLength(ANNONCES_VISIBLES_MAXIMUM);
  });

  it('montre un objet en grand titre, a sa couleur, avec son icone', () => {
    const fil = monterFilDAnnonces(document);

    fil.ajouter(malus('Bob'));

    const titre = fil.racine.querySelector<HTMLElement>('.grands-titres .grand-titre');

    expect(fil.racine.querySelector('.annonce')).toBeNull();
    expect(titre?.classList.contains('brouille')).toBe(true);
    expect(titre?.style.getPropertyValue('--couleur-objet')).toBe('#44aaff');
    expect(titre?.querySelector('.grand-titre-surtitre')?.textContent).toBe('Malus');
    expect(titre?.querySelector('.grand-titre-titre')?.textContent).toBe('Vision floue');
    expect(
      titre?.querySelector<HTMLElement>('.grand-titre-pictogramme')?.style.backgroundImage,
    ).toContain('/assets/objets/blur.png');
  });

  it('ne garde qu un grand titre: le suivant remplace le precedent', () => {
    const fil = monterFilDAnnonces(document);

    fil.ajouter(malus('Bob'));
    fil.ajouter(malus('Eve'));

    const titres = fil.racine.querySelectorAll('.grand-titre');

    expect(titres).toHaveLength(1);
    expect(titres[0]?.querySelector('.grand-titre-ligne')?.textContent).toContain('Eve');
  });

  it('pose un pseudo comme du texte, jamais comme du balisage', () => {
    const fil = monterFilDAnnonces(document);

    fil.ajouter(malus('<img src=x onerror=alert(1)>'));

    expect(fil.racine.querySelector('img')).toBeNull();
    expect(fil.racine.querySelector('.grand-titre-ligne')?.textContent).toContain('<img');
  });

  it('retire le grand titre a la fin de son animation', () => {
    const fil = monterFilDAnnonces(document);

    fil.ajouter(malus('Bob'));
    fil.racine
      .querySelector('.grand-titre')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));

    expect(fil.racine.querySelector('.grand-titre')).toBeNull();
  });
});
