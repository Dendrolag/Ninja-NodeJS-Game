/**
 * Tests de la GameRoom d'une partie Chasse (etape 7.3): la capacite, la condition de
 * lancement, le tirage des traqueurs, l'entree refusee en cours de partie, la fin des
 * que la derniere proie tombe, et le bilan par camp.
 *
 * Les regles de l'infection et du score sont testees dans packages/sim (chasse.test.ts),
 * celles des camps dans packages/shared (chasse.test.ts). Ce qui est verifie ici, c'est
 * que la room les applique a une vraie partie.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import { COULEUR_DES_TRAQUEURS, placeDansLaChasse, recompensesDePartie } from '@neon-ninja/shared';
import { estTraqueur } from '@neon-ninja/sim';
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

/** Une room Chasse de trente secondes, a l'horloge manuelle, sans rien qui apparaisse. */
function roomDeChasse(reglages: Record<string, unknown> = {}): GameRoom {
  return new GameRoom({
    id: 'room-chasse',
    graine: 5,
    mode: 'chasse',
    horloge: creerHorlogeManuelle(),
    reglages: { dureePartieS: 30, nombreBotsInitial: 20, ...reglages },
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

/** Fait jouer la partie par battements de cinquante millisecondes, jusqu'a ce temps ou sa fin. */
function jouer(room: GameRoom, dureeMs: number): void {
  for (let ecoule = 0; ecoule < dureeMs && room.statut === 'enCours'; ecoule += 50) {
    room.avancer(50);
  }
}

/** Les identifiants des traqueurs et des proies de la room. */
function camps(room: GameRoom): { traqueurs: string[]; proies: string[] } {
  const ids = room.joueurs.map((joueur) => joueur.id);

  return {
    traqueurs: ids.filter((id) => estTraqueur(room.etat, id)),
    proies: ids.filter((id) => !estTraqueur(room.etat, id)),
  };
}

describe('le salon d une partie Chasse', () => {
  it('accueille dix joueurs au plus', () => {
    const room = roomDeChasse();
    for (let rang = 0; rang < 10; rang += 1) {
      avecLesJoueurs(room, invite(`J${String(rang)}`));
    }

    expect(room.capacite).toBe(10);
    expect(room.accueillir(invite('Onzieme')).valide).toBe(false);
  });

  it('refuse de lancer a un seul joueur, et l accepte a deux', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'));

    expect(room.conditionDeLancement()).toEqual({
      valide: false,
      erreurs: [
        { champ: 'joueurs', motif: 'Il faut au moins deux joueurs pour lancer une chasse.' },
      ],
    });
    expect(() => {
      room.lancer();
    }).toThrow();

    avecLesJoueurs(room, invite('B'));

    expect(room.conditionDeLancement().valide).toBe(true);
  });

  it('se refuse de nouveau quand le salon retombe a un joueur', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'));
    room.faireSortir('s-B');

    expect(room.conditionDeLancement().valide).toBe(false);
  });

  it('n a pas de traqueur au salon, et pas de bots noirs meme demandes', () => {
    const room = avecLesJoueurs(
      roomDeChasse({ botsNoirs: { actifs: true } }),
      invite('A'),
      invite('B'),
    );

    expect(camps(room).traqueurs).toEqual([]);
    expect(room.reglages.botsNoirs.actifs).toBe(false);

    room.changerReglages({ botsNoirs: { actifs: true }, dureePartieS: 60 });

    expect(room.reglages.botsNoirs.actifs).toBe(false);
    expect(room.reglages.dureePartieS).toBe(60);
  });
});

describe('le lancement d une partie Chasse', () => {
  it('tire un traqueur de deux a cinq joueurs, qui prend la couleur des traqueurs', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'), invite('C'));
    room.lancer();

    const { traqueurs, proies } = camps(room);

    expect(traqueurs).toHaveLength(1);
    expect(proies).toHaveLength(2);
    expect(room.etat.joueurs[traqueurs[0] as string]?.couleur).toBe(COULEUR_DES_TRAQUEURS);
  });

  it('tire deux traqueurs de six a dix joueurs', () => {
    const room = roomDeChasse();
    for (let rang = 0; rang < 6; rang += 1) {
      avecLesJoueurs(room, invite(`J${String(rang)}`));
    }
    room.lancer();

    expect(camps(room).traqueurs).toHaveLength(2);
  });

  it('refuse un nouveau venu une fois la chasse lancee', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'));
    room.lancer();

    expect(room.accueillir(invite('C'))).toEqual({
      valide: false,
      erreurs: [{ champ: 'partie', motif: 'Cette chasse a déjà commencé.' }],
    });
  });

  it('laisse revenir un membre dont le lien est tombe', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'));
    room.lancer();
    room.marquerAbsent('s-A');

    expect(room.marquerPresent('s-A')).toBe(true);
  });
});

describe('la fin d une partie Chasse', () => {
  it('s arrete des que la derniere proie tombe, avant le terme', () => {
    // Le traqueur marche droit vers la proie, qui ne bouge pas: il la rattrape bien avant
    // le terme, une fois passes son delai et la protection d'apparition.
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'));
    room.lancer();
    const { traqueurs, proies } = camps(room);
    const traqueur = room.etat.joueurs[traqueurs[0] as string];
    const proie = room.etat.joueurs[proies[0] as string];
    if (traqueur === undefined || proie === undefined) {
      throw new Error('Un traqueur et une proie devraient etre tires.');
    }

    const versLaProie = {
      x: proie.position.x - traqueur.position.x,
      y: proie.position.y - traqueur.position.y,
    };
    room.enregistrerIntention(traqueur.id, { deplacement: versLaProie, enMouvement: true });
    jouer(room, 30_000);

    expect(room.statut).toBe('terminee');
    expect(room.etat.tempsEcouleMs).toBeLessThan(room.etat.dureeMs);
    expect(camps(room).proies).toEqual([]);
  });

  it('s arrete quand la derniere proie s en va', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'));
    room.lancer();
    room.faireSortir(camps(room).proies[0] as string);
    jouer(room, 100);

    expect(room.statut).toBe('terminee');
  });

  it('remplace le traqueur parti par une proie, et continue', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'), invite('C'));
    room.lancer();
    room.faireSortir(camps(room).traqueurs[0] as string);
    jouer(room, 100);

    expect(room.statut).toBe('enCours');
    expect(camps(room).traqueurs).toHaveLength(1);
    expect(camps(room).proies).toHaveLength(1);
  });
});

describe('le bilan d une partie Chasse', () => {
  /** Une chasse jouee jusqu'au terme, ou personne ne bouge: les proies survivent. */
  function chasseJouee(): GameRoom {
    const room = avecLesJoueurs(roomDeChasse(), compte('Alice'), invite('Bob'), compte('Carole'));
    room.lancer();
    jouer(room, 31_000);
    return room;
  }

  it('place les proies survivantes premieres et les traqueurs ensuite, avec leur devancement', () => {
    const room = chasseJouee();
    const classement = room.classement();
    const bilan = room.bilan();

    expect(room.statut).toBe('terminee');
    for (const joueur of bilan.joueurs) {
      const ligne = classement.find((candidate) => candidate.id === joueur.id);
      const place = placeDansLaChasse(classement, ligne?.couleur ?? '', 3);

      expect(joueur.placement).toBe(place.placement);
      expect(joueur.devancement).toEqual(place.devancement);
    }
    expect(bilan.joueurs.map((joueur) => joueur.placement)).toEqual([1, 1, 3]);
  });

  it('compte en points le temps de survie, en secondes', () => {
    const bilan = chasseJouee().bilan();

    expect(bilan.joueurs.map((joueur) => joueur.points)).toEqual([30, 30, 0]);
  });

  it('paye une chasse gagnee avant le terme comme une partie entiere', () => {
    const room = avecLesJoueurs(roomDeChasse(), invite('A'), invite('B'));
    room.lancer();
    room.faireSortir(camps(room).proies[0] as string);
    jouer(room, 100);

    const [traqueur] = room.bilan().joueurs;

    expect(traqueur?.tempsJoueMs).toBe(30_000);
    expect(traqueur?.placement).toBe(1);
  });

  it('donne a chaque compte les gains de son camp', () => {
    const room = chasseJouee();
    const bilan = room.bilan();

    for (const resultat of finPourLesComptes(room).resultats) {
      const joueur = bilan.joueurs.find((candidat) => candidat.compte?.id === resultat.compteId);
      if (joueur?.devancement === undefined) {
        throw new Error(`Le compte ${resultat.compteId} devrait avoir un devancement.`);
      }

      const gains = recompensesDePartie({
        placement: joueur.placement,
        nombreJoueurs: 3,
        tempsJoueMs: joueur.tempsJoueMs,
        dureePartieMs: bilan.dureePartieMs,
        abandon: false,
        devancement: joueur.devancement,
      });

      expect(resultat).toMatchObject({
        placement: joueur.placement,
        points: joueur.points,
        xpGagnee: gains.xp,
        variationPointsLigue: gains.variationPointsLigue,
      });
    }
  });
});
