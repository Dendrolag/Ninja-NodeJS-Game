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

import { CARTES, CHASSE, MASSACRE, TACTIQUE } from '@neon-ninja/shared';
import type { EtatPartie } from '@neon-ninja/sim';
import {
  ajouterBot,
  ajouterJoueur,
  creerEtatInitial,
  devenirTraqueur,
  frapper,
  lancerLeMassacre,
  mettreEnPause,
  poserObjet,
  tick,
  tirerEnChasse,
} from '@neon-ninja/sim';
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

describe('le mode Tactique dans la projection', () => {
  /** Une partie Tactique a deux joueurs eloignes, sans bot. */
  function partieTactiqueADeux(): EtatPartie {
    let etat = creerEtatInitial({ graine: 7, mode: 'tactique' });
    etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice', position: { x: 500, y: 500 } });
    etat = ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob', position: { x: 1500, y: 1000 } });

    return etat;
  }

  it('montre ou vise chaque joueur, et ses charges', () => {
    const etat = tick(
      partieTactiqueADeux(),
      { alice: { deplacement: { x: 0, y: 1 }, enMouvement: true } },
      50,
    );
    const alice = instantaneDe(etat).entites.find((entite) => entite.id === 'alice');

    expect(alice).toMatchObject({
      tactique: {
        orientation: 'sud',
        charges: TACTIQUE.CHARGES_MAXIMUM,
        avantProchaineChargeMs: TACTIQUE.RECHARGE_MS,
      },
    });
  });

  it('montre l etat de depart d un joueur que le moteur n a pas encore fait battre', () => {
    const bob = instantaneDe(partieTactiqueADeux()).entites.find((entite) => entite.id === 'bob');

    expect(bob).toMatchObject({
      tactique: {
        orientation: TACTIQUE.ORIENTATION_DE_DEPART,
        charges: TACTIQUE.CHARGES_MAXIMUM,
      },
    });
  });

  it('ne montre rien du mode Tactique dans une partie Classique', () => {
    const instantane = instantaneDe(tick(partieADeux(), {}, 50));

    expect(
      instantane.entites.some(
        (entite) => entite.type === 'joueur' && entite.tactique !== undefined,
      ),
    ).toBe(false);
  });

  it('annonce un tir a chaque joueur de la partie', () => {
    const etat = tick(
      partieTactiqueADeux(),
      { alice: { deplacement: { x: 0, y: 0 }, enMouvement: false, capturer: true } },
      50,
    );

    const tirs = notificationsDe(etat).filter(
      (notification) => notification.nom === 'tirDeCapture',
    );

    expect(tirs.map((tir) => tir.pour)).toEqual(['alice', 'bob']);
    expect(tirs[0]?.charge).toEqual({
      tireur: 'alice',
      x: 500,
      y: 500,
      orientation: 'est',
      captures: 0,
    });
  });
});

describe('le mode Chasse dans la projection', () => {
  /**
   * Une Chasse a deux joueurs: le traqueur tire, pret, en (500, 500), vise a l'est, un faux
   * ninja juste devant lui.
   */
  function chasseADeux(vies: number = CHASSE.VIES_DES_TRAQUEURS): EtatPartie {
    let etat = creerEtatInitial({ graine: 7, mode: 'chasse' });
    etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice', position: { x: 500, y: 500 } });
    etat = ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob', position: { x: 1500, y: 1000 } });
    etat = devenirTraqueur(
      { ...etat, chasse: { traqueurs: {}, parcours: {}, traqueursEpuises: false } },
      'alice',
    );
    etat = ajouterBot(etat, { id: 'ninja', couleur: '#123456', position: { x: 540, y: 500 } });
    const alice = etat.chasse?.traqueurs['alice'];
    if (etat.chasse === undefined || alice === undefined) {
      throw new Error('Alice devrait etre le traqueur.');
    }

    return {
      ...etat,
      tempsEcouleMs: CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS + 1,
      chasse: { ...etat.chasse, traqueurs: { alice: { ...alice, vies } } },
    };
  }

  it('montre l arme d un traqueur: ou il vise, et ses vies en guise de charges', () => {
    const entites = instantaneDe(chasseADeux()).entites;

    expect(entites.find((entite) => entite.id === 'alice')).toMatchObject({
      tactique: {
        orientation: 'est',
        charges: CHASSE.VIES_DES_TRAQUEURS,
        avantProchaineChargeMs: 0,
      },
    });
    expect(entites.find((entite) => entite.id === 'bob')).not.toHaveProperty('tactique');
  });

  it('retire de la carte un traqueur elimine, qui reste au classement', () => {
    const instantane = instantaneDe(chasseADeux(0));

    expect(instantane.entites.some((entite) => entite.id === 'alice')).toBe(false);
    expect(instantane.classement.some((ligne) => ligne.id === 'alice')).toBe(true);
  });

  it('previent le seul traqueur d une vie perdue', () => {
    const etat = tirerEnChasse({ ...chasseADeux(), evenements: [] }, 'alice');

    expect(
      notificationsDe(etat).filter((notification) => notification.nom === 'vieDeTraqueurPerdue'),
    ).toEqual([{ nom: 'vieDeTraqueurPerdue', pour: 'alice', charge: { viesRestantes: 2 } }]);
  });
});

describe('le mode Massacre dans la projection', () => {
  /** Un Massacre lance: Alice au milieu, Bob a trente pixels a l'est, un bot entre eux. */
  function massacreADeux(): EtatPartie {
    let etat = creerEtatInitial({
      graine: 7,
      mode: 'massacre',
      reglages: { nombreBotsInitial: 10 },
    });
    etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice', position: { x: 500, y: 500 } });
    etat = ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob', position: { x: 530, y: 500 } });
    etat = ajouterBot(etat, { id: 'b', position: { x: 520, y: 510 } });
    etat = ajouterBot(etat, { id: 'loin', position: { x: 1500, y: 1000 } });
    const bob = etat.joueurs['bob'];
    if (bob === undefined) {
      throw new Error('Bob devrait etre dans la partie.');
    }

    return lancerLeMassacre({
      ...etat,
      joueurs: { ...etat.joueurs, bob: { ...bob, protectionSpawnRestanteMs: 0 } },
    });
  }

  it('montre l arme de chaque joueur: ou il frappe, et si son coup est pret', () => {
    const pret = instantaneDe(massacreADeux()).entites.find((entite) => entite.id === 'alice');
    const apres = instantaneDe(frapper(massacreADeux(), 'alice').etat).entites.find(
      (entite) => entite.id === 'alice',
    );

    expect(pret).toMatchObject({
      tactique: { orientation: 'est', charges: 1, avantProchaineChargeMs: 0 },
    });
    expect(apres).toMatchObject({
      tactique: { charges: 0, avantProchaineChargeMs: MASSACRE.DELAI_ENTRE_COUPS_MS },
    });
  });

  it('annonce le coup, ses morts et le joueur tue a chaque joueur de la partie', () => {
    const etat = frapper({ ...massacreADeux(), evenements: [] }, 'alice').etat;
    const notifications = notificationsDe(etat);

    expect(notifications.filter((notification) => notification.nom === 'coupDeKatana')).toEqual(
      ['alice', 'bob'].map((pour) => ({
        nom: 'coupDeKatana',
        pour,
        charge: {
          frappeur: 'alice',
          x: 500,
          y: 500,
          orientation: 'est',
          morts: [{ id: 'b', x: 520, y: 510, noir: false, points: 10 }],
          combo: 1,
          multiplicateur: 1,
        },
      })),
    );
    expect(notifications.filter((notification) => notification.nom === 'joueurTranche')).toEqual(
      ['alice', 'bob'].map((pour) => ({
        nom: 'joueurTranche',
        pour,
        charge: {
          attaquant: 'alice',
          attaquantPseudo: 'Alice',
          victime: 'bob',
          victimePseudo: 'Bob',
          x: 530,
          y: 500,
          orientation: 'est',
          pointsVoles: 0,
        },
      })),
    );
  });

  it('omet un joueur tue dont l un des deux a quitte la partie', () => {
    const etat = frapper({ ...massacreADeux(), evenements: [] }, 'alice').etat;
    const { bob: _parti, ...restants } = etat.joueurs;

    expect(
      notificationsDe({ ...etat, joueurs: restants }).some(
        (notification) => notification.nom === 'joueurTranche',
      ),
    ).toBe(false);
  });

  it('annonce la carte videe et son bonus a chaque joueur', () => {
    const etat = {
      ...massacreADeux(),
      evenements: [{ type: 'carteVidee', tempsRestantMs: 12_300, bonus: 60 }] as const,
    };

    expect(notificationsDe(etat)).toEqual(
      ['alice', 'bob'].map((pour) => ({
        nom: 'carteVidee',
        pour,
        charge: { bonus: 60, tempsRestantMs: 12_300 },
      })),
    );
  });

  it('classe aux points du Massacre', () => {
    const etat = frapper(massacreADeux(), 'alice').etat;

    expect(classementDe(etat).map((ligne) => [ligne.id, ligne.points])).toEqual([
      ['alice', 10],
      ['bob', 0],
    ]);
  });
});

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

  it('dit si la partie est suspendue', () => {
    // La pause est un etat, elle voyage donc dans le flux et pas seulement dans
    // l'annonce: un joueur qui entre dans une partie suspendue doit le savoir.
    const partie = partieADeux();

    expect(instantaneDe(partie).enPause).toBe(false);
    expect(instantaneDe(mettreEnPause(partie)).enPause).toBe(true);
  });

  it('ne laisse fuir ni le terrain ni la graine', () => {
    const instantane = instantaneDe(partieADeux());
    const serialise = JSON.stringify(instantane);

    expect(serialise).not.toContain('terrain');
    expect(serialise).not.toContain('alea');
    expect(serialise).not.toContain('graine');
    expect(Object.keys(instantane).sort()).toEqual([
      'classement',
      'enPause',
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
