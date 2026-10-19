/**
 * Tests du mode Among Ninjas (etape 7.20): le lancement et ses tirages, les phases et le
 * monde fige, le meurtre et le cadavre, les fantomes, le bouton d'action (signaler, sonner,
 * ouvrir sa tache), les taches courtes (etape 7.21), la reunion et le vote, la victoire, les
 * departs et les points, les sabotages et la malediction (etape 7.22), et les reparations a la
 * main de la panne et de la surchauffe (etape 7.27).
 *
 * Aucune version du jeu d'origine n'a ce mode, donc aucune caracterisation: les attentes sont
 * la fiche docs/plan/etape-7-20.md et les valeurs confirmees par le porteur du projet le 6
 * octobre 2026.
 */

import type {
  LieuxDuMode,
  NatureDeSabotage,
  NatureDeTache,
  Position,
  ReglagesPartiels,
  StationDuMode,
} from '@neon-ninja/shared';
import {
  AMONG,
  AMONG_PAR_DEFAUT,
  CARTES,
  COULEURS_DES_JOUEURS_AMONG,
  COULEUR_DE_LA_FOULE,
  DUREES_MINIMALES_DES_REPARATIONS_MS,
  DUREES_MINIMALES_DES_TACHES_MS,
  LIEUX_DES_CARTES,
  NATURES_COURTES,
  NUISANCES,
  POINTS_AMONG,
  RAYONS_DE_VISION,
  REPARATIONS_DE_LA_PANNE,
  REPARATIONS_DE_LA_SURCHAUFFE,
  estUneTacheLongue,
  lieuxDuMode,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import {
  avancementDesTaches,
  campVainqueur,
  estFantome,
  estTueur,
  fantomesEnAmong,
  mondeFigeEnAmong,
  nuageEnAmong,
  pointsEnAmong,
  rayonDeVision,
  surchauffePerdue,
} from './among.js';
import { peuplerDeBots } from './bots.js';
import { creerCarteCollisions } from './collisions.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import type { EtatAmong, EvenementAmong, JoueurAmong, ReparationsAmong } from './etatAmong.js';
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
    const toutes = (LIEUX_DES_CARTES.map1 as LieuxDuMode).stations;

    expect(among.stations).toHaveLength(10);
    expect(new Set(among.stations.map((station) => station.nom)).size).toBe(10);
    for (const station of among.stations) {
      const lieu = toutes.find((autre) => autre.nom === station.nom);
      const { places, ...sansPlaces } = lieu as StationDuMode;

      // A l'une de ses places, avec le meuble de cette place, sans plus la liste (16 octobre
      // 2026).
      const { emprise: _premiere, ...sansEmprise } = sansPlaces;
      const tiree = (places ?? [sansPlaces]).find(
        (place) => place.x === station.x && place.y === station.y,
      );
      expect(station.places).toBeUndefined();
      expect(tiree).toBeDefined();
      expect(station).toEqual({
        ...sansEmprise,
        x: tiree?.x,
        y: tiree?.y,
        ...(tiree?.emprise === undefined ? {} : { emprise: tiree.emprise }),
      });
    }
  });

  it('tire la place d une station dont le meuble se repete, et toutes ses places servent', () => {
    const vues = new Map<string, Set<string>>();

    for (let graine = 1; graine <= 120; graine += 1) {
      for (const station of amongDe(lancee(5, { among: { tachesParProie: 7 } }, graine)).stations) {
        const deja = vues.get(station.nom) ?? new Set<string>();
        deja.add(`${String(station.x)},${String(station.y)}`);
        vues.set(station.nom, deja);
      }
    }

    for (const station of (LIEUX_DES_CARTES.map1 as LieuxDuMode).stations) {
      expect(vues.get(station.nom)?.size, station.nom).toBe(station.places?.length ?? 1);
    }
    // Meme graine, memes places.
    expect(amongDe(lancee(5, {}, 9)).stations).toEqual(amongDe(lancee(5, {}, 9)).stations);
  });

  it('retourne en miroir les places d une station et la place qu elle tire', () => {
    const etat = lancee(5, { modeMiroir: true, among: { tachesParProie: 7 } }, 3);
    const miroir = lieuxDuMode('map1', true) as LieuxDuMode;

    for (const station of amongDe(etat).stations) {
      const lieu = miroir.stations.find((autre) => autre.nom === station.nom) as StationDuMode;
      expect((lieu.places ?? [lieu]).map(({ x, y }) => ({ x, y }))).toContainEqual({
        x: station.x,
        y: station.y,
      });
      // Le meuble se retourne avec sa place.
      const tiree = (lieu.places ?? [lieu]).find(
        (place) => place.x === station.x && place.y === station.y,
      );
      expect(station.emprise).toEqual(tiree?.emprise);
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

      // Depuis le 19 octobre 2026, chaque tache a ses meubles: une station qui propose seule
      // une tache la recoit de toutes les listes qui l'ont, et deux stations qui proposent les
      // memes taches se partagent leurs listes. Ce sont elles qui doivent etre equilibrees.
      const parNatures = new Map<string, number[]>();
      amongDe(etat).stations.forEach((station, rang) => {
        const cle = [...station.natures].sort().join(',');
        parNatures.set(cle, [...(parNatures.get(cle) ?? []), prises[rang] ?? 0]);
      });
      for (const [natures, groupe] of parNatures) {
        if (groupe.length > 1) {
          expect(Math.max(...groupe) - Math.min(...groupe), natures).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('ne donne jamais deux fois la meme tache a une proie, et autant de longues que reglees', () => {
    // Retour d'essai du porteur du projet, 10 octobre 2026. Toutes les longueurs de liste, tous
    // les nombres de taches longues (etape 7.24), en normal et en miroir, et assez de graines
    // pour tomber sur des stations actives qui couvrent mal les natures.
    for (let taches = 3; taches <= NATURES_COURTES.length; taches += 1) {
      for (let longues = 0; longues <= 2; longues += 1) {
        for (let graine = 1; graine <= 30; graine += 1) {
          const etat = lancee(
            12,
            {
              modeMiroir: graine % 2 === 0,
              among: { tueurs: 1, tachesParProie: taches, tachesLongues: longues },
            },
            graine,
          );

          for (const id of camps(etat).proies) {
            const liste = role(etat, id).taches;

            expect(liste).toHaveLength(taches);
            expect(new Set(liste.map((tache) => tache.nature)).size).toBe(taches);
            expect(new Set(liste.map((tache) => tache.station)).size).toBe(taches);
            expect(liste.filter((tache) => estUneTacheLongue(tache.nature))).toHaveLength(longues);
          }
        }
      }
    }
  });

  it('garde des stations actives de quoi faire les taches courtes et les longues demandees', () => {
    for (let graine = 1; graine <= 40; graine += 1) {
      for (const longues of [0, 2]) {
        const stations = amongDe(
          lancee(5, { among: { tachesParProie: 3, tachesLongues: longues } }, graine),
        ).stations;
        const natures = new Set(stations.flatMap((station) => station.natures));

        // Trois taches plus quatre, ou sept courtes et les longues a des stations distinctes.
        expect(stations).toHaveLength(Math.max(7, NATURES_COURTES.length + longues));
        for (const nature of NATURES_COURTES) {
          expect(natures.has(nature)).toBe(true);
        }
        expect(
          stations.filter((station) => station.natures.some(estUneTacheLongue)).length,
        ).toBeGreaterThanOrEqual(longues);
      }
    }
  });

  it('fait varier les mini-jeux d une proie a l autre', () => {
    const etat = lancee(12, { among: { tueurs: 1, tachesLongues: 1 } }, 4);
    const longues = new Set(
      camps(etat).proies.flatMap((id) =>
        role(etat, id)
          .taches.filter((tache) => estUneTacheLongue(tache.nature))
          .map((tache) => tache.nature),
      ),
    );

    expect(longues.size).toBeGreaterThan(1);
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
    /** Sa station a un meuble, dont le tour l'ouvre aussi (16 octobre 2026). */
    habillee: boolean;
    minimum: number;
  } {
    const etat = disperser(enJeu());
    const proie = camps(etat).proies[0] as string;
    const [premiere, ...autres] = role(etat, proie).taches;
    if (premiere === undefined) {
      throw new Error('La proie devrait avoir une tache.');
    }
    const tache = { ...premiere, nature: nature ?? premiere.nature };
    const station = amongDe(etat).stations[tache.station] as StationDuMode;
    return {
      etat: placer(avecRole(etat, proie, { taches: [tache, ...autres] }), proie, station),
      proie,
      station: { x: station.x, y: station.y },
      habillee: station.emprise !== undefined,
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
    const { etat, proie, station, habillee, minimum } = aSaStation();
    const ouverte = tick(ouvrir(etat, proie), {}, minimum);

    const fermee = tick(ouverte, { [proie]: geste({ tache: 'fermee' }) }, 50);
    expect(role(fermee, proie).tacheEnCours).toBeUndefined();
    expect(role(fermee, proie).taches[0]?.faite).toBe(false);

    // Hors du disque; et, pour une station habillee d'un meuble, hors de son tour (16 octobre
    // 2026).
    const dehors = placer(
      ouverte,
      proie,
      habillee
        ? { x: station.x + 400, y: station.y }
        : { x: station.x + AMONG.RAYON_D_UNE_STATION_PX + 1, y: station.y },
    );
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

// --------------------------------------------------------------------------
// Les sabotages et la malediction (etape 7.22)
// --------------------------------------------------------------------------

/** Les postes des sabotages de Tokyo, dans le sens normal. */
const LIEUX_TOKYO = LIEUX_DES_CARTES.map1 as LieuxDuMode;

/** Une partie en jeu, la recharge des sabotages du debut du tour passee, tout le monde disperse. */
function pretASaboter(joueurs = 7, reglages: ReglagesPartiels = {}): EtatPartie {
  return disperser(
    tick(enJeu(joueurs, reglages), {}, AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS),
  );
}

/** Un battement ou ce joueur demande ce sabotage. */
function sabote(
  etat: EtatPartie,
  id: IdentifiantEntite,
  nature: NatureDeSabotage,
  station?: number,
): EtatPartie {
  return tick(
    etat,
    { [id]: geste({ saboter: { nature, ...(station === undefined ? {} : { station }) } }) },
    50,
  );
}

/** Ces joueurs tiennent le bouton d'action pendant ce temps, en un battement. */
function tenir(etat: EtatPartie, ids: readonly IdentifiantEntite[], dtMs: number): EtatPartie {
  return tick(etat, Object.fromEntries(ids.map((id) => [id, geste({ agir: true })])), dtMs);
}

describe('les sabotages (etape 7.22)', () => {
  it('sont reserves aux assassins, vivants ou fantomes', () => {
    const etat = pretASaboter();
    const { tueurs, proies } = camps(etat);
    const proie = proies[0] as string;

    expect(amongDe(sabote(etat, proie, 'panne')).sabotage).toBeUndefined();
    expect(amongDe(sabote(etat, tueurs[0] as string, 'panne')).sabotage?.nature).toBe('panne');

    const fantome = avecRole(etat, tueurs[0] as string, { fantome: true });
    expect(amongDe(sabote(fantome, tueurs[0] as string, 'panne')).sabotage?.nature).toBe('panne');
  });

  it('attendent quinze secondes au debut d un tour', () => {
    const debut = disperser(enJeu(7));
    const tueur = camps(debut).tueurs[0] as string;

    expect(amongDe(debut).rechargeDesSabotagesMs).toBe(
      AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS,
    );
    expect(amongDe(sabote(debut, tueur, 'flou')).sabotage).toBeUndefined();
    expect(amongDe(sabote(pretASaboter(), tueur, 'flou')).sabotage?.nature).toBe('flou');
  });

  it('ne sont qu un a la fois, puis la recharge commune repart de la fin du precedent', () => {
    const etat = pretASaboter();
    const [premier, second] = camps(etat).tueurs as [string, string];
    const encours = sabote(etat, premier, 'flou');

    // Un second sabotage, d'un autre assassin, pendant le premier: refuse.
    expect(amongDe(sabote(encours, second, 'panne')).sabotage?.nature).toBe('flou');

    const fini = tick(encours, {}, AMONG.DUREE_D_UNE_NUISANCE_MS);
    expect(amongDe(fini).sabotage).toBeUndefined();
    expect(evenements(fini, 'sabotageFini')).toEqual([
      { type: 'sabotageFini', nature: 'flou', repare: false },
    ]);
    expect(amongDe(fini).rechargeDesSabotagesMs).toBe(AMONG.RECHARGE_DES_SABOTAGES_MS);
    expect(amongDe(sabote(fini, second, 'panne')).sabotage).toBeUndefined();

    const pret = tick(fini, {}, AMONG.RECHARGE_DES_SABOTAGES_MS);
    expect(amongDe(sabote(pret, second, 'panne')).sabotage?.nature).toBe('panne');
  });

  it('frappent les proies vivantes d une nuisance, sans nommer le saboteur', () => {
    for (const nature of NUISANCES) {
      const etat = pretASaboter();
      const { tueurs, proies } = camps(etat);
      const morte = proies[0] as string;
      const avecUnFantome = avecRole(etat, morte, { fantome: true });
      const apres = sabote(avecUnFantome, tueurs[0] as string, nature);
      const vivantes = proies.filter((id) => id !== morte);

      expect(evenements(apres, 'sabotage')).toEqual([
        { type: 'sabotage', nature, victimes: vivantes },
      ]);
      for (const id of vivantes) {
        expect(joueurDe(apres, id).malusRestantsMs[nature]).toBe(AMONG.DUREE_D_UNE_NUISANCE_MS);
      }
      for (const id of [...tueurs, morte]) {
        expect(joueurDe(apres, id).malusRestantsMs[nature]).toBe(0);
      }
    }
  });

  it('font marcher une proie a l envers sous les commandes inversees', () => {
    const etat = sabote(
      pretASaboter(),
      camps(pretASaboter()).tueurs[0] as string,
      'controlesInverses',
    );
    const proie = camps(etat).proies[0] as string;
    const avant = joueurDe(etat, proie).position;
    const apres = tick(etat, { [proie]: { deplacement: { x: 1, y: 0 }, enMouvement: true } }, 100);

    expect(joueurDe(apres, proie).position.x).toBeLessThan(avant.x);
  });

  it('posent le nuage noir sur une station active, vingt secondes', () => {
    const etat = pretASaboter();
    const tueur = camps(etat).tueurs[0] as string;

    // Sans station, ou une station qui n'existe pas: refuse.
    expect(amongDe(sabote(etat, tueur, 'nuage')).sabotage).toBeUndefined();
    expect(amongDe(sabote(etat, tueur, 'nuage', 99)).sabotage).toBeUndefined();

    const nuage = sabote(etat, tueur, 'nuage', 2);
    const station = amongDe(nuage).stations[2] as StationDuMode;
    expect(nuageEnAmong(nuage)).toEqual({ x: station.x, y: station.y });
    expect(nuageEnAmong(etat)).toBeUndefined();
    expect(evenements(nuage, 'sabotage')).toEqual([
      { type: 'sabotage', nature: 'nuage', victimes: [] },
    ]);

    const fini = tick(nuage, {}, AMONG.DUREE_DU_NUAGE_MS);
    expect(nuageEnAmong(fini)).toBeUndefined();
  });
});

/** La partie avec ces reparations tirees (etape 7.27), quelle que soit sa graine. */
function avecReparations(etat: EtatPartie, reparations: Partial<ReparationsAmong>): EtatPartie {
  const among = amongDe(etat);
  return { ...etat, among: { ...among, reparations: { ...among.reparations, ...reparations } } };
}

/** Un battement ou ces joueurs annoncent leur reparation finie, ou fermee. */
function annoncer(
  etat: EtatPartie,
  ids: readonly IdentifiantEntite[],
  quoi: 'finie' | 'fermee' = 'finie',
  dtMs = 50,
): EtatPartie {
  return tick(etat, Object.fromEntries(ids.map((id) => [id, geste({ reparation: quoi })])), dtMs);
}

/** Un battement ou ce joueur appuie sur le bouton d'action, ou il se tient. */
function appuyerIci(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  return tick(etat, { [id]: geste({ agir: true }) }, 50);
}

/** Un joueur a ce poste, qui appuie pour ouvrir sa reparation, puis lache le bouton. */
function ouvrirAuPoste(etat: EtatPartie, id: IdentifiantEntite, poste: Position): EtatPartie {
  return tick(appuyerIci(placer(etat, id, poste), id), {}, 50);
}

/**
 * Les stations actives et les listes que la graine 4, ou le premier joueur tire l'assassin,
 * donnait avant le tirage des reparations
 * (etape 7.27): le scenario de bout en bout tient a cette graine. Elles changent avec les taches
 * de chaque meuble (16 et 19 octobre 2026): seuls les roles doivent rester, que le scenario lit.
 */
const STATIONS_DE_LA_GRAINE_4 = [
  "Bornes roses de l'arcade",
  "Bornes rouges de l'arcade",
  "Lavabos de l'arcade",
  'Distributeur du jardin',
  'Ordinateur de la maison',
  'Meubles de la maison',
  'Cuisine du restaurant',
  "Meuble d'entrée de l'hôtel",
  'Tapis du salon',
];
const LISTES_DE_LA_GRAINE_4 = {
  j1: '',
  j2: '2lunettes,3fumee,0caisses,7munitions,4couleurs',
  j3: '1envahisseurs,6katana,5munitions,8sang,3fumee',
  j4: '1serpent,4couleurs,7munitions,5mines,2lunettes',
  j5: '6katana,0bataille,8sang,3fumee,5munitions',
};

describe('le tirage des reparations (etape 7.27)', () => {
  it('tire une reparation de chaque sabotage, toujours la meme a graine egale', () => {
    const une = amongDe(lancee(5, {}, 11)).reparations;

    expect(REPARATIONS_DE_LA_PANNE).toContain(une.panne);
    expect(REPARATIONS_DE_LA_SURCHAUFFE).toContain(une.surchauffe);
    expect(amongDe(lancee(5, {}, 11)).reparations).toEqual(une);
  });

  it('tire chacune des cinq sur un echantillon de graines', () => {
    const tirees = new Set<string>();

    for (let graine = 1; graine <= 40; graine += 1) {
      const { panne, surchauffe } = amongDe(lancee(5, {}, graine)).reparations;
      tirees.add(panne);
      tirees.add(surchauffe);
    }

    expect([...tirees].sort()).toEqual(
      [...REPARATIONS_DE_LA_PANNE, ...REPARATIONS_DE_LA_SURCHAUFFE].sort(),
    );
  });

  it('se fait apres les roles, les stations et les listes, qui ne changent pas', () => {
    // La graine 4: le premier joueur y tire l'assassin.
    const etat = lancee(5, {}, 4);
    const among = amongDe(etat);

    expect(camps(etat).tueurs).toEqual(['j1']);
    expect(among.stations.map((station) => station.nom)).toEqual(STATIONS_DE_LA_GRAINE_4);
    expect(
      Object.fromEntries(
        Object.entries(among.joueurs).map(([id, joueur]) => [
          id,
          joueur.taches.map((tache) => `${String(tache.station)}${tache.nature}`).join(','),
        ]),
      ),
    ).toEqual(LISTES_DE_LA_GRAINE_4);
  });

  it('ne tire rien dans les autres modes', () => {
    const classique = lancerLaPartie(
      ajouterJoueur(creerEtatInitial({ graine: 7, mode: 'classique' }), {
        id: 'j1',
        pseudo: 'Joueur 1',
      }),
    );

    expect(classique.among).toBeUndefined();
  });
});

describe('la panne de neons (etapes 7.22 et 7.27)', () => {
  /** Une panne en cours, et les joueurs nommes. */
  function enPanne(): { etat: EtatPartie; tueur: string; proie: string; autre: string } {
    const etat = pretASaboter();
    const { tueurs, proies } = camps(etat);
    const tueur = tueurs[0] as string;

    return {
      etat: avecReparations(sabote(etat, tueur, 'panne'), { panne: 'fusibles' }),
      tueur,
      proie: proies[0] as string,
      autre: proies[1] as string,
    };
  }

  it('reduit la vision des seules proies vivantes, jusqu a la reparation', () => {
    const { etat, tueur, proie, autre } = enPanne();
    const fantome = avecRole(etat, autre, { fantome: true });

    expect(rayonDeVision(fantome, proie)).toBe(AMONG.RAYON_DE_VISION_EN_PANNE_PX);
    expect(rayonDeVision(fantome, tueur)).toBe(RAYONS_DE_VISION.tueur.normale);
    expect(rayonDeVision(fantome, autre)).toBe(Number.POSITIVE_INFINITY);
    expect(amongDe(tick(etat, {}, 60_000)).sabotage?.nature).toBe('panne');
  });

  it('ne se repare plus en tenant le bouton d action au boitier', () => {
    const { etat, proie } = enPanne();
    const tenu = tenir(placer(etat, proie, LIEUX_TOKYO.boitier), [proie], 10_000);

    expect(amongDe(tenu).sabotage?.nature).toBe('panne');
    expect(role(tenu, proie).reparationEnCours).toEqual({ poste: 'boitier', ecouleMs: 0 });
  });

  it('s ouvre au boitier par le bouton d action, et nulle part ailleurs', () => {
    const { etat, proie } = enPanne();

    expect(role(ouvrirAuPoste(etat, proie, LIEUX_TOKYO.boitier), proie).reparationEnCours).toEqual({
      poste: 'boitier',
      ecouleMs: 50,
    });
    const loin = { x: LIEUX_TOKYO.boitier.x + AMONG.RAYON_D_UN_POSTE_PX + 5, y: 495 };
    expect(role(ouvrirAuPoste(etat, proie, loin), proie).reparationEnCours).toBeUndefined();
    // Une console n'est pas un poste de la panne.
    expect(
      role(ouvrirAuPoste(etat, proie, LIEUX_TOKYO.consoles[0]), proie).reparationEnCours,
    ).toBeUndefined();
    // Sans panne, le boitier n'ouvre rien.
    expect(
      role(ouvrirAuPoste(pretASaboter(), proie, LIEUX_TOKYO.boitier), proie).reparationEnCours,
    ).toBeUndefined();
  });

  it('se repare par un geste fini a sa duree minimale, pas avant', () => {
    const { etat, proie } = enPanne();
    const ouverte = ouvrirAuPoste(etat, proie, LIEUX_TOKYO.boitier);
    const minimum = DUREES_MINIMALES_DES_REPARATIONS_MS.fusibles;

    const tot = annoncer(tick(ouverte, {}, minimum - 200), [proie]);
    expect(amongDe(tot).sabotage?.nature).toBe('panne');
    expect(role(tot, proie).reparationEnCours?.ecouleMs).toBe(minimum - 100);

    const reparee = annoncer(tick(tot, {}, 50), [proie]);
    expect(amongDe(reparee).sabotage).toBeUndefined();
    expect(role(reparee, proie).reparationEnCours).toBeUndefined();
    expect(evenements(reparee, 'sabotageFini')).toEqual([
      { type: 'sabotageFini', nature: 'panne', repare: true },
    ]);
    expect(rayonDeVision(reparee, proie)).toBe(RAYONS_DE_VISION.proie.normale);
  });

  it('s annule hors du disque ou fenetre fermee, et se reprend au debut', () => {
    const { etat, proie } = enPanne();
    const ouverte = tick(ouvrirAuPoste(etat, proie, LIEUX_TOKYO.boitier), {}, 2000);
    const fermee = annoncer(ouverte, [proie], 'fermee');
    expect(role(fermee, proie).reparationEnCours).toBeUndefined();

    const sortie = tick(
      placer(ouverte, proie, { x: LIEUX_TOKYO.boitier.x, y: LIEUX_TOKYO.boitier.y + 60 }),
      {},
      50,
    );
    expect(role(sortie, proie).reparationEnCours).toBeUndefined();

    // Rouverte, elle repart de zero: une fin aussitot est refusee.
    const rouverte = annoncer(ouvrirAuPoste(fermee, proie, LIEUX_TOKYO.boitier), [proie]);
    expect(amongDe(rouverte).sabotage?.nature).toBe('panne');
  });

  it('se repare par une proie fantome ou un assassin vivant, jamais un assassin fantome', () => {
    const { etat, tueur, proie } = enPanne();
    const repare = (courant: EtatPartie, id: string): boolean => {
      const ouverte = tick(ouvrirAuPoste(courant, id, LIEUX_TOKYO.boitier), {}, 3000);
      return amongDe(annoncer(ouverte, [id])).sabotage === undefined;
    };

    expect(repare(avecRole(etat, proie, { fantome: true }), proie)).toBe(true);
    expect(repare(etat, tueur)).toBe(true);
    expect(repare(avecRole(etat, tueur, { fantome: true }), tueur)).toBe(false);
  });

  it('se repare a plusieurs a la fois: le premier qui finit, et l autre fenetre se ferme', () => {
    const { etat, proie, autre } = enPanne();
    const deux = tick(
      tick(
        appuyerIci(
          appuyerIci(
            placer(placer(etat, proie, LIEUX_TOKYO.boitier), autre, {
              x: LIEUX_TOKYO.boitier.x + 20,
              y: LIEUX_TOKYO.boitier.y,
            }),
            proie,
          ),
          autre,
        ),
        {},
        50,
      ),
      {},
      3000,
    );

    expect(role(deux, autre).reparationEnCours?.poste).toBe('boitier');
    const reparee = annoncer(deux, [proie]);
    expect(amongDe(reparee).sabotage).toBeUndefined();
    expect(role(reparee, autre).reparationEnCours).toBeUndefined();
  });

  it('se ferme a la reunion, et le meurtre ferme celle de la victime', () => {
    const { etat, tueur, proie } = enPanne();
    const ouverte = ouvrirAuPoste(etat, proie, LIEUX_TOKYO.boitier);
    const pret = avecRole(ouverte, tueur, { rechargeMs: 0 });
    const tue = meurtre(placer(pret, tueur, { x: 1300, y: 495 }), tueur, proie);

    expect(role(tue, proie).fantome).toBe(true);
    expect(role(tue, proie).reparationEnCours).toBeUndefined();
  });

  it('tient le bouton pendant une reparation sans signaler ni sonner', () => {
    const { etat, proie } = enPanne();
    const ouverte = ouvrirAuPoste(etat, proie, LIEUX_TOKYO.boitier);
    const avecCadavre: EtatPartie = {
      ...ouverte,
      among: {
        ...amongDe(ouverte),
        cadavres: {
          c: { victime: 'j9', position: LIEUX_TOKYO.boitier, couleur: '#FF3030' },
        },
      },
    };

    expect(amongDe(appuyerIci(avecCadavre, proie)).phase).toBe('jeu');
  });
});

describe('la surchauffe (etapes 7.22 et 7.27)', () => {
  /** Une surchauffe en cours, reparee de cette facon, et deux proies. */
  function enSurchauffe(surchauffe: ReparationsAmong['surchauffe'] = 'cles'): {
    etat: EtatPartie;
    une: string;
    autre: string;
    tueur: string;
  } {
    const etat = pretASaboter();
    const { tueurs, proies } = camps(etat);

    return {
      etat: avecReparations(sabote(etat, tueurs[0] as string, 'surchauffe'), { surchauffe }),
      une: proies[0] as string,
      autre: proies[1] as string,
      tueur: tueurs[1] as string,
    };
  }

  /** Les deux proies a leur console, leur reparation ouverte. */
  function auxConsoles(etat: EtatPartie, une: string, autre: string): EtatPartie {
    return ouvrirAuPoste(
      ouvrirAuPoste(etat, une, LIEUX_TOKYO.consoles[0]),
      autre,
      LIEUX_TOKYO.consoles[1],
    );
  }

  it('fait gagner les assassins a son terme', () => {
    const { etat } = enSurchauffe();
    const avant = tick(etat, {}, AMONG.DELAI_DE_LA_SURCHAUFFE_MS - 100);
    expect(amongDe(avant).vainqueur).toBeUndefined();

    const perdue = tick(avant, {}, 100);
    expect(surchauffePerdue(amongDe(perdue))).toBe(true);
    expect(amongDe(perdue).vainqueur).toBe('tueurs');
    expect(campVainqueur(perdue)).toBe('tueurs');
  });

  it('retient le gong, et le terme du tour l attend', () => {
    const { etat } = enSurchauffe();
    const pres = placer(etat, 'j1', GONG);
    expect(amongDe(tick(pres, { j1: geste({ agir: true }) }, 50)).phase).toBe('jeu');

    // Un tour de 120 secondes a son terme pendant la surchauffe: pas de reunion d'office.
    const court = pretASaboter(7, { among: { dureeDuTourS: 120 } });
    const sabotee = sabote(
      tick(court, {}, 120_000 - AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS - 1000),
      camps(court).tueurs[0] as string,
      'surchauffe',
    );
    expect(amongDe(tick(sabotee, {}, 2000)).phase).toBe('jeu');
  });

  it('ne s ouvre qu aux vivants, a une console', () => {
    const { etat, une, tueur } = enSurchauffe();

    expect(role(ouvrirAuPoste(etat, une, LIEUX_TOKYO.consoles[1]), une).reparationEnCours).toEqual({
      poste: 1,
      ecouleMs: 50,
    });
    // Un assassin vivant y repare aussi, comme il tenait une console.
    expect(
      role(ouvrirAuPoste(etat, tueur, LIEUX_TOKYO.consoles[0]), tueur).reparationEnCours?.poste,
    ).toBe(0);
    const fantome = avecRole(etat, une, { fantome: true });
    expect(
      role(ouvrirAuPoste(fantome, une, LIEUX_TOKYO.consoles[0]), une).reparationEnCours,
    ).toBeUndefined();
    // Le boitier n'est pas un poste de la surchauffe.
    expect(
      role(ouvrirAuPoste(etat, une, LIEUX_TOKYO.boitier), une).reparationEnCours,
    ).toBeUndefined();
  });

  describe('les deux cles', () => {
    it('purge une console par un geste de deux secondes au moins', () => {
      const { etat, une, autre } = enSurchauffe('cles');
      const places = auxConsoles(etat, une, autre);

      const tot = annoncer(tick(places, {}, 1500), [une]);
      expect(amongDe(tot).sabotage?.consolesPurgees).toEqual([false, false]);

      const purgee = annoncer(tick(places, {}, DUREES_MINIMALES_DES_REPARATIONS_MS.purge), [une]);
      expect(amongDe(purgee).sabotage?.consolesPurgees).toEqual([true, false]);
      // La reparation reste ouverte: la cle s'y tourne ensuite.
      expect(role(purgee, une).reparationEnCours?.poste).toBe(0);
    });

    it('ne compte pas une cle tenue sans purge', () => {
      const { etat, une, autre } = enSurchauffe('cles');
      const tenues = tenir(auxConsoles(etat, une, autre), [une, autre], 5000);

      expect(amongDe(tenues).sabotage?.consolesTenues).toEqual([false, false]);
      expect(amongDe(tenues).sabotage?.nature).toBe('surchauffe');
    });

    it('repare quand les deux cles sont tenues ensemble une seconde, aux consoles purgees', () => {
      const { etat, une, autre } = enSurchauffe('cles');
      const purgees = annoncer(tick(auxConsoles(etat, une, autre), {}, 2000), [une, autre]);
      expect(amongDe(purgees).sabotage?.consolesPurgees).toEqual([true, true]);

      const une_seule = tenir(purgees, [une], 2000);
      expect(amongDe(une_seule).sabotage?.consolesTenues).toEqual([true, false]);
      expect(amongDe(une_seule).sabotage?.reparationMs).toBe(0);

      const ensemble = tenir(purgees, [une, autre], AMONG.REPARATION_DE_LA_SURCHAUFFE_MS - 50);
      expect(amongDe(ensemble).sabotage?.consolesTenues).toEqual([true, true]);

      const reparee = tenir(ensemble, [une, autre], 50);
      expect(amongDe(reparee).sabotage).toBeUndefined();
      expect(role(reparee, une).reparationEnCours).toBeUndefined();
      expect(evenements(reparee, 'sabotageFini')).toEqual([
        { type: 'sabotageFini', nature: 'surchauffe', repare: true },
      ]);
    });

    it('garde une console purgee si son reparateur s en va: un autre y tourne la cle', () => {
      const { etat, une, autre, tueur } = enSurchauffe('cles');
      const purgees = annoncer(tick(auxConsoles(etat, une, autre), {}, 2000), [une, autre]);
      const partie = placer(purgees, une, { x: 120, y: 820 });
      const parti = tick(partie, {}, 50);
      expect(amongDe(parti).sabotage?.consolesPurgees).toEqual([true, true]);
      expect(role(parti, une).reparationEnCours).toBeUndefined();

      const relaye = tenir(placer(parti, tueur, LIEUX_TOKYO.consoles[0]), [tueur, autre], 1000);
      expect(amongDe(relaye).sabotage).toBeUndefined();
    });

    it('ne compte pas un fantome a une console purgee', () => {
      const { etat, une, autre } = enSurchauffe('cles');
      const purgees = annoncer(tick(auxConsoles(etat, une, autre), {}, 2000), [une, autre]);
      const fantome = avecRole(purgees, autre, { fantome: true });

      expect(amongDe(tenir(fantome, [une, autre], 2000)).sabotage?.consolesTenues).toEqual([
        true,
        false,
      ]);
    });
  });

  describe('le relais', () => {
    it('coupe le premier interrupteur a l une ou l autre console, puis alterne', () => {
      for (const [premiere, seconde] of [
        ['une', 'autre'],
        ['autre', 'une'],
      ] as const) {
        const noms = enSurchauffe('relais');
        const places = tick(auxConsoles(noms.etat, noms.une, noms.autre), {}, 600);
        const coupe = annoncer(places, [noms[premiere]]);
        const sabotage = amongDe(coupe).sabotage;

        expect(sabotage?.interrupteursCoupes).toBe(1);
        expect(sabotage?.prochaineConsole).toBe(premiere === 'une' ? 1 : 0);

        // La meme console, hors de son tour: rien (reponse 1 du porteur du projet).
        const horsTour = annoncer(tick(coupe, {}, 1000), [noms[premiere]]);
        expect(amongDe(horsTour).sabotage?.interrupteursCoupes).toBe(1);

        const deux = annoncer(tick(coupe, {}, 600), [noms[seconde]]);
        expect(amongDe(deux).sabotage?.interrupteursCoupes).toBe(2);
      }
    });

    it('compte chaque interrupteur 0,6 seconde au moins, du precedent', () => {
      const { etat, une, autre } = enSurchauffe('relais');
      const places = tick(auxConsoles(etat, une, autre), {}, 5000);
      const premier = annoncer(places, [une]);
      // L'autre console attendait depuis cinq secondes: son interrupteur se compte du premier.
      const tot = annoncer(premier, [autre]);
      expect(amongDe(tot).sabotage?.interrupteursCoupes).toBe(1);

      const aTemps = annoncer(tick(tot, {}, 550), [autre]);
      expect(amongDe(aTemps).sabotage?.interrupteursCoupes).toBe(2);
    });

    it('repare la surchauffe a son quatrieme interrupteur', () => {
      const { etat, une, autre } = enSurchauffe('relais');
      let courant = auxConsoles(etat, une, autre);

      for (let rang = 0; rang < AMONG.INTERRUPTEURS_DU_RELAIS; rang += 1) {
        courant = annoncer(tick(courant, {}, 600), [rang % 2 === 0 ? une : autre]);
      }

      expect(amongDe(courant).sabotage).toBeUndefined();
      expect(evenements(courant, 'sabotageFini')).toEqual([
        { type: 'sabotageFini', nature: 'surchauffe', repare: true },
      ]);
    });

    it('garde les interrupteurs coupes quand un reparateur meurt: un autre reprend', () => {
      const { etat, une, autre, tueur } = enSurchauffe('relais');
      const coupe = annoncer(tick(auxConsoles(etat, une, autre), {}, 600), [une]);
      const assassin = camps(coupe).tueurs.find((id) => id !== tueur) as string;
      const tue = meurtre(coupe, assassin, une);
      expect(role(tue, une).fantome).toBe(true);
      expect(role(tue, une).reparationEnCours).toBeUndefined();
      const relais = tick(ouvrirAuPoste(tue, tueur, LIEUX_TOKYO.consoles[0]), {}, 600);

      expect(amongDe(relais).sabotage?.interrupteursCoupes).toBe(1);
      const deux = annoncer(relais, [autre]);
      const trois = annoncer(tick(deux, {}, 600), [tueur]);
      expect(amongDe(trois).sabotage?.interrupteursCoupes).toBe(3);
    });

    it('ne se tient pas: le bouton tenu ne coupe rien', () => {
      const { etat, une, autre } = enSurchauffe('relais');
      const tenus = tenir(auxConsoles(etat, une, autre), [une, autre], 10_000);

      expect(amongDe(tenus).sabotage?.interrupteursCoupes).toBe(0);
      expect(amongDe(tenus).sabotage?.consolesTenues).toEqual([false, false]);
    });
  });

  it('ne se repare plus apres son terme', () => {
    const { etat, une, autre } = enSurchauffe('relais');
    let courant = auxConsoles(etat, une, autre);

    for (let rang = 0; rang < AMONG.INTERRUPTEURS_DU_RELAIS - 1; rang += 1) {
      courant = annoncer(tick(courant, {}, 600), [rang % 2 === 0 ? une : autre]);
    }

    const perdue = tick(courant, {}, AMONG.DELAI_DE_LA_SURCHAUFFE_MS);
    expect(amongDe(perdue).vainqueur).toBe('tueurs');
    const apres = annoncer(perdue, [autre]);
    expect(amongDe(apres).sabotage?.interrupteursCoupes).toBe(3);
    expect(amongDe(apres).vainqueur).toBe('tueurs');
  });
});

describe('la reunion et les sabotages (etape 7.22)', () => {
  it('finit le sabotage en cours, et efface les malus de chacun', () => {
    const etat = pretASaboter();
    const { tueurs, proies } = camps(etat);
    const sabotee = sabote(etat, tueurs[0] as string, 'negatif');
    const tueur = tueurs[1] as string;
    const proie = proies[0] as string;
    const place = joueurDe(sabotee, tueur).position;
    const tue = tick(
      placer(sabotee, proie, { x: place.x + 20, y: place.y }),
      { [tueur]: geste({ capturer: true }) },
      50,
    );
    const temoin = proies[1] as string;
    const cadavre = Object.values(amongDe(tue).cadavres)[0]?.position as Position;
    const reunion = tick(placer(tue, temoin, cadavre), { [temoin]: geste({ agir: true }) }, 50);

    expect(amongDe(reunion).phase).toBe('discussion');
    expect(amongDe(reunion).sabotage).toBeUndefined();
    for (const id of Object.keys(reunion.joueurs)) {
      expect(joueurDe(reunion, id).malusRestantsMs.negatif).toBe(0);
    }
  });

  it('remet la recharge des sabotages a quinze secondes au tour suivant', () => {
    const etat = pretASaboter();
    const vote = auVoteApres(tick(etat, {}, AMONG.DELAI_DU_GONG_MS));
    const tour = tick(tick(vote, {}, 45_000), {}, AMONG.DUREE_EJECTION_MS);

    expect(amongDe(tour).tour).toBe(2);
    expect(amongDe(tour).rechargeDesSabotagesMs).toBe(
      AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS,
    );
  });
});

describe('la malediction des fantomes (etape 7.22)', () => {
  /** Une partie en jeu, passe le delai de la malediction, une proie fantome. */
  function maudissable(): { etat: EtatPartie; fantome: string } {
    const etat = pretASaboter();
    const fantome = camps(etat).proies[0] as string;

    return {
      etat: avecRole(tick(etat, {}, AMONG.DELAI_DE_LA_MALEDICTION_MS), fantome, { fantome: true }),
      fantome,
    };
  }

  it('frappe tous les assassins vivants du malus choisi, sans nommer le fantome', () => {
    for (const nature of NUISANCES) {
      const { etat, fantome } = maudissable();
      const { tueurs, proies } = camps(etat);
      const mort = avecRole(etat, tueurs[1] as string, { fantome: true });
      const apres = tick(mort, { [fantome]: geste({ maudire: nature }) }, 50);

      expect(evenements(apres, 'malediction')).toEqual([
        { type: 'malediction', nature, victimes: [tueurs[0]] },
      ]);
      expect(joueurDe(apres, tueurs[0] as string).malusRestantsMs[nature]).toBe(
        AMONG.DUREE_DE_LA_MALEDICTION_MS,
      );
      for (const id of [tueurs[1] as string, ...proies]) {
        expect(joueurDe(apres, id).malusRestantsMs[nature]).toBe(0);
      }
      expect(amongDe(apres).rechargeDeLaMaledictionMs).toBe(AMONG.RECHARGE_DE_LA_MALEDICTION_MS);
    }
  });

  it('n appartient qu aux proies fantomes, une fois par recharge commune', () => {
    const { etat, fantome } = maudissable();
    const { tueurs, proies } = camps(etat);
    const maudit = (courant: EtatPartie, id: string): boolean =>
      evenements(tick(courant, { [id]: geste({ maudire: 'flou' }) }, 50), 'malediction').length ===
      1;

    expect(maudit(etat, proies[1] as string)).toBe(false);
    expect(
      maudit(avecRole(etat, tueurs[0] as string, { fantome: true }), tueurs[0] as string),
    ).toBe(false);

    const apres = tick(etat, { [fantome]: geste({ maudire: 'flou' }) }, 50);
    const autre = proies[1] as string;
    const deux = avecRole(apres, autre, { fantome: true });
    expect(maudit(deux, autre)).toBe(false);
    expect(maudit(tick(deux, {}, AMONG.RECHARGE_DE_LA_MALEDICTION_MS), autre)).toBe(true);
  });

  it('attend les premieres secondes du tour', () => {
    const etat = disperser(enJeu(7));
    const fantome = camps(etat).proies[0] as string;
    const tot = avecRole(etat, fantome, { fantome: true });

    expect(
      evenements(tick(tot, { [fantome]: geste({ maudire: 'negatif' }) }, 50), 'malediction'),
    ).toHaveLength(0);
  });
});
