/**
 * Tests des credits et des cartes prototypes (etape 4.7).
 *
 * Les textes sont ceux arretes avec le porteur du projet le 28 septembre 2026, mot
 * pour mot: un changement doit se decider avec lui, pas se glisser dans un commit.
 */

import { CARTES } from '@neon-ninja/shared';
import type { IdentifiantCarte } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { PRESENTATION_CARTES } from './cartes.js';
import { AVANT_LE_NOM, CREDITS, apresLeNom } from './credits.js';

describe('les credits', () => {
  it('disent a qui est le jeu', () => {
    expect(CREDITS.creation).toBe('Neon Ninja est une création originale de Dendrolag.');
  });

  it('remercient Bribz pour Tokyo et les ninjas, dans la phrase arretee', () => {
    expect(CREDITS.participations).toHaveLength(2);

    const [bribz] = CREDITS.participations;

    expect(bribz?.nom).toBe('Bribz');
    expect(bribz === undefined ? '' : `${AVANT_LE_NOM}${bribz.nom}${apresLeNom(bribz)}`).toBe(
      'Avec l’aimable participation de Bribz pour la carte Tokyo et les ninjas.',
    );
  });

  it('ne renvoient vers aucune page tant que Bribz n y a pas consenti', () => {
    expect(CREDITS.participations[0]?.adresse).toBeUndefined();
  });

  it('nomment 2-Minute Tabletop pour ses deux cartes, avec sa licence (etapes 8.9 et 8.11)', () => {
    const auteur = CREDITS.participations[1];

    expect(auteur).toEqual({
      nom: '2-Minute Tabletop',
      apport: 'les cartes Station lunaire et Prison Island',
      adresse: 'https://www.patreon.com/2minutetabletop',
      licence: { nom: 'CC BY-NC 4.0', adresse: 'https://creativecommons.org/licenses/by-nc/4.0/' },
    });
    expect(auteur === undefined ? '' : apresLeNom(auteur)).toBe(
      ' pour les cartes Station lunaire et Prison Island, sous licence ',
    );
  });
});

describe('les cartes prototypes', () => {
  it('ne marquent que les decors provisoires: Spirit & Time et le Quartier, pas Tokyo', () => {
    const prototypes = (Object.keys(CARTES) as IdentifiantCarte[]).filter(
      (carte) => PRESENTATION_CARTES[carte].prototype,
    );

    expect(prototypes.map((carte) => PRESENTATION_CARTES[carte].nom)).toEqual([
      'Spirit & Time',
      'Quartier',
    ]);
  });

  it('gardent Tokyo pour definitive, jusque dans l historique de l ancienne Tokyo', () => {
    expect(PRESENTATION_CARTES.map1.prototype).toBe(false);
    expect(PRESENTATION_CARTES.map2.prototype).toBe(false);
  });

  it('laissent le badge dire l essai: le Quartier n est plus que « Plan au trait »', () => {
    expect(PRESENTATION_CARTES.quartier.ambiance).toBe('Plan au trait');
  });
});
