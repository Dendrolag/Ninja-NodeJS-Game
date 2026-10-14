/**
 * Tests des sabotages et de la malediction d'Among Ninjas cote serveur (etape 7.22), sans
 * reseau: ce que chaque vue en montre, le nuage noir qui cache aux proies vivantes, les
 * notifications, sans jamais nommer le saboteur ni le fantome, la fin par la surchauffe, et ce
 * que la room fait des demandes.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import { AMONG, LIEUX_DES_CARTES } from '@neon-ninja/shared';
import type { EtatAmong, EtatPartie, IdentifiantEntite, JoueurAmong } from '@neon-ninja/sim';
import { ajouterJoueur, creerEtatInitial, estTueur, lancerLaPartie, tick } from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import { GameRoom } from './GameRoom.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { Notification } from './instantane.js';
import { finAmongDe, notificationsDe } from './instantane.js';
import { VUE_DE_PERSONNE, VUE_DES_FANTOMES, cleDeVue, vuePour, vuesDe } from './vues.js';

/** Un alias qui ne sert jamais: aucune vue d'Among Ninjas ne masque. */
const SANS_ALIAS = (id: string): string => id;

/** Une partie de cinq, nommes j1 a j5, en jeu, la recharge des sabotages passee. */
function enJeu(): EtatPartie {
  let etat = creerEtatInitial({ graine: 11, mode: 'among', reglages: { among: { foule: 0 } } });
  for (let rang = 1; rang <= 5; rang += 1) {
    etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `Joueur ${String(rang)}` });
  }
  const lancee = lancerLaPartie(etat);
  const charges = Object.fromEntries(
    Object.keys(lancee.joueurs).map((id) => [
      id,
      { deplacement: { x: 0, y: 0 }, enMouvement: false, carteChargee: true as const },
    ]),
  );

  return tick(
    tick(tick(lancee, charges, 50), {}, AMONG.DUREE_REVELATION_MS),
    {},
    AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS,
  );
}

function amongDe(etat: EtatPartie): EtatAmong {
  if (etat.among === undefined) {
    throw new Error('La partie devrait etre lancee.');
  }
  return etat.among;
}

/** Le tueur, puis les proies. */
function camps(etat: EtatPartie): { tueur: string; proies: string[] } {
  const ids = Object.keys(etat.joueurs);
  return {
    tueur: ids.find((id) => estTueur(etat, id)) as string,
    proies: ids.filter((id) => !estTueur(etat, id)),
  };
}

function placer(etat: EtatPartie, id: IdentifiantEntite, x: number, y: number): EtatPartie {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`${id} devrait etre la.`);
  }
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueur, position: { x, y } } } };
}

function avecRole(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<JoueurAmong>,
): EtatPartie {
  const among = amongDe(etat);
  const joueur = among.joueurs[id] as JoueurAmong;
  return {
    ...etat,
    among: { ...among, joueurs: { ...among.joueurs, [id]: { ...joueur, ...champs } } },
  };
}

/** Le tueur demande ce sabotage, en un battement. */
function sabote(
  etat: EtatPartie,
  nature: 'flou' | 'nuage' | 'panne' | 'surchauffe',
  station?: number,
): EtatPartie {
  const { tueur } = camps(etat);
  return tick(
    etat,
    {
      [tueur]: {
        deplacement: { x: 0, y: 0 },
        enMouvement: false,
        saboter: { nature, ...(station === undefined ? {} : { station }) },
      },
    },
    50,
  );
}

/** Les identifiants des entites de la vue de ce joueur. */
function vus(etat: EtatPartie, id: IdentifiantEntite): string[] {
  return vuePour(etat, id, SANS_ALIAS).entites.map((entite) => entite.id);
}

/** Les notifications d'un nom, par destinataire. */
function adressees(notifications: readonly Notification[], nom: Notification['nom']): string[] {
  return notifications.filter((notification) => notification.nom === nom).map((n) => n.pour);
}

describe('le nuage noir dans les vues', () => {
  /** Un nuage sur la station 0; une proie dedans, une a son bord, le tueur dedans aussi. */
  function sousLeNuage(): { etat: EtatPartie; tueur: string; proies: string[] } {
    const base = enJeu();
    const { tueur, proies } = camps(base);
    const station = amongDe(base).stations[0] as { x: number; y: number };
    let etat = sabote(base, 'nuage', 0);
    const [dedans, dehors, loin] = proies as [string, string, string];
    etat = placer(etat, tueur, station.x + 40, station.y);
    etat = placer(etat, dedans, station.x - 40, station.y);
    etat = placer(etat, dehors, station.x, station.y + AMONG.RAYON_DU_NUAGE_PX + 60);
    etat = placer(etat, loin, station.x + 2000, station.y + 2000);
    return { etat, tueur, proies };
  }

  it('cache a une proie vivante tout ce qui s y tient, sauf elle-meme', () => {
    const { etat, tueur, proies } = sousLeNuage();
    const [dedans, dehors] = proies as [string, string];

    expect(vus(etat, dehors)).toContain(dehors);
    expect(vus(etat, dehors)).not.toContain(tueur);
    expect(vus(etat, dehors)).not.toContain(dedans);
    // Dedans, on n'y voit personne non plus, hors de soi; ce qui est dehors reste en vue.
    expect(vus(etat, dedans)).toEqual(expect.arrayContaining([dedans, dehors]));
    expect(vus(etat, dedans)).not.toContain(tueur);
  });

  it('ne cache rien aux assassins ni aux fantomes', () => {
    const { etat, tueur, proies } = sousLeNuage();
    const [dedans, dehors] = proies as [string, string];

    expect(vus(etat, tueur)).toEqual(expect.arrayContaining([tueur, dedans]));
    const fantome = avecRole(etat, dehors, { fantome: true });
    expect(cleDeVue(fantome, dehors)).toBe(VUE_DES_FANTOMES);
    expect(vus(fantome, dehors)).toEqual(expect.arrayContaining([tueur, dedans]));
  });

  it('se montre a qui le voit, et pas au loin', () => {
    const { etat, tueur, proies } = sousLeNuage();
    const [, dehors, loin] = proies as [string, string, string];
    const station = amongDe(etat).stations[0] as { x: number; y: number };

    expect(vuePour(etat, dehors, SANS_ALIAS).among?.nuage).toEqual({
      x: station.x,
      y: station.y,
    });
    expect(vuePour(etat, loin, SANS_ALIAS).among?.nuage).toBeUndefined();
    expect(vuePour(etat, tueur, SANS_ALIAS).among?.nuage).toBeDefined();
  });
});

describe('les sabotages dans les vues', () => {
  it('disent la panne et la surchauffe a tous, une nuisance aux seuls assassins', () => {
    const etat = enJeu();
    const { tueur, proies } = camps(etat);
    const proie = proies[0] as string;

    const panne = sabote(etat, 'panne');
    expect(vuePour(panne, proie, SANS_ALIAS).among?.sabotage?.nature).toBe('panne');
    const surchauffe = sabote(etat, 'surchauffe');
    expect(vuePour(surchauffe, proie, SANS_ALIAS).among?.sabotage).toMatchObject({
      nature: 'surchauffe',
      consolesTenues: [false, false],
      consolesPurgees: [false, false],
      interrupteursCoupes: 0,
    });

    const flou = sabote(etat, 'flou');
    expect(vuePour(flou, proie, SANS_ALIAS).among?.sabotage).toBeUndefined();
    expect(vuePour(flou, tueur, SANS_ALIAS).among?.sabotage?.nature).toBe('flou');
  });

  it('nomment la reparation tiree de la panne et de la surchauffe, a tous (etape 7.27)', () => {
    const etat = enJeu();
    const proie = camps(etat).proies[0] as string;
    const { reparations } = amongDe(etat);

    expect(vuePour(sabote(etat, 'panne'), proie, SANS_ALIAS).among?.sabotage?.reparation).toBe(
      reparations.panne,
    );
    expect(vuePour(sabote(etat, 'surchauffe'), proie, SANS_ALIAS).among?.sabotage?.reparation).toBe(
      reparations.surchauffe,
    );
    expect(
      vuePour(sabote(etat, 'flou'), camps(etat).tueur, SANS_ALIAS).among?.sabotage,
    ).not.toHaveProperty('reparation');
  });

  it('disent le relais en cours: les interrupteurs coupes et la console du prochain', () => {
    const etat = sabote(enJeu(), 'surchauffe');
    const among = amongDe(etat);
    const relais: EtatPartie = {
      ...etat,
      among: {
        ...among,
        reparations: { ...among.reparations, surchauffe: 'relais' },
        sabotage: {
          ...(among.sabotage as NonNullable<typeof among.sabotage>),
          interrupteursCoupes: 2,
          prochaineConsole: 1,
        },
      },
    };
    const proie = camps(etat).proies[0] as string;

    expect(vuePour(relais, proie, SANS_ALIAS).among?.sabotage).toMatchObject({
      reparation: 'relais',
      interrupteursCoupes: 2,
      prochaineConsole: 1,
    });
  });

  it('donnent la recharge aux assassins et aux fantomes, la malediction aux seuls fantomes', () => {
    const etat = sabote(enJeu(), 'flou');
    const { tueur, proies } = camps(etat);
    const [proie, morte] = proies as [string, string];
    const avecUnFantome = avecRole(etat, morte, { fantome: true });

    const deLaProie = vuePour(avecUnFantome, proie, SANS_ALIAS).among;
    expect(deLaProie).not.toHaveProperty('rechargeDesSabotagesMs');
    expect(deLaProie).not.toHaveProperty('rechargeDeLaMaledictionMs');

    const duTueur = vuePour(avecUnFantome, tueur, SANS_ALIAS).among;
    expect(duTueur?.rechargeDesSabotagesMs).toBe(0);
    expect(duTueur).not.toHaveProperty('rechargeDeLaMaledictionMs');

    const desFantomes = vuePour(avecUnFantome, morte, SANS_ALIAS).among;
    expect(desFantomes?.rechargeDesSabotagesMs).toBe(0);
    expect(desFantomes?.rechargeDeLaMaledictionMs).toBe(0);

    const personne = vuesDe(avecUnFantome, [VUE_DE_PERSONNE], SANS_ALIAS).get(VUE_DE_PERSONNE);
    expect(personne?.entites).toEqual([]);
    expect(personne?.among).not.toHaveProperty('sabotage');
    expect(personne?.among).not.toHaveProperty('rechargeDesSabotagesMs');
  });

  it('reduisent ce qu une proie recoit pendant la panne', () => {
    const etat = enJeu();
    const { tueur, proies } = camps(etat);
    const proie = proies[0] as string;
    const pres = placer(placer(etat, proie, 1000, 700), tueur, 1180, 700);

    expect(vus(pres, proie)).toContain(tueur);
    expect(vus(sabote(pres, 'panne'), proie)).not.toContain(tueur);
    // L'assassin, lui, voit toujours aussi loin.
    expect(vus(sabote(pres, 'panne'), tueur)).toContain(proie);
  });
});

describe('les notifications des sabotages', () => {
  it('frappent les proies vivantes d une nuisance, sans auteur, et le disent aux assassins', () => {
    const etat = enJeu();
    const { tueur, proies } = camps(etat);
    const [, morte] = proies as [string, string];
    const apres = sabote(avecRole(etat, morte, { fantome: true }), 'flou');
    const notifications = notificationsDe(apres);
    const vivantes = proies.filter((id) => id !== morte);

    expect(adressees(notifications, 'malusSubi').sort()).toEqual([...vivantes].sort());
    for (const notification of notifications.filter((n) => n.nom === 'malusSubi')) {
      expect(notification.charge).toEqual({
        nature: 'flou',
        dureeMs: AMONG.DUREE_D_UNE_NUISANCE_MS,
        parPseudo: '',
        origine: 'sabotage',
      });
    }
    expect(adressees(notifications, 'sabotage').sort()).toEqual([tueur, morte].sort());
    expect(JSON.stringify(notifications.filter((n) => n.pour !== tueur))).not.toContain(tueur);
  });

  it('disent la panne a tous, et sa reparation', () => {
    const etat = sabote(enJeu(), 'panne');
    expect(adressees(notificationsDe(etat), 'sabotage')).toHaveLength(5);
    // Le lancement nomme la reparation tiree (etape 7.27).
    expect(notificationsDe(etat).find((n) => n.nom === 'sabotage')?.charge).toEqual({
      quoi: 'lance',
      nature: 'panne',
      reparation: amongDe(etat).reparations.panne,
    });

    const proie = camps(etat).proies[0] as string;
    const boitier = (LIEUX_DES_CARTES.map1 as { boitier: { x: number; y: number } }).boitier;
    const au = placer(etat, proie, boitier.x, boitier.y);
    const immobile = { deplacement: { x: 0, y: 0 }, enMouvement: false } as const;
    const ouverte = tick(au, { [proie]: { ...immobile, agir: true } }, 50);
    const reparee = tick(
      tick(ouverte, {}, 3000),
      { [proie]: { ...immobile, reparation: 'finie' } },
      50,
    );
    const fins = notificationsDe(reparee).filter((n) => n.nom === 'sabotage');

    expect(fins).toHaveLength(5);
    expect(fins[0]?.charge).toEqual({ quoi: 'fini', nature: 'panne', repare: true });
  });

  it('frappent les assassins d une malediction, sans nommer le fantome, dite aux fantomes', () => {
    const base = tick(enJeu(), {}, AMONG.DELAI_DE_LA_MALEDICTION_MS);
    const { tueur, proies } = camps(base);
    const fantome = proies[0] as string;
    const etat = avecRole(base, fantome, { fantome: true });
    const apres = tick(
      etat,
      {
        [fantome]: {
          deplacement: { x: 0, y: 0 },
          enMouvement: false,
          maudire: 'controlesInverses',
        },
      },
      50,
    );
    const notifications = notificationsDe(apres);

    expect(notifications.filter((n) => n.nom === 'malusSubi')).toEqual([
      {
        nom: 'malusSubi',
        pour: tueur,
        charge: {
          nature: 'controlesInverses',
          dureeMs: AMONG.DUREE_DE_LA_MALEDICTION_MS,
          parPseudo: '',
          origine: 'malediction',
        },
      },
    ]);
    expect(adressees(notifications, 'malediction')).toEqual([fantome]);
    expect(JSON.stringify(notifications.filter((n) => n.pour === tueur))).not.toContain(fantome);
  });
});

describe('la fin par la surchauffe', () => {
  it('dit que la surchauffe a fait gagner les assassins', () => {
    const perdue = tick(sabote(enJeu(), 'surchauffe'), {}, AMONG.DELAI_DE_LA_SURCHAUFFE_MS);

    expect(finAmongDe(perdue)).toMatchObject({ vainqueur: 'tueurs', parLaSurchauffe: true });
  });
});

describe('la room et les sabotages', () => {
  const invite = (pseudo: string): SessionJoueur => ({ id: `s-${pseudo}`, pseudo });

  /** Une room de cinq joueurs, lancee, la revelation et la recharge des sabotages passees. */
  function roomLancee(): GameRoom {
    const room = new GameRoom({
      id: 'room-among',
      graine: 5,
      mode: 'among',
      horloge: creerHorlogeManuelle(),
      reglages: { among: { foule: 0 } },
    });
    for (const pseudo of ['A', 'B', 'C', 'D', 'E']) {
      room.accueillir(invite(pseudo));
    }
    room.lancer();
    for (const joueur of room.joueurs) {
      room.signalerLeChargement(joueur.id);
    }
    room.avancer(50);
    room.avancer(AMONG.DUREE_REVELATION_MS);
    room.avancer(AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS);
    return room;
  }

  it('passe un sabotage au moteur le temps d un battement', () => {
    const room = roomLancee();
    const { tueur } = camps(room.etat);

    room.saboter(tueur, { nature: 'panne' });
    room.avancer(50);
    expect(room.etat.among?.sabotage?.nature).toBe('panne');
    // Le sabotage ne se rejoue pas au battement suivant: le moteur le refuserait de toute facon.
    room.avancer(50);
    expect(room.etat.among?.sabotage?.nature).toBe('panne');
  });

  it('ignore une demande hors d une partie en cours, ou d un absent', () => {
    const room = new GameRoom({
      id: 'r',
      graine: 5,
      mode: 'among',
      horloge: creerHorlogeManuelle(),
    });
    room.saboter('s-A', { nature: 'panne' });
    room.maudire('s-A', 'flou');
    expect(room.etat.among).toBeUndefined();

    const lancee = roomLancee();
    lancee.saboter('inconnu', { nature: 'panne' });
    lancee.maudire('inconnu', 'flou');
    lancee.avancer(50);
    expect(lancee.etat.among?.sabotage).toBeUndefined();
  });
});
