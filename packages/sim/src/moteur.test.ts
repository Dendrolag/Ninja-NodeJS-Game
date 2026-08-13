/**
 * Tests du moteur.
 *
 * Ce fichier verifie le contrat lui-meme: purete, determinisme, avancement du
 * temps, application des entrees. C'est le socle sur lequel les etapes 1.2 a 1.5
 * viendront brancher leurs systemes.
 */

import type { Vecteur } from '@neon-ninja/shared';
import { VITESSES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatPartie, Joueur } from './etat.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';
import type { Entrees } from './moteur.js';
import { evaluerFinDePartie, tick } from './moteur.js';

/** Duree d'un battement a la cadence du serveur, en millisecondes. */
const BATTEMENT_MS = 50;

/** Partie d'un joueur, place ou on veut, pour partir d'une situation nette. */
function partieAvecUnJoueur(position = { x: 500, y: 500 }): EtatPartie {
  return ajouterJoueur(creerEtatInitial({ graine: 1 }), {
    id: 'j1',
    pseudo: 'Alice',
    position,
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

/** Entree de deplacement pour un joueur unique. */
function vers(deplacement: Vecteur): Entrees {
  return { j1: { deplacement, enMouvement: true } };
}

describe('avancement du temps', () => {
  it('compte les battements et le temps ecoule', () => {
    let etat = creerEtatInitial({ graine: 1 });
    etat = tick(etat, {}, BATTEMENT_MS);
    etat = tick(etat, {}, BATTEMENT_MS);

    expect(etat.tick).toBe(2);
    expect(etat.tempsEcouleMs).toBe(100);
  });

  it('refuse un temps ecoule negatif ou absurde', () => {
    const etat = creerEtatInitial({ graine: 1 });

    expect(() => tick(etat, {}, -1)).toThrow();
    expect(() => tick(etat, {}, Number.NaN)).toThrow();
  });

  it('ne modifie pas l etat qu on lui passe', () => {
    const depart = partieAvecUnJoueur();
    tick(depart, vers({ x: 1, y: 0 }), BATTEMENT_MS);

    expect(depart.tick).toBe(0);
    expect(joueurDe(depart, 'j1').position).toEqual({ x: 500, y: 500 });
  });
});

describe('purete et determinisme', () => {
  it('donne le meme etat pour les memes entrees et la meme graine', () => {
    const premier = tick(partieAvecUnJoueur(), vers({ x: 1, y: 1 }), BATTEMENT_MS);
    const second = tick(partieAvecUnJoueur(), vers({ x: 1, y: 1 }), BATTEMENT_MS);

    expect(premier).toEqual(second);
  });

  it('donne le meme resultat sur une longue suite de battements', () => {
    const derouler = (): EtatPartie => {
      let etat = ajouterJoueur(creerEtatInitial({ graine: 2026 }), { id: 'j1', pseudo: 'Alice' });
      for (let battement = 0; battement < 200; battement += 1) {
        const angle = battement / 10;
        etat = tick(etat, vers({ x: Math.cos(angle), y: Math.sin(angle) }), BATTEMENT_MS);
      }
      return etat;
    };

    expect(derouler()).toEqual(derouler());
  });

  it('produit des parties differentes pour des graines differentes', () => {
    const avec = (graine: number): EtatPartie =>
      ajouterJoueur(creerEtatInitial({ graine }), { id: 'j1', pseudo: 'Alice' });

    expect(joueurDe(avec(1), 'j1').position).not.toEqual(joueurDe(avec(2), 'j1').position);
  });
});

describe('deplacement des joueurs', () => {
  it('avance a la vitesse du joueur, proportionnellement au temps', () => {
    const etat = tick(partieAvecUnJoueur(), vers({ x: 1, y: 0 }), 1000);

    expect(joueurDe(etat, 'j1').position.x).toBeCloseTo(500 + VITESSES.JOUEUR_PX_PAR_SECONDE, 10);
  });

  it('parcourt la meme distance en un grand pas qu en plusieurs petits', () => {
    let parPetitsPas = partieAvecUnJoueur();
    for (let battement = 0; battement < 20; battement += 1) {
      parPetitsPas = tick(parPetitsPas, vers({ x: 1, y: 0 }), BATTEMENT_MS);
    }

    const enUnSeulPas = tick(partieAvecUnJoueur(), vers({ x: 1, y: 0 }), 1000);

    expect(joueurDe(parPetitsPas, 'j1').position.x).toBeCloseTo(
      joueurDe(enUnSeulPas, 'j1').position.x,
      10,
    );
  });

  it('ignore la longueur du vecteur envoye', () => {
    // Le client indique une direction, pas une vitesse. C'est ce qui empeche la
    // triche la plus simple: envoyer un vecteur enorme.
    const normal = tick(partieAvecUnJoueur(), vers({ x: 1, y: 0 }), BATTEMENT_MS);
    const exagere = tick(partieAvecUnJoueur(), vers({ x: 10_000, y: 0 }), BATTEMENT_MS);

    expect(joueurDe(exagere, 'j1').position).toEqual(joueurDe(normal, 'j1').position);
  });

  it('parcourt la meme distance en diagonale que tout droit', () => {
    const droit = tick(partieAvecUnJoueur(), vers({ x: 1, y: 0 }), BATTEMENT_MS);
    const diagonale = tick(partieAvecUnJoueur(), vers({ x: 1, y: 1 }), BATTEMENT_MS);

    const distance = (etat: EtatPartie): number => {
      const position = joueurDe(etat, 'j1').position;
      return Math.hypot(position.x - 500, position.y - 500);
    };

    expect(distance(diagonale)).toBeCloseTo(distance(droit), 10);
  });

  it('met a jour la direction selon le deplacement', () => {
    const etat = tick(partieAvecUnJoueur(), vers({ x: 0, y: 1 }), BATTEMENT_MS);

    expect(joueurDe(etat, 'j1').direction).toBe('sud');
  });

  it('immobilise le joueur qui ne declare pas de mouvement', () => {
    const etat = tick(
      partieAvecUnJoueur(),
      { j1: { deplacement: { x: 1, y: 0 }, enMouvement: false } },
      BATTEMENT_MS,
    );

    expect(joueurDe(etat, 'j1').position).toEqual({ x: 500, y: 500 });
    expect(joueurDe(etat, 'j1').direction).toBe('immobile');
  });

  it('immobilise le joueur sans entree du tout', () => {
    const etat = tick(partieAvecUnJoueur(), {}, BATTEMENT_MS);

    expect(joueurDe(etat, 'j1').position).toEqual({ x: 500, y: 500 });
    expect(joueurDe(etat, 'j1').direction).toBe('immobile');
  });

  it('ignore une entree adressee a un joueur absent', () => {
    const etat = tick(
      partieAvecUnJoueur(),
      {
        inconnu: { deplacement: { x: 1, y: 0 }, enMouvement: true },
      },
      BATTEMENT_MS,
    );

    expect(Object.keys(etat.joueurs)).toEqual(['j1']);
  });

  it('garde le joueur sur la carte', () => {
    let etat = partieAvecUnJoueur({ x: 10, y: 10 });
    for (let battement = 0; battement < 20; battement += 1) {
      etat = tick(etat, vers({ x: -1, y: -1 }), BATTEMENT_MS);
    }

    expect(joueurDe(etat, 'j1').position).toEqual({ x: 0, y: 0 });
  });

  it('declare immobile un joueur bloque contre le bord', () => {
    const etat = tick(partieAvecUnJoueur({ x: 0, y: 0 }), vers({ x: -1, y: -1 }), BATTEMENT_MS);

    expect(joueurDe(etat, 'j1').direction).toBe('immobile');
  });

  it('fait glisser le long du bord quand un seul axe est bloque', () => {
    // Colle au bord gauche, une poussee vers le nord-ouest ne garde que le nord.
    const etat = tick(partieAvecUnJoueur({ x: 0, y: 500 }), vers({ x: -1, y: -1 }), BATTEMENT_MS);
    const joueur = joueurDe(etat, 'j1');

    expect(joueur.position.x).toBe(0);
    expect(joueur.position.y).toBeLessThan(500);
    expect(joueur.direction).toBe('nord');
  });

  it('deplace chaque joueur selon sa propre entree', () => {
    const depart = ajouterJoueur(partieAvecUnJoueur(), {
      id: 'j2',
      pseudo: 'Bob',
      position: { x: 800, y: 800 },
      couleur: '#00FF00',
    });

    const etat = tick(
      depart,
      {
        j1: { deplacement: { x: 1, y: 0 }, enMouvement: true },
        j2: { deplacement: { x: 0, y: -1 }, enMouvement: true },
      },
      BATTEMENT_MS,
    );

    expect(joueurDe(etat, 'j1').direction).toBe('est');
    expect(joueurDe(etat, 'j2').direction).toBe('nord');
    expect(joueurDe(etat, 'j2').position.x).toBe(800);
  });
});

describe('minuteries des joueurs', () => {
  it('fait fondre la protection d apparition au fil des battements', () => {
    let etat = partieAvecUnJoueur();
    etat = tick(etat, {}, 1000);

    expect(joueurDe(etat, 'j1').protectionSpawnRestanteMs).toBe(2000);
  });

  it('epuise la protection apres trois secondes, sans descendre sous zero', () => {
    let etat = partieAvecUnJoueur();
    for (let battement = 0; battement < 100; battement += 1) {
      etat = tick(etat, {}, BATTEMENT_MS);
    }

    expect(joueurDe(etat, 'j1').protectionSpawnRestanteMs).toBe(0);
  });

  it('plafonne le compteur de capture au lieu de le laisser grandir sans fin', () => {
    let etat = partieAvecUnJoueur();
    for (let battement = 0; battement < 100; battement += 1) {
      etat = tick(etat, {}, BATTEMENT_MS);
    }

    expect(joueurDe(etat, 'j1').tempsDepuisDerniereCaptureMs).toBe(1001);
  });
});

describe('evaluerFinDePartie', () => {
  it('ne termine pas une partie qui commence', () => {
    const evaluation = evaluerFinDePartie(creerEtatInitial({ graine: 1 }));

    expect(evaluation.terminee).toBe(false);
    expect(evaluation.tempsRestantMs).toBe(180_000);
  });

  it('decompte le temps restant', () => {
    const etat = tick(creerEtatInitial({ graine: 1 }), {}, 1000);

    expect(evaluerFinDePartie(etat).tempsRestantMs).toBe(179_000);
  });

  it('termine la partie quand la duree est atteinte', () => {
    const etat = tick(creerEtatInitial({ graine: 1, reglages: { dureePartieS: 1 } }), {}, 1000);

    expect(evaluerFinDePartie(etat).terminee).toBe(true);
    expect(evaluerFinDePartie(etat).tempsRestantMs).toBe(0);
  });

  it('ne rend jamais un temps restant negatif', () => {
    const etat = tick(creerEtatInitial({ graine: 1, reglages: { dureePartieS: 1 } }), {}, 5000);

    expect(evaluerFinDePartie(etat).tempsRestantMs).toBe(0);
  });

  it('n agit pas: elle ne fait que constater', () => {
    const etat = creerEtatInitial({ graine: 1 });
    evaluerFinDePartie(etat);

    expect(etat).toEqual(creerEtatInitial({ graine: 1 }));
  });
});

describe('partie terminee', () => {
  it('fige l etat une fois la duree ecoulee', () => {
    const finie = tick(partieAvecUnJoueur(), {}, 181_000);
    const apres = tick(finie, vers({ x: 1, y: 0 }), BATTEMENT_MS);

    expect(apres).toBe(finie);
  });
});
