/**
 * Tests de la mise en forme des succes d'un compte (etape 3.7): ce que la fin de partie
 * annonce, ce que le profil montre, ce que la fiche laisse voir.
 */

import type { IdentifiantSucces, Mesures } from '@neon-ninja/shared';
import { MESURES, SUCCES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { SuccesEnregistre } from '../base/succes.js';
import { succesDeFiche, succesDeFin, succesDuProfil } from './succes.js';

/** Des mesures toutes a zero, sauf celles donnees. */
function mesures(surcharge: Partial<Mesures> = {}): Mesures {
  const zeros = Object.fromEntries(MESURES.map((mesure) => [mesure, 0])) as Record<
    (typeof MESURES)[number],
    number
  >;

  return { ...zeros, ...surcharge };
}

/** Des succes inscrits, chacun avec sa partie d'origine. */
function inscrits(
  succes: Readonly<Partial<Record<IdentifiantSucces, string | undefined>>>,
): Map<IdentifiantSucces, SuccesEnregistre> {
  return new Map(
    Object.entries(succes).map(([id, partieId]) => [
      id as IdentifiantSucces,
      { debloqueLe: new Date('2026-09-20T18:30:00.000Z'), partieId },
    ]),
  );
}

describe('succesDeFin', () => {
  it("n'annonce que les succes dont cette partie est l'origine, dans l'ordre des definitions", () => {
    const fin = succesDeFin(
      'p2',
      mesures({ partiesJouees: 2, victoires: 1 }),
      inscrits({ 'premiere-couronne': 'p2', 'premier-pas': 'p1', nettoyeur: 'p2' }),
    );

    expect(fin.debloques).toEqual(['nettoyeur', 'premiere-couronne']);
  });

  it("n'annonce rien d'un succes rattrape dont la partie a disparu", () => {
    expect(succesDeFin('p1', mesures(), inscrits({ 'premier-pas': undefined })).debloques).toEqual(
      [],
    );
  });

  it("propose le cumul le plus proche, parmi ceux que le compte n'a pas", () => {
    const fin = succesDeFin(
      'p9',
      mesures({ partiesJouees: 9, victoires: 9 }),
      inscrits({ 'premier-pas': 'p1', 'premiere-couronne': 'p2' }),
    );

    expect(fin.plusProche).toEqual({ id: 'dix-couronnes', actuel: 9, seuil: 10 });
    expect(
      succesDeFin(
        'p9',
        mesures({ partiesJouees: 9, victoires: 9 }),
        inscrits({ 'dix-couronnes': 'p9' }),
      ).plusProche?.id,
    ).toBe('habitue');
  });

  it("n'ecrit pas de plus proche quand aucun cumul n'est commence", () => {
    expect(succesDeFin('p1', mesures(), new Map())).toEqual({ debloques: [] });
  });
});

describe('succesDuProfil', () => {
  it("rend tous les succes, dans l'ordre des definitions", () => {
    const profil = succesDuProfil(mesures(), new Map(), new Map());

    expect(profil.map((succes) => succes.id)).toEqual(SUCCES.map((succes) => succes.id));
  });

  it('date un succes obtenu, sans progression, avec sa rarete', () => {
    const [premierPas] = succesDuProfil(
      mesures({ partiesJouees: 1 }),
      inscrits({ 'premier-pas': 'p1' }),
      new Map([['premier-pas', 75]]),
    );

    expect(premierPas).toEqual({
      id: 'premier-pas',
      debloqueLe: '2026-09-20T18:30:00.000Z',
      rarete: 75,
    });
  });

  it("montre la progression d'un cumul non obtenu, et rien pour un succes d'un coup", () => {
    const profil = succesDuProfil(mesures({ partiesJouees: 12 }), new Map(), new Map());

    expect(profil.find((succes) => succes.id === 'habitue')).toEqual({
      id: 'habitue',
      progression: { actuel: 12, seuil: 25 },
      rarete: 0,
    });
    expect(profil.find((succes) => succes.id === 'serie')).toEqual({ id: 'serie', rarete: 0 });
  });
});

describe('succesDeFiche', () => {
  it('ne rend que les succes obtenus, sans leur date, avec leur rarete', () => {
    expect(
      succesDeFiche(
        inscrits({ 'premiere-couronne': 'p2', 'premier-pas': 'p1' }),
        new Map<IdentifiantSucces, number>([
          ['premier-pas', 100],
          ['premiere-couronne', 12.5],
        ]),
      ),
    ).toEqual([
      { id: 'premier-pas', rarete: 100 },
      { id: 'premiere-couronne', rarete: 12.5 },
    ]);
  });
});
