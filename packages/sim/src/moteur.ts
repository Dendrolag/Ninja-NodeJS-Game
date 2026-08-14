/**
 * Le moteur: une fonction qui fait avancer une partie d'un battement.
 *
 *     const suivant = tick(etat, entrees, dt);
 *
 * Trois regles gouvernent ce fichier, et elles ne se negocient pas:
 *
 *   1. Rien n'est modifie sur place. tick renvoie un nouvel etat.
 *   2. Le temps arrive par dt, en millisecondes. Le moteur ne lit jamais
 *      l'horloge. Il n'y a donc aucune cadence implicite: en terrain degage,
 *      appeler le moteur vingt fois avec dt de 50, ou une fois avec dt de 1000,
 *      produit le meme deplacement. Pres d'un mur, en revanche, un pas de temps
 *      fin approche davantage du mur qu'un pas grossier: un deplacement bloque
 *      n'a pas lieu du tout, et plus le pas est grand, plus tot il est refuse.
 *      C'est la contrepartie normale d'un monde solide.
 *   3. Le hasard passe par le generateur a graine transporte dans l'etat.
 *
 * La consequence la plus visible est que la vitesse ne depend plus du debit de
 * messages du client, ce qui etait la faille S2 de l'audit: dans le legacy, un
 * client qui envoyait ses deplacements deux fois plus vite se deplacait deux
 * fois plus vite. Ici, le deplacement est proportionnel au temps ecoule.
 *
 * Un battement se deroule dans cet ordre:
 *
 *   1. le journal du battement precedent est efface;
 *   2. chaque joueur applique son entree et se deplace contre le terrain, puis
 *      voit ses protections et ses effets se rapprocher de leur fin;
 *   3. les bots errent, les bots noirs chassent, et de nouveaux bots noirs
 *      entrent en jeu quand leur heure est venue;
 *   4. les zones speciales vieillissent, apparaissent, et agissent sur les bots;
 *   5. les bonus et malus poses vieillissent, et de nouveaux apparaissent;
 *   6. on releve les contacts entre entites et on en tire les consequences,
 *      captures comprises;
 *   7. les joueurs ramassent les objets sur lesquels ils se trouvent.
 *
 * Les bots avancent avant les zones parce que c'est l'ordre du legacy: sa boucle
 * appelait updateBots puis sendUpdates, et c'est cette derniere qui appliquait
 * les effets de zone (server.js:2799).
 *
 * L'ordre des deux dernieres etapes est celui du legacy lui aussi: dans
 * detectCollisions, un joueur resolvait ses captures avant de ramasser ce qui
 * trainait a ses pieds. Un bonus d'invincibilite ramasse ne protege donc qu'a
 * partir du battement suivant.
 */

import type { Vecteur } from '@neon-ninja/shared';
import { VITESSES } from '@neon-ninja/shared';

import { avancerLesBots } from './bots.js';
import { detecterContacts, resoudreContacts } from './contacts.js';
import { resoudreDeplacement } from './deplacement.js';
import { aLaLongueur, directionDuVecteur, norme } from './direction.js';
import { fairePasserLeTemps } from './effets.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { COMPTEUR_CAPTURE_PRET, bonusActif, malusActif } from './etat.js';
import {
  faireApparaitreLesObjets,
  fairePasserLeTempsSurLesObjets,
  ramasserLesObjets,
} from './objets.js';
import { appliquerLesEffetsDeZone, avancerLesZones } from './zones.js';

/** Ce qu'un joueur demande au moteur pendant un battement. */
export interface EntreeJoueur {
  /**
   * Direction souhaitee. Seule son orientation compte: le moteur la ramene a la
   * vitesse du joueur. Un client ne decide donc pas de sa propre vitesse.
   */
  readonly deplacement: Vecteur;
  /** Faux quand le joueur relache ses touches: il s'arrete et regarde devant lui. */
  readonly enMouvement: boolean;
}

/** Les entrees de tous les joueurs pour un battement, indexees par identifiant. */
export type Entrees = Readonly<Record<IdentifiantEntite, EntreeJoueur>>;

/** Verdict sur la fin d'une partie, sans aucune action declenchee. */
export interface EvaluationFinDePartie {
  readonly terminee: boolean;
  /** Temps restant avant la fin, en millisecondes. Jamais negatif. */
  readonly tempsRestantMs: number;
}

/**
 * Fait avancer la partie d'un battement.
 *
 * @param etat Etat courant. Il n'est pas modifie.
 * @param entrees Ce que les joueurs demandent. Un joueur absent de cette table
 *                ne bouge pas.
 * @param dtMs Temps ecoule depuis le battement precedent, en millisecondes.
 * @returns Le nouvel etat. Son journal d'evenements ne contient que ce qui vient
 *          de se produire pendant ce battement. L'etat recu est renvoye tel quel
 *          si la partie est deja terminee, journal compris: le legacy sortait de
 *          meme des que isGameOver etait vrai.
 */
export function tick(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  if (!Number.isFinite(dtMs) || dtMs < 0) {
    throw new Error(`Le temps ecoule doit etre un nombre positif, recu ${dtMs}.`);
  }

  if (evaluerFinDePartie(etat).terminee) {
    return etat;
  }

  const joueurs: Record<IdentifiantEntite, Joueur> = {};
  for (const [id, joueur] of Object.entries(etat.joueurs)) {
    joueurs[id] = avancerJoueur(etat, joueur, entrees[id], dtMs);
  }

  // Le journal repart vide: il decrit ce battement-ci, pas l'histoire de la
  // partie. Celle-ci se lit dans les compteurs des joueurs.
  const deplace: EtatPartie = {
    ...etat,
    tick: etat.tick + 1,
    tempsEcouleMs: etat.tempsEcouleMs + dtMs,
    joueurs,
    evenements: [],
  };

  const bots = avancerLesBots(deplace, dtMs);
  const zones = appliquerLesEffetsDeZone(avancerLesZones(bots, dtMs), dtMs);
  const objets = faireApparaitreLesObjets(fairePasserLeTempsSurLesObjets(zones, dtMs), dtMs);
  const contacts = resoudreContacts(objets, detecterContacts(objets));

  return ramasserLesObjets(contacts);
}

/**
 * Dit si la partie est finie, et depuis combien de temps il lui restait.
 *
 * Portage de calculateTimeLeft (legacy/server.js:1537). C'est une lecture, pas
 * une action: le moteur ne termine rien de lui-meme. Declarer la fin, prevenir
 * les joueurs et arreter la boucle appartiennent au serveur (etape 2.1).
 */
export function evaluerFinDePartie(etat: EtatPartie): EvaluationFinDePartie {
  const restant = etat.dureeMs - etat.tempsEcouleMs;

  return { terminee: restant <= 0, tempsRestantMs: Math.max(restant, 0) };
}

/**
 * Applique a un joueur son entree et l'ecoulement du temps.
 *
 * Le deplacement se calcule avec les effets tels qu'ils sont au debut du
 * battement, et c'est seulement ensuite que le temps les rapproche de leur fin:
 * un bonus de vitesse dont il reste dix millisecondes vaut encore pour ce
 * battement-ci. C'est deja le traitement reserve a la protection d'apparition.
 */
function avancerJoueur(
  etat: EtatPartie,
  joueur: Joueur,
  entree: EntreeJoueur | undefined,
  dtMs: number,
): Joueur {
  const deplace = deplacerJoueur(etat, joueur, entree, dtMs);

  return {
    ...deplace,
    protectionSpawnRestanteMs: Math.max(joueur.protectionSpawnRestanteMs - dtMs, 0),
    tempsDepuisDerniereCaptureMs: Math.min(
      joueur.tempsDepuisDerniereCaptureMs + dtMs,
      COMPTEUR_CAPTURE_PRET,
    ),
    bonusRestantsMs: fairePasserLeTemps(joueur.bonusRestantsMs, dtMs),
    malusRestantsMs: fairePasserLeTemps(joueur.malusRestantsMs, dtMs),
  };
}

/**
 * Deplace un joueur selon son entree, contre le terrain.
 *
 * Le vecteur recu est ramene a la distance parcourue pendant dt, puis confie a
 * la resolution du deplacement, qui longe les murs et tente de les contourner.
 *
 * Le bornage explicite a la carte du legacy (server.js:2665) n'est plus utile:
 * hors de la carte, tout est mur, donc aucun deplacement ne peut en sortir. La
 * consequence visible est que le joueur s'arrete a son rayon du bord, et non le
 * centre colle au bord. C'est deja ce que le legacy faisait reellement, son
 * bornage n'ayant jamais rien eu a corriger.
 *
 * La direction suit le deplacement effectivement realise: un joueur bloque
 * regarde devant lui, comme dans le legacy.
 */
function deplacerJoueur(
  etat: EtatPartie,
  joueur: Joueur,
  entree: EntreeJoueur | undefined,
  dtMs: number,
): Joueur {
  if (entree === undefined || !entree.enMouvement || norme(entree.deplacement) === 0) {
    return { ...joueur, direction: 'immobile' };
  }

  const distance = (VITESSES.JOUEUR_PX_PAR_SECONDE * multiplicateurDeVitesse(joueur) * dtMs) / 1000;
  const pas = aLaLongueur(voulu(joueur, entree.deplacement), distance);
  const position = resoudreDeplacement(etat.terrain, joueur.position, pas);

  const effectif = { x: position.x - joueur.position.x, y: position.y - joueur.position.y };

  return { ...joueur, position, direction: directionDuVecteur(effectif) };
}

/**
 * De combien la vitesse d'un joueur est multipliee par ses effets.
 *
 * Portage du calcul du gestionnaire move (legacy/server.js:2616), moins ce qui en
 * faisait une faille: le legacy croyait sur parole le client qui annoncait son
 * bonus de vitesse, et lui accordait en plus un facteur deux s'il se declarait
 * sur mobile (faille S2). Ici le bonus est celui que le moteur a lui-meme
 * accorde, et il n'existe aucun facteur mobile: la vitesse ne depend plus de
 * l'appareil ni de ce que le client raconte.
 *
 * Le plafond du legacy est conserve bien qu'il ne serve pas encore: aucun cumul
 * ne peut aujourd'hui depasser 1,7.
 */
function multiplicateurDeVitesse(joueur: Joueur): number {
  const multiplicateur = bonusActif(joueur, 'vitesse') ? VITESSES.MULTIPLICATEUR_BONUS : 1;

  return Math.min(multiplicateur, VITESSES.MULTIPLICATEUR_MAXIMUM);
}

/**
 * Le deplacement reellement voulu, une fois les commandes inversees prises en
 * compte.
 *
 * Dans le legacy, c'est le client qui inversait ses propres commandes avant
 * d'envoyer son deplacement. Un client modifie n'avait donc qu'a ne pas le faire
 * pour ignorer le malus. Le moteur s'en charge maintenant: le client envoie la
 * direction demandee par le joueur, telle quelle, et le moteur applique l'effet.
 *
 * A retenir pour l'etape 4.1: le client ne doit surtout pas inverser de son cote,
 * sous peine d'annuler le malus en le doublant.
 */
function voulu(joueur: Joueur, deplacement: Vecteur): Vecteur {
  return malusActif(joueur, 'controlesInverses')
    ? { x: -deplacement.x, y: -deplacement.y }
    : deplacement;
}
