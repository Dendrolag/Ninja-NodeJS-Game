/**
 * Tests des succes (etapes 3.7 et 3.8): les definitions, le pli sur l'historique et les
 * faits de partie, la premiere partie de chaque succes, et le succes le plus proche.
 *
 * Chaque succes est verifie juste sous et juste sur son seuil, sur un historique
 * construit a la main. Les seuils sont ecrits en toutes lettres: ce sont ceux que le
 * porteur du projet a gardes le 26 septembre 2026. Si l'un change, ces tests doivent
 * le signaler.
 */

import { describe, expect, it } from 'vitest';

import type { Mode } from './constantes.js';
import type { IdentifiantSucces, Mesures, PartieDuParcours } from './succes.js';
import {
  FAITS_DE_PARTIE,
  MESURES,
  PALIERS_DE_SUCCES,
  SUCCES,
  definitionDuSucces,
  estAtteint,
  estUnFait,
  estUnSucces,
  parcoursDe,
  progressionDuSucces,
  succesLePlusProche,
} from './succes.js';

/** Une partie de Horde, seul, sans rien pris ni gagne, le 1er septembre 2026. */
function partie(surcharge: Partial<PartieDuParcours> = {}): PartieDuParcours {
  return {
    mode: 'classique',
    carte: 'map1',
    modeMiroir: false,
    nombreJoueurs: 1,
    placement: 1,
    captures: 0,
    botsNoirsDetruits: 0,
    xpGagnee: 0,
    variationPointsLigue: 0,
    jour: '2026-09-01',
    amis: [],
    faits: {},
    ...surcharge,
  };
}

/** Une victoire dans une partie a deux. */
function victoire(surcharge: Partial<PartieDuParcours> = {}): PartieDuParcours {
  return partie({ nombreJoueurs: 2, placement: 1, ...surcharge });
}

/** Une defaite dans une partie a deux. */
function defaite(surcharge: Partial<PartieDuParcours> = {}): PartieDuParcours {
  return partie({ nombreJoueurs: 2, placement: 2, ...surcharge });
}

/** Une partie de ce mode, a plusieurs, avec ces faits. */
function avec(
  faits: PartieDuParcours['faits'],
  surcharge: Partial<PartieDuParcours> = {},
): PartieDuParcours {
  return partie({ nombreJoueurs: 2, placement: 2, faits, ...surcharge });
}

/** Une victoire dans une partie de quatre joueurs, dans ce mode, avec ces faits. */
function victoireA4(mode: Mode, faits: PartieDuParcours['faits']): PartieDuParcours {
  return partie({ mode, nombreJoueurs: 4, placement: 1, faits });
}

/** Cette partie, n fois. */
function fois(n: number, fabrique: (index: number) => PartieDuParcours): PartieDuParcours[] {
  return Array.from({ length: n }, (_, index) => fabrique(index));
}

/** Les succes atteints apres ces parties. */
function atteints(parties: readonly PartieDuParcours[]): IdentifiantSucces[] {
  return [...parcoursDe(parties).premieres.keys()];
}

/** Ce succes est-il atteint apres ces parties. */
function obtient(id: IdentifiantSucces, parties: readonly PartieDuParcours[]): boolean {
  return parcoursDe(parties).premieres.has(id);
}

/** Des mesures toutes a zero, sauf celles donnees. */
function mesures(surcharge: Partial<Mesures> = {}): Mesures {
  const zeros = Object.fromEntries(MESURES.map((mesure) => [mesure, 0])) as Record<
    (typeof MESURES)[number],
    number
  >;

  return { ...zeros, ...surcharge };
}

describe('les definitions', () => {
  it('portent des identifiants uniques, en minuscules et tirets', () => {
    const ids = SUCCES.map((succes) => succes.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(id.length).toBeLessThanOrEqual(40);
    }
  });

  it('sont rangees palier par palier, du plus facile au plus rare', () => {
    const rangs = SUCCES.map((succes) => PALIERS_DE_SUCCES.indexOf(succes.palier));

    expect(rangs).toEqual([...rangs].sort((un, autre) => un - autre));
  });

  it('comptent 47 succes: 8 Decouverte, 15 Habitue, 17 Expert, 7 Legende', () => {
    const parPalier = PALIERS_DE_SUCCES.map(
      (palier) => SUCCES.filter((succes) => succes.palier === palier).length,
    );

    expect(parPalier).toEqual([8, 15, 17, 7]);
  });

  it("gardent les trois secrets de l'etude", () => {
    expect(SUCCES.filter((succes) => succes.secret).map((succes) => succes.id)).toEqual([
      'pas-de-chance',
      'arroseur-arrose',
      'sur-le-fil',
    ]);
  });

  it('nomment des faits uniques, et reconnaissent un fait connu', () => {
    expect(new Set(FAITS_DE_PARTIE).size).toBe(FAITS_DE_PARTIE.length);

    for (const fait of FAITS_DE_PARTIE) {
      expect(fait).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      expect(fait.length).toBeLessThanOrEqual(40);
    }

    expect(estUnFait('ninjasRallies')).toBe(true);
    expect(estUnFait('faitRetire')).toBe(false);
  });

  it('donnent une unite aux cumuls, et a eux seuls', () => {
    for (const succes of SUCCES) {
      if (succes.unite !== undefined) {
        expect(succes.seuil, succes.id).toBeGreaterThan(1);
      }
    }

    expect(definitionDuSucces('serie').unite).toBeUndefined();
    expect(definitionDuSucces('meute').unite).toBeUndefined();
    expect(definitionDuSucces('premier-pas').unite).toBeUndefined();
  });

  it('reconnaissent un identifiant connu, et ignorent les autres', () => {
    expect(estUnSucces('premier-pas')).toBe(true);
    expect(estUnSucces('succes-retire')).toBe(false);
    expect(() => definitionDuSucces('inconnu' as IdentifiantSucces)).toThrow();
  });

  it('tirent les seuils des paliers de ligue des paliers de rang', () => {
    expect(definitionDuSucces('argent').seuil).toBe(100);
    expect(definitionDuSucces('or').seuil).toBe(300);
    expect(definitionDuSucces('diamant').seuil).toBe(1000);
  });
});

describe('chaque succes, juste sous et juste sur son seuil', () => {
  /**
   * Pour chaque succes: l'historique juste sous son seuil, et celui juste dessus.
   * Les deux historiques ne different que d'une partie ou d'un nombre.
   */
  const cas: Readonly<
    Record<IdentifiantSucces, readonly [readonly PartieDuParcours[], readonly PartieDuParcours[]]>
  > = {
    'premier-pas': [[], [partie()]],
    'premiere-prise': [[partie()], [partie({ captures: 1 })]],
    nettoyeur: [[partie()], [partie({ botsNoirsDetruits: 1 })]],
    reflet: [[partie()], [partie({ modeMiroir: true })]],
    'sur-le-podium': [
      [partie({ nombreJoueurs: 4, placement: 4 })],
      [partie({ nombreJoueurs: 4, placement: 3 })],
    ],
    'premiere-couronne': [[defaite()], [victoire()]],
    habitue: [fois(24, () => partie()), fois(25, () => partie())],
    'dix-couronnes': [fois(9, () => victoire()), fois(10, () => victoire())],
    pickpocket: [[partie({ captures: 49 })], [partie({ captures: 49 }), partie({ captures: 1 })]],
    demineur: [[partie({ botsNoirsDetruits: 24 })], [partie({ botsNoirsDetruits: 25 })]],
    touriste: [
      [partie({ carte: 'map1' }), partie({ carte: 'map3' }), partie({ carte: 'map1' })],
      [partie({ carte: 'map1' }), partie({ carte: 'map3' }), partie({ carte: 'quartier' })],
    ],
    'touche-a-tout': [
      [
        partie({ mode: 'classique' }),
        partie({ mode: 'tactique' }),
        partie({ mode: 'equipes' }),
        partie({ mode: 'chasse' }),
      ],
      [
        partie({ mode: 'classique' }),
        partie({ mode: 'tactique' }),
        partie({ mode: 'equipes' }),
        partie({ mode: 'chasse' }),
        partie({ mode: 'massacre' }),
      ],
    ],
    fidele: [
      fois(6, (index) => partie({ jour: `2026-09-0${String(index + 1)}` })),
      fois(7, (index) => partie({ jour: `2026-09-0${String(index + 1)}` })),
    ],
    // Le niveau 5 s'atteint a 1 000 XP.
    recrue: [[partie({ xpGagnee: 999 })], [partie({ xpGagnee: 999 }), partie({ xpGagnee: 1 })]],
    argent: [[partie({ variationPointsLigue: 99 })], [partie({ variationPointsLigue: 100 })]],
    'en-bande': [
      fois(9, () => partie({ amis: [{ compte: 'bob', placement: 2 }] })),
      fois(10, () => partie({ amis: [{ compte: 'bob', placement: 2 }] })),
    ],
    veteran: [fois(99, () => partie()), fois(100, () => partie())],
    'cinquante-couronnes': [fois(49, () => victoire()), fois(50, () => victoire())],
    serie: [
      [victoire(), victoire(), defaite(), victoire()],
      [victoire(), victoire(), defaite(), victoire(), victoire(), victoire()],
    ],
    solidaires: [
      fois(9, () => victoire({ mode: 'equipes' })),
      fois(10, () => victoire({ mode: 'equipes' })),
    ],
    // Le niveau 20 s'atteint a 19 000 XP.
    confirme: [[partie({ xpGagnee: 18_999 })], [partie({ xpGagnee: 19_000 })]],
    or: [[partie({ variationPointsLigue: 299 })], [partie({ variationPointsLigue: 300 })]],
    meute: [
      [partie({ mode: 'chasse', captures: 2 }), partie({ mode: 'chasse', captures: 2 })],
      [partie({ mode: 'chasse', captures: 3 })],
    ],
    rivalite: [
      fois(9, () => defaite({ placement: 1, amis: [{ compte: 'bob', placement: 2 }] })),
      fois(10, () => defaite({ placement: 1, amis: [{ compte: 'bob', placement: 2 }] })),
    ],
    pilier: [fois(499, () => partie()), fois(500, () => partie())],
    centurion: [fois(99, () => victoire()), fois(100, () => victoire())],
    'grand-chelem': [
      [
        victoire({ mode: 'classique' }),
        victoire({ mode: 'tactique' }),
        victoire({ mode: 'equipes' }),
        victoire({ mode: 'chasse' }),
        defaite({ mode: 'massacre' }),
      ],
      [
        victoire({ mode: 'classique' }),
        victoire({ mode: 'tactique' }),
        victoire({ mode: 'equipes' }),
        victoire({ mode: 'chasse' }),
        victoire({ mode: 'massacre' }),
      ],
    ],
    diamant: [[partie({ variationPointsLigue: 999 })], [partie({ variationPointsLigue: 1000 })]],
    // Le niveau 50 s'atteint a 122 500 XP.
    legende: [[partie({ xpGagnee: 122_499 })], [partie({ xpGagnee: 122_500 })]],

    // Les exploits de partie (etape 3.8).
    'cadeau-empoisonne': [[avec({})], [avec({ malusRamasses: 1 })]],
    rassembleur: [[avec({})], [avec({ amisRassembles: 1 })]],
    razzia: [
      [avec({ plusGrosseRazzia: 19 }), avec({ plusGrosseRazzia: 19 })],
      [avec({ plusGrosseRazzia: 20 })],
    ],
    revanche: [[avec({})], [avec({ revanches: 1 })]],
    'en-chaine': [[avec({ meilleurMultiplicateur: 2 })], [avec({ meilleurMultiplicateur: 3 })]],
    'pas-de-chance': [
      [avec({ prisParUnBlackNinja: 2 }), avec({ prisParUnBlackNinja: 2 })],
      [avec({ prisParUnBlackNinja: 3 })],
    ],
    'arroseur-arrose': [[avec({})], [avec({ prisJusteApresUnePrise: 1 })]],
    'combo-parfait': [
      [avec({ meilleurMultiplicateur: 4 }, { mode: 'massacre' })],
      [avec({ meilleurMultiplicateur: 5 }, { mode: 'massacre' })],
    ],
    intouchable: [
      [partie({ nombreJoueurs: 4, placement: 2, faits: { jamaisPris: 1 } })],
      [victoireA4('classique', { jamaisPris: 1 })],
    ],
    'coup-de-filet': [
      [avec({ meilleurTir: 7 }, { mode: 'tactique' })],
      [avec({ meilleurTir: 8 }, { mode: 'tactique' })],
    ],
    'derniere-proie': [
      [partie({ mode: 'chasse', nombreJoueurs: 3, faits: { derniereProie: 1 } })],
      [partie({ mode: 'chasse', nombreJoueurs: 4, faits: { derniereProie: 1 } })],
    ],
    'table-rase': [
      [avec({}, { mode: 'massacre' })],
      [avec({ carteVidee: 1 }, { mode: 'massacre' })],
    ],
    'chasseur-d-evade': [[avec({})], [avec({ evadesAttrapes: 1 })]],
    'main-leste': [[avec({})], [avec({ x2Voles: 1 })]],
    'double-ou-rien': [
      [defaite({ faits: { porteurDuX2: 1 } })],
      [victoire({ faits: { porteurDuX2: 1 } })],
    ],
    'sur-le-fil': [[avec({})], [avec({ prisesSurLeFil: 1 })]],
    'collectionneur-de-fantomes': [
      [avec({ evadesAttrapes: 9 })],
      [avec({ evadesAttrapes: 9 }), avec({ evadesAttrapes: 1 })],
    ],
    'seigneur-de-la-horde': [
      [avec({ ninjasRallies: 9_999 })],
      [avec({ ninjasRallies: 9_999 }), avec({ ninjasRallies: 1 })],
    ],
  };

  for (const succes of SUCCES) {
    it(`${succes.nom}: pas sous le seuil, obtenu dessus`, () => {
      const [sous, sur] = cas[succes.id];

      expect(obtient(succes.id, sous)).toBe(false);
      expect(obtient(succes.id, sur)).toBe(true);
    });
  }
});

describe('les regles du pli', () => {
  it('ne donne rien a un compte sans partie', () => {
    const parcours = parcoursDe([]);

    expect(parcours.premieres.size).toBe(0);
    expect(parcours.mesures).toEqual(mesures());
  });

  it("ne compte pas une partie jouee seul comme une victoire, ni ne l'y fait entrer en Equipes", () => {
    expect(atteints([partie()])).toEqual(['premier-pas']);
    expect(
      obtient(
        'solidaires',
        fois(10, () => partie({ mode: 'equipes' })),
      ),
    ).toBe(false);
  });

  it("met sur le podium les trois premiers d'une partie de quatre, jamais a trois", () => {
    expect(obtient('sur-le-podium', [partie({ nombreJoueurs: 3, placement: 1 })])).toBe(false);
    expect(obtient('sur-le-podium', [partie({ nombreJoueurs: 12, placement: 3 })])).toBe(true);
  });

  it("en Equipes, ne met sur le podium que l'equipe gagnante", () => {
    // Deux contre deux: les perdants sont troisiemes, et une egalite place tout le monde
    // troisieme.
    expect(
      obtient('sur-le-podium', [partie({ mode: 'equipes', nombreJoueurs: 4, placement: 3 })]),
    ).toBe(false);
    expect(
      obtient('sur-le-podium', [partie({ mode: 'equipes', nombreJoueurs: 4, placement: 1 })]),
    ).toBe(true);
  });

  it("n'interrompt pas une serie par une partie jouee seul, mais par une defaite", () => {
    expect(obtient('serie', [victoire(), partie(), victoire(), partie(), victoire()])).toBe(true);
    expect(obtient('serie', [victoire(), victoire(), defaite(), victoire()])).toBe(false);
    expect(parcoursDe([victoire(), victoire(), defaite(), victoire()]).mesures.meilleureSerie).toBe(
      2,
    );
  });

  it('interrompt une serie par un abandon, dernier a zero point', () => {
    const abandon = partie({ nombreJoueurs: 4, placement: 4 });

    expect(obtient('serie', [victoire(), victoire(), abandon, victoire()])).toBe(false);
  });

  it('compte les prises de tous les modes', () => {
    const parcours = parcoursDe([
      partie({ mode: 'classique', captures: 1 }),
      partie({ mode: 'chasse', captures: 2 }),
      partie({ mode: 'massacre', captures: 3 }),
    ]);

    expect(parcours.mesures.prises).toBe(6);
  });

  it('ne lit la meute que dans une Chasse, et dans une seule partie', () => {
    expect(obtient('meute', [partie({ mode: 'massacre', captures: 5 })])).toBe(false);
    expect(parcoursDe([partie({ mode: 'chasse', captures: 2 })]).mesures.meilleureChasse).toBe(2);
  });

  it('garde le sommet des points de ligue quand ils redescendent', () => {
    const parcours = parcoursDe([
      victoire({ variationPointsLigue: 60 }),
      victoire({ variationPointsLigue: 50 }),
      defaite({ variationPointsLigue: -40 }),
      defaite({ variationPointsLigue: -30 }),
    ]);

    expect(parcours.mesures.sommetDesPointsDeLigue).toBe(110);
    expect(parcours.premieres.get('argent')).toBe(1);
  });

  it('ne descend jamais sous zero point en rejouant les variations', () => {
    // Des variations deja reduites par la base ne font jamais descendre sous zero: le pli
    // ne compte pas pour autant de dette si une ligne l'ecrivait.
    const parcours = parcoursDe([
      defaite({ variationPointsLigue: -50 }),
      victoire({ variationPointsLigue: 100 }),
    ]);

    expect(parcours.mesures.sommetDesPointsDeLigue).toBe(100);
  });

  it("compte les jours differents, pas les parties d'un meme jour", () => {
    const parcours = parcoursDe([
      partie({ jour: '2026-09-01' }),
      partie({ jour: '2026-09-01' }),
      partie({ jour: '2026-09-03' }),
    ]);

    expect(parcours.mesures.jours).toBe(2);
  });

  it('lit les amis un par un: dix parties avec deux amis differents ne font pas une bande', () => {
    const parties = fois(10, (index) =>
      partie({ amis: [{ compte: index % 2 === 0 ? 'bob' : 'carla', placement: 2 }] }),
    );

    expect(parcoursDe(parties).mesures.partiesAvecUnAmi).toBe(5);
    expect(obtient('en-bande', parties)).toBe(false);
  });

  it('ne fait devancer personne par une egalite, et compte les parties ensemble a part', () => {
    const egalite = partie({
      mode: 'equipes',
      nombreJoueurs: 4,
      placement: 1,
      amis: [{ compte: 'bob', placement: 1 }],
    });
    const derriere = defaite({ amis: [{ compte: 'bob', placement: 1 }] });
    const parcours = parcoursDe([egalite, derriere]);

    expect(parcours.mesures.partiesAvecUnAmi).toBe(2);
    expect(parcours.mesures.devantUnAmi).toBe(0);
  });

  it('mesure les niveaux par la somme des XP gagnees', () => {
    expect(parcoursDe([]).mesures.xpTotale).toBe(0);
    expect(parcoursDe([partie({ xpGagnee: 60 }), partie({ xpGagnee: 40 })]).mesures.xpTotale).toBe(
      100,
    );
  });
});

describe('les regles des exploits de partie', () => {
  it("ne donne aucun exploit a une partie sans faits, d'avant l'etape 3.8 ou abandonnee", () => {
    const { mesures: sansFaits } = parcoursDe([victoireA4('classique', {})]);

    expect(sansFaits.victoiresIntouchables).toBe(0);
    expect(sansFaits.malusRamasses).toBe(0);
  });

  it('ne lit le multiplicateur de En chaine que dans la Horde', () => {
    expect(obtient('en-chaine', [avec({ meilleurMultiplicateur: 5 }, { mode: 'massacre' })])).toBe(
      false,
    );
    expect(obtient('combo-parfait', [avec({ meilleurMultiplicateur: 5 })])).toBe(true);
  });

  it('ne lit le multiplicateur de Combo parfait ni en Tactique, ni en Equipes, ni en Chasse', () => {
    for (const mode of ['tactique', 'equipes', 'chasse'] as const) {
      expect(obtient('combo-parfait', [avec({ meilleurMultiplicateur: 5 }, { mode })])).toBe(false);
    }
  });

  it('veut pour Intouchable une victoire en Horde, a quatre joueurs au moins, sans avoir ete pris', () => {
    expect(obtient('intouchable', [victoireA4('classique', {})])).toBe(false);
    expect(obtient('intouchable', [victoireA4('tactique', { jamaisPris: 1 })])).toBe(false);
    expect(
      obtient('intouchable', [
        partie({ nombreJoueurs: 3, placement: 1, faits: { jamaisPris: 1 } }),
      ]),
    ).toBe(false);
  });

  it('ne lit le meilleur tir que dans une partie Tactique', () => {
    expect(obtient('coup-de-filet', [avec({ meilleurTir: 9 }, { mode: 'chasse' })])).toBe(false);
  });

  it('ne lit la derniere proie que dans une Chasse', () => {
    expect(
      obtient('derniere-proie', [partie({ nombreJoueurs: 4, faits: { derniereProie: 1 } })]),
    ).toBe(false);
  });

  it('ne lit la carte videe que dans un Massacre', () => {
    expect(obtient('table-rase', [avec({ carteVidee: 1 })])).toBe(false);
  });

  it('veut pour Double ou rien une victoire a plusieurs: seul, porter le x2 ne suffit pas', () => {
    expect(obtient('double-ou-rien', [partie({ faits: { porteurDuX2: 1 } })])).toBe(false);
    expect(obtient('double-ou-rien', [victoireA4('equipes', { porteurDuX2: 1 })])).toBe(true);
  });

  it('ne compte les ninjas rallies que dans la Horde', () => {
    expect(
      parcoursDe([avec({ ninjasRallies: 50 }), avec({ ninjasRallies: 30 }, { mode: 'equipes' })])
        .mesures.ninjasRalliesEnHorde,
    ).toBe(50);
  });

  it('lit les records dans une seule partie, et cumule les autres faits', () => {
    const { mesures: cumul } = parcoursDe([
      avec({ prisParUnBlackNinja: 2, evadesAttrapes: 1, revanches: 1 }),
      avec({ prisParUnBlackNinja: 2, evadesAttrapes: 1, revanches: 2 }),
    ]);

    expect(cumul.plusDePrisesParUnBlackNinja).toBe(2);
    expect(cumul.evadesAttrapes).toBe(2);
    expect(cumul.revanches).toBe(3);
  });

  it("date un exploit de la partie ou il est fait, apres les succes de base qu'elle donne", () => {
    const { premieres } = parcoursDe([partie(), victoire({ faits: { malusRamasses: 1 } })]);

    expect(premieres.get('cadeau-empoisonne')).toBe(1);
    expect(atteints([victoire({ faits: { malusRamasses: 1 } })])).toEqual([
      'premier-pas',
      'premiere-couronne',
      'cadeau-empoisonne',
    ]);
  });
});

describe('la premiere partie de chaque succes', () => {
  it("date chaque succes de la partie apres laquelle il etait atteint, sans jamais l'avancer", () => {
    const parties = [
      partie(),
      victoire({ captures: 1 }),
      victoire(),
      defaite({ botsNoirsDetruits: 1 }),
      victoire(),
    ];
    const { premieres } = parcoursDe(parties);

    expect(Object.fromEntries(premieres)).toEqual({
      'premier-pas': 0,
      'premiere-prise': 1,
      'premiere-couronne': 1,
      nettoyeur: 3,
    });
  });

  it('date la serie de sa troisieme victoire', () => {
    const { premieres } = parcoursDe([defaite(), victoire(), victoire(), victoire(), victoire()]);

    expect(premieres.get('serie')).toBe(3);
  });

  it("suit l'ordre des definitions pour deux succes atteints par la meme partie", () => {
    expect(atteints([victoire({ captures: 1, modeMiroir: true })])).toEqual([
      'premier-pas',
      'premiere-prise',
      'reflet',
      'premiere-couronne',
    ]);
  });
});

describe('estAtteint', () => {
  it('compare la mesure au seuil, bornes comprises', () => {
    const habitue = definitionDuSucces('habitue');

    expect(estAtteint(habitue, mesures({ partiesJouees: 24 }))).toBe(false);
    expect(estAtteint(habitue, mesures({ partiesJouees: 25 }))).toBe(true);
    expect(estAtteint(habitue, mesures({ partiesJouees: 26 }))).toBe(true);
  });
});

describe('la progression', () => {
  it("montre la progression d'un cumul, plafonnee a son seuil", () => {
    expect(
      progressionDuSucces(definitionDuSucces('habitue'), mesures({ partiesJouees: 12 })),
    ).toEqual({ id: 'habitue', actuel: 12, seuil: 25 });
    expect(
      progressionDuSucces(definitionDuSucces('habitue'), mesures({ partiesJouees: 40 })),
    ).toEqual({ id: 'habitue', actuel: 25, seuil: 25 });
  });

  it("n'en montre pas pour un succes qui s'obtient d'un coup", () => {
    expect(progressionDuSucces(definitionDuSucces('serie'), mesures({ meilleureSerie: 2 }))).toBe(
      undefined,
    );
  });

  it("n'en montre pas pour un succes secret", () => {
    const secret = { ...definitionDuSucces('habitue'), secret: true };

    expect(progressionDuSucces(secret, mesures({ partiesJouees: 12 }))).toBeUndefined();
  });
});

describe('le succes le plus proche', () => {
  it('propose le cumul dont la plus grande part est faite', () => {
    const plusProche = succesLePlusProche(
      mesures({ partiesJouees: 20, victoires: 7, prises: 45 }),
      new Set(),
    );

    // Habitue 20/25 = 0,8, Dix couronnes 7/10 = 0,7, Pickpocket 45/50 = 0,9.
    expect(plusProche).toEqual({ id: 'pickpocket', actuel: 45, seuil: 50 });
  });

  it("departage une egalite par l'ordre des definitions", () => {
    const plusProche = succesLePlusProche(mesures({ partiesJouees: 5, victoires: 2 }), new Set());

    // Habitue 5/25 et Dix couronnes 2/10 valent 0,2: Habitue vient d'abord.
    expect(plusProche?.id).toBe('habitue');
  });

  it('ne propose ni un succes obtenu, ni un cumul atteint, ni un cumul pas commence', () => {
    expect(succesLePlusProche(mesures({ partiesJouees: 20 }), new Set(['habitue']))?.id).toBe(
      'veteran',
    );
    expect(succesLePlusProche(mesures({ partiesJouees: 25 }), new Set())?.id).toBe('veteran');
    expect(succesLePlusProche(mesures(), new Set())).toBeUndefined();
  });

  it("ne compte pas le niveau 1 d'un compte neuf comme un debut de Recrue", () => {
    // Une partie jouee, aucune XP: rien n'est commence du cote des niveaux.
    expect(succesLePlusProche(mesures({ partiesJouees: 1 }), new Set())?.id).toBe('habitue');
    expect(succesLePlusProche(mesures({ xpTotale: 900 }), new Set())).toEqual({
      id: 'recrue',
      actuel: 900,
      seuil: 1000,
    });
  });
});
