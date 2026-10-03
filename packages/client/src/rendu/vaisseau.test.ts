/**
 * Tests du vaisseau qui survole la Station lunaire (etape 8.9).
 *
 * Ce que le porteur du projet a demande, verifie sur la course elle-meme: il arrive de
 * facon aleatoire, pas par le meme chemin a chaque partie; il survole la carte lentement
 * pendant toute la partie; il repart; il regarde la ou il va. Et ce que le jeu en exige:
 * le meme vaisseau pour tous les joueurs d'une partie, une course sans saut.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { CARTES, completerReglages } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { VAISSEAU } from './apparence.js';
import type { Trajectoire } from './vaisseau.js';
import {
  creerTrajectoire,
  ecouleDansLaPartie,
  etatDuVaisseau,
  opaciteDuVaisseau,
  parcouruA,
  placeAffichee,
  placeDeLOmbre,
  rotationDuSprite,
  trajectoireDeLaPartie,
} from './vaisseau.js';

const STATION = CARTES.station;

/** Trois minutes: la duree d'une partie par defaut. */
const TROIS_MINUTES = 180_000;

/** La duree d'une manoeuvre sur une partie de cette duree. */
const manoeuvre = (dureeMs: number): number =>
  Math.min(VAISSEAU.dureeDeManoeuvreMs, dureeMs * VAISSEAU.partMaximaleDeManoeuvre);

/** Le vaisseau est-il au-dessus de la carte, son centre dedans. */
const auDessus = (point: { x: number; y: number }): boolean =>
  point.x >= 0 && point.x <= STATION.largeur && point.y >= 0 && point.y <= STATION.hauteur;

/** Les instants d'une partie, tous les tant de millisecondes, bouts compris. */
function instants(dureeMs: number, pasMs: number): number[] {
  return Array.from({ length: Math.floor(dureeMs / pasMs) + 1 }, (_, rang) => rang * pasMs);
}

/** La vitesse au sol a cet instant, en pixels par seconde, mesuree sur dix millisecondes. */
function vitesseA(trajectoire: Trajectoire, ecouleMs: number): number {
  return (parcouruA(trajectoire, ecouleMs + 5) - parcouruA(trajectoire, ecouleMs - 5)) * 100;
}

describe('la course du vaisseau', () => {
  it('est la meme pour la meme graine: tous les joueurs de la partie voient le meme vaisseau', () => {
    const premiere = creerTrajectoire(1234, STATION, TROIS_MINUTES);
    const seconde = creerTrajectoire(1234, STATION, TROIS_MINUTES);

    for (const instant of instants(TROIS_MINUTES, 7_000)) {
      expect(etatDuVaisseau(seconde, instant)).toEqual(etatDuVaisseau(premiere, instant));
    }
  });

  it('change avec la graine: pas le meme chemin a chaque partie', () => {
    const departs = new Set<string>();
    const milieux = new Set<string>();

    for (let graine = 1; graine <= 20; graine += 1) {
      const trajectoire = creerTrajectoire(graine * 7919, STATION, TROIS_MINUTES);
      const depart = etatDuVaisseau(trajectoire, 0);
      const milieu = etatDuVaisseau(trajectoire, TROIS_MINUTES / 2);

      departs.add(`${String(Math.round(depart.x))},${String(Math.round(depart.y))}`);
      milieux.add(`${String(Math.round(milieu.x))},${String(Math.round(milieu.y))}`);
    }

    expect(departs.size).toBe(20);
    expect(milieux.size).toBe(20);
  });

  it('arrive des quatre cotes de la carte, selon la graine', () => {
    const cotes = new Set<string>();

    for (let graine = 1; graine <= 40; graine += 1) {
      const { x, y } = etatDuVaisseau(creerTrajectoire(graine, STATION, TROIS_MINUTES), 0);

      cotes.add(y < 0 ? 'haut' : y > STATION.hauteur ? 'bas' : x < 0 ? 'gauche' : 'droite');
    }

    expect([...cotes].sort()).toEqual(['bas', 'droite', 'gauche', 'haut']);
  });

  it('attend hors de vue avant la partie, et en est sorti a sa fin, par un autre cote', () => {
    for (let graine = 1; graine <= 30; graine += 1) {
      const trajectoire = creerTrajectoire(graine, STATION, TROIS_MINUTES);
      const marge = VAISSEAU.margeHorsCartePx - 1;
      const dehors = (point: { x: number; y: number }): boolean =>
        point.x <= -marge ||
        point.x >= STATION.largeur + marge ||
        point.y <= -marge ||
        point.y >= STATION.hauteur + marge;
      const entree = etatDuVaisseau(trajectoire, -1_000);
      const sortie = etatDuVaisseau(trajectoire, TROIS_MINUTES + 1_000);

      expect(dehors(entree)).toBe(true);
      expect(dehors(etatDuVaisseau(trajectoire, 0))).toBe(true);
      expect(dehors(etatDuVaisseau(trajectoire, TROIS_MINUTES))).toBe(true);
      expect(dehors(sortie)).toBe(true);
      expect(Math.hypot(sortie.x - entree.x, sortie.y - entree.y)).toBeGreaterThan(marge);
    }
  });

  it('survole la carte pendant toute la partie, entre son arrivee et son depart', () => {
    for (let graine = 1; graine <= 30; graine += 1) {
      const trajectoire = creerTrajectoire(graine, STATION, TROIS_MINUTES);
      const debut = manoeuvre(TROIS_MINUTES);

      for (const instant of instants(TROIS_MINUTES - 2 * debut, 1_000)) {
        expect(auDessus(etatDuVaisseau(trajectoire, debut + instant))).toBe(true);
      }
    }
  });

  it('survole lentement, a la vitesse reglee a peu pres', () => {
    for (let graine = 1; graine <= 30; graine += 1) {
      const trajectoire = creerTrajectoire(graine, STATION, TROIS_MINUTES);
      const vitesse = vitesseA(trajectoire, TROIS_MINUTES / 2);

      // Le nombre de points de passage s'arrondit: la vitesse se rapproche de la consigne
      // sans l'atteindre exactement. Un dixieme de la vitesse d'un ninja, au plus.
      expect(vitesse).toBeGreaterThan(VAISSEAU.vitesseDeSurvolPxParS * 0.6);
      expect(vitesse).toBeLessThan(VAISSEAU.vitesseDeSurvolPxParS * 1.6);
    }
  });

  it('ralentit en arrivant, accelere en repartant, sans jamais changer d allure d un coup', () => {
    for (let graine = 1; graine <= 30; graine += 1) {
      const trajectoire = creerTrajectoire(graine, STATION, TROIS_MINUTES);
      const debut = manoeuvre(TROIS_MINUTES);
      const fin = TROIS_MINUTES - debut;
      const survol = vitesseA(trajectoire, TROIS_MINUTES / 2);

      expect(vitesseA(trajectoire, 500)).toBeGreaterThan(survol);
      expect(vitesseA(trajectoire, TROIS_MINUTES - 500)).toBeGreaterThan(survol);
      // Aux raccords, l'allure de la manoeuvre est celle du survol.
      expect(vitesseA(trajectoire, debut - 20)).toBeCloseTo(survol, 0);
      expect(vitesseA(trajectoire, fin + 20)).toBeCloseTo(survol, 0);
    }
  });

  it('avance sans saut d une image a l autre, et jamais a reculons', () => {
    for (let graine = 1; graine <= 10; graine += 1) {
      const trajectoire = creerTrajectoire(graine, STATION, TROIS_MINUTES);
      let precedent = etatDuVaisseau(trajectoire, 0);
      let parcouru = 0;

      for (const instant of instants(TROIS_MINUTES, 16)) {
        const ici = etatDuVaisseau(trajectoire, instant);
        const avance = parcouruA(trajectoire, instant);

        // A 60 images par seconde, l'arrivee la plus rapide reste sous 5 pixels par image.
        expect(Math.hypot(ici.x - precedent.x, ici.y - precedent.y)).toBeLessThan(5);
        expect(avance).toBeGreaterThanOrEqual(parcouru);
        precedent = ici;
        parcouru = avance;
      }
    }
  });

  it('regarde la ou il va', () => {
    const trajectoire = creerTrajectoire(42, STATION, TROIS_MINUTES);

    for (const instant of instants(TROIS_MINUTES - 2_000, 3_000)) {
      const ici = etatDuVaisseau(trajectoire, instant + 1_000);
      const avant = etatDuVaisseau(trajectoire, instant + 500);
      const apres = etatDuVaisseau(trajectoire, instant + 1_500);
      const course = Math.atan2(apres.y - avant.y, apres.x - avant.x);
      const ecart = Math.atan2(Math.sin(course - ici.cap), Math.cos(course - ici.cap));

      // La course sur une seconde, et le cap lu sur quelques pixels de courbe: moins de
      // dix degres d'ecart, meme dans un virage.
      expect(Math.abs(ecart)).toBeLessThan(0.17);
    }
  });

  it('fait tout cela sur une partie courte, en manoeuvres raccourcies', () => {
    const trenteSecondes = 30_000;
    const trajectoire = creerTrajectoire(7, STATION, trenteSecondes);

    expect(trajectoire.dureeDeManoeuvreMs).toBe(6_000);
    expect(auDessus(etatDuVaisseau(trajectoire, 0))).toBe(false);
    expect(auDessus(etatDuVaisseau(trajectoire, trenteSecondes / 2))).toBe(true);
    expect(auDessus(etatDuVaisseau(trajectoire, trenteSecondes))).toBe(false);
  });

  it('reste immobile hors de vue sur une partie sans duree', () => {
    const trajectoire = creerTrajectoire(7, STATION, 0);

    expect(etatDuVaisseau(trajectoire, 0)).toEqual(etatDuVaisseau(trajectoire, 5_000));
    expect(auDessus(etatDuVaisseau(trajectoire, 0))).toBe(false);
  });
});

describe('ecouleDansLaPartie', () => {
  it('deduit le temps ecoule du temps restant, borne a la partie', () => {
    expect(ecouleDansLaPartie(180_000, 180_000)).toBe(0);
    expect(ecouleDansLaPartie(180_000, 30_000)).toBe(150_000);
    expect(ecouleDansLaPartie(180_000, 0)).toBe(180_000);
    expect(ecouleDansLaPartie(180_000, 200_000)).toBe(0);
  });
});

describe('trajectoireDeLaPartie', () => {
  /** Un salon sur cette carte, de cette duree. */
  const salon = (carte: 'station' | 'map1', dureePartieS = 180): InfosSalon => ({
    idRoom: 'room-1',
    statut: 'enCours',
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [],
    reglages: completerReglages({ carte, dureePartieS }),
  });

  /** L'etat d'un client en partie, avec ce salon et cette graine du decor. */
  const etat = (infos: InfosSalon | undefined, graineDuDecor: number | undefined): EtatClient => ({
    ...ETAT_INITIAL,
    ecran: 'jeu',
    salon: infos,
    graineDuDecor,
  });

  it('tire la course de la partie sur la Station lunaire', () => {
    const trajectoire = trajectoireDeLaPartie(etat(salon('station'), 99), undefined);

    expect(trajectoire?.cle).toEqual({ graine: 99, carte: STATION, dureeMs: 180_000 });
  });

  it('ne tire rien sur une carte sans vaisseau, ni sans graine, ni sans salon', () => {
    expect(trajectoireDeLaPartie(etat(salon('map1'), 99), undefined)).toBeUndefined();
    expect(trajectoireDeLaPartie(etat(salon('station'), undefined), undefined)).toBeUndefined();
    expect(trajectoireDeLaPartie(etat(undefined, 99), undefined)).toBeUndefined();
  });

  it('rend la course deja tiree tant que la partie est la meme, et en tire une autre sinon', () => {
    const premiere = trajectoireDeLaPartie(etat(salon('station'), 99), undefined);

    expect(trajectoireDeLaPartie(etat(salon('station'), 99), premiere)).toBe(premiere);
    expect(trajectoireDeLaPartie(etat(salon('station'), 100), premiere)).not.toBe(premiere);
    expect(trajectoireDeLaPartie(etat(salon('station', 60), 99), premiere)?.cle.dureeMs).toBe(
      60_000,
    );
  });
});

describe('la place du vaisseau et de son ombre', () => {
  const camera = { x: 1000, y: 760, echelle: 1 };

  it('pose le vaisseau sur son point au sol quand la camera le regarde en face', () => {
    expect(placeAffichee({ x: 1000, y: 760 }, camera)).toEqual({
      x: 1000,
      y: 760,
      echelle: VAISSEAU.echelle * (1 + VAISSEAU.altitude),
    });
  });

  it('l ecarte du centre de la vue d une part de son ecart a la camera: il vole', () => {
    const place = placeAffichee({ x: 1400, y: 560 }, camera);

    expect(place.x).toBeCloseTo(1400 + 400 * VAISSEAU.altitude, 6);
    expect(place.y).toBeCloseTo(560 - 200 * VAISSEAU.altitude, 6);
  });

  it('le fait glisser plus vite que le sol quand la camera bouge: la parallaxe', () => {
    const sol = { x: 1200, y: 700 };
    const avant = placeAffichee(sol, camera);
    const apres = placeAffichee(sol, { ...camera, x: camera.x + 100 });

    // La camera avance de 100: le sol recule de 100 a l'ecran, le vaisseau de plus.
    const reculALEcran = apres.x - (camera.x + 100) - (avant.x - camera.x);

    expect(reculALEcran).toBeCloseTo(-100 * (1 + VAISSEAU.altitude), 6);
  });

  it('pose l ombre au sol, poussee par le soleil, et retourne le soleil en miroir', () => {
    const sol = { x: 500, y: 600 };

    expect(placeDeLOmbre(sol, false)).toEqual({
      x: 500 + VAISSEAU.soleil.x,
      y: 600 + VAISSEAU.soleil.y,
    });
    expect(placeDeLOmbre(sol, true)).toEqual({
      x: 500 - VAISSEAU.soleil.x,
      y: 600 + VAISSEAU.soleil.y,
    });
  });

  it('tourne l image, dont l avant regarde vers le bas, dans le sens de sa course', () => {
    expect(rotationDuSprite(Math.PI / 2)).toBe(0);
    expect(rotationDuSprite(-Math.PI / 2)).toBeCloseTo(-Math.PI, 10);
    expect(rotationDuSprite(0)).toBeCloseTo(-Math.PI / 2, 10);
  });
});

describe('opaciteDuVaisseau', () => {
  const place = { x: 1000, y: 700 };

  it('le laisse opaque sans ninja a nous, et loin de notre ninja', () => {
    expect(opaciteDuVaisseau(place, undefined)).toBe(1);
    expect(opaciteDuVaisseau(place, { x: 1000 + VAISSEAU.rayonDEffacementPx, y: 700 })).toBe(1);
  });

  it('l efface au-dessus de notre ninja, pour qu on ne s y perde jamais', () => {
    expect(opaciteDuVaisseau(place, place)).toBe(VAISSEAU.opaciteAuDessusDeNous);
  });

  it('passe de l un a l autre sans sauter, au bord', () => {
    const bord = VAISSEAU.rayonDEffacementPx - VAISSEAU.fonduPx / 2;
    const milieu = opaciteDuVaisseau(place, { x: 1000, y: 700 + bord });

    expect(milieu).toBeCloseTo((1 + VAISSEAU.opaciteAuDessusDeNous) / 2, 6);
  });
});
