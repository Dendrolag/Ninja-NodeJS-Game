/**
 * Tests des quatre mini-jeux des taches longues d'Among Ninjas (etape 7.24): chacun se gagne au
 * pointeur et au clavier, un echec recommence une partie neuve, et le plus rapide des joueurs
 * honnetes ne finit pas sous la duree minimale du serveur, sauf a la bataille navale, ou la
 * chance le permet et ou la fenetre attend.
 */

import { DUREES_MINIMALES_DES_TACHES_MS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Case, EtatCaisses } from './caisses.js';
import {
  BOUTONS,
  COLONNES,
  LIGNES,
  LIGNES_A_FAIRE,
  ORIENTATIONS,
  PERTE_MS as PERTE_DES_CAISSES_MS,
  PREPAREE,
  VIDE,
  creerCaisses,
  preparerLaGrille,
} from './caisses.js';
import type { EtatBataille } from './bataille.js';
import {
  BATEAUX,
  COTE_DE_LA_MER,
  MER,
  PERTE_MS as PERTE_DE_LA_BATAILLE_MS,
  TIRS_PERMIS,
  TIR_MS,
  creerBataille,
  placerLesBateaux,
} from './bataille.js';
import type { CommandeDeGeste, EtatDeGeste } from './index.js';
import { appliquerGeste, avancementDuGeste, gesteFini } from './index.js';
import type { EtatEnvahisseurs } from './envahisseurs.js';
import {
  CADENCE_MS,
  DEPART_DE_LA_RANGEE,
  ENVAHISSEURS,
  LIGNE_DU_NINJA,
  PREMIER_TIR_MS,
  RAYON_DU_NINJA,
  RAYON_D_UN_ENVAHISSEUR,
  SOL,
  VITESSE_DE_LA_RANGEE,
  VITESSE_DU_SHURIKEN,
  centreDUnEnvahisseur,
  creerEnvahisseurs,
} from './envahisseurs.js';
import type { Direction, EtatSerpent } from './serpent.js';
import {
  COLONNES_DU_SERPENT,
  ELOIGNEMENT_DU_FRUIT,
  LIGNES_DU_SERPENT,
  creerSerpent,
} from './serpent.js';

/** Le pas d'une image, en millisecondes. */
const IMAGE_MS = 16;

/** Une touche enfoncee, ou relachee. */
function touche(
  nom: 'gauche' | 'droite' | 'haut' | 'bas' | 'espace',
  enfoncee = true,
): CommandeDeGeste {
  return { type: 'touche', touche: nom, enfoncee };
}

/** Une commande du pointeur. */
function pointeur(phase: 'bas' | 'deplace' | 'haut', x: number, y: number): CommandeDeGeste {
  return { type: 'pointeur', phase, x, y };
}

/** Applique des commandes a la suite, au meme instant. */
function jouer<E extends EtatDeGeste>(
  etat: E,
  commandes: readonly CommandeDeGeste[],
  maintenant: number,
): E {
  return commandes.reduce(
    (courant, commande) => appliquerGeste(courant, commande, maintenant) as E,
    etat,
  );
}

/**
 * Joue un mini-jeu image par image, chaque image donnant le temps puis les commandes de la
 * strategie, et rend l'instant ou il est fini, l'ouverture a l'instant zero.
 */
function instantDeFin<E extends EtatDeGeste>(
  depart: E,
  strategie: (etat: E, maintenant: number) => readonly CommandeDeGeste[],
  limite = 60_000,
): number {
  let etat = depart;

  for (let maintenant = 0; maintenant <= limite; maintenant += IMAGE_MS) {
    etat = jouer(
      appliquerGeste(etat, { type: 'temps' }, maintenant) as E,
      strategie(etat, maintenant),
      maintenant,
    );

    if (gesteFini(etat, maintenant)) {
      return maintenant;
    }
  }

  throw new Error(`Le mini-jeu ${depart.nature} ne s'est pas fini.`);
}

/** Fait passer le temps, image par image, sans rien commander. */
function attendre<E extends EtatDeGeste>(etat: E, depuis: number, jusqua: number): E {
  let courant = etat;
  for (let maintenant = depuis; maintenant <= jusqua; maintenant += IMAGE_MS) {
    courant = appliquerGeste(courant, { type: 'temps' }, maintenant) as E;
  }
  return courant;
}

// --------------------------------------------------------------------------
// Empiler des caisses
// --------------------------------------------------------------------------

/** La case (colonne, ligne) de la grille. */
function contenu(grille: readonly number[], [colonne, ligne]: Case): number {
  return grille[ligne * COLONNES + colonne] ?? VIDE;
}

/**
 * La strategie qui suit la solution de la grille: tourner la piece dans son orientation, la
 * mener a sa colonne, puis tenir la descente, au clavier ou aux boutons.
 */
function suivreLaSolution(auPointeur: boolean) {
  return (etat: EtatCaisses): readonly CommandeDeGeste[] => {
    const piece = etat.enJeu;
    const cible = preparerLaGrille(etat.graine).solution[etat.suivante - 1];

    if (piece === undefined || cible === undefined) {
      return auPointeur ? [pointeur('haut', 0, 0)] : [touche('bas', false)];
    }

    const bouton = (nom: string): readonly CommandeDeGeste[] => {
      const place = BOUTONS.find((un) => un.bouton === nom);
      return place === undefined ? [] : [pointeur('bas', place.x + 5, place.y + 5)];
    };

    if (piece.orientation !== cible.orientation) {
      return auPointeur ? [pointeur('haut', 0, 0), ...bouton('tourner')] : [touche('haut')];
    }
    if (piece.colonne !== cible.colonne) {
      const sens = piece.colonne < cible.colonne ? 'droite' : 'gauche';
      return auPointeur ? [pointeur('haut', 0, 0), ...bouton(sens)] : [touche(sens)];
    }
    return etat.descente ? [] : auPointeur ? bouton('descendre') : [touche('bas')];
  };
}

describe('empiler des caisses', () => {
  it('prepare des grilles faisables, avec des trous dans les deux lignes a faire', () => {
    let deSecours = 0;

    for (let graine = 1; graine <= 120; graine += 1) {
      const { grille, pieces, solution } = preparerLaGrille(graine);

      expect(pieces).toHaveLength(4);
      expect(solution.map((piece) => piece.forme)).toEqual(pieces);
      if (grille.every((case_) => case_ === VIDE)) {
        deSecours += 1;
        continue;
      }
      for (let rang = 0; rang < LIGNES; rang += 1) {
        const ligne = Array.from({ length: COLONNES }, (_rien, c) => contenu(grille, [c, rang]));
        // Aucune ligne n'est deja pleine.
        expect(ligne.every((case_) => case_ === PREPAREE)).toBe(false);
      }
    }

    expect(deSecours).toBe(0);
  });

  it('se gagne en suivant la solution, au clavier et aux boutons, sans aller trop vite', () => {
    const fins: number[] = [];

    for (let graine = 1; graine <= 40; graine += 1) {
      for (const auPointeur of [false, true]) {
        const fin = instantDeFin(creerCaisses(graine), suivreLaSolution(auPointeur));
        fins.push(fin);
      }
    }

    // Quatre pieces, une fois et demie plus vite descente tenue: parfois un peu sous la duree
    // minimale du serveur, que la fenetre attend alors.
    const minimale = DUREES_MINIMALES_DES_TACHES_MS.caisses;
    expect(Math.min(...fins)).toBeGreaterThan(minimale * 0.85);
    expect(fins.filter((fin) => fin >= minimale).length / fins.length).toBeGreaterThan(0.5);
    expect(Math.max(...fins)).toBeLessThan(20_000);
  });

  it('a l allure de la chute, sans descendre, dure le temps vise', () => {
    const fin = instantDeFin(creerCaisses(3), (etat) => {
      const strategie = suivreLaSolution(false)(etat);
      return strategie.filter(
        (commande) => commande.type !== 'touche' || commande.touche !== 'bas',
      );
    });

    expect(fin).toBeGreaterThan(16_000);
    expect(fin).toBeLessThan(25_000);
  });

  it('perd quand les pieces tombent sans viser, puis prepare une grille neuve', () => {
    let etat: EtatCaisses = creerCaisses(5);
    let maintenant = 0;

    while (!etat.echos.includes('perdue') && maintenant < 60_000) {
      etat = jouer(etat, [{ type: 'temps' }, touche('bas')], maintenant);
      maintenant += IMAGE_MS;
    }

    expect(etat.echos).toContain('perdue');
    expect(etat.echos.filter((echo) => echo === 'posee').length).toBeGreaterThan(0);
    const neuve = attendre(
      jouer(etat, [touche('bas', false)], maintenant),
      maintenant,
      maintenant + PERTE_DES_CAISSES_MS + 50,
    );
    expect(neuve.graine).toBe(6);
    expect(neuve.lignes).toBe(0);
    expect(neuve.enJeu).toBeDefined();
  });

  it('bouge la piece aux boutons et au clavier, et tourne sans sortir de la grille', () => {
    const depart = appliquerGeste(creerCaisses(9), { type: 'temps' }, 0) as EtatCaisses;
    const colonne = depart.enJeu?.colonne ?? 0;
    const gauche = BOUTONS[0];

    expect(
      jouer(depart, [pointeur('bas', (gauche?.x ?? 0) + 2, (gauche?.y ?? 0) + 2)], 10).enJeu
        ?.colonne,
    ).toBe(colonne - 1);
    expect(jouer(depart, [touche('droite')], 10).enJeu?.colonne).toBe(colonne + 1);

    let collee = depart;
    for (let fois = 0; fois < COLONNES; fois += 1) {
      collee = jouer(collee, [touche('droite')], 10);
    }
    const forme = collee.enJeu?.forme ?? 0;
    for (let fois = 0; fois < 4; fois += 1) {
      collee = jouer(collee, [touche('haut')], 10);
      for (const [c] of ORIENTATIONS[forme]?.[collee.enJeu?.orientation ?? 0] ?? []) {
        expect((collee.enJeu?.colonne ?? 0) + c).toBeLessThan(COLONNES);
      }
    }
  });

  it('compte deux lignes a faire', () => {
    expect(avancementDuGeste(creerCaisses(1))).toEqual({ faits: 0, total: LIGNES_A_FAIRE });
  });
});

// --------------------------------------------------------------------------
// Nourrir le serpent
// --------------------------------------------------------------------------

/** La direction du premier pas d'un plus court chemin de la tete au fruit, hors du corps. */
function versLeFruit(etat: EtatSerpent): Direction | undefined {
  const tete = etat.corps[0] ?? [0, 0];
  const cle = ([c, l]: Case): number => l * COLONNES_DU_SERPENT + c;
  const corps = new Set(etat.corps.slice(0, -1).map(cle));
  const venues = new Map<number, Direction>();
  const file: Case[] = [tete];
  const vus = new Set([cle(tete)]);
  const pas: readonly [Direction, Case][] = [
    ['droite', [1, 0]],
    ['gauche', [-1, 0]],
    ['bas', [0, 1]],
    ['haut', [0, -1]],
  ];

  while (file.length > 0) {
    const ici = file.shift() as Case;
    if (ici[0] === etat.fruit[0] && ici[1] === etat.fruit[1]) {
      return venues.get(cle(ici));
    }
    for (const [direction, [dc, dl]] of pas) {
      const la: Case = [ici[0] + dc, ici[1] + dl];
      const dedans =
        la[0] >= 0 && la[0] < COLONNES_DU_SERPENT && la[1] >= 0 && la[1] < LIGNES_DU_SERPENT;
      if (dedans && !vus.has(cle(la)) && !corps.has(cle(la))) {
        vus.add(cle(la));
        venues.set(cle(la), venues.get(cle(ici)) ?? direction);
        file.push(la);
      }
    }
  }

  return undefined;
}

describe('nourrir le serpent', () => {
  it('se gagne au plus court, au clavier, jamais sous la duree minimale', () => {
    for (let graine = 1; graine <= 30; graine += 1) {
      const fin = instantDeFin(creerSerpent(graine), (etat) => {
        const direction = versLeFruit(etat);
        return direction === undefined ? [] : [touche(direction)];
      });

      expect(fin).toBeGreaterThanOrEqual(DUREES_MINIMALES_DES_TACHES_MS.serpent);
      expect(fin).toBeLessThan(20_000);
    }
  });

  it('pose chaque fruit loin de la tete, hors du corps', () => {
    let etat = creerSerpent(4);
    let maintenant = 0;

    while (etat.manges < 5 && maintenant < 30_000) {
      const avant = etat.manges;
      const direction = versLeFruit(etat);
      etat = jouer(
        etat,
        [{ type: 'temps' }, ...(direction === undefined ? [] : [touche(direction)])],
        maintenant,
      );
      if (etat.manges > avant && etat.manges < 5) {
        const tete = etat.corps[0] ?? [0, 0];
        const ecart = Math.abs(etat.fruit[0] - tete[0]) + Math.abs(etat.fruit[1] - tete[1]);
        expect(ecart).toBeGreaterThanOrEqual(ELOIGNEMENT_DU_FRUIT);
        expect(etat.corps.some(([c, l]) => c === etat.fruit[0] && l === etat.fruit[1])).toBe(false);
      }
      maintenant += IMAGE_MS;
    }

    expect(etat.manges).toBe(5);
    expect(etat.echos.filter((echo) => echo === 'fruit')).toHaveLength(5);
    expect(etat.corps).toHaveLength(8);
  });

  it('perd au bord, puis repart d une partie neuve', () => {
    // Tout droit vers la droite: la tete part de la colonne 4, et sort au huitieme pas.
    let etat = attendre(creerSerpent(2), 0, 2400);

    expect(etat.echos).toContain('perdue');
    expect(etat.perdueJusqua).toBeDefined();
    etat = attendre(etat, 2400, (etat.perdueJusqua ?? 0) + 20);
    expect(etat.graine).toBe(3);
    expect(etat.manges).toBe(0);
    expect(etat.corps[0]).toEqual([4, 4]);
  });

  it('refuse le demi-tour, et tourne au glisse', () => {
    const depart = creerSerpent(1);

    expect(jouer(depart, [touche('gauche')], 0).virages).toEqual([]);
    expect(jouer(depart, [touche('bas')], 0).virages).toEqual(['bas']);
    expect(
      jouer(depart, [pointeur('bas', 100, 100), pointeur('deplace', 104, 140)], 0).virages,
    ).toEqual(['bas']);
    expect(
      jouer(depart, [pointeur('bas', 100, 100), pointeur('deplace', 110, 104)], 0).virages,
    ).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// Repousser les Black Ninjas
// --------------------------------------------------------------------------

/** Vise au pointeur le premier Black Ninja debout, la ou il sera quand le shuriken arrivera. */
function viserAuPointeur(etat: EtatEnvahisseurs): readonly CommandeDeGeste[] {
  const rang = etat.debout.indexOf(true);
  if (rang < 0) {
    return [];
  }
  const vol = (LIGNE_DU_NINJA - RAYON_DU_NINJA - etat.rangeeY) / VITESSE_DU_SHURIKEN;
  const x = centreDUnEnvahisseur(etat, rang) + etat.sens * VITESSE_DE_LA_RANGEE * vol;
  return [pointeur('deplace', x, 280)];
}

describe('repousser les Black Ninjas', () => {
  it('ne se gagne pas avant huit lances: le dernier part a la duree minimale', () => {
    expect(PREMIER_TIR_MS + (ENVAHISSEURS - 1) * CADENCE_MS).toBeGreaterThanOrEqual(
      DUREES_MINIMALES_DES_TACHES_MS.envahisseurs,
    );
  });

  it('se gagne au pointeur en visant, au-dessus de la duree minimale', () => {
    const fin = instantDeFin(creerEnvahisseurs(), viserAuPointeur);

    expect(fin).toBeGreaterThanOrEqual(DUREES_MINIMALES_DES_TACHES_MS.envahisseurs);
    expect(fin).toBeLessThan(25_000);
  });

  it('se gagne au clavier', () => {
    const fin = instantDeFin(creerEnvahisseurs(), (etat) => {
      const [visee] = viserAuPointeur(etat);
      if (visee?.type !== 'pointeur') {
        return [touche('gauche', false), touche('droite', false)];
      }
      const ecart = visee.x - etat.ninjaX;
      if (Math.abs(ecart) < 4) {
        return [touche('gauche', false), touche('droite', false)];
      }
      return ecart < 0
        ? [touche('droite', false), touche('gauche')]
        : [touche('gauche', false), touche('droite')];
    });

    expect(fin).toBeLessThan(30_000);
  });

  it('abat un Black Ninja touche, et lance seul', () => {
    const fin = attendre(creerEnvahisseurs(), 0, 6000);

    expect(fin.echos.filter((echo) => echo === 'lancer').length).toBeGreaterThanOrEqual(3);
    expect(fin.echos).toContain('abattu');
    expect(avancementDuGeste(fin).total).toBe(ENVAHISSEURS);
  });

  it('perd quand la rangee touche le sol, puis repart d une rangee neuve', () => {
    const basse = {
      ...appliquerGeste(creerEnvahisseurs(), { type: 'temps' }, 0),
      rangeeY: SOL - RAYON_D_UN_ENVAHISSEUR - 1,
    } as EtatEnvahisseurs;
    // La rangee touche le bord droit, descend d'un cran, et touche le sol.
    const perdue = attendre(basse, 0, 1000);

    expect(perdue.echos).toContain('perdue');
    expect(perdue.perdueJusqua).toBeDefined();
    const neuve = attendre(perdue, 1000, (perdue.perdueJusqua ?? 0) + 20);
    expect(neuve.perdueJusqua).toBeUndefined();
    expect(neuve.debout.every(Boolean)).toBe(true);
    expect(neuve.rangeeY).toBe(DEPART_DE_LA_RANGEE);
  });
});

// --------------------------------------------------------------------------
// Bataille navale
// --------------------------------------------------------------------------

/** Le centre d'une case de la mer, dans l'espace du geste. */
function centreDeCase([colonne, ligne]: Case): { x: number; y: number } {
  return { x: MER.x + (colonne + 0.5) * MER.cote, y: MER.y + (ligne + 0.5) * MER.cote };
}

/**
 * Le joueur methodique: une case sur deux tant qu'il ne touche rien, hors du voisinage des
 * bateaux coules; puis il suit le bateau touche. L'ordre des cases se melange de cette graine.
 */
function caseMethodique(etat: EtatBataille, graine: number): Case | undefined {
  const tiree = (case_: Case): boolean =>
    etat.tirs.some((tir) => tir.case_[0] === case_[0] && tir.case_[1] === case_[1]);
  const dedans = ([c, l]: Case): boolean =>
    c >= 0 && c < COTE_DE_LA_MER && l >= 0 && l < COTE_DE_LA_MER;
  const coules = etat.bateaux.filter((bateau) => bateau.every(tiree));
  const dansUnCoule = (case_: Case): boolean =>
    coules.some((bateau) => bateau.some(([c, l]) => c === case_[0] && l === case_[1]));
  const ouvertes = etat.tirs.filter((tir) => tir.touche && !dansUnCoule(tir.case_));

  if (ouvertes.length > 0) {
    const colonnes = new Set(ouvertes.map((tir) => tir.case_[0]));
    const lignes = new Set(ouvertes.map((tir) => tir.case_[1]));
    const voisines: Case[] =
      ouvertes.length >= 2 && colonnes.size === 1
        ? [
            [ouvertes[0]?.case_[0] ?? 0, Math.min(...lignes) - 1],
            [ouvertes[0]?.case_[0] ?? 0, Math.max(...lignes) + 1],
          ]
        : ouvertes.length >= 2
          ? [
              [Math.min(...colonnes) - 1, ouvertes[0]?.case_[1] ?? 0],
              [Math.max(...colonnes) + 1, ouvertes[0]?.case_[1] ?? 0],
            ]
          : (() => {
              const [c, l] = ouvertes[0]?.case_ ?? [0, 0];
              return [
                [c + 1, l],
                [c - 1, l],
                [c, l + 1],
                [c, l - 1],
              ] as Case[];
            })();
    const suivante = voisines.find((case_) => dedans(case_) && !tiree(case_));
    if (suivante !== undefined) {
      return suivante;
    }
  }

  const pres = (case_: Case): boolean =>
    coules.some((bateau) =>
      bateau.some(([c, l]) => Math.abs(c - case_[0]) <= 1 && Math.abs(l - case_[1]) <= 1),
    );
  const libres: Case[] = [];
  for (let l = 0; l < COTE_DE_LA_MER; l += 1) {
    for (let c = 0; c < COTE_DE_LA_MER; c += 1) {
      if (!tiree([c, l]) && !pres([c, l])) {
        libres.push([c, l]);
      }
    }
  }
  const paires = libres.filter(([c, l]) => (c + l) % 2 === 0);
  const choix = paires.length > 0 ? paires : libres;
  return choix[(graine * 7 + etat.tirs.length * 13) % Math.max(choix.length, 1)];
}

describe('la bataille navale', () => {
  it('cache deux bateaux de trois et deux cases, dans la mer, sans qu ils se touchent', () => {
    for (let graine = 1; graine <= 200; graine += 1) {
      const [grand, petit] = placerLesBateaux(graine);

      expect([grand?.length, petit?.length]).toEqual([...BATEAUX]);
      for (const [c, l] of [...(grand ?? []), ...(petit ?? [])]) {
        expect(c >= 0 && c < COTE_DE_LA_MER && l >= 0 && l < COTE_DE_LA_MER).toBe(true);
      }
      const touchent = (grand ?? []).some(([c, l]) =>
        (petit ?? []).some(([pc, pl]) => Math.abs(pc - c) <= 1 && Math.abs(pl - l) <= 1),
      );
      expect(touchent).toBe(false);
    }
  });

  it('se gagne neuf fois sur dix en vingt tirs, pour un joueur methodique', () => {
    let gagnees = 0;
    const essais = 300;

    for (let graine = 1; graine <= essais; graine += 1) {
      let etat = creerBataille(graine);
      for (let tir = 0; tir < TIRS_PERMIS && !gesteFini(etat, tir * TIR_MS); tir += 1) {
        const case_ = caseMethodique(etat, graine);
        if (case_ === undefined) {
          break;
        }
        const { x, y } = centreDeCase(case_);
        etat = jouer(etat, [pointeur('bas', x, y)], tir * TIR_MS);
      }
      if (gesteFini(etat, TIRS_PERMIS * TIR_MS)) {
        gagnees += 1;
      }
    }

    expect(gagnees / essais).toBeGreaterThanOrEqual(0.88);
  });

  it('attend l animation d un tir, ignore une case deja tiree, et vise au clavier', () => {
    const depart = creerBataille(3);
    const un = jouer(depart, [touche('espace')], 0);

    expect(un.tirs).toHaveLength(1);
    expect(jouer(un, [touche('droite'), touche('espace')], TIR_MS / 2).tirs).toHaveLength(1);
    const deux = jouer(un, [touche('droite'), touche('espace')], TIR_MS);
    expect(deux.tirs).toHaveLength(2);
    expect(deux.tirs[1]?.case_).toEqual([3, 2]);
    expect(jouer(deux, [touche('gauche'), touche('espace')], 2 * TIR_MS).tirs).toHaveLength(2);
  });

  it('perd sans tirs, montre les bateaux, puis tire une mer neuve', () => {
    let etat = creerBataille(8);
    const eau: Case[] = [];
    for (let l = 0; l < COTE_DE_LA_MER; l += 1) {
      for (let c = 0; c < COTE_DE_LA_MER; c += 1) {
        if (!etat.bateaux.some((bateau) => bateau.some(([bc, bl]) => bc === c && bl === l))) {
          eau.push([c, l]);
        }
      }
    }
    for (const [rang, case_] of eau.slice(0, TIRS_PERMIS).entries()) {
      const { x, y } = centreDeCase(case_);
      etat = jouer(etat, [pointeur('bas', x, y)], rang * TIR_MS);
    }
    const fin = TIRS_PERMIS * TIR_MS;

    etat = appliquerGeste(etat, { type: 'temps' }, fin) as EtatBataille;
    expect(etat.echos.at(-1)).toBe('perdue');
    expect(etat.perdueJusqua).toBe(fin + PERTE_DE_LA_BATAILLE_MS);
    etat = appliquerGeste(etat, { type: 'temps' }, fin + PERTE_DE_LA_BATAILLE_MS) as EtatBataille;
    expect(etat.graine).toBe(9);
    expect(etat.tirs).toEqual([]);
  });

  it('n est finie qu une fois l animation du dernier tir jouee', () => {
    let etat = creerBataille(2);
    const cases = etat.bateaux.flat();
    for (const [rang, case_] of cases.entries()) {
      const { x, y } = centreDeCase(case_);
      etat = jouer(etat, [pointeur('bas', x, y)], rang * TIR_MS);
    }
    const dernier = (cases.length - 1) * TIR_MS;

    expect(avancementDuGeste(etat)).toEqual({ faits: 2, total: 2 });
    expect(gesteFini(etat, dernier + TIR_MS - 1)).toBe(false);
    expect(gesteFini(etat, dernier + TIR_MS)).toBe(true);
  });
});
