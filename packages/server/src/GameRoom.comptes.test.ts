/**
 * Tests des comptes des membres d'une room, et de leur projection dans le salon
 * (etape 3.2).
 *
 * Le moteur ne connait pas les comptes: c'est la room qui retient lequel de ses
 * membres en a un, et la projection qui decide ce qui en part sur le reseau.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { GameRoom } from './GameRoom.js';
import { creerHorlogeManuelle } from './horloge.js';
import { joueurDuSalon, salonDe } from './instantane.js';

/** Une room neuve, a l'horloge manuelle. */
function roomNeuve(): GameRoom {
  return new GameRoom({ id: 'room-1', graine: 7, horloge: creerHorlogeManuelle() });
}

/** La session d'Alice, compte de niveau 4. */
const ALICE: SessionJoueur = {
  id: 's-alice',
  pseudo: 'Alice',
  compte: { id: 'c-alice', niveau: 4 },
};

/** La session de Bob, invite. */
const BOB: SessionJoueur = { id: 's-bob', pseudo: 'Bob' };

describe('GameRoom, comptes des membres', () => {
  it('retient le compte d un membre, et aucun pour un invite', () => {
    const room = roomNeuve();

    const alice = room.accueillir(ALICE);
    room.accueillir(BOB);

    expect(alice).toEqual({
      valide: true,
      valeur: { id: 's-alice', pseudo: 'Alice', hote: true, compte: { id: 'c-alice', niveau: 4 } },
    });
    expect(room.joueurs).toEqual([
      { id: 's-alice', pseudo: 'Alice', hote: true, compte: { id: 'c-alice', niveau: 4 } },
      { id: 's-bob', pseudo: 'Bob', hote: false },
    ]);
    expect('compte' in (room.joueurs[1] ?? {})).toBe(false);
  });

  it('oublie le compte d un membre qui sort', () => {
    const room = roomNeuve();
    room.accueillir(ALICE);

    room.faireSortir('s-alice');
    room.accueillir({ id: 's-alice', pseudo: 'Alice' });

    expect(room.joueurs).toEqual([{ id: 's-alice', pseudo: 'Alice', hote: true }]);
  });

  it('garde les comptes quand l hote change les reglages', () => {
    const room = roomNeuve();
    room.accueillir(BOB);
    room.accueillir(ALICE);

    room.changerReglages({ dureePartieS: 120 });

    expect(room.joueurs.map((joueur) => joueur.compte)).toEqual([
      undefined,
      { id: 'c-alice', niveau: 4 },
    ]);
  });
});

describe('le salon, comptes et invites', () => {
  it('montre le niveau d un compte, et jamais l identifiant du compte', () => {
    const room = roomNeuve();
    room.accueillir(ALICE);
    room.accueillir(BOB);

    const salon = salonDe(room);

    expect(salon.joueurs).toEqual([
      { id: 's-alice', pseudo: 'Alice', hote: true, compte: { niveau: 4 } },
      { id: 's-bob', pseudo: 'Bob', hote: false },
    ]);
    expect(JSON.stringify(salon)).not.toContain('c-alice');
  });

  it('ne donne aucun champ compte a un invite', () => {
    expect('compte' in joueurDuSalon({ id: 's-bob', pseudo: 'Bob', hote: false })).toBe(false);
  });
});
