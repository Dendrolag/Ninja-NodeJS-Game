/**
 * Tests du mode Chasse (etape 7.3): les roles, le tirage des premiers traqueurs, le tir en
 * cone, les vies et l'elimination, le hors-jeu, le parcours des proies et les points, le
 * remplacement d'un traqueur parti, la fin anticipee, et le jeu de regles dans le moteur.
 *
 * Aucune version du jeu d'origine n'a ce mode, donc aucune caracterisation: les attentes
 * sont les decisions du porteur du projet du 16 septembre 2026, revisees le meme jour
 * (docs/plan/etape-7-3.md).
 */

import type { Position, ReglagesPartiels } from '@neon-ninja/shared';
import { CHASSE, COULEUR_DES_TRAQUEURS, DUREES, TACTIQUE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { faireApparaitreLesBotsNoirs, peuplerDeBots } from './bots.js';
import {
  PERSONNE_HORS_JEU,
  agirEnChasse,
  chasseDecidee,
  devenirTraqueur,
  estTraqueur,
  horsJeuEnChasse,
  infecter,
  lancerLaChasse,
  malusEnChasse,
  peutTirer,
  pointsEnChasse,
  tirerEnChasse,
  traqueurEnJeu,
} from './chasse.js';
import { detecterContacts, regleChasse, resoudreContacts } from './contacts.js';
import type {
  EtatDeChasse,
  EtatPartie,
  IdentifiantEntite,
  Joueur,
  TraqueurEnChasse,
} from './etat.js';
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

/** Juste assez de temps pour qu'un nouveau traqueur puisse tirer. */
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

/** La Chasse d'un etat, dont on sait qu'elle est lancee. */
function chasseDe(etat: EtatPartie): EtatDeChasse {
  if (etat.chasse === undefined) {
    throw new Error('La chasse devrait etre lancee.');
  }
  return etat.chasse;
}

/** L'arme d'un traqueur dont on sait qu'il l'est. */
function armeDe(etat: EtatPartie, id: IdentifiantEntite): TraqueurEnChasse {
  const arme = chasseDe(etat).traqueurs[id];
  if (arme === undefined) {
    throw new Error(`Le joueur ${id} devrait etre traqueur.`);
  }
  return arme;
}

/** Change quelques champs d'un joueur, pour poser une situation de depart. */
function regler(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<Joueur>): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/** Change l'arme d'un traqueur. */
function armer(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<TraqueurEnChasse>,
): EtatPartie {
  const chasse = chasseDe(etat);
  const arme = { ...armeDe(etat, id), ...champs };

  return { ...etat, chasse: { ...chasse, traqueurs: { ...chasse.traqueurs, [id]: arme } } };
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

/** Pose un faux ninja a cette place. */
function avecNinja(etat: EtatPartie, id: IdentifiantEntite, position: Position): EtatPartie {
  return ajouterBot(etat, { id, couleur: '#123456', position });
}

/**
 * Une Chasse lancee a la main: un traqueur pret en (500, 500), qui vise a l'est, une proie
 * a la place donnee, et une seconde proie au loin.
 */
function chasseAvec(proie: Position = { x: 1500, y: 1000 }): EtatPartie {
  let etat = avecJoueur(partie(), 'traqueur', { x: 500, y: 500 });
  etat = avecJoueur(etat, 'proie', proie);
  etat = avecJoueur(etat, 'loin', { x: 1500, y: 1200 });
  const parcours = Object.fromEntries(
    Object.values(etat.joueurs).map((joueur) => [
      joueur.id,
      { distancePx: 0, derniere: joueur.position },
    ]),
  );
  etat = { ...etat, chasse: { traqueurs: {}, parcours, traqueursEpuises: false } };

  return apres(devenirTraqueur(etat, 'traqueur'), APRES_LE_DELAI_MS);
}

/** Les traqueurs en jeu d'un etat. */
function enJeu(etat: EtatPartie): readonly IdentifiantEntite[] {
  return Object.keys(etat.joueurs).filter((id) => traqueurEnJeu(etat, id));
}

describe('devenirTraqueur', () => {
  it('pose la couleur des traqueurs, trois vies et le moment', () => {
    const etat = devenirTraqueur(
      apres(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 1234),
      'alice',
    );

    expect(joueurDe(etat, 'alice').couleur).toBe(COULEUR_DES_TRAQUEURS);
    expect(armeDe(etat, 'alice')).toEqual({
      devenuAMs: 1234,
      vies: CHASSE.VIES_DES_TRAQUEURS,
      orientation: TACTIQUE.ORIENTATION_DE_DEPART,
      avantProchainTirMs: 0,
    });
    expect(estTraqueur(etat, 'alice')).toBe(true);
    expect(traqueurEnJeu(etat, 'alice')).toBe(true);
  });

  it('vise dans la direction ou il marchait', () => {
    const etat = regler(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 'alice', {
      direction: 'sud_ouest',
    });

    expect(armeDe(devenirTraqueur(etat, 'alice'), 'alice').orientation).toBe('sud_ouest');
  });

  it('laisse un traqueur tel qu il est, et ne fait rien pour un absent', () => {
    const une = devenirTraqueur(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 'alice');
    const plusTard = apres(une, 5000);

    expect(devenirTraqueur(plusTard, 'alice')).toBe(plusTard);
    expect(devenirTraqueur(une, 'personne')).toBe(une);
  });

  it('ne fait pas d une proie un traqueur', () => {
    const etat = chasseAvec();

    expect(estTraqueur(etat, 'proie')).toBe(false);
    expect(traqueurEnJeu(etat, 'proie')).toBe(false);
  });
});

describe('peutTirer', () => {
  it('attend strictement trois secondes apres qu on est devenu traqueur', () => {
    const nouveau = devenirTraqueur(avecJoueur(partie(), 'alice', { x: 500, y: 500 }), 'alice');

    expect(peutTirer(apres(nouveau, CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS), 'alice')).toBe(false);
    expect(peutTirer(apres(nouveau, APRES_LE_DELAI_MS), 'alice')).toBe(true);
  });

  it('attend le prochain tir, et refuse un traqueur elimine ou une proie', () => {
    const pret = chasseAvec();

    expect(peutTirer(pret, 'traqueur')).toBe(true);
    expect(peutTirer(armer(pret, 'traqueur', { avantProchainTirMs: 1 }), 'traqueur')).toBe(false);
    expect(peutTirer(armer(pret, 'traqueur', { vies: 0 }), 'traqueur')).toBe(false);
    expect(peutTirer(pret, 'proie')).toBe(false);
  });
});

describe('lancerLaChasse', () => {
  /** Une Chasse de n joueurs au salon. */
  function salonDe(nombre: number, graine = 17): EtatPartie {
    let etat = creerEtatInitial({ graine, mode: 'chasse', reglages: AUCUNE_APPARITION });
    for (let rang = 0; rang < nombre; rang += 1) {
      etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
    }
    return etat;
  }

  it.each([
    [2, 1],
    [5, 1],
    [6, 2],
    [10, 2],
  ])('tire %i joueurs: %i traqueurs', (nombre, attendus) => {
    expect(enJeu(lancerLaChasse(salonDe(nombre)))).toHaveLength(attendus);
  });

  it('commence le parcours de chacun a sa place, et laisse aux proies couleur et protection', () => {
    const salon = salonDe(4);
    const lancee = lancerLaChasse(salon);

    for (const joueur of Object.values(salon.joueurs)) {
      expect(chasseDe(lancee).parcours[joueur.id]).toEqual({
        distancePx: 0,
        derniere: joueur.position,
      });

      if (!estTraqueur(lancee, joueur.id)) {
        expect(joueurDe(lancee, joueur.id).couleur).toBe(joueur.couleur);
        expect(joueurDe(lancee, joueur.id).protectionSpawnRestanteMs).toBe(
          DUREES.PROTECTION_SPAWN_MS,
        );
      }
    }
    expect(chasseDe(lancee).traqueursEpuises).toBe(false);
  });

  it('tire les memes traqueurs a graine egale, et pas toujours le meme selon la graine', () => {
    const elus = new Set<IdentifiantEntite>();

    for (let graine = 0; graine < 20; graine += 1) {
      elus.add(enJeu(lancerLaChasse(salonDe(4, graine)))[0] as string);
    }

    expect(enJeu(lancerLaChasse(salonDe(8)))).toEqual(enJeu(lancerLaChasse(salonDe(8))));
    expect(elus.size).toBeGreaterThan(1);
  });
});

describe('tirerEnChasse', () => {
  it('infecte la proie la plus proche dans le cone, avant un faux ninja plus loin', () => {
    const depart = avecNinja(chasseAvec({ x: 560, y: 500 }), 'ninja', { x: 580, y: 500 });
    const etat = tirerEnChasse(depart, 'traqueur');

    expect(estTraqueur(etat, 'proie')).toBe(true);
    expect(joueurDe(etat, 'proie').couleur).toBe(COULEUR_DES_TRAQUEURS);
    expect(joueurDe(etat, 'proie').position).toEqual({ x: 560, y: 500 });
    expect(armeDe(etat, 'traqueur')).toMatchObject({
      vies: 3,
      avantProchainTirMs: CHASSE.DELAI_ENTRE_TIRS_MS,
    });
    expect(joueurDe(etat, 'traqueur').captures).toBe(1);
    expect(etat.evenements).toEqual([
      {
        type: 'captureJoueur',
        attaquant: 'traqueur',
        victime: 'proie',
        botsTransferes: 0,
        nouvelleCouleurVictime: COULEUR_DES_TRAQUEURS,
        position: { x: 560, y: 500 },
      },
      {
        type: 'tirDeCapture',
        joueur: 'traqueur',
        position: { x: 500, y: 500 },
        orientation: 'est',
        captures: 1,
      },
    ]);
  });

  it('coute une vie quand le plus proche est un faux ninja, meme avec une proie derriere', () => {
    const depart = avecNinja(chasseAvec({ x: 580, y: 500 }), 'ninja', { x: 540, y: 500 });
    const etat = tirerEnChasse(depart, 'traqueur');

    expect(estTraqueur(etat, 'proie')).toBe(false);
    expect(armeDe(etat, 'traqueur').vies).toBe(2);
    expect(etat.bots['ninja']).toEqual(depart.bots['ninja']);
    expect(etat.evenements).toEqual([
      {
        type: 'vieDeTraqueurPerdue',
        joueur: 'traqueur',
        viesRestantes: 2,
        position: { x: 540, y: 500 },
      },
      {
        type: 'tirDeCapture',
        joueur: 'traqueur',
        position: { x: 500, y: 500 },
        orientation: 'est',
        captures: 0,
      },
    ]);
  });

  it('prend le joueur avant le faux ninja a distance egale', () => {
    // Soixante pixels tous les deux: droit devant pour la proie, en biais pour le ninja.
    const depart = avecNinja(chasseAvec({ x: 560, y: 500 }), 'ninja', { x: 548, y: 536 });

    expect(estTraqueur(tirerEnChasse(depart, 'traqueur'), 'proie')).toBe(true);
  });

  it('ne coute rien dans le vide, ni hors du cone, mais fait attendre le tir suivant', () => {
    const derriere = avecNinja(chasseAvec({ x: 440, y: 500 }), 'ninja', { x: 500, y: 620 });
    const etat = tirerEnChasse(derriere, 'traqueur');

    expect(armeDe(etat, 'traqueur')).toMatchObject({
      vies: 3,
      avantProchainTirMs: CHASSE.DELAI_ENTRE_TIRS_MS,
    });
    expect(estTraqueur(etat, 'proie')).toBe(false);
    expect(etat.evenements.map((evenement) => evenement.type)).toEqual(['tirDeCapture']);
    expect(tirerEnChasse(etat, 'traqueur')).toBe(etat);
  });

  it('ne fait rien a une proie protegee ou invincible, et ne coute aucune vie', () => {
    const depart = chasseAvec({ x: 560, y: 500 });
    const protegee = regler(depart, 'proie', { protectionSpawnRestanteMs: 500 });
    const invincible = regler(depart, 'proie', {
      bonusRestantsMs: { ...joueurDe(depart, 'proie').bonusRestantsMs, invincibilite: 500 },
    });

    for (const situation of [protegee, invincible]) {
      const etat = tirerEnChasse(situation, 'traqueur');

      expect(estTraqueur(etat, 'proie')).toBe(false);
      expect(armeDe(etat, 'traqueur')).toMatchObject({
        vies: 3,
        avantProchainTirMs: CHASSE.DELAI_ENTRE_TIRS_MS,
      });
    }
  });

  it('ne vise jamais un traqueur: la proie derriere lui est prise', () => {
    let etat = avecJoueur(chasseAvec({ x: 580, y: 500 }), 'second', { x: 530, y: 500 });
    etat = devenirTraqueur(etat, 'second');

    expect(estTraqueur(tirerEnChasse(etat, 'traqueur'), 'proie')).toBe(true);
  });

  it('ne tire pas pour un traqueur pas pret, ni pour une proie', () => {
    const tropTot = { ...chasseAvec({ x: 560, y: 500 }), tempsEcouleMs: 0 };
    const pret = chasseAvec({ x: 560, y: 500 });

    expect(tirerEnChasse(tropTot, 'traqueur')).toBe(tropTot);
    expect(tirerEnChasse(pret, 'proie')).toBe(pret);
  });

  it('elimine le traqueur a sa derniere vie, et epuise les traqueurs s il etait le dernier', () => {
    const derniere = armer(avecNinja(chasseAvec(), 'ninja', { x: 540, y: 500 }), 'traqueur', {
      vies: 1,
    });
    const etat = tirerEnChasse(derniere, 'traqueur');

    expect(armeDe(etat, 'traqueur').vies).toBe(0);
    expect(traqueurEnJeu(etat, 'traqueur')).toBe(false);
    expect(horsJeuEnChasse(etat)).toEqual(new Set(['traqueur']));
    expect(chasseDe(etat).traqueursEpuises).toBe(true);
    expect(chasseDecidee(etat)).toBe(true);
  });

  it('n epuise pas les traqueurs tant qu un autre est en jeu', () => {
    let etat = avecJoueur(chasseAvec(), 'second', { x: 1000, y: 200 });
    etat = avecNinja(devenirTraqueur(etat, 'second'), 'ninja', { x: 540, y: 500 });
    etat = armer(etat, 'traqueur', { vies: 1 });

    const apresTir = tirerEnChasse(etat, 'traqueur');

    expect(chasseDe(apresTir).traqueursEpuises).toBe(false);
    expect(chasseDecidee(apresTir)).toBe(false);
  });
});

describe('infecter', () => {
  it('refuse un traqueur elimine, une victime deja traqueur, et un absent', () => {
    const pret = chasseAvec({ x: 560, y: 500 });
    const elimine = armer(pret, 'traqueur', { vies: 0 });

    expect(infecter(elimine, 'traqueur', 'proie')).toBe(elimine);
    expect(infecter(pret, 'proie', 'traqueur')).toBe(pret);
    expect(infecter(pret, 'traqueur', 'personne')).toBe(pret);
  });
});

describe('agirEnChasse', () => {
  it('ajoute au parcours d une proie le chemin de ce battement, et fige celui d un traqueur', () => {
    let etat = chasseAvec();
    etat = regler(etat, 'proie', { position: { x: 1530, y: 1040 } });
    etat = regler(etat, 'traqueur', { position: { x: 600, y: 500 }, direction: 'nord' });

    const agi = agirEnChasse(etat, {}, 50);

    expect(chasseDe(agi).parcours['proie']).toEqual({
      distancePx: 50,
      derniere: { x: 1530, y: 1040 },
    });
    expect(chasseDe(agi).parcours['traqueur']).toEqual(chasseDe(etat).parcours['traqueur']);
    expect(armeDe(agi, 'traqueur').orientation).toBe('nord');
  });

  it('rapproche le prochain tir, sans descendre sous zero', () => {
    const etat = armer(chasseAvec(), 'traqueur', { avantProchainTirMs: 30 });

    expect(armeDe(agirEnChasse(etat, {}, 50), 'traqueur').avantProchainTirMs).toBe(0);
  });

  it('fait tirer les traqueurs qui le demandent', () => {
    const etat = chasseAvec({ x: 560, y: 500 });
    const entrees: Entrees = {
      traqueur: { deplacement: { x: 0, y: 0 }, enMouvement: false, capturer: true },
    };

    expect(estTraqueur(agirEnChasse(etat, entrees, 50), 'proie')).toBe(true);
  });

  it('remplace le traqueur parti par une proie tiree au sort, avec son delai', () => {
    const sansTraqueur = retirerJoueur(apres(chasseAvec(), 20_000), 'traqueur');
    const etat = agirEnChasse(sansTraqueur, {}, 50);
    const nouveaux = enJeu(etat);

    expect(nouveaux).toHaveLength(1);
    expect(armeDe(etat, nouveaux[0] as string).devenuAMs).toBe(sansTraqueur.tempsEcouleMs);
    expect(peutTirer(etat, nouveaux[0] as string)).toBe(false);
  });

  it('retire un joueur parti de toutes les tables', () => {
    const etat = retirerJoueur(chasseAvec(), 'traqueur');

    expect(chasseDe(etat).traqueurs).toEqual({});
    expect(chasseDe(etat).parcours['traqueur']).toBeUndefined();
  });

  it('ne remplace personne apres une elimination, ni pour une proie seule', () => {
    const epuisee = tirerEnChasse(
      armer(avecNinja(chasseAvec(), 'ninja', { x: 540, y: 500 }), 'traqueur', { vies: 1 }),
      'traqueur',
    );
    const seule = retirerJoueur(retirerJoueur(chasseAvec(), 'traqueur'), 'loin');

    expect(enJeu(agirEnChasse(epuisee, {}, 50))).toEqual([]);
    expect(enJeu(agirEnChasse(seule, {}, 50))).toEqual([]);
  });

  it('remplace le dernier traqueur en jeu parti, meme si un autre a ete elimine', () => {
    let etat = avecJoueur(chasseAvec(), 'second', { x: 1000, y: 200 });
    etat = armer(devenirTraqueur(etat, 'second'), 'second', { vies: 0 });
    etat = retirerJoueur(etat, 'traqueur');

    expect(enJeu(agirEnChasse(etat, {}, 50))).toHaveLength(1);
  });

  it('ne fait rien dans une Chasse pas encore lancee', () => {
    const etat = avecJoueur(avecJoueur(partie(), 'a', { x: 500, y: 500 }), 'b', {
      x: 900,
      y: 500,
    });

    expect(agirEnChasse(etat, {}, 50)).toBe(etat);
  });
});

describe('le hors-jeu d un traqueur elimine', () => {
  /** Une chasse ou le traqueur est elimine, et un second traqueur en jeu. */
  function avecElimine(): EtatPartie {
    let etat = avecJoueur(chasseAvec(), 'second', { x: 1000, y: 200 });
    etat = devenirTraqueur(etat, 'second');
    return armer(etat, 'traqueur', { vies: 0 });
  }

  it('ne bouge plus, meme s il le demande', () => {
    const etat = avecElimine();
    const entrees: Entrees = { traqueur: { deplacement: { x: 1, y: 0 }, enMouvement: true } };

    expect(joueurDe(tick(etat, entrees, 50), 'traqueur').position).toEqual({ x: 500, y: 500 });
  });

  it('ne ramasse rien, et ne subit aucun malus', () => {
    let etat = avecElimine();
    etat = poserObjet(etat, {
      categorie: 'bonus',
      nature: 'vitesse',
      position: { x: 500, y: 500 },
    });
    etat = poserObjet(etat, {
      categorie: 'malus',
      nature: 'flou',
      position: { x: 1500, y: 1000 },
    });

    const ramasse = ramasserLesObjets(etat, malusEnChasse, horsJeuEnChasse(etat));

    expect(joueurDe(ramasse, 'traqueur').bonusRestantsMs.vitesse).toBe(0);
    expect(joueurDe(ramasse, 'traqueur').malusRestantsMs.flou).toBe(0);
    expect(joueurDe(ramasse, 'second').malusRestantsMs.flou).toBeGreaterThan(0);
  });

  it('n existe pas dans les autres modes, ni tant que personne n est elimine', () => {
    const etat = creerEtatInitial({ graine: 1 });

    for (const mode of ['classique', 'tactique', 'equipes'] as const) {
      expect(REGLES_DES_MODES[mode].horsJeu(etat)).toBe(PERSONNE_HORS_JEU);
    }
    expect(horsJeuEnChasse(chasseAvec())).toBe(PERSONNE_HORS_JEU);
  });
});

describe('les contacts de la Chasse', () => {
  it('ne produisent rien: toucher ne capture pas, et ne repeint aucun ninja', () => {
    const etat = avecNinja(chasseAvec({ x: 510, y: 500 }), 'ninja', { x: 505, y: 510 });

    expect(resoudreContacts(etat, detecterContacts(etat), regleChasse)).toBe(etat);
  });
});

describe('le malus en Chasse', () => {
  it('frappe l autre camp, et epargne le sien', () => {
    const etat = chasseAvec();

    expect(malusEnChasse(joueurDe(etat, 'traqueur'), joueurDe(etat, 'proie'))).toBe(true);
    expect(malusEnChasse(joueurDe(etat, 'proie'), joueurDe(etat, 'traqueur'))).toBe(true);
    expect(malusEnChasse(joueurDe(etat, 'proie'), joueurDe(etat, 'loin'))).toBe(false);
  });
});

describe('les points en Chasse', () => {
  it('donnent a une proie un point par tranche de cent pixels parcourus', () => {
    const depart = chasseAvec();
    const chasse = chasseDe(depart);
    const etat = {
      ...depart,
      chasse: {
        ...chasse,
        parcours: { ...chasse.parcours, proie: { distancePx: 1299, derniere: { x: 0, y: 0 } } },
      },
    };

    expect(pointsEnChasse(etat, joueurDe(etat, 'proie'))).toBe(12);
    expect(scoreDe(etat, joueurDe(etat, 'proie')).points).toBe(12);
  });

  it('donnent a un traqueur cinquante points par capture et vingt-cinq par vie', () => {
    const infecte = tirerEnChasse(chasseAvec({ x: 560, y: 500 }), 'traqueur');

    expect(pointsEnChasse(infecte, joueurDe(infecte, 'traqueur'))).toBe(50 + 3 * 25);
    expect(pointsEnChasse(infecte, joueurDe(infecte, 'proie'))).toBe(3 * 25);
  });

  it('ne comptent plus les vies d un traqueur elimine, mais gardent ses captures', () => {
    const etat = regler(armer(chasseAvec(), 'traqueur', { vies: 0 }), 'traqueur', {
      captures: 2,
    });

    expect(pointsEnChasse(etat, joueurDe(etat, 'traqueur'))).toBe(100);
  });

  it('classent les joueurs aux points, puis aux captures, comme en Classique', () => {
    const infecte = tirerEnChasse(chasseAvec({ x: 560, y: 500 }), 'traqueur');

    expect(calculerScores(infecte).map((ligne) => [ligne.id, ligne.points])).toEqual([
      ['traqueur', 125],
      ['proie', 75],
      ['loin', 0],
    ]);
  });
});

describe('la fin de la Chasse', () => {
  it('est decidee des que la derniere proie tombe ou part', () => {
    const plusDeProie = retirerJoueur(retirerJoueur(chasseAvec(), 'proie'), 'loin');

    expect(chasseDecidee(chasseAvec())).toBe(false);
    expect(evaluerFinDePartie(plusDeProie).terminee).toBe(true);
  });

  it('ne l est jamais pour une Chasse au salon', () => {
    const salon = avecJoueur(partie(), 'a', { x: 500, y: 500 });

    expect(chasseDecidee(salon)).toBe(false);
    expect(evaluerFinDePartie(salon).terminee).toBe(false);
  });

  it('garde le temps restant du reglage, et le temps decide toujours', () => {
    const etat = chasseAvec();

    expect(evaluerFinDePartie(etat)).toEqual({
      terminee: false,
      tempsRestantMs: etat.dureeMs - etat.tempsEcouleMs,
    });
    expect(evaluerFinDePartie({ ...etat, tempsEcouleMs: etat.dureeMs }).terminee).toBe(true);
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

    for (const bot of Object.values(peuplerDeBots(lancerLaChasse(salon), 200).bots)) {
      expect(bot.couleur).not.toBe(COULEUR_DES_TRAQUEURS);
    }
  });
});

describe('le jeu de regles Chasse dans le moteur', () => {
  it('branche les regles du mode', () => {
    expect(REGLES_DES_MODES.chasse).toMatchObject({
      agir: agirEnChasse,
      resoudreContacts: regleChasse,
      victimeDuMalus: malusEnChasse,
      lancer: lancerLaChasse,
      estDecidee: chasseDecidee,
      horsJeu: horsJeuEnChasse,
    });
  });

  it('lance la Chasse par lancerLaPartie', () => {
    const salon = ajouterJoueur(ajouterJoueur(partie(), { id: 'a', pseudo: 'A' }), {
      id: 'b',
      pseudo: 'B',
    });

    expect(lancerLaPartie(salon)).toEqual(lancerLaChasse(salon));
  });

  it('joue un tir de bout en bout: le traqueur marche vers la proie, puis tire', () => {
    let etat = chasseAvec({ x: 700, y: 500 });
    const marche: Entrees = { traqueur: { deplacement: { x: 1, y: 0 }, enMouvement: true } };
    const tir: Entrees = {
      traqueur: { deplacement: { x: 1, y: 0 }, enMouvement: false, capturer: true },
    };

    for (let battement = 0; battement < 20; battement += 1) {
      etat = tick(etat, marche, 50);
    }
    etat = tick(etat, tir, 50);

    expect(estTraqueur(etat, 'proie')).toBe(true);
    expect(evaluerFinDePartie(etat).terminee).toBe(false);
  });

  it('compte le chemin des proies qui marchent, et rien pour celles qui restent cachees', () => {
    let etat = chasseAvec();
    const entrees: Entrees = { proie: { deplacement: { x: -1, y: 0 }, enMouvement: true } };

    for (let battement = 0; battement < 20; battement += 1) {
      etat = tick(etat, entrees, 50);
    }

    expect(chasseDe(etat).parcours['proie']?.distancePx).toBeCloseTo(150, 5);
    expect(chasseDe(etat).parcours['loin']?.distancePx).toBe(0);
  });

  it('rejoue a l identique deux Chasses de meme graine et memes entrees', () => {
    function jouer(): EtatPartie {
      let etat = partie({ zones: { actives: true } });
      for (let rang = 0; rang < 6; rang += 1) {
        etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
      }
      etat = lancerLaPartie(peuplerDeBots(etat, 60));
      for (let battement = 0; battement < 400; battement += 1) {
        const entrees: Entrees = Object.fromEntries(
          Object.keys(etat.joueurs).map((id, rang) => [
            id,
            {
              deplacement: { x: rang % 2 === 0 ? 1 : -1, y: 1 },
              enMouvement: true,
              ...(battement % 25 === 0 ? { capturer: true as const } : {}),
            },
          ]),
        );
        etat = tick(etat, entrees, 50);
      }
      return etat;
    }

    expect(jouer()).toEqual(jouer());
  });
});
