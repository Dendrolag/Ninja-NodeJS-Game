/**
 * Tests de l'absence d'un joueur dans la GameRoom (etape 2.5).
 *
 * Un joueur dont le lien tombe en pleine partie reste membre de la room et reste
 * dans l'etat, immobile, le temps que la couche reseau lui laisse pour revenir. Ces
 * tests verifient ce que la room en fait: le mouvement, l'hote, la capacite, la
 * couleur transmise par ses bots, et le retour.
 */

import type { ReglagesPartiels, SessionJoueur } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { GameRoom } from './GameRoom.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';

/** Une partie longue et sans bots: seuls les joueurs bougent. */
const REGLAGES: ReglagesPartiels = { dureePartieS: 60, nombreBotsInitial: 10 };

/** Cadence utilisee par les tests, celle du serveur. */
const BATTEMENT_MS = 50;

/** Une session de joueur, telle que la connexion l'etablit. */
function session(id: string, pseudo: string): SessionJoueur {
  return { id, pseudo };
}

/** Une room, et l'horloge qui la fait battre, avec ces joueurs deja entres. */
function roomAvec(pseudos: readonly string[]): {
  readonly room: GameRoom;
  readonly horloge: HorlogeManuelle;
} {
  const horloge = creerHorlogeManuelle();
  const room = new GameRoom({
    id: 'room-test',
    graine: 7,
    reglages: REGLAGES,
    cadenceMs: BATTEMENT_MS,
    horloge,
  });

  for (const pseudo of pseudos) {
    room.accueillir(session(pseudo.toLowerCase(), pseudo));
  }

  return { room, horloge };
}

/** Fait marcher ce joueur vers la droite. */
function marcher(room: GameRoom, id: string): void {
  room.enregistrerIntention(id, { deplacement: { x: 1, y: 0 }, enMouvement: true });
}

describe('GameRoom, absence d un joueur', () => {
  it('garde l absent dans l etat et parmi les membres, avec sa couleur', () => {
    const { room } = roomAvec(['Alice', 'Bob']);
    room.lancer();
    const couleur = room.etat.joueurs['bob']?.couleur;

    expect(room.marquerAbsent('bob')).toBe(true);

    expect(room.estAbsent('bob')).toBe(true);
    expect(room.etat.joueurs['bob']?.couleur).toBe(couleur);
    expect(room.joueurs.map((joueur) => joueur.id)).toEqual(['alice', 'bob']);
    expect(room.estVide).toBe(false);
  });

  it('immobilise l absent: sa derniere intention est oubliee', () => {
    const { room, horloge } = roomAvec(['Alice', 'Bob']);
    room.lancer();
    marcher(room, 'bob');
    horloge.avancerDe(BATTEMENT_MS * 4);

    room.marquerAbsent('bob');
    const arret = room.etat.joueurs['bob']?.position;
    horloge.avancerDe(BATTEMENT_MS * 10);

    expect(room.etat.joueurs['bob']?.position).toEqual(arret);
  });

  it('donne la main au plus ancien des presents quand l hote s absente', () => {
    const { room } = roomAvec(['Alice', 'Bob', 'Carole']);
    room.lancer();

    room.marquerAbsent('alice');

    expect(room.hote).toBe('bob');
  });

  it('laisse la main a l hote absent quand personne n est present, et la rend au premier qui revient', () => {
    const { room } = roomAvec(['Alice', 'Bob']);
    room.lancer();

    room.marquerAbsent('alice');
    room.marquerAbsent('bob');
    expect(room.hote).toBe('bob');

    expect(room.marquerPresent('alice')).toBe(true);
    expect(room.hote).toBe('alice');
  });

  it('ne rend pas la main a l ancien hote qui revient', () => {
    const { room } = roomAvec(['Alice', 'Bob']);
    room.lancer();

    room.marquerAbsent('alice');
    room.marquerPresent('alice');

    expect(room.estAbsent('alice')).toBe(false);
    expect(room.hote).toBe('bob');
  });

  it('un revenu bouge de nouveau a sa prochaine intention', () => {
    const { room, horloge } = roomAvec(['Alice']);
    room.lancer();

    room.marquerAbsent('alice');
    room.marquerPresent('alice');
    const depart = room.etat.joueurs['alice']?.position.x ?? 0;
    marcher(room, 'alice');
    horloge.avancerDe(BATTEMENT_MS * 4);

    expect(room.etat.joueurs['alice']?.position.x).toBeGreaterThan(depart);
  });

  it('ne marque ni un inconnu, ni deux fois le meme, ni un present revenu', () => {
    const { room } = roomAvec(['Alice']);
    room.lancer();

    expect(room.marquerAbsent('inconnu')).toBe(false);
    expect(room.marquerPresent('alice')).toBe(false);
    expect(room.marquerAbsent('alice')).toBe(true);
    expect(room.marquerAbsent('alice')).toBe(false);
  });

  it('compte l absent dans la capacite et garde son pseudo pris', () => {
    const { room } = roomAvec(['Alice']);
    room.lancer();

    room.marquerAbsent('alice');
    const usurpation = room.accueillir(session('autre', 'alice'));

    expect(usurpation.valide).toBe(false);
  });

  it('fait sortir un absent comme un present: abandon, et main au present', () => {
    const { room } = roomAvec(['Alice', 'Bob', 'Carole']);
    room.lancer();

    room.marquerAbsent('bob');
    room.marquerAbsent('alice');
    room.faireSortir('alice');

    expect(room.hote).toBe('carole');
    expect(room.estAbsent('alice')).toBe(false);
    expect(room.bilan().joueurs.filter((joueur) => joueur.abandon)).toHaveLength(1);
  });

  it('les bots de l absent transmettent encore sa couleur: il est toujours dans l etat', () => {
    const { room } = roomAvec(['Alice']);
    room.lancer();

    room.marquerAbsent('alice');

    // La regle 11 ne transmet que la couleur d'un joueur present dans l'etat: c'est
    // cette presence que l'absence doit garder.
    const couleurs = Object.values(room.etat.joueurs).map((joueur) => joueur.couleur);
    expect(couleurs).toContain(room.etat.joueurs['alice']?.couleur);
  });
});
