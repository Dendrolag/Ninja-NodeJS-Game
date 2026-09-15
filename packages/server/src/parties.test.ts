/**
 * Tests des parties de l'etape 2.4, au niveau de la room et du gestionnaire.
 *
 * Mode, visibilite et capacite d'une room; codes d'invitation et liste des parties
 * publiques du gestionnaire; et la projection des deux vers le reseau. Les memes
 * regles sont jouees de bout en bout, a travers de vrais clients Socket.IO, dans
 * ServeurSocket.test.ts.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import { BORNES_CODE_INVITATION, CAPACITES } from '@neon-ninja/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { GameRoom } from './GameRoom.js';
import { creerHorlogeManuelle } from './horloge.js';
import { partiePubliqueDe, salonDe } from './instantane.js';
import { RoomManager } from './RoomManager.js';

/** Une session de joueur, telle que la connexion l'etablit. */
function session(id: string, pseudo: string): SessionJoueur {
  return { id, pseudo };
}

/** Les gestionnaires ouverts par un test, fermes apres lui. */
const gestionnaires: RoomManager[] = [];

afterEach(() => {
  for (const gestionnaire of gestionnaires.splice(0)) {
    gestionnaire.toutFermer();
  }
});

/**
 * Un gestionnaire dont l'horloge, les graines et les codes sont tenus par le test.
 *
 * Les codes sont rendus dans l'ordre donne; le dernier se repete ensuite.
 */
function gestionnaire(codes: readonly string[] = ['AAAAAA']): RoomManager {
  let rang = 0;

  const cree = new RoomManager({
    horloge: creerHorlogeManuelle(),
    genererGraine: () => 7,
    tirerCode: () => {
      const code = codes[Math.min(rang, codes.length - 1)] ?? 'AAAAAA';
      rang += 1;

      return code;
    },
  });

  gestionnaires.push(cree);

  return cree;
}

/** Remplit une room jusqu'a sa capacite. */
function remplir(room: GameRoom): void {
  for (let rang = 0; rang < room.capacite; rang += 1) {
    room.accueillir(session(`joueur-${String(rang)}`, `Joueur ${String(rang)}`));
  }
}

describe('GameRoom: mode, visibilite et capacite', () => {
  it('est classique et publique, sans code, quand la creation n en dit rien', () => {
    const room = new GameRoom({ id: 'room-test', graine: 1, horloge: creerHorlogeManuelle() });

    expect(room.mode).toBe('classique');
    expect(room.visibilite).toBe('publique');
    expect(room.code).toBeUndefined();
    expect(room.capacite).toBe(CAPACITES.classique);
    expect(room.etat.mode).toBe('classique');
  });

  it('refuse le joueur de trop, et l accueille des qu une place se libere', () => {
    const room = new GameRoom({ id: 'room-test', graine: 1, horloge: creerHorlogeManuelle() });
    remplir(room);

    expect(room.estPleine).toBe(true);
    expect(room.accueillir(session('tard', 'Retardataire'))).toEqual({
      valide: false,
      erreurs: [{ champ: 'partie', motif: 'Cette partie est complète.' }],
    });

    room.faireSortir('joueur-0');

    expect(room.accueillir(session('tard', 'Retardataire')).valide).toBe(true);
  });

  it('garde son mode quand l hote change les reglages', () => {
    const room = new GameRoom({ id: 'room-test', graine: 1, horloge: creerHorlogeManuelle() });
    room.accueillir(session('alice', 'Alice'));

    room.changerReglages({ carte: 'map3' });

    expect(room.etat.mode).toBe('classique');
    expect(room.etat.reglages.carte).toBe('map3');
  });
});

describe('RoomManager: codes d invitation', () => {
  it('donne un code a une partie privee, aucun a une partie publique', () => {
    const rooms = gestionnaire(['NX7K2P']);

    const privee = rooms.creer({ visibilite: 'privee' });
    const publique = rooms.creer();

    expect(privee.code).toBe('NX7K2P');
    expect(publique.code).toBeUndefined();
    expect(rooms.parCode('NX7K2P')).toBe(privee);
    expect(rooms.parCode('ZZZZZZ')).toBeUndefined();
  });

  it('tire un autre code quand celui-ci est deja pris', () => {
    const rooms = gestionnaire(['AAAAAA', 'AAAAAA', 'BBBBBB']);

    const premiere = rooms.creer({ visibilite: 'privee' });
    const seconde = rooms.creer({ visibilite: 'privee' });

    expect(premiere.code).toBe('AAAAAA');
    expect(seconde.code).toBe('BBBBBB');
  });

  it('libere le code d une partie detruite', () => {
    const rooms = gestionnaire(['AAAAAA']);

    const ancienne = rooms.creer({ visibilite: 'privee' });
    rooms.detruire(ancienne.id);
    const nouvelle = rooms.creer({ visibilite: 'privee' });

    expect(nouvelle.code).toBe('AAAAAA');
    expect(rooms.parCode('AAAAAA')).toBe(nouvelle);
  });

  it('renonce avec une erreur franche quand le tirage ne rend que des codes pris', () => {
    const rooms = gestionnaire(['AAAAAA']);
    rooms.creer({ visibilite: 'privee' });

    expect(() => rooms.creer({ visibilite: 'privee' })).toThrow(/tirage des codes est defaillant/u);
  });

  it('tire par defaut des codes de la forme attendue, jamais deux fois le meme', () => {
    const rooms = new RoomManager({ horloge: creerHorlogeManuelle() });
    gestionnaires.push(rooms);

    const codes = Array.from({ length: 30 }, () => rooms.creer({ visibilite: 'privee' }).code);

    for (const code of codes) {
      expect(code).toMatch(BORNES_CODE_INVITATION.forme);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('RoomManager: les parties publiques ouvertes', () => {
  it('ne liste que les parties publiques, encore dans leur salon, et pas pleines', () => {
    const rooms = gestionnaire();

    const ouverte = rooms.creer();
    rooms.creer({ visibilite: 'privee' });

    const lancee = rooms.creer();
    lancee.accueillir(session('alice', 'Alice'));
    lancee.lancer();

    const pleine = rooms.creer();
    remplir(pleine);

    expect(rooms.partiesPubliquesOuvertes()).toEqual([ouverte]);
  });

  it('les rend de la plus ancienne a la plus recente', () => {
    const rooms = gestionnaire();

    const premiere = rooms.creer();
    const seconde = rooms.creer();

    expect(rooms.partiesPubliquesOuvertes()).toEqual([premiere, seconde]);
  });
});

describe('projection du salon et de la liste vers le reseau', () => {
  it('met le code dans le salon d une partie privee, et seulement la', () => {
    const rooms = gestionnaire(['NX7K2P']);

    const privee = rooms.creer({ visibilite: 'privee' });
    privee.accueillir(session('alice', 'Alice'));
    const publique = rooms.creer();
    publique.accueillir(session('bob', 'Bob'));

    expect(salonDe(privee)).toMatchObject({
      mode: 'classique',
      visibilite: 'privee',
      code: 'NX7K2P',
      capacite: CAPACITES.classique,
    });
    expect(salonDe(publique)).toMatchObject({
      visibilite: 'publique',
      capacite: CAPACITES.classique,
    });
    expect(salonDe(publique)).not.toHaveProperty('code');
  });

  it('decrit une partie publique par son hote, sa carte et ses places, sans code', () => {
    const rooms = gestionnaire();

    const room = rooms.creer({ reglages: { carte: 'map3', modeMiroir: true } });
    room.accueillir(session('alice', 'Alice'));
    room.accueillir(session('bob', 'Bob'));

    expect(partiePubliqueDe(room)).toEqual({
      idRoom: room.id,
      hote: 'Alice',
      mode: 'classique',
      carte: 'map3',
      modeMiroir: true,
      joueurs: 2,
      capacite: CAPACITES.classique,
    });
  });
});
