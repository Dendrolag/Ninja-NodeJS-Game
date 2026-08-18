/**
 * Tests de la pause.
 *
 * Ils verifient une seule promesse, sous tous ses angles: pendant la pause, le
 * temps de jeu ne passe pas. Tout le reste en decoule, y compris le fait qu'une
 * partie suspendue ne se termine jamais d'elle-meme.
 */

import type { ReglagesPartiels } from '@neon-ninja/shared';
import { COULEUR_BOT_NEUTRE, DUREES, VITESSES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatPartie, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';
import type { Entrees } from './moteur.js';
import { evaluerFinDePartie, tick } from './moteur.js';
import { poserObjet } from './objets.js';
import { mettreEnPause, reprendre } from './pause.js';

/** Duree d'un battement a la cadence du serveur, en millisecondes. */
const BATTEMENT_MS = 50;

/** Reglages ou rien n'apparait tout seul: le test pose lui-meme ce qu'il veut. */
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

/** Une partie avec un joueur au milieu, et rien qui apparaisse dans son dos. */
function partieAvecUnJoueur(): EtatPartie {
  return ajouterJoueur(creerEtatInitial({ graine: 1, reglages: AUCUNE_APPARITION }), {
    id: 'j1',
    pseudo: 'Alice',
    position: { x: 500, y: 500 },
    couleur: '#FF0000',
  });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: string): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Entree qui pousse un joueur vers la droite. */
const VERS_LA_DROITE: Entrees = { j1: { enMouvement: true, deplacement: { x: 1, y: 0 } } };

describe('mettreEnPause et reprendre', () => {
  it('posent et retirent l indicateur sans toucher au reste', () => {
    const partie = partieAvecUnJoueur();
    const suspendue = mettreEnPause(partie);

    expect(partie.enPause).toBe(false);
    expect(suspendue.enPause).toBe(true);
    expect({ ...suspendue, enPause: false }).toEqual(partie);
    expect(reprendre(suspendue)).toEqual(partie);
  });

  it('rendent l etat tel quel quand il n y a rien a faire', () => {
    const partie = partieAvecUnJoueur();
    const suspendue = mettreEnPause(partie);

    expect(reprendre(partie)).toBe(partie);
    expect(mettreEnPause(suspendue)).toBe(suspendue);
  });

  it('refusent de suspendre une partie deja terminee', () => {
    const finie = { ...partieAvecUnJoueur(), tempsEcouleMs: 999_999 };

    expect(evaluerFinDePartie(finie).terminee).toBe(true);
    expect(mettreEnPause(finie)).toBe(finie);
  });
});

describe('un battement pendant la pause', () => {
  it('ne fait pas passer le temps de jeu, quel que soit le dt', () => {
    const suspendue = mettreEnPause(partieAvecUnJoueur());
    const apres = tick(tick(suspendue, {}, BATTEMENT_MS), {}, 10_000);

    expect(apres.tempsEcouleMs).toBe(0);
  });

  it('compte quand meme le battement', () => {
    const suspendue = mettreEnPause(partieAvecUnJoueur());

    expect(tick(suspendue, {}, BATTEMENT_MS).tick).toBe(suspendue.tick + 1);
  });

  it('ne deplace personne, meme si le joueur pousse sa direction', () => {
    const suspendue = mettreEnPause(partieAvecUnJoueur());
    const apres = tick(suspendue, VERS_LA_DROITE, BATTEMENT_MS);

    expect(joueurDe(apres, 'j1').position).toEqual({ x: 500, y: 500 });
  });

  it('ne fait pas avancer les bots', () => {
    const avecBot = ajouterBot(partieAvecUnJoueur(), {
      id: 'b1',
      position: { x: 200, y: 200 },
    });
    const apres = tick(mettreEnPause(avecBot), {}, BATTEMENT_MS);

    expect(apres.bots['b1']?.position).toEqual({ x: 200, y: 200 });
  });

  it('ne rapproche aucun effet de sa fin', () => {
    const partie = partieAvecUnJoueur();
    const protection = joueurDe(partie, 'j1').protectionSpawnRestanteMs;
    const apres = tick(mettreEnPause(partie), {}, BATTEMENT_MS);

    expect(protection).toBeGreaterThan(0);
    expect(joueurDe(apres, 'j1').protectionSpawnRestanteMs).toBe(protection);
  });

  it('ne fait pas vieillir les objets poses', () => {
    const avecBonus = poserObjet(partieAvecUnJoueur(), {
      categorie: 'bonus',
      nature: 'vitesse',
      position: { x: 800, y: 800 },
    });
    const duree = Object.values(avecBonus.objets)[0]?.dureeDeVieRestanteMs;
    const apres = tick(mettreEnPause(avecBonus), {}, BATTEMENT_MS);

    expect(duree).toBeGreaterThan(0);
    expect(Object.values(apres.objets)[0]?.dureeDeVieRestanteMs).toBe(duree);
  });

  it('laisse le journal d evenements vide', () => {
    // Sans cette remise a zero, la couche reseau relirait le journal du dernier
    // battement actif a chaque battement de la pause, et renverrait la meme
    // notification vingt fois par seconde jusqu'a la reprise.
    const partie = { ...partieAvecUnJoueur(), evenements: [{ type: 'bonusRamasse' } as never] };
    const apres = tick(mettreEnPause(partie), {}, BATTEMENT_MS);

    expect(apres.evenements).toEqual([]);
  });

  it('ne laisse aucune capture se produire', () => {
    // Un bot colle au joueur: sans pause, il prend sa couleur des le premier
    // battement. Suspendue, la partie le laisse blanc indefiniment.
    const avecBot = ajouterBot(partieAvecUnJoueur(), { id: 'b1', position: { x: 500, y: 500 } });
    const suspendue = tick(mettreEnPause(avecBot), {}, BATTEMENT_MS);

    expect(tick(avecBot, {}, BATTEMENT_MS).bots['b1']?.couleur).toBe('#FF0000');
    expect(suspendue.bots['b1']?.couleur).toBe(COULEUR_BOT_NEUTRE);
  });
});

describe('la fin de partie pendant la pause', () => {
  /** Une partie a un battement de sa fin. */
  function presqueFinie(): EtatPartie {
    const partie = partieAvecUnJoueur();

    return { ...partie, tempsEcouleMs: partie.dureeMs - BATTEMENT_MS };
  }

  it('n arrive jamais tant que la partie est suspendue', () => {
    let partie = mettreEnPause(presqueFinie());

    for (let battements = 0; battements < 100; battements += 1) {
      partie = tick(partie, {}, BATTEMENT_MS);
    }

    expect(evaluerFinDePartie(partie).terminee).toBe(false);
    expect(evaluerFinDePartie(partie).tempsRestantMs).toBe(BATTEMENT_MS);
  });

  it('arrive normalement une fois la partie reprise', () => {
    const suspendue = mettreEnPause(presqueFinie());
    const apres = tick(reprendre(tick(suspendue, {}, BATTEMENT_MS)), {}, BATTEMENT_MS);

    expect(evaluerFinDePartie(apres).terminee).toBe(true);
  });
});

describe('la reprise', () => {
  it('rend au jeu exactement le temps qu il avait', () => {
    // Deux parties identiques: l'une joue trois battements d'affilee, l'autre
    // fait une pause de vingt battements au milieu. Elles doivent finir dans le
    // meme etat, au numero de battement pres.
    const depart = partieAvecUnJoueur();

    let sansPause = depart;
    for (let battements = 0; battements < 3; battements += 1) {
      sansPause = tick(sansPause, VERS_LA_DROITE, BATTEMENT_MS);
    }

    let avecPause = tick(depart, VERS_LA_DROITE, BATTEMENT_MS);
    avecPause = mettreEnPause(avecPause);
    for (let battements = 0; battements < 20; battements += 1) {
      avecPause = tick(avecPause, VERS_LA_DROITE, BATTEMENT_MS);
    }
    avecPause = reprendre(avecPause);
    for (let battements = 0; battements < 2; battements += 1) {
      avecPause = tick(avecPause, VERS_LA_DROITE, BATTEMENT_MS);
    }

    expect({ ...avecPause, tick: sansPause.tick }).toEqual(sansPause);
  });

  it('rend au joueur sa vitesse normale des le premier battement', () => {
    const suspendue = mettreEnPause(partieAvecUnJoueur());
    const pendant = tick(suspendue, VERS_LA_DROITE, BATTEMENT_MS);
    const apres = tick(reprendre(pendant), VERS_LA_DROITE, BATTEMENT_MS);
    const pas = (VITESSES.JOUEUR_PX_PAR_SECONDE * BATTEMENT_MS) / 1000;

    expect(joueurDe(pendant, 'j1').position.x).toBe(500);
    expect(joueurDe(apres, 'j1').position.x).toBe(500 + pas);
  });
});

describe('la protection d apparition', () => {
  it('ne s use pas pendant la pause', () => {
    // Un joueur qui vient d'apparaitre garde ses trois secondes entieres: la
    // pause ne doit pas etre un moyen de faire expirer la protection des autres.
    const partie = mettreEnPause(partieAvecUnJoueur());

    let apres = partie;
    for (let battements = 0; battements < 200; battements += 1) {
      apres = tick(apres, {}, BATTEMENT_MS);
    }

    expect(joueurDe(apres, 'j1').protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
  });
});
