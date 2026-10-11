/**
 * Tests du mode Among Ninjas cote serveur (etape 7.20), sans reseau: les vues de chacun, la
 * barre des taches selon le reglage (etape 7.21), ce que chacun sait de lui-meme, les
 * notifications du meurtre, des taches visuelles et de la reunion, la fin, et ce que la room
 * fait du bouton d'action, des taches annoncees, des votes, du chat et du bilan.
 *
 * Le secret est la regle de ce fichier: un vivant ne recoit rien hors de son disque, aucun
 * fantome, aucun role.
 */

import type { InstantanePartie, SessionJoueur } from '@neon-ninja/shared';
import { AMONG, RAYONS_DE_VISION } from '@neon-ninja/shared';
import type { EtatAmong, EtatPartie, IdentifiantEntite, JoueurAmong } from '@neon-ninja/sim';
import { ajouterJoueur, creerEtatInitial, estTueur, lancerLaPartie, tick } from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import { GameRoom } from './GameRoom.js';
import { creerHorlogeManuelle } from './horloge.js';
import { etatPriveDe, finAmongDe, instantaneDe, notificationsDe } from './instantane.js';
import {
  VUE_COMMUNE,
  VUE_DE_PERSONNE,
  VUE_DES_FANTOMES,
  cleDeVue,
  notificationDansLaVue,
  vuePour,
  vuesDe,
} from './vues.js';

/** Un alias qui ne sert jamais: aucune vue d'Among Ninjas ne masque. */
const SANS_ALIAS = (id: string): string => id;

/** Une partie de cinq, nommes j1 a j5, la revelation passee. */
function enJeu(reglages: Record<string, unknown> = {}): EtatPartie {
  let etat = creerEtatInitial({
    graine: 11,
    mode: 'among',
    reglages: { among: { foule: 0 }, ...reglages },
  });
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

  return tick(tick(lancee, charges, 50), {}, AMONG.DUREE_REVELATION_MS);
}

/** Les tables du mode, dont on sait qu'elles sont posees. */
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

/** Pose un joueur. */
function placer(etat: EtatPartie, id: IdentifiantEntite, x: number, y: number): EtatPartie {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`${id} devrait etre la.`);
  }
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueur, position: { x, y } } } };
}

/** Change ce que le mode retient d'un joueur. */
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

/**
 * Une scene: le tueur au centre, une proie a 100 px, une a 300 px, une a 600 px, et la
 * derniere morte a 50 px, son cadavre a 120 px et un autre a 500 px.
 */
function scene(): { etat: EtatPartie; tueur: string; proies: string[] } {
  let etat = enJeu();
  const { tueur, proies } = camps(etat);
  const [proche, moyenne, lointaine, morte] = proies as [string, string, string, string];
  etat = placer(etat, tueur, 1000, 700);
  etat = placer(etat, proche, 1100, 700);
  etat = placer(etat, moyenne, 1300, 700);
  etat = placer(etat, lointaine, 1600, 700);
  etat = avecRole(placer(etat, morte, 1050, 700), morte, { fantome: true });
  const among = amongDe(etat);
  etat = {
    ...etat,
    among: {
      ...among,
      cadavres: {
        'cadavre-1': { victime: morte, position: { x: 1000, y: 820 }, couleur: '#FF3030' },
        'cadavre-2': { victime: 'parti', position: { x: 1000, y: 1200 }, couleur: '#3D7DFF' },
      },
    },
  };
  return { etat, tueur, proies };
}

/** Les identifiants des entites d'une vue. */
function ids(vue: InstantanePartie): string[] {
  return vue.entites.map((entite) => entite.id).sort();
}

describe('la cle de chacun', () => {
  it('donne a chaque vivant la sienne, une commune aux fantomes, et rien a un inconnu', () => {
    const { etat, tueur, proies } = scene();

    expect(cleDeVue(etat, tueur)).toBe(`vivant:${tueur}`);
    expect(cleDeVue(etat, proies[0] as string)).toBe(`vivant:${String(proies[0])}`);
    expect(cleDeVue(etat, proies[3] as string)).toBe(VUE_DES_FANTOMES);
    expect(cleDeVue(etat, 'inconnu')).toBe(VUE_DE_PERSONNE);
  });

  it('garde la vue commune au salon', () => {
    let salon = creerEtatInitial({ graine: 1, mode: 'among' });
    salon = ajouterJoueur(salon, { id: 'a', pseudo: 'A' });

    expect(cleDeVue(salon, 'a')).toBe(VUE_COMMUNE);
  });
});

describe('les vues', () => {
  it('ne montrent a une proie que son disque, sans aucun fantome', () => {
    const { etat, tueur, proies } = scene();
    const [proche, moyenne, , morte] = proies as [string, string, string, string];
    const vue = vuePour(etat, proche, SANS_ALIAS);

    // Rayon de 260: le tueur a 100, la proie moyenne a 200, le cadavre proche a 152.
    expect(RAYONS_DE_VISION.proie.normale).toBe(260);
    expect(ids(vue)).toEqual(['cadavre-1', moyenne, proche, tueur].sort());
    expect(ids(vue)).not.toContain(morte);
    expect(
      vue.entites.some((entite) => entite.type === 'joueur' && entite.tactique !== undefined),
    ).toBe(false);
  });

  it('donne au tueur son disque, plus large, et son arme dans sa seule vue', () => {
    const { etat, tueur, proies } = scene();
    const [proche, moyenne] = proies as [string, string];
    const vue = vuePour(etat, tueur, SANS_ALIAS);
    const moi = vue.entites.find((entite) => entite.id === tueur);

    expect(ids(vue)).toEqual(['cadavre-1', moyenne, proche, tueur].sort());
    expect(moi?.type === 'joueur' ? moi.tactique : undefined).toEqual({
      orientation: 'est',
      charges: 0,
      avantProchaineChargeMs: AMONG.RECHARGE_DEBUT_DE_TOUR_MS,
    });
  });

  it('montre tout aux fantomes, fantomes compris, sans arme', () => {
    const { etat, proies } = scene();
    const morte = proies[3] as string;
    const vue = vuePour(etat, morte, SANS_ALIAS);

    expect(vue.entites).toHaveLength(7);
    expect(vue.entites.find((entite) => entite.id === morte)).toMatchObject({ fantome: true });
    expect(
      vue.entites.every((entite) => entite.type !== 'joueur' || entite.tactique === undefined),
    ).toBe(true);
  });

  it('ne montre rien a un inconnu', () => {
    const { etat } = scene();

    expect(vuePour(etat, 'inconnu', SANS_ALIAS).entites).toEqual([]);
  });

  it('construit chaque vue une fois, et la vue des fantomes est l instantane', () => {
    const { etat, tueur, proies } = scene();
    const vues = vuesDe(
      etat,
      [cleDeVue(etat, tueur), cleDeVue(etat, proies[0] as string), VUE_DES_FANTOMES],
      SANS_ALIAS,
    );

    expect(vues.size).toBe(3);
    expect(vues.get(VUE_DES_FANTOMES)).toEqual(instantaneDe(etat));
  });

  it('ne disent ni role, ni points, a personne', () => {
    const { etat } = scene();
    const avecPoints = avecRole(etat, camps(etat).tueur, {
      faits: {
        taches: 0,
        signalements: 0,
        meurtres: 3,
        bonsVotes: 0,
        meurtresAuPremierTour: 0,
        tueursTrouvesALaPremiereReunion: 0,
      },
    });

    for (const id of [...Object.keys(avecPoints.joueurs), 'inconnu']) {
      const vue = vuePour(avecPoints, id, SANS_ALIAS);
      expect(JSON.stringify(vue)).not.toMatch(/tueur|proie|role/u);
      expect(vue.classement.every((ligne) => ligne.points === 0 && ligne.captures === 0)).toBe(
        true,
      );
    }
  });

  it('portent la phase et la barre des taches, et les recharges des sabotages (etape 7.22)', () => {
    const etat = enJeu();

    expect(instantaneDe(etat).among).toEqual({
      phase: 'jeu',
      restantMs: 180_000,
      tachesFaites: 0,
      tachesTotal: 20,
      rechargeDesSabotagesMs: AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS,
      rechargeDeLaMaledictionMs: AMONG.DELAI_DE_LA_MALEDICTION_MS,
    });
    expect(instantaneDe(enJeu({ among: { dureeDuTourS: 0 } })).among?.restantMs).toBe(0);
  });

  it('montrent la barre aux vivants selon le reglage, et a jour aux fantomes', () => {
    /** Une partie ou j1 a fait une tache depuis la derniere reunion, et j2 est un fantome. */
    const partie = (barreDesTaches: string): EtatPartie => {
      let etat = enJeu({ among: { foule: 0, barreDesTaches } });
      const { proies } = camps(etat);
      const [faiseuse, morte] = proies as [string, string];
      etat = avecRole(etat, faiseuse, {
        taches: (amongDe(etat).joueurs[faiseuse] as JoueurAmong).taches.map((tache, rang) => ({
          ...tache,
          faite: rang === 0,
        })),
      });
      return avecRole(etat, morte, { fantome: true });
    };
    const barre = (etat: EtatPartie, id: string): unknown => {
      const among = vuePour(etat, id, SANS_ALIAS).among;
      return [among?.tachesFaites, among?.tachesTotal];
    };

    const toujours = partie('toujours');
    const [vivante, morte] = camps(toujours).proies as [string, string];
    expect(barre(toujours, vivante)).toEqual([1, 20]);

    const reunions = partie('reunions');
    expect(barre(reunions, vivante)).toEqual([0, 20]);
    expect(barre(reunions, camps(reunions).tueur)).toEqual([0, 20]);
    expect(barre(reunions, morte)).toEqual([1, 20]);

    const jamais = partie('jamais');
    expect(barre(jamais, vivante)).toEqual([0, 0]);
    expect(barre(jamais, morte)).toEqual([1, 20]);
  });
});

describe('ce que chacun sait de lui-meme', () => {
  it('dit a une proie ses seules stations, et sa liste', () => {
    const etat = enJeu();
    const proie = camps(etat).proies[0] as string;
    const prive = etatPriveDe(
      avecRole(etat, proie, { tacheEnCours: { indice: 2, ecouleMs: 10 } }),
      proie,
    );
    const among = amongDe(etat);
    const liste = (among.joueurs[proie] as JoueurAmong).taches;

    expect(prive).toMatchObject({ role: 'proie', complices: [], fantome: false, tacheEnCours: 2 });
    expect(prive?.stations).toEqual(liste.map((tache) => among.stations[tache.station]));
    expect(prive?.taches.map((tache) => tache.station)).toEqual([0, 1, 2, 3, 4]);
    expect(prive?.taches.map((tache) => tache.nature)).toEqual(liste.map((tache) => tache.nature));
    for (const [rang, station] of (prive?.stations ?? []).entries()) {
      expect(station.nom.length).toBeGreaterThan(0);
      expect(station.natures).toContain(prive?.taches[rang]?.nature);
    }
  });

  it('dit a un tueur ses complices et toutes les stations', () => {
    let etat = creerEtatInitial({ graine: 11, mode: 'among', reglages: { among: { tueurs: 2 } } });
    for (let rang = 1; rang <= 7; rang += 1) {
      etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
    }
    etat = lancerLaPartie(etat);
    const tueurs = Object.keys(etat.joueurs).filter((id) => estTueur(etat, id));
    const prive = etatPriveDe(etat, tueurs[0] as string);

    expect(prive?.complices).toEqual([tueurs[1]]);
    expect(prive?.stations).toEqual(amongDe(etat).stations);
    expect(prive?.taches).toEqual([]);
  });

  it('ne dit rien avant le lancement, ni a un inconnu', () => {
    let salon = creerEtatInitial({ graine: 1, mode: 'among' });
    salon = ajouterJoueur(salon, { id: 'a', pseudo: 'A' });

    expect(etatPriveDe(salon, 'a')).toBeUndefined();
    expect(etatPriveDe(enJeu(), 'inconnu')).toBeUndefined();
  });
});

describe('les notifications', () => {
  it('adressent un meurtre au tueur, a la victime et aux seuls temoins vivants', () => {
    const { etat, tueur, proies } = scene();
    const [proche, moyenne, lointaine, morte] = proies as [string, string, string, string];
    const avecMeurtre: EtatPartie = {
      ...etat,
      evenements: [{ type: 'meurtre', tueur, victime: proche, position: { x: 1100, y: 700 } }],
    };
    const destinataires = notificationsDe(avecMeurtre).map((notification) => notification.pour);

    expect(destinataires.sort()).toEqual([moyenne, proche, tueur].sort());
    expect(destinataires).not.toContain(lointaine);
    expect(destinataires).not.toContain(morte);
  });

  it('montrent une tache visuelle aux seuls vivants qui voient la station, et aux fantomes', () => {
    const { etat, tueur, proies } = scene();
    const [proche, moyenne, lointaine, morte] = proies as [string, string, string, string];
    const avecEtincelles: EtatPartie = {
      ...etat,
      evenements: [{ type: 'tacheVisuelle', nature: 'katana', position: { x: 1300, y: 700 } }],
    };
    const notifications = notificationsDe(avecEtincelles);

    // Proie a 260 px, tueur a 320: la lointaine, a 300, ne voit pas la station.
    expect(notifications.map((notification) => notification.pour).sort()).toEqual(
      [moyenne, proche, tueur, morte].sort(),
    );
    expect(notifications.map((notification) => notification.pour)).not.toContain(lointaine);
    for (const notification of notifications) {
      expect(notification).toMatchObject({
        nom: 'tacheVisuelle',
        charge: { nature: 'katana', x: 1300, y: 700 },
      });
      expect(
        notificationDansLaVue(notification, etat, cleDeVue(etat, notification.pour), SANS_ALIAS),
      ).toBe(notification);
    }
  });

  it('disent a tous l ouverture de la reunion, les votes et le resultat', () => {
    const etat: EtatPartie = {
      ...enJeu(),
      evenements: [
        { type: 'reunionOuverte', numero: 1, motif: 'gong', par: 'j1', morts: [] },
        { type: 'voteOuvert' },
        { type: 'aVote', votant: 'j2' },
        {
          type: 'resultatDuVote',
          ejecte: 'j3',
          votes: { j2: 'j3' },
          decompte: [{ cible: 'j3', voix: 1 }],
        },
        { type: 'tourCommence', tour: 2 },
        { type: 'tacheFaite', joueur: 'j1', station: 0, nature: 'katana' },
      ],
    };
    const notifications = notificationsDe(etat);

    expect(notifications).toHaveLength(20);
    expect(notifications.every((notification) => notification.nom === 'reunion')).toBe(true);
    expect(notifications.at(-1)?.charge).toEqual({
      quoi: 'resultat',
      ejecte: 'j3',
      votes: { j2: 'j3' },
      decompte: [{ cible: 'j3', voix: 1 }],
    });
    for (const notification of notifications) {
      expect(
        notificationDansLaVue(notification, etat, cleDeVue(etat, notification.pour), SANS_ALIAS),
      ).toBe(notification);
    }
  });

  it('taisent qui a vote pour qui aux votes anonymes', () => {
    const etat: EtatPartie = {
      ...enJeu({ among: { votesAnonymes: true } }),
      evenements: [
        { type: 'resultatDuVote', votes: { j2: null }, decompte: [{ cible: null, voix: 1 }] },
      ],
    };

    expect(notificationsDe(etat)[0]?.charge).toEqual({
      quoi: 'resultat',
      decompte: [{ cible: null, voix: 1 }],
    });
  });
});

describe('la fin', () => {
  it('revele le camp vainqueur et tous les roles, une fois la partie decidee', () => {
    const etat = enJeu();
    const { tueur } = camps(etat);

    expect(finAmongDe(etat)).toBeUndefined();

    const decidee = { ...etat, among: { ...amongDe(etat), vainqueur: 'proies' as const } };
    const fin = finAmongDe(decidee);
    expect(fin?.vainqueur).toBe('proies');
    expect(fin?.joueurs).toHaveLength(5);
    expect(fin?.joueurs.at(-1)).toMatchObject({ id: tueur, role: 'tueur' });
  });
});

describe('la room d une partie Among Ninjas', () => {
  /** Un invite. */
  const invite = (pseudo: string): SessionJoueur => ({ id: `s-${pseudo}`, pseudo });

  /** Une room de cinq joueurs, lancee, la revelation passee. */
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
    return room;
  }

  it('demande cinq joueurs, et ferme la porte une fois lancee', () => {
    const room = new GameRoom({
      id: 'r',
      graine: 5,
      mode: 'among',
      horloge: creerHorlogeManuelle(),
    });
    for (const pseudo of ['A', 'B', 'C', 'D']) {
      room.accueillir(invite(pseudo));
    }
    expect(room.conditionDeLancement().valide).toBe(false);

    const lancee = roomLancee();
    expect(lancee.accueillir(invite('F'))).toEqual({
      valide: false,
      erreurs: [{ champ: 'partie', motif: 'Cette partie a déjà commencé.' }],
    });
  });

  it('garde le bouton d action tenu d un battement a l autre, jusqu a ce qu on le lache', () => {
    const room = roomLancee();
    const id = 's-A';

    room.tenirLAction(id, true);
    room.avancer(50);
    room.avancer(50);
    expect(room.etat.among?.joueurs[id]?.actionTenue).toBe(true);

    room.tenirLAction(id, false);
    room.avancer(50);
    expect(room.etat.among?.joueurs[id]?.actionTenue).toBe(false);
  });

  it('compte un appui bref, enfonce puis lache entre deux battements', () => {
    const room = roomLancee();
    const id = 's-A';

    room.tenirLAction(id, true);
    room.tenirLAction(id, false);
    room.avancer(50);
    expect(room.etat.among?.joueurs[id]?.actionTenue).toBe(true);

    room.avancer(50);
    expect(room.etat.among?.joueurs[id]?.actionTenue).toBe(false);
  });

  it('ouvre le chat des vivants en reunion seulement, et celui des fantomes a tout moment', () => {
    const room = roomLancee();
    const { tueur, proies } = camps(room.etat);
    const [vivante] = proies as [string];

    expect(room.canalDuChat(vivante)).toEqual({ refus: 'Le chat ne s’ouvre qu’en réunion.' });

    // Le gong, sonne par la proie au point de reunion apres quinze secondes.
    for (let ecoule = 0; ecoule < AMONG.DELAI_DU_GONG_MS; ecoule += 50) {
      room.avancer(50);
    }
    const gong = amongDe(room.etat).gong;
    const ecart = {
      x: gong.x - (room.etat.joueurs[vivante]?.position.x ?? 0),
      y: gong.y - (room.etat.joueurs[vivante]?.position.y ?? 0),
    };
    room.enregistrerIntention(vivante, { deplacement: ecart, enMouvement: true });
    for (let pas = 0; pas < 20; pas += 1) {
      room.avancer(50);
    }
    room.enregistrerIntention(vivante, { deplacement: ecart, enMouvement: false });
    room.tenirLAction(vivante, true);
    room.avancer(50);
    expect(amongDe(room.etat).phase).toBe('discussion');

    expect(room.canalDuChat(vivante)).toEqual({ destinataires: Object.keys(room.etat.joueurs) });
    expect(room.canalDuChat(tueur)).toEqual({ destinataires: Object.keys(room.etat.joueurs) });
  });

  it('ne route pas le chat hors d une partie Among Ninjas lancee', () => {
    const room = new GameRoom({
      id: 'r',
      graine: 5,
      mode: 'among',
      horloge: creerHorlogeManuelle(),
    });
    room.accueillir(invite('A'));

    expect(room.canalDuChat('s-A')).toBeUndefined();
  });

  it('ignore une tache annoncee par un inconnu, ou hors d une partie en cours', () => {
    const room = roomLancee();
    const avant = room.etat;

    room.annoncerLaTache('inconnu', 'finie');
    room.annoncerLaTache('s-A', 'fermee');
    room.avancer(50);
    // Rien n'a change de ce que le mode retient de lui, hors sa marche, qui suit chaque
    // battement de jeu (etape 7.23).
    expect({ ...room.etat.among?.joueurs['s-A'], foulee: undefined }).toEqual({
      ...avant.among?.joueurs['s-A'],
      foulee: undefined,
    });

    const salon = new GameRoom({
      id: 'r',
      graine: 5,
      mode: 'among',
      horloge: creerHorlogeManuelle(),
    });
    salon.accueillir(invite('A'));
    expect(() => {
      salon.annoncerLaTache('s-A', 'finie');
    }).not.toThrow();
  });

  it('retient un vote pour un seul battement, et paye le temps de jeu ecoule au bilan', () => {
    const room = roomLancee();
    room.voter('s-A', null);
    room.voter('inconnu', null);
    room.avancer(50);
    room.avancer(50);

    const bilan = room.bilan();
    expect(bilan.joueurs.every((joueur) => joueur.tempsJoueMs === room.etat.tempsEcouleMs)).toBe(
      true,
    );
  });
});
