/**
 * Caracterisation du domaine SCORE.
 *
 * Perimetre, repris de la fiche docs/plan/etape-0-2.md:
 *   - calculatePlayerScores (legacy/server.js:1766): classement produit sur un
 *     etat donne, retour a zero apres capture, departage a egalite.
 *
 * Le point le plus important du domaine est le premier de la liste des
 * comportements a preserver de CLAUDE.md: le score est un stock, pas un cumul.
 * Il vaut le nombre de bots portant la couleur du joueur a l'instant present.
 * Se faire capturer le remet donc a zero, et c'est ce qui fait la tension de fin
 * de partie.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Harnais } from './harnais/charger-legacy.js';
import { creerHarnais } from './harnais/charger-legacy.js';
import { sortirDeLaProtectionDeSpawn } from './harnais/scenario.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
const VERT = '#00FF00';
const BLANC = '#FFFFFF';

let harnais: Harnais;

beforeEach(() => {
  harnais = creerHarnais({ horlogeInitiale: 1_000_000 });
});

/** Ajoute une serie de bots d'une meme couleur, alignes pour rester lisibles. */
function ajouterBots(prefixe: string, couleur: string, nombre: number): void {
  for (let index = 0; index < nombre; index++) {
    harnais.ajouterBot(`${prefixe}${index}`, couleur, 100 * index, 100);
  }
}

/** Reduit le classement a ce qui se lit a l'ecran: le rang, le pseudo, le score. */
function classement(): Array<{ pseudo: string; points: number }> {
  return harnais
    .calculatePlayerScores()
    .map((ligne) => ({ pseudo: ligne.nickname, points: ligne.currentBots }));
}

describe('calcul du score', () => {
  it('compte les bots portant la couleur du joueur a l instant present', () => {
    harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    ajouterBots('r', ROUGE, 4);
    ajouterBots('b', BLEU, 7);

    expect(classement()).toEqual([{ pseudo: 'Alice', points: 4 }]);
  });

  it('ajoute quinze points par bot noir detruit', () => {
    const joueur = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    ajouterBots('r', ROUGE, 2);
    joueur.blackBotsDestroyed = 3;

    expect(classement()).toEqual([{ pseudo: 'Alice', points: 2 + 45 }]);
  });

  it('donne zero a un joueur qui ne controle aucun bot', () => {
    harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    ajouterBots('b', BLEU, 5);

    expect(classement()).toEqual([{ pseudo: 'Alice', points: 0 }]);
  });

  it('ne compte les bots blancs pour personne', () => {
    harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    ajouterBots('r', ROUGE, 2);
    ajouterBots('w', BLANC, 6);

    expect(classement()).toEqual([{ pseudo: 'Alice', points: 2 }]);
  });

  it('distingue le stock du cumul: currentBots contre totalBotsControlled', () => {
    const joueur = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    ajouterBots('r', ROUGE, 3);
    joueur.totalBotsCaptures = 12;

    const ligne = harnais.calculatePlayerScores()[0];
    expect(ligne?.currentBots).toBe(3);
    expect(ligne?.totalBotsControlled).toBe(12);
  });
});

describe('classement', () => {
  it('trie par score decroissant', () => {
    harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    harnais.ajouterJoueur('b', 'Bob', { couleur: BLEU });
    harnais.ajouterJoueur('c', 'Chloe', { couleur: VERT });
    ajouterBots('r', ROUGE, 2);
    ajouterBots('b', BLEU, 9);
    ajouterBots('v', VERT, 5);

    expect(classement()).toEqual([
      { pseudo: 'Bob', points: 9 },
      { pseudo: 'Chloe', points: 5 },
      { pseudo: 'Alice', points: 2 },
    ]);
  });

  it('departage deux scores egaux par le nombre de captures', () => {
    const alice = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    const bob = harnais.ajouterJoueur('b', 'Bob', { couleur: BLEU });
    ajouterBots('r', ROUGE, 4);
    ajouterBots('b', BLEU, 4);
    alice.captures = 1;
    bob.captures = 3;

    expect(classement()).toEqual([
      { pseudo: 'Bob', points: 4 },
      { pseudo: 'Alice', points: 4 },
    ]);
  });

  it('conserve l ordre d arrivee quand score et captures sont identiques', () => {
    // Cas limite: le legacy n'a pas de troisieme critere. Le tri de JavaScript
    // etant stable, l'ordre d'insertion dans players fait office de departage.
    harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    harnais.ajouterJoueur('b', 'Bob', { couleur: BLEU });
    ajouterBots('r', ROUGE, 3);
    ajouterBots('b', BLEU, 3);

    expect(classement()).toEqual([
      { pseudo: 'Alice', points: 3 },
      { pseudo: 'Bob', points: 3 },
    ]);
  });

  it('produit l instantane de reference du classement complet', () => {
    const alice = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE });
    const bob = harnais.ajouterJoueur('b', 'Bob', { couleur: BLEU });
    ajouterBots('r', ROUGE, 6);
    ajouterBots('b', BLEU, 6);
    alice.captures = 2;
    alice.totalBotsCaptures = 11;
    alice.capturedPlayers = { b: { nickname: 'Bob', count: 2 } };
    bob.capturedBy = { a: { nickname: 'Alice', count: 2 } };
    bob.blackBotsDestroyed = 1;
    bob.capturedByBlackBot = 3;

    expect(harnais.calculatePlayerScores()).toMatchSnapshot();
  });
});

describe('le score est un stock, pas un cumul', () => {
  it('retombe a zero pour le joueur capture', () => {
    const alice = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
    const bob = harnais.ajouterJoueur('b', 'Bob', { couleur: BLEU, x: 505, y: 500 });
    ajouterBots('r', ROUGE, 1);
    ajouterBots('b', BLEU, 8);
    sortirDeLaProtectionDeSpawn(harnais);

    expect(classement()).toEqual([
      { pseudo: 'Bob', points: 8 },
      { pseudo: 'Alice', points: 1 },
    ]);

    harnais.handlePlayerCapture(alice, bob);

    // Les huit bots de Bob passent a Alice. Bob repart de zero, et son cumul
    // personnel n'y change rien.
    expect(classement()).toEqual([
      { pseudo: 'Alice', points: 9 },
      { pseudo: 'Bob', points: 0 },
    ]);
  });

  it('retombe partiellement apres une capture par un bot noir', () => {
    const alice = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
    ajouterBots('r', ROUGE, 9);
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);
    sortirDeLaProtectionDeSpawn(harnais);

    botNoir.captureEntity(alice);

    // Neuf bots, moitie arrondie a l'inferieur: quatre perdus, cinq conserves.
    expect(classement()).toEqual([{ pseudo: 'Alice', points: 5 }]);
  });

  it('ne redescend pas en dessous des points acquis sur les bots noirs', () => {
    const alice = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
    const bob = harnais.ajouterJoueur('b', 'Bob', { couleur: BLEU, x: 505, y: 500 });
    ajouterBots('b', BLEU, 4);
    bob.blackBotsDestroyed = 2;
    sortirDeLaProtectionDeSpawn(harnais);

    harnais.handlePlayerCapture(alice, bob);

    // Bob perd ses quatre bots mais conserve ses trente points de bots noirs.
    expect(classement()).toEqual([
      { pseudo: 'Bob', points: 30 },
      { pseudo: 'Alice', points: 4 },
    ]);
  });
});
