/**
 * Tests du mode Massacre (etape 7.4): l'arc du katana, le coup, les combos, le joueur tue,
 * les Black Ninjas, la carte videe, les points, et le jeu de regles dans le moteur.
 *
 * Aucune version du jeu d'origine n'a ce mode, donc aucune caracterisation: les attentes
 * sont les decisions du porteur du projet du 16 septembre 2026 (docs/plan/etape-7-4.md).
 */

import type { Position, ReglagesPartiels } from '@neon-ninja/shared';
import { COMBO, DUREES, MASSACRE, TACTIQUE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { detecterContacts, regleMassacre, resoudreContacts } from './contacts.js';
import type {
  CoupDeKatana,
  EtatPartie,
  EvenementPartie,
  GuerrierEnMassacre,
  IdentifiantEntite,
  Joueur,
} from './etat.js';
import { AUCUN_BONUS } from './effets.js';
import { preparerLEvade } from './evade.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import {
  CONE_DU_KATANA,
  GUERRIER_DE_DEPART,
  agirEnMassacre,
  frapper,
  guerrierDe,
  lancerLeMassacre,
  massacreDecide,
  multiplicateurDuCombo,
  perteEnMassacre,
  pointsEnMassacre,
  tuerUnJoueur,
} from './massacre.js';
import type { Entrees } from './moteur.js';
import { REGLES_DES_MODES, evaluerFinDePartie, lancerLaPartie, tick } from './moteur.js';
import { malusClassique, poserObjet, ramasserLesObjets } from './objets.js';
import { calculerScores } from './score.js';
import { CONE_TACTIQUE, dansLeCone, geometrieDuCone } from './tactique.js';

/** Reglages ou rien n'apparait tout seul: les tests posent ce dont ils ont besoin. */
const AUCUNE_APPARITION: ReglagesPartiels = {
  bonus: {
    types: {
      vitesse: { tauxApparitionPourCent: 0 },
      invincibilite: { tauxApparitionPourCent: 0 },
      revelation: { tauxApparitionPourCent: 0 },
    },
  },
  malus: { tauxApparitionPourCent: 0 },
  zones: { actives: false },
  botsNoirs: { actifs: false },
};

/** Ou se tient le joueur des tests, tourne vers l'est. */
const ICI: Position = { x: 500, y: 500 };

/** Une partie Massacre vide, pas encore lancee. */
function partie(reglages: ReglagesPartiels = AUCUNE_APPARITION): EtatPartie {
  return creerEtatInitial({ graine: 23, mode: 'massacre', reglages });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Change quelques champs d'un joueur, pour poser une situation de depart. */
function regler(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<Joueur>): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/** Change ce que retient un joueur du Massacre. */
function equiper(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<GuerrierEnMassacre>,
): EtatPartie {
  const massacre = etat.massacre ?? { guerriers: {}, carteVidee: false };

  return {
    ...etat,
    massacre: {
      ...massacre,
      guerriers: { ...massacre.guerriers, [id]: { ...guerrierDe(etat, id), ...champs } },
    },
  };
}

/** Fait entrer un joueur a une place donnee, sorti de sa protection d'apparition. */
function avecJoueur(etat: EtatPartie, id: IdentifiantEntite, position: Position): EtatPartie {
  return regler(ajouterJoueur(etat, { id, pseudo: id, position }), id, {
    protectionSpawnRestanteMs: 0,
  });
}

/** Pose des bots ordinaires aux places donnees, nommes b0, b1... */
function avecBots(etat: EtatPartie, positions: readonly Position[]): EtatPartie {
  return positions.reduce(
    (courant, position, rang) => ajouterBot(courant, { id: `b${String(rang)}`, position }),
    etat,
  );
}

/** Un Massacre lance, avec Alice au milieu, tournee vers l'est, et des bots donnes. */
function massacreAvec(bots: readonly Position[] = []): EtatPartie {
  return lancerLeMassacre(avecBots(avecJoueur(partie(), 'alice', ICI), bots));
}

/** Un point a une distance et un angle donnes d'ICI, en degres, zero vers l'est. */
function aDistance(distance: number, degres: number): Position {
  const radians = (degres * Math.PI) / 180;
  return { x: ICI.x + distance * Math.cos(radians), y: ICI.y + distance * Math.sin(radians) };
}

/** Les evenements d'un type donne. */
function faits<T extends EvenementPartie['type']>(
  etat: EtatPartie,
  type: T,
): Extract<EvenementPartie, { type: T }>[] {
  return etat.evenements.filter(
    (evenement): evenement is Extract<EvenementPartie, { type: T }> => evenement.type === type,
  );
}

/** Le seul coup de katana du journal. */
function leCoup(etat: EtatPartie): CoupDeKatana {
  const coups = faits(etat, 'coupDeKatana');
  expect(coups).toHaveLength(1);
  return coups[0] as CoupDeKatana;
}

/** Une demande de coup, sans deplacement. */
const FRAPPE = { deplacement: { x: 0, y: 0 }, enMouvement: false, capturer: true } as const;

describe('l arc du katana', () => {
  it('s ouvre sur 160 degres et porte a 60 pixels', () => {
    expect(CONE_DU_KATANA).toEqual(geometrieDuCone(160, 60));
    expect(CONE_DU_KATANA.porteePx).toBe(MASSACRE.PORTEE_DU_KATANA_PX);
  });

  it('prend ce qui est devant, jusqu a 80 degres de chaque cote, bornes comprises', () => {
    expect(dansLeCone(ICI, 'est', aDistance(40, 0), CONE_DU_KATANA)).toBe(true);
    expect(dansLeCone(ICI, 'est', aDistance(60, 0), CONE_DU_KATANA)).toBe(true);
    expect(dansLeCone(ICI, 'est', aDistance(50, 80), CONE_DU_KATANA)).toBe(true);
    expect(dansLeCone(ICI, 'est', aDistance(50, -80), CONE_DU_KATANA)).toBe(true);
  });

  it('laisse ce qui est trop loin, trop sur le cote ou derriere', () => {
    expect(dansLeCone(ICI, 'est', aDistance(60.5, 0), CONE_DU_KATANA)).toBe(false);
    expect(dansLeCone(ICI, 'est', aDistance(50, 81), CONE_DU_KATANA)).toBe(false);
    expect(dansLeCone(ICI, 'est', aDistance(30, 180), CONE_DU_KATANA)).toBe(false);
  });

  it('laisse au Tactique son cone de 90 degres sur 100 pixels, par defaut', () => {
    expect(CONE_TACTIQUE).toEqual(
      geometrieDuCone(TACTIQUE.ANGLE_DU_CONE_DEGRES, TACTIQUE.PORTEE_PX),
    );
    expect(dansLeCone(ICI, 'est', aDistance(99, 45))).toBe(true);
    expect(dansLeCone(ICI, 'est', aDistance(50, 60))).toBe(false);
    expect(dansLeCone(ICI, 'est', aDistance(50, 60), CONE_DU_KATANA)).toBe(true);
  });
});

describe('le multiplicateur du combo', () => {
  it('monte d un cran toutes les cinq morts, jusqu a cinq', () => {
    expect([0, 1, 4, 5, 9, 10, 14, 15, 19, 20, 21, 100].map(multiplicateurDuCombo)).toEqual([
      1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5,
    ]);
  });
});

describe('le lancement', () => {
  it('donne a chaque joueur l etat de depart, sans aucun tirage', () => {
    const avant = avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', { x: 900, y: 900 });
    const lance = lancerLeMassacre(avant);

    expect(lance.massacre).toEqual({
      guerriers: { alice: GUERRIER_DE_DEPART, bob: GUERRIER_DE_DEPART },
      carteVidee: false,
    });
    expect(lance.alea).toBe(avant.alea);
    // Le lancement d'une partie ajoute le tirage du moment ou l'Evade apparaitra (etape
    // 7.9): le Massacre, lui, n'en fait aucun.
    expect(lancerLaPartie(avant)).toEqual(preparerLEvade(lance));
  });

  it('donne l etat de depart a un joueur qui n a pas encore d entree', () => {
    expect(guerrierDe(partie(), 'inconnu')).toBe(GUERRIER_DE_DEPART);
    expect(GUERRIER_DE_DEPART).toMatchObject({ orientation: 'est', points: 0, combo: 0 });
  });

  it('retire la zone de chaos des reglages', () => {
    expect(partie({}).reglages.zones.types.chaos).toBe(false);
  });
});

describe('un coup de katana', () => {
  it('tue tout ce que l arc contient, et rien d autre', () => {
    const etat = massacreAvec([
      aDistance(30, 0),
      aDistance(50, 70),
      aDistance(80, 0),
      aDistance(40, 180),
    ]);
    const apres = frapper(etat, 'alice').etat;

    expect(Object.keys(apres.bots)).toEqual(['b2', 'b3']);
    expect(leCoup(apres).morts.map((mort) => mort.bot)).toEqual(['b0', 'b1']);
    expect(guerrierDe(apres, 'alice').botsTues).toBe(2);
  });

  it('garde la couleur du bot tue, pour son cadavre (etape 5.5)', () => {
    const etat = ajouterBot(massacreAvec(), {
      id: 'vert',
      position: aDistance(30, 0),
      couleur: '#00FF00',
    });

    expect(leCoup(frapper(etat, 'alice').etat).morts[0]?.couleur).toBe('#00FF00');
  });

  it('fait valoir dix points par bot, et monte le multiplicateur a la cinquieme mort', () => {
    const etat = massacreAvec([0, 10, 20, 30, 40, 50].map((degres) => aDistance(40, degres)));
    const apres = frapper(etat, 'alice').etat;
    const coup = leCoup(apres);

    expect(coup.morts.map((mort) => mort.points)).toEqual([10, 10, 10, 10, 20, 20]);
    expect(coup.combo).toBe(6);
    expect(coup.multiplicateur).toBe(2);
    expect(coup.orientation).toBe('est');
    expect(coup.position).toEqual(ICI);
    expect(pointsEnMassacre(apres, joueurDe(apres, 'alice'))).toBe(80);
    expect(guerrierDe(apres, 'alice').avantFinDuComboMs).toBe(COMBO.FENETRE_MS);
  });

  it('plafonne le multiplicateur a cinq', () => {
    const etat = equiper(massacreAvec([aDistance(40, 0)]), 'alice', {
      combo: 40,
      avantFinDuComboMs: 1000,
      points: 7,
    });
    const apres = frapper(etat, 'alice').etat;

    expect(guerrierDe(apres, 'alice').points).toBe(7 + 50);
    expect(leCoup(apres).multiplicateur).toBe(5);
  });

  it('a lieu dans le vide: il relance l attente, sans toucher au combo', () => {
    const etat = equiper(massacreAvec(), 'alice', { combo: 3, avantFinDuComboMs: 500 });
    const apres = frapper(etat, 'alice').etat;

    expect(leCoup(apres)).toMatchObject({ morts: [], combo: 3, multiplicateur: 1 });
    expect(guerrierDe(apres, 'alice')).toMatchObject({
      avantProchainCoupMs: MASSACRE.DELAI_ENTRE_COUPS_MS,
      combo: 3,
      avantFinDuComboMs: 500,
    });
  });

  it('ne part pas tant que l attente n est pas ecoulee', () => {
    const etat = equiper(massacreAvec([aDistance(40, 0)]), 'alice', { avantProchainCoupMs: 1 });
    const coup = frapper(etat, 'alice');

    expect(coup.etat).toBe(etat);
    expect(coup.victime).toBeUndefined();
  });

  it('ne part pas pour un joueur absent', () => {
    const etat = massacreAvec();

    expect(frapper(etat, 'personne').etat).toBe(etat);
  });

  it('tue un Black Ninja pour quinze points fois le multiplicateur, compte comme detruit', () => {
    const avecNoir = ajouterBot(massacreAvec(), {
      id: 'noir',
      type: 'botNoir',
      position: aDistance(30, 0),
    });
    const etat = equiper(avecNoir, 'alice', { combo: 4, avantFinDuComboMs: 100 });
    const apres = frapper(etat, 'alice').etat;

    expect(apres.bots['noir']).toBeUndefined();
    expect(leCoup(apres).morts).toEqual([
      { bot: 'noir', noir: true, position: aDistance(30, 0), points: 30, couleur: '#000000' },
    ]);
    expect(joueurDe(apres, 'alice').botsNoirsDetruits).toBe(1);
  });

  it('suit la direction du dernier deplacement, et la garde a l arret', () => {
    const etat = massacreAvec([aDistance(40, 180)]);
    const vers = (x: number): Entrees => ({
      alice: { deplacement: { x, y: 0 }, enMouvement: true },
    });
    const tourne = agirEnMassacre(regler(etat, 'alice', { direction: 'ouest' }), vers(-1), 50);

    expect(guerrierDe(tourne, 'alice').orientation).toBe('ouest');

    const arrete = regler(tourne, 'alice', { direction: 'immobile' });
    const frappe = agirEnMassacre(arrete, { alice: FRAPPE }, 50);

    expect(guerrierDe(frappe, 'alice').orientation).toBe('ouest');
    expect(frappe.bots['b0']).toBeUndefined();
  });

  it('attend quatre cents millisecondes entre deux coups', () => {
    let etat = agirEnMassacre(massacreAvec(), { alice: FRAPPE }, 50);
    let coups = 1;

    for (let battement = 1; battement <= 8; battement += 1) {
      etat = agirEnMassacre({ ...etat, evenements: [] }, { alice: FRAPPE }, 50);
      coups += faits(etat, 'coupDeKatana').length;
    }

    // Le premier coup, puis le suivant au huitieme battement: 400 ms plus tard.
    expect(coups).toBe(2);
  });
});

describe('le combo', () => {
  /** Alice tue le bot pose devant elle, dt millisecondes apres le battement precedent. */
  function tuerApres(etat: EtatPartie, dtMs: number): EtatPartie {
    const avecBot = ajouterBot(
      { ...etat, evenements: [] },
      { id: `bot-${String(etat.tick)}-${String(dtMs)}`, position: aDistance(30, 0) },
    );
    return agirEnMassacre({ ...avecBot, tick: avecBot.tick + 1 }, { alice: FRAPPE }, dtMs);
  }

  it('se prolonge par une mort qui suit la precedente de deux secondes au plus', () => {
    const premiere = tuerApres(massacreAvec([{ x: 1500, y: 1500 }]), 50);
    expect(guerrierDe(premiere, 'alice').combo).toBe(1);

    const seconde = tuerApres(premiere, COMBO.FENETRE_MS);
    expect(guerrierDe(seconde, 'alice').combo).toBe(2);
  });

  it('retombe au-dela de deux secondes sans mort', () => {
    const premiere = tuerApres(massacreAvec([{ x: 1500, y: 1500 }]), 50);
    const tardive = tuerApres(premiere, COMBO.FENETRE_MS + 1);

    expect(guerrierDe(tardive, 'alice').combo).toBe(1);

    const oublie = agirEnMassacre(premiere, {}, COMBO.FENETRE_MS + 1);
    expect(guerrierDe(oublie, 'alice')).toMatchObject({ combo: 0, avantFinDuComboMs: 0 });
  });
});

describe('un joueur tue', () => {
  /** Alice et Bob face a face, Bob a trente pixels a l'est, chacun avec des points. */
  function duel(pointsDeBob = 101): EtatPartie {
    const etat = lancerLeMassacre(
      avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', aDistance(30, 0)),
    );
    return equiper(
      equiper(etat, 'bob', { points: pointsDeBob, combo: 7, avantFinDuComboMs: 900 }),
      'alice',
      {
        points: 20,
        combo: 2,
        avantFinDuComboMs: 300,
      },
    );
  }

  it('cede a son tueur la moitie de ses points, arrondie en dessous, et perd son combo', () => {
    const apres = tuerUnJoueur(duel(), 'alice', 'bob', 'est');

    expect(guerrierDe(apres, 'bob')).toMatchObject({ points: 51, combo: 0, avantFinDuComboMs: 0 });
    expect(guerrierDe(apres, 'alice')).toMatchObject({
      points: 70,
      combo: 2,
      avantFinDuComboMs: 300,
    });
    expect(faits(apres, 'joueurTranche')).toEqual([
      {
        type: 'joueurTranche',
        attaquant: 'alice',
        victime: 'bob',
        position: aDistance(30, 0),
        orientation: 'est',
        pointsVoles: 50,
      },
    ]);
  });

  it('reapparait ailleurs, protege, avec sa couleur, et les compteurs de capture avancent', () => {
    const avant = duel();
    const apres = tuerUnJoueur(avant, 'alice', 'bob', 'est');
    const bob = joueurDe(apres, 'bob');
    const alice = joueurDe(apres, 'alice');

    expect(bob.position).not.toEqual(aDistance(30, 0));
    expect(bob.couleur).toBe(joueurDe(avant, 'bob').couleur);
    expect(bob.protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
    expect(bob.capturesSubies).toEqual({ alice: { pseudo: 'alice', nombre: 1 } });
    expect(alice.captures).toBe(1);
    expect(alice.joueursCaptures).toEqual({ bob: { pseudo: 'bob', nombre: 1 } });
    expect(alice.tempsDepuisDerniereCaptureMs).toBe(0);
  });

  it('est epargne s il est protege ou invincible, et le tueur attend une seconde', () => {
    const protege = regler(duel(), 'bob', { protectionSpawnRestanteMs: 1 });
    const invincible = regler(duel(), 'bob', {
      bonusRestantsMs: { ...AUCUN_BONUS, invincibilite: 1000 },
    });
    const pressee = regler(duel(), 'alice', {
      tempsDepuisDerniereCaptureMs: DUREES.DELAI_ENTRE_CAPTURES_MS,
    });

    expect(tuerUnJoueur(protege, 'alice', 'bob', 'est')).toBe(protege);
    expect(tuerUnJoueur(invincible, 'alice', 'bob', 'est')).toBe(invincible);
    expect(tuerUnJoueur(pressee, 'alice', 'bob', 'est')).toBe(pressee);
    const seul = duel();
    expect(tuerUnJoueur(seul, 'alice', 'alice', 'est')).toBe(seul);
    expect(tuerUnJoueur(seul, 'alice', 'personne', 'est')).toBe(seul);
  });

  it('ne tombe qu a un par coup, et le coup tue quand meme les bots', () => {
    const etat = avecBots(
      avecJoueur(
        lancerLeMassacre(avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', aDistance(30, 0))),
        'carl',
        aDistance(40, 20),
      ),
      [aDistance(50, -20)],
    );
    const coup = frapper(etat, 'alice');

    expect(coup.victime).toBe('bob');
    expect(faits(coup.etat, 'joueurTranche')).toHaveLength(1);
    expect(leCoup(coup.etat).morts).toHaveLength(1);
    expect(guerrierDe(coup.etat, 'alice').combo).toBe(1);
  });

  it('perd son propre coup s il tombe dans le meme battement', () => {
    const face = regler(duel(), 'bob', { direction: 'ouest' });
    const orientee = equiper(face, 'bob', { orientation: 'ouest' });
    const apres = agirEnMassacre(orientee, { alice: FRAPPE, bob: FRAPPE }, 50);

    expect(faits(apres, 'joueurTranche')).toHaveLength(1);
    expect(faits(apres, 'coupDeKatana')).toHaveLength(1);
    expect(agirEnMassacre(orientee, { alice: FRAPPE, bob: FRAPPE }, 50)).toEqual(apres);
  });
});

describe('les Black Ninjas', () => {
  it('coutent la part reglee des points et le combo, sans aucun bot perdu', () => {
    const reglages = {
      ...AUCUNE_APPARITION,
      botsNoirs: { actifs: false, partDeBotsPerduePourCent: 50 },
    };
    const depart = lancerLeMassacre(avecJoueur(partie(reglages), 'alice', ICI));
    const garni = equiper(
      ajouterBot(depart, { id: 'noir', type: 'botNoir', position: ICI }),
      'alice',
      {
        points: 75,
        combo: 3,
        avantFinDuComboMs: 1500,
      },
    );
    const apres = tick(garni, {}, 50);

    expect(faits(apres, 'captureParBotNoir')).toMatchObject([{ victime: 'alice', botsPerdus: 0 }]);
    expect(guerrierDe(apres, 'alice')).toMatchObject({
      points: 38,
      combo: 0,
      avantFinDuComboMs: 0,
    });
  });

  it('ne perdent aucun bot au joueur attrape', () => {
    expect(perteEnMassacre(massacreAvec(), joueurDe(massacreAvec(), 'alice'))).toEqual([]);
  });

  it('ignorent une prise dont la victime a quitte la partie', () => {
    const etat = {
      ...massacreAvec(),
      evenements: [
        {
          type: 'captureParBotNoir',
          botNoir: 'noir',
          victime: 'parti',
          botsPerdus: 0,
          position: ICI,
        },
      ] as const,
    };

    expect(agirEnMassacre(etat, {}, 50).massacre?.guerriers['parti']).toBeUndefined();
  });

  it('ne comptent pas pour vider la carte', () => {
    const etat = ajouterBot(massacreAvec([aDistance(30, 0)]), {
      id: 'noir',
      type: 'botNoir',
      position: { x: 1500, y: 1000 },
    });
    const apres = agirEnMassacre(etat, { alice: FRAPPE }, 50);

    expect(apres.massacre?.carteVidee).toBe(true);
    expect(apres.bots['noir']).toBeDefined();
  });
});

describe('toucher', () => {
  it('ne produit rien: ni repeinte, ni capture, ni Black Ninja detruit par un invincible', () => {
    const invincible = regler(
      avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', { x: 510, y: 500 }),
      'alice',
      { bonusRestantsMs: { ...AUCUN_BONUS, invincibilite: 5000 } },
    );
    const etat = ajouterBot(ajouterBot(invincible, { id: 'b', position: { x: 495, y: 500 } }), {
      id: 'noir',
      type: 'botNoir',
      position: { x: 505, y: 505 },
    });
    const apres = resoudreContacts(etat, detecterContacts(etat), regleMassacre);

    expect(apres).toEqual(etat);
  });
});

describe('la carte videe', () => {
  it('termine la partie et donne cinq points par seconde restante a chaque joueur', () => {
    const lance = lancerLeMassacre(
      avecJoueur(
        avecBots(avecJoueur(partie({ ...AUCUNE_APPARITION, dureePartieS: 180 }), 'alice', ICI), [
          aDistance(30, 0),
        ]),
        'bob',
        { x: 1500, y: 1000 },
      ),
    );
    const etat = equiper({ ...lance, tempsEcouleMs: 59_500 }, 'bob', { points: 3 });
    const apres = agirEnMassacre(etat, { alice: FRAPPE }, 50);

    expect(faits(apres, 'carteVidee')).toEqual([
      { type: 'carteVidee', tempsRestantMs: 120_500, bonus: 600 },
    ]);
    expect(guerrierDe(apres, 'alice').points).toBe(610);
    expect(guerrierDe(apres, 'bob').points).toBe(603);
    expect(massacreDecide(apres)).toBe(true);
    expect(evaluerFinDePartie(apres).terminee).toBe(true);
  });

  it('ne se declare pas sur une carte deja sans bot, ni au salon', () => {
    const vide = agirEnMassacre(massacreAvec(), { alice: FRAPPE }, 50);

    expect(vide.massacre?.carteVidee).toBe(false);
    expect(massacreDecide(partie())).toBe(false);
    const salon = partie();
    expect(agirEnMassacre(salon, { alice: FRAPPE }, 50)).toBe(salon);
  });
});

describe('les joueurs qui vont et viennent', () => {
  it('donne l etat de depart a un joueur entre en cours de partie, qui peut frapper', () => {
    const etat = avecBots(avecJoueur(massacreAvec(), 'tard', { x: 1000, y: 1000 }), [
      { x: 1030, y: 1000 },
      { x: 1500, y: 1500 },
    ]);
    const apres = agirEnMassacre(etat, { tard: FRAPPE }, 50);

    expect(guerrierDe(apres, 'tard').points).toBe(10);
  });

  it('oublie un joueur parti', () => {
    const etat = retirerJoueur(avecJoueur(massacreAvec(), 'bob', { x: 900, y: 900 }), 'bob');

    expect(
      Object.keys(agirEnMassacre(lancerLeMassacre(etat), {}, 50).massacre?.guerriers ?? {}),
    ).toEqual(['alice']);
  });
});

describe('le score et le classement', () => {
  it('classe aux points que l etat range, puis aux joueurs tues', () => {
    let etat = lancerLeMassacre(
      avecJoueur(
        avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', { x: 900, y: 900 }),
        'carl',
        { x: 1200, y: 900 },
      ),
    );
    etat = equiper(equiper(equiper(etat, 'alice', { points: 40 }), 'bob', { points: 90 }), 'carl', {
      points: 40,
    });
    etat = regler(etat, 'carl', { captures: 1 });

    expect(calculerScores(etat).map((ligne) => [ligne.id, ligne.points])).toEqual([
      ['bob', 90],
      ['carl', 40],
      ['alice', 40],
    ]);
  });

  it('vaut zero au salon', () => {
    const etat = avecJoueur(partie(), 'alice', ICI);

    expect(calculerScores(etat)[0]?.points).toBe(0);
  });
});

describe('le jeu de regles du Massacre dans le moteur', () => {
  it('branche ses reponses, et personne n est hors jeu', () => {
    const regles = REGLES_DES_MODES.massacre;

    expect(regles.agir).toBe(agirEnMassacre);
    expect(regles.resoudreContacts).toBe(regleMassacre);
    expect(regles.perteFaceAuBotNoir).toBe(perteEnMassacre);
    expect(regles.victimeDuMalus).toBe(malusClassique);
    expect(regles.estDecidee).toBe(massacreDecide);
    expect(regles.horsJeu(massacreAvec()).size).toBe(0);
  });

  it('fait subir un malus a tous les autres joueurs', () => {
    const etat = poserObjet(avecJoueur(massacreAvec(), 'bob', { x: 900, y: 900 }), {
      categorie: 'malus',
      nature: 'flou',
      position: ICI,
    });
    const apres = ramasserLesObjets(etat, REGLES_DES_MODES.massacre.victimeDuMalus);

    expect(faits(apres, 'malusRamasse')[0]?.victimes).toEqual(['bob']);
  });

  it('joue une partie entiere a travers tick, a l identique pour une meme graine', () => {
    /** Une partie de trente secondes ou deux joueurs tournent en frappant. */
    function jouer(): EtatPartie {
      let etat = lancerLaPartie(
        avecBots(
          avecJoueur(
            avecJoueur(creerEtatInitial({ graine: 5, mode: 'massacre' }), 'alice', ICI),
            'bob',
            { x: 560, y: 500 },
          ),
          [0, 1, 2, 3, 4, 5, 6, 7].map((rang) => ({ x: 520 + rang * 15, y: 520 })),
        ),
      );

      for (let battement = 0; battement < 600; battement += 1) {
        const cap = { x: Math.cos(battement / 10), y: Math.sin(battement / 10) };
        etat = tick(
          etat,
          {
            alice: { deplacement: cap, enMouvement: true, capturer: true },
            bob: { deplacement: { x: -cap.x, y: cap.y }, enMouvement: true, capturer: true },
          },
          50,
        );
      }

      return etat;
    }

    const partieJouee = jouer();

    expect(partieJouee).toEqual(jouer());
    expect(
      guerrierDe(partieJouee, 'alice').botsTues + guerrierDe(partieJouee, 'bob').botsTues,
    ).toBeGreaterThan(0);
  });
});
