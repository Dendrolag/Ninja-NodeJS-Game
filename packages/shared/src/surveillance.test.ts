/**
 * Tests du bulletin de la page (etape 5.15): ce qui part sur le fil, ce que le serveur en
 * relit, et tout ce qu'il refuse.
 */

import { describe, expect, it } from 'vitest';

import type { BulletinDePage } from './surveillance.js';
import {
  CASES_DUREE_D_IMAGE_MS,
  CASES_ECART_INSTANTANES_MS,
  TAILLE_MAXIMALE_DU_BULLETIN,
  coderLeBulletin,
  lireLeBulletin,
  validerLAppareil,
} from './surveillance.js';

/** Un bulletin de dix secondes a 60 images par seconde, avec quelques saccades. */
const BULLETIN: BulletinDePage = {
  images: {
    cases: [0, 590, 4, 2, 1, 2, 1, 0],
    sommeMs: 10_100,
    lentes: 3,
    tresLentes: 1,
    cachees: 0,
    tenues: 7,
  },
  lentes: { notreCodeMs: 30, pixiMs: 40, resteMs: 180 },
  pire: { dureeMs: 140.26, notreCodeMs: 12.3, pixiMs: 8.04 },
  instantanes: {
    cases: [3, 190, 4, 1, 1, 1, 0, 0],
    sommeMs: 9_980,
    enRetard: 2,
    ecartMaxMs: 160,
  },
  allersRetoursMs: [42.4, 61],
  entites: 166,
  son: true,
  erreurs: { script: 0, promesse: 1 },
};

describe('le bulletin sur le fil', () => {
  it('se code en une centaine d octets', () => {
    const code = coderLeBulletin(BULLETIN);

    expect(JSON.stringify(code).length).toBeLessThan(150);
    expect(JSON.stringify(code).length).toBeLessThan(TAILLE_MAXIMALE_DU_BULLETIN);
  });

  it('se relit tel qu il a ete code, durees arrondies', () => {
    const lu = lireLeBulletin(JSON.parse(JSON.stringify(coderLeBulletin(BULLETIN))));

    expect(lu).toEqual({
      valide: true,
      valeur: {
        ...BULLETIN,
        pire: { dureeMs: 140.3, notreCodeMs: 12.3, pixiMs: 8 },
        allersRetoursMs: [42, 61],
      },
    });
  });

  it('accepte un bulletin sans aller et retour, et en garde quatre au plus', () => {
    const sans = lireLeBulletin(coderLeBulletin({ ...BULLETIN, allersRetoursMs: [] }));
    const trop = coderLeBulletin({ ...BULLETIN, allersRetoursMs: [1, 2, 3, 4, 5, 6] });

    expect(sans.valide && sans.valeur.allersRetoursMs).toEqual([]);
    expect(trop.length).toBe(coderLeBulletin(BULLETIN).length + 2);
  });

  it('a autant de cases que de bornes, plus une', () => {
    expect(BULLETIN.images.cases).toHaveLength(CASES_DUREE_D_IMAGE_MS.length + 1);
    expect(BULLETIN.instantanes.cases).toHaveLength(CASES_ECART_INSTANTANES_MS.length + 1);
  });
});

describe('les bulletins refuses', () => {
  const code = coderLeBulletin(BULLETIN);

  /** Le motif du refus, ou rien si le bulletin passe. */
  const motif = (brut: unknown): string | undefined => {
    const lu = lireLeBulletin(brut);
    return lu.valide ? undefined : lu.erreurs[0]?.motif;
  };

  /** Le bulletin code, avec cette case changee. */
  const avec = (rang: number, valeur: unknown): unknown[] => {
    const copie: unknown[] = [...code];
    copie[rang] = valeur;
    return copie;
  };

  it('refuse ce qui n est pas un tableau', () => {
    expect(motif({ images: 3 })).toMatch(/pas un tableau/u);
    expect(motif('1,2,3')).toMatch(/pas un tableau/u);
    expect(motif(null)).toMatch(/pas un tableau/u);
  });

  it('refuse un format inconnu', () => {
    expect(motif(avec(0, 2))).toMatch(/Format/u);
  });

  it('refuse une longueur inattendue', () => {
    expect(motif(code.slice(0, 20))).toMatch(/Longueur/u);
    expect(motif([...code, 1, 2, 3])).toMatch(/Longueur/u);
  });

  it('refuse une valeur negative, illisible, enorme ou qui n est pas un nombre', () => {
    expect(motif(avec(3, -1))).toMatch(/hors bornes/u);
    expect(motif(avec(3, Number.NaN))).toMatch(/hors bornes/u);
    expect(motif(avec(3, 1e12))).toMatch(/hors bornes/u);
    expect(motif(avec(3, '12'))).toMatch(/hors bornes/u);
  });

  it('refuse un compte qui n est pas entier', () => {
    expect(motif(avec(2, 590.5))).toMatch(/entier/u);
  });

  it('refuse un son qui n est ni zero ni un', () => {
    const rangDuSon = code.length - BULLETIN.allersRetoursMs.length - 3;
    expect(code[rangDuSon]).toBe(1);
    expect(motif(avec(rangDuSon, 2))).toMatch(/entier/u);
  });

  it('refuse des comptes qui ne s accordent pas', () => {
    // Plus d'images lentes que d'images.
    expect(
      motif(coderLeBulletin({ ...BULLETIN, images: { ...BULLETIN.images, lentes: 10_000 } })),
    ).toMatch(/accordent/u);
    // Plus d'images tres lentes que de lentes.
    expect(
      motif(coderLeBulletin({ ...BULLETIN, images: { ...BULLETIN.images, tresLentes: 4 } })),
    ).toMatch(/accordent/u);
    // Plus d'instantanes en retard que d'instantanes.
    expect(
      motif(
        coderLeBulletin({ ...BULLETIN, instantanes: { ...BULLETIN.instantanes, enRetard: 1000 } }),
      ),
    ).toMatch(/accordent/u);
  });
});

describe('la description de l appareil', () => {
  const appareil = {
    appareil: 'telephone',
    navigateur: 'safari',
    moteur: 'webgl',
    largeur: 390,
    hauteur: 844,
    densite: 3,
    coeurs: 6,
  };

  it('accepte une description complete, et sans coeurs ni memoire', () => {
    expect(validerLAppareil(appareil)).toEqual({ valide: true, valeur: appareil });

    const { coeurs: _coeurs, ...sansCoeurs } = appareil;
    expect(validerLAppareil(sansCoeurs).valide).toBe(true);
  });

  it('refuse ce qui sort des listes fermees ou des bornes', () => {
    expect(validerLAppareil({ ...appareil, navigateur: 'netscape' }).valide).toBe(false);
    expect(validerLAppareil({ ...appareil, appareil: 'montre' }).valide).toBe(false);
    expect(validerLAppareil({ ...appareil, moteur: 'opengl' }).valide).toBe(false);
    expect(validerLAppareil({ ...appareil, largeur: -1 }).valide).toBe(false);
    expect(validerLAppareil({ ...appareil, coeurs: 'six' }).valide).toBe(false);
    expect(validerLAppareil({ ...appareil, memoireGo: 1e9 }).valide).toBe(false);
    expect(validerLAppareil([appareil]).valide).toBe(false);
    expect(validerLAppareil(null).valide).toBe(false);
  });

  it('ne garde que ce qu il connait', () => {
    const lu = validerLAppareil({ ...appareil, pseudo: 'Remi', densite: 2.625001 });

    expect(lu).toEqual({ valide: true, valeur: { ...appareil, densite: 2.63 } });
  });
});
