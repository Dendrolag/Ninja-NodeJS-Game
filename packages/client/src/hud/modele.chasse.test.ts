/**
 * Tests du HUD d'une partie Chasse (etape 7.3): notre role, les proies restantes, les vies
 * d'un traqueur sur le bouton de capture, et un radar qui ne se montre que pendant notre
 * Revelation.
 *
 * Ce que ces tests protegent: le camouflage. Un radar toujours affiche dirait aux traqueurs ou
 * chercher les proies.
 */

import type { EntiteVue, InfosSalon, LigneClassement } from '@neon-ninja/shared';
import { CHASSE, COULEUR_DES_TRAQUEURS, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import type { VuePartie } from '../reconstruction.js';
import { construireHud } from './modele.js';

/** Une ligne de classement: sa couleur et ses points. */
function ligne(id: string, couleur: string, points = 0): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur,
    points,
    botsPortes: 0,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

/** Un joueur sur la carte; un traqueur porte son arme, dont les charges sont ses vies. */
function joueur(id: string, couleur: string): EntiteVue {
  return {
    type: 'joueur',
    id,
    x: 100,
    y: 100,
    couleur,
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
    ...(couleur === COULEUR_DES_TRAQUEURS
      ? { tactique: { orientation: 'est', charges: 2, avantProchaineChargeMs: 0 } }
      : {}),
  };
}

/** Le salon d'une partie en cours, dans ce mode. */
function salon(mode: InfosSalon['mode']): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'enCours',
    mode,
    visibilite: 'publique',
    capacite: 10,
    joueurs: [],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Deux proies, Eve et Ana, et un traqueur, Bob. */
const CLASSEMENT: readonly LigneClassement[] = [
  ligne('bob', COULEUR_DES_TRAQUEURS, 125),
  ligne('eve', '#FF0000', 40),
  ligne('ana', '#00FF00', 12),
];

/**
 * Un client en jeu dans ce mode, sous l'identifiant donne.
 *
 * @param surLaCarte Les joueurs encore sur la carte: tous, sauf un traqueur elimine.
 */
function etat(
  moi: string,
  mode: InfosSalon['mode'] = 'chasse',
  surLaCarte: readonly string[] = CLASSEMENT.map((une) => une.id),
): EtatClient {
  const partie: VuePartie = {
    tick: 1,
    tempsRestantMs: 90_000,
    enPause: false,
    entites: CLASSEMENT.filter((une) => surLaCarte.includes(une.id)).map((une) =>
      joueur(une.id, une.couleur),
    ),
    objets: [],
    zones: [],
    classement: CLASSEMENT,
  };

  return { ...ETAT_INITIAL, ecran: 'jeu', moi, partie, salon: salon(mode) };
}

describe('le HUD d une partie Chasse', () => {
  it('dit a une proie son role et les proies restantes, sans bouton de capture', () => {
    const hud = construireHud(etat('eve'), 0);

    expect(hud.chasse).toEqual({
      camp: 'proies',
      role: 'Proie',
      consigne: 'Cachez-vous, et bougez pour marquer',
      proies: '2 proies restantes',
    });
    expect(hud.charges).toBeUndefined();
  });

  it('dit a un traqueur son role, et montre ses vies sur le bouton de capture', () => {
    const hud = construireHud(etat('bob'), 0);

    expect(hud.chasse).toMatchObject({
      camp: 'traqueurs',
      role: 'Traqueur',
      consigne: 'Visez les vrais joueurs',
    });
    expect(hud.charges).toEqual({
      disponibles: 2,
      maximum: CHASSE.VIES_DES_TRAQUEURS,
      recharge: 0,
    });
  });

  it('dit a un traqueur elimine qu il regarde la suite, sans bouton', () => {
    const hud = construireHud(etat('bob', 'chasse', ['eve', 'ana']), 0);

    expect(hud.chasse).toMatchObject({ role: 'Éliminé', consigne: 'Vous regardez la suite' });
    expect(hud.charges).toBeUndefined();
  });

  it('accorde les proies restantes', () => {
    const classement = (lignes: readonly LigneClassement[]): EtatClient => {
      const base = etat('bob');
      return { ...base, partie: { ...(base.partie as VuePartie), classement: lignes } };
    };
    const une = [ligne('bob', COULEUR_DES_TRAQUEURS), ligne('eve', '#FF0000')];

    expect(construireHud(classement(une), 0).chasse?.proies).toBe('1 proie restante');
    expect(construireHud(classement([ligne('bob', COULEUR_DES_TRAQUEURS)]), 0).chasse?.proies).toBe(
      'Plus aucune proie',
    );
  });

  it('ne montre pas de radar hors de notre Revelation, ni aux traqueurs ni aux proies', () => {
    expect(construireHud(etat('bob'), 0).radar).toBeUndefined();
    expect(construireHud(etat('eve'), 0).radar).toBeUndefined();
  });

  it('sous Revelation, montre tous les joueurs recus, comme les halos de la scene', () => {
    const revele: EtatClient = {
      ...etat('bob'),
      effets: [
        {
          categorie: 'bonus',
          nature: 'revelation',
          surMoi: true,
          finPrevueA: 10_000,
          dureeMs: 10_000,
        },
      ],
    };

    expect(construireHud(revele, 0).radar?.map((point) => point.id)).toEqual(['bob', 'eve', 'ana']);
  });

  it('ne dit rien de la Chasse dans un autre mode', () => {
    expect(construireHud(etat('eve', 'classique'), 0).chasse).toBeUndefined();
  });
});
