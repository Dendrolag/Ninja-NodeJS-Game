/**
 * Tests des zones speciales.
 *
 * Le legacy n'a pas ete caracterise sur ce domaine a l'etape 0.2: les zones
 * tiraient leur forme, leur duree et leurs effets de Math.random et de Date.now,
 * ce qui les rendait impossibles a figer. Les tests ci-dessous s'appuient donc
 * sur la lecture du code d'origine (SpecialZone, legacy/server.js:487) plutot que
 * sur un instantane, et ils verifient en priorite ce qui se deduit de ce code:
 * les seuils, les forces et la geometrie.
 */

import type { Position, ReglagesPartiels } from '@neon-ninja/shared';
import { CARTES, COULEURS_JOUEURS, RAYON_ENTITE, ZONES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerCarteCollisions } from './collisions.js';
import type { CarteCollisions } from './collisions.js';
import type { EtatPartie, TypeEntite, ZoneSpeciale } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';
import { appliquerLesEffetsDeZone, avancerLesZones, estCache, zoneContient } from './zones.js';

const ROUGE = '#FF0000';

/** Des zones assez durables pour qu'un essai ne les voie pas mourir de vieillesse. */
const ZONES_DURABLES: ReglagesPartiels = {
  zones: { dureeMinimumS: 600, dureeMaximumS: 601 },
};

/** Une zone posee a la main, pour partir d'une situation nette. */
function zone(type: ZoneSpeciale['type'], centre: Position, rayon = 300): ZoneSpeciale {
  return { id: 'zone-test', type, centre, rayon, dureeRestanteMs: 30_000 };
}

/** Une partie sans apparition automatique de zone, avec la zone demandee posee. */
function partieAvecZone(zonePosee: ZoneSpeciale, terrain?: CarteCollisions): EtatPartie {
  const depart =
    terrain === undefined
      ? creerEtatInitial({ graine: 5 })
      : creerEtatInitial({ graine: 5, terrain });

  return { ...depart, zones: { [zonePosee.id]: zonePosee } };
}

/** Ajoute un bot ou un bot noir a la partie. */
function avecBot(
  etat: EtatPartie,
  id: string,
  position: Position,
  type: Extract<TypeEntite, 'bot' | 'botNoir'> = 'bot',
): EtatPartie {
  return ajouterBot(etat, { id, type, position });
}

/** Ajoute un joueur a la partie. */
function avecJoueur(etat: EtatPartie, id: string, position: Position): EtatPartie {
  return ajouterJoueur(etat, { id, pseudo: id, position, couleur: ROUGE });
}

/** La position d'un bot dont on sait qu'il est present. */
function positionDe(etat: EtatPartie, id: string): Position {
  const bot = etat.bots[id];
  if (bot === undefined) {
    throw new Error(`Le bot ${id} devrait etre dans la partie.`);
  }
  return bot.position;
}

describe('geometrie d une zone', () => {
  it('contient ce qui est a l interieur, et son bord', () => {
    const disque = zone('chaos', { x: 500, y: 500 }, 100);

    expect(zoneContient(disque, { x: 500, y: 500 })).toBe(true);
    expect(zoneContient(disque, { x: 600, y: 500 })).toBe(true);
    expect(zoneContient(disque, { x: 600.001, y: 500 })).toBe(false);
  });

  it('dit si une position est cachee par une zone d invisibilite', () => {
    const etat = partieAvecZone(zone('invisibilite', { x: 500, y: 500 }, 100));

    expect(estCache(etat, { x: 550, y: 500 })).toBe(true);
    expect(estCache(etat, { x: 800, y: 500 })).toBe(false);
    expect(estCache(partieAvecZone(zone('chaos', { x: 500, y: 500 })), { x: 500, y: 500 })).toBe(
      false,
    );
  });
});

describe('vie et mort des zones', () => {
  it('n en fait apparaitre aucune avant l intervalle regle', () => {
    const etat = avancerLesZones(creerEtatInitial({ graine: 1 }), 14_000);

    expect(Object.keys(etat.zones)).toEqual([]);
  });

  it('en fait apparaitre une quand l intervalle est ecoule', () => {
    const etat = avancerLesZones(creerEtatInitial({ graine: 1 }), 15_000);

    expect(Object.keys(etat.zones)).toEqual(['zone-0']);
  });

  it('ne depasse jamais trois zones actives', () => {
    // Des zones qui ne meurent pas de vieillesse pendant l'essai: on ne mesure
    // ici que le plafond, pas l'expiration.
    let etat = creerEtatInitial({ graine: 1, reglages: ZONES_DURABLES });
    for (let battement = 0; battement < 4_000; battement += 1) {
      etat = avancerLesZones(etat, 50);
    }

    expect(Object.keys(etat.zones)).toHaveLength(ZONES.SIMULTANEES_MAXIMUM);
  });

  it('retire une zone quand sa duree est epuisee', () => {
    const etat = partieAvecZone({ ...zone('chaos', { x: 500, y: 500 }), dureeRestanteMs: 1_000 });

    expect(Object.keys(avancerLesZones(etat, 999).zones)).toEqual(['zone-test']);
    expect(Object.keys(avancerLesZones(etat, 1_000).zones)).toEqual([]);
  });

  it('vide la carte quand les zones sont desactivees', () => {
    const etat = partieAvecZone(zone('chaos', { x: 500, y: 500 }));
    const eteintes: EtatPartie = {
      ...etat,
      reglages: { ...etat.reglages, zones: { ...etat.reglages.zones, actives: false } },
    };

    expect(Object.keys(avancerLesZones(eteintes, 50).zones)).toEqual([]);
    // Sans zone a retirer, l'etat n'est meme pas recopie.
    const dejaVide = { ...eteintes, zones: {} };
    expect(avancerLesZones(dejaVide, 50)).toBe(dejaVide);
  });

  it('ne fait apparaitre aucune zone quand aucune nature n est activee', () => {
    const aucuneNature: ReglagesPartiels = {
      zones: {
        types: { chaos: false, repulsion: false, attraction: false, invisibilite: false },
      },
    };
    const etat = avancerLesZones(creerEtatInitial({ graine: 1, reglages: aucuneNature }), 60_000);

    expect(Object.keys(etat.zones)).toEqual([]);
  });

  it('tire une nature parmi les seules activees', () => {
    const seulementLeChaos: ReglagesPartiels = {
      ...ZONES_DURABLES,
      zones: {
        ...ZONES_DURABLES.zones,
        types: { chaos: true, repulsion: false, attraction: false, invisibilite: false },
      },
    };

    let etat = creerEtatInitial({ graine: 11, reglages: seulementLeChaos });
    for (let battement = 0; battement < 1_000; battement += 1) {
      etat = avancerLesZones(etat, 50);
    }

    expect(Object.values(etat.zones).map((une) => une.type)).toEqual(['chaos', 'chaos', 'chaos']);
  });

  it('tire une duree comprise entre le minimum et le maximum regles', () => {
    for (let graine = 0; graine < 30; graine += 1) {
      const etat = avancerLesZones(creerEtatInitial({ graine }), 15_000);
      const posee = Object.values(etat.zones)[0] as ZoneSpeciale;

      expect(posee.dureeRestanteMs).toBeGreaterThanOrEqual(10_000);
      expect(posee.dureeRestanteMs).toBeLessThan(30_000);
      expect(Number.isInteger(posee.dureeRestanteMs)).toBe(true);
    }
  });

  it('pose une zone entierement contenue dans la carte, jamais minuscule', () => {
    const rayonMaximum = Math.sqrt(
      (CARTES.map1.largeur * CARTES.map1.hauteur) / ZONES.PART_DE_CARTE / Math.PI,
    );

    for (let graine = 0; graine < 30; graine += 1) {
      const etat = avancerLesZones(creerEtatInitial({ graine }), 15_000);
      const posee = Object.values(etat.zones)[0] as ZoneSpeciale;

      expect(posee.rayon).toBeGreaterThanOrEqual(ZONES.RAYON_MINIMUM_PX);
      expect(posee.rayon).toBeLessThan(rayonMaximum);
      expect(posee.centre.x - posee.rayon).toBeGreaterThanOrEqual(0);
      expect(posee.centre.y - posee.rayon).toBeGreaterThanOrEqual(0);
      expect(posee.centre.x + posee.rayon).toBeLessThanOrEqual(CARTES.map1.largeur);
      expect(posee.centre.y + posee.rayon).toBeLessThanOrEqual(CARTES.map1.hauteur);
    }
  });

  it('rejoue les memes zones a graine egale', () => {
    const derouler = (graine: number): readonly ZoneSpeciale[] => {
      let etat = creerEtatInitial({ graine });
      for (let battement = 0; battement < 1_000; battement += 1) {
        etat = avancerLesZones(etat, 50);
      }
      return Object.values(etat.zones);
    };

    expect(derouler(77)).toEqual(derouler(77));
    expect(derouler(77)).not.toEqual(derouler(78));
  });
});

describe('zone de chaos', () => {
  /** Une zone de chaos, un joueur rouge au loin, et un bot a repeindre. */
  function situation(): EtatPartie {
    let etat = partieAvecZone(zone('chaos', { x: 500, y: 500 }));
    etat = avecJoueur(etat, 'alice', { x: 1500, y: 1000 });
    return avecBot(etat, 'b1', { x: 520, y: 500 });
  }

  it('repeint un bot de la zone au bout d un temps suffisant', () => {
    // Sur dix secondes, la probabilite d'echapper au chaos est de 0,95 puissance
    // deux cents, c'est-a-dire une chance sur cent mille.
    const apres = appliquerLesEffetsDeZone(situation(), 10_000);

    expect(apres.bots['b1']?.couleur).not.toBe('#FFFFFF');
  });

  it('ne repeint jamais un bot avec la couleur d un joueur present', () => {
    const apres = appliquerLesEffetsDeZone(situation(), 10_000);
    const couleur = apres.bots['b1']?.couleur as string;

    expect(couleur).not.toBe(ROUGE);
    expect(COULEURS_JOUEURS).toContain(couleur);
  });

  it('laisse tranquille un bot hors de la zone', () => {
    let etat = partieAvecZone(zone('chaos', { x: 500, y: 500 }, 100));
    etat = avecBot(etat, 'loin', { x: 900, y: 500 });

    expect(appliquerLesEffetsDeZone(etat, 10_000).bots['loin']?.couleur).toBe('#FFFFFF');
  });

  it('ne touche jamais aux bots noirs', () => {
    let etat = partieAvecZone(zone('chaos', { x: 500, y: 500 }));
    etat = avecBot(etat, 'noir', { x: 510, y: 500 }, 'botNoir');

    expect(appliquerLesEffetsDeZone(etat, 60_000).bots['noir']?.couleur).toBe('#000000');
  });

  it('ne repeint rien quand aucun temps ne passe', () => {
    expect(appliquerLesEffetsDeZone(situation(), 0).bots['b1']?.couleur).toBe('#FFFFFF');
  });

  it('repeint autant quel que soit le decoupage du temps', () => {
    // La probabilite est ramenee au temps ecoule: cent bots pendant une seconde
    // donnent a peu pres le meme nombre de repeints, que le temps soit decoupe en
    // vingt battements ou passe d'un bloc.
    const cheptel = (): EtatPartie => {
      let etat = partieAvecZone(zone('chaos', { x: 500, y: 500 }, 400));
      for (let numero = 0; numero < 100; numero += 1) {
        etat = avecBot(etat, `b${numero}`, { x: 300 + numero * 4, y: 500 });
      }
      return etat;
    };

    const repeints = (etat: EtatPartie): number =>
      Object.values(etat.bots).filter((bot) => bot.couleur !== '#FFFFFF').length;

    let parPetitsPas = cheptel();
    for (let battement = 0; battement < 20; battement += 1) {
      parPetitsPas = appliquerLesEffetsDeZone(parPetitsPas, 50);
    }
    const enUnSeulPas = appliquerLesEffetsDeZone(cheptel(), 1_000);

    expect(Math.abs(repeints(parPetitsPas) - repeints(enUnSeulPas))).toBeLessThanOrEqual(15);
  });
});

describe('zone de repulsion', () => {
  it('eloigne le bot du joueur present dans la zone', () => {
    let etat = partieAvecZone(zone('repulsion', { x: 500, y: 500 }));
    etat = avecJoueur(etat, 'alice', { x: 500, y: 500 });
    etat = avecBot(etat, 'b1', { x: 510, y: 500 });

    const apres = appliquerLesEffetsDeZone(etat, 1_000);

    expect(positionDe(apres, 'b1').x).toBeCloseTo(510 + ZONES.REPULSION.FORCE_PX_PAR_SECONDE, 6);
    expect(positionDe(apres, 'b1').y).toBeCloseTo(500, 6);
  });

  it('plafonne la poussee quand plusieurs joueurs repoussent le meme bot', () => {
    let etat = partieAvecZone(zone('repulsion', { x: 500, y: 500 }));
    etat = avecJoueur(etat, 'alice', { x: 490, y: 500 });
    etat = ajouterJoueur(etat, {
      id: 'bob',
      pseudo: 'Bob',
      position: { x: 480, y: 500 },
      couleur: '#00FF00',
    });
    etat = avecBot(etat, 'b1', { x: 500, y: 500 });

    const apres = appliquerLesEffetsDeZone(etat, 1_000);

    expect(positionDe(apres, 'b1').x).toBeCloseTo(500 + ZONES.REPULSION.PLAFOND_PX_PAR_SECONDE, 6);
  });

  it('ne pousse rien quand aucun joueur n est dans la zone', () => {
    let etat = partieAvecZone(zone('repulsion', { x: 500, y: 500 }, 100));
    etat = avecJoueur(etat, 'alice', { x: 900, y: 500 });
    etat = avecBot(etat, 'b1', { x: 510, y: 500 });

    expect(positionDe(appliquerLesEffetsDeZone(etat, 1_000), 'b1')).toEqual({ x: 510, y: 500 });
  });

  it('ne pousse pas un bot situe au-dela de la portee de la force', () => {
    const rayon = ZONES.REPULSION.PORTEE_PX + 200;
    let etat = partieAvecZone(zone('repulsion', { x: 500, y: 500 }, rayon));
    etat = avecJoueur(etat, 'alice', { x: 500, y: 500 });
    etat = avecBot(etat, 'b1', { x: 500 + ZONES.REPULSION.PORTEE_PX, y: 500 });

    expect(positionDe(appliquerLesEffetsDeZone(etat, 1_000), 'b1').x).toBe(
      500 + ZONES.REPULSION.PORTEE_PX,
    );
  });

  it('ne pousse pas un bot exactement sous le joueur', () => {
    let etat = partieAvecZone(zone('repulsion', { x: 500, y: 500 }));
    etat = avecJoueur(etat, 'alice', { x: 500, y: 500 });
    etat = avecBot(etat, 'b1', { x: 500, y: 500 });

    expect(positionDe(appliquerLesEffetsDeZone(etat, 1_000), 'b1')).toEqual({ x: 500, y: 500 });
  });

  it('n envoie pas le bot dans un mur', () => {
    // Le legacy ajoutait la poussee aux coordonnees sans consulter le terrain.
    const terrain = creerCarteCollisions(CARTES.map1, (x) => x >= 600);
    let etat = partieAvecZone(zone('repulsion', { x: 500, y: 500 }), terrain);
    etat = avecJoueur(etat, 'alice', { x: 560, y: 500 });
    etat = avecBot(etat, 'b1', { x: 570, y: 500 });

    expect(positionDe(appliquerLesEffetsDeZone(etat, 1_000), 'b1').x).toBeLessThanOrEqual(
      600 - RAYON_ENTITE,
    );
  });
});

describe('zone d attraction', () => {
  it('rapproche le bot du joueur le plus proche', () => {
    let etat = partieAvecZone(zone('attraction', { x: 500, y: 500 }));
    etat = avecJoueur(etat, 'alice', { x: 500, y: 500 });
    etat = avecBot(etat, 'b1', { x: 600, y: 500 });

    const apres = appliquerLesEffetsDeZone(etat, 1_000);

    expect(positionDe(apres, 'b1').x).toBeCloseTo(600 - ZONES.ATTRACTION.FORCE_PX_PAR_SECONDE, 6);
  });

  it('choisit le joueur le plus proche, meme hors de la zone', () => {
    let etat = partieAvecZone(zone('attraction', { x: 500, y: 500 }, 150));
    etat = avecJoueur(etat, 'loin', { x: 100, y: 500 });
    etat = ajouterJoueur(etat, {
      id: 'proche',
      pseudo: 'Proche',
      position: { x: 800, y: 500 },
      couleur: '#00FF00',
    });
    etat = avecBot(etat, 'b1', { x: 550, y: 500 });

    expect(positionDe(appliquerLesEffetsDeZone(etat, 1_000), 'b1').x).toBeGreaterThan(550);
  });

  it('ne bouge rien quand la partie n a aucun joueur', () => {
    let etat = partieAvecZone(zone('attraction', { x: 500, y: 500 }));
    etat = avecBot(etat, 'b1', { x: 550, y: 500 });

    expect(appliquerLesEffetsDeZone(etat, 1_000).bots['b1']?.position).toEqual({ x: 550, y: 500 });
  });

  it('ne bouge pas un bot deja sur le joueur', () => {
    let etat = partieAvecZone(zone('attraction', { x: 500, y: 500 }));
    etat = avecJoueur(etat, 'alice', { x: 500, y: 500 });
    etat = avecBot(etat, 'b1', { x: 500, y: 500 });

    expect(positionDe(appliquerLesEffetsDeZone(etat, 1_000), 'b1')).toEqual({ x: 500, y: 500 });
  });
});

describe('zone d invisibilite', () => {
  it('ne change rien a la simulation', () => {
    let etat = partieAvecZone(zone('invisibilite', { x: 500, y: 500 }));
    etat = avecJoueur(etat, 'alice', { x: 500, y: 500 });
    etat = avecBot(etat, 'b1', { x: 510, y: 500 });

    // C'est le client qui cesse de dessiner les joueurs caches: le moteur, lui,
    // ne connait pas le dessin. Voir le defaut X22 de l'audit.
    expect(appliquerLesEffetsDeZone(etat, 1_000)).toBe(etat);
  });
});
