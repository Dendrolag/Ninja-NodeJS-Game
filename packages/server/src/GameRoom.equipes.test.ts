/**
 * Tests de la GameRoom d'une partie Equipes (etape 7.2): le choix des equipes au salon,
 * la condition de lancement, l'entree en cours de partie et le bilan.
 *
 * Les regles du classement des equipes, des places et des points sont testees dans
 * packages/shared (equipes.test.ts). Ce qui est verifie ici, c'est que la room les
 * applique aux bons joueurs, et que la couleur de chacun dit toujours son equipe.
 */

import type { Equipe, SessionJoueur } from '@neon-ninja/shared';
import {
  COULEURS_DES_EQUIPES,
  classementDesEquipes,
  equipeDeCouleur,
  placeDansLesEquipes,
  pointsEnEquipe,
  recompensesDePartie,
} from '@neon-ninja/shared';
import type { LigneScore } from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import { finPourLesComptes } from './finDePartie.js';
import { GameRoom } from './GameRoom.js';
import { creerHorlogeManuelle } from './horloge.js';

/** Un invite. */
function invite(pseudo: string): SessionJoueur {
  return { id: `s-${pseudo}`, pseudo };
}

/** Un joueur connecte a son compte. */
function compte(pseudo: string): SessionJoueur {
  return { id: `s-${pseudo}`, pseudo, compte: { id: `c-${pseudo}`, niveau: 1 } };
}

/** Une room de trente secondes, a l'horloge manuelle. */
function roomDuMode(mode: 'equipes' | 'classique' = 'equipes'): GameRoom {
  return new GameRoom({
    id: 'room-equipes',
    graine: 7,
    mode,
    horloge: creerHorlogeManuelle(),
    reglages: { dureePartieS: 30, nombreBotsInitial: 20 },
  });
}

/** Fait entrer ces joueurs, dans l'ordre, et echoue si l'un d'eux est refuse. */
function avecLesJoueurs(room: GameRoom, ...sessions: readonly SessionJoueur[]): GameRoom {
  for (const session of sessions) {
    if (!room.accueillir(session).valide) {
      throw new Error(`${session.pseudo} aurait du entrer.`);
    }
  }

  return room;
}

/** L'equipe de chaque membre, par pseudo. */
function equipesDe(room: GameRoom): Record<string, Equipe | undefined> {
  return Object.fromEntries(room.joueurs.map((joueur) => [joueur.pseudo, joueur.equipe]));
}

/** Fait jouer la partie par battements de cinquante millisecondes, jusqu'a ce temps ou sa fin. */
function jouer(room: GameRoom, dureeMs: number): void {
  for (let ecoule = 0; ecoule < dureeMs && room.statut === 'enCours'; ecoule += 50) {
    room.avancer(50);
  }
}

/** La ligne de classement d'un joueur, dont on sait qu'il est present. */
function ligneDe(room: GameRoom, id: string): LigneScore {
  const ligne = room.classement().find((candidate) => candidate.id === id);
  if (ligne === undefined) {
    throw new Error(`Le joueur ${id} devrait etre classe.`);
  }
  return ligne;
}

describe('le salon d une partie Equipes', () => {
  it('place chaque arrivant dans l equipe la moins nombreuse, Cyan a nombre egal', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'), invite('C'), invite('D'));

    expect(equipesDe(room)).toEqual({ A: 'cyan', B: 'magenta', C: 'cyan', D: 'magenta' });
  });

  it('fait porter a chaque membre la couleur de son equipe', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'));

    for (const membre of room.joueurs) {
      expect(room.etat.joueurs[membre.id]?.couleur).toBe(
        COULEURS_DES_EQUIPES[membre.equipe ?? 'cyan'],
      );
    }
  });

  it('laisse un membre changer d equipe, en changeant sa couleur', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'));

    const change = room.changerDEquipe('s-A', 'magenta');

    expect(change).toEqual({
      valide: true,
      valeur: { id: 's-A', pseudo: 'A', hote: true, equipe: 'magenta' },
    });
    expect(equipesDe(room)).toEqual({ A: 'magenta', B: 'magenta' });
    expect(room.etat.joueurs['s-A']?.couleur).toBe(COULEURS_DES_EQUIPES.magenta);
  });

  it('accepte qu un membre rejoigne son equipe actuelle, sans rien changer', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'));

    expect(room.changerDEquipe('s-A', 'cyan').valide).toBe(true);
    expect(room.equipeDe('s-A')).toBe('cyan');
  });

  it('refuse une equipe complete', () => {
    const room = roomDuMode();
    for (let rang = 0; rang < 11; rang += 1) {
      avecLesJoueurs(room, invite(`J${String(rang)}`));
    }

    // Onze joueurs: six Cyan, cinq Magenta. J1 est Magenta.
    expect(room.changerDEquipe('s-J1', 'cyan')).toEqual({
      valide: false,
      erreurs: [{ champ: 'equipe', motif: 'Cette équipe est complète.' }],
    });
    expect(room.equipeDe('s-J1')).toBe('magenta');
  });

  it('refuse un changement d equipe une fois la partie lancee', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'));
    room.lancer();

    expect(room.changerDEquipe('s-A', 'magenta')).toEqual({
      valide: false,
      erreurs: [{ champ: 'partie', motif: 'La partie a déjà commencé.' }],
    });
  });

  it('refuse un changement d equipe hors du mode Equipes, ou personne n a d equipe', () => {
    const room = avecLesJoueurs(roomDuMode('classique'), invite('A'));

    expect(room.changerDEquipe('s-A', 'magenta')).toEqual({
      valide: false,
      erreurs: [{ champ: 'equipe', motif: 'Cette partie ne se joue pas en équipes.' }],
    });
    expect(room.joueurs[0]).not.toHaveProperty('equipe');
    expect(room.equipeDe('s-A')).toBeUndefined();
  });

  it('refuse un changement d equipe a qui n est pas membre', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'));

    expect(room.changerDEquipe('s-fantome', 'magenta').valide).toBe(false);
  });

  it('garde les equipes quand les reglages changent', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'), invite('C'));
    room.changerDEquipe('s-A', 'magenta');

    room.changerReglages({ carte: 'map3', dureePartieS: 60 });

    expect(equipesDe(room)).toEqual({ A: 'magenta', B: 'magenta', C: 'cyan' });
    expect(room.etat.joueurs['s-A']?.couleur).toBe(COULEURS_DES_EQUIPES.magenta);
  });

  it('place dans l equipe la moins nombreuse un joueur entre en cours de partie', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'), invite('C'));
    room.lancer();
    jouer(room, 2000);

    avecLesJoueurs(room, invite('D'));

    expect(room.equipeDe('s-D')).toBe('magenta');
  });
});

describe('la condition de lancement', () => {
  it('refuse de lancer tant qu une equipe est vide', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'));

    expect(room.conditionDeLancement()).toEqual({
      valide: false,
      erreurs: [{ champ: 'equipes', motif: 'Il faut au moins un joueur dans chaque équipe.' }],
    });
    expect(() => {
      room.lancer();
    }).toThrow(/au moins un joueur dans chaque équipe/u);
    expect(room.statut).toBe('salon');
  });

  it('se refuse de nouveau quand un changement d equipe en vide une', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'));

    room.changerDEquipe('s-B', 'cyan');

    expect(room.conditionDeLancement().valide).toBe(false);
  });

  it('accepte des equipes inegales', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'), invite('C'));
    room.changerDEquipe('s-B', 'cyan');
    room.changerDEquipe('s-C', 'magenta');
    avecLesJoueurs(room, invite('D'));
    room.changerDEquipe('s-D', 'cyan');

    expect(equipesDe(room)).toEqual({ A: 'cyan', B: 'cyan', C: 'magenta', D: 'cyan' });
    expect(room.conditionDeLancement().valide).toBe(true);

    room.lancer();

    expect(room.statut).toBe('enCours');
  });

  it('laisse lancer seul une partie Classique, comme avant', () => {
    const room = avecLesJoueurs(roomDuMode('classique'), invite('A'));

    expect(room.conditionDeLancement()).toEqual({ valide: true, valeur: true });
  });
});

describe('le bilan d une partie Equipes', () => {
  /** Une partie jouee jusqu'au bout: Alice et Carole en Cyan, Bob et David en Magenta. */
  function partieJouee(): GameRoom {
    const room = avecLesJoueurs(
      roomDuMode(),
      compte('Alice'),
      invite('Bob'),
      invite('Carole'),
      compte('David'),
    );
    room.lancer();
    jouer(room, 31_000);
    return room;
  }

  it('place chacun par equipe, avec ce qu il devance et sa part des points', () => {
    const room = partieJouee();
    const equipes = classementDesEquipes(room.classement());
    const bilan = room.bilan();

    expect(room.statut).toBe('terminee');
    expect(bilan.nombreJoueurs).toBe(4);
    for (const joueur of bilan.joueurs) {
      const ligne = ligneDe(room, joueur.id ?? '');
      const place = placeDansLesEquipes(equipes, equipeDeCouleur(ligne.couleur), 4);

      expect(joueur.placement).toBe(place.placement);
      expect(joueur.devancement).toEqual(place.devancement);
      expect(joueur.points).toBe(pointsEnEquipe(equipes, ligne));
    }
  });

  it('range les membres de l equipe classee devant avant les autres', () => {
    const room = partieJouee();
    const devant = classementDesEquipes(room.classement()).equipes[0];

    const premiers = room
      .bilan()
      .joueurs.slice(0, 2)
      .map((joueur) => joueur.id);

    expect([...premiers].sort()).toEqual([...(devant?.membres ?? [])].sort());
  });

  it('garde un abandon dernier, sans devancement', () => {
    const room = avecLesJoueurs(roomDuMode(), invite('A'), invite('B'), invite('C'));
    room.lancer();
    jouer(room, 5000);
    room.faireSortir('s-C');
    jouer(room, 26_000);

    const dernier = room.bilan().joueurs.at(-1);

    expect(dernier).toMatchObject({ pseudo: 'C', abandon: true, placement: 3 });
    expect(dernier).not.toHaveProperty('devancement');
  });

  it('donne a chaque compte les gains de son devancement', () => {
    const room = partieJouee();
    const bilan = room.bilan();
    const fin = finPourLesComptes(room);

    expect(fin.resultats).toHaveLength(2);
    for (const resultat of fin.resultats) {
      const joueur = bilan.joueurs.find((candidat) => candidat.compte?.id === resultat.compteId);
      if (joueur?.devancement === undefined) {
        throw new Error(`Le compte ${resultat.compteId} devrait avoir un devancement.`);
      }

      const gains = recompensesDePartie({
        placement: joueur.placement,
        nombreJoueurs: 4,
        tempsJoueMs: joueur.tempsJoueMs,
        dureePartieMs: bilan.dureePartieMs,
        abandon: false,
        devancement: joueur.devancement,
      });

      expect(resultat).toMatchObject({
        placement: joueur.placement,
        points: joueur.points,
        xpGagnee: gains.xp,
        piecesGagnees: gains.pieces,
        variationPointsLigue: gains.variationPointsLigue,
      });
    }
  });
});
