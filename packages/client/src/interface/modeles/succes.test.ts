/**
 * Tests de la mise en forme des succes (etapes 3.7 et 3.8): rarete, succes le plus
 * proche, section du profil, secrets, succes de la fiche et de la fin de partie.
 */

import type { IdentifiantSucces, SuccesConnu, SuccesDuProfil } from '@neon-ninja/shared';
import { SUCCES, definitionDuSucces } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { formaterJour } from './progression.js';
import {
  SECRET,
  formaterRarete,
  phraseDuPlusProche,
  succesDeFicheAffiches,
  succesDebloquesAffiches,
  succesDuProfilAffiches,
} from './succes.js';

/** Le profil d'un compte qui n'a rien obtenu. */
function profilVide(): SuccesDuProfil[] {
  return SUCCES.map((succes) => ({ id: succes.id, rarete: 0 }));
}

describe('formaterRarete', () => {
  it('arrondit la part des joueurs, sans jamais ecrire 0 % pour un succes detenu', () => {
    expect(formaterRarete(12.4)).toBe('12 % des joueurs');
    expect(formaterRarete(100)).toBe('100 % des joueurs');
    expect(formaterRarete(1)).toBe('1 % des joueurs');
    expect(formaterRarete(0.4)).toBe('moins de 1 % des joueurs');
    expect(formaterRarete(0)).toBe('aucun joueur');
  });
});

describe('phraseDuPlusProche', () => {
  it('dit ce qui reste, au pluriel et au singulier', () => {
    expect(phraseDuPlusProche({ id: 'dix-couronnes', actuel: 7, seuil: 10 })).toBe(
      'Plus que 3 victoires pour Dix couronnes',
    );
    expect(phraseDuPlusProche({ id: 'dix-couronnes', actuel: 9, seuil: 10 })).toBe(
      'Plus que 1 victoire pour Dix couronnes',
    );
    expect(phraseDuPlusProche({ id: 'recrue', actuel: 150, seuil: 1000 })).toBe(
      'Plus que 850 XP pour Recrue',
    );
    expect(phraseDuPlusProche({ id: 'demineur', actuel: 24, seuil: 25 })).toBe(
      'Plus que 1 Black Ninja pour Démineur',
    );
    expect(phraseDuPlusProche({ id: 'collectionneur-de-fantomes', actuel: 7, seuil: 10 })).toBe(
      'Plus que 3 Évadés pour Collectionneur de fantômes',
    );
    expect(phraseDuPlusProche({ id: 'seigneur-de-la-horde', actuel: 9_999, seuil: 10_000 })).toBe(
      'Plus que 1 ninja pour Seigneur de la Horde',
    );
  });

  it('se tait pour un succes inconnu, sans unite, ou deja atteint', () => {
    expect(
      phraseDuPlusProche({ id: 'succes-a-venir' as 'habitue', actuel: 1, seuil: 2 }),
    ).toBeUndefined();
    expect(phraseDuPlusProche({ id: 'serie', actuel: 2, seuil: 3 })).toBeUndefined();
    expect(phraseDuPlusProche({ id: 'habitue', actuel: 25, seuil: 25 })).toBeUndefined();
  });
});

describe('succesDuProfilAffiches', () => {
  it('range les succes par palier de difficulte, et compte les obtenus', () => {
    const lus = profilVide().map((succes) =>
      succes.id === 'premier-pas' || succes.id === 'veteran'
        ? { ...succes, debloqueLe: '2026-09-20T18:30:00.000Z', rarete: 50 }
        : succes,
    );
    const section = succesDuProfilAffiches(lus);

    expect(section.compte).toBe('2 succès sur 47');
    expect(section.paliers.map((palier) => [palier.nom, palier.compte])).toEqual([
      ['Découverte', '1 sur 8'],
      ['Habitué', '0 sur 15'],
      ['Expert', '1 sur 17'],
      ['Légende', '0 sur 7'],
    ]);
  });

  it("date un succes obtenu, et montre la progression d'un cumul qui ne l'est pas", () => {
    const lus = profilVide().map((succes) => {
      if (succes.id === 'premier-pas') {
        return { ...succes, debloqueLe: '2026-09-20T18:30:00.000Z', rarete: 80 };
      }

      return succes.id === 'pickpocket'
        ? { ...succes, progression: { actuel: 12, seuil: 50 }, rarete: 3 }
        : succes;
    });
    const tous = succesDuProfilAffiches(lus).paliers.flatMap((palier) => palier.succes);

    expect(tous.find((succes) => succes.id === 'premier-pas')).toEqual({
      id: 'premier-pas',
      nom: 'Premier pas',
      description: 'Jouer une partie.',
      palier: 'decouverte',
      obtenu: true,
      date: `Obtenu le ${formaterJour('2026-09-20T18:30:00.000Z')}`,
      progression: undefined,
      rarete: '80 % des joueurs',
    });
    expect(tous.find((succes) => succes.id === 'nettoyeur')?.rarete).toBeUndefined();
    expect(tous.find((succes) => succes.id === 'pickpocket')).toMatchObject({
      obtenu: false,
      date: undefined,
      progression: { texte: '12 sur 50', pourCent: 24 },
      rarete: '3 % des joueurs',
    });
  });

  it('ignore un succes que cette page ne connait pas', () => {
    const section = succesDuProfilAffiches([
      ...profilVide(),
      { id: 'succes-retire' as 'habitue', rarete: 10 },
    ]);

    expect(section.compte).toBe('0 succès sur 47');
  });
});

describe('succesDeFicheAffiches et succesDebloquesAffiches', () => {
  it('nomment les succes obtenus, avec leur palier, et la rarete sur la fiche', () => {
    expect(succesDeFicheAffiches([{ id: 'legende', rarete: 2 }])).toEqual([
      {
        id: 'legende',
        nom: 'Légende',
        description: 'Atteindre le niveau 50.',
        palier: 'legende',
        nomDuPalier: 'Légende',
        rarete: '2 % des joueurs',
      },
    ]);
    expect(succesDebloquesAffiches(['serie', 'inconnu']).map((succes) => succes.nom)).toEqual([
      'Série',
    ]);
  });
});

describe('les secrets', () => {
  /** Les definitions du paquet partage, ou Habitue serait secret. */
  const habitueSecret = (id: IdentifiantSucces): SuccesConnu => ({
    ...definitionDuSucces(id),
    secret: id === 'habitue',
  });

  it("cachent les trois secrets de l'etape 3.8 tant qu'ils ne sont pas obtenus", () => {
    const lus = profilVide().map((succes) =>
      succes.id === 'sur-le-fil' ? { ...succes, debloqueLe: '2026-09-27T18:30:00.000Z' } : succes,
    );
    const tous = succesDuProfilAffiches(lus).paliers.flatMap((palier) => palier.succes);

    expect(tous.find((succes) => succes.id === 'pas-de-chance')).toMatchObject({
      nom: SECRET,
      description: undefined,
    });
    expect(tous.find((succes) => succes.id === 'arroseur-arrose')?.nom).toBe(SECRET);
    expect(tous.find((succes) => succes.id === 'sur-le-fil')).toMatchObject({
      nom: 'Sur le fil',
      obtenu: true,
    });
  });

  it("se lisent « ??? » avant d'etre obtenus, sans description ni progression", () => {
    const lus = profilVide().map((succes) =>
      succes.id === 'habitue' ? { ...succes, progression: { actuel: 3, seuil: 25 } } : succes,
    );
    const habitue = succesDuProfilAffiches(lus, habitueSecret)
      .paliers.flatMap((palier) => palier.succes)
      .find((succes) => succes.id === 'habitue');

    expect(habitue).toMatchObject({
      nom: SECRET,
      description: undefined,
      progression: undefined,
      obtenu: false,
    });
  });

  it('se decrivent une fois obtenus', () => {
    const lus = profilVide().map((succes) =>
      succes.id === 'habitue' ? { ...succes, debloqueLe: '2026-09-20T18:30:00.000Z' } : succes,
    );
    const habitue = succesDuProfilAffiches(lus, habitueSecret)
      .paliers.flatMap((palier) => palier.succes)
      .find((succes) => succes.id === 'habitue');

    expect(habitue).toMatchObject({ nom: 'Habitué', description: 'Jouer 25 parties.' });
  });
});
