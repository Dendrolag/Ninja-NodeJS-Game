/**
 * Tests du modele d'etat.
 *
 * On verifie trois choses: qu'une partie neuve part dans un etat sain, que faire
 * entrer un joueur reproduit ce que faisait le constructeur Player du legacy, et
 * que rien ne se modifie sur place.
 */

import { APPARITION, CARTES, DUREES, REGLAGES_PAR_DEFAUT, creerAlea } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { carteSansMur, creerCarteCollisions, estMur } from './collisions.js';
import type { EtatPartie, Joueur } from './etat.js';
import {
  COMPTEUR_CAPTURE_PRET,
  ajouterJoueur,
  couleursUtilisees,
  creerEtatInitial,
  estInvulnerable,
  peutCapturer,
  positionDApparition,
  positionsOccupees,
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

  it('joue sans mur quand aucun terrain n est fourni', () => {
    const etat = creerEtatInitial({ graine: 1 });

    expect(etat.terrain.largeur).toBe(CARTES.map1.largeur);
    expect(estMur(etat.terrain, 1000, 750)).toBe(false);
  });

  it('accepte un terrain aux dimensions de la carte choisie', () => {
    const terrain = creerCarteCollisions(CARTES.map3, (x) => x >= 2500);
    const etat = creerEtatInitial({ graine: 1, reglages: { carte: 'map3' }, terrain });

    expect(estMur(etat.terrain, 2600, 1000)).toBe(true);
  });

  it('refuse un terrain qui ne correspond pas a la carte', () => {
    // C'est la nature meme du defaut X5: jouer sur la grande carte en croyant
    // qu'elle mesure 2000 sur 1500.
    const terrain = carteSansMur(CARTES.map1);

    expect(() => creerEtatInitial({ graine: 1, reglages: { carte: 'map3' }, terrain })).toThrow();
  });
});

describe('positionDApparition', () => {
  it('reste a distance des bords de la carte', () => {
    const terrain = carteSansMur(CARTES.map3);
    let alea = creerAlea(2026);

    for (let index = 0; index < 200; index += 1) {
      const tirage = positionDApparition(alea, terrain);
      expect(tirage.valeur.x).toBeGreaterThanOrEqual(100);
      expect(tirage.valeur.x).toBeLessThanOrEqual(2900);
      expect(tirage.valeur.y).toBeGreaterThanOrEqual(100);
      expect(tirage.valeur.y).toBeLessThanOrEqual(1900);
      alea = tirage.alea;
    }
  });

  it('tire la meme position pour le meme generateur', () => {
    const terrain = carteSansMur(CARTES.map1);
    const premiere = positionDApparition(creerAlea(8), terrain);
    const seconde = positionDApparition(creerAlea(8), terrain);

    expect(premiere.valeur).toEqual(seconde.valeur);
  });

  it('ne fait jamais apparaitre une entite dans un mur', () => {
    // Un seul couloir libre au milieu de la carte: tout tirage tombe dedans ou
    // est rejete. Le legacy, lui, ne testait le terrain que par canMove, ce
    // qu'il faisait deja; ce test verifie que le portage ne l'a pas perdu.
    const terrain = creerCarteCollisions(CARTES.map1, (_x, y) => y < 700 || y > 800);
    let alea = creerAlea(7);

    for (let index = 0; index < 30; index += 1) {
      const tirage = positionDApparition(alea, terrain);
      expect(estMur(terrain, tirage.valeur.x, tirage.valeur.y)).toBe(false);
      expect(tirage.valeur.y).toBeGreaterThan(700);
      expect(tirage.valeur.y).toBeLessThan(800);
      alea = tirage.alea;
    }
  });

  it('ecarte les nouvelles apparitions de cent pixels des places prises', () => {
    // CORRECTION DU DEFAUT X4. Le legacy tenait un registre de positions qu'il
    // n'alimentait jamais: la distance de securite ne s'appliquait donc jamais.
    // Le couloir libre concentre les tirages, ce qui rend le voisinage de
    // l'occupant tres probable si on ne l'evite pas.
    const terrain = creerCarteCollisions(CARTES.map1, (_x, y) => y < 700 || y > 800);
    const occupees = [{ x: 1000, y: 750 }];
    let alea = creerAlea(11);

    for (let index = 0; index < 50; index += 1) {
      const tirage = positionDApparition(alea, terrain, occupees);
      const distance = Math.hypot(tirage.valeur.x - 1000, tirage.valeur.y - 750);
      expect(distance).toBeGreaterThanOrEqual(APPARITION.DISTANCE_DE_SECURITE);
      alea = tirage.alea;
    }
  });

  it('trouve une place en spirale quand tous les tirages echouent', () => {
    // CORRECTION DU DEFAUT X3. Le chemin de secours du legacy levait une erreur
    // au lieu de replier quoi que ce soit. Ici la seule place libre est hors de
    // la bande ou l'on tire au sort: les cent tirages echouent, et la spirale
    // depuis le centre la trouve.
    const terrain = creerCarteCollisions(
      CARTES.map1,
      (x, y) => Math.hypot(x - 1000, y - 1450) > 30,
    );

    const tirage = positionDApparition(creerAlea(3), terrain);

    expect(tirage.valeur.x).toBeCloseTo(1000, 6);
    expect(tirage.valeur.y).toBeCloseTo(1450, 6);
  });

  it('se rabat sur le centre de la carte quand il n y a aucune place', () => {
    const terrain = creerCarteCollisions(CARTES.map1, () => true);

    const tirage = positionDApparition(creerAlea(3), terrain);

    expect(tirage.valeur).toEqual({ x: 1000, y: 750 });
  });

  it('fait avancer le generateur, meme quand il faut se rabattre', () => {
    const terrain = creerCarteCollisions(CARTES.map1, () => true);
    const tirage = positionDApparition(creerAlea(3), terrain);

    expect(tirage.alea).not.toEqual(creerAlea(3));
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

  it('fait apparaitre chaque joueur a l ecart des precedents', () => {
    // Couloir libre etroit, pour que les tirages se concentrent et que la
    // distance de securite ait une chance de servir.
    const terrain = creerCarteCollisions(CARTES.map1, (_x, y) => y < 700 || y > 800);
    let etat = creerEtatInitial({ graine: 5, terrain });

    for (const id of ['j1', 'j2', 'j3', 'j4', 'j5']) {
      etat = ajouterJoueur(etat, { id, pseudo: id });
    }

    const places = positionsOccupees(etat);
    for (let premier = 0; premier < places.length; premier += 1) {
      for (let second = premier + 1; second < places.length; second += 1) {
        const ici = places[premier];
        const la = places[second];
        expect(
          Math.hypot((ici?.x ?? 0) - (la?.x ?? 0), (ici?.y ?? 0) - (la?.y ?? 0)),
        ).toBeGreaterThanOrEqual(APPARITION.DISTANCE_DE_SECURITE);
      }
    }
  });

  it('ne fait jamais apparaitre un joueur dans un mur', () => {
    const terrain = creerCarteCollisions(CARTES.map1, (x) => x >= 1000);
    let etat = creerEtatInitial({ graine: 9, terrain });

    for (const id of ['j1', 'j2', 'j3']) {
      etat = ajouterJoueur(etat, { id, pseudo: id });
    }

    for (const position of positionsOccupees(etat)) {
      expect(estMur(terrain, position.x, position.y)).toBe(false);
    }
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
