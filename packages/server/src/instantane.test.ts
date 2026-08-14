/**
 * Tests de la projection vers le reseau.
 *
 * Deux choses sont verifiees ici, et la seconde est la plus importante.
 *
 *   1. Que l'instantane dit bien ce qu'il doit dire: les entites, les objets, les
 *      zones, le classement, le temps restant.
 *   2. Que l'instantane NE DIT PAS ce qu'il ne doit pas dire. Le terrain et la
 *      graine restent au serveur. C'est une garantie qui ne se voit pas en
 *      jouant, qui ne casse rien si on l'oublie, et qui donne un avantage
 *      decisif a qui la remarque: exactement le genre de regle qui a besoin d'un
 *      test pour survivre.
 */

import { CARTES } from '@neon-ninja/shared';
import type { EtatPartie } from '@neon-ninja/sim';
import { ajouterJoueur, creerEtatInitial, poserObjet, tick } from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import { GameRoom } from './GameRoom.js';
import { classementDe, instantaneDe, notificationsDe, salonDe } from './instantane.js';

/** Une partie a deux joueurs, sans bot, pour observer la projection au calme. */
function partieADeux(): EtatPartie {
  let etat = creerEtatInitial({ graine: 7, reglages: { nombreBotsInitial: 10 } });
  etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice' });
  etat = ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob' });

  return etat;
}

describe('instantaneDe', () => {
  it('projette chaque joueur avec son pseudo et ses deux indicateurs publics', () => {
    const instantane = instantaneDe(partieADeux());
    const alice = instantane.entites.find((entite) => entite.id === 'alice');

    expect(alice).toMatchObject({
      type: 'joueur',
      pseudo: 'Alice',
      invincible: false,
      // Un joueur qui vient d'entrer beneficie de sa protection d'apparition.
      protege: true,
    });
  });

  it('donne aux entites des coordonnees plates, pas un objet position', () => {
    const etat = partieADeux();
    const instantane = instantaneDe(etat);
    const alice = instantane.entites.find((entite) => entite.id === 'alice');

    expect(alice?.x).toBe(etat.joueurs['alice']?.position.x);
    expect(alice?.y).toBe(etat.joueurs['alice']?.position.y);
  });

  it('ne laisse fuir ni le terrain ni la graine', () => {
    const instantane = instantaneDe(partieADeux());
    const serialise = JSON.stringify(instantane);

    expect(serialise).not.toContain('terrain');
    expect(serialise).not.toContain('alea');
    expect(serialise).not.toContain('graine');
    expect(Object.keys(instantane).sort()).toEqual([
      'classement',
      'entites',
      'objets',
      'tempsRestantMs',
      'tick',
      'zones',
    ]);
  });

  it('ne laisse fuir aucun compteur interne de joueur', () => {
    const serialise = JSON.stringify(instantaneDe(partieADeux()));

    expect(serialise).not.toContain('bonusRestantsMs');
    expect(serialise).not.toContain('malusRestantsMs');
    expect(serialise).not.toContain('tempsDepuisDerniereCaptureMs');
    expect(serialise).not.toContain('protectionSpawnRestanteMs');
  });

  it('annonce le temps restant, jamais le temps ecoule', () => {
    const etat = tick(partieADeux(), {}, 1000);
    const instantane = instantaneDe(etat);

    expect(instantane.tempsRestantMs).toBe(etat.dureeMs - 1000);
    expect(instantane.tick).toBe(1);
  });

  it('projette les objets poses avec leur nature et leur duree de vie', () => {
    let etat = partieADeux();
    etat = poserObjet(etat, {
      categorie: 'bonus',
      nature: 'vitesse',
      position: { x: 100, y: 100 },
    });

    const instantane = instantaneDe(etat);

    expect(instantane.objets).toHaveLength(1);
    expect(instantane.objets[0]).toMatchObject({
      categorie: 'bonus',
      nature: 'vitesse',
      x: 100,
      y: 100,
    });
    expect(instantane.objets[0]?.dureeDeVieRestanteMs).toBeGreaterThan(0);
  });

  it('projette le classement, du meilleur au moins bon', () => {
    const instantane = instantaneDe(partieADeux());

    expect(instantane.classement.map((ligne) => ligne.id).sort()).toEqual(['alice', 'bob']);
    expect(instantane.classement[0]).toMatchObject({ points: 0, botsPortes: 0 });
  });

  it('ne fait pas voyager le detail croise des captures', () => {
    const serialise = JSON.stringify(instantaneDe(partieADeux()));

    expect(serialise).not.toContain('joueursCaptures');
    expect(serialise).not.toContain('capturesSubies');
  });
});

describe('classementDe', () => {
  it('rend une ligne par joueur, sans le detail interne du moteur', () => {
    const classement = classementDe(partieADeux());

    expect(classement).toHaveLength(2);
    expect(Object.keys(classement[0] ?? {}).sort()).toEqual([
      'botsNoirsDetruits',
      'botsPortes',
      'captures',
      'couleur',
      'id',
      'points',
      'pointsBotsNoirs',
      'pseudo',
    ]);
  });
});

describe('salonDe', () => {
  it('decrit la room, ses membres dans l ordre et ses reglages complets', () => {
    const room = new GameRoom({ id: 'room-1', graine: 3 });
    room.accueillir({ id: 'alice', pseudo: 'Alice' });
    room.accueillir({ id: 'bob', pseudo: 'Bob' });

    const salon = salonDe(room);

    expect(salon.idRoom).toBe('room-1');
    expect(salon.statut).toBe('salon');
    expect(salon.joueurs).toEqual([
      { id: 'alice', pseudo: 'Alice', hote: true },
      { id: 'bob', pseudo: 'Bob', hote: false },
    ]);
    expect(salon.reglages.carte).toBe('map1');
    expect(CARTES[salon.reglages.carte]).toBeDefined();
  });
});

describe('notificationsDe', () => {
  it('ne dit rien quand il ne s est rien passe', () => {
    expect(notificationsDe(partieADeux())).toEqual([]);
  });

  it('fait deux messages distincts d une capture de joueur', () => {
    const etat = partieADeux();
    const avecCapture: EtatPartie = {
      ...etat,
      evenements: [
        {
          type: 'captureJoueur',
          attaquant: 'alice',
          victime: 'bob',
          botsTransferes: 4,
          nouvelleCouleurVictime: '#123456',
          position: { x: 10, y: 20 },
        },
      ],
    };

    const notifications = notificationsDe(avecCapture);

    expect(notifications).toEqual([
      {
        nom: 'captureSubie',
        pour: 'bob',
        charge: { parPseudo: 'Alice', nouvelleCouleur: '#123456', botsPerdus: 4 },
      },
      {
        nom: 'captureReussie',
        pour: 'alice',
        charge: { victimePseudo: 'Bob', botsGagnes: 4, capturesTotal: 0 },
      },
    ]);
  });

  it('epargne le ramasseur d un malus et previent chaque victime', () => {
    const etat = partieADeux();
    const avecMalus: EtatPartie = {
      ...etat,
      evenements: [
        {
          type: 'malusRamasse',
          joueur: 'alice',
          nature: 'controlesInverses',
          dureeMs: 10_000,
          victimes: ['bob'],
          position: { x: 0, y: 0 },
        },
      ],
    };

    const notifications = notificationsDe(avecMalus);

    expect(notifications).toEqual([
      {
        nom: 'malusRamasse',
        pour: 'alice',
        charge: { nature: 'controlesInverses', dureeMs: 10_000 },
      },
      {
        nom: 'malusSubi',
        pour: 'bob',
        charge: { nature: 'controlesInverses', dureeMs: 10_000, parPseudo: 'Alice' },
      },
    ]);
  });

  it('traduit un bonus ramasse en activation adressee au seul ramasseur', () => {
    const etat = partieADeux();
    const avecBonus: EtatPartie = {
      ...etat,
      evenements: [
        {
          type: 'bonusRamasse',
          joueur: 'bob',
          nature: 'vitesse',
          dureeMs: 10_000,
          position: { x: 0, y: 0 },
        },
      ],
    };

    expect(notificationsDe(avecBonus)).toEqual([
      { nom: 'bonusActive', pour: 'bob', charge: { nature: 'vitesse', dureeMs: 10_000 } },
    ]);
  });

  it('traduit une capture par bot noir et une destruction de bot noir', () => {
    const etat = partieADeux();
    const faits: EtatPartie = {
      ...etat,
      evenements: [
        {
          type: 'captureParBotNoir',
          botNoir: 'noir-1',
          victime: 'alice',
          botsPerdus: 3,
          position: { x: 5, y: 6 },
        },
        {
          type: 'botNoirDetruit',
          joueur: 'bob',
          botNoir: 'noir-2',
          position: { x: 7, y: 8 },
          points: 15,
        },
      ],
    };

    expect(notificationsDe(faits)).toEqual([
      { nom: 'captureParBotNoir', pour: 'alice', charge: { botsPerdus: 3 } },
      { nom: 'botNoirDetruit', pour: 'bob', charge: { points: 15, x: 7, y: 8 } },
    ]);
  });

  it('omet la capture d un joueur qui a quitte la partie dans le meme battement', () => {
    const etat = partieADeux();
    const orpheline: EtatPartie = {
      ...etat,
      evenements: [
        {
          type: 'captureJoueur',
          attaquant: 'alice',
          victime: 'parti',
          botsTransferes: 2,
          nouvelleCouleurVictime: '#000000',
          position: { x: 0, y: 0 },
        },
      ],
    };

    expect(notificationsDe(orpheline)).toEqual([]);
  });
});
