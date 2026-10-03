/**
 * Le vaisseau qui survole la Station lunaire (etape 8.9), et son ombre.
 *
 * FONCTIONS PURES. La boucle tire la course du vaisseau une fois par partie, et la lit a
 * chaque image; le rendu place le sprite et son ombre avec ce qu'elles rendent. Rien ici ne
 * connait PixiJS, ni l'horloge: le temps est celui de la partie, recu du serveur.
 *
 * LE MEME VAISSEAU POUR TOUS LES JOUEURS. Il passe au-dessus des ninjas et peut en cacher:
 * deux joueurs de la meme partie doivent le voir au meme endroit. Sa course se tire donc de
 * la graine du decor, que le serveur donne a chaque lancement (LancementDePartie), et sa
 * position se lit au temps ecoule de la partie, que chaque battement porte. Un joueur qui
 * entre en cours de partie le trouve ou les autres le voient; en pause, il s'arrete avec le
 * temps. Une autre partie, une autre graine: un autre chemin.
 *
 * TROIS TEMPS. L'arrivee: il entre par un point tire au hasard autour de la carte, hors de
 * vue, et ralentit jusqu'au premier point de son survol. Le survol: il passe lentement d'un
 * point a l'autre, tires au hasard au-dessus de la station, sur une courbe sans angle, a
 * vitesse constante. Le depart: a la fin de la partie, il accelere et sort par un autre cote.
 * La vitesse ne saute jamais d'un temps a l'autre.
 *
 * IL REGARDE LA OU IL VA. L'image livree le montre l'arriere en haut et l'avant en bas: son
 * cap est la direction de sa course, et le sprite tourne d'un quart de tour de moins.
 *
 * L'ALTITUDE SE VOIT PAR LA PARALLAXE. Ce qui est plus pres de l'oeil s'ecarte davantage du
 * centre de la vue: le vaisseau se dessine ecarte de son point au sol d'une part de son
 * ecart a la camera, et grandi d'autant. Son ombre reste au sol, poussee par le soleil.
 * Quand la camera bouge, les deux se separent ou se rapprochent: c'est la profondeur.
 */

import type { Alea, DimensionsCarte, Position } from '@neon-ninja/shared';
import { CARTES, cheminVaisseau, creerAlea, entier, reel } from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';
import { VAISSEAU } from './apparence.js';
import type { Camera } from './camera.js';

/** Les reglages dont la course et la place du vaisseau dependent (VAISSEAU, apparence.ts). */
export interface ReglageDuVaisseau {
  readonly echelle: number;
  readonly altitude: number;
  readonly vitesseDeSurvolPxParS: number;
  readonly dureeDeManoeuvreMs: number;
  readonly partMaximaleDeManoeuvre: number;
  readonly margeHorsCartePx: number;
  readonly zoneDeSurvol: { readonly minimum: number; readonly maximum: number };
  readonly ecartMinimumPx: number;
  readonly finesseDeLaCourbe: number;
  readonly soleil: Position;
  readonly opaciteAuDessusDeNous: number;
  readonly rayonDEffacementPx: number;
  readonly fonduPx: number;
}

/** Ce qui decide d'une course: deux parties de memes cles ont le meme vaisseau. */
export interface CleDeTrajectoire {
  readonly graine: number;
  readonly carte: DimensionsCarte;
  readonly dureeMs: number;
}

/** La course du vaisseau sur toute une partie, tiree une fois. */
export interface Trajectoire {
  readonly cle: CleDeTrajectoire;
  /** La courbe, point par point, de l'entree a la sortie. */
  readonly points: readonly Position[];
  /** La longueur parcourue en arrivant a chaque point. */
  readonly longueurs: readonly number[];
  /** La longueur parcourue a la fin de l'arrivee: le premier point de passage. */
  readonly finDeLArrivee: number;
  /** La longueur parcourue au debut du depart: le dernier point de passage. */
  readonly debutDuDepart: number;
  /** La duree de l'arrivee, et celle du depart. */
  readonly dureeDeManoeuvreMs: number;
}

/** Le vaisseau a un instant: son point au sol, et son cap, en radians. L'axe des y descend. */
export interface EtatDuVaisseau {
  readonly x: number;
  readonly y: number;
  readonly cap: number;
}

/** Ou et comment dessiner le vaisseau, altitude comprise. */
export interface PlaceAffichee {
  readonly x: number;
  readonly y: number;
  /** L'echelle du sprite, par rapport a l'image livree. */
  readonly echelle: number;
}

/** De part et d'autre d'un point de la courbe, ou lire le cap. */
const DEMI_PORTEE_DU_CAP_PX = 12;

/** Combien de tirages au plus pour trouver un point de passage assez loin du precedent. */
const ESSAIS_PAR_POINT = 8;

/** Combien de points de passage au plus, quelle que soit la duree. */
const POINTS_DE_PASSAGE_MAXIMUM = 200;

/**
 * Tire la course du vaisseau pour une partie.
 *
 * @param graine  La graine du decor de la partie.
 * @param carte   Les dimensions de la carte survolee.
 * @param dureeMs La duree de la partie: le vaisseau arrive a son debut et repart a sa fin.
 */
export function creerTrajectoire(
  graine: number,
  carte: DimensionsCarte,
  dureeMs: number,
  reglage: ReglageDuVaisseau = VAISSEAU,
): Trajectoire {
  let alea: Alea = creerAlea(graine);
  const tirer = (minimum: number, maximum: number): number => {
    const tirage = reel(alea, minimum, maximum);
    alea = tirage.alea;
    return tirage.valeur;
  };
  const tirerEntier = (borne: number): number => {
    const tirage = entier(alea, borne);
    alea = tirage.alea;
    return tirage.valeur;
  };

  const duree = Math.max(dureeMs, 0);
  const manoeuvre = Math.min(reglage.dureeDeManoeuvreMs, duree * reglage.partMaximaleDeManoeuvre);
  const survolPx = (reglage.vitesseDeSurvolPxParS * (duree - 2 * manoeuvre)) / 1000;

  const coteDEntree = tirerEntier(4);
  const entree = pointDuPourtour(coteDEntree, tirer(0.1, 0.9), carte, reglage.margeHorsCartePx);

  const { minimum, maximum } = reglage.zoneDeSurvol;
  const passages: Position[] = [];
  let parcouru = 0;

  do {
    const precedent = passages.at(-1);
    let point = { x: 0, y: 0 };

    for (let essai = 0; essai < ESSAIS_PAR_POINT; essai += 1) {
      point = {
        x: tirer(minimum, maximum) * carte.largeur,
        y: tirer(minimum, maximum) * carte.hauteur,
      };

      if (precedent === undefined || distance(precedent, point) >= reglage.ecartMinimumPx) {
        break;
      }
    }

    parcouru += precedent === undefined ? 0 : distance(precedent, point);
    passages.push(point);
  } while (parcouru < survolPx && passages.length < POINTS_DE_PASSAGE_MAXIMUM);

  // Il repart par un autre cote que celui par ou il est venu.
  const coteDeSortie = (coteDEntree + 1 + tirerEntier(3)) % 4;
  const sortie = pointDuPourtour(coteDeSortie, tirer(0.1, 0.9), carte, reglage.margeHorsCartePx);

  const appuis = [entree, ...passages, sortie];
  const { points, rangs } = courbe(appuis, reglage.finesseDeLaCourbe);
  const longueurs = longueursCumulees(points);

  return {
    cle: { graine, carte, dureeMs },
    points,
    longueurs,
    finDeLArrivee: longueurs[rangs[1] ?? 0] ?? 0,
    debutDuDepart: longueurs[rangs[appuis.length - 2] ?? 0] ?? 0,
    dureeDeManoeuvreMs: manoeuvre,
  };
}

/**
 * Le vaisseau a cet instant de la partie: avant son debut, il attend hors de la carte; a sa
 * fin, il en est sorti.
 *
 * @param ecouleMs Le temps de jeu ecoule depuis le debut de la partie.
 */
export function etatDuVaisseau(trajectoire: Trajectoire, ecouleMs: number): EtatDuVaisseau {
  const parcouru = parcouruA(trajectoire, ecouleMs);
  const ici = pointALongueur(trajectoire, parcouru);
  const avant = pointALongueur(trajectoire, parcouru - DEMI_PORTEE_DU_CAP_PX);
  const apres = pointALongueur(trajectoire, parcouru + DEMI_PORTEE_DU_CAP_PX);

  return { x: ici.x, y: ici.y, cap: Math.atan2(apres.y - avant.y, apres.x - avant.x) };
}

/**
 * La longueur parcourue a cet instant.
 *
 * L'arrivee ralentit, le depart accelere, chacun sur une parabole du temps qui raccorde sa
 * vitesse a celle du survol: le vaisseau ne saute jamais d'une allure a l'autre. Si la
 * manoeuvre est trop courte pour cela, elle se fait a vitesse constante.
 */
export function parcouruA(trajectoire: Trajectoire, ecouleMs: number): number {
  const { longueurs, finDeLArrivee, debutDuDepart, dureeDeManoeuvreMs: manoeuvre } = trajectoire;
  const dureeMs = trajectoire.cle.dureeMs;
  const total = longueurs.at(-1) ?? 0;

  if (ecouleMs <= 0 || manoeuvre <= 0) {
    return ecouleMs >= dureeMs ? total : 0;
  }

  if (ecouleMs >= dureeMs) {
    return total;
  }

  const survolMs = dureeMs - 2 * manoeuvre;
  const vitesse = survolMs > 0 ? (debutDuDepart - finDeLArrivee) / survolMs : 0;
  // Ce que le survol parcourrait pendant une manoeuvre: la vitesse a raccorder.
  const raccord = vitesse * manoeuvre;

  if (ecouleMs < manoeuvre) {
    const u = ecouleMs / manoeuvre;
    const a = raccord - finDeLArrivee;
    const b = 2 * finDeLArrivee - raccord;

    return b >= 0 ? a * u * u + b * u : finDeLArrivee * u;
  }

  if (ecouleMs > dureeMs - manoeuvre) {
    const u = (ecouleMs - (dureeMs - manoeuvre)) / manoeuvre;
    const depart = total - debutDuDepart;
    const a = depart - raccord;

    return debutDuDepart + (2 * a + raccord >= 0 ? a * u * u + raccord * u : depart * u);
  }

  return finDeLArrivee + (ecouleMs - manoeuvre) * vitesse;
}

/** Le temps de jeu ecoule, d'apres la duree de la partie et le temps qu'il lui reste. */
export function ecouleDansLaPartie(dureeMs: number, tempsRestantMs: number): number {
  return Math.min(Math.max(dureeMs - tempsRestantMs, 0), dureeMs);
}

/**
 * La course du vaisseau de la partie en cours, ou rien sur une carte sans vaisseau.
 *
 * Tiree une fois: tant que la graine, la carte et la duree ne changent pas, la course deja
 * tiree est rendue telle quelle, sans rien recalculer.
 */
export function trajectoireDeLaPartie(
  etat: EtatClient,
  precedente: Trajectoire | undefined,
  reglage: ReglageDuVaisseau = VAISSEAU,
): Trajectoire | undefined {
  const reglages = etat.salon?.reglages;
  const graine = etat.graineDuDecor;

  if (
    reglages === undefined ||
    graine === undefined ||
    cheminVaisseau(reglages.carte) === undefined
  ) {
    return undefined;
  }

  const carte = CARTES[reglages.carte];
  const dureeMs = reglages.dureePartieS * 1000;
  const cle = precedente?.cle;

  if (cle?.graine === graine && cle.carte === carte && cle.dureeMs === dureeMs) {
    return precedente;
  }

  return creerTrajectoire(graine, carte, dureeMs, reglage);
}

/**
 * Ou dessiner le vaisseau, vu par cette camera: ecarte de son point au sol d'une part de
 * son ecart au centre de la vue, et grandi d'autant.
 */
export function placeAffichee(
  sol: Position,
  camera: Camera,
  reglage: ReglageDuVaisseau = VAISSEAU,
): PlaceAffichee {
  return {
    x: sol.x + (sol.x - camera.x) * reglage.altitude,
    y: sol.y + (sol.y - camera.y) * reglage.altitude,
    echelle: reglage.echelle * (1 + reglage.altitude),
  };
}

/**
 * Ou poser l'ombre du vaisseau: au sol, poussee par le soleil. En miroir, le decor est
 * retourne, et son soleil avec lui.
 */
export function placeDeLOmbre(
  sol: Position,
  modeMiroir: boolean,
  reglage: ReglageDuVaisseau = VAISSEAU,
): Position {
  return { x: sol.x + (modeMiroir ? -1 : 1) * reglage.soleil.x, y: sol.y + reglage.soleil.y };
}

/** La rotation du sprite pour ce cap: l'avant de l'image regarde vers le bas. */
export function rotationDuSprite(cap: number): number {
  return cap - Math.PI / 2;
}

/**
 * L'opacite du vaisseau: il s'efface quand il passe au-dessus de notre ninja, pour qu'on ne
 * s'y perde jamais, et reste opaque ailleurs. Sans ninja a nous, il reste opaque.
 *
 * @param place Ou le vaisseau se dessine, altitude comprise: c'est la qu'il cache.
 * @param moi   Notre ninja, s'il est dans la partie.
 */
export function opaciteDuVaisseau(
  place: Position,
  moi: Position | undefined,
  reglage: ReglageDuVaisseau = VAISSEAU,
): number {
  if (moi === undefined) {
    return 1;
  }

  const ecart = distance(place, moi);
  const debutDuFondu = reglage.rayonDEffacementPx - reglage.fonduPx;

  if (ecart <= debutDuFondu) {
    return reglage.opaciteAuDessusDeNous;
  }

  if (ecart >= reglage.rayonDEffacementPx) {
    return 1;
  }

  const part = (ecart - debutDuFondu) / reglage.fonduPx;

  return reglage.opaciteAuDessusDeNous + (1 - reglage.opaciteAuDessusDeNous) * part;
}

/**
 * Un point hors de la carte, sur l'un de ses quatre cotes: 0 en haut, 1 a droite, 2 en bas,
 * 3 a gauche, a cette part de sa longueur.
 */
function pointDuPourtour(
  cote: number,
  part: number,
  carte: DimensionsCarte,
  marge: number,
): Position {
  switch (cote) {
    case 0:
      return { x: part * carte.largeur, y: -marge };
    case 1:
      return { x: carte.largeur + marge, y: part * carte.hauteur };
    case 2:
      return { x: part * carte.largeur, y: carte.hauteur + marge };
    default:
      return { x: -marge, y: part * carte.hauteur };
  }
}

/**
 * La courbe qui passe par ces appuis, sans angle: une spline de Catmull-Rom centripete,
 * qui ne fait ni boucle ni pointe meme quand les appuis sont inegalement espaces. Rend ses
 * points, et le rang de chaque appui parmi eux.
 */
function courbe(
  appuis: readonly Position[],
  finesse: number,
): { readonly points: readonly Position[]; readonly rangs: readonly number[] } {
  const premier = appuis[0] ?? { x: 0, y: 0 };
  const dernier = appuis.at(-1) ?? premier;
  // Deux appuis fantomes prolongent la course au-dela de ses bouts, pour la tangente.
  const avant = prolonger(premier, appuis[1] ?? premier);
  const apres = prolonger(dernier, appuis.at(-2) ?? dernier);
  const tous = [avant, ...appuis, apres];
  const points: Position[] = [premier];
  const rangs: number[] = [0];

  for (let segment = 1; segment < tous.length - 2; segment += 1) {
    const [p0, p1, p2, p3] = [
      tous[segment - 1],
      tous[segment],
      tous[segment + 1],
      tous[segment + 2],
    ];

    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) {
      continue;
    }

    for (let pas = 1; pas <= finesse; pas += 1) {
      points.push(catmullRom(p0, p1, p2, p3, pas / finesse));
    }

    rangs.push(points.length - 1);
  }

  return { points, rangs };
}

/** Le symetrique de ce voisin par rapport a ce point. */
function prolonger(point: Position, voisin: Position): Position {
  return { x: 2 * point.x - voisin.x, y: 2 * point.y - voisin.y };
}

/** Un point du segment de p1 a p2, a la part t, sur la spline centripete. */
function catmullRom(p0: Position, p1: Position, p2: Position, p3: Position, t: number): Position {
  const t0 = 0;
  const t1 = t0 + noeud(p0, p1);
  const t2 = t1 + noeud(p1, p2);
  const t3 = t2 + noeud(p2, p3);
  const u = t1 + (t2 - t1) * t;

  const a1 = melange(p0, p1, t0, t1, u);
  const a2 = melange(p1, p2, t1, t2, u);
  const a3 = melange(p2, p3, t2, t3, u);
  const b1 = melange(a1, a2, t0, t2, u);
  const b2 = melange(a2, a3, t1, t3, u);

  return melange(b1, b2, t1, t2, u);
}

/** L'ecart de parametre entre deux appuis: la racine de leur distance, jamais nul. */
function noeud(a: Position, b: Position): number {
  return Math.max(Math.sqrt(distance(a, b)), 1e-6);
}

/** Le point entre a, au parametre ta, et b, au parametre tb, au parametre u. */
function melange(a: Position, b: Position, ta: number, tb: number, u: number): Position {
  const part = (u - ta) / (tb - ta);

  return { x: a.x + (b.x - a.x) * part, y: a.y + (b.y - a.y) * part };
}

/** La longueur parcourue en arrivant a chaque point de la courbe. */
function longueursCumulees(points: readonly Position[]): readonly number[] {
  const longueurs: number[] = [];
  let total = 0;

  points.forEach((point, rang) => {
    const precedent = points[rang - 1];
    total += precedent === undefined ? 0 : distance(precedent, point);
    longueurs.push(total);
  });

  return longueurs;
}

/** Le point de la courbe a cette longueur parcourue, bornee a ses deux bouts. */
function pointALongueur(trajectoire: Trajectoire, longueur: number): Position {
  const { points, longueurs } = trajectoire;
  const premier = points[0] ?? { x: 0, y: 0 };
  const total = longueurs.at(-1) ?? 0;

  if (longueur <= 0 || points.length < 2) {
    return premier;
  }

  if (longueur >= total) {
    return points.at(-1) ?? premier;
  }

  // Le premier point dont la longueur atteint celle cherchee, par dichotomie.
  let bas = 1;
  let haut = longueurs.length - 1;

  while (bas < haut) {
    const milieu = (bas + haut) >> 1;

    if ((longueurs[milieu] ?? 0) < longueur) {
      bas = milieu + 1;
    } else {
      haut = milieu;
    }
  }

  const debut = points[bas - 1] ?? premier;
  const fin = points[bas] ?? debut;
  const avant = longueurs[bas - 1] ?? 0;
  const troncon = (longueurs[bas] ?? avant) - avant;
  const part = troncon > 0 ? (longueur - avant) / troncon : 0;

  return { x: debut.x + (fin.x - debut.x) * part, y: debut.y + (fin.y - debut.y) * part };
}

/** La distance entre deux points. */
function distance(a: Position, b: Position): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
