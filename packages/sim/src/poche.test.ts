/**
 * Tests de la poche et de la fumee (etape 7.10): le ramassage, la poche pleine, le vidage a
 * chaque sorte de prise, et la fuite dans un nuage de fumee.
 *
 * Aucune version du jeu d'origine n'avait de poche: les attentes sont les decisions du
 * porteur du projet du 28 septembre 2026 (docs/plan/etape-7-10.md).
 */

import type { Couleur, ObjetDePoche, Position, ReglagesPartiels } from '@neon-ninja/shared';
import { CARTES, FUMEE, OBJETS_TACTIQUES, creerAlea } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { capturerJoueur } from './capture.js';
import { devenirTraqueur, infecter } from './chasse.js';
import { creerCarteCollisions } from './collisions.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial, positionDApparition } from './etat.js';
import { lancerLeMassacre, tuerUnJoueur } from './massacre.js';
import type { Entrees } from './moteur.js';
import { tick } from './moteur.js';
import { faireApparaitreLesObjets, poserObjet, ramasser } from './objets.js';
import {
  aLaPocheVide,
  destinationDeLaFumee,
  estUnObjetDePoche,
  sansPoche,
  utiliserLesPoches,
} from './poche.js';

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
  evade: false,
  objetsDePoche: { fumee: { tauxApparitionPourCent: 0 } },
};

const ROUGE: Couleur = '#FF0000';
const BLEU: Couleur = '#0000FF';

/** Une partie vide, pas encore lancee. */
function partie(
  mode: EtatPartie['mode'] = 'classique',
  reglages: ReglagesPartiels = {},
): EtatPartie {
  return creerEtatInitial({ graine: 11, mode, reglages: { ...AUCUNE_APPARITION, ...reglages } });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Fait entrer un joueur a une place donnee, sorti de sa protection, pret a capturer. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  position: Position,
  couleur: Couleur = id === 'alice' ? ROUGE : BLEU,
): EtatPartie {
  const entre = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
  return regler(entre, id, { protectionSpawnRestanteMs: 0, tempsDepuisDerniereCaptureMs: 5000 });
}

/** Change des champs d'un joueur. */
function regler(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<Joueur>): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/** Met un objet dans la poche d'un joueur. */
function avecEnPoche(
  etat: EtatPartie,
  id: IdentifiantEntite,
  objet: ObjetDePoche = 'fumee',
): EtatPartie {
  return regler(etat, id, { poche: objet });
}

/** Le joueur se sert de sa poche, et ne bouge pas. */
function seServir(...ids: readonly IdentifiantEntite[]): Entrees {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { deplacement: { x: 0, y: 0 }, enMouvement: false, utiliserLaPoche: true as const },
    ]),
  );
}

/** Distance entre deux positions. */
function distance(une: Position, autre: Position): number {
  return Math.hypot(une.x - autre.x, une.y - autre.y);
}

/** Le tiers de la plus grande dimension de la carte: la distance que la fumee vise. */
function tiersDeCarte(etat: EtatPartie): number {
  return FUMEE.PART_DE_CARTE_AU_DEPART * Math.max(etat.terrain.largeur, etat.terrain.hauteur);
}

describe('estUnObjetDePoche', () => {
  it('reconnait la fumee, et aucun autre objet', () => {
    expect(estUnObjetDePoche('fumee')).toBe(true);
    expect(estUnObjetDePoche('vitesse')).toBe(false);
    expect(estUnObjetDePoche('rafale')).toBe(false);
    expect(estUnObjetDePoche('flou')).toBe(false);
  });
});

describe('le ramassage', () => {
  it("remplit la poche, retire l'objet et le dit au journal, sans rien lancer", () => {
    const base = avecJoueur(partie(), 'alice', { x: 500, y: 500 });
    const pose = poserObjet(base, {
      categorie: 'bonus',
      nature: 'fumee',
      position: { x: 500, y: 500 },
    });
    const idObjet = Object.keys(pose.objets)[0] as string;

    const apres = ramasser(pose, 'alice', idObjet);
    const alice = joueurDe(apres, 'alice');

    expect(alice.poche).toBe('fumee');
    expect(apres.objets[idObjet]).toBeUndefined();
    expect(apres.evenements).toContainEqual({
      type: 'objetEmpoche',
      joueur: 'alice',
      nature: 'fumee',
      position: { x: 500, y: 500 },
    });
    // Aucun effet de duree: la fumee n'est pas un bonus qui agit au ramassage.
    expect(alice.bonusRestantsMs).toEqual(joueurDe(pose, 'alice').bonusRestantsMs);
    expect(apres.evenements.some((fait) => fait.type === 'bonusRamasse')).toBe(false);
  });

  it("laisse l'objet sur la carte quand la poche est deja pleine", () => {
    const base = avecEnPoche(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 'alice');
    const pose = poserObjet(base, {
      categorie: 'bonus',
      nature: 'fumee',
      position: { x: 500, y: 500 },
    });
    const idObjet = Object.keys(pose.objets)[0] as string;

    expect(ramasser(pose, 'alice', idObjet)).toBe(pose);
  });

  it('se joue dans un battement: un joueur sur la fumee la met en poche', () => {
    const base = avecJoueur(partie(), 'alice', { x: 500, y: 500 });
    const pose = poserObjet(base, {
      categorie: 'bonus',
      nature: 'fumee',
      position: { x: 505, y: 500 },
    });

    const apres = tick(pose, {}, 50);

    expect(joueurDe(apres, 'alice').poche).toBe('fumee');
    expect(Object.keys(apres.objets)).toHaveLength(0);
  });

  it("ne donne qu'une fumee a un joueur qui en couvre deux", () => {
    let pose = avecJoueur(partie(), 'alice', { x: 500, y: 500 });
    pose = poserObjet(pose, { categorie: 'bonus', nature: 'fumee', position: { x: 502, y: 500 } });
    pose = poserObjet(pose, { categorie: 'bonus', nature: 'fumee', position: { x: 498, y: 500 } });

    const apres = tick(pose, {}, 50);

    expect(joueurDe(apres, 'alice').poche).toBe('fumee');
    expect(Object.keys(apres.objets)).toHaveLength(1);
  });
});

describe("l'apparition de la fumee", () => {
  /** Les bonus d'origine coupes, la fumee a ce reglage, une tentative toutes les 2 s. */
  function seuleLaFumee(fumee: { actif?: boolean; tauxApparitionPourCent?: number }) {
    return {
      bonus: { ...AUCUNE_APPARITION.bonus, intervalleApparitionS: 2 },
      objetsDePoche: { fumee },
    } satisfies ReglagesPartiels;
  }

  /** Combien de fumees une partie de ce mode pose en dix secondes, sur deux cents graines. */
  function fumeesPosees(mode: EtatPartie['mode']): number {
    let poses = 0;
    for (let graine = 0; graine < 200; graine += 1) {
      const etat = creerEtatInitial({
        graine,
        mode,
        reglages: {
          ...AUCUNE_APPARITION,
          ...seuleLaFumee({ tauxApparitionPourCent: 50 }),
          objetsTactiques: {
            bonus: {
              rafale: { actif: false },
              rechargeRapide: { actif: false },
              viseeLarge: { actif: false },
            },
          },
        },
      });
      const apres = faireApparaitreLesObjets(etat, 10_000);
      poses += Object.values(apres.objets).filter((objet) => objet.nature === 'fumee').length;
    }
    return poses;
  }

  it('tente sa chance avec les bonus, a son taux', () => {
    const certaine = partie('classique', seuleLaFumee({ tauxApparitionPourCent: 100 }));

    const apres = faireApparaitreLesObjets(certaine, 3000);
    const natures = Object.values(apres.objets).map((objet) => objet.nature);

    expect(natures.length).toBeGreaterThan(0);
    expect(new Set(natures)).toEqual(new Set(['fumee']));
  });

  it('ne tire rien quand elle est desactivee', () => {
    const coupee = partie('classique', seuleLaFumee({ actif: false, tauxApparitionPourCent: 100 }));
    const aZero = partie('classique', seuleLaFumee({ actif: false, tauxApparitionPourCent: 0 }));

    const apres = faireApparaitreLesObjets(coupee, 3000);

    expect(Object.keys(apres.objets)).toHaveLength(0);
    // Le taux d'une fumee coupee n'a aucune influence: elle ne consomme aucun tirage.
    expect(apres.alea).toEqual(faireApparaitreLesObjets(aZero, 3000).alea);
  });

  it('apparait aussi en Tactique, a la moitie de son taux comme les autres bonus', () => {
    expect(OBJETS_TACTIQUES.PART_DU_TAUX_DES_BONUS).toBe(0.5);

    const enHorde = fumeesPosees('classique');
    const enTactique = fumeesPosees('tactique');

    expect(enTactique).toBeGreaterThan(0);
    expect(enTactique / enHorde).toBeGreaterThan(0.35);
    expect(enTactique / enHorde).toBeLessThan(0.65);
  });
});

describe('le vidage de la poche', () => {
  it('sansPoche retire le champ, et rend le meme joueur quand la poche est vide', () => {
    const etat = avecEnPoche(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 'alice');
    const vide = sansPoche(joueurDe(etat, 'alice'));

    expect('poche' in vide).toBe(false);
    expect(aLaPocheVide(vide)).toBe(true);
    expect(sansPoche(vide)).toBe(vide);
  });

  it('se fait a la capture par un joueur', () => {
    let etat = avecJoueur(partie(), 'alice', { x: 500, y: 500 });
    etat = avecEnPoche(avecJoueur(etat, 'bob', { x: 510, y: 500 }), 'bob');

    const apres = capturerJoueur(etat, 'alice', 'bob');

    expect(joueurDe(apres, 'bob').poche).toBeUndefined();
  });

  it('se fait a la prise par un Black Ninja', () => {
    let etat = avecEnPoche(
      avecJoueur(partie('classique', { botsNoirs: { actifs: true } }), 'alice', {
        x: 500,
        y: 500,
      }),
      'alice',
    );
    etat = ajouterBot(etat, { id: 'noir-1', type: 'botNoir', position: { x: 510, y: 500 } });

    let apres = etat;
    for (let battement = 0; battement < 20; battement += 1) {
      apres = tick(apres, {}, 50);
    }

    expect(joueurDe(apres, 'alice').capturesParBotNoirSubies).toBeGreaterThan(0);
    expect(joueurDe(apres, 'alice').poche).toBeUndefined();
  });

  it('se fait a la mort en Massacre', () => {
    let etat = avecJoueur(partie('massacre'), 'alice', { x: 500, y: 500 });
    etat = avecEnPoche(avecJoueur(etat, 'bob', { x: 530, y: 500 }), 'bob');
    etat = lancerLeMassacre(etat);

    const apres = tuerUnJoueur(etat, 'alice', 'bob', 'est');

    expect(apres).not.toBe(etat);
    expect(joueurDe(apres, 'bob').poche).toBeUndefined();
  });

  it("se fait a l'infection en Chasse", () => {
    let etat = avecJoueur(partie('chasse'), 'traqueur', { x: 500, y: 500 });
    etat = avecEnPoche(avecJoueur(etat, 'proie', { x: 520, y: 500 }), 'proie');
    etat = {
      ...etat,
      chasse: {
        traqueurs: {},
        parcours: {
          traqueur: { distancePx: 0, derniere: { x: 500, y: 500 } },
          proie: { distancePx: 0, derniere: { x: 520, y: 500 } },
        },
        traqueursEpuises: false,
      },
    };
    etat = devenirTraqueur(etat, 'traqueur');
    etat = { ...etat, tempsEcouleMs: etat.tempsEcouleMs + 60_000 };

    const apres = infecter(etat, 'traqueur', 'proie');

    expect(apres).not.toBe(etat);
    expect(joueurDe(apres, 'proie').poche).toBeUndefined();
  });

  it('ne se fait pas quand un traqueur devient traqueur sans avoir ete pris', () => {
    let etat = avecEnPoche(avecJoueur(partie('chasse'), 'alice', { x: 500, y: 500 }), 'alice');
    etat = { ...etat, chasse: { traqueurs: {}, parcours: {}, traqueursEpuises: false } };

    expect(joueurDe(devenirTraqueur(etat, 'alice'), 'alice').poche).toBe('fumee');
  });
});

describe('la fumee', () => {
  it('fait reparaitre le joueur loin de son depart, la poche videe, et le dit a tous', () => {
    let etat = avecEnPoche(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');
    etat = avecJoueur(etat, 'bob', { x: 900, y: 600 });

    const apres = tick(etat, seServir('alice'), 50);
    const alice = joueurDe(apres, 'alice');

    expect(alice.poche).toBeUndefined();
    expect(distance(alice.position, { x: 300, y: 300 })).toBeGreaterThanOrEqual(tiersDeCarte(etat));
    expect(apres.evenements).toContainEqual({
      type: 'fumee',
      joueur: 'alice',
      depart: { x: 300, y: 300 },
      arrivee: alice.position,
    });
  });

  it("l'eloigne des autres joueurs, des Black Ninjas et de l'Evade", () => {
    const base = avecEnPoche(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');
    let etat = avecJoueur(base, 'bob', { x: 1200, y: 700 });
    etat = ajouterBot(etat, { id: 'noir-1', type: 'botNoir', position: { x: 1500, y: 400 } });

    for (let graine = 0; graine < 30; graine += 1) {
      const tirage = destinationDeLaFumee(
        { ...etat, alea: creerAlea(graine) },
        joueurDe(etat, 'alice'),
      );
      expect(distance(tirage.valeur, { x: 1200, y: 700 })).toBeGreaterThanOrEqual(100);
      expect(distance(tirage.valeur, { x: 1500, y: 400 })).toBeGreaterThanOrEqual(100);
    }
  });

  it('est deterministe: meme etat, meme arrivee', () => {
    const etat = avecEnPoche(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');

    expect(tick(etat, seServir('alice'), 50)).toEqual(tick(etat, seServir('alice'), 50));
  });

  it('relache la distance au depart quand la carte ne laisse de place que pres de lui', () => {
    const carte = CARTES.map1;
    // Seul un coin de 300 pixels sur 300 est praticable: rien a un tiers de carte du depart.
    const terrain = creerCarteCollisions(carte, (x, y) => x > 300 || y > 300);
    const etat = avecEnPoche(
      avecJoueur(creerEtatInitial({ graine: 5, reglages: AUCUNE_APPARITION, terrain }), 'alice', {
        x: 150,
        y: 150,
      }),
      'alice',
    );

    const apres = tick(etat, seServir('alice'), 50);
    const arrivee = joueurDe(apres, 'alice').position;

    expect(joueurDe(apres, 'alice').poche).toBeUndefined();
    expect(arrivee.x).toBeLessThanOrEqual(300);
    expect(arrivee.y).toBeLessThanOrEqual(300);
  });

  it("l'emporte sur un contact du meme battement: le joueur s'echappe", () => {
    let etat = avecEnPoche(avecJoueur(partie(), 'bob', { x: 500, y: 500 }), 'bob');
    etat = avecJoueur(etat, 'alice', { x: 510, y: 500 });

    const sansFumee = tick(etat, {}, 50);
    expect(joueurDe(sansFumee, 'alice').captures).toBe(1);

    const avecFumee = tick(etat, seServir('bob'), 50);
    expect(joueurDe(avecFumee, 'alice').captures).toBe(0);
    expect(avecFumee.evenements.some((fait) => fait.type === 'fumee')).toBe(true);
  });

  it("ne change rien d'autre au joueur: ni ses effets, ni sa protection, ni sa couleur", () => {
    const etat = regler(
      avecEnPoche(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice'),
      'alice',
      { tempsDepuisDerniereCaptureMs: 200 },
    );
    const avant = joueurDe(tick(etat, {}, 50), 'alice');
    const apres = joueurDe(tick(etat, seServir('alice'), 50), 'alice');

    expect(apres.couleur).toBe(avant.couleur);
    expect(apres.bonusRestantsMs).toEqual(avant.bonusRestantsMs);
    expect(apres.protectionSpawnRestanteMs).toBe(0);
    expect(apres.tempsDepuisDerniereCaptureMs).toBe(avant.tempsDepuisDerniereCaptureMs);
    expect(apres.direction).toBe(avant.direction);
  });

  it('ne fait rien sur une poche vide, et ne tire rien', () => {
    const etat = avecJoueur(partie(), 'alice', { x: 300, y: 300 });

    const apres = utiliserLesPoches(etat, seServir('alice'), new Set());

    expect(apres).toBe(etat);
  });

  it("n'est pas servie a un joueur hors jeu", () => {
    const etat = avecEnPoche(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');

    expect(utiliserLesPoches(etat, seServir('alice'), new Set(['alice']))).toBe(etat);
  });

  it("sert a chacun dans l'ordre d'arrivee, le second s'ecartant de l'arrivee du premier", () => {
    let etat = avecEnPoche(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');
    etat = avecEnPoche(avecJoueur(etat, 'bob', { x: 1500, y: 900 }), 'bob');

    const apres = utiliserLesPoches(etat, seServir('alice', 'bob'), new Set());
    const fuites = apres.evenements.filter((fait) => fait.type === 'fumee');

    expect(fuites.map((fait) => fait.joueur)).toEqual(['alice', 'bob']);
    expect(
      distance(joueurDe(apres, 'alice').position, joueurDe(apres, 'bob').position),
    ).toBeGreaterThanOrEqual(100);
  });

  it("tire l'arrivee comme une apparition: le premier tirage qui tient les deux distances", () => {
    const etat = avecEnPoche(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');
    const premier = positionDApparition(etat.alea, etat.terrain, []);

    const tirage = destinationDeLaFumee(etat, joueurDe(etat, 'alice'));

    if (distance(premier.valeur, { x: 300, y: 300 }) >= tiersDeCarte(etat)) {
      expect(tirage).toEqual(premier);
    } else {
      expect(tirage).not.toEqual(premier);
    }
  });
});
