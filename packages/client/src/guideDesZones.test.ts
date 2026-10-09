/**
 * Tests du guide des zones (9 octobre 2026): ce qu'il dit, image apres image, des mines de
 * zone et des zones qui nous entourent.
 */

import type { EntiteVue, TypeZone, ZoneVue } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import type { GuideDesZones } from './guideDesZones.js';
import {
  CUMUL_DES_PERTES_DU_CHAOS_MS,
  DUREE_DE_LA_PHRASE_D_ENTREE_MS,
  creerGuideDesZones,
} from './guideDesZones.js';
import type { SouvenirDesZones } from './interface/souvenirDesZones.js';
import { creerSouvenirDesZones } from './interface/souvenirDesZones.js';
import type { VuePartie } from './reconstruction.js';
import type { VueLissee } from './rendu/interpolation.js';

const ROUGE = '#FF0000';

/** Notre ninja, a cette place. */
function moi(x: number, y = 0): EntiteVue {
  return {
    type: 'joueur',
    id: 'moi',
    x,
    y,
    couleur: ROUGE,
    direction: 'sud',
    pseudo: 'moi',
    invincible: false,
    protege: false,
  };
}

/** Une mine de zone de cette nature, a cette place. */
function mine(id: string, nature: TypeZone, x: number, y = 0): EntiteVue {
  return { type: 'mineDeZone', id, x, y, couleur: '#FFFFFF', direction: 'sud', nature };
}

/** Un faux ninja de cette couleur, a cette place. */
function bot(id: string, couleur: string, x: number, y = 0): EntiteVue {
  return { type: 'bot', id, x, y, couleur, direction: 'nord' };
}

/** Une zone ouverte de cent pixels de rayon. */
function zone(id: string, type: TypeZone, x: number, dureeRestanteMs = 10_000): ZoneVue {
  return { id, type, x, y: 0, rayon: 100, dureeRestanteMs };
}

/** Une vue de partie, et l'etat du client qui la tient. */
function partie(
  entites: readonly EntiteVue[],
  zones: readonly ZoneVue[] = [],
  tick = 1,
): EtatClient {
  const vue: VuePartie = {
    tick,
    tempsRestantMs: 60_000,
    enPause: false,
    entites,
    objets: [],
    zones,
    classement: [],
  };

  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    moi: 'moi',
    partie: vue,
    salon: {
      idRoom: 'r',
      statut: 'enCours',
      mode: 'classique',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
  };
}

/** La vue affichee de cet etat: les positions telles quelles. */
function lissee(etat: EtatClient): VueLissee | undefined {
  const vue = etat.partie;

  return vue === undefined
    ? undefined
    : {
        vue,
        entites: vue.entites.map((entite) => ({
          entite,
          x: entite.x,
          y: entite.y,
          enMouvement: false,
        })),
        tempsRestantMs: vue.tempsRestantMs,
      };
}

/** Un guide neuf, sur un souvenir en memoire. */
function guide(): { guide: GuideDesZones; souvenir: SouvenirDesZones } {
  const souvenir = creerSouvenirDesZones();

  return { guide: creerGuideDesZones(souvenir), souvenir };
}

/** Une image du guide, sur cet etat, l'etat d'avant etant le meme. */
function image(
  leGuide: GuideDesZones,
  etat: EtatClient,
  maintenant: number,
  avant: EtatClient = etat,
): ReturnType<GuideDesZones['image']> {
  return leGuide.image(etat, avant, lissee(etat), maintenant);
}

describe('la bulle d une mine de zone', () => {
  it('se pose sur la mine proche, dit son effet, et compte une explication', () => {
    const { guide: leGuide, souvenir } = guide();

    const { bulles } = image(leGuide, partie([moi(0), mine('m1', 'repulsion', 150)]), 0);

    expect(bulles).toEqual([
      {
        cle: 'mine:m1',
        genre: 'mine',
        texte: 'Répulsion · les ninjas te fuient',
        nature: 'repulsion',
        x: 150,
        y: 0,
      },
    ]);
    expect(souvenir.explications('repulsion')).toBe(1);
  });

  it('garde son texte et ne recompte rien tant que la mine reste sur la carte', () => {
    const { guide: leGuide, souvenir } = guide();
    const pres = partie([moi(0), mine('m1', 'chaos', 150)]);
    const loin = partie([moi(0), mine('m1', 'chaos', 900)]);

    image(leGuide, pres, 0);
    expect(image(leGuide, loin, 100).bulles).toEqual([]);
    image(leGuide, pres, 200);

    expect(souvenir.explications('chaos')).toBe(1);
  });

  it('ne dit plus que le nom une fois l effet explique trois fois', () => {
    const { guide: leGuide } = guide();

    for (const id of ['m1', 'm2', 'm3']) {
      image(leGuide, partie([moi(0), mine(id, 'attraction', 150)]), 0);
    }

    expect(
      image(leGuide, partie([moi(0), mine('m4', 'attraction', 150)]), 0).bulles[0]?.texte,
    ).toBe('Attraction');
  });
});

describe('l entree dans une zone', () => {
  it('fait flotter sa phrase au-dessus de nous deux secondes et demie', () => {
    const { guide: leGuide } = guide();
    const dehors = partie([moi(500)], [zone('z1', 'chaos', 0)]);
    const dedans = partie([moi(50)], [zone('z1', 'chaos', 0)]);

    expect(image(leGuide, dehors, 0).bulles).toEqual([]);
    expect(image(leGuide, dedans, 1000).bulles).toEqual([
      {
        cle: 'entree:z1',
        genre: 'entree',
        texte: 'Chaos · les ninjas changent de couleur',
        nature: 'chaos',
        x: 50,
        y: 0,
      },
    ]);
    expect(image(leGuide, dedans, 1000 + DUREE_DE_LA_PHRASE_D_ENTREE_MS - 1).bulles).toHaveLength(
      1,
    );
    expect(image(leGuide, dedans, 1000 + DUREE_DE_LA_PHRASE_D_ENTREE_MS).bulles).toEqual([]);
  });

  it('pose un masque au-dessus de nous tant que l invisibilite nous cache', () => {
    const { guide: leGuide } = guide();
    const cache = partie([moi(50)], [zone('z1', 'invisibilite', 0)]);

    image(leGuide, cache, 0);
    const bulles = image(leGuide, cache, DUREE_DE_LA_PHRASE_D_ENTREE_MS).bulles;

    expect(bulles).toEqual([
      { cle: 'masque', genre: 'masque', texte: '', nature: 'invisibilite', x: 50, y: 0 },
    ]);
    expect(
      image(leGuide, partie([moi(500)], [zone('z1', 'invisibilite', 0)]), 3000).bulles,
    ).toEqual([]);
  });

  it('retient la duree de chaque zone a sa premiere vue, et oublie les zones fermees', () => {
    const { guide: leGuide } = guide();

    image(leGuide, partie([moi(500)], [zone('z1', 'chaos', 0, 12_000)]), 0);
    const plusTard = image(leGuide, partie([moi(500)], [zone('z1', 'chaos', 0, 7_000)]), 5000);

    expect(plusTard.dureesDesZones.get('z1')).toBe(12_000);
    expect(image(leGuide, partie([moi(500)]), 6000).dureesDesZones.size).toBe(0);
  });
});

describe('les ninjas que le chaos nous prend', () => {
  it('se cumulent une seconde, puis s affichent en un seul nombre sous notre ninja', () => {
    const { guide: leGuide } = guide();
    const chaos = [zone('z1', 'chaos', 0)];
    const avant = partie([moi(300), bot('b1', ROUGE, 10), bot('b2', ROUGE, 20)], chaos, 1);
    const unPris = partie([moi(300), bot('b1', '#33CC99', 10), bot('b2', ROUGE, 20)], chaos, 2);
    const deuxPris = partie(
      [moi(300), bot('b1', '#33CC99', 10), bot('b2', '#33CC99', 20)],
      chaos,
      3,
    );

    expect(image(leGuide, unPris, 0, avant).perteParLeChaos).toBeUndefined();
    expect(image(leGuide, deuxPris, 500, unPris).perteParLeChaos).toBeUndefined();
    expect(image(leGuide, deuxPris, CUMUL_DES_PERTES_DU_CHAOS_MS).perteParLeChaos).toEqual({
      ninjas: 2,
      x: 300,
      y: 0,
    });
    expect(image(leGuide, deuxPris, CUMUL_DES_PERTES_DU_CHAOS_MS + 100).perteParLeChaos).toBe(
      undefined,
    );
  });
});
