/**
 * Tests du comportement des bots.
 *
 * Comme pour les zones a l'etape 1.4, la caracterisation de l'etape 0.2 n'a pas
 * pu figer ce domaine: l'errance d'un bot repose entierement sur Math.random et
 * Date.now, et son etat interne n'est jamais expose. Ces tests s'appuient donc
 * sur la lecture du code d'origine (Bot, legacy/server.js:941, et BlackBot,
 * :1130), et ils verifient en priorite ce qui s'en deduit: les seuils, les
 * priorites de ciblage, et les regles de la prise.
 *
 * Les bots sont poses par ajouterBot, qui tire leur cap et leurs compteurs au
 * sort, puis leurs compteurs sont replaces a la main: un test qui veut observer
 * un deplacement ne doit pas voir le bot partir en pause au milieu.
 */

import type { Position, ReglagesPartiels } from '@neon-ninja/shared';
import {
  BOTS,
  BOTS_NOIRS,
  CARTES,
  COULEUR_BOT_NEUTRE,
  DUREES,
  RAYON_ENTITE,
  VITESSES,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { avancerLesBots, faireApparaitreLesBotsNoirs, peuplerDeBots } from './bots.js';
import type { CarteCollisions } from './collisions.js';
import { creerCarteCollisions } from './collisions.js';
import type { Bot, BotNoir, BotOrdinaire, EtatPartie, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';

/** Un compte a rebours assez long pour qu'aucun essai ne le voie arriver a terme. */
const JAMAIS_MS = 1_000_000;

/** Un mur vertical infranchissable a partir de cette abscisse. */
function carteAvecMurALEst(abscisse: number): CarteCollisions {
  return creerCarteCollisions(CARTES.map1, (x) => x >= abscisse);
}

/** Une partie vide, sans mur, avec les reglages demandes. */
function partie(reglages?: ReglagesPartiels, terrain?: CarteCollisions): EtatPartie {
  return creerEtatInitial({
    graine: 7,
    ...(reglages === undefined ? {} : { reglages }),
    ...(terrain === undefined ? {} : { terrain }),
  });
}

/**
 * De quoi poser un bot dont aucun compte a rebours n'arrivera a terme tout seul,
 * cap a l'est.
 *
 * Les traits passes par un test ecrasent ce reglage de confort: c'est ainsi qu'il
 * arme precisement le compteur qu'il veut voir declencher.
 */
const TRAITS_CALMES = {
  cap: { x: 1, y: 0 },
  enMouvement: true,
  avantChangementDEtatMs: JAMAIS_MS,
  avantChangementDeCapMs: JAMAIS_MS,
  avantControleDeBlocageMs: JAMAIS_MS,
} as const;

/** Pose un bot ordinaire calme a la place demandee. */
function avecBot(
  etat: EtatPartie,
  id: string,
  position: Position,
  traits: Partial<BotOrdinaire> = {},
): EtatPartie {
  const pose = ajouterBot(etat, { id, position });
  const regle: BotOrdinaire = { ...(pose.bots[id] as BotOrdinaire), ...TRAITS_CALMES, ...traits };

  return { ...pose, bots: { ...pose.bots, [id]: regle } };
}

/** Meme chose pour un bot noir, dont on peut aussi imposer la proie. */
function avecBotNoir(
  etat: EtatPartie,
  id: string,
  position: Position,
  traits: Partial<BotNoir> = {},
): EtatPartie {
  const pose = ajouterBot(etat, { id, type: 'botNoir', position });
  const regle: BotNoir = { ...(pose.bots[id] as BotNoir), ...TRAITS_CALMES, ...traits };

  return { ...pose, bots: { ...pose.bots, [id]: regle } };
}

/** Ajoute un joueur immediatement vulnerable: la protection d'apparition genererait du bruit. */
function avecJoueur(etat: EtatPartie, id: string, position: Position, couleur = ROUGE): EtatPartie {
  const pose = ajouterJoueur(etat, { id, pseudo: id, position, couleur });
  const joueur = pose.joueurs[id] as Joueur;

  return {
    ...pose,
    joueurs: { ...pose.joueurs, [id]: { ...joueur, protectionSpawnRestanteMs: 0 } },
  };
}

/** Le bot que l'on sait present. */
function botDe(etat: EtatPartie, id: string): Bot {
  return etat.bots[id] as Bot;
}

/** Le bot noir que l'on sait present. */
function botNoirDe(etat: EtatPartie, id: string): BotNoir {
  return etat.bots[id] as BotNoir;
}

/** Le joueur que l'on sait present. */
function joueurDe(etat: EtatPartie, id: string): Joueur {
  return etat.joueurs[id] as Joueur;
}

/** Combien de bots ordinaires portent cette couleur. */
function botsDeCouleur(etat: EtatPartie, couleur: string): number {
  return Object.values(etat.bots).filter((bot) => bot.type === 'bot' && bot.couleur === couleur)
    .length;
}

describe('errance d un bot ordinaire', () => {
  it('avance le long de son cap a la vitesse des bots', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 });

    const apres = avancerLesBots(depart, 1000);

    expect(botDe(apres, 'b1').position.x).toBeCloseTo(500 + VITESSES.BOT_PX_PAR_SECONDE, 6);
    expect(botDe(apres, 'b1').position.y).toBeCloseTo(500, 6);
  });

  it('parcourt la meme distance en un grand pas de temps qu en vingt petits', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 });

    const dUnSeulCoup = avancerLesBots(depart, 1000);
    let parPetitsPas = depart;
    for (let battement = 0; battement < 20; battement += 1) {
      parPetitsPas = avancerLesBots(parPetitsPas, 50);
    }

    expect(botDe(parPetitsPas, 'b1').position.x).toBeCloseTo(
      botDe(dUnSeulCoup, 'b1').position.x,
      6,
    );
  });

  it('regarde dans la direction de son cap', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 }, { cap: { x: 0, y: 1 } });

    expect(botDe(avancerLesBots(depart, 50), 'b1').direction).toBe('sud');
  });

  it('regarde toujours quelque part, meme sur un pas de temps minuscule', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 });

    // Le pas vaut alors un centieme de pixel: c'est le cap qui donne la
    // direction, pas le deplacement, sans quoi le bot semblerait s'arreter.
    expect(botDe(avancerLesBots(depart, 0.1), 'b1').direction).toBe('est');
  });

  it('ne bouge pas et se fige quand il est en pause', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 }, { enMouvement: false });

    const apres = botDe(avancerLesBots(depart, 1000), 'b1');

    expect(apres.position).toEqual({ x: 500, y: 500 });
    expect(apres.direction).toBe('immobile');
  });

  it('bascule de la marche a la pause quand la duree de l etat est ecoulee', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 }, { avantChangementDEtatMs: 100 });

    const apres = botDe(avancerLesBots(depart, 100), 'b1');

    expect(apres.enMouvement).toBe(false);
    expect(apres.position).toEqual({ x: 500, y: 500 });
    expect(apres.direction).toBe('immobile');
    expect(apres.avantChangementDEtatMs).toBeGreaterThanOrEqual(BOTS.DUREE_ETAT_MINIMUM_MS);
  });

  it('remet son suivi de blocage a zero en entrant en pause', () => {
    const depart = avecBot(
      partie(),
      'b1',
      { x: 500, y: 500 },
      { avantChangementDEtatMs: 100, controlesSansAvancer: 2 },
    );

    expect(botDe(avancerLesBots(depart, 100), 'b1').controlesSansAvancer).toBe(0);
  });

  it('rattrape toutes les bascules franchies par un grand pas de temps', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 }, { avantChangementDEtatMs: 100 });

    const apres = botDe(avancerLesBots(depart, 10_000), 'b1');

    // Chaque duree tiree vaut au moins une seconde: la boucle se termine, et
    // elle laisse toujours un compte a rebours positif.
    expect(apres.avantChangementDEtatMs).toBeGreaterThan(0);
  });

  it('change de cap spontanement quand son intervalle est ecoule', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 }, { avantChangementDeCapMs: 100 });

    const apres = botDe(avancerLesBots(depart, 100), 'b1');

    expect(apres.cap).not.toEqual({ x: 1, y: 0 });
    expect(Math.hypot(apres.cap.x, apres.cap.y)).toBeCloseTo(1, 10);
    expect(apres.avantChangementDeCapMs).toBeGreaterThanOrEqual(BOTS.INTERVALLE_DE_CAP_MINIMUM_MS);
  });

  it('ne traverse pas un mur et cherche un autre cap au lieu de glisser le long', () => {
    const depart = avecBot(partie(undefined, carteAvecMurALEst(600)), 'b1', { x: 500, y: 500 });

    const apres = botDe(avancerLesBots(depart, 1000), 'b1');

    expect(apres.position).toEqual({ x: 500, y: 500 });
    expect(apres.cap).not.toEqual({ x: 1, y: 0 });
  });

  it('ne franchit jamais un mur, quel que soit le nombre de battements', () => {
    let courant = avecBot(partie(undefined, carteAvecMurALEst(600)), 'b1', { x: 500, y: 500 });

    for (let battement = 0; battement < 200; battement += 1) {
      courant = avancerLesBots(courant, 50);
      expect(botDe(courant, 'b1').position.x).toBeLessThanOrEqual(600 - RAYON_ENTITE);
    }
  });
});

describe('controle de blocage', () => {
  /** Un bot qui n'a pas avance depuis son dernier controle, et dont le controle est du. */
  function botCoince(controlesSansAvancer: number, terrain?: CarteCollisions): EtatPartie {
    return avecBot(
      partie(undefined, terrain),
      'b1',
      { x: 500, y: 500 },
      {
        controlesSansAvancer,
        avantControleDeBlocageMs: 0,
        positionAuDernierControle: { x: 500, y: 500 },
      },
    );
  }

  it('compte un controle sans avancer quand le bot n a pas bouge', () => {
    const apres = botDe(avancerLesBots(botCoince(0), 0), 'b1');

    expect(apres.controlesSansAvancer).toBe(1);
    expect(apres.avantControleDeBlocageMs).toBe(BOTS.CONTROLE_DE_BLOCAGE_MS);
  });

  it('remet le compte a zero des que le bot a de nouveau avance', () => {
    const depart = avecBot(
      partie(),
      'b1',
      { x: 500, y: 500 },
      {
        controlesSansAvancer: 4,
        avantControleDeBlocageMs: 0,
        positionAuDernierControle: { x: 400, y: 500 },
      },
    );

    expect(botDe(avancerLesBots(depart, 0), 'b1').controlesSansAvancer).toBe(0);
  });

  it('change de cap au-dela de trois controles sans avancer', () => {
    const apres = botDe(avancerLesBots(botCoince(BOTS.CONTROLES_AVANT_CHANGEMENT_DE_CAP), 0), 'b1');

    expect(apres.cap).not.toEqual({ x: 1, y: 0 });
    expect(apres.position).toEqual({ x: 500, y: 500 });
    expect(apres.controlesSansAvancer).toBe(BOTS.CONTROLES_AVANT_CHANGEMENT_DE_CAP + 1);
  });

  it('se degage d un bond au-dela de cinq controles sans avancer', () => {
    const apres = botDe(avancerLesBots(botCoince(BOTS.CONTROLES_AVANT_DEGAGEMENT), 0), 'b1');

    // Le premier des huit caps essayes est l'est, degage ici: le bot y bondit.
    expect(apres.position).toEqual({ x: 500 + BOTS.DISTANCE_DE_DEGAGEMENT_PX, y: 500 });
    expect(apres.controlesSansAvancer).toBe(0);
    expect(apres.positionAuDernierControle).toEqual(apres.position);
  });

  it('reapparait ailleurs quand aucun des huit caps de degagement ne passe', () => {
    // Un bot enferme dans une poche: tout ce qui l'entoure est mur.
    const terrain = creerCarteCollisions(
      CARTES.map1,
      (x, y) => Math.hypot(x - 500, y - 500) > 17 && Math.hypot(x - 500, y - 500) < 400,
    );
    const depart = avecBot(
      partie(undefined, terrain),
      'b1',
      { x: 500, y: 500 },
      {
        controlesSansAvancer: BOTS.CONTROLES_AVANT_DEGAGEMENT,
        avantControleDeBlocageMs: 0,
        positionAuDernierControle: { x: 500, y: 500 },
      },
    );

    const apres = botDe(avancerLesBots(depart, 0), 'b1');

    expect(apres.position).not.toEqual({ x: 500, y: 500 });
    expect(apres.controlesSansAvancer).toBe(0);
  });

  it('ne controle rien tant que le bot est en pause, mais controle des la reprise', () => {
    const enPause = avecBot(
      partie(),
      'b1',
      { x: 500, y: 500 },
      {
        enMouvement: false,
        avantControleDeBlocageMs: 10,
        controlesSansAvancer: 0,
      },
    );

    const apres = botDe(avancerLesBots(enPause, 100), 'b1');

    // Le compte a rebours est passe sous zero sans declencher: le controle aura
    // lieu au premier battement ou le bot essaiera de nouveau d'avancer.
    expect(apres.avantControleDeBlocageMs).toBeLessThan(0);
    expect(apres.controlesSansAvancer).toBe(0);
  });

  it('donne au bot noir un controle plus rapproche qu au bot ordinaire', () => {
    const depart = avecBotNoir(
      partie(),
      'bn',
      { x: 500, y: 500 },
      {
        avantControleDeBlocageMs: 0,
        positionAuDernierControle: { x: 500, y: 500 },
        avantRechercheDeCibleMs: JAMAIS_MS,
      },
    );

    // Sans proie, un bot noir erre: il passe donc par le meme controle.
    expect(botDe(avancerLesBots(depart, 0), 'bn').avantControleDeBlocageMs).toBe(
      BOTS.CONTROLE_DE_BLOCAGE_BOT_NOIR_MS,
    );
  });
});

describe('choix de la proie d un bot noir', () => {
  it('prend le joueur vulnerable le plus proche dans son rayon', () => {
    let depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });
    depart = avecJoueur(depart, 'loin', { x: 620, y: 500 }, BLEU);
    depart = avecJoueur(depart, 'pres', { x: 560, y: 500 }, ROUGE);

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBe('pres');
  });

  it('ne prend pas un joueur hors de son rayon de detection', () => {
    let depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });
    depart = avecJoueur(depart, 'a', { x: 500 + 200, y: 500 });

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBeUndefined();
  });

  it('ne prend pas un joueur protege par son apparition', () => {
    let depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });
    depart = ajouterJoueur(depart, { id: 'a', pseudo: 'a', position: { x: 560, y: 500 } });

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBeUndefined();
  });

  it('ne prend pas un bot neutre: il n y a rien a y prendre', () => {
    let depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });
    depart = avecBot(depart, 'b1', { x: 560, y: 500 });

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBeUndefined();
  });

  it('prend un bot deja capture quand aucun joueur n est a portee', () => {
    let depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });
    depart = avecBot(depart, 'b1', { x: 600, y: 500 }, { couleur: ROUGE });

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBe('b1');
  });

  it('prefere un joueur lointain a un bot tout proche', () => {
    let depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });
    depart = avecBot(depart, 'b1', { x: 600, y: 500 }, { couleur: ROUGE });
    depart = avecJoueur(depart, 'a', { x: 500, y: 640 });

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBe('a');
  });

  it('ignore les autres bots noirs', () => {
    let depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });
    depart = avecBotNoir(depart, 'bn2', { x: 560, y: 500 });

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBeUndefined();
  });

  it('lache une proie qui est sortie de son rayon', () => {
    let depart = avecJoueur(partie(), 'a', { x: 900, y: 500 });
    depart = avecBotNoir(
      depart,
      'bn',
      { x: 500, y: 500 },
      {
        cible: 'a',
        avantRechercheDeCibleMs: 500,
      },
    );

    expect(botNoirDe(avancerLesBots(depart, 1), 'bn').cible).toBeUndefined();
  });

  it('lache une proie qui a disparu de la partie', () => {
    const depart = avecBotNoir(
      partie(),
      'bn',
      { x: 500, y: 500 },
      {
        cible: 'fantome',
        avantRechercheDeCibleMs: 500,
      },
    );

    expect(botNoirDe(avancerLesBots(depart, 1), 'bn').cible).toBeUndefined();
  });

  it('lache le bot qu il poursuivait des qu un joueur entre dans son rayon', () => {
    let depart = avecBot(partie(), 'b1', { x: 600, y: 500 }, { couleur: ROUGE });
    depart = avecJoueur(depart, 'a', { x: 500, y: 620 });
    depart = avecBotNoir(
      depart,
      'bn',
      { x: 500, y: 500 },
      {
        cible: 'b1',
        avantRechercheDeCibleMs: 500,
      },
    );

    expect(botNoirDe(avancerLesBots(depart, 1), 'bn').cible).toBe('a');
  });

  it('lit le rayon de detection dans les reglages de la partie, defaut X14', () => {
    const reglages: ReglagesPartiels = { botsNoirs: { rayonDetectionPx: 50 } };
    let depart = avecBotNoir(partie(reglages), 'bn', { x: 500, y: 500 });
    depart = avecJoueur(depart, 'a', { x: 600, y: 500 });

    expect(botNoirDe(avancerLesBots(depart, 0), 'bn').cible).toBeUndefined();
  });
});

describe('poursuite et prise', () => {
  /** Un bot noir, un joueur a portee de bras, et le nombre de bots demande. */
  function situationDePrise(reglages?: ReglagesPartiels, botsRouges = 4): EtatPartie {
    let depart = avecJoueur(partie(reglages), 'a', { x: 510, y: 500 });

    for (let numero = 0; numero < botsRouges; numero += 1) {
      depart = avecBot(depart, `b${numero}`, { x: 1000 + numero * 40, y: 500 }, { couleur: ROUGE });
    }

    return avecBotNoir(depart, 'bn', { x: 500, y: 500 });
  }

  it('fonce vers sa proie', () => {
    let depart = avecJoueur(partie(), 'a', { x: 500, y: 600 });
    depart = avecBotNoir(depart, 'bn', { x: 500, y: 500 });

    const apres = botDe(avancerLesBots(depart, 200), 'bn');

    expect(apres.position.y).toBeCloseTo(500 + (VITESSES.BOT_NOIR_PX_PAR_SECONDE * 200) / 1000, 6);
    expect(apres.direction).toBe('sud');
  });

  it('fait perdre au joueur la part de bots reglee, et le fait reapparaitre', () => {
    const depart = situationDePrise();

    const apres = avancerLesBots(depart, 0);
    const victime = joueurDe(apres, 'a');

    expect(botsDeCouleur(apres, ROUGE)).toBe(2);
    expect(botsDeCouleur(apres, COULEUR_BOT_NEUTRE)).toBe(2);
    expect(victime.couleur).toBe(ROUGE);
    expect(victime.position).not.toEqual({ x: 510, y: 500 });
    expect(victime.protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
    expect(victime.capturesParBotNoirSubies).toBe(1);
  });

  it('ne cree aucun bot au passage, defaut X12', () => {
    const depart = situationDePrise();

    const apres = avancerLesBots(depart, 0);

    expect(Object.keys(apres.bots)).toHaveLength(Object.keys(depart.bots).length);
  });

  it('inscrit la prise au journal du battement', () => {
    const apres = avancerLesBots(situationDePrise(), 0);

    expect(apres.evenements).toEqual([
      {
        type: 'captureParBotNoir',
        botNoir: 'bn',
        victime: 'a',
        botsPerdus: 2,
        position: { x: 510, y: 500 },
      },
    ]);
  });

  it('lit la part de bots perdue dans les reglages de la partie, defaut X14', () => {
    const apres = avancerLesBots(
      situationDePrise({ botsNoirs: { partDeBotsPerduePourCent: 25 } }),
      0,
    );

    expect(botsDeCouleur(apres, ROUGE)).toBe(3);
  });

  it('arrondit la part perdue a l entier inferieur', () => {
    const apres = avancerLesBots(situationDePrise(undefined, 5), 0);

    expect(botsDeCouleur(apres, ROUGE)).toBe(3);
  });

  it('lache sa proie et rearme son delai apres une prise', () => {
    const apres = botNoirDe(avancerLesBots(situationDePrise(), 0), 'bn');

    expect(apres.cible).toBeUndefined();
    expect(apres.avantProchaineCaptureMs).toBe(BOTS_NOIRS.DELAI_ENTRE_CAPTURES_MS);
  });

  it('ne reprend rien tant que son delai de deux secondes court', () => {
    const depart = situationDePrise();
    const arme = {
      ...depart,
      bots: {
        ...depart.bots,
        bn: { ...botNoirDe(depart, 'bn'), avantProchaineCaptureMs: 2000 },
      },
    };

    const apres = avancerLesBots(arme, 0);

    expect(apres.evenements).toEqual([]);
    expect(joueurDe(apres, 'a').capturesParBotNoirSubies).toBe(0);
  });

  it('reprend des que son delai est ecoule', () => {
    const depart = situationDePrise();
    const arme = {
      ...depart,
      bots: {
        ...depart.bots,
        bn: { ...botNoirDe(depart, 'bn'), avantProchaineCaptureMs: 2000 },
      },
    };

    expect(joueurDe(avancerLesBots(arme, 2000), 'a').capturesParBotNoirSubies).toBe(1);
  });

  it('epargne un joueur invulnerable sans consommer son delai', () => {
    const depart = situationDePrise();
    const protege: EtatPartie = {
      ...depart,
      joueurs: {
        ...depart.joueurs,
        a: { ...joueurDe(depart, 'a'), protectionSpawnRestanteMs: 3000 },
      },
      bots: {
        ...depart.bots,
        bn: { ...botNoirDe(depart, 'bn'), cible: 'a', avantRechercheDeCibleMs: 500 },
      },
    };

    const apres = avancerLesBots(protege, 1);

    expect(joueurDe(apres, 'a').capturesParBotNoirSubies).toBe(0);
    expect(botNoirDe(apres, 'bn').avantProchaineCaptureMs).toBe(0);
  });

  it('rend sa neutralite a un bot capture qu il attrape', () => {
    let depart = avecBot(partie(), 'b1', { x: 510, y: 500 }, { couleur: ROUGE });
    depart = avecBotNoir(depart, 'bn', { x: 500, y: 500 });

    const apres = avancerLesBots(depart, 0);

    expect(botDe(apres, 'b1').couleur).toBe(COULEUR_BOT_NEUTRE);
    expect(botNoirDe(apres, 'bn').avantProchaineCaptureMs).toBe(BOTS_NOIRS.DELAI_ENTRE_CAPTURES_MS);
  });

  it('ne traverse pas les murs en poursuivant, defaut X27', () => {
    const reglages: ReglagesPartiels = { botsNoirs: { rayonDetectionPx: 800 } };
    let courant = avecJoueur(partie(reglages, carteAvecMurALEst(600)), 'a', { x: 900, y: 500 });
    courant = avecBotNoir(courant, 'bn', { x: 500, y: 500 });

    for (let battement = 0; battement < 40; battement += 1) {
      courant = avancerLesBots(courant, 50);
      expect(botDe(courant, 'bn').position.x).toBeLessThanOrEqual(600 - RAYON_ENTITE);
    }
  });

  it('attrape une proie sur laquelle il est exactement pose', () => {
    let depart = avecJoueur(partie(), 'a', { x: 500, y: 500 });
    depart = avecBotNoir(depart, 'bn', { x: 500, y: 500 });

    // Sans direction a suivre, le bot noir ne bouge pas, mais il prend quand
    // meme: sans cela il resterait bloque sur sa proie sans jamais l'attraper.
    expect(joueurDe(avancerLesBots(depart, 50), 'a').capturesParBotNoirSubies).toBe(1);
  });

  it('ne rend jamais neutre un autre bot noir', () => {
    let depart = avecBotNoir(partie(), 'proie', { x: 510, y: 500 });
    depart = avecBotNoir(
      depart,
      'bn',
      { x: 500, y: 500 },
      {
        cible: 'proie',
        avantRechercheDeCibleMs: 500,
      },
    );

    const apres = avancerLesBots(depart, 1);

    expect(botDe(apres, 'proie').couleur).toBe('#000000');
    expect(botNoirDe(apres, 'bn').avantProchaineCaptureMs).toBe(0);
  });

  it('consomme son delai meme en attrapant un bot deja neutre', () => {
    let depart = avecBot(partie(), 'b1', { x: 510, y: 500 });
    depart = avecBotNoir(
      depart,
      'bn',
      { x: 500, y: 500 },
      {
        cible: 'b1',
        avantRechercheDeCibleMs: 500,
      },
    );

    const apres = avancerLesBots(depart, 1);

    // Rien ne change pour le bot, mais le legacy rearmait le delai dans les deux
    // branches de sa prise: un bot noir qui attrape du vide reste inoffensif deux
    // secondes.
    expect(botDe(apres, 'b1').couleur).toBe(COULEUR_BOT_NEUTRE);
    expect(botNoirDe(apres, 'bn').avantProchaineCaptureMs).toBe(BOTS_NOIRS.DELAI_ENTRE_CAPTURES_MS);
  });

  it('erre quand il n a personne a poursuivre', () => {
    const depart = avecBotNoir(partie(), 'bn', { x: 500, y: 500 });

    const apres = botDe(avancerLesBots(depart, 1000), 'bn');

    expect(apres.position.x).toBeCloseTo(500 + VITESSES.BOT_NOIR_PX_PAR_SECONDE, 6);
  });
});

describe('apparition des bots noirs', () => {
  /** Une partie dont l'horloge est placee a la fraction demandee de sa duree. */
  function partieAvancee(part: number, reglages?: ReglagesPartiels): EtatPartie {
    const depart = partie(reglages);

    return { ...depart, tempsEcouleMs: depart.dureeMs * part };
  }

  /** Combien de bots noirs sont en jeu. */
  function nombreDeBotsNoirs(etat: EtatPartie): number {
    return Object.values(etat.bots).filter((bot) => bot.type === 'botNoir').length;
  }

  it('n en fait apparaitre aucun avant le moment regle', () => {
    expect(nombreDeBotsNoirs(faireApparaitreLesBotsNoirs(partieAvancee(0.49)))).toBe(0);
  });

  it('en fait apparaitre le nombre regle au moment regle', () => {
    const apres = faireApparaitreLesBotsNoirs(partieAvancee(0.5));

    expect(nombreDeBotsNoirs(apres)).toBe(2);
    expect(Object.keys(apres.bots)).toEqual(['botNoir-0', 'botNoir-1']);
  });

  it('respecte le moment d apparition des reglages, defaut X26', () => {
    const reglages: ReglagesPartiels = { botsNoirs: { momentApparitionPourCent: 25 } };

    expect(nombreDeBotsNoirs(faireApparaitreLesBotsNoirs(partieAvancee(0.24, reglages)))).toBe(0);
    expect(nombreDeBotsNoirs(faireApparaitreLesBotsNoirs(partieAvancee(0.25, reglages)))).toBe(2);
  });

  it('n en fait apparaitre aucun quand ils sont desactives', () => {
    const reglages: ReglagesPartiels = { botsNoirs: { actifs: false } };

    expect(nombreDeBotsNoirs(faireApparaitreLesBotsNoirs(partieAvancee(1, reglages)))).toBe(0);
  });

  it('ne double pas la fournee tant qu il en reste un', () => {
    const premiere = faireApparaitreLesBotsNoirs(partieAvancee(0.5));

    expect(nombreDeBotsNoirs(faireApparaitreLesBotsNoirs(premiere))).toBe(2);
  });

  it('en refait apparaitre une fournee quand tous ont ete detruits', () => {
    const premiere = faireApparaitreLesBotsNoirs(partieAvancee(0.5));

    expect(nombreDeBotsNoirs(faireApparaitreLesBotsNoirs({ ...premiere, bots: {} }))).toBe(2);
  });

  it('les fait entrer par le battement du moteur, mais ils ne jouent qu ensuite', () => {
    const apres = avancerLesBots(partieAvancee(0.5), 50);
    const premier = botDe(apres, 'botNoir-0');

    expect(nombreDeBotsNoirs(apres)).toBe(2);
    expect(premier.positionAuDernierControle).toEqual(premier.position);
  });
});

describe('peuplement de la carte', () => {
  it('pose le nombre de bots des reglages', () => {
    const apres = peuplerDeBots(partie());

    expect(Object.keys(apres.bots)).toHaveLength(partie().reglages.nombreBotsInitial);
    expect(Object.values(apres.bots).every((bot) => bot.type === 'bot')).toBe(true);
  });

  it('accepte un nombre impose', () => {
    expect(Object.keys(peuplerDeBots(partie(), 3).bots)).toEqual(['bot-0', 'bot-1', 'bot-2']);
  });

  it('peuple la carte de la meme facon a graine egale', () => {
    expect(peuplerDeBots(partie(), 10).bots).toEqual(peuplerDeBots(partie(), 10).bots);
  });

  it('pose des bots neutres, a l ecart les uns des autres', () => {
    const bots = Object.values(peuplerDeBots(partie(), 8).bots);

    expect(bots.every((bot) => bot.couleur === COULEUR_BOT_NEUTRE)).toBe(true);
    expect(new Set(bots.map((bot) => `${bot.position.x},${bot.position.y}`)).size).toBe(8);
  });
});

describe('determinisme', () => {
  it('produit exactement la meme errance a graine egale', () => {
    const depart = peuplerDeBots(partie(), 12);

    let une = depart;
    let autre = depart;
    for (let battement = 0; battement < 100; battement += 1) {
      une = avancerLesBots(une, 50);
      autre = avancerLesBots(autre, 50);
    }

    expect(une).toEqual(autre);
  });

  it('ne modifie pas l etat recu', () => {
    const depart = avecBot(partie(), 'b1', { x: 500, y: 500 });

    avancerLesBots(depart, 1000);

    expect(botDe(depart, 'b1').position).toEqual({ x: 500, y: 500 });
  });
});
