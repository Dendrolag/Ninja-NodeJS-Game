/**
 * Tests du mode Among Ninjas (etape 7.20): le lancement et ses tirages, les phases et le
 * monde fige, le meurtre et le cadavre, les fantomes, le bouton d'action (signaler, sonner,
 * ouvrir sa tache), les taches courtes (etape 7.21), la reunion et le vote, la victoire, les
 * departs et les points.
 *
 * Aucune version du jeu d'origine n'a ce mode, donc aucune caracterisation: les attentes sont
 * la fiche docs/plan/etape-7-20.md et les valeurs confirmees par le porteur du projet le 6
 * octobre 2026.
 */

import type { NatureDeTache, Position, ReglagesPartiels } from '@neon-ninja/shared';
import {
  AMONG,
  AMONG_PAR_DEFAUT,
  CARTES,
  COULEURS_DES_JOUEURS_AMONG,
  COULEUR_DE_LA_FOULE,
  DUREES_MINIMALES_DES_TACHES_MS,
  LIEUX_DES_CARTES,
  NATURES_DE_TACHE,
  POINTS_AMONG,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import {
  avancementDesTaches,
  campVainqueur,
  estFantome,
  estTueur,
  fantomesEnAmong,
  mondeFigeEnAmong,
  pointsEnAmong,
  rayonDeVision,
} from './among.js';
import { peuplerDeBots } from './bots.js';
import { creerCarteCollisions } from './collisions.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import type { EtatAmong, EvenementAmong, JoueurAmong } from './etatAmong.js';
import type { EntreeJoueur, Entrees } from './moteur.js';
import { REGLES_DES_MODES, evaluerFinDePartie, lancerLaPartie, tick } from './moteur.js';
import { calculerScores } from './score.js';

/** Une entree sans deplacement, a completer d'un geste. */
const IMMOBILE: EntreeJoueur = { deplacement: { x: 0, y: 0 }, enMouvement: false };

/** Le gong de Tokyo, dans le sens normal. */
const GONG = (LIEUX_DES_CARTES.map1 as { gong: Position }).gong;

/** Une partie Among Ninjas au salon, avec ces joueurs, nommes j1, j2... */
function salon(joueurs: number, reglages: ReglagesPartiels = {}, graine = 7): EtatPartie {
  let etat = creerEtatInitial({ graine, mode: 'among', reglages });

  for (let rang = 1; rang <= joueurs; rang += 1) {
    etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `Joueur ${String(rang)}` });
  }

  return etat;
}

/** Une partie lancee, qui attend que chacun ait charge la carte. */
function lancee(joueurs = 5, reglages: ReglagesPartiels = {}, graine = 7): EtatPartie {
  return lancerLaPartie(salon(joueurs, reglages, graine));
}

/** Ces joueurs disent avoir charge la carte. */
function charges(ids: readonly IdentifiantEntite[]): Entrees {
  return Object.fromEntries(ids.map((id) => [id, { ...IMMOBILE, carteChargee: true as const }]));
}

/** Une partie lancee, chacun ayant charge la carte: la revelation commence. */
function revelee(joueurs = 5, reglages: ReglagesPartiels = {}, graine = 7): EtatPartie {
  const etat = lancee(joueurs, reglages, graine);

  return tick(etat, charges(Object.keys(etat.joueurs)), 50);
}

/** Une partie lancee, la revelation passee: le premier tour commence. */
function enJeu(joueurs = 5, reglages: ReglagesPartiels = {}, graine = 7): EtatPartie {
  return tick(revelee(joueurs, reglages, graine), {}, AMONG.DUREE_REVELATION_MS);
}

/** Les tables du mode, dont on sait qu'elles sont posees. */
function amongDe(etat: EtatPartie): EtatAmong {
  if (etat.among === undefined) {
    throw new Error('La partie devrait etre lancee.');
  }
  return etat.among;
}

/** Ce que le mode retient d'un joueur present. */
function role(etat: EtatPartie, id: IdentifiantEntite): JoueurAmong {
  const joueur = amongDe(etat).joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Un joueur present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Les tueurs, puis les proies, dans l'ordre de l'etat. */
function camps(etat: EtatPartie): { tueurs: IdentifiantEntite[]; proies: IdentifiantEntite[] } {
  const ids = Object.keys(etat.joueurs);
  return {
    tueurs: ids.filter((id) => estTueur(etat, id)),
    proies: ids.filter((id) => !estTueur(etat, id)),
  };
}

/** Le premier tueur et la premiere proie. */
function unTueurEtUneProie(etat: EtatPartie): { tueur: string; proie: string } {
  const { tueurs, proies } = camps(etat);
  return { tueur: tueurs[0] as string, proie: proies[0] as string };
}

/** Pose un joueur a cette place. */
function placer(etat: EtatPartie, id: IdentifiantEntite, position: Position): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), position } } };
}

/** Remplace ce que le mode retient d'un joueur. */
function avecRole(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<JoueurAmong>,
): EtatPartie {
  const among = amongDe(etat);
  return {
    ...etat,
    among: { ...among, joueurs: { ...among.joueurs, [id]: { ...role(etat, id), ...champs } } },
  };
}

/** Ecarte tout le monde les uns des autres, loin du gong et des stations. */
function disperser(etat: EtatPartie): EtatPartie {
  let courant = etat;
  Object.keys(etat.joueurs).forEach((id, rang) => {
    courant = placer(courant, id, { x: 120 + rang * 150, y: 820 });
  });
  return courant;
}

/** Les evenements du mode dans le journal d'un battement. */
function evenements<T extends EvenementAmong['type']>(
  etat: EtatPartie,
  type: T,
): Extract<EvenementAmong, { type: T }>[] {
  return etat.evenements.filter(
    (evenement): evenement is Extract<EvenementAmong, { type: T }> => evenement.type === type,
  );
}

/** Une entree qui ne fait qu'un geste. */
function geste(champs: Partial<EntreeJoueur>): EntreeJoueur {
  return { ...IMMOBILE, ...champs };
}

/** La partie en jeu, recharge des tueurs finie, tout le monde disperse. */
function pretATuer(joueurs = 5, reglages: ReglagesPartiels = {}): EtatPartie {
  return disperser(tick(enJeu(joueurs, reglages), {}, AMONG.RECHARGE_DEBUT_DE_TOUR_MS));
}

/** Un tueur tue cette proie, collee a lui. */
function meurtre(etat: EtatPartie, tueur: string, proie: string): EtatPartie {
  const place = joueurDe(etat, tueur).position;
  return tick(
    placer(etat, proie, { x: place.x + 20, y: place.y }),
    {
      [tueur]: geste({ capturer: true }),
    },
    50,
  );
}

describe('le lancement', () => {
  it('borne le nombre de tueurs au nombre de joueurs', () => {
    expect(camps(lancee(5, { among: { tueurs: 3 } })).tueurs).toHaveLength(1);
    expect(camps(lancee(6, { among: { tueurs: 2 } })).tueurs).toHaveLength(1);
    expect(camps(lancee(7, { among: { tueurs: 3 } })).tueurs).toHaveLength(2);
    expect(camps(lancee(9, { among: { tueurs: 3 } })).tueurs).toHaveLength(3);
    expect(camps(lancee(12, { among: { tueurs: 1 } })).tueurs).toHaveLength(1);
  });

  it('tire les memes roles et les memes listes a graine egale, d autres a une autre graine', () => {
    expect(lancee(8, {}, 3).among).toEqual(lancee(8, {}, 3).among);

    const tirages = new Set(
      [1, 2, 3, 4, 5, 6].map((graine) => camps(lancee(8, {}, graine)).tueurs.join(',')),
    );
    expect(tirages.size).toBeGreaterThan(1);
  });

  it('active autant de stations que de taches par proie, plus quatre', () => {
    const among = amongDe(lancee(5, { among: { tachesParProie: 6 } }));
    const toutes = (LIEUX_DES_CARTES.map1 as { stations: readonly Position[] }).stations;

    expect(among.stations).toHaveLength(10);
    expect(new Set(among.stations).size).toBe(10);
    for (const station of among.stations) {
      expect(toutes).toContainEqual(station);
    }
  });

  it('donne a chaque proie sa liste, de stations distinctes, chaque tache prise a sa station', () => {
    const etat = lancee(7, { among: { tachesParProie: 5 } });
    const { tueurs, proies } = camps(etat);
    const stations = amongDe(etat).stations;

    for (const id of tueurs) {
      expect(role(etat, id).taches).toEqual([]);
    }

    for (const id of proies) {
      const taches = role(etat, id).taches;
      expect(taches).toHaveLength(5);
      expect(new Set(taches.map((tache) => tache.station)).size).toBe(5);

      for (const tache of taches) {
        expect(tache.faite).toBe(false);
        expect(stations[tache.station]?.natures).toContain(tache.nature);
      }
    }

    expect(avancementDesTaches(amongDe(etat))).toEqual({ faites: 0, total: 25 });
  });

  it('repartit les listes sur toutes les stations actives', () => {
    for (const graine of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const etat = lancee(12, { among: { tueurs: 2, tachesParProie: 5 } }, graine);
      const prises = amongDe(etat).stations.map(() => 0);

      for (const id of camps(etat).proies) {
        for (const tache of role(etat, id).taches) {
          prises[tache.station] = (prises[tache.station] ?? 0) + 1;
        }
      }

      // Dix proies, cinq taches chacune, neuf stations: cinq ou six prises par station s'il
      // n'y avait que les stations. Une proie ne fait jamais deux fois la meme tache: deux
      // stations qui ne proposent que la meme se partagent ses listes, et l'ecart s'elargit un
      // peu (de 4 a 7 prises sur ces graines). Toutes les stations servent.
      expect(Math.min(...prises)).toBeGreaterThanOrEqual(4);
      expect(Math.max(...prises) - Math.min(...prises)).toBeLessThanOrEqual(3);
    }
  });

  it('ne donne jamais deux fois la meme tache a une proie', () => {
    // Retour d'essai du porteur du projet, 10 octobre 2026. Toutes les longueurs de liste, et
    // assez de graines pour tomber sur des stations actives qui couvrent mal les natures.
    for (let taches = 3; taches <= NATURES_DE_TACHE.length; taches += 1) {
      for (let graine = 1; graine <= 40; graine += 1) {
        const etat = lancee(12, { among: { tueurs: 1, tachesParProie: taches } }, graine);

        for (const id of camps(etat).proies) {
          const liste = role(etat, id).taches;

          expect(liste).toHaveLength(taches);
          expect(new Set(liste.map((tache) => tache.nature)).size).toBe(taches);
          expect(new Set(liste.map((tache) => tache.station)).size).toBe(taches);
        }
      }
    }
  });

  it('garde des stations actives de quoi faire chaque nature a une station differente', () => {
    for (let graine = 1; graine <= 40; graine += 1) {
      const stations = amongDe(lancee(5, { among: { tachesParProie: 3 } }, graine)).stations;

      expect(stations).toHaveLength(7);
      expect(new Set(stations.flatMap((station) => station.natures)).size).toBe(
        NATURES_DE_TACHE.length,
      );
    }
  });

  it('tire la tache de chaque proie a une station: deux proies peuvent y faire autre chose', () => {
    const differentes = [1, 2, 3, 4, 5, 6, 7, 8].some((graine) => {
      const etat = lancee(12, { among: { tueurs: 1, tachesParProie: 7 } }, graine);
      const natures = new Map<number, Set<string>>();

      for (const id of camps(etat).proies) {
        for (const tache of role(etat, id).taches) {
          natures.set(tache.station, (natures.get(tache.station) ?? new Set()).add(tache.nature));
        }
      }

      return [...natures.values()].some((vues) => vues.size > 1);
    });

    expect(differentes).toBe(true);
  });

  it('place tout le monde en cercle autour du point de reunion, et attend le chargement', () => {
    const etat = lancee(6);
    const among = amongDe(etat);

    expect(among.phase).toBe('chargement');
    expect(among.phaseRestanteMs).toBe(AMONG.ATTENTE_DU_CHARGEMENT_MAXIMUM_MS);
    expect(among.charges).toEqual([]);
    for (const joueur of Object.values(etat.joueurs)) {
      expect(Math.hypot(joueur.position.x - GONG.x, joueur.position.y - GONG.y)).toBeCloseTo(
        AMONG.RAYON_DU_CERCLE_DE_REUNION_PX,
      );
    }
  });

  it('retourne le point de reunion et les stations en miroir', () => {
    const among = amongDe(lancee(5, { modeMiroir: true }));

    expect(among.gong).toEqual({ x: CARTES.map1.largeur - GONG.x, y: GONG.y });
  });

  it('donne aux joueurs les couleurs nommees, et a la foule le gris reserve', () => {
    const etat = peuplerDeBots(salon(12));
    const couleurs = Object.values(etat.joueurs).map((joueur) => joueur.couleur);

    expect(new Set(couleurs).size).toBe(12);
    expect([...couleurs].sort()).toEqual([...COULEURS_DES_JOUEURS_AMONG].sort());
    expect(Object.values(etat.bots)).toHaveLength(AMONG.FOULE_PAR_DEFAUT);
    for (const bot of Object.values(etat.bots)) {
      expect(bot.couleur).toBe(COULEUR_DE_LA_FOULE);
    }
  });

  it('ne pose rien dans une partie d un autre mode', () => {
    let etat = creerEtatInitial({ graine: 7, mode: 'chasse' });
    etat = ajouterJoueur(etat, { id: 'j1', pseudo: 'Un' });

    expect(lancerLaPartie(etat).among).toBeUndefined();
  });
});

describe('le chargement', () => {
  it('fige le monde et attend que chacun ait charge la carte, puis revele les roles', () => {
    const etat = lancee();
    const avant = joueurDe(etat, 'j1').position;
    const marche = { j1: { deplacement: { x: 1, y: 0 }, enMouvement: true } };

    // Trois sur cinq: on attend encore, le monde fige.
    const partiel = tick(etat, { ...charges(['j2', 'j3']), ...marche }, 1000);
    expect(amongDe(partiel).phase).toBe('chargement');
    expect(amongDe(partiel).charges).toEqual(['j2', 'j3']);
    expect(joueurDe(partiel, 'j1').position).toEqual(avant);
    const encore = tick(partiel, charges(['j1']), 1000);
    expect(amongDe(encore).charges).toEqual(['j1', 'j2', 'j3']);

    // Les deux derniers: la revelation commence, entiere.
    const revelation = tick(encore, charges(['j4', 'j5']), 50);
    expect(amongDe(revelation).phase).toBe('revelation');
    expect(amongDe(revelation).phaseRestanteMs).toBe(AMONG.DUREE_REVELATION_MS);
    expect(amongDe(revelation).charges).toBeUndefined();
  });

  it('ne retient pas la partie au-dela de l attente maximale, ni pour un joueur parti', () => {
    const etat = tick(lancee(), charges(['j1', 'j2', 'j3']), 50);

    const bloque = tick(etat, {}, AMONG.ATTENTE_DU_CHARGEMENT_MAXIMUM_MS - 50);
    expect(amongDe(bloque).phase).toBe('revelation');

    // j4 et j5 partent: les trois autres ont charge, la revelation commence.
    const sansEux = retirerJoueur(retirerJoueur(etat, 'j4'), 'j5');
    expect(amongDe(tick(sansEux, {}, 50)).phase).toBe('revelation');
  });

  it('ignore le signal hors du chargement', () => {
    const jeu = enJeu();

    expect(amongDe(tick(jeu, charges(['j1']), 50)).charges).toBeUndefined();
  });
});

describe('les phases', () => {
  it('fige le monde pendant la revelation, puis commence le premier tour', () => {
    const etat = revelee();
    const avant = joueurDe(etat, 'j1').position;
    const marche = { j1: { deplacement: { x: 1, y: 0 }, enMouvement: true } };

    const fige = tick(etat, marche, 1000);
    expect(mondeFigeEnAmong(fige)).toBe(true);
    expect(joueurDe(fige, 'j1').position).toEqual(avant);
    expect(fige.tempsEcouleMs).toBe(etat.tempsEcouleMs);
    expect(amongDe(fige).phaseRestanteMs).toBe(AMONG.DUREE_REVELATION_MS - 1000);

    const jeu = tick(fige, marche, AMONG.DUREE_REVELATION_MS - 1000);
    expect(amongDe(jeu).phase).toBe('jeu');
    expect(amongDe(jeu).tour).toBe(1);
    expect(evenements(jeu, 'tourCommence')).toEqual([{ type: 'tourCommence', tour: 1 }]);
    for (const id of camps(jeu).tueurs) {
      expect(role(jeu, id).rechargeMs).toBe(AMONG.RECHARGE_DEBUT_DE_TOUR_MS);
    }

    const bouge = tick(jeu, marche, 100);
    expect(joueurDe(bouge, 'j1').position.x).toBeGreaterThan(joueurDe(jeu, 'j1').position.x);
  });

  it('ouvre une reunion au terme du tour, et jamais sans duree reglee', () => {
    const avecTerme = tick(enJeu(5, { among: { dureeDuTourS: 120 } }), {}, 120_000);
    expect(amongDe(avecTerme).phase).toBe('discussion');
    expect(evenements(avecTerme, 'reunionOuverte')[0]?.motif).toBe('temps');

    const sansTerme = tick(enJeu(5, { among: { dureeDuTourS: 0 } }), {}, 600_000);
    expect(amongDe(sansTerme).phase).toBe('jeu');
  });

  it('dure trois minutes par defaut', () => {
    expect(amongDe(tick(enJeu(), {}, 179_000)).phase).toBe('jeu');
    expect(amongDe(tick(enJeu(), {}, 180_000)).phase).toBe('discussion');
  });

  it('ne finit jamais au terme de la duree de partie', () => {
    const etat = tick(enJeu(5, { dureePartieS: 30, among: { dureeDuTourS: 0 } }), {}, 60_000);

    expect(evaluerFinDePartie(etat)).toEqual({ terminee: false, tempsRestantMs: 0 });
  });

  it('laisse les autres modes tels quels: jamais fige, personne qui traverse, un terme', () => {
    const etat = creerEtatInitial({ graine: 1 });

    for (const mode of ['classique', 'tactique', 'equipes', 'chasse', 'massacre'] as const) {
      expect(REGLES_DES_MODES[mode].mondeFige(etat)).toBe(false);
      expect(REGLES_DES_MODES[mode].passeMuraille(etat).size).toBe(0);
      expect(REGLES_DES_MODES[mode].sansTerme).toBe(false);
    }
  });
});

describe('le meurtre', () => {
  it('tue la proie collee au tueur: elle devient un fantome, et laisse un cadavre', () => {
    const etat = pretATuer();
    const { tueur, proie } = unTueurEtUneProie(etat);
    const apres = meurtre(etat, tueur, proie);
    const lieu = joueurDe(apres, proie).position;

    expect(estFantome(apres, proie)).toBe(true);
    expect(Object.values(amongDe(apres).cadavres)).toEqual([
      { victime: proie, position: lieu, couleur: joueurDe(apres, proie).couleur },
    ]);
    expect(evenements(apres, 'meurtre')).toEqual([
      { type: 'meurtre', tueur, victime: proie, position: lieu },
    ]);
    expect(role(apres, tueur).rechargeMs).toBe(25_000);
    expect(role(apres, tueur).faits.meurtres).toBe(1);
  });

  it('ne tue pas au-dela du contact', () => {
    const etat = pretATuer();
    const { tueur, proie } = unTueurEtUneProie(etat);
    const place = joueurDe(etat, tueur).position;
    const loin = placer(etat, proie, { x: place.x + AMONG.PORTEE_DU_MEURTRE_PX + 1, y: place.y });

    expect(estFantome(tick(loin, { [tueur]: geste({ capturer: true }) }, 50), proie)).toBe(false);
  });

  it('ne tue ni pendant la recharge, ni un tueur, ni de la main d une proie', () => {
    const debut = disperser(enJeu(9, { among: { tueurs: 2 } }));
    const { tueurs, proies } = camps(debut);
    const [tueur, complice] = tueurs as [string, string];
    const proie = proies[0] as string;

    expect(estFantome(meurtre(debut, tueur, proie), proie)).toBe(false);

    const pret = tick(debut, {}, AMONG.RECHARGE_DEBUT_DE_TOUR_MS);
    expect(estFantome(meurtre(pret, tueur, complice), complice)).toBe(false);
    expect(estFantome(meurtre(pret, proie, proies[1] as string), proies[1] as string)).toBe(false);
  });

  it('prend la plus proche des proies a portee, une seule', () => {
    const etat = pretATuer(6);
    const { tueurs, proies } = camps(etat);
    const tueur = tueurs[0] as string;
    const [proche, lointaine] = proies as [string, string];
    const place = joueurDe(etat, tueur).position;
    const pose = placer(placer(etat, lointaine, { x: place.x + 25, y: place.y }), proche, {
      x: place.x - 15,
      y: place.y,
    });

    const apres = tick(pose, { [tueur]: geste({ capturer: true }) }, 50);
    expect(estFantome(apres, proche)).toBe(true);
    expect(estFantome(apres, lointaine)).toBe(false);
  });

  it('decide la partie pour les tueurs des qu ils sont aussi nombreux que les proies', () => {
    let etat = pretATuer(5);
    const { tueurs, proies } = camps(etat);
    const tueur = tueurs[0] as string;
    // Quatre proies pour un tueur: deux deja mortes, le troisieme meurtre decide.
    for (const proie of proies.slice(0, 2)) {
      etat = avecRole(etat, proie, { fantome: true });
    }
    expect(campVainqueur(etat)).toBeUndefined();

    const apres = meurtre(etat, tueur, proies[2] as string);
    expect(amongDe(apres).vainqueur).toBe('tueurs');
    expect(evaluerFinDePartie(apres).terminee).toBe(true);
  });
});

describe('les fantomes', () => {
  it('traversent les murs plus vite que les vivants, sans sortir de la carte', () => {
    const mur = creerCarteCollisions(CARTES.map1, (x) => x >= 600 && x < 640);
    let etat = creerEtatInitial({ graine: 7, mode: 'among', terrain: mur });
    for (let rang = 1; rang <= 5; rang += 1) {
      etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
    }
    etat = lancerLaPartie(etat);
    etat = tick(etat, charges(Object.keys(etat.joueurs)), 50);
    etat = tick(etat, {}, AMONG.DUREE_REVELATION_MS);
    etat = avecRole(
      placer(placer(etat, 'j1', { x: 560, y: 400 }), 'j2', { x: 560, y: 500 }),
      'j1',
      {
        fantome: true,
      },
    );

    expect([...fantomesEnAmong(etat)]).toEqual(['j1']);

    const droite = { deplacement: { x: 1, y: 0 }, enMouvement: true };
    const apres = tick(etat, { j1: droite, j2: droite }, 1000);
    // Une seconde a 1,5 fois la vitesse commune: 225 pixels, a travers le mur.
    expect(joueurDe(apres, 'j1').position.x).toBeCloseTo(
      560 + 150 * AMONG.MULTIPLICATEUR_DES_FANTOMES,
    );
    expect(joueurDe(apres, 'j2').position.x).toBeLessThan(600);

    const bord = tick(placer(apres, 'j1', { x: 1990, y: 400 }), { j1: droite }, 1000);
    expect(joueurDe(bord, 'j1').position.x).toBe(CARTES.map1.largeur - 16);
  });

  it('ne signalent pas leur propre cadavre, ni aucun autre', () => {
    const etat = pretATuer();
    const { tueur, proie } = unTueurEtUneProie(etat);
    const tue = meurtre(etat, tueur, proie);

    const signale = tick(tue, { [proie]: geste({ agir: true }) }, 50);
    expect(amongDe(signale).phase).toBe('jeu');
  });
});

describe('le bouton d action', () => {
  it('signale un cadavre a portee, a l appui', () => {
    const etat = pretATuer();
    const { tueur, proie } = unTueurEtUneProie(etat);
    const tue = meurtre(etat, tueur, proie);
    const temoin = camps(tue).proies[1] as string;
    const lieu = joueurDe(tue, proie).position;
    const pres = placer(tue, temoin, { x: lieu.x + AMONG.PORTEE_DU_SIGNALEMENT_PX, y: lieu.y });

    const apres = tick(pres, { [temoin]: geste({ agir: true }) }, 50);
    const reunion = amongDe(apres).reunion;
    expect(amongDe(apres).phase).toBe('discussion');
    expect(reunion).toMatchObject({ numero: 1, par: temoin, motif: 'cadavre', cadavre: proie });
    expect(evenements(apres, 'reunionOuverte')).toEqual([
      {
        type: 'reunionOuverte',
        numero: 1,
        par: temoin,
        motif: 'cadavre',
        cadavre: proie,
        morts: [proie],
      },
    ]);
    expect(role(apres, temoin).faits.signalements).toBe(1);
  });

  it('ne signale pas tant qu on tient le bouton depuis avant', () => {
    const etat = pretATuer();
    const { tueur, proie } = unTueurEtUneProie(etat);
    const temoin = camps(etat).proies[1] as string;
    const tue = meurtre(etat, tueur, proie);
    const lieu = joueurDe(tue, proie).position;
    // Le temoin tenait deja le bouton au battement precedent.
    const tenu = avecRole(placer(tue, temoin, lieu), temoin, { actionTenue: true });

    const apres = tick(tenu, { [temoin]: geste({ agir: true }) }, 50);
    expect(amongDe(apres).phase).toBe('jeu');
  });

  it('un tueur peut signaler sa propre victime', () => {
    const etat = pretATuer();
    const { tueur, proie } = unTueurEtUneProie(etat);
    const tue = tick(meurtre(etat, tueur, proie), {}, 50);

    const apres = tick(tue, { [tueur]: geste({ agir: true }) }, 50);
    expect(amongDe(apres).reunion?.par).toBe(tueur);
  });

  it('sonne le gong au point de reunion, une fois, pas dans les quinze premieres secondes', () => {
    const debut = placer(enJeu(), 'j1', GONG);
    const appui = { j1: geste({ agir: true }) };

    expect(amongDe(tick(debut, appui, 50)).phase).toBe('jeu');

    const plusTard = tick(debut, {}, AMONG.DELAI_DU_GONG_MS);
    const sonne = tick(plusTard, appui, 50);
    expect(amongDe(sonne).reunion).toMatchObject({ par: 'j1', motif: 'gong' });
    expect(role(sonne, 'j1').gongUtilise).toBe(true);

    const loin = placer(plusTard, 'j1', { x: GONG.x + AMONG.PORTEE_DU_GONG_PX + 1, y: GONG.y });
    expect(amongDe(tick(loin, appui, 50)).phase).toBe('jeu');

    const dejaSonne = avecRole(plusTard, 'j1', { gongUtilise: true });
    expect(amongDe(tick(dejaSonne, appui, 50)).phase).toBe('jeu');
  });
});

describe('les taches', () => {
  /** Une proie posee sur la station de sa premiere tache, de cette nature si on la donne. */
  function aSaStation(nature?: NatureDeTache): {
    etat: EtatPartie;
    proie: string;
    station: Position;
    minimum: number;
  } {
    const etat = disperser(enJeu());
    const proie = camps(etat).proies[0] as string;
    const [premiere, ...autres] = role(etat, proie).taches;
    if (premiere === undefined) {
      throw new Error('La proie devrait avoir une tache.');
    }
    const tache = { ...premiere, nature: nature ?? premiere.nature };
    const station = amongDe(etat).stations[tache.station] as Position;
    return {
      etat: placer(avecRole(etat, proie, { taches: [tache, ...autres] }), proie, station),
      proie,
      station: { x: station.x, y: station.y },
      minimum: DUREES_MINIMALES_DES_TACHES_MS[tache.nature],
    };
  }

  /** La proie appuie sur l'action: sa tache s'ouvre. */
  function ouvrir(etat: EtatPartie, proie: string): EtatPartie {
    return tick(etat, { [proie]: geste({ agir: true }) }, 50);
  }

  /** La page dit la tache finie, une fois sa duree minimale passee. */
  function finir(etat: EtatPartie, proie: string, minimum: number): EtatPartie {
    return tick(tick(etat, {}, minimum - 50), { [proie]: geste({ tache: 'finie' }) }, 50);
  }

  it('s ouvre a l appui dans le disque de sa station, et se fait a la fin annoncee', () => {
    const { etat, proie, minimum } = aSaStation();
    const ouverte = ouvrir(etat, proie);

    expect(role(ouverte, proie).tacheEnCours).toEqual({ indice: 0, ecouleMs: 0 });

    const faite = finir(ouverte, proie, minimum);
    expect(role(faite, proie).taches[0]?.faite).toBe(true);
    expect(role(faite, proie).tacheEnCours).toBeUndefined();
    expect(role(faite, proie).faits.taches).toBe(1);
    expect(evenements(faite, 'tacheFaite')).toEqual([
      {
        type: 'tacheFaite',
        joueur: proie,
        station: role(etat, proie).taches[0]?.station,
        nature: role(etat, proie).taches[0]?.nature,
      },
    ]);
    expect(avancementDesTaches(amongDe(faite)).faites).toBe(1);
  });

  it('ignore une fin annoncee avant la duree minimale, sans fermer la tache', () => {
    const { etat, proie, minimum } = aSaStation('sang');
    const ouverte = tick(ouvrir(etat, proie), {}, minimum - 100);
    const tot = tick(ouverte, { [proie]: geste({ tache: 'finie' }) }, 50);

    expect(role(tot, proie).taches[0]?.faite).toBe(false);
    expect(role(tot, proie).tacheEnCours).toEqual({ indice: 0, ecouleMs: minimum - 50 });

    const ensuite = tick(tot, { [proie]: geste({ tache: 'finie' }) }, 50);
    expect(role(ensuite, proie).taches[0]?.faite).toBe(true);
  });

  it('compte le temps a partir du battement qui suit l ouverture', () => {
    const { etat, proie, minimum } = aSaStation('katana');
    const ouverte = ouvrir(etat, proie);
    const presque = tick(ouverte, { [proie]: geste({ tache: 'finie' }) }, minimum - 1);

    expect(role(presque, proie).taches[0]?.faite).toBe(false);
  });

  it('s annule hors du disque, ou fermee par la page, et se refait en entier', () => {
    const { etat, proie, station, minimum } = aSaStation();
    const ouverte = tick(ouvrir(etat, proie), {}, minimum);

    const fermee = tick(ouverte, { [proie]: geste({ tache: 'fermee' }) }, 50);
    expect(role(fermee, proie).tacheEnCours).toBeUndefined();
    expect(role(fermee, proie).taches[0]?.faite).toBe(false);

    const dehors = placer(ouverte, proie, {
      x: station.x + AMONG.RAYON_D_UNE_STATION_PX + 1,
      y: station.y,
    });
    expect(role(tick(dehors, {}, 50), proie).tacheEnCours).toBeUndefined();

    const rouverte = ouvrir(fermee, proie);
    expect(role(rouverte, proie).tacheEnCours).toEqual({ indice: 0, ecouleMs: 0 });
  });

  it('ne s ouvre ni loin d une station, ni en gardant le bouton enfonce', () => {
    const { etat, proie, station } = aSaStation();
    const loin = placer(etat, proie, { x: station.x + 200, y: station.y });
    expect(role(ouvrir(loin, proie), proie).tacheEnCours).toBeUndefined();

    // Le bouton tenu en arrivant a la station n'ouvre rien: seul l'appui compte.
    const tenu = tick(loin, { [proie]: geste({ agir: true }) }, 50);
    const arrive = tick(placer(tenu, proie, station), { [proie]: geste({ agir: true }) }, 50);
    expect(role(arrive, proie).tacheEnCours).toBeUndefined();
  });

  it('n ouvre rien pour un tueur, qui fait semblant, et ne compte jamais sa fin', () => {
    const etat = disperser(enJeu());
    const tueur = camps(etat).tueurs[0] as string;
    const station = amongDe(etat).stations[0] as Position;
    const ouverte = ouvrir(placer(etat, tueur, station), tueur);
    const apres = tick(ouverte, { [tueur]: geste({ tache: 'finie' }) }, 10_000);

    expect(role(apres, tueur).tacheEnCours).toBeUndefined();
    expect(avancementDesTaches(amongDe(apres)).faites).toBe(0);
  });

  it('se fait aussi en fantome', () => {
    const { etat, proie, minimum } = aSaStation();
    const fantome = avecRole(etat, proie, { fantome: true });

    expect(role(finir(ouvrir(fantome, proie), proie, minimum), proie).taches[0]?.faite).toBe(true);
  });

  it('montre la fin d un katana ou d une fumee a sa station, pour une proie vivante seulement', () => {
    for (const nature of ['katana', 'fumee'] as const) {
      const { etat, proie, station, minimum } = aSaStation(nature);
      expect(evenements(finir(ouvrir(etat, proie), proie, minimum), 'tacheVisuelle')).toEqual([
        { type: 'tacheVisuelle', nature, position: station },
      ]);

      const fantome = avecRole(etat, proie, { fantome: true });
      expect(evenements(finir(ouvrir(fantome, proie), proie, minimum), 'tacheVisuelle')).toEqual(
        [],
      );
    }

    const lunettes = aSaStation('lunettes');
    const faite = finir(ouvrir(lunettes.etat, lunettes.proie), lunettes.proie, lunettes.minimum);
    expect(evenements(faite, 'tacheFaite')).toHaveLength(1);
    expect(evenements(faite, 'tacheVisuelle')).toEqual([]);
  });

  it('ne montre aucune tache visuelle si l hote les a coupees', () => {
    const { etat, proie, minimum } = aSaStation('katana');
    const sans: EtatPartie = {
      ...etat,
      reglages: {
        ...etat.reglages,
        among: { ...AMONG_PAR_DEFAUT, ...etat.reglages.among, tachesVisuelles: false },
      },
    };

    const faite = finir(ouvrir(sans, proie), proie, minimum);
    expect(role(faite, proie).taches[0]?.faite).toBe(true);
    expect(evenements(faite, 'tacheVisuelle')).toEqual([]);
  });

  it('retient le compte des taches faites a l ouverture de chaque reunion', () => {
    const { etat, proie, minimum } = aSaStation();
    expect(amongDe(etat).tachesALaDerniereReunion).toBe(0);

    const faite = tick(finir(ouvrir(etat, proie), proie, minimum), {}, AMONG.DELAI_DU_GONG_MS);
    expect(amongDe(faite).tachesALaDerniereReunion).toBe(0);

    const sonneur = camps(faite).proies[1] as string;
    const sonne = tick(placer(faite, sonneur, GONG), { [sonneur]: geste({ agir: true }) }, 50);
    expect(amongDe(sonne).phase).toBe('discussion');
    expect(amongDe(sonne).tachesALaDerniereReunion).toBe(1);
  });

  it('donne la victoire aux proies quand toutes sont faites', () => {
    const etat = enJeu();
    let courant = etat;
    for (const proie of camps(etat).proies) {
      courant = avecRole(courant, proie, {
        taches: role(courant, proie).taches.map((tache) => ({ ...tache, faite: true })),
      });
    }

    expect(campVainqueur(courant)).toBe('proies');
    expect(amongDe(tick(courant, {}, 50)).vainqueur).toBe('proies');
  });
});

describe('la reunion et le vote', () => {
  /** Une reunion ouverte au gong par j1, la discussion passee: le vote est ouvert. */
  function auVote(joueurs = 6, reglages: ReglagesPartiels = {}): EtatPartie {
    const debut = tick(enJeu(joueurs, reglages), {}, AMONG.DELAI_DU_GONG_MS);
    const sonne = tick(placer(debut, 'j1', GONG), { j1: geste({ agir: true }) }, 50);
    return tick(sonne, {}, 45_000);
  }

  it('discute, puis ouvre le vote: un vote pendant la discussion ne compte pas', () => {
    const debut = tick(enJeu(), {}, AMONG.DELAI_DU_GONG_MS);
    const sonne = tick(placer(debut, 'j1', GONG), { j1: geste({ agir: true }) }, 50);
    expect(amongDe(sonne).phase).toBe('discussion');
    expect(amongDe(sonne).phaseRestanteMs).toBe(45_000);

    const tot = tick(sonne, { j2: geste({ voter: 'j3' }) }, 50);
    expect(amongDe(tot).reunion?.votes).toEqual({});

    const vote = tick(tot, {}, 45_000);
    expect(amongDe(vote).phase).toBe('vote');
    expect(evenements(vote, 'voteOuvert')).toHaveLength(1);
  });

  it('ejecte a la majorite relative, et l ejecte devient un fantome sans cadavre', () => {
    const etat = auVote();
    const voix: Entrees = {
      j1: geste({ voter: 'j2' }),
      j3: geste({ voter: 'j2' }),
      j4: geste({ voter: 'j5' }),
      j5: geste({ voter: null }),
    };
    const apres = tick(tick(etat, voix, 50), {}, 45_000);

    expect(amongDe(apres).phase).toBe('ejection');
    expect(amongDe(apres).ejection?.ejecte).toBe('j2');
    expect(amongDe(apres).ejection?.decompte[0]).toEqual({ cible: 'j2', voix: 2 });
    expect(estFantome(apres, 'j2')).toBe(true);
    expect(amongDe(apres).cadavres).toEqual({});
  });

  it('n ejecte personne a egalite, ni quand passer est en tete', () => {
    const egalite = tick(
      tick(auVote(), { j1: geste({ voter: 'j2' }), j3: geste({ voter: 'j4' }) }, 50),
      {},
      45_000,
    );
    expect(amongDe(egalite).ejection?.ejecte).toBeUndefined();

    const passe = tick(
      tick(
        auVote(),
        { j1: geste({ voter: null }), j3: geste({ voter: null }), j4: geste({ voter: 'j2' }) },
        50,
      ),
      {},
      45_000,
    );
    expect(amongDe(passe).ejection?.ejecte).toBeUndefined();
  });

  it('ne reprend pas un vote, et ignore celui d un fantome ou pour un fantome', () => {
    const etat = avecRole(auVote(), 'j6', { fantome: true });
    const premier = tick(etat, { j1: geste({ voter: 'j2' }), j6: geste({ voter: 'j3' }) }, 50);
    expect(evenements(premier, 'aVote')).toEqual([{ type: 'aVote', votant: 'j1' }]);

    const second = tick(premier, { j1: geste({ voter: 'j3' }), j2: geste({ voter: 'j6' }) }, 50);
    expect(amongDe(second).reunion?.votes).toEqual({ j1: 'j2' });
  });

  it('se clot des que tous les vivants ont vote', () => {
    const etat = auVote(5);
    const tous = Object.fromEntries(
      Object.keys(etat.joueurs).map((id) => [id, geste({ voter: null })]),
    );

    expect(amongDe(tick(etat, tous, 50)).phase).toBe('ejection');
  });

  it('compte les bons votes, et le tueur trouve a la premiere reunion', () => {
    const etat = auVote(7, { among: { tueurs: 2 } });
    const { tueurs, proies } = camps(etat);
    const cible = tueurs[0] as string;
    const voix = Object.fromEntries(proies.map((id) => [id, geste({ voter: cible })]));
    const apres = tick(tick(etat, voix, 50), {}, 45_000);

    for (const id of proies) {
      expect(role(apres, id).faits.bonsVotes).toBe(1);
      expect(role(apres, id).faits.tueursTrouvesALaPremiereReunion).toBe(1);
    }
  });

  it('ne dit pas le role de l ejecte', () => {
    const etat = auVote();
    const apres = tick(tick(etat, { j1: geste({ voter: 'j2' }) }, 50), {}, 45_000);
    const resultat = evenements(apres, 'resultatDuVote')[0];

    expect(resultat).toBeDefined();
    expect(JSON.stringify(resultat)).not.toMatch(/tueur|proie|role/u);
  });

  it('commence un nouveau tour apres l ejection: cadavres retires, vivants au point de reunion', () => {
    const etat = pretATuer(7, { among: { tueurs: 2 } });
    const { tueur, proie } = unTueurEtUneProie(etat);
    const tue = meurtre(etat, tueur, proie);
    const temoin = camps(tue).proies[1] as string;
    const signale = tick(
      placer(tue, temoin, joueurDe(tue, proie).position),
      { [temoin]: geste({ agir: true }) },
      50,
    );
    const ejection = tick(tick(signale, {}, 45_000), {}, 45_000);
    expect(amongDe(ejection).phase).toBe('ejection');

    const tour = tick(ejection, {}, AMONG.DUREE_EJECTION_MS);
    const among = amongDe(tour);
    expect(among.phase).toBe('jeu');
    expect(among.tour).toBe(2);
    expect(among.cadavres).toEqual({});
    expect(among.reunion).toBeUndefined();
    expect(joueurDe(tour, proie).position).toEqual(joueurDe(ejection, proie).position);
    for (const id of Object.keys(tour.joueurs).filter((autre) => !estFantome(tour, autre))) {
      const place = joueurDe(tour, id).position;
      expect(Math.hypot(place.x - GONG.x, place.y - GONG.y)).toBeCloseTo(
        AMONG.RAYON_DU_CERCLE_DE_REUNION_PX,
      );
    }
    for (const id of camps(tour).tueurs) {
      expect(role(tour, id).rechargeMs).toBe(AMONG.RECHARGE_DEBUT_DE_TOUR_MS);
    }
  });

  it('decide la partie pour les proies apres l ejection du dernier tueur, une fois affichee', () => {
    const etat = auVote(6);
    const tueur = camps(etat).tueurs[0] as string;
    const voix = Object.fromEntries(camps(etat).proies.map((id) => [id, geste({ voter: tueur })]));
    const ejection = tick(tick(etat, voix, 50), {}, 45_000);

    expect(amongDe(ejection).vainqueur).toBeUndefined();
    expect(amongDe(tick(ejection, {}, AMONG.DUREE_EJECTION_MS)).vainqueur).toBe('proies');
  });
});

describe('les departs', () => {
  it('le depart du dernier tueur donne la victoire aux proies', () => {
    const etat = enJeu();
    const sansTueur = retirerJoueur(etat, camps(etat).tueurs[0] as string);

    expect(amongDe(tick(sansTueur, {}, 50)).vainqueur).toBe('proies');
  });

  it('une proie partie retire ses taches restantes du total, et garde les faites', () => {
    const etat = enJeu();
    const proie = camps(etat).proies[0] as string;
    const uneFaite = avecRole(etat, proie, {
      taches: role(etat, proie).taches.map((tache, rang) => ({ ...tache, faite: rang === 0 })),
    });

    const apres = retirerJoueur(uneFaite, proie);
    expect(avancementDesTaches(amongDe(apres))).toEqual({ faites: 1, total: 16 });
  });

  it('un vote pour un joueur parti devient un passer', () => {
    const debut = tick(enJeu(6), {}, AMONG.DELAI_DU_GONG_MS);
    const sonne = tick(placer(debut, 'j1', GONG), { j1: geste({ agir: true }) }, 50);
    const vote = tick(
      tick(sonne, {}, 45_000),
      { j1: geste({ voter: 'j2' }), j3: geste({ voter: 'j4' }) },
      50,
    );

    const apres = retirerJoueur(retirerJoueur(vote, 'j2'), 'j3');
    expect(amongDe(apres).reunion?.votes).toEqual({ j1: null });
  });
});

describe('les points', () => {
  it('se tirent des faits de jeu', () => {
    const etat = avecRole(enJeu(), 'j1', {
      faits: {
        taches: 2,
        signalements: 1,
        meurtres: 3,
        bonsVotes: 1,
        meurtresAuPremierTour: 2,
        tueursTrouvesALaPremiereReunion: 1,
      },
    });

    expect(pointsEnAmong(etat, joueurDe(etat, 'j1'))).toBe(
      2 * POINTS_AMONG.TACHE +
        POINTS_AMONG.SIGNALEMENT +
        3 * POINTS_AMONG.MEURTRE +
        POINTS_AMONG.BON_VOTE +
        POINTS_AMONG.TUEUR_TROUVE_A_LA_PREMIERE_REUNION +
        POINTS_AMONG.DEUX_MEURTRES_AU_PREMIER_TOUR,
    );
  });

  it('classent le camp vainqueur d abord, quels que soient les points', () => {
    const etat = enJeu();
    const { tueurs, proies } = camps(etat);
    const tueur = tueurs[0] as string;
    let decide = avecRole(etat, tueur, {
      faits: { ...role(etat, tueur).faits, meurtres: 10 },
    });
    decide = { ...decide, among: { ...amongDe(decide), vainqueur: 'proies' } };

    const classement = calculerScores(decide).map((ligne) => ligne.id);
    expect(classement.slice(0, proies.length).sort()).toEqual([...proies].sort());
    expect(classement.at(-1)).toBe(tueur);
  });
});

describe('la vision', () => {
  it('voit selon le role et le palier, et tout en fantome', () => {
    const etat = enJeu(5, { among: { visionProie: 'reduite', visionTueur: 'large' } });
    const { tueur, proie } = unTueurEtUneProie(etat);

    expect(rayonDeVision(etat, proie)).toBe(200);
    expect(rayonDeVision(etat, tueur)).toBe(380);
    expect(rayonDeVision(avecRole(etat, proie, { fantome: true }), proie)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(rayonDeVision(etat, 'inconnu')).toBe(0);
    expect(rayonDeVision(enJeu(), unTueurEtUneProie(enJeu()).tueur)).toBe(320);
  });
});

describe('les cas aux bords', () => {
  it('ne fait rien dans une partie au salon, ni dans une partie decidee', () => {
    const auSalon = salon(5);
    expect(fantomesEnAmong(auSalon).size).toBe(0);
    expect(campVainqueur(auSalon)).toBeUndefined();
    expect(pointsEnAmong(auSalon, joueurDe(auSalon, 'j1'))).toBe(0);
    expect(tick(auSalon, {}, 50).among).toBeUndefined();

    const jeu = enJeu();
    const decidee = { ...jeu, among: { ...amongDe(jeu), vainqueur: 'tueurs' as const } };
    const apres = tick(decidee, { j1: { deplacement: { x: 1, y: 0 }, enMouvement: true } }, 1000);
    expect(apres.among).toBe(decidee.among);
    expect(joueurDe(apres, 'j1').position).toEqual(joueurDe(decidee, 'j1').position);
  });

  it('refuse de lancer sur une carte sans lieux', () => {
    const etat = salon(5);
    const ailleurs = { ...etat, reglages: { ...etat.reglages, carte: 'quartier' as const } };

    expect(() => lancerLaPartie(ailleurs)).toThrow(/lieux/u);
  });

  it('prend les reglages par defaut si l etat n en porte pas', () => {
    const etat = salon(5);
    const { among: _retires, ...sansAmong } = etat.reglages;

    expect(camps(lancerLaPartie({ ...etat, reglages: sansAmong })).tueurs).toHaveLength(1);
  });

  it('replace au point de reunion celui dont la place du cercle tombe dans un mur', () => {
    // Un mur juste a droite du point de reunion: la premiere place du cercle y tombe.
    const mur = creerCarteCollisions(
      CARTES.map1,
      (x, y) => x >= GONG.x + 60 && x < GONG.x + 120 && Math.abs(y - GONG.y) < 40,
    );
    let etat = creerEtatInitial({ graine: 7, mode: 'among', terrain: mur });
    for (let rang = 1; rang <= 5; rang += 1) {
      etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
    }

    expect(joueurDe(lancerLaPartie(etat), 'j1').position).toEqual(GONG);
  });

  it('ne fait rien au contact: ni capture, ni couleur transmise', () => {
    const jeu = peuplerDeBots(disperser(enJeu()));
    const bot = Object.values(jeu.bots)[0];
    if (bot === undefined) {
      throw new Error('La foule devrait etre posee.');
    }
    const serres = placer(placer(jeu, 'j1', bot.position), 'j2', bot.position);
    const apres = tick(serres, {}, 50);

    expect(apres.bots[bot.id]?.couleur).toBe(COULEUR_DE_LA_FOULE);
    expect(joueurDe(apres, 'j1').couleur).toBe(joueurDe(serres, 'j1').couleur);
    expect(joueurDe(apres, 'j2').captures).toBe(0);
  });

  it('n ouvre qu une reunion quand deux joueurs appuient au meme battement', () => {
    const debut = tick(enJeu(), {}, AMONG.DELAI_DU_GONG_MS);
    const deux = placer(placer(debut, 'j1', GONG), 'j2', { x: GONG.x + 10, y: GONG.y });
    const apres = tick(deux, { j1: geste({ agir: true }), j2: geste({ agir: true }) }, 50);

    expect(evenements(apres, 'reunionOuverte')).toHaveLength(1);
    expect(amongDe(apres).reunions).toBe(1);
  });

  it('decompte l ejection, et ne compte les faits du premier tour qu au premier tour', () => {
    const etat = auVoteApres(tick(enJeu(7, { among: { tueurs: 2 } }), {}, AMONG.DELAI_DU_GONG_MS));
    const ejection = tick(
      etat,
      Object.fromEntries(Object.keys(etat.joueurs).map((id) => [id, geste({ voter: null })])),
      50,
    );
    const enCours = tick(ejection, {}, 1000);
    expect(amongDe(enCours).phase).toBe('ejection');
    expect(amongDe(enCours).phaseRestanteMs).toBe(AMONG.DUREE_EJECTION_MS - 1000);

    const second = disperser(
      tick(tick(enCours, {}, AMONG.DUREE_EJECTION_MS), {}, AMONG.RECHARGE_DEBUT_DE_TOUR_MS),
    );
    expect(amongDe(second).tour).toBe(2);
    const { tueur, proie } = unTueurEtUneProie(second);
    const tue = meurtre(second, tueur, proie);
    expect(role(tue, tueur).faits.meurtres).toBe(1);
    expect(role(tue, tueur).faits.meurtresAuPremierTour).toBe(0);

    const reunion = auVoteApres(tick(tue, {}, AMONG.DELAI_DU_GONG_MS), 'j2');
    const { tueurs, proies } = camps(reunion);
    const vivantes = proies.filter((id) => !estFantome(reunion, id));
    const voix = Object.fromEntries(
      vivantes.map((id) => [id, geste({ voter: tueurs[1] as string })]),
    );
    const apres = tick(tick(reunion, voix, 50), {}, 45_000);
    expect(amongDe(apres).ejection?.ejecte).toBe(tueurs[1]);
    for (const id of vivantes) {
      expect(role(apres, id).faits.bonsVotes).toBe(1);
      expect(role(apres, id).faits.tueursTrouvesALaPremiereReunion).toBe(0);
    }
  });
});

/** Le joueur nomme sonne le gong, et la discussion passe: le vote est ouvert. */
function auVoteApres(etat: EtatPartie, sonneur = 'j1'): EtatPartie {
  const pres = placer(etat, sonneur, GONG);
  const sonne = tick(pres, { [sonneur]: geste({ agir: true }) }, 50);
  return tick(sonne, {}, 45_000);
}
