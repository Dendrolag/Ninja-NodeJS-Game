/**
 * Tests des pas d'Among Ninjas (etape 7.23): qui fait un pas, et quand. Ce que chacun en
 * entend est l'affaire du serveur (packages/server/src/vues.ts), et se teste la-bas.
 *
 * Aucune version du jeu d'origine n'a ce mode: les attentes sont la fiche
 * docs/plan/etape-7-23.md et les valeurs soumises au porteur du projet le 11 octobre 2026.
 */

import type { Position } from '@neon-ninja/shared';
import { AMONG, CARTES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerCarteCollisions } from './collisions.js';
import type { CarteCollisions } from './collisions.js';
import type { EtatPartie, IdentifiantEntite } from './etat.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';
import type { EtatAmong, JoueurAmong } from './etatAmong.js';
import type { EntreeJoueur, Entrees } from './moteur.js';
import { lancerLaPartie, tick } from './moteur.js';

/** Un battement du serveur: a 150 pixels par seconde, 7,5 pixels de marche. */
const BATTEMENT_MS = 50;

/** Une marche vers l'est. */
const VERS_L_EST: EntreeJoueur = { deplacement: { x: 1, y: 0 }, enMouvement: true };

/** Une partie de cinq joueurs, nommes j1 a j5, au debut de son premier tour. */
function enJeu(terrain?: CarteCollisions): EtatPartie {
  let etat = creerEtatInitial({
    graine: 7,
    mode: 'among',
    reglages: { among: { foule: 0 } },
    ...(terrain === undefined ? {} : { terrain }),
  });

  for (let rang = 1; rang <= 5; rang += 1) {
    etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
  }

  etat = lancerLaPartie(etat);
  const charges: Entrees = Object.fromEntries(
    Object.keys(etat.joueurs).map((id) => [
      id,
      { deplacement: { x: 0, y: 0 }, enMouvement: false, carteChargee: true as const },
    ]),
  );
  etat = tick(etat, charges, BATTEMENT_MS);

  return tick(etat, {}, AMONG.DUREE_REVELATION_MS);
}

function amongDe(etat: EtatPartie): EtatAmong {
  if (etat.among === undefined) {
    throw new Error('La partie devrait etre lancee.');
  }
  return etat.among;
}

/** Pose un joueur a cette place. */
function placer(etat: EtatPartie, id: IdentifiantEntite, position: Position): EtatPartie {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueur, position } } };
}

/** Change ce que le mode retient d'un joueur. */
function changer(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<JoueurAmong>,
): EtatPartie {
  const among = amongDe(etat);
  const joueur = among.joueurs[id] as JoueurAmong;
  return {
    ...etat,
    among: { ...among, joueurs: { ...among.joueurs, [id]: { ...joueur, ...champs } } },
  };
}

/**
 * Fait marcher j1 vers l'est ce nombre de battements, et rend les battements ou il a fait un
 * pas, comptes a partir de un. Le premier battement de jeu ne fait que poser sa marche.
 */
function battementsAvecUnPas(depart: EtatPartie, battements: number): number[] {
  let etat = tick(depart, {}, BATTEMENT_MS);
  const avecUnPas: number[] = [];

  for (let rang = 1; rang <= battements; rang += 1) {
    etat = tick(etat, { j1: VERS_L_EST }, BATTEMENT_MS);

    if (amongDe(etat).pasDuBattement?.includes('j1') === true) {
      avecUnPas.push(rang);
    }
  }

  return avecUnPas;
}

describe('les pas des vivants (etape 7.23)', () => {
  it('font un pas a chaque foulee, et gardent le reste d un battement a l autre', () => {
    // 7,5 pixels par battement, une foulee de 37,5: un pas tous les cinq battements.
    expect(battementsAvecUnPas(enJeu(), 20)).toEqual([5, 10, 15, 20]);
  });

  it('ne valent que pour le battement qui les a faits, et nomment le seul marcheur', () => {
    let etat = tick(enJeu(), {}, BATTEMENT_MS);

    for (let rang = 1; rang <= 5; rang += 1) {
      etat = tick(etat, { j1: VERS_L_EST }, BATTEMENT_MS);
    }

    expect(amongDe(etat).pasDuBattement).toEqual(['j1']);

    etat = tick(etat, { j1: VERS_L_EST }, BATTEMENT_MS);

    expect(amongDe(etat).pasDuBattement).toBeUndefined();
  });

  it('ne se font pas sur place', () => {
    let etat = tick(enJeu(), {}, BATTEMENT_MS);

    for (let rang = 1; rang <= 20; rang += 1) {
      etat = tick(etat, {}, BATTEMENT_MS);
      expect(amongDe(etat).pasDuBattement).toBeUndefined();
    }

    expect(amongDe(etat).joueurs.j1?.foulee?.parcourusPx).toBe(0);
  });

  it('suivent le deplacement reel: rien contre un mur', () => {
    const depart = enJeu();
    const j1 = depart.joueurs.j1?.position as Position;
    // Un mur juste a l'est de j1: il pousse sans avancer.
    const mur = creerCarteCollisions(
      CARTES.map1,
      (x, y) => x >= j1.x + 17 && Math.abs(y - j1.y) < 60,
    );
    const bloque = { ...depart, terrain: mur };

    expect(battementsAvecUnPas(bloque, 20)).toEqual([]);
  });

  it('ne comptent pas un saut: la marche repart de zero', () => {
    let etat = tick(enJeu(), {}, BATTEMENT_MS);

    for (let rang = 1; rang <= 4; rang += 1) {
      etat = tick(etat, { j1: VERS_L_EST }, BATTEMENT_MS);
    }

    expect(amongDe(etat).joueurs.j1?.foulee?.parcourusPx).toBe(30);

    // Replace loin, comme autour du point de reunion: pas de pas, et la marche est perdue.
    const ailleurs = etat.joueurs.j1?.position as Position;
    etat = tick(placer(etat, 'j1', { x: ailleurs.x - 200, y: ailleurs.y }), {}, BATTEMENT_MS);

    expect(amongDe(etat).pasDuBattement).toBeUndefined();
    expect(amongDe(etat).joueurs.j1?.foulee?.parcourusPx).toBe(0);
  });

  it('ne sont pas ceux d un fantome', () => {
    const fantome = changer(enJeu(), 'j1', { fantome: true });

    expect(battementsAvecUnPas(fantome, 20)).toEqual([]);
    expect(amongDe(fantome).joueurs.j1?.foulee).toBeUndefined();
  });

  it('ne se font pas hors de la phase de jeu', () => {
    const etat = tick(enJeu(), {}, BATTEMENT_MS);
    const enReunion: EtatPartie = {
      ...etat,
      among: {
        ...amongDe(etat),
        phase: 'discussion',
        phaseRestanteMs: 10_000,
        pasDuBattement: ['j1'],
      },
    };
    const apres = tick(enReunion, { j1: VERS_L_EST }, BATTEMENT_MS);

    expect(amongDe(apres).phase).toBe('discussion');
    expect(amongDe(apres).pasDuBattement).toBeUndefined();
  });
});
