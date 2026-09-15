/**
 * Le banc du battement: il mesure, il est reproductible, et il porte le seuil de
 * bande passante de la partie de reference.
 *
 * Il lit la compilation des paquets, comme tout le harnais de charge: compiler
 * avant (pnpm typecheck ou pnpm build), ce que la CI fait avant les tests.
 *
 * L'ORDRE DES TESTS COMPTE, ET C'EST VOULU. La seule verification de duree porte
 * sur la premiere partie jouee dans ce fichier: une partie qui en suit une autre
 * de taille differente coute plus cher (voir battement-isole.ts), et le seuil
 * mesurerait alors l'ordre des tests plutot que le moteur.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { ChargeurDeTerrain } from '../../packages/server/dist/index.js';
import type { CarteCollisions } from '../../packages/sim/dist/index.js';

import { mesurerLeBattement } from './battement.ts';
import {
  CADENCE_MS,
  OCTETS_PAR_MESSAGE_DE_REFERENCE,
  PART_DU_BATTEMENT_UTILISABLE,
  PARTIE_DE_REFERENCE,
  TOLERANCE_DE_TAILLE,
} from './seuils.ts';

let terrain: CarteCollisions;

beforeAll(() => {
  terrain = new ChargeurDeTerrain().charger({ carte: 'map1', modeMiroir: false });
});

describe('la partie de reference du banc', () => {
  it('tient dans le budget d un battement, et ses messages gardent leur taille de reference', () => {
    const resultat = mesurerLeBattement({ ...PARTIE_DE_REFERENCE, terrain });

    // Un seuil tres large, fait pour ne jamais dependre de la machine: une partie
    // pleine au maximum des bornes doit tenir, seule, dans la part utilisable d'un
    // battement. Mesuree a 0,78 ms a l'etape 5.1, puis a 0,43 ms apres les
    // optimisations de l'etape 5.2: elle en est a quatre-vingts fois.
    expect(resultat.totalMs.moyenne).toBeLessThan(CADENCE_MS * PART_DU_BATTEMENT_UTILISABLE);

    // Le seuil de bande passante, lui, est exact sur toutes les machines: le banc
    // est deterministe pour les tailles.
    const ecart =
      Math.abs(resultat.octetsParMessage.moyenne - OCTETS_PAR_MESSAGE_DE_REFERENCE) /
      OCTETS_PAR_MESSAGE_DE_REFERENCE;
    expect(
      ecart,
      `taille moyenne ${resultat.octetsParMessage.moyenne.toFixed(0)} octets, reference ${String(OCTETS_PAR_MESSAGE_DE_REFERENCE)}`,
    ).toBeLessThanOrEqual(TOLERANCE_DE_TAILLE);
  });
});

describe('mesurerLeBattement', () => {
  const courte = { bots: 60, joueurs: 4, battements: 200, echauffement: 20, graine: 7 };

  it('mesure chaque battement, et en detaille le cout', () => {
    const resultat = mesurerLeBattement({ ...courte, terrain });

    for (const resume of [
      resultat.moteurMs,
      resultat.projectionMs,
      resultat.serialisationMs,
      resultat.totalMs,
      resultat.octetsParMessage,
    ]) {
      expect(resume.nombre).toBe(courte.battements);
    }

    // Un battement sur vingt voit sa taille compressee calculee.
    expect(resultat.octetsCompressesParMessage.nombre).toBe(10);
    expect(resultat.octetsCompressesParMessage.moyenne).toBeLessThan(
      resultat.octetsParMessage.moyenne,
    );

    expect(resultat.totalMs.moyenne).toBeGreaterThanOrEqual(resultat.moteurMs.moyenne);
    expect(resultat.moteurMs.minimum).toBeGreaterThan(0);

    // Les joueurs et les bots sont tous dans chaque instantane; les bots noirs
    // arrivent a mi-partie.
    expect(resultat.entitesParMessage).toBeGreaterThanOrEqual(courte.bots + courte.joueurs);
    expect(resultat.octetsTotal).toBe(
      Math.round(resultat.octetsParMessage.moyenne * courte.battements),
    );
  });

  it('rejoue exactement la meme partie avec la meme graine', () => {
    const premiere = mesurerLeBattement({ ...courte, terrain });
    const seconde = mesurerLeBattement({ ...courte, terrain });

    expect(seconde.octetsTotal).toBe(premiere.octetsTotal);
    expect(seconde.octetsParMessage).toEqual(premiere.octetsParMessage);
    expect(seconde.entitesParMessage).toBe(premiere.entitesParMessage);
  });

  it('joue une autre partie avec une autre graine', () => {
    const premiere = mesurerLeBattement({ ...courte, terrain });
    const autre = mesurerLeBattement({ ...courte, graine: 8, terrain });

    expect(autre.octetsTotal).not.toBe(premiere.octetsTotal);
  });

  it('mesure une partie au-dela des bornes du salon', () => {
    const resultat = mesurerLeBattement({ ...courte, bots: 200, battements: 20, terrain });

    expect(resultat.entitesParMessage).toBeGreaterThanOrEqual(204);
  });

  it('joue une partie Tactique, ou les joueurs tirent, et la rejoue a l identique', () => {
    const premiere = mesurerLeBattement({ ...courte, mode: 'tactique', terrain });
    const seconde = mesurerLeBattement({ ...courte, mode: 'tactique', terrain });
    const classique = mesurerLeBattement({ ...courte, terrain });

    expect(premiere.mode).toBe('tactique');
    expect(classique.mode).toBe('classique');
    expect(seconde.octetsTotal).toBe(premiere.octetsTotal);
    expect(premiere.octetsTotal).not.toBe(classique.octetsTotal);
  });
});
