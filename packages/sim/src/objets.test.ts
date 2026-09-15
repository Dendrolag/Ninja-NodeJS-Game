/**
 * Tests des objets a ramasser: bonus et malus poses sur la carte.
 *
 * La reference de comportement est tests/caracterisation/effets.test.ts, qui
 * s'execute contre le legacy. Les deux points a ne jamais perdre de vue:
 *
 *   - un malus frappe les AUTRES joueurs, pas celui qui le ramasse;
 *   - les durees de bonus se cumulent.
 */

import type { ReglagesPartiels } from '@neon-ninja/shared';
import { CARTES, OBJETS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerCarteCollisions } from './collisions.js';
import type { EtatPartie, IdentifiantEntite, Joueur, ObjetRamassable } from './etat.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';
import {
  faireApparaitreLesObjets,
  fairePasserLeTempsSurLesObjets,
  nombreDeMalusPoses,
  poserObjet,
  ramasser,
  ramasserLesObjets,
  retirerObjet,
} from './objets.js';

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
};

/** Une partie calme, avec les joueurs demandes places ou on veut. */
function partieAvec(
  joueurs: readonly (readonly [IdentifiantEntite, { x: number; y: number }])[] = [],
  reglages: ReglagesPartiels = AUCUNE_APPARITION,
): EtatPartie {
  let etat = creerEtatInitial({ graine: 4, reglages });

  for (const [id, position] of joueurs) {
    etat = ajouterJoueur(etat, { id, pseudo: id.toUpperCase(), position });
  }

  return etat;
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Les objets poses, dans l'ordre. */
function objetsDe(etat: EtatPartie): readonly ObjetRamassable[] {
  return Object.values(etat.objets);
}

/** Les natures des objets poses, dans l'ordre. */
function naturesDe(etat: EtatPartie): readonly string[] {
  return objetsDe(etat).map((objet) => objet.nature);
}

describe('poser un objet', () => {
  it('pose un bonus avec sa duree de vie complete et un identifiant neuf', () => {
    const etat = poserObjet(partieAvec(), {
      categorie: 'bonus',
      nature: 'vitesse',
      position: { x: 300, y: 300 },
    });

    expect(objetsDe(etat)).toEqual([
      {
        id: 'bonus-0',
        categorie: 'bonus',
        nature: 'vitesse',
        position: { x: 300, y: 300 },
        dureeDeVieRestanteMs: OBJETS.DUREE_DE_VIE_MS,
      },
    ]);
  });

  it('donne un identifiant different a chaque objet, bonus et malus confondus', () => {
    let etat = poserObjet(partieAvec(), { categorie: 'bonus', nature: 'vitesse' });
    etat = poserObjet(etat, { categorie: 'malus', nature: 'flou' });
    etat = poserObjet(etat, { categorie: 'bonus', nature: 'revelation' });

    expect(Object.keys(etat.objets)).toEqual(['bonus-0', 'malus-1', 'bonus-2']);
  });

  it('tire une position hors des murs quand aucune n est imposee', () => {
    const terrain = creerCarteCollisions(CARTES.map1, (x) => x < 1000);
    const etat = poserObjet(creerEtatInitial({ graine: 9, terrain }), {
      categorie: 'bonus',
      nature: 'vitesse',
    });

    expect(objetsDe(etat)[0]?.position.x).toBeGreaterThan(1000);
  });

  it('retire un objet, et ne bronche pas sur un objet inconnu', () => {
    const etat = poserObjet(partieAvec(), { categorie: 'bonus', nature: 'vitesse' });

    expect(objetsDe(retirerObjet(etat, 'bonus-0'))).toEqual([]);
    expect(retirerObjet(etat, 'inconnu')).toBe(etat);
  });
});

describe('duree de vie d un objet pose', () => {
  it('disparait au bout de huit secondes, pas avant', () => {
    const pose = poserObjet(partieAvec(), { categorie: 'bonus', nature: 'vitesse' });

    expect(objetsDe(fairePasserLeTempsSurLesObjets(pose, 7_999))).toHaveLength(1);
    expect(objetsDe(fairePasserLeTempsSurLesObjets(pose, 8_000))).toHaveLength(0);
  });

  it('vaut aussi pour les malus', () => {
    const pose = poserObjet(partieAvec(), { categorie: 'malus', nature: 'flou' });

    expect(objetsDe(fairePasserLeTempsSurLesObjets(pose, 8_000))).toHaveLength(0);
  });

  it('se laisse user battement apres battement', () => {
    let etat = poserObjet(partieAvec(), { categorie: 'bonus', nature: 'vitesse' });
    for (let battement = 0; battement < 100; battement += 1) {
      etat = fairePasserLeTempsSurLesObjets(etat, 50);
    }

    expect(objetsDe(etat)).toHaveLength(1);
    expect(objetsDe(etat)[0]?.dureeDeVieRestanteMs).toBe(3_000);
  });
});

describe('apparition des bonus', () => {
  it('fait apparaitre les trois natures actives quand la chance est certaine', () => {
    const etat = faireApparaitreLesObjets(
      partieAvec([], {
        bonus: {
          types: {
            vitesse: { tauxApparitionPourCent: 100 },
            invincibilite: { tauxApparitionPourCent: 100 },
            revelation: { tauxApparitionPourCent: 100 },
          },
        },
        malus: { tauxApparitionPourCent: 0 },
      }),
      0,
    );

    expect(naturesDe(etat)).toEqual(['vitesse', 'invincibilite', 'revelation']);
  });

  it('ne fait rien apparaitre quand la chance est nulle', () => {
    expect(objetsDe(faireApparaitreLesObjets(partieAvec(), 0))).toEqual([]);
  });

  it('ignore une nature desactivee', () => {
    const etat = faireApparaitreLesObjets(
      partieAvec([], {
        bonus: {
          types: {
            vitesse: { actif: false, tauxApparitionPourCent: 100 },
            invincibilite: { tauxApparitionPourCent: 100 },
            revelation: { actif: false, tauxApparitionPourCent: 100 },
          },
        },
        malus: { tauxApparitionPourCent: 0 },
      }),
      0,
    );

    expect(naturesDe(etat)).toEqual(['invincibilite']);
  });

  it('attend l intervalle regle avant la tentative suivante', () => {
    const certaine: ReglagesPartiels = {
      bonus: {
        intervalleApparitionS: 4,
        types: {
          vitesse: { tauxApparitionPourCent: 100 },
          invincibilite: { actif: false },
          revelation: { actif: false },
        },
      },
      malus: { tauxApparitionPourCent: 0 },
    };

    // La premiere tentative a lieu au premier battement, comme dans le legacy.
    let etat = faireApparaitreLesObjets(partieAvec([], certaine), 50);
    expect(objetsDe(etat)).toHaveLength(1);

    // Deux secondes plus tard, l'intervalle tire n'est pas encore ecoule: il
    // vaut au minimum trois secondes.
    for (let battement = 0; battement < 40; battement += 1) {
      etat = faireApparaitreLesObjets(etat, 50);
    }
    expect(objetsDe(etat)).toHaveLength(1);

    // Au-dela de cinq secondes, l'intervalle est forcement passe.
    for (let battement = 0; battement < 80; battement += 1) {
      etat = faireApparaitreLesObjets(etat, 50);
    }
    expect(objetsDe(etat).length).toBeGreaterThanOrEqual(2);
  });
});

describe('apparition des malus', () => {
  /** Reglages ou un malus apparait a chaque tentative, et aucun bonus. */
  const MALUS_CERTAIN: ReglagesPartiels = {
    bonus: {
      types: {
        vitesse: { actif: false },
        invincibilite: { actif: false },
        revelation: { actif: false },
      },
    },
    malus: { tauxApparitionPourCent: 100, intervalleApparitionS: 1 },
  };

  it('fait apparaitre un seul malus par tentative', () => {
    const etat = faireApparaitreLesObjets(partieAvec([], MALUS_CERTAIN), 0);

    expect(objetsDe(etat)).toHaveLength(1);
    expect(objetsDe(etat)[0]?.categorie).toBe('malus');
  });

  it('ne depasse jamais cinq malus poses en meme temps', () => {
    let etat = partieAvec([], MALUS_CERTAIN);
    for (let battement = 0; battement < 200; battement += 1) {
      etat = faireApparaitreLesObjets(etat, 50);
    }

    expect(nombreDeMalusPoses(etat)).toBe(OBJETS.MALUS_SIMULTANES_MAXIMUM);
  });

  it('ne fait rien apparaitre quand les malus sont desactives', () => {
    const etat = faireApparaitreLesObjets(
      partieAvec([], { ...MALUS_CERTAIN, malus: { actifs: false, tauxApparitionPourCent: 100 } }),
      0,
    );

    expect(objetsDe(etat)).toEqual([]);
  });

  it('ne fait rien apparaitre quand aucune nature de malus n est activee', () => {
    const etat = faireApparaitreLesObjets(
      partieAvec([], {
        ...MALUS_CERTAIN,
        malus: {
          tauxApparitionPourCent: 100,
          types: {
            controlesInverses: { actif: false },
            flou: { actif: false },
            negatif: { actif: false },
          },
        },
      }),
      0,
    );

    expect(objetsDe(etat)).toEqual([]);
  });

  it('tire la nature parmi les seules activees', () => {
    let etat = partieAvec([], {
      ...MALUS_CERTAIN,
      malus: {
        tauxApparitionPourCent: 100,
        intervalleApparitionS: 1,
        types: { controlesInverses: { actif: false }, negatif: { actif: false } },
      },
    });

    for (let battement = 0; battement < 100; battement += 1) {
      etat = faireApparaitreLesObjets(etat, 50);
    }

    expect(naturesDe(etat)).toEqual(['flou', 'flou', 'flou', 'flou', 'flou']);
  });
});

describe('determinisme des apparitions', () => {
  it('fait apparaitre les memes objets aux memes endroits et aux memes instants', () => {
    const derouler = (graine: number): ReadonlyArray<string> => {
      let etat = creerEtatInitial({ graine });
      const journal: string[] = [];

      for (let battement = 0; battement < 400; battement += 1) {
        etat = faireApparaitreLesObjets(fairePasserLeTempsSurLesObjets(etat, 50), 50);
        for (const objet of objetsDe(etat)) {
          const trace = `${etat.tick}:${objet.id}:${objet.nature}:${objet.position.x}`;
          if (!journal.includes(trace)) {
            journal.push(trace);
          }
        }
      }

      return journal;
    };

    expect(derouler(2026)).toEqual(derouler(2026));
    expect(derouler(2026)).not.toEqual(derouler(1789));
  });

  it('repart d un compteur propre a chaque nouvelle partie', () => {
    // C'est le defaut X1 de l'audit: dans le legacy, chaque partie ajoutait une
    // chaine de minuteries qui ne s'arretait jamais, et les bonus finissaient par
    // apparaitre cinq fois plus vite. Ici deux parties successives sont deux
    // etats independants, donc rigoureusement identiques.
    const premiere = creerEtatInitial({ graine: 3 });
    const seconde = creerEtatInitial({ graine: 3 });

    expect(premiere.prochainesApparitions).toEqual(seconde.prochainesApparitions);
    expect(premiere.prochainesApparitions.bonusMs).toBe(0);
  });
});

describe('ramassage', () => {
  /** Une partie avec Alice sur un objet, et Bob au loin. */
  function aliceSurUnObjet(objet: 'bonus' | 'malus'): EtatPartie {
    const etat = partieAvec([
      ['alice', { x: 500, y: 500 }],
      ['bob', { x: 900, y: 900 }],
    ]);

    return objet === 'bonus'
      ? poserObjet(etat, { categorie: 'bonus', nature: 'vitesse', position: { x: 500, y: 500 } })
      : poserObjet(etat, { categorie: 'malus', nature: 'flou', position: { x: 500, y: 500 } });
  }

  it('donne le bonus au ramasseur et retire l objet de la carte', () => {
    const apres = ramasserLesObjets(aliceSurUnObjet('bonus'));

    expect(joueurDe(apres, 'alice').bonusRestantsMs.vitesse).toBe(10_000);
    expect(objetsDe(apres)).toEqual([]);
  });

  it('ne donne le bonus qu au ramasseur', () => {
    const apres = ramasserLesObjets(aliceSurUnObjet('bonus'));

    expect(joueurDe(apres, 'bob').bonusRestantsMs.vitesse).toBe(0);
  });

  it('cumule les durees quand le meme bonus est ramasse deux fois', () => {
    const premier = ramasserLesObjets(aliceSurUnObjet('bonus'));
    const seconde = poserObjet(premier, {
      categorie: 'bonus',
      nature: 'vitesse',
      position: { x: 500, y: 500 },
    });

    expect(joueurDe(ramasserLesObjets(seconde), 'alice').bonusRestantsMs.vitesse).toBe(20_000);
  });

  it('inscrit le ramassage du bonus au journal du battement', () => {
    const apres = ramasserLesObjets(aliceSurUnObjet('bonus'));

    expect(apres.evenements).toEqual([
      {
        type: 'bonusRamasse',
        joueur: 'alice',
        nature: 'vitesse',
        dureeMs: 10_000,
        position: { x: 500, y: 500 },
      },
    ]);
  });

  it('frappe les autres joueurs avec le malus, et pas celui qui l a ramasse', () => {
    // Comportement a preserver numero 4 de CLAUDE.md.
    const apres = ramasserLesObjets(aliceSurUnObjet('malus'));

    expect(joueurDe(apres, 'alice').malusRestantsMs.flou).toBe(0);
    expect(joueurDe(apres, 'bob').malusRestantsMs.flou).toBe(12_000);
  });

  it('inscrit le ramassage du malus au journal, avec la liste de ses victimes', () => {
    const apres = ramasserLesObjets(aliceSurUnObjet('malus'));

    expect(apres.evenements).toEqual([
      {
        type: 'malusRamasse',
        joueur: 'alice',
        nature: 'flou',
        dureeMs: 12_000,
        victimes: ['bob'],
        position: { x: 500, y: 500 },
      },
    ]);
  });

  it('applique a chaque nature de malus sa propre duree', () => {
    const durees: Record<string, number> = {};

    for (const nature of ['controlesInverses', 'flou', 'negatif'] as const) {
      const etat = poserObjet(
        partieAvec([
          ['alice', { x: 500, y: 500 }],
          ['bob', { x: 900, y: 900 }],
        ]),
        { categorie: 'malus', nature, position: { x: 500, y: 500 } },
      );
      durees[nature] = joueurDe(ramasserLesObjets(etat), 'bob').malusRestantsMs[nature];
    }

    expect(durees).toEqual({ controlesInverses: 10_000, flou: 12_000, negatif: 14_000 });
  });

  it('ne ramasse rien a quinze pixels, et ramasse juste en dessous', () => {
    const poser = (distance: number): EtatPartie =>
      poserObjet(partieAvec([['alice', { x: 500, y: 500 }]]), {
        categorie: 'bonus',
        nature: 'vitesse',
        position: { x: 500 + distance, y: 500 },
      });

    expect(objetsDe(ramasserLesObjets(poser(OBJETS.SEUIL_RAMASSAGE_PX)))).toHaveLength(1);
    expect(objetsDe(ramasserLesObjets(poser(OBJETS.SEUIL_RAMASSAGE_PX - 0.001)))).toHaveLength(0);
  });

  it('ramasse plusieurs objets d un coup quand ils sont sous les pieds du joueur', () => {
    let etat = partieAvec([['alice', { x: 500, y: 500 }]]);
    etat = poserObjet(etat, {
      categorie: 'bonus',
      nature: 'vitesse',
      position: { x: 500, y: 500 },
    });
    etat = poserObjet(etat, {
      categorie: 'bonus',
      nature: 'revelation',
      position: { x: 505, y: 500 },
    });

    const apres = ramasserLesObjets(etat);
    expect(objetsDe(apres)).toEqual([]);
    expect(joueurDe(apres, 'alice').bonusRestantsMs.vitesse).toBe(10_000);
    expect(joueurDe(apres, 'alice').bonusRestantsMs.revelation).toBe(10_000);
  });

  it('laisse le premier arrive ramasser, et le second repartir les mains vides', () => {
    let etat = partieAvec([
      ['alice', { x: 500, y: 500 }],
      ['bob', { x: 505, y: 500 }],
    ]);
    etat = poserObjet(etat, {
      categorie: 'bonus',
      nature: 'vitesse',
      position: { x: 502, y: 500 },
    });

    const apres = ramasserLesObjets(etat);
    expect(joueurDe(apres, 'alice').bonusRestantsMs.vitesse).toBe(10_000);
    expect(joueurDe(apres, 'bob').bonusRestantsMs.vitesse).toBe(0);
  });

  it('ne bronche pas sur un joueur ou un objet inconnu', () => {
    const etat = aliceSurUnObjet('bonus');

    expect(ramasser(etat, 'inconnu', 'bonus-0')).toBe(etat);
    expect(ramasser(etat, 'alice', 'inconnu')).toBe(etat);
  });

  it('ne ramasse rien quand personne ne joue', () => {
    const etat = poserObjet(partieAvec(), { categorie: 'bonus', nature: 'vitesse' });

    expect(ramasserLesObjets(etat)).toBe(etat);
  });
});
