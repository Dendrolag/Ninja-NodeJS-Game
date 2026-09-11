/**
 * Tests de la fin de partie vue des comptes (etape 3.3): ce qui s'enregistre, et
 * le recapitulatif envoye a chaque compte.
 *
 * Les gains sont compares a recompensesDePartie, et non ecrits en dur: les valeurs
 * elles-memes sont figees par les tests de packages/shared. Ce qui est verifie ici,
 * c'est que la bonne place, le bon temps et le bon compte leur sont donnes.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import { recompensesDePartie } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { NouveauResultat } from './base/parties.js';
import { finPourLesComptes, progressionEnregistree } from './finDePartie.js';
import { GameRoom } from './GameRoom.js';
import { creerHorlogeManuelle } from './horloge.js';

const ALICE: SessionJoueur = {
  id: 's-alice',
  pseudo: 'Alice',
  compte: { id: 'c-alice', niveau: 1 },
};
const BOB: SessionJoueur = { id: 's-bob', pseudo: 'Bob' };

/** Une room de trente secondes, lancee, avec ces joueurs. */
function roomLancee(...sessions: readonly SessionJoueur[]): GameRoom {
  const room = new GameRoom({
    id: 'room-1',
    graine: 5,
    horloge: creerHorlogeManuelle(),
    reglages: { carte: 'map2', modeMiroir: true, dureePartieS: 30, nombreBotsInitial: 10 },
  });

  for (const session of sessions) {
    room.accueillir(session);
  }

  room.lancer();
  return room;
}

/** Fait jouer la partie par battements de cinquante millisecondes, jusqu'a ce temps ou sa fin. */
function jouer(room: GameRoom, dureeMs: number): void {
  for (let ecoule = 0; ecoule < dureeMs && room.statut === 'enCours'; ecoule += 50) {
    room.avancer(50);
  }
}

describe('finPourLesComptes', () => {
  it('decrit la partie telle que jouee, invites compris dans le nombre de joueurs', () => {
    const room = roomLancee(ALICE, BOB);
    jouer(room, 31_000);

    expect(finPourLesComptes(room).partie).toEqual({
      mode: 'classique',
      carte: 'map2',
      modeMiroir: true,
      dureeS: 30,
      nombreJoueurs: 2,
    });
  });

  it('ne rend un resultat qu aux comptes, avec les gains de leur place', () => {
    const room = roomLancee(ALICE, BOB);
    jouer(room, 31_000);

    const alice = room.bilan().joueurs.find((joueur) => joueur.pseudo === 'Alice');
    const gains = recompensesDePartie({
      placement: alice?.placement ?? 0,
      nombreJoueurs: 2,
      tempsJoueMs: 30_000,
      dureePartieMs: 30_000,
      abandon: false,
    });
    const fin = finPourLesComptes(room);

    expect(fin.resultats).toEqual([
      {
        compteId: 'c-alice',
        placement: alice?.placement,
        points: alice?.points,
        captures: alice?.captures,
        botsNoirsDetruits: alice?.botsNoirsDetruits,
        xpGagnee: gains.xp,
        piecesGagnees: gains.pieces,
        variationPointsLigue: gains.variationPointsLigue,
      },
    ]);
    expect(gains.xp).toBeGreaterThan(0);
    expect([...fin.connexions]).toEqual([['c-alice', 's-alice']]);
  });

  it('enregistre l abandon d un compte, sans connexion a prevenir', () => {
    const room = roomLancee(ALICE, BOB);
    jouer(room, 10_000);
    room.faireSortir(ALICE.id);
    jouer(room, 21_000);

    const fin = finPourLesComptes(room);

    expect(fin.resultats).toEqual([
      expect.objectContaining({
        compteId: 'c-alice',
        placement: 2,
        points: 0,
        xpGagnee: 0,
        piecesGagnees: 0,
      }),
    ]);
    expect(fin.connexions.size).toBe(0);
  });

  it('ne rend aucun resultat pour une partie jouee par des invites', () => {
    const room = roomLancee(BOB);
    jouer(room, 31_000);

    const fin = finPourLesComptes(room);

    expect(fin.resultats).toEqual([]);
    expect(fin.connexions.size).toBe(0);
  });
});

describe('progressionEnregistree', () => {
  /** Un resultat de premier sur trois, qui demandait +20 points de ligue. */
  const RESULTAT: NouveauResultat = {
    compteId: 'c-alice',
    placement: 1,
    points: 30,
    captures: 1,
    botsNoirsDetruits: 0,
    xpGagnee: 150,
    piecesGagnees: 15,
    variationPointsLigue: 20,
  };

  it('rend les gains appliques, avec le niveau et le palier deduits avant et apres', () => {
    expect(
      progressionEnregistree(RESULTAT, 3, {
        compteId: 'c-alice',
        avant: { xpTotale: 90, pieces: 5, pointsLigue: 95 },
        apres: { xpTotale: 240, pieces: 20, pointsLigue: 115 },
      }),
    ).toEqual({
      enregistree: true,
      placement: 1,
      nombreJoueurs: 3,
      xpGagnee: 150,
      piecesGagnees: 15,
      variationPointsLigue: 20,
      avant: { xpTotale: 90, niveau: 1, pieces: 5, pointsLigue: 95, palier: 'bronze' },
      apres: { xpTotale: 240, niveau: 2, pieces: 20, pointsLigue: 115, palier: 'argent' },
    });
  });

  it('rend la perte de points reellement appliquee, pas celle qui etait demandee', () => {
    const recapitulatif = progressionEnregistree(
      { ...RESULTAT, placement: 3, xpGagnee: 30, piecesGagnees: 3, variationPointsLigue: -10 },
      3,
      {
        compteId: 'c-alice',
        avant: { xpTotale: 0, pieces: 0, pointsLigue: 3 },
        apres: { xpTotale: 30, pieces: 3, pointsLigue: 0 },
      },
    );

    expect(recapitulatif.variationPointsLigue).toBe(-3);
    expect(recapitulatif.apres.pointsLigue).toBe(0);
  });
});
