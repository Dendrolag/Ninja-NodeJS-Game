/**
 * Tests du repere de localisation.
 *
 * Le jeu d'origine tenait ce repere par un booleen et une minuterie. Ici tout se
 * deduit de l'instant: on verifie donc l'opacite a des instants choisis, et la
 * geometrie de l'onde, sans rien faire attendre.
 */

import { describe, expect, it } from 'vitest';

import { DUREES_LOCALISATION, REPERE_LOCALISATION } from './apparence.js';
import { localiser, opaciteDeLocalisation, reperesDeLocalisation } from './localisation.js';

const CENTRE = { x: 500, y: 400 };
const ROUGE = 0xff3b3b;

/** Les anneaux de couleur, sans les traits blancs qui les cernent. */
function ondes(maintenant: number, opacite = 1): ReturnType<typeof reperesDeLocalisation> {
  return reperesDeLocalisation(CENTRE, opacite, maintenant, ROUGE).filter(
    (anneau) => anneau.id.startsWith('localisation:onde') && !anneau.id.endsWith(':cerne'),
  );
}

describe('opaciteDeLocalisation', () => {
  it('est nulle sans reperage', () => {
    expect(opaciteDeLocalisation(undefined, 1_000)).toBe(0);
  });

  it('est pleine au debut, puis s efface sur la derniere demi-seconde', () => {
    const reperage = localiser(1_000, DUREES_LOCALISATION.demandeeMs);
    const fin = 1_000 + DUREES_LOCALISATION.demandeeMs;

    expect(opaciteDeLocalisation(reperage, 1_000)).toBe(1);
    expect(opaciteDeLocalisation(reperage, fin - DUREES_LOCALISATION.fonduMs)).toBe(1);
    expect(opaciteDeLocalisation(reperage, fin - DUREES_LOCALISATION.fonduMs / 2)).toBeCloseTo(0.5);
    expect(opaciteDeLocalisation(reperage, fin)).toBe(0);
    expect(opaciteDeLocalisation(reperage, fin + 1_000)).toBe(0);
  });
});

describe('reperesDeLocalisation', () => {
  it('ne dessine rien quand le repere est efface', () => {
    expect(reperesDeLocalisation(CENTRE, 0, 0, ROUGE)).toEqual([]);
  });

  it('pose deux ondes et un ancrage, tous centres sur le personnage', () => {
    const repere = reperesDeLocalisation(CENTRE, 1, 0, ROUGE);
    const noms = repere.filter((anneau) => !anneau.id.endsWith(':cerne')).map((a) => a.id);

    expect(noms).toEqual(['localisation:onde:0', 'localisation:onde:1', 'localisation:ancrage']);
    for (const anneau of repere) {
      expect(anneau.x).toBe(CENTRE.x);
      expect(anneau.y).toBe(CENTRE.y);
      expect(anneau.remplissage).toBeUndefined();
    }
  });

  it('resserre l onde au fil du cycle, puis la fait repartir de loin', () => {
    const cycle = REPERE_LOCALISATION.cycleMs;
    const rayon = (maintenant: number): number => ondes(maintenant)[0]?.rayon ?? 0;

    expect(rayon(0)).toBe(REPERE_LOCALISATION.rayonDeDepart);
    expect(rayon(cycle / 2)).toBeCloseTo(
      (REPERE_LOCALISATION.rayonDeDepart + REPERE_LOCALISATION.rayonDArrivee) / 2,
    );
    expect(rayon(cycle * 0.99)).toBeLessThan(rayon(cycle / 2));
    // Un cycle plus tard, l'onde est repartie de son rayon de depart.
    expect(rayon(cycle)).toBeCloseTo(REPERE_LOCALISATION.rayonDeDepart);
  });

  it('decale la seconde onde d un demi-cycle sur la premiere', () => {
    const cycle = REPERE_LOCALISATION.cycleMs;
    const [premiere, seconde] = ondes(0);

    expect(seconde?.rayon).toBeCloseTo(ondes(cycle / 2)[0]?.rayon ?? 0);
    expect(premiere?.rayon).not.toBeCloseTo(seconde?.rayon ?? 0);
  });

  it('efface une onde a mesure qu elle arrive sur le personnage', () => {
    const cycle = REPERE_LOCALISATION.cycleMs;
    const alpha = (maintenant: number): number => ondes(maintenant)[0]?.contour?.alpha ?? -1;

    expect(alpha(0)).toBeCloseTo(REPERE_LOCALISATION.alphaAuDepart);
    expect(alpha(cycle / 2)).toBeCloseTo(REPERE_LOCALISATION.alphaAuDepart / 2);
    expect(alpha(cycle * 0.999)).toBeLessThan(0.01);
  });

  it('cerne chaque anneau d un trait blanc plus epais et plus discret', () => {
    const repere = reperesDeLocalisation(CENTRE, 1, 0, ROUGE);
    const cernes = repere.filter((anneau) => anneau.id.endsWith(':cerne'));

    expect(cernes).toHaveLength(3);
    for (const cerne of cernes) {
      const couleur = repere.find((anneau) => anneau.id === cerne.id.replace(':cerne', ''));

      expect(cerne.contour?.couleur).toBe(REPERE_LOCALISATION.cerne);
      expect(cerne.contour?.epaisseur).toBeGreaterThan(couleur?.contour?.epaisseur ?? 0);
      expect(cerne.contour?.alpha).toBeLessThan(couleur?.contour?.alpha ?? 0);
      expect(cerne.rayon).toBe(couleur?.rayon);
    }
  });

  it('prend notre couleur, et porte l opacite demandee', () => {
    const repere = reperesDeLocalisation(CENTRE, 0.25, 0, ROUGE);
    const onde = ondes(0, 0.25)[0];
    const ancrage = repere.find((anneau) => anneau.id === 'localisation:ancrage');

    expect(onde?.contour?.couleur).toBe(ROUGE);
    expect(onde?.contour?.alpha).toBeCloseTo(0.25 * REPERE_LOCALISATION.alphaAuDepart);
    expect(ancrage?.contour?.couleur).toBe(ROUGE);
    expect(ancrage?.contour?.alpha).toBeCloseTo(0.25 * REPERE_LOCALISATION.alphaDAncrage);
  });
});
