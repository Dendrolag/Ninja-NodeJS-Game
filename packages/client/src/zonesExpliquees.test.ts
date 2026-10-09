/**
 * Tests de ce que la page dit des zones (9 octobre 2026): les textes, la mine la plus proche,
 * les zones qui nous couvrent, et les ninjas que le chaos vient de nous prendre.
 */

import type { EntiteVue, TypeZone, ZoneVue } from '@neon-ninja/shared';
import { COULEUR_BOT_NEUTRE, TYPES_ZONE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { VuePartie } from './reconstruction.js';
import {
  EXPLICATIONS_AVANT_LE_NOM_SEUL,
  EXPLICATIONS_DES_ZONES,
  PORTEE_DE_LA_BULLE_PX,
  mineLaPlusProche,
  ninjasRepeintsParLeChaos,
  texteDeLaZone,
  zonesQuiCouvrent,
} from './zonesExpliquees.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
/** Une couleur tiree par le chaos: celle d'aucun joueur. */
const COULEUR_DU_CHAOS = '#33CC99';

/** Un joueur, de cette couleur, a cette place. */
function joueur(id: string, couleur: string, x = 0, y = 0): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur,
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Un faux ninja, de cette couleur, a cette place. */
function bot(id: string, couleur: string, x = 0, y = 0): EntiteVue {
  return { type: 'bot', id, x, y, couleur, direction: 'nord' };
}

/** Une mine de zone de cette nature, a cette place. */
function mine(id: string, nature: TypeZone, x: number, y: number): EntiteVue {
  return { type: 'mineDeZone', id, x, y, couleur: '#FFFFFF', direction: 'sud', nature };
}

/** Une zone ouverte de cette nature, de cent pixels de rayon. */
function zone(id: string, type: TypeZone, x: number, y: number): ZoneVue {
  return { id, type, x, y, rayon: 100, dureeRestanteMs: 10_000 };
}

/** Une vue de partie. */
function vue(entites: readonly EntiteVue[], zones: readonly ZoneVue[] = [], tick = 1): VuePartie {
  return {
    tick,
    tempsRestantMs: 60_000,
    enPause: false,
    entites,
    objets: [],
    zones,
    classement: [],
  };
}

describe('texteDeLaZone', () => {
  it('dit le nom et l effet, dans les mots du porteur du projet', () => {
    expect(texteDeLaZone('chaos', 0)).toBe('Chaos · les ninjas changent de couleur');
    expect(texteDeLaZone('repulsion', 0)).toBe('Répulsion · les ninjas te fuient');
    expect(texteDeLaZone('attraction', 0)).toBe('Attraction · attire les ninjas vers toi');
    expect(texteDeLaZone('invisibilite', 0)).toBe('Invisibilité · personne ne te voit');
  });

  it('ne dit plus que le nom une fois l effet explique trois fois', () => {
    expect(texteDeLaZone('chaos', EXPLICATIONS_AVANT_LE_NOM_SEUL - 1)).toContain('·');
    expect(texteDeLaZone('chaos', EXPLICATIONS_AVANT_LE_NOM_SEUL)).toBe('Chaos');
  });

  it('explique chaque nature de zone', () => {
    expect(Object.keys(EXPLICATIONS_DES_ZONES).sort()).toEqual([...TYPES_ZONE].sort());
  });
});

describe('mineLaPlusProche', () => {
  /** Une entite a sa place, comme la vue lissee les donne. */
  const pose = (entite: EntiteVue): { entite: EntiteVue; x: number; y: number } => ({
    entite,
    x: entite.x,
    y: entite.y,
  });

  it('prend la mine de zone la plus proche a portee, et ignore le reste', () => {
    const trouvee = mineLaPlusProche(
      [
        pose(mine('loin', 'chaos', 200, 0)),
        pose(bot('b1', ROUGE, 10, 0)),
        pose(mine('pres', 'attraction', 120, 0)),
      ],
      { x: 0, y: 0 },
    );

    expect(trouvee?.entite.id).toBe('pres');
    expect(trouvee?.entite.nature).toBe('attraction');
  });

  it('ne prend rien au-dela de la portee de la bulle', () => {
    expect(
      mineLaPlusProche([pose(mine('m', 'chaos', PORTEE_DE_LA_BULLE_PX, 0))], { x: 0, y: 0 }),
    ).toBeUndefined();
  });
});

describe('zonesQuiCouvrent', () => {
  it('rend les zones dont le disque contient la position, bord compris', () => {
    const zones = [zone('a', 'chaos', 0, 0), zone('b', 'repulsion', 500, 0)];

    expect(zonesQuiCouvrent(zones, { x: 100, y: 0 }).map((une) => une.id)).toEqual(['a']);
    expect(zonesQuiCouvrent(zones, { x: 300, y: 0 })).toEqual([]);
  });
});

describe('ninjasRepeintsParLeChaos', () => {
  const avant = vue(
    [
      joueur('moi', ROUGE),
      joueur('bob', BLEU, 900, 900),
      bot('dedans1', ROUGE, 10, 0),
      bot('dedans2', ROUGE, 20, 0),
      bot('dehors', ROUGE, 400, 0),
      bot('neutralise', ROUGE, 30, 0),
      bot('pris', ROUGE, 40, 0),
    ],
    [zone('z', 'chaos', 0, 0)],
  );

  /** Les memes, apres un battement: le chaos a repeint deux des notres. */
  const apres = vue(
    [
      joueur('moi', ROUGE),
      joueur('bob', BLEU, 900, 900),
      bot('dedans1', COULEUR_DU_CHAOS, 10, 0),
      bot('dedans2', COULEUR_DU_CHAOS, 20, 0),
      bot('dehors', COULEUR_DU_CHAOS, 400, 0),
      bot('neutralise', COULEUR_BOT_NEUTRE, 30, 0),
      bot('pris', BLEU, 40, 0),
    ],
    [zone('z', 'chaos', 0, 0)],
    2,
  );

  it('compte nos ninjas repeints d une couleur de personne, dans une zone de chaos', () => {
    // Ni celui hors de la zone, ni celui qu'un Black Ninja a neutralise, ni celui pris par Bob.
    expect(ninjasRepeintsParLeChaos(avant, apres, 'moi', 'classique')).toBe(2);
    expect(ninjasRepeintsParLeChaos(avant, apres, 'moi', 'tactique')).toBe(2);
    expect(ninjasRepeintsParLeChaos(avant, apres, 'moi', 'equipes')).toBe(2);
  });

  it('ne compte rien sans zone de chaos', () => {
    const sansChaos = { ...apres, zones: [zone('z', 'repulsion', 0, 0)] };

    expect(ninjasRepeintsParLeChaos(avant, sansChaos, 'moi', 'classique')).toBe(0);
  });

  it('ne compte rien la ou nos ninjas ne sont pas a notre couleur', () => {
    expect(ninjasRepeintsParLeChaos(avant, apres, 'moi', 'chasse')).toBe(0);
    expect(ninjasRepeintsParLeChaos(avant, apres, 'moi', 'massacre')).toBe(0);
  });

  it('ne compte rien sans changement de vue, ni sans nous', () => {
    expect(ninjasRepeintsParLeChaos(avant, avant, 'moi', 'classique')).toBe(0);
    expect(ninjasRepeintsParLeChaos(undefined, apres, 'moi', 'classique')).toBe(0);
    expect(ninjasRepeintsParLeChaos(avant, apres, 'personne', 'classique')).toBe(0);
  });
});
