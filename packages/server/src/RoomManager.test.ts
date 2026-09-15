/**
 * Tests d'integration du RoomManager.
 *
 * Le test central de ce fichier est celui de l'isolation: deux parties qui
 * tournent cote a cote ne doivent rien partager. C'est le deblocage que toute la
 * phase 2 attend, et c'est precisement ce que le legacy ne savait pas faire,
 * puisque son etat de partie vivait dans des variables de module.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import type { EtatPartie, IdentifiantEntite } from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import type { GameRoom } from './GameRoom.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import { RoomManager } from './RoomManager.js';

/** Une partie courte et peu peuplee. */
const REGLAGES = { dureePartieS: 2, nombreBotsInitial: 3 };

/** Une session de joueur, telle que la connexion l'etablit. */
function session(id: string, pseudo: string): SessionJoueur {
  return { id, pseudo };
}

/** Un gestionnaire dont l'horloge et les graines sont tenues par le test. */
function gestionnaireDeTest(): {
  readonly gestionnaire: RoomManager;
  readonly horloge: HorlogeManuelle;
} {
  const horloge = creerHorlogeManuelle();
  let graine = 0;

  const gestionnaire = new RoomManager({
    horloge,
    cadenceMs: 50,
    genererGraine: () => {
      graine += 1;

      return graine;
    },
  });

  return { gestionnaire, horloge };
}

/**
 * Un resume comparable d'une partie.
 *
 * L'etat entier contient le terrain, plusieurs centaines de kilo-octets partages
 * par tous les battements: le comparer n'apporterait rien. Ce resume contient
 * l'etat du generateur a graine, qui suffit a detecter toute divergence.
 */
function resume(etat: EtatPartie): unknown {
  return {
    tick: etat.tick,
    tempsEcouleMs: etat.tempsEcouleMs,
    alea: etat.alea.etat,
    joueurs: Object.values(etat.joueurs).map((joueur) => ({
      id: joueur.id,
      position: joueur.position,
      couleur: joueur.couleur,
    })),
    bots: Object.values(etat.bots).map((bot) => ({ id: bot.id, position: bot.position })),
  };
}

/** Fait avancer une partie vers la droite pendant le nombre de battements demande. */
function jouer(room: GameRoom, id: IdentifiantEntite, battements: number): void {
  room.enregistrerIntention(id, { deplacement: { x: 1, y: 0 }, enMouvement: true });

  for (let battement = 0; battement < battements; battement += 1) {
    room.avancer(50);
  }
}

describe('RoomManager, cycle de vie', () => {
  it('ouvre une room vide, dans son salon', () => {
    const { gestionnaire } = gestionnaireDeTest();

    const room = gestionnaire.creer({ reglages: REGLAGES });

    expect(room.statut).toBe('salon');
    expect(room.estVide).toBe(true);
    expect(gestionnaire.nombreDeRooms).toBe(1);
  });

  it('donne un identifiant different a chaque room', () => {
    const { gestionnaire } = gestionnaireDeTest();

    const premiere = gestionnaire.creer();
    const seconde = gestionnaire.creer();

    expect(premiere.id).not.toBe(seconde.id);
    expect(gestionnaire.toutesLesRooms.map((room) => room.id)).toEqual([premiere.id, seconde.id]);
  });

  it('retrouve une room par son identifiant', () => {
    const { gestionnaire } = gestionnaireDeTest();

    const room = gestionnaire.creer();

    expect(gestionnaire.room(room.id)).toBe(room);
    expect(gestionnaire.room('room-inconnue')).toBeUndefined();
  });

  it('fait entrer un joueur et lui donne le salon', () => {
    const { gestionnaire } = gestionnaireDeTest();
    const room = gestionnaire.creer({ reglages: REGLAGES });

    const resultat = gestionnaire.rejoindre(room.id, session('alice', 'Alice'));

    expect(resultat.valide).toBe(true);
    expect(room.hote).toBe('alice');
  });

  it('refuse poliment de rejoindre une room qui n existe plus', () => {
    const { gestionnaire } = gestionnaireDeTest();

    const resultat = gestionnaire.rejoindre('room-fantome', session('alice', 'Alice'));

    if (resultat.valide) {
      throw new Error('Rejoindre une room inexistante aurait du etre refuse.');
    }
    expect(resultat.erreurs[0]?.champ).toBe('room');
  });

  it('detruit la room quand son dernier joueur part', () => {
    const { gestionnaire } = gestionnaireDeTest();
    const room = gestionnaire.creer({ reglages: REGLAGES });

    gestionnaire.rejoindre(room.id, session('alice', 'Alice'));
    gestionnaire.rejoindre(room.id, session('bob', 'Bob'));
    gestionnaire.quitter(room.id, 'alice');

    expect(gestionnaire.nombreDeRooms).toBe(1);

    gestionnaire.quitter(room.id, 'bob');

    expect(gestionnaire.nombreDeRooms).toBe(0);
    expect(gestionnaire.room(room.id)).toBeUndefined();
  });

  it('arrete la boucle de la room qu il detruit', () => {
    const { gestionnaire, horloge } = gestionnaireDeTest();
    const room = gestionnaire.creer({ reglages: REGLAGES });

    gestionnaire.rejoindre(room.id, session('alice', 'Alice'));
    room.lancer();
    horloge.avancerDe(100);
    gestionnaire.quitter(room.id, 'alice');
    horloge.avancerDe(1000);

    expect(room.enMarche).toBe(false);
    expect(room.etat.tick).toBe(2);
  });

  it('ferme toutes les rooms d un coup', () => {
    const { gestionnaire } = gestionnaireDeTest();

    gestionnaire.creer();
    gestionnaire.creer();
    gestionnaire.toutFermer();

    expect(gestionnaire.nombreDeRooms).toBe(0);
  });

  it('ignore la sortie d un joueur d une room inconnue', () => {
    const { gestionnaire } = gestionnaireDeTest();

    expect(gestionnaire.quitter('room-fantome', 'alice')).toBe(false);
    expect(gestionnaire.detruire('room-fantome')).toBe(false);
  });
});

describe('RoomManager, isolation entre plusieurs parties', () => {
  it('donne une graine differente a chaque room', () => {
    const { gestionnaire } = gestionnaireDeTest();

    const premiere = gestionnaire.creer({ reglages: REGLAGES });
    const seconde = gestionnaire.creer({ reglages: REGLAGES });

    expect(premiere.graine).not.toBe(seconde.graine);
  });

  it('place les joueurs et les bots differemment quand les graines different', () => {
    const { gestionnaire } = gestionnaireDeTest();
    const premiere = gestionnaire.creer({ reglages: REGLAGES });
    const seconde = gestionnaire.creer({ reglages: REGLAGES });

    for (const room of [premiere, seconde]) {
      gestionnaire.rejoindre(room.id, session('alice', 'Alice'));
      room.lancer();
    }

    expect(resume(premiere.etat)).not.toEqual(resume(seconde.etat));

    gestionnaire.toutFermer();
  });

  it('rejoue exactement la meme partie a graine egale', () => {
    const { gestionnaire } = gestionnaireDeTest();
    const premiere = gestionnaire.creer({ graine: 7, reglages: REGLAGES });
    const seconde = gestionnaire.creer({ graine: 7, reglages: REGLAGES });

    for (const room of [premiere, seconde]) {
      gestionnaire.rejoindre(room.id, session('alice', 'Alice'));
      room.lancer();
      jouer(room, 'alice', 10);
    }

    expect(resume(premiere.etat)).toEqual(resume(seconde.etat));

    gestionnaire.toutFermer();
  });

  it('n influence pas une partie en en faisant avancer une autre', () => {
    const { gestionnaire } = gestionnaireDeTest();
    const observee = gestionnaire.creer({ graine: 7, reglages: REGLAGES });
    const agitee = gestionnaire.creer({ graine: 7, reglages: REGLAGES });

    for (const room of [observee, agitee]) {
      gestionnaire.rejoindre(room.id, session('alice', 'Alice'));
      room.lancer();
    }

    const avant = resume(observee.etat);
    jouer(agitee, 'alice', 20);

    expect(resume(observee.etat)).toEqual(avant);
    expect(resume(agitee.etat)).not.toEqual(avant);

    gestionnaire.toutFermer();
  });

  it('garde les joueurs de chaque partie chez eux', () => {
    const { gestionnaire } = gestionnaireDeTest();
    const premiere = gestionnaire.creer({ reglages: REGLAGES });
    const seconde = gestionnaire.creer({ reglages: REGLAGES });

    gestionnaire.rejoindre(premiere.id, session('alice', 'Alice'));
    gestionnaire.rejoindre(seconde.id, session('bob', 'Bob'));

    expect(premiere.etat.joueurs['bob']).toBeUndefined();
    expect(seconde.etat.joueurs['alice']).toBeUndefined();
    expect(premiere.hote).toBe('alice');
    expect(seconde.hote).toBe('bob');
  });

  it('accepte le meme pseudo dans deux parties differentes', () => {
    const { gestionnaire } = gestionnaireDeTest();
    const premiere = gestionnaire.creer({ reglages: REGLAGES });
    const seconde = gestionnaire.creer({ reglages: REGLAGES });

    gestionnaire.rejoindre(premiere.id, session('alice', 'Alice'));

    expect(gestionnaire.rejoindre(seconde.id, session('alice-2', 'Alice')).valide).toBe(true);
  });

  it('applique a chaque partie ses propres reglages', () => {
    const { gestionnaire } = gestionnaireDeTest();

    const courte = gestionnaire.creer({ reglages: { dureePartieS: 30, nombreBotsInitial: 2 } });
    const longue = gestionnaire.creer({ reglages: { dureePartieS: 300, nombreBotsInitial: 8 } });
    courte.lancer();
    longue.lancer();

    expect(courte.etat.dureeMs).toBe(30_000);
    expect(longue.etat.dureeMs).toBe(300_000);
    expect(Object.keys(courte.etat.bots)).toHaveLength(2);
    expect(Object.keys(longue.etat.bots)).toHaveLength(8);

    gestionnaire.toutFermer();
  });

  it('fait battre plusieurs parties en parallele sur la meme horloge', () => {
    const { gestionnaire, horloge } = gestionnaireDeTest();
    const premiere = gestionnaire.creer({ reglages: REGLAGES });
    const seconde = gestionnaire.creer({ reglages: REGLAGES });

    gestionnaire.rejoindre(premiere.id, session('alice', 'Alice'));
    premiere.lancer();
    horloge.avancerDe(100);

    gestionnaire.rejoindre(seconde.id, session('bob', 'Bob'));
    seconde.lancer();
    horloge.avancerDe(100);

    expect(premiere.etat.tick).toBe(4);
    expect(seconde.etat.tick).toBe(2);

    gestionnaire.toutFermer();
  });

  it('deux gestionnaires ne se voient pas', () => {
    const premier = gestionnaireDeTest().gestionnaire;
    const second = gestionnaireDeTest().gestionnaire;

    const room = premier.creer();

    expect(second.room(room.id)).toBeUndefined();
    expect(second.nombreDeRooms).toBe(0);
  });
});
