/**
 * Tests du HUD d'Among Ninjas pendant les sabotages (etape 7.22): l'alerte de la panne et de la
 * surchauffe, le bouton « Réparer » a qui peut reparer, le gong retenu pendant la surchauffe,
 * les postes marques sur la mini-carte et la carte, et le panneau de la carte plein ecran: les
 * sabotages d'un assassin, les maledictions d'une proie fantome, rien pour une proie vivante.
 */

import type { AmongVu, EntiteVue, EtatPriveAmong, SabotageEnCoursVu } from '@neon-ninja/shared';
import { CARTES, REGLAGES_PAR_DEFAUT, lieuxDuMode } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { amongHud, carteAmongDe } from './among.js';

const TOKYO = CARTES.map1;
const LIEUX = lieuxDuMode('map1', false) ?? expect.fail('Tokyo a ses lieux');

/** Un joueur vu a cette place. */
function joueur(id: string, x: number, y: number): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur: '#2EE6FF',
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

const PROIE: EtatPriveAmong = {
  role: 'proie',
  complices: [],
  fantome: false,
  gong: { x: 1145, y: 630 },
  stations: [{ x: 170, y: 180, nom: 'Pierre du jardin zen', natures: ['katana'] }],
  taches: [{ station: 0, nature: 'katana', faite: false }],
  gongUtilise: false,
};
const PROIE_FANTOME: EtatPriveAmong = { ...PROIE, fantome: true };
const ASSASSIN: EtatPriveAmong = { ...PROIE, role: 'tueur', complices: ['bob'], taches: [] };
const ASSASSIN_FANTOME: EtatPriveAmong = { ...ASSASSIN, fantome: true };

/** La panne de neons en cours, a reparer en changeant les fusibles. */
const PANNE: SabotageEnCoursVu = {
  nature: 'panne',
  restantMs: 0,
  consolesTenues: [false, false],
  reparation: 'fusibles',
  consolesPurgees: [false, false],
  interrupteursCoupes: 0,
};

/** La surchauffe en cours, aux deux cles: les deux consoles purgees, la premiere cle tournee. */
const SURCHAUFFE: SabotageEnCoursVu = {
  nature: 'surchauffe',
  restantMs: 31_200,
  consolesTenues: [true, false],
  reparation: 'cles',
  consolesPurgees: [true, true],
  interrupteursCoupes: 0,
};

/** Nous, a cette place, dans une partie a cette phase, avec ce que le flux dit du mode. */
function etat(
  prive: EtatPriveAmong,
  ici: { readonly x: number; readonly y: number },
  among: Partial<AmongVu> = {},
  miroir = false,
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
      reglages: { ...REGLAGES_PAR_DEFAUT, carte: 'map1', modeMiroir: miroir },
    },
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites: [joueur('moi', ici.x, ici.y)],
      objets: [],
      zones: [],
      classement: [],
      among: { phase: 'jeu', restantMs: 0, tachesFaites: 0, tachesTotal: 10, ...among },
    },
    among: { prive, reunion: undefined, morts: [] },
  };
}

/** Une place loin de tout poste, de toute station et du gong. */
const AILLEURS = { x: 1000, y: 1100 };

describe('l alerte d un sabotage', () => {
  it('dit la panne en bas de l ecran, sans compte a rebours', () => {
    expect(amongHud(etat(PROIE, AILLEURS, { sabotage: PANNE }))?.alerte).toEqual({
      genre: 'panne',
      titre: 'Panne de néons',
      detail: 'Changez les fusibles',
      compte: undefined,
    });
    // Chaque reparation de la panne se nomme (etape 7.27).
    for (const [reparation, detail] of [
      ['lanceur', 'Relancez le générateur'],
      ['frequence', 'Accordez la fréquence'],
    ] as const) {
      expect(
        amongHud(etat(PROIE, AILLEURS, { sabotage: { ...PANNE, reparation } }))?.alerte?.detail,
      ).toBe(detail);
    }
  });

  it('dit la surchauffe, son compte a rebours a la seconde superieure et les cles tournees', () => {
    expect(amongHud(etat(ASSASSIN, AILLEURS, { sabotage: SURCHAUFFE }))?.alerte).toEqual({
      genre: 'surchauffe',
      titre: 'Surchauffe',
      detail: 'Tournez les clés ensemble : 1 sur 2',
      compte: '32',
    });
  });

  it('dit les consoles a purger, puis le relais et ses interrupteurs (etape 7.27)', () => {
    const detail = (sabotage: SabotageEnCoursVu) =>
      amongHud(etat(PROIE, AILLEURS, { sabotage }))?.alerte?.detail;

    expect(
      detail({ ...SURCHAUFFE, consolesTenues: [false, false], consolesPurgees: [true, false] }),
    ).toBe('Purgez les deux consoles : 1 sur 2');
    expect(
      detail({
        ...SURCHAUFFE,
        consolesTenues: [false, false],
        consolesPurgees: [false, false],
        reparation: 'relais',
        interrupteursCoupes: 3,
        prochaineConsole: 0,
      }),
    ).toBe('Coupez les interrupteurs, d’une console à l’autre : 3 sur 4');
  });

  it('ne dit rien d une nuisance ni du nuage, ni hors du jeu', () => {
    const flou: SabotageEnCoursVu = { ...PANNE, nature: 'flou', restantMs: 6_000 };

    expect(amongHud(etat(ASSASSIN, AILLEURS, { sabotage: flou }))?.alerte).toBeUndefined();
    expect(amongHud(etat(PROIE, AILLEURS))?.alerte).toBeUndefined();
    expect(
      amongHud(etat(PROIE, AILLEURS, { phase: 'discussion', sabotage: PANNE }))?.alerte,
    ).toBeUndefined();
  });
});

describe('le bouton Reparer', () => {
  const auBoitier = LIEUX.boitier;
  const aLaConsole = LIEUX.consoles[1];

  it('se propose au boitier pendant la panne, a une proie vivante ou fantome et a un assassin vivant', () => {
    for (const prive of [PROIE, PROIE_FANTOME, ASSASSIN]) {
      const hud = amongHud(etat(prive, auBoitier, { sabotage: PANNE }));

      expect(hud?.geste).toBe('reparer');
      expect(hud?.libelleDuGeste).toBe('Réparer');
    }

    expect(amongHud(etat(ASSASSIN_FANTOME, auBoitier, { sabotage: PANNE }))?.geste).toBe('aucun');
  });

  it('se propose a une console pendant la surchauffe, aux vivants seulement', () => {
    expect(amongHud(etat(PROIE, aLaConsole, { sabotage: SURCHAUFFE }))?.geste).toBe('reparer');
    expect(amongHud(etat(ASSASSIN, aLaConsole, { sabotage: SURCHAUFFE }))?.geste).toBe('reparer');
    expect(amongHud(etat(PROIE_FANTOME, aLaConsole, { sabotage: SURCHAUFFE }))?.geste).toBe(
      'aucun',
    );
  });

  it('ne se propose ni sans le sabotage du poste, ni a cote du poste', () => {
    expect(amongHud(etat(PROIE, auBoitier))?.geste).toBe('aucun');
    expect(amongHud(etat(PROIE, auBoitier, { sabotage: SURCHAUFFE }))?.geste).toBe('aucun');
    expect(amongHud(etat(PROIE, aLaConsole, { sabotage: PANNE }))?.geste).toBe('aucun');
    expect(
      amongHud(etat(PROIE, { x: auBoitier.x + 60, y: auBoitier.y }, { sabotage: PANNE }))?.geste,
    ).toBe('aucun');
  });

  it('suit le miroir de la carte', () => {
    const retourne = { x: TOKYO.largeur - auBoitier.x, y: auBoitier.y };

    expect(amongHud(etat(PROIE, retourne, { sabotage: PANNE }, true))?.geste).toBe('reparer');
    expect(amongHud(etat(PROIE, auBoitier, { sabotage: PANNE }, true))?.geste).toBe('aucun');
  });
});

describe('le gong pendant la surchauffe', () => {
  it('ne se propose pas pendant la surchauffe, et se propose pendant les autres sabotages', () => {
    const auGong = PROIE.gong;

    expect(amongHud(etat(PROIE, auGong, { sabotage: SURCHAUFFE }))?.geste).toBe('aucun');
    expect(amongHud(etat(PROIE, auGong, { sabotage: PANNE }))?.geste).toBe('gong');
    expect(amongHud(etat(PROIE, auGong))?.geste).toBe('gong');
  });
});

describe('les postes marques', () => {
  /** Une place de la carte, en part de la carte. */
  const enPart = ({ x, y }: { readonly x: number; readonly y: number }) => ({
    x: x / TOKYO.largeur,
    y: y / TOKYO.hauteur,
  });

  it('marquent le boitier pendant la panne, les deux consoles pendant la surchauffe, rien sinon', () => {
    expect(amongHud(etat(PROIE, AILLEURS, { sabotage: PANNE }))?.minimap.postes).toEqual([
      { ...enPart(LIEUX.boitier), tenu: false },
    ]);
    expect(carteAmongDe(etat(PROIE, AILLEURS, { sabotage: SURCHAUFFE }))?.postes).toEqual([
      { ...enPart(LIEUX.consoles[0]), tenu: true },
      { ...enPart(LIEUX.consoles[1]), tenu: false },
    ]);
    expect(amongHud(etat(PROIE, AILLEURS))?.minimap.postes).toEqual([]);
  });
});

describe('le panneau de la carte plein ecran', () => {
  it('donne a un assassin les six sabotages, prets, quand rien ne court', () => {
    const panneau = carteAmongDe(etat(ASSASSIN, AILLEURS, { rechargeDesSabotagesMs: 0 }))?.panneau;

    expect(panneau?.genre).toBe('sabotages');
    expect(panneau?.etat).toBe('Prêt');
    expect(panneau?.boutons.map((choix) => choix.libelle)).toEqual([
      'Vision floue',
      'Vision négative',
      'Commandes inversées',
      'Nuage noir',
      'Panne de néons',
      'Surchauffe',
    ]);
    expect(panneau?.boutons.every((choix) => choix.pret)).toBe(true);
  });

  it('grise les sabotages pendant la recharge, et dit le temps qu il reste', () => {
    const panneau = carteAmongDe(
      etat(ASSASSIN, AILLEURS, { rechargeDesSabotagesMs: 11_400 }),
    )?.panneau;

    expect(panneau?.etat).toBe('Prochain dans 12 s');
    expect(panneau?.boutons.some((choix) => choix.pret)).toBe(false);
  });

  it('grise les sabotages pendant un sabotage, et le nomme', () => {
    const panneau = carteAmongDe(etat(ASSASSIN_FANTOME, AILLEURS, { sabotage: PANNE }))?.panneau;

    expect(panneau?.etat).toBe('En cours : Panne de néons');
    expect(panneau?.boutons.some((choix) => choix.pret)).toBe(false);
  });

  it('donne a une proie fantome les trois maledictions et leur recharge commune', () => {
    const prete = carteAmongDe(etat(PROIE_FANTOME, AILLEURS))?.panneau;
    const attente = carteAmongDe(
      etat(PROIE_FANTOME, AILLEURS, { rechargeDeLaMaledictionMs: 40_000 }),
    )?.panneau;

    expect(prete?.genre).toBe('maledictions');
    expect(prete?.titre).toBe('Maudire les assassins');
    expect(prete?.boutons.map((choix) => choix.nature)).toEqual([
      'flou',
      'negatif',
      'controlesInverses',
    ]);
    expect(prete?.boutons.every((choix) => choix.pret)).toBe(true);
    expect(attente?.etat).toBe('Prochain dans 40 s');
    expect(attente?.boutons.some((choix) => choix.pret)).toBe(false);
  });

  it('ne donne rien a une proie vivante, meme pendant un sabotage', () => {
    expect(carteAmongDe(etat(PROIE, AILLEURS))?.panneau).toBeUndefined();
    expect(carteAmongDe(etat(PROIE, AILLEURS, { sabotage: PANNE }))?.panneau).toBeUndefined();
  });
});
