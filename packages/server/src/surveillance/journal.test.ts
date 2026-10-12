/**
 * Tests du plafond des episodes (etape 5.15): un par partie ou par connexion et par minute,
 * soixante par minute en tout. Le reste n'est que compte.
 */

import { describe, expect, it } from 'vitest';

import { PlafondDesEpisodes } from './journal.js';
import { SEUILS_DU_VERDICT, verdict } from './verdict.js';

describe('le plafond des episodes', () => {
  it('laisse passer un episode par cle et par minute', () => {
    const plafond = new PlafondDesEpisodes();

    expect(plafond.accepter('partie:room-1', 0)).toBe(true);
    expect(plafond.accepter('partie:room-1', 30_000)).toBe(false);
    expect(plafond.accepter('partie:room-2', 30_000)).toBe(true);
    expect(plafond.accepter('partie:room-1', 59_999)).toBe(false);
    expect(plafond.accepter('partie:room-1', 60_000)).toBe(true);
  });

  it('ne laisse passer que soixante episodes par minute, toutes cles confondues', () => {
    const plafond = new PlafondDesEpisodes();
    let acceptes = 0;

    for (let rang = 0; rang < 100; rang += 1) {
      acceptes += plafond.accepter(`connexion:${String(rang)}`, rang * 100) ? 1 : 0;
    }

    expect(acceptes).toBe(60);

    // Une minute apres le premier, une place se libere.
    expect(plafond.accepter('connexion:neuve', 60_000)).toBe(true);
    expect(plafond.accepter('connexion:neuve-2', 60_050)).toBe(false);
  });

  it('se regle sur un autre total', () => {
    const plafond = new PlafondDesEpisodes(2);

    expect(plafond.accepter('a', 0)).toBe(true);
    expect(plafond.accepter('b', 0)).toBe(true);
    expect(plafond.accepter('c', 0)).toBe(false);
  });

  it('oublie les cles anciennes sans perdre le plafond par cle', () => {
    const plafond = new PlafondDesEpisodes(2);

    // Bien plus de cles que le plafond n'en retient, a une minute d'ecart chacune.
    for (let rang = 0; rang < 50; rang += 1) {
      expect(plafond.accepter(`cle-${String(rang)}`, rang * 60_000)).toBe(true);
    }

    expect(plafond.accepter('cle-49', 49 * 60_000 + 1000)).toBe(false);
  });
});

describe('le verdict', () => {
  const fluide = {
    battements: 200,
    battementsEnRetard: 0,
    instantanes: 200,
    instantanesEnRetard: 0,
    images: 600,
    imagesLentes: 0,
  };

  it('dit fluide sans rien au-dela des seuils', () => {
    expect(verdict(fluide)).toBe('fluide');
    expect(
      verdict({
        battements: 0,
        battementsEnRetard: 0,
        instantanes: 0,
        instantanesEnRetard: 0,
        images: 0,
        imagesLentes: 0,
      }),
    ).toBe('fluide');
  });

  it('met le serveur en cause d abord: ses battements en retard font tout le reste', () => {
    expect(
      verdict({ ...fluide, battementsEnRetard: 3, instantanesEnRetard: 50, imagesLentes: 100 }),
    ).toBe('serveur');
  });

  it('met le reseau en cause quand le serveur bat a l heure', () => {
    expect(verdict({ ...fluide, instantanesEnRetard: 11, imagesLentes: 100 })).toBe('reseau');
  });

  it('met la page en cause quand les instantanes arrivent a l heure', () => {
    expect(verdict({ ...fluide, imagesLentes: 31 })).toBe('page');
  });

  it('ne met personne en cause au seuil exact', () => {
    expect(
      verdict({
        ...fluide,
        battementsEnRetard: SEUILS_DU_VERDICT.battementsEnRetard * 200,
        instantanesEnRetard: SEUILS_DU_VERDICT.instantanesEnRetard * 200,
        imagesLentes: SEUILS_DU_VERDICT.imagesLentes * 600,
      }),
    ).toBe('fluide');
  });
});
