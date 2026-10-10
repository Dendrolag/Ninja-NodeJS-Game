/**
 * Tests de la victime a portee d'un assassin d'Among Ninjas (etape 7.20, demande du porteur du
 * projet du 10 octobre 2026): la proie qu'il tuerait s'il frappait maintenant, en legere
 * surbrillance sur la carte, et le katana grise tant qu'il n'y en a pas.
 */

import type { EntiteVue, EtatPriveAmong, LigneClassement } from '@neon-ninja/shared';
import { AMONG, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { victimeAPortee } from './among.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { construireHud } from './hud/modele.js';
import { imageDAmong } from './rendu/among.js';

/** Un joueur vu, avec son katana s'il en porte un. */
function joueur(id: string, x: number, katana?: { charges: number }): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y: 500,
    couleur: '#FF3030',
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
    ...(katana === undefined
      ? {}
      : {
          tactique: {
            orientation: 'est',
            charges: katana.charges,
            avantProchaineChargeMs: katana.charges > 0 ? 0 : 5000,
          },
        }),
  } as EntiteVue;
}

/** Notre etat prive d'assassin, avec ce complice. */
const ASSASSIN: EtatPriveAmong = {
  role: 'tueur',
  complices: ['eve'],
  fantome: false,
  gong: { x: 1145, y: 630 },
  stations: [],
  taches: [],
  gongUtilise: false,
};

/** Une ligne du classement. */
function ligne(id: string): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur: '#FF3030',
    points: 0,
    botsPortes: 0,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

/** Nous, en jeu, avec ces entites en vue. */
function etat(
  entites: readonly EntiteVue[],
  prive: EtatPriveAmong = ASSASSIN,
  phase: 'jeu' | 'vote' = 'jeu',
): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    moi: 'moi',
    salon: {
      idRoom: 'room-1',
      statut: 'enCours',
      mode: 'among',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites,
      objets: [],
      zones: [],
      classement: entites.map((entite) => ligne(entite.id)),
      among: { phase, restantMs: 0, tachesFaites: 0, tachesTotal: 10 },
    },
    among: { prive, reunion: undefined, morts: [] },
  };
}

const PORTEE = AMONG.PORTEE_DU_MEURTRE_PX;

describe('la victime a portee', () => {
  it('est la proie la plus proche a portee, le katana pret', () => {
    const vue = [
      joueur('moi', 500, { charges: 1 }),
      joueur('loin', 500 + PORTEE + 1),
      joueur('bob', 500 - PORTEE),
      joueur('kim', 500 + PORTEE - 10),
    ];

    expect(victimeAPortee(etat(vue))).toBe('kim');
  });

  it('n existe pas sans katana pret, pour un complice, hors du jeu, ni pour une proie', () => {
    const proche = joueur('bob', 510);

    expect(victimeAPortee(etat([joueur('moi', 500, { charges: 0 }), proche]))).toBeUndefined();
    expect(
      victimeAPortee(etat([joueur('moi', 500, { charges: 1 }), joueur('eve', 510)])),
    ).toBeUndefined();
    expect(
      victimeAPortee(etat([joueur('moi', 500, { charges: 1 }), proche], ASSASSIN, 'vote')),
    ).toBeUndefined();
    expect(
      victimeAPortee(etat([joueur('moi', 500), proche], { ...ASSASSIN, role: 'proie' })),
    ).toBeUndefined();
  });

  it('active le katana face a elle seulement, et la met en surbrillance', () => {
    const avec = etat([joueur('moi', 500, { charges: 1 }), joueur('bob', 510)]);
    const sans = etat([joueur('moi', 500, { charges: 1 }), joueur('bob', 700)]);

    expect(construireHud(avec, 0).charges?.inactif).toBeUndefined();
    expect(construireHud(sans, 0).charges?.inactif).toBe(true);

    const lissee = (vue: EtatClient) => ({
      vue: vue.partie as NonNullable<EtatClient['partie']>,
      entites: (vue.partie?.entites ?? []).map((entite) => ({
        entite,
        x: entite.x,
        y: entite.y,
        enMouvement: false,
      })),
      tempsRestantMs: 0,
    });
    const halo = (vue: EtatClient) =>
      imageDAmong(vue, lissee(vue), 'ninja.png', 0).disques.filter((disque) =>
        disque.id.endsWith(':victime'),
      );

    expect(halo(avec)).toEqual([expect.objectContaining({ id: 'bob:victime', x: 510, y: 500 })]);
    expect(halo(sans)).toEqual([]);
  });
});
