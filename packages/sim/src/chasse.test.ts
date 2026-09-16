/**
 * Tests du mode Chasse (etape 7.3): les roles, le tirage des premiers traqueurs,
 * l'infection, le remplacement d'un traqueur parti, le malus, le monde sans bots noirs,
 * le score de survie, la fin anticipee, et le jeu de regles du mode dans le moteur.
 *
 * Aucune version du jeu d'origine n'a ce mode, donc aucune caracterisation: les attentes
 * sont les decisions du porteur du projet du 16 septembre 2026 (docs/plan/etape-7-3.md).
 */

import type { Position, ReglagesPartiels } from '@neon-ninja/shared';
import { CHASSE, COULEUR_DES_TRAQUEURS, DUREES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { faireApparaitreLesBotsNoirs, peuplerDeBots } from './bots.js';
import {
  agirEnChasse,
  chasseDecidee,
  devenirTraqueur,
  estTraqueur,
  infecter,
  lancerLaChasse,
  malusEnChasse,
  tempsDeSurvieMs,
  traqueurPret,
} from './chasse.js';
import { detecterContacts, regleChasse, resoudreContacts } from './contacts.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import type { Entrees } from './moteur.js';
import { REGLES_DES_MODES, evaluerFinDePartie, lancerLaPartie, tick } from './moteur.js';
import { poserObjet, ramasserLesObjets } from './objets.js';
import { calculerScores, scoreDe } from './score.js';

/** Reglages ou rien n'apparait tout seul: les tests posent ce dont ils ont besoin. */
const AUCUNE_APPARITION: ReglagesPartiels = {
  bonus: {
    types: {
      vitesse: { tauxApparitionPourCent: 0 },
      invincibilite: { tauxApparitionPourCent: 0 },
      revelation: { tauxApparitionPourCent: 0 },
    },
  },
  malus: { tauxApparitionPourCent: 0 },
  zones: { actives: false },
};

/** Juste assez de temps pour qu'un nouveau traqueur puisse capturer. */
const APRES_LE_DELAI_MS = CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS + 1;

/** Une partie Chasse vide, pas encore lancee. */
function partie(reglages: ReglagesPartiels = AUCUNE_APPARITION): EtatPartie {
  return creerEtatInitial({ graine: 17, mode: 'chasse', reglages });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Change quelques champs d'un joueur, pour poser une situation de depart. */
function regler(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<Joueur>): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/** Fait entrer un joueur a une place donnee, sorti de sa protection d'apparition. */
function avecJoueur(etat: EtatPartie, id: IdentifiantEntite, position: Position): EtatPartie {
  return regler(ajouterJoueur(etat, { id, pseudo: id, position }), id, {
    protectionSpawnRestanteMs: 0,
  });
}

/** Fait avancer le temps de jeu, sans rien d'autre. */
function apres(etat: EtatPartie, dtMs: number): EtatPartie {
  return { ...etat, tempsEcouleMs: etat.tempsEcouleMs + dtMs };
}

/**
 * Une Chasse lancee a la main: un traqueur pret et une proie qui se touchent, et une
 * seconde proie au loin.
 */
function traqueurContreProie(): EtatPartie {
  let etat = avecJoueur(partie(), 'traqueur', { x: 500, y: 500 });
  etat = avecJoueur(etat, 'proie', { x: 510, y: 500 });
  etat = avecJoueur(etat, 'loin', { x: 1500, y: 1000 });
  etat = devenirTraqueur({ ...etat, chasse: {} }, 'traqueur');

  return apres(etat, APRES_LE_DELAI_MS);
}

describe('devenirTraqueur', () => {
  it('pose ensemble la couleur des traqueurs et le moment', () => {
    const etat = devenirTraqueur(
      apres(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 1234),
      'alice',
    );

    expect(joueurDe(etat, 'alice').couleur).toBe(COULEUR_DES_TRAQUEURS);
    expect(etat.chasse).toEqual({ alice: 1234 });
    expect(estTraqueur(etat, 'alice')).toBe(true);
  });

  it('laisse un traqueur a son moment d origine', () => {
    const une = devenirTraqueur(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 'alice');

    expect(devenirTraqueur(apres(une, 5000), 'alice').chasse).toEqual({ alice: 0 });
  });

  it('ne fait rien pour un joueur absent de la partie', () => {
    const etat = partie();

    expect(devenirTraqueur(etat, 'personne')).toBe(etat);
  });

  it('ne fait pas d une proie un traqueur', () => {
    const etat = avecJoueur(partie(), 'alice', { x: 500, y: 500 });

    expect(estTraqueur(etat, 'alice')).toBe(false);
    expect(estTraqueur({ ...etat, chasse: {} }, 'alice')).toBe(false);
  });
});

describe('traqueurPret', () => {
  const nouveau = devenirTraqueur(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 'alice');

  it('refuse a trois secondes pile, et accorde juste apres', () => {
    expect(traqueurPret(apres(nouveau, CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS), 'alice')).toBe(false);
    expect(traqueurPret(apres(nouveau, APRES_LE_DELAI_MS), 'alice')).toBe(true);
  });

  it('refuse une proie', () => {
    expect(traqueurPret(apres(partie(), 60_000), 'alice')).toBe(false);
  });
});

describe('lancerLaChasse', () => {
  /** Une Chasse de n joueurs au salon. */
  function salonDe(nombre: number): EtatPartie {
    let etat = partie();
    for (let rang = 0; rang < nombre; rang += 1) {
      etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
    }
    return etat;
  }

  /** Les traqueurs d'un etat. */
  function traqueurs(etat: EtatPartie): readonly IdentifiantEntite[] {
    return Object.keys(etat.joueurs).filter((id) => estTraqueur(etat, id));
  }

  it.each([
    [2, 1],
    [5, 1],
    [6, 2],
    [10, 2],
  ])('tire %i joueurs: %i traqueurs', (nombre, attendus) => {
    const lancee = lancerLaChasse(salonDe(nombre));

    expect(traqueurs(lancee)).toHaveLength(attendus);
    for (const id of traqueurs(lancee)) {
      expect(joueurDe(lancee, id).couleur).toBe(COULEUR_DES_TRAQUEURS);
    }
  });

  it('les fait traqueurs au temps zero, et les proies gardent leur couleur et leur protection', () => {
    const salon = salonDe(4);
    const lancee = lancerLaChasse(salon);
    const [traqueur] = traqueurs(lancee);

    expect(lancee.chasse).toEqual({ [traqueur as string]: 0 });
    for (const id of Object.keys(salon.joueurs).filter((autre) => autre !== traqueur)) {
      expect(joueurDe(lancee, id).couleur).toBe(joueurDe(salon, id).couleur);
      expect(joueurDe(lancee, id).protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
    }
  });

  it('tire les memes traqueurs a graine egale', () => {
    expect(lancerLaChasse(salonDe(8))).toEqual(lancerLaChasse(salonDe(8)));
  });

  it('ne tire pas toujours le meme joueur selon la graine', () => {
    const elus = new Set<IdentifiantEntite>();

    for (let graine = 0; graine < 20; graine += 1) {
      let etat = creerEtatInitial({ graine, mode: 'chasse' });
      for (let rang = 0; rang < 4; rang += 1) {
        etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
      }
      elus.add(traqueurs(lancerLaChasse(etat))[0] as string);
    }

    expect(elus.size).toBeGreaterThan(1);
  });

  it('pose la table des traqueurs meme sans joueur', () => {
    expect(lancerLaChasse(partie()).chasse).toEqual({});
  });
});

describe('infecter', () => {
  it('fait de la proie touchee un traqueur, sur place', () => {
    const depart = traqueurContreProie();
    const etat = infecter(depart, 'traqueur', 'proie');
    const proie = joueurDe(etat, 'proie');

    expect(estTraqueur(etat, 'proie')).toBe(true);
    expect(proie.couleur).toBe(COULEUR_DES_TRAQUEURS);
    expect(proie.position).toEqual(joueurDe(depart, 'proie').position);
    expect(etat.chasse?.['proie']).toBe(depart.tempsEcouleMs);
  });

  it('compte la capture et l annonce, sans ninja transfere', () => {
    const etat = infecter(traqueurContreProie(), 'traqueur', 'proie');

    expect(joueurDe(etat, 'traqueur').captures).toBe(1);
    expect(joueurDe(etat, 'traqueur').tempsDepuisDerniereCaptureMs).toBe(0);
    expect(joueurDe(etat, 'traqueur').joueursCaptures).toEqual({
      proie: { pseudo: 'proie', nombre: 1 },
    });
    expect(joueurDe(etat, 'proie').capturesSubies).toEqual({
      traqueur: { pseudo: 'traqueur', nombre: 1 },
    });
    expect(etat.evenements).toEqual([
      {
        type: 'captureJoueur',
        attaquant: 'traqueur',
        victime: 'proie',
        botsTransferes: 0,
        nouvelleCouleurVictime: COULEUR_DES_TRAQUEURS,
        position: { x: 510, y: 500 },
      },
    ]);
  });

  it('refuse un traqueur dans son delai de nouveau traqueur', () => {
    const dansLeDelai = {
      ...traqueurContreProie(),
      chasse: { traqueur: 1000 },
      tempsEcouleMs: 1000 + CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS,
    };

    expect(infecter(dansLeDelai, 'traqueur', 'proie')).toBe(dansLeDelai);
  });

  it('refuse une proie protegee par son apparition ou invincible', () => {
    const depart = traqueurContreProie();
    const protegee = regler(depart, 'proie', { protectionSpawnRestanteMs: 500 });
    const invincible = regler(depart, 'proie', {
      bonusRestantsMs: { ...joueurDe(depart, 'proie').bonusRestantsMs, invincibilite: 500 },
    });

    expect(infecter(protegee, 'traqueur', 'proie')).toBe(protegee);
    expect(infecter(invincible, 'traqueur', 'proie')).toBe(invincible);
  });

  it('refuse un traqueur qui vient de capturer, pendant une seconde', () => {
    const recent = regler(traqueurContreProie(), 'traqueur', {
      tempsDepuisDerniereCaptureMs: DUREES.DELAI_ENTRE_CAPTURES_MS,
    });

    expect(infecter(recent, 'traqueur', 'proie')).toBe(recent);
  });

  it('refuse une proie qui attaque, et un traqueur qui en attaque un autre', () => {
    const depart = traqueurContreProie();
    const deuxTraqueurs = apres(devenirTraqueur(depart, 'proie'), APRES_LE_DELAI_MS);

    expect(infecter(depart, 'proie', 'traqueur')).toBe(depart);
    expect(infecter(depart, 'proie', 'loin')).toBe(depart);
    expect(infecter(deuxTraqueurs, 'traqueur', 'proie')).toBe(deuxTraqueurs);
  });

  it('refuse un joueur absent', () => {
    const depart = traqueurContreProie();

    expect(infecter(depart, 'traqueur', 'personne')).toBe(depart);
    expect(infecter(depart, 'personne', 'proie')).toBe(depart);
  });
});

describe('les contacts de la Chasse', () => {
  /** Resout les contacts d'un etat avec la regle de la Chasse. */
  function resoudre(etat: EtatPartie): EtatPartie {
    return resoudreContacts(etat, detecterContacts(etat), regleChasse);
  }

  it('infectent la proie qu un traqueur pret touche, dans un sens comme dans l autre', () => {
    const traqueurDabord = resoudre(traqueurContreProie());
    // La proie arrive la premiere dans l'etat: le contact est releve dans l'autre sens.
    let inverse = avecJoueur(partie(), 'proie', { x: 510, y: 500 });
    inverse = avecJoueur(inverse, 'traqueur', { x: 500, y: 500 });
    inverse = apres(devenirTraqueur({ ...inverse, chasse: {} }, 'traqueur'), APRES_LE_DELAI_MS);

    expect(estTraqueur(traqueurDabord, 'proie')).toBe(true);
    expect(estTraqueur(resoudre(inverse), 'proie')).toBe(true);
  });

  it('ne produisent rien entre deux proies, ni sans traqueur pret', () => {
    let deuxProies = avecJoueur(partie(), 'a', { x: 500, y: 500 });
    deuxProies = { ...avecJoueur(deuxProies, 'b', { x: 510, y: 500 }), chasse: {} };
    const tropTot = { ...traqueurContreProie(), tempsEcouleMs: 0 };

    expect(resoudre(deuxProies)).toBe(deuxProies);
    expect(resoudre(tropTot)).toBe(tropTot);
  });

  it('ne repeignent aucun ninja', () => {
    let etat = traqueurContreProie();
    etat = ajouterBot(etat, { id: 'ninja', couleur: '#123456', position: { x: 1500, y: 1010 } });
    etat = ajouterBot(etat, { id: 'autre', couleur: '#654321', position: { x: 505, y: 510 } });

    const apresContacts = resoudre(etat);

    expect(apresContacts.bots['ninja']?.couleur).toBe('#123456');
    expect(apresContacts.bots['autre']?.couleur).toBe('#654321');
  });
});

describe('agirEnChasse', () => {
  it('fait d une proie tiree au sort un traqueur quand tous les traqueurs sont partis', () => {
    const sansTraqueur = retirerJoueur(apres(traqueurContreProie(), 20_000), 'traqueur');
    const etat = agirEnChasse(sansTraqueur, {}, 50);
    const nouveaux = Object.keys(etat.joueurs).filter((id) => estTraqueur(etat, id));

    expect(nouveaux).toHaveLength(1);
    expect(etat.chasse?.[nouveaux[0] as string]).toBe(sansTraqueur.tempsEcouleMs);
    expect(traqueurPret(etat, nouveaux[0] as string)).toBe(false);
  });

  it('retire le traqueur parti de la table des traqueurs', () => {
    expect(retirerJoueur(traqueurContreProie(), 'traqueur').chasse).toEqual({});
  });

  it('ne fait rien tant qu un traqueur est la, meme sans bouger', () => {
    const etat = traqueurContreProie();

    expect(agirEnChasse(etat, {}, 50)).toBe(etat);
  });

  it('laisse un joueur seul proie jusqu au terme', () => {
    const seul = retirerJoueur(retirerJoueur(traqueurContreProie(), 'traqueur'), 'loin');

    expect(agirEnChasse(seul, {}, 50)).toBe(seul);
  });

  it('ne fait rien dans une Chasse pas encore lancee', () => {
    let etat = avecJoueur(partie(), 'a', { x: 500, y: 500 });
    etat = avecJoueur(etat, 'b', { x: 900, y: 500 });

    expect(agirEnChasse(etat, {}, 50)).toBe(etat);
  });
});

describe('le malus en Chasse', () => {
  it('frappe l autre camp, et epargne le sien', () => {
    // Seule proie2 est sur le malus: c'est une proie qui le ramasse.
    let etat = devenirTraqueur(traqueurContreProie(), 'loin');
    etat = avecJoueur(etat, 'proie2', { x: 1000, y: 200 });
    etat = poserObjet(etat, {
      categorie: 'malus',
      nature: 'flou',
      position: { x: 1000, y: 200 },
    });

    const apresRamassage = ramasserLesObjets(etat, malusEnChasse);

    expect(joueurDe(apresRamassage, 'traqueur').malusRestantsMs.flou).toBeGreaterThan(0);
    expect(joueurDe(apresRamassage, 'loin').malusRestantsMs.flou).toBeGreaterThan(0);
    expect(joueurDe(apresRamassage, 'proie2').malusRestantsMs.flou).toBe(0);
    expect(joueurDe(apresRamassage, 'proie').malusRestantsMs.flou).toBe(0);
  });

  it('frappe les proies quand un traqueur le ramasse', () => {
    const etat = traqueurContreProie();

    expect(malusEnChasse(joueurDe(etat, 'traqueur'), joueurDe(etat, 'proie'))).toBe(true);
    expect(malusEnChasse(joueurDe(etat, 'proie'), joueurDe(etat, 'loin'))).toBe(false);
  });
});

describe('le monde de la Chasse', () => {
  it('n a pas de bots noirs, quels que soient les reglages recus', () => {
    const etat = creerEtatInitial({
      graine: 3,
      mode: 'chasse',
      reglages: { botsNoirs: { actifs: true, momentApparitionPourCent: 0 } },
    });

    expect(etat.reglages.botsNoirs.actifs).toBe(false);
    expect(faireApparaitreLesBotsNoirs(etat)).toBe(etat);
  });

  it('pose ses ninjas d une couleur quelconque, jamais celle des traqueurs', () => {
    // Le tirage qui l'exclut est prouve dans couleurs.test.ts, sur une graine qui tombe
    // exactement dessus; ici, les ninjas d'une vraie Chasse lancee.
    const salon = ajouterJoueur(ajouterJoueur(partie(), { id: 'a', pseudo: 'A' }), {
      id: 'b',
      pseudo: 'B',
    });
    const etat = peuplerDeBots(lancerLaChasse(salon), 200);

    for (const bot of Object.values(etat.bots)) {
      expect(bot.couleur).not.toBe(COULEUR_DES_TRAQUEURS);
    }
  });
});

describe('le score en Chasse', () => {
  it('est le temps de survie en secondes entieres: tout le temps pour une proie', () => {
    const etat = { ...traqueurContreProie(), tempsEcouleMs: 42_999 };

    expect(tempsDeSurvieMs(etat, 'proie')).toBe(42_999);
    expect(scoreDe(etat, joueurDe(etat, 'proie')).points).toBe(42);
  });

  it('s arrete pour un traqueur au moment ou il l est devenu', () => {
    const infecte = infecter(
      { ...traqueurContreProie(), tempsEcouleMs: 12_500 },
      'traqueur',
      'proie',
    );
    const plusTard = apres(infecte, 30_000);

    expect(scoreDe(plusTard, joueurDe(plusTard, 'proie')).points).toBe(12);
    expect(scoreDe(plusTard, joueurDe(plusTard, 'traqueur')).points).toBe(0);
  });

  it('classe les proies avant les traqueurs, puis par survie, puis par captures', () => {
    // Infectee a 12,5 secondes, la proie a 12 secondes de survie. A 12,9 secondes,
    // « loin », encore proie, en a 12 aussi: sans la regle du camp, l'ordre de l'etat
    // mettrait la proie infectee devant. Le premier traqueur, a zero, ferme la marche
    // malgre sa capture.
    const infecte = infecter(
      { ...traqueurContreProie(), tempsEcouleMs: 12_500 },
      'traqueur',
      'proie',
    );
    const memeSeconde = { ...infecte, tempsEcouleMs: 12_900 };

    expect(calculerScores(memeSeconde).map((ligne) => ligne.id)).toEqual([
      'loin',
      'proie',
      'traqueur',
    ]);
  });
});

describe('la fin de la Chasse', () => {
  it('est decidee des que la derniere proie tombe', () => {
    let etat = traqueurContreProie();
    etat = infecter(etat, 'traqueur', 'proie');

    expect(chasseDecidee(etat)).toBe(false);
    expect(chasseDecidee(devenirTraqueur(etat, 'loin'))).toBe(true);
    expect(evaluerFinDePartie(devenirTraqueur(etat, 'loin')).terminee).toBe(true);
  });

  it('est decidee quand la derniere proie s en va', () => {
    const etat = retirerJoueur(retirerJoueur(traqueurContreProie(), 'proie'), 'loin');

    expect(evaluerFinDePartie(etat).terminee).toBe(true);
  });

  it('ne l est jamais pour une Chasse au salon', () => {
    const salon = avecJoueur(partie(), 'a', { x: 500, y: 500 });

    expect(chasseDecidee(salon)).toBe(false);
    expect(evaluerFinDePartie(salon).terminee).toBe(false);
  });

  it('garde le temps restant du reglage, et le temps decide toujours', () => {
    const etat = traqueurContreProie();

    expect(evaluerFinDePartie(etat)).toEqual({
      terminee: false,
      tempsRestantMs: etat.dureeMs - etat.tempsEcouleMs,
    });
    expect(evaluerFinDePartie({ ...etat, tempsEcouleMs: etat.dureeMs }).terminee).toBe(true);
  });
});

describe('le jeu de regles Chasse dans le moteur', () => {
  it('branche les regles du mode', () => {
    expect(REGLES_DES_MODES.chasse.agir).toBe(agirEnChasse);
    expect(REGLES_DES_MODES.chasse.resoudreContacts).toBe(regleChasse);
    expect(REGLES_DES_MODES.chasse.victimeDuMalus).toBe(malusEnChasse);
    expect(REGLES_DES_MODES.chasse.lancer).toBe(lancerLaChasse);
    expect(REGLES_DES_MODES.chasse.estDecidee).toBe(chasseDecidee);
  });

  it('tire les traqueurs par lancerLaPartie', () => {
    const salon = ajouterJoueur(ajouterJoueur(partie(), { id: 'a', pseudo: 'A' }), {
      id: 'b',
      pseudo: 'B',
    });

    expect(lancerLaPartie(salon)).toEqual(lancerLaChasse(salon));
  });

  it('joue une infection de bout en bout: un traqueur pret rattrape une proie qui ne bouge pas', () => {
    let etat = avecJoueur(partie(), 'traqueur', { x: 500, y: 500 });
    etat = avecJoueur(etat, 'proie', { x: 600, y: 500 });
    etat = avecJoueur(etat, 'loin', { x: 1500, y: 1200 });
    etat = apres(devenirTraqueur({ ...etat, chasse: {} }, 'traqueur'), APRES_LE_DELAI_MS);
    const entrees: Entrees = { traqueur: { deplacement: { x: 1, y: 0 }, enMouvement: true } };

    const infections: EtatPartie['evenements'][number][] = [];
    for (let battement = 0; battement < 120; battement += 1) {
      etat = tick(etat, entrees, 50);
      infections.push(...etat.evenements.filter((evenement) => evenement.type === 'captureJoueur'));
    }

    expect(infections).toHaveLength(1);
    expect(estTraqueur(etat, 'proie')).toBe(true);
    expect(evaluerFinDePartie(etat).terminee).toBe(false);
  });

  it('s arrete au battement ou la derniere proie tombe, et ne bouge plus ensuite', () => {
    let etat = avecJoueur(partie(), 'traqueur', { x: 500, y: 500 });
    etat = avecJoueur(etat, 'proie', { x: 510, y: 500 });
    etat = apres(devenirTraqueur({ ...etat, chasse: {} }, 'traqueur'), APRES_LE_DELAI_MS);

    const fin = tick(etat, {}, 50);

    expect(evaluerFinDePartie(fin).terminee).toBe(true);
    expect(tick(fin, {}, 50)).toBe(fin);
  });

  it('rejoue a l identique deux Chasses de meme graine et memes entrees', () => {
    function jouer(): EtatPartie {
      let etat = partie({ zones: { actives: true } });
      for (let rang = 0; rang < 6; rang += 1) {
        etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
      }
      etat = lancerLaPartie(peuplerDeBots(etat, 60));
      const entrees: Entrees = Object.fromEntries(
        Object.keys(etat.joueurs).map((id, rang) => [
          id,
          { deplacement: { x: rang % 2 === 0 ? 1 : -1, y: 1 }, enMouvement: true },
        ]),
      );
      for (let battement = 0; battement < 400; battement += 1) {
        etat = tick(etat, entrees, 50);
      }
      return etat;
    }

    expect(jouer()).toEqual(jouer());
  });
});
