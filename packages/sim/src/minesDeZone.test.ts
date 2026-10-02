/**
 * Tests des mines de zone (etape 7.12): la pose a la place de l'apparition spontanee des
 * zones, l'armement par un joueur ou un Black Ninja, et l'ouverture de la zone trois secondes
 * plus tard.
 *
 * Aucune version du jeu d'origine n'avait de mine de zone: les attentes sont les decisions du
 * porteur du projet du 28 septembre 2026 (docs/plan/etape-7-12.md). Les effets des zones une
 * fois ouvertes ne changent pas, et restent testes dans zones.test.ts.
 */

import type { Couleur, Position, ReglagesPartiels, TypeZone } from '@neon-ninja/shared';
import { APPARITION, MINES_DE_ZONE, ZONES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type {
  EtatPartie,
  EvenementPartie,
  IdentifiantEntite,
  Joueur,
  MineDeZone,
  MineSurLaCarte,
  ZoneSpeciale,
} from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';
import type { Entrees } from './moteur.js';
import { REGLES_DES_MODES, lancerLaPartie, tick } from './moteur.js';
import { avancerLesZones } from './zones.js';

/**
 * Reglages ou rien n'apparait tout seul, sauf les mines de zone, posees toutes les deux
 * minutes: assez loin pour que les tests courts posent les leurs a la main.
 */
const AUCUNE_APPARITION: ReglagesPartiels = {
  bonus: {
    types: {
      vitesse: { tauxApparitionPourCent: 0 },
      invincibilite: { tauxApparitionPourCent: 0 },
      revelation: { tauxApparitionPourCent: 0 },
    },
  },
  malus: { tauxApparitionPourCent: 0 },
  zones: { actives: true, intervalleApparitionS: 120 },
  botsNoirs: { actifs: false },
  evade: false,
  objetsDePoche: { fumee: { tauxApparitionPourCent: 0 }, mine: { tauxApparitionPourCent: 0 } },
};

/** Les reglages de zones par defaut, sans joueurs ni bots: seules les poses comptent. */
const POSE_TOUTES_LES_15_S: ReglagesPartiels = { botsNoirs: { actifs: false }, evade: false };

const ICI: Position = { x: 500, y: 500 };
const ROUGE: Couleur = '#FF0000';
const BLEU: Couleur = '#0000FF';

/** Une partie vide, pas encore lancee. */
function partie(mode: EtatPartie['mode'] = 'classique', graine = 7): EtatPartie {
  return creerEtatInitial({ graine, mode, reglages: AUCUNE_APPARITION });
}

/** Une position a cette distance a l'est d'ICI. */
function aLEst(distance: number): Position {
  return { x: ICI.x + distance, y: ICI.y };
}

/** Fait entrer un joueur a une place donnee, sorti de sa protection. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  position: Position,
  couleur: Couleur = ROUGE,
): EtatPartie {
  const entre = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
  const joueur = entre.joueurs[id] as Joueur;
  return {
    ...entre,
    joueurs: { ...entre.joueurs, [id]: { ...joueur, protectionSpawnRestanteMs: 0 } },
  };
}

/** Pose une mine de zone a la main, armee ou non. */
function avecMineDeZone(
  etat: EtatPartie,
  position: Position = ICI,
  nature: TypeZone = 'repulsion',
  id: IdentifiantEntite = 'mz1',
  avantOuvertureMs?: number,
): EtatPartie {
  const mine: MineDeZone = {
    id,
    nature,
    position,
    ...(avantOuvertureMs === undefined ? {} : { avantOuvertureMs }),
  };
  return { ...etat, minesDeZone: { ...etat.minesDeZone, [id]: mine } };
}

/** Un battement des zones seules, journal remis a zero, avec les joueurs hors jeu du mode. */
function zones(etat: EtatPartie, dtMs = 50): EtatPartie {
  return avancerLesZones(
    { ...etat, evenements: [] },
    dtMs,
    REGLES_DES_MODES[etat.mode].horsJeu(etat),
  );
}

/** Des battements des zones seules, pendant cette duree. */
function pendant(etat: EtatPartie, dureeMs: number, dtMs = 50): EtatPartie {
  let courant = etat;
  for (let ecoule = 0; ecoule < dureeMs; ecoule += dtMs) {
    courant = zones(courant, dtMs);
  }
  return courant;
}

/** Les faits d'un type du dernier battement. */
function faits<T extends EvenementPartie['type']>(
  etat: EtatPartie,
  type: T,
): Extract<EvenementPartie, { type: T }>[] {
  return etat.evenements.filter(
    (evenement): evenement is Extract<EvenementPartie, { type: T }> => evenement.type === type,
  );
}

/** Les mines de zone de la carte, dans l'ordre de leur pose. */
function lesMines(etat: EtatPartie): readonly MineDeZone[] {
  return Object.values(etat.minesDeZone ?? {});
}

/** Les zones ouvertes de la carte. */
function lesZones(etat: EtatPartie): readonly ZoneSpeciale[] {
  return Object.values(etat.zones);
}

describe('la pose des mines de zone', () => {
  it('attend l intervalle regle, puis pose une mine, et aucune zone', () => {
    const depart = creerEtatInitial({ graine: 1, reglages: POSE_TOUTES_LES_15_S });

    expect(lesMines(avancerLesZones(depart, 14_999))).toEqual([]);

    const apres = avancerLesZones(depart, 15_000);
    const [mine] = lesMines(apres);
    expect(lesMines(apres)).toHaveLength(1);
    expect(mine?.avantOuvertureMs).toBeUndefined();
    expect(lesZones(apres)).toEqual([]);
    expect(apres.evenements).toEqual([
      {
        type: 'mineDeZonePosee',
        mine: mine?.id,
        nature: mine?.nature,
        position: mine?.position,
      },
    ]);
  });

  it('n ouvre plus jamais de zone d elle-meme', () => {
    let etat = creerEtatInitial({ graine: 1, reglages: POSE_TOUTES_LES_15_S });
    for (let battement = 0; battement < 2_400; battement += 1) {
      etat = avancerLesZones(etat, 50);
    }

    expect(lesZones(etat)).toEqual([]);
    expect(lesMines(etat).length).toBeGreaterThan(0);
  });

  it('s arrete au plafond regle de mines qui attendent, trois par defaut', () => {
    const plafond = (reglages: ReglagesPartiels): number => {
      let etat = creerEtatInitial({
        graine: 1,
        reglages: { ...POSE_TOUTES_LES_15_S, ...reglages },
      });
      for (let battement = 0; battement < 4_000; battement += 1) {
        etat = avancerLesZones(etat, 50);
      }
      return lesMines(etat).length;
    };

    expect(MINES_DE_ZONE.MAXIMUM_PAR_DEFAUT).toBe(3);
    expect(plafond({})).toBe(3);
    expect(plafond({ zones: { minesMaximum: 5 } })).toBe(5);
    expect(plafond({ zones: { minesMaximum: 1 } })).toBe(1);
  });

  it('ne compte pas les mines armees: leur zone est deja promise', () => {
    let etat = creerEtatInitial({
      graine: 1,
      reglages: { ...POSE_TOUTES_LES_15_S, zones: { minesMaximum: 1 } },
    });
    etat = avancerLesZones(etat, 15_000);
    const [premiere] = lesMines(etat) as [MineDeZone];
    etat = avecMineDeZone(etat, premiere.position, premiere.nature, premiere.id, 20_000);

    const apres = avancerLesZones(etat, 15_000);

    expect(lesMines(apres)).toHaveLength(2);
    expect(lesMines(apres).filter((mine) => mine.avantOuvertureMs === undefined)).toHaveLength(1);
  });

  it('tire la nature cachee parmi les seules natures cochees', () => {
    let etat = creerEtatInitial({
      graine: 11,
      reglages: {
        ...POSE_TOUTES_LES_15_S,
        zones: { types: { chaos: false, repulsion: true, attraction: false, invisibilite: true } },
      },
    });
    for (let battement = 0; battement < 4_000; battement += 1) {
      etat = avancerLesZones(etat, 50);
    }

    for (const mine of lesMines(etat)) {
      expect(['repulsion', 'invisibilite']).toContain(mine.nature);
    }
  });

  it('cache toutes les natures au fil des graines, sauf le chaos en Massacre', () => {
    const natures = (mode: EtatPartie['mode']): Set<TypeZone> => {
      const vues = new Set<TypeZone>();
      for (let graine = 0; graine < 40; graine += 1) {
        const etat = avancerLesZones(
          creerEtatInitial({ graine, mode, reglages: POSE_TOUTES_LES_15_S }),
          15_000,
        );
        for (const mine of lesMines(etat)) {
          vues.add(mine.nature);
        }
      }
      return vues;
    };

    expect([...natures('classique')].sort()).toEqual([
      'attraction',
      'chaos',
      'invisibilite',
      'repulsion',
    ]);
    expect(natures('massacre').has('chaos')).toBe(false);
    expect(natures('massacre').size).toBe(3);
  });

  it('ne pose rien, et ne tire rien, quand aucune nature n est cochee', () => {
    const etat = creerEtatInitial({
      graine: 1,
      reglages: {
        ...POSE_TOUTES_LES_15_S,
        zones: {
          types: { chaos: false, repulsion: false, attraction: false, invisibilite: false },
        },
      },
    });
    const apres = avancerLesZones(etat, 60_000);

    expect(lesMines(apres)).toEqual([]);
    expect(apres.alea).toEqual(etat.alea);
  });

  it('pose loin des joueurs, des Black Ninjas et des autres mines de zone', () => {
    for (let graine = 0; graine < 20; graine += 1) {
      let etat = creerEtatInitial({
        graine,
        reglages: { ...POSE_TOUTES_LES_15_S, zones: { minesMaximum: 10 } },
      });
      // Une grille de joueurs et de Black Ninjas, qui laisse de la place entre eux.
      for (let rang = 0; rang < 12; rang += 1) {
        const position = { x: 200 + (rang % 4) * 500, y: 200 + Math.floor(rang / 4) * 500 };
        etat =
          rang % 3 === 0
            ? ajouterBot(etat, { id: `noir${String(rang)}`, type: 'botNoir', position })
            : ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `j${String(rang)}`, position });
      }
      const occupees = [
        ...Object.values(etat.joueurs).map((joueur) => joueur.position),
        ...Object.values(etat.bots).map((bot) => bot.position),
      ];

      const apres = avancerLesZones(etat, 150_000);
      const mines = lesMines(apres);
      expect(mines.length).toBeGreaterThan(1);

      for (const [rang, mine] of mines.entries()) {
        const autres = [...occupees, ...mines.slice(0, rang).map((autre) => autre.position)];
        for (const autre of autres) {
          expect(
            Math.hypot(mine.position.x - autre.x, mine.position.y - autre.y),
          ).toBeGreaterThanOrEqual(APPARITION.DISTANCE_DE_SECURITE);
        }
      }
    }
  });

  it('rejoue les memes mines a graine egale', () => {
    const derouler = (graine: number): readonly MineDeZone[] =>
      lesMines(
        avancerLesZones(creerEtatInitial({ graine, reglages: POSE_TOUTES_LES_15_S }), 45_000),
      );

    expect(derouler(77)).toEqual(derouler(77));
    expect(derouler(77)).not.toEqual(derouler(78));
  });

  it('ne pose rien quand les zones sont desactivees, et retire les mines deja posees', () => {
    const coupees = creerEtatInitial({
      graine: 1,
      reglages: { ...POSE_TOUTES_LES_15_S, zones: { actives: false } },
    });

    expect(avancerLesZones(coupees, 120_000)).toBe(coupees);

    const avecUneMine = avecMineDeZone(coupees);
    const videe = avancerLesZones(avecUneMine, 50);
    expect(videe.minesDeZone).toBeUndefined();
    expect('minesDeZone' in videe).toBe(false);
  });
});

describe('l armement des mines de zone', () => {
  it('est le fait d un joueur qui passe dessus, et se dit au journal', () => {
    const etat = zones(avecJoueur(avecMineDeZone(partie()), 'alice', aLEst(19)));

    expect(etat.minesDeZone?.['mz1']?.avantOuvertureMs).toBe(
      MINES_DE_ZONE.DELAI_AVANT_OUVERTURE_MS,
    );
    expect(faits(etat, 'mineDeZoneArmee')).toEqual([
      { type: 'mineDeZoneArmee', mine: 'mz1', nature: 'repulsion', par: 'alice', position: ICI },
    ]);
  });

  it('se mesure comme un contact, en inegalite stricte', () => {
    const etat = zones(avecJoueur(avecMineDeZone(partie()), 'alice', aLEst(20)));

    expect(etat.minesDeZone?.['mz1']?.avantOuvertureMs).toBeUndefined();
    expect(faits(etat, 'mineDeZoneArmee')).toEqual([]);
  });

  it('est le fait de tout joueur, quelle que soit sa couleur ou son equipe', () => {
    let etat = avecMineDeZone(partie('equipes'), ICI, 'chaos', 'rouge');
    etat = avecMineDeZone(etat, { x: 900, y: 500 }, 'chaos', 'bleu');
    etat = avecJoueur(etat, 'alice', ICI, ROUGE);
    etat = avecJoueur(etat, 'bob', { x: 900, y: 500 }, BLEU);

    const apres = zones(etat);

    expect(faits(apres, 'mineDeZoneArmee').map((fait) => [fait.mine, fait.par])).toEqual([
      ['rouge', 'alice'],
      ['bleu', 'bob'],
    ]);
  });

  it('est le fait d un joueur protege comme d un autre', () => {
    const etat = ajouterJoueur(avecMineDeZone(partie()), {
      id: 'alice',
      pseudo: 'alice',
      position: ICI,
    });

    expect((etat.joueurs['alice'] as Joueur).protectionSpawnRestanteMs).toBeGreaterThan(0);
    expect(zones(etat).minesDeZone?.['mz1']?.avantOuvertureMs).toBeDefined();
  });

  it('n est pas le fait d un joueur hors jeu', () => {
    const etat = avecJoueur(avecMineDeZone(partie()), 'alice', ICI);
    const apres = avancerLesZones(etat, 50, new Set(['alice']));

    expect(apres.minesDeZone?.['mz1']?.avantOuvertureMs).toBeUndefined();
  });

  it('est le fait d un Black Ninja, pas d un faux ninja', () => {
    const faux = zones(ajouterBot(avecMineDeZone(partie()), { id: 'b1', position: ICI }));
    expect(faux.minesDeZone?.['mz1']?.avantOuvertureMs).toBeUndefined();

    const noir = zones(
      ajouterBot(avecMineDeZone(partie()), { id: 'n1', type: 'botNoir', position: aLEst(10) }),
    );
    expect(faits(noir, 'mineDeZoneArmee')).toEqual([
      { type: 'mineDeZoneArmee', mine: 'mz1', nature: 'repulsion', par: 'n1', position: ICI },
    ]);
  });

  it('prefere un joueur a un Black Ninja qui la touchent ensemble', () => {
    let etat = ajouterBot(avecMineDeZone(partie()), { id: 'n1', type: 'botNoir', position: ICI });
    etat = avecJoueur(etat, 'alice', ICI);

    expect(faits(zones(etat), 'mineDeZoneArmee')[0]?.par).toBe('alice');
  });

  it('n est pas le fait de l Evade', () => {
    const etat: EtatPartie = {
      ...avecMineDeZone(partie()),
      evade: {
        apparitionMs: 0,
        passe: false,
        porteur: undefined,
        surLaCarte: {
          id: 'evade',
          position: ICI,
          direction: 'est',
          cap: { x: 1, y: 0 },
          avantDecisionMs: 100,
          avantChangementDeCapMs: 100,
          avantDepartMs: 10_000,
        },
      },
    };

    expect(zones(etat).minesDeZone?.['mz1']?.avantOuvertureMs).toBeUndefined();
  });

  it('ne se refait pas: une mine armee garde son delai, sans fait nouveau', () => {
    const armee = zones(avecJoueur(avecMineDeZone(partie()), 'alice', ICI));
    const suite = zones(armee, 1_000);

    expect(suite.minesDeZone?.['mz1']?.avantOuvertureMs).toBe(2_000);
    expect(faits(suite, 'mineDeZoneArmee')).toEqual([]);
  });

  it('rend l etat tel quel quand personne ne touche une mine', () => {
    const etat = { ...avecMineDeZone(partie()), evenements: [] };

    expect(avancerLesZones(etat, 50)).toEqual({
      ...etat,
      prochainesApparitions: {
        ...etat.prochainesApparitions,
        zoneMs: etat.prochainesApparitions.zoneMs - 50,
      },
    });
  });
});

describe('l ouverture de la zone', () => {
  /** Une mine armee par Alice, qui s'en va aussitot. */
  function armee(nature: TypeZone = 'repulsion'): EtatPartie {
    const etat = zones(avecJoueur(avecMineDeZone(partie(), ICI, nature), 'alice', ICI));
    return {
      ...etat,
      joueurs: {
        ...etat.joueurs,
        alice: { ...(etat.joueurs['alice'] as Joueur), position: { x: 1500, y: 1200 } },
      },
    };
  }

  it('attend trois secondes apres l armement, pas une de moins', () => {
    const presque = pendant(armee(), 2_950);
    expect(lesZones(presque)).toEqual([]);
    expect(lesMines(presque)).toHaveLength(1);

    const ouverte = zones(presque);
    expect(lesZones(ouverte)).toHaveLength(1);
  });

  it('ouvre la zone de sa nature a la place de la mine, au rayon fixe, et retire la mine', () => {
    const ouverte = zones(armee('invisibilite'), 3_000);
    const [zone] = lesZones(ouverte) as [ZoneSpeciale];

    expect(zone.type).toBe('invisibilite');
    expect(zone.centre).toEqual(ICI);
    expect(zone.rayon).toBe(ZONES.RAYON_PX);
    expect(ZONES.RAYON_PX).toBe(220);
    expect(ouverte.minesDeZone).toBeUndefined();
    expect(faits(ouverte, 'zoneOuverte')).toEqual([
      { type: 'zoneOuverte', mine: 'mz1', zone: zone.id, nature: 'invisibilite', position: ICI },
    ]);
  });

  it('tire une duree entiere entre le minimum et le maximum regles', () => {
    for (let graine = 0; graine < 30; graine += 1) {
      const etat = avecJoueur(avecMineDeZone(partie('classique', graine)), 'alice', ICI);
      const [zone] = lesZones(zones(zones(etat), 3_000)) as [ZoneSpeciale];

      expect(zone.dureeRestanteMs).toBeGreaterThanOrEqual(10_000);
      expect(zone.dureeRestanteMs).toBeLessThan(30_000);
      expect(Number.isInteger(zone.dureeRestanteMs)).toBe(true);
    }
  });

  it('n a pas de plafond de zones ouvertes: chacune vient d une mine', () => {
    let etat = partie();
    for (let rang = 0; rang < 5; rang += 1) {
      etat = avecMineDeZone(
        etat,
        { x: 300 + rang * 300, y: 500 },
        'chaos',
        `mz${String(rang)}`,
        50,
      );
    }

    expect(lesZones(zones(etat))).toHaveLength(5);
  });

  it('garde les zones deja ouvertes, qui vivent leur vie', () => {
    const ouverte = zones(armee(), 3_000);
    const [zone] = lesZones(ouverte) as [ZoneSpeciale];

    expect(lesZones(zones(ouverte, zone.dureeRestanteMs - 1))).toHaveLength(1);
    expect(lesZones(zones(ouverte, zone.dureeRestanteMs))).toEqual([]);
  });
});

describe('dans le battement du moteur', () => {
  /** Rien ne bouge: les joueurs restent ou ils sont. */
  const IMMOBILES: Entrees = {};

  /** Des battements entiers du moteur. */
  function battements(etat: EtatPartie, dureeMs: number, entrees: Entrees = IMMOBILES): EtatPartie {
    let courant = etat;
    for (let ecoule = 0; ecoule < dureeMs; ecoule += 50) {
      courant = tick(courant, entrees, 50);
    }
    return courant;
  }

  it.each(['classique', 'tactique', 'equipes', 'massacre', 'chasse'] as const)(
    'arme la mine et ouvre la zone en %s, quel que soit le camp du joueur',
    (mode) => {
      let etat = partie(mode);
      const places: readonly Position[] = [ICI, { x: 1200, y: 500 }, { x: 500, y: 1100 }];
      for (const [rang, place] of places.entries()) {
        etat = avecJoueur(
          etat,
          `j${String(rang)}`,
          place,
          ['#FF0000', '#0000FF', '#00FF00'][rang] as Couleur,
        );
        etat = avecMineDeZone(etat, place, 'attraction', `mz${String(rang)}`);
      }
      etat = lancerLaPartie(etat);

      const armees = tick(etat, IMMOBILES, 50);
      expect(
        Object.values(armees.minesDeZone ?? {}).every(
          (mine) => mine.avantOuvertureMs !== undefined,
        ),
      ).toBe(true);

      const ouvertes = battements(armees, MINES_DE_ZONE.DELAI_AVANT_OUVERTURE_MS);
      expect(lesZones(ouvertes).map((zone) => zone.centre)).toEqual(places);
      expect(ouvertes.minesDeZone).toBeUndefined();
    },
  );

  it('n est pas armee par la fumee de celui qui s enfuit a cote', () => {
    let etat = avecJoueur(avecMineDeZone(partie()), 'alice', aLEst(30));
    etat = {
      ...etat,
      joueurs: { ...etat.joueurs, alice: { ...(etat.joueurs['alice'] as Joueur), poche: 'fumee' } },
    };

    const apres = tick(
      lancerLaPartie(etat),
      { alice: { deplacement: { x: 0, y: 0 }, enMouvement: false, utiliserLaPoche: true } },
      50,
    );

    expect(apres.evenements.some((fait) => fait.type === 'fumee')).toBe(true);
    expect(apres.minesDeZone?.['mz1']?.avantOuvertureMs).toBeUndefined();
  });

  it('n est pas armee par l explosion d une mine posee', () => {
    let etat = avecJoueur(avecMineDeZone(partie(), aLEst(60)), 'alice', { x: 1500, y: 1200 });
    const posee: MineSurLaCarte = {
      id: 'm1',
      poseur: 'alice',
      position: ICI,
      avantExplosionMs: 50,
    };
    etat = { ...etat, minesPosees: { m1: posee } };

    const apres = tick(lancerLaPartie(etat), IMMOBILES, 50);

    expect(apres.evenements.some((fait) => fait.type === 'mineExplosee')).toBe(true);
    expect(apres.minesDeZone?.['mz1']?.avantOuvertureMs).toBeUndefined();
  });
});
