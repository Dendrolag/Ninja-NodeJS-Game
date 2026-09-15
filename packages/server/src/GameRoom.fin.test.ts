/**
 * Tests du bilan de fin de partie d'une room (etape 3.3).
 *
 * Le bilan est ce que la room retient a cote du moteur pour la fin de partie: la
 * place de chacun, le temps passe en jeu, et les joueurs partis avant la fin. Les
 * gains qui en decoulent sont testes dans packages/shared et dans finDePartie.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { GameRoom } from './GameRoom.js';
import { creerHorlogeManuelle } from './horloge.js';

/** La session d'Alice, compte. */
const ALICE: SessionJoueur = {
  id: 's-alice',
  pseudo: 'Alice',
  compte: { id: 'c-alice', niveau: 2 },
};

/** La session de Bob, invite. */
const BOB: SessionJoueur = { id: 's-bob', pseudo: 'Bob' };

/** La session de Carole, invitee. */
const CAROLE: SessionJoueur = { id: 's-carole', pseudo: 'Carole' };

/** Une room de trente secondes, peu peuplee, a l'horloge manuelle. */
function roomCourte(): GameRoom {
  return new GameRoom({
    id: 'room-1',
    graine: 11,
    horloge: creerHorlogeManuelle(),
    reglages: { dureePartieS: 30, nombreBotsInitial: 10, botsNoirs: { actifs: false } },
  });
}

/** Fait jouer la partie par battements de cinquante millisecondes, jusqu'a ce temps ou sa fin. */
function jouer(room: GameRoom, dureeMs: number): void {
  for (let ecoule = 0; ecoule < dureeMs && room.statut === 'enCours'; ecoule += 50) {
    room.avancer(50);
  }
}

describe('bilan de partie', () => {
  it('classe les presents dans l ordre du classement final, avec leur compte et leur temps', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.accueillir(BOB);
    room.lancer();

    jouer(room, 31_000);

    const classement = room.classement();
    const bilan = room.bilan();

    expect(room.statut).toBe('terminee');
    expect(bilan.nombreJoueurs).toBe(2);
    expect(bilan.dureePartieMs).toBe(30_000);
    expect(bilan.joueurs).toEqual(
      classement.map((ligne, index) => ({
        id: ligne.id,
        pseudo: ligne.pseudo,
        ...(ligne.id === ALICE.id ? { compte: ALICE.compte } : {}),
        placement: index + 1,
        points: ligne.points,
        captures: ligne.captures,
        botsNoirsDetruits: ligne.botsNoirsDetruits,
        tempsJoueMs: 30_000,
        abandon: false,
      })),
    );
  });

  it('ne compte a un joueur entre en cours de partie que le temps qu il y a passe', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.lancer();

    jouer(room, 10_000);
    room.accueillir(BOB);
    jouer(room, 21_000);

    const temps = Object.fromEntries(
      room.bilan().joueurs.map((joueur) => [joueur.pseudo, joueur.tempsJoueMs]),
    );
    expect(temps).toEqual({ Alice: 30_000, Bob: 20_000 });
  });

  it('ne compte pas le temps de pause', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.lancer();

    jouer(room, 10_000);
    room.mettreEnPause();
    jouer(room, 10_000);
    room.reprendre();

    expect(room.bilan().joueurs[0]?.tempsJoueMs).toBe(10_000);
  });

  it('retient un depart pendant la partie comme un abandon, place dernier et sans score', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.accueillir(BOB);
    room.accueillir(CAROLE);
    room.lancer();

    jouer(room, 5000);
    const captures = room.etat.joueurs[ALICE.id]?.captures;
    room.faireSortir(ALICE.id);
    jouer(room, 26_000);

    const bilan = room.bilan();
    const abandon = bilan.joueurs.at(-1);

    expect(bilan.nombreJoueurs).toBe(3);
    expect(bilan.joueurs.map((joueur) => joueur.placement)).toEqual([1, 2, 3]);
    expect(abandon).toEqual({
      pseudo: 'Alice',
      compte: ALICE.compte,
      placement: 3,
      points: 0,
      captures,
      botsNoirsDetruits: 0,
      tempsJoueMs: 0,
      abandon: true,
    });
    expect(abandon !== undefined && 'id' in abandon).toBe(false);
  });

  it('place tous les abandons derniers, a egalite', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.accueillir(BOB);
    room.accueillir(CAROLE);
    room.lancer();

    room.faireSortir(ALICE.id);
    room.faireSortir(BOB.id);

    expect(room.bilan().joueurs.map((joueur) => [joueur.pseudo, joueur.placement])).toEqual([
      ['Carole', 1],
      ['Alice', 3],
      ['Bob', 3],
    ]);
  });

  it('ne compte pas comme abandon un depart du salon, ni un depart apres la fin', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.accueillir(BOB);
    room.accueillir(CAROLE);

    room.faireSortir(CAROLE.id);
    room.lancer();
    jouer(room, 31_000);
    room.faireSortir(BOB.id);

    const bilan = room.bilan();
    expect(bilan.joueurs.map((joueur) => joueur.abandon)).toEqual([false]);
    expect(bilan.nombreJoueurs).toBe(1);
  });

  it('oublie l abandon d un compte qui revient, meme par une autre connexion', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.accueillir(BOB);
    room.lancer();

    room.faireSortir(ALICE.id);
    room.accueillir({ ...ALICE, id: 's-alice-2' });

    const bilan = room.bilan();
    expect(bilan.nombreJoueurs).toBe(2);
    expect(bilan.joueurs.filter((joueur) => joueur.pseudo === 'Alice')).toEqual([
      expect.objectContaining({ id: 's-alice-2', abandon: false }),
    ]);
  });

  it('oublie l abandon d un invite qui revient sous le meme pseudo, et celui-la seulement', () => {
    const room = roomCourte();
    room.accueillir(ALICE);
    room.accueillir(BOB);
    room.accueillir(CAROLE);
    room.lancer();

    room.faireSortir(BOB.id);
    room.faireSortir(CAROLE.id);
    room.accueillir({ id: 's-bob-2', pseudo: 'BOB' });

    expect(
      room
        .bilan()
        .joueurs.filter((joueur) => joueur.abandon)
        .map((joueur) => joueur.pseudo),
    ).toEqual(['Carole']);
  });
});
