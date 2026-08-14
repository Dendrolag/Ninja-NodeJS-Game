/**
 * Tests du score et du classement.
 *
 * La reference de comportement est tests/caracterisation/score.test.ts, qui
 * s'execute contre le legacy. Le point capital, repris de la caracterisation:
 * le score est un stock, pas un cumul. Se faire capturer le ramene a zero, aux
 * points de bots noirs pres.
 */

import { COULEUR_BOT_NEUTRE, SCORE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { capturerJoueur } from './capture.js';
import type { Couleur } from './couleurs.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';
import { calculerScores } from './score.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
const VERT = '#00FF00';

/** Change quelques champs d'un joueur, pour poser une situation de depart. */
function reglerJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<Joueur>,
): EtatPartie {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }

  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueur, ...champs } } };
}

/** Ajoute une serie de bots d'une meme couleur, alignes pour rester lisibles. */
function ajouterBots(
  etat: EtatPartie,
  prefixe: string,
  couleur: Couleur,
  nombre: number,
): EtatPartie {
  let courant = etat;
  for (let index = 0; index < nombre; index += 1) {
    courant = ajouterBot(courant, {
      id: `${prefixe}${index}`,
      couleur,
      position: { x: 100 + index * 30, y: 100 },
    });
  }
  return courant;
}

/** Reduit le classement a ce qui se lit a l'ecran: le pseudo et le score. */
function classement(etat: EtatPartie): Array<{ pseudo: string; points: number }> {
  return calculerScores(etat).map((ligne) => ({ pseudo: ligne.pseudo, points: ligne.points }));
}

/** Une partie avec les joueurs demandes, places au large et prets a capturer. */
function partieAvec(joueurs: readonly (readonly [string, string, Couleur])[]): EtatPartie {
  let etat = creerEtatInitial({ graine: 3 });

  for (const [index, [id, pseudo, couleur]] of joueurs.entries()) {
    etat = ajouterJoueur(etat, {
      id,
      pseudo,
      couleur,
      position: { x: 500 + index * 5, y: 500 },
    });
    etat = reglerJoueur(etat, id, { protectionSpawnRestanteMs: 0 });
  }

  return etat;
}

describe('calcul du score', () => {
  it('compte les bots portant la couleur du joueur a l instant present', () => {
    let etat = partieAvec([['a', 'Alice', ROUGE]]);
    etat = ajouterBots(etat, 'r', ROUGE, 4);
    etat = ajouterBots(etat, 'b', BLEU, 7);

    expect(classement(etat)).toEqual([{ pseudo: 'Alice', points: 4 }]);
  });

  it('ajoute quinze points par bot noir detruit', () => {
    let etat = partieAvec([['a', 'Alice', ROUGE]]);
    etat = ajouterBots(etat, 'r', ROUGE, 2);
    etat = reglerJoueur(etat, 'a', { botsNoirsDetruits: 3 });

    expect(classement(etat)).toEqual([
      { pseudo: 'Alice', points: 2 + 3 * SCORE.POINTS_PAR_BOT_NOIR },
    ]);
  });

  it('donne zero a un joueur qui ne controle aucun bot', () => {
    let etat = partieAvec([['a', 'Alice', ROUGE]]);
    etat = ajouterBots(etat, 'b', BLEU, 5);

    expect(classement(etat)).toEqual([{ pseudo: 'Alice', points: 0 }]);
  });

  it('ne compte les bots neutres pour personne', () => {
    let etat = partieAvec([['a', 'Alice', ROUGE]]);
    etat = ajouterBots(etat, 'r', ROUGE, 2);
    etat = ajouterBots(etat, 'w', COULEUR_BOT_NEUTRE, 6);

    expect(classement(etat)).toEqual([{ pseudo: 'Alice', points: 2 }]);
  });

  it('ne compte pas les bots noirs, meme si un joueur porte le noir', () => {
    let etat = partieAvec([['a', 'Alice', '#000000']]);
    etat = ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 900, y: 900 } });

    expect(classement(etat)).toEqual([{ pseudo: 'Alice', points: 0 }]);
  });

  it('separe le stock du cumul: bots portes contre bots gagnes au total', () => {
    let etat = partieAvec([['a', 'Alice', ROUGE]]);
    etat = ajouterBots(etat, 'r', ROUGE, 3);
    etat = reglerJoueur(etat, 'a', { botsGagnesAuTotal: 12 });

    const ligne = calculerScores(etat)[0];
    expect(ligne?.botsPortes).toBe(3);
    expect(ligne?.botsGagnesAuTotal).toBe(12);
  });

  it('detaille les deux parts du score', () => {
    let etat = partieAvec([['a', 'Alice', ROUGE]]);
    etat = ajouterBots(etat, 'r', ROUGE, 6);
    etat = reglerJoueur(etat, 'a', { botsNoirsDetruits: 2 });

    const ligne = calculerScores(etat)[0];
    expect(ligne?.botsPortes).toBe(6);
    expect(ligne?.pointsBotsNoirs).toBe(30);
    expect(ligne?.points).toBe(36);
  });

  it('ne modifie pas l etat', () => {
    let etat = partieAvec([['a', 'Alice', ROUGE]]);
    etat = ajouterBots(etat, 'r', ROUGE, 3);
    const copie = structuredClone({ joueurs: etat.joueurs, bots: etat.bots });

    calculerScores(etat);

    expect({ joueurs: etat.joueurs, bots: etat.bots }).toEqual(copie);
  });
});

describe('classement', () => {
  it('trie par score decroissant', () => {
    let etat = partieAvec([
      ['a', 'Alice', ROUGE],
      ['b', 'Bob', BLEU],
      ['c', 'Chloe', VERT],
    ]);
    etat = ajouterBots(etat, 'r', ROUGE, 2);
    etat = ajouterBots(etat, 'b', BLEU, 9);
    etat = ajouterBots(etat, 'v', VERT, 5);

    expect(classement(etat)).toEqual([
      { pseudo: 'Bob', points: 9 },
      { pseudo: 'Chloe', points: 5 },
      { pseudo: 'Alice', points: 2 },
    ]);
  });

  it('departage deux scores egaux par le nombre de captures', () => {
    let etat = partieAvec([
      ['a', 'Alice', ROUGE],
      ['b', 'Bob', BLEU],
    ]);
    etat = ajouterBots(etat, 'r', ROUGE, 4);
    etat = ajouterBots(etat, 'b', BLEU, 4);
    etat = reglerJoueur(etat, 'a', { captures: 1 });
    etat = reglerJoueur(etat, 'b', { captures: 3 });

    expect(classement(etat)).toEqual([
      { pseudo: 'Bob', points: 4 },
      { pseudo: 'Alice', points: 4 },
    ]);
  });

  it('conserve l ordre d arrivee quand score et captures sont identiques', () => {
    // Cas limite: il n'y a pas de troisieme critere. Le tri de JavaScript etant
    // stable, l'ordre d'arrivee dans la partie fait office de departage. C'est
    // deja ce que faisait le legacy.
    let etat = partieAvec([
      ['a', 'Alice', ROUGE],
      ['b', 'Bob', BLEU],
    ]);
    etat = ajouterBots(etat, 'r', ROUGE, 3);
    etat = ajouterBots(etat, 'b', BLEU, 3);

    expect(classement(etat)).toEqual([
      { pseudo: 'Alice', points: 3 },
      { pseudo: 'Bob', points: 3 },
    ]);
  });
});

describe('le score est un stock, pas un cumul', () => {
  it('retombe a zero pour le joueur capture', () => {
    let etat = partieAvec([
      ['a', 'Alice', ROUGE],
      ['b', 'Bob', BLEU],
    ]);
    etat = ajouterBots(etat, 'r', ROUGE, 1);
    etat = ajouterBots(etat, 'b', BLEU, 8);

    expect(classement(etat)).toEqual([
      { pseudo: 'Bob', points: 8 },
      { pseudo: 'Alice', points: 1 },
    ]);

    const apres = capturerJoueur(etat, 'a', 'b');

    // Les huit bots de Bob passent a Alice. Bob repart de zero, et son cumul
    // personnel n'y change rien.
    expect(classement(apres)).toEqual([
      { pseudo: 'Alice', points: 9 },
      { pseudo: 'Bob', points: 0 },
    ]);
    expect(calculerScores(apres).find((ligne) => ligne.pseudo === 'Bob')?.capturesSubies).toEqual({
      a: { pseudo: 'Alice', nombre: 1 },
    });
  });

  it('ne redescend pas en dessous des points acquis sur les bots noirs', () => {
    let etat = partieAvec([
      ['a', 'Alice', ROUGE],
      ['b', 'Bob', BLEU],
    ]);
    etat = ajouterBots(etat, 'b', BLEU, 4);
    etat = reglerJoueur(etat, 'b', { botsNoirsDetruits: 2 });

    const apres = capturerJoueur(etat, 'a', 'b');

    // Bob perd ses quatre bots mais conserve ses trente points de bots noirs.
    expect(classement(apres)).toEqual([
      { pseudo: 'Bob', points: 30 },
      { pseudo: 'Alice', points: 4 },
    ]);
  });

  it('suit la couleur, pas le joueur: la victime ne recupere rien en changeant de couleur', () => {
    let etat = partieAvec([
      ['a', 'Alice', ROUGE],
      ['b', 'Bob', BLEU],
    ]);
    etat = ajouterBots(etat, 'b', BLEU, 5);

    const apres = capturerJoueur(etat, 'a', 'b');
    const bob = apres.joueurs['b'];

    expect(bob?.couleur).not.toBe(BLEU);
    expect(Object.values(apres.bots).filter((bot) => bot.couleur === bob?.couleur)).toEqual([]);
  });
});
