/**
 * Tests du deguisement d'Among Ninjas cote serveur (etape 7.28): ce que chacun recoit d'un joueur
 * deguise, de la foule et de l'habit, jusque dans les trames.
 *
 * La regle de ce fichier: un client ne peut pas savoir qui est deguise en lisant ses trames, sauf
 * ce que son role lui permet (lui-meme, ses complices, un fantome).
 */

import type { BotVu, InstantanePartie } from '@neon-ninja/shared';
import { AMONG, COULEUR_DE_LA_FOULE, appliquerTrame, encoderImage } from '@neon-ninja/shared';
import type { EtatAmong, EtatPartie, IdentifiantEntite, JoueurAmong } from '@neon-ninja/sim';
import {
  ajouterBot,
  ajouterJoueur,
  creerEtatInitial,
  estTueur,
  lancerLaPartie,
  tick,
} from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import { etatPriveDe, notificationsDe } from './instantane.js';
import { aliasDesNinjas, vuePour } from './vues.js';

/** Les alias d'une partie, sous un secret fixe. */
const ALIAS = aliasDesNinjas(new Uint8Array(16).fill(7));

/** Une partie de sept, nommes j1 a j7, deux assassins, la revelation passee. */
function enJeu(): EtatPartie {
  let etat = creerEtatInitial({
    graine: 11,
    mode: 'among',
    reglages: { among: { foule: 0, tueurs: 2 } },
  });
  for (let rang = 1; rang <= 7; rang += 1) {
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

function amongDe(etat: EtatPartie): EtatAmong {
  if (etat.among === undefined) {
    throw new Error('La partie devrait etre lancee.');
  }
  return etat.among;
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

/**
 * Une scene au milieu de la grande rue: un assassin deguise, son complice, trois proies dont
 * une fantome, deux PNJ, tous a moins de 100 pixels les uns des autres.
 */
function scene(): {
  readonly etat: EtatPartie;
  readonly deguise: string;
  readonly complice: string;
  readonly proie: string;
  readonly fantome: string;
} {
  let etat = enJeu();
  const ids = Object.keys(etat.joueurs);
  const [deguise, complice] = ids.filter((id) => estTueur(etat, id)) as [string, string];
  const [proie, autre, fantome] = ids.filter((id) => !estTueur(etat, id)) as [
    string,
    string,
    string,
  ];
  etat = placer(etat, deguise, 1000, 680);
  etat = placer(etat, complice, 1040, 680);
  etat = placer(etat, proie, 960, 680);
  etat = placer(etat, autre, 1000, 720);
  etat = avecRole(placer(etat, fantome, 980, 700), fantome, { fantome: true });
  etat = avecRole(etat, deguise, { deguisementMs: 12_000, deguisements: 1 });
  etat = ajouterBot(etat, {
    id: 'bot-90',
    type: 'bot',
    position: { x: 1020, y: 650 },
    couleur: COULEUR_DE_LA_FOULE,
  });
  etat = ajouterBot(etat, {
    id: 'bot-91',
    type: 'bot',
    position: { x: 990, y: 640 },
    couleur: COULEUR_DE_LA_FOULE,
  });

  return { etat, deguise, complice, proie, fantome };
}

/** Les PNJ d'une vue. */
function pnjs(vue: InstantanePartie): BotVu[] {
  return vue.entites.filter((entite): entite is BotVu => entite.type === 'bot');
}

describe('un deguise, vu d une proie', () => {
  it('est un PNJ gris, sans pseudo, sous un alias, range avec la foule', () => {
    const { etat, deguise, proie } = scene();
    const vue = vuePour(etat, proie, ALIAS);
    const foule = pnjs(vue);

    expect(vue.entites.some((entite) => entite.id === deguise)).toBe(false);
    expect(foule).toHaveLength(3);
    expect(foule.every((pnj) => pnj.couleur === COULEUR_DE_LA_FOULE)).toBe(true);
    expect(foule.every((pnj) => pnj.id.startsWith('pnj-'))).toBe(true);
    // Rien ne distingue le deguise des vrais PNJ: ni la forme de l'identifiant, ni sa place.
    expect(foule.map((pnj) => pnj.id)).toEqual([...foule.map((pnj) => pnj.id)].sort());
    expect(vue.entites.slice(-3).every((entite) => entite.type === 'bot')).toBe(true);
    expect(foule.map((pnj) => pnj.id)).not.toContain('bot-90');
    // Le classement nomme chaque joueur, par conception: il dit qui joue, pas ou.
    expect(JSON.stringify([vue.entites, vue.among])).not.toContain(deguise);
    expect(vue.among?.deguises).toBeUndefined();
  });

  it('change d alias d un deguisement a l autre', () => {
    const { etat, deguise, proie } = scene();
    const alias = (rang: number) =>
      pnjs(vuePour(avecRole(etat, deguise, { deguisements: rang }), proie, ALIAS)).map(
        (pnj) => pnj.id,
      );

    expect(alias(1)).not.toEqual(alias(2));
    // Les vrais PNJ gardent le leur.
    expect(alias(1).filter((id) => alias(2).includes(id))).toHaveLength(2);
  });

  it('ne se lit pas dans la trame', () => {
    const { etat, deguise, proie } = scene();
    const trame = encoderImage(vuePour(etat, proie, ALIAS));
    const relue = appliquerTrame(undefined, trame.octets);

    expect(relue?.entites.some((entite) => entite.id === deguise)).toBe(false);
    expect(JSON.stringify([relue?.entites, relue?.among])).not.toContain(deguise);
  });

  it('redevient lui-meme a la fin de son deguisement', () => {
    const { etat, deguise, proie } = scene();
    const among = amongDe(etat);
    const { deguisementMs: _fini, ...redevenu } = among.joueurs[deguise] as JoueurAmong;
    const fini = {
      ...etat,
      among: { ...among, joueurs: { ...among.joueurs, [deguise]: redevenu } },
    };
    const vue = vuePour(fini, proie, ALIAS);

    expect(vue.entites).toContainEqual(expect.objectContaining({ id: deguise, type: 'joueur' }));
    expect(pnjs(vue)).toHaveLength(2);
  });
});

describe('un deguise, vu de ceux qui le connaissent', () => {
  it('se voit lui-meme tel qu il est, et sait ce qu il lui reste', () => {
    const { etat, deguise } = scene();
    const vue = vuePour(etat, deguise, ALIAS);

    expect(vue.entites).toContainEqual(expect.objectContaining({ id: deguise, type: 'joueur' }));
    expect(vue.among?.deguises).toEqual([{ id: deguise, restantMs: 12_000 }]);
  });

  it('est vu tel qu il est de son complice, qui sait qu il est deguise', () => {
    const { etat, deguise, complice } = scene();
    const vue = vuePour(etat, complice, ALIAS);

    expect(vue.entites).toContainEqual(expect.objectContaining({ id: deguise, type: 'joueur' }));
    expect(vue.among?.deguises).toEqual([{ id: deguise, restantMs: 12_000 }]);
  });

  it('est vu tel qu il est des fantomes, qui savent tous les deguises', () => {
    const { etat, deguise, fantome } = scene();
    const vue = vuePour(etat, fantome, ALIAS);

    expect(vue.entites).toContainEqual(expect.objectContaining({ id: deguise, type: 'joueur' }));
    expect(vue.among?.deguises).toEqual([{ id: deguise, restantMs: 12_000 }]);
  });

  it('ne dit pas a une proie deguisee les autres deguises, seulement le sien', () => {
    const { etat, deguise, proie } = scene();
    const vue = vuePour(
      avecRole(etat, proie, { deguisementMs: 5000, deguisements: 1 }),
      proie,
      ALIAS,
    );

    expect(vue.among?.deguises).toEqual([{ id: proie, restantMs: 5000 }]);
    expect(vue.entites.some((entite) => entite.id === deguise)).toBe(false);
  });

  it('cache une proie deguisee aux assassins, sous un alias', () => {
    const { etat, complice, proie } = scene();
    const vue = vuePour(
      avecRole(etat, proie, { deguisementMs: 5000, deguisements: 1 }),
      complice,
      ALIAS,
    );

    expect(vue.entites.some((entite) => entite.id === proie)).toBe(false);
    expect(pnjs(vue)).toHaveLength(3);
  });
});

describe('l habit', () => {
  it('se montre a une proie vivante qui le voit, jamais a un assassin, toujours aux fantomes', () => {
    const { etat, complice, proie, fantome } = scene();
    const pose = { ...etat, among: { ...amongDe(etat), habit: { x: 1100, y: 680 } } };
    const loin = { ...etat, among: { ...amongDe(etat), habit: { x: 1900, y: 1400 } } };

    expect(vuePour(pose, proie, ALIAS).among?.habit).toEqual({ x: 1100, y: 680 });
    expect(vuePour(pose, complice, ALIAS).among?.habit).toBeUndefined();
    expect(vuePour(loin, proie, ALIAS).among?.habit).toBeUndefined();
    expect(vuePour(loin, fantome, ALIAS).among?.habit).toEqual({ x: 1900, y: 1400 });
  });

  it('se dit a la proie qui le porte, et a elle seule', () => {
    const { etat, proie, complice } = scene();
    const porte = avecRole(etat, proie, { habit: true });

    expect(etatPriveDe(porte, proie)?.habit).toBe(true);
    expect(etatPriveDe(porte, complice)?.habit).toBeUndefined();
    expect(etatPriveDe(etat, proie)?.habit).toBeUndefined();
  });
});

describe('les notifications', () => {
  it('ne disent a personne qu un joueur se deguise', () => {
    const { etat, deguise } = scene();
    const avecFaits = {
      ...etat,
      evenements: [
        { type: 'pnjTue' as const, tueur: deguise, pnj: 'bot-90', position: { x: 1, y: 1 } },
        { type: 'habitPris' as const, joueur: deguise },
        { type: 'deguisement' as const, joueur: deguise, quoi: 'debut' as const },
      ],
    };

    expect(notificationsDe(avecFaits)).toEqual([]);
  });
});
