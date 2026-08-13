/**
 * Tests du modele d'etat.
 *
 * On verifie trois choses: qu'une partie neuve part dans un etat sain, que faire
 * entrer un joueur reproduit ce que faisait le constructeur Player du legacy, et
 * que rien ne se modifie sur place.
 */

import { CARTES, DUREES, REGLAGES_PAR_DEFAUT, creerAlea } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatPartie, Joueur } from './etat.js';
import {
  COMPTEUR_CAPTURE_PRET,
  ajouterJoueur,
  couleursUtilisees,
  creerEtatInitial,
  estInvulnerable,
  peutCapturer,
  positionDApparition,
  retirerJoueur,
} from './etat.js';

/** Lit un joueur dont on sait qu'il est present, sans alourdir chaque test. */
function joueurDe(etat: EtatPartie, id: string): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

describe('creerEtatInitial', () => {
  it('part d une partie vide, au temps zero', () => {
    const etat = creerEtatInitial({ graine: 1 });

    expect(etat.tick).toBe(0);
    expect(etat.tempsEcouleMs).toBe(0);
    expect(etat.joueurs).toEqual({});
  });

  it('applique les reglages par defaut du legacy', () => {
    const etat = creerEtatInitial({ graine: 1 });

    expect(etat.reglages).toEqual(REGLAGES_PAR_DEFAUT);
    expect(etat.dureeMs).toBe(180_000);
    expect(etat.carte).toEqual(CARTES.map1);
  });

  it('accepte des reglages partiels et complete le reste', () => {
    const etat = creerEtatInitial({ graine: 1, reglages: { carte: 'map3', dureePartieS: 60 } });

    expect(etat.carte).toEqual({ largeur: 3000, hauteur: 2000 });
    expect(etat.dureeMs).toBe(60_000);
    expect(etat.reglages.nombreBotsInitial).toBe(REGLAGES_PAR_DEFAUT.nombreBotsInitial);
  });

  it('porte les dimensions de la carte choisie, quelle que soit sa taille', () => {
    // Le legacy renvoyait toujours 2000x1500, meme sur map3 (defaut X5).
    const grande = creerEtatInitial({ graine: 1, reglages: { carte: 'map3' } });
    const petite = creerEtatInitial({ graine: 1, reglages: { carte: 'map2' } });

    expect(grande.carte.largeur).toBe(3000);
    expect(petite.carte.largeur).toBe(2000);
  });

  it('produit deux etats identiques pour la meme graine', () => {
    expect(creerEtatInitial({ graine: 42 })).toEqual(creerEtatInitial({ graine: 42 }));
  });
});

describe('positionDApparition', () => {
  it('reste a distance des bords de la carte', () => {
    let alea = creerAlea(2026);

    for (let index = 0; index < 200; index += 1) {
      const tirage = positionDApparition(alea, CARTES.map3);
      expect(tirage.valeur.x).toBeGreaterThanOrEqual(100);
      expect(tirage.valeur.x).toBeLessThanOrEqual(2900);
      expect(tirage.valeur.y).toBeGreaterThanOrEqual(100);
      expect(tirage.valeur.y).toBeLessThanOrEqual(1900);
      alea = tirage.alea;
    }
  });

  it('tire la meme position pour le meme generateur', () => {
    const premiere = positionDApparition(creerAlea(8), CARTES.map1);
    const seconde = positionDApparition(creerAlea(8), CARTES.map1);

    expect(premiere.valeur).toEqual(seconde.valeur);
  });
});

describe('ajouterJoueur', () => {
  it('fait apparaitre le joueur protege et immobile', () => {
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'j1', pseudo: 'Alice' });
    const joueur = joueurDe(etat, 'j1');

    expect(joueur.type).toBe('joueur');
    expect(joueur.pseudo).toBe('Alice');
    expect(joueur.direction).toBe('immobile');
    expect(joueur.protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
  });

  it('laisse le nouveau venu capturer tout de suite', () => {
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'j1', pseudo: 'Alice' });
    const joueur = joueurDe(etat, 'j1');

    expect(joueur.tempsDepuisDerniereCaptureMs).toBe(COMPTEUR_CAPTURE_PRET);
    expect(peutCapturer(joueur)).toBe(true);
  });

  it('donne une couleur differente a chaque joueur', () => {
    let etat = creerEtatInitial({ graine: 1 });
    for (const id of ['j1', 'j2', 'j3', 'j4', 'j5', 'j6']) {
      etat = ajouterJoueur(etat, { id, pseudo: id });
    }

    const couleurs = couleursUtilisees(etat);
    expect(new Set(couleurs).size).toBe(6);
  });

  it('accepte une position et une couleur imposees', () => {
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), {
      id: 'j1',
      pseudo: 'Alice',
      position: { x: 10, y: 20 },
      couleur: '#123456',
    });

    expect(etat.joueurs['j1']?.position).toEqual({ x: 10, y: 20 });
    expect(etat.joueurs['j1']?.couleur).toBe('#123456');
  });

  it('ne consomme pas de hasard quand tout est impose', () => {
    const depart = creerEtatInitial({ graine: 1 });
    const etat = ajouterJoueur(depart, {
      id: 'j1',
      pseudo: 'Alice',
      position: { x: 10, y: 20 },
      couleur: '#123456',
    });

    expect(etat.alea).toEqual(depart.alea);
  });

  it('ne modifie pas l etat qu on lui passe', () => {
    const depart = creerEtatInitial({ graine: 1 });
    ajouterJoueur(depart, { id: 'j1', pseudo: 'Alice' });

    expect(depart.joueurs).toEqual({});
  });
});

describe('retirerJoueur', () => {
  it('retire le joueur de la partie', () => {
    const avec = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'j1', pseudo: 'Alice' });
    const sans = retirerJoueur(avec, 'j1');

    expect(sans.joueurs['j1']).toBeUndefined();
    expect(avec.joueurs['j1']).toBeDefined();
  });

  it('ne fait rien pour un joueur absent', () => {
    const etat = creerEtatInitial({ graine: 1 });

    expect(retirerJoueur(etat, 'inconnu')).toBe(etat);
  });
});

describe('estInvulnerable', () => {
  it('protege le joueur tant qu il lui reste de la protection', () => {
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'j1', pseudo: 'Alice' });

    expect(estInvulnerable(joueurDe(etat, 'j1'))).toBe(true);
  });

  it('ne protege plus une fois la protection epuisee', () => {
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'j1', pseudo: 'Alice' });
    const joueur = joueurDe(etat, 'j1');

    expect(estInvulnerable({ ...joueur, protectionSpawnRestanteMs: 0 })).toBe(false);
  });
});

describe('peutCapturer', () => {
  it('refuse a exactement une seconde et accepte juste apres', () => {
    // Comportement fige par la caracterisation: le legacy compare en inegalite
    // stricte (Date.now() - lastCapture > 1000).
    const etat = ajouterJoueur(creerEtatInitial({ graine: 1 }), { id: 'j1', pseudo: 'Alice' });
    const joueur = joueurDe(etat, 'j1');

    expect(peutCapturer({ ...joueur, tempsDepuisDerniereCaptureMs: 1000 })).toBe(false);
    expect(peutCapturer({ ...joueur, tempsDepuisDerniereCaptureMs: 1001 })).toBe(true);
  });
});
