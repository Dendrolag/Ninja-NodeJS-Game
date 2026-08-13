/**
 * Le moteur: une fonction qui fait avancer une partie d'un battement.
 *
 *     const suivant = tick(etat, entrees, dt);
 *
 * Trois regles gouvernent ce fichier, et elles ne se negocient pas:
 *
 *   1. Rien n'est modifie sur place. tick renvoie un nouvel etat.
 *   2. Le temps arrive par dt, en millisecondes. Le moteur ne lit jamais
 *      l'horloge. Il n'y a donc aucune cadence implicite: appeler le moteur
 *      vingt fois avec dt de 50, ou une fois avec dt de 1000, produit le meme
 *      deplacement.
 *   3. Le hasard passe par le generateur a graine transporte dans l'etat.
 *
 * La consequence la plus visible est que la vitesse ne depend plus du debit de
 * messages du client, ce qui etait la faille S2 de l'audit: dans le legacy, un
 * client qui envoyait ses deplacements deux fois plus vite se deplacait deux
 * fois plus vite. Ici, le deplacement est proportionnel au temps ecoule.
 *
 * Perimetre de cette etape: appliquer les entrees de deplacement et faire
 * avancer le temps. Les collisions arrivent a l'etape 1.2, les captures a la
 * 1.3, les bonus et malus a la 1.4, les bots a la 1.5. Le moteur les accueillera
 * en systemes appeles dans ce meme tick.
 */

import type { Vecteur } from '@neon-ninja/shared';
import { VITESSES } from '@neon-ninja/shared';

import { aLaLongueur, directionDuVecteur, norme } from './direction.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { COMPTEUR_CAPTURE_PRET } from './etat.js';

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
 * @returns Le nouvel etat. L'etat recu est renvoye tel quel si la partie est
 *          deja terminee: le legacy sortait de meme des que isGameOver etait
 *          vrai.
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

  return {
    ...etat,
    tick: etat.tick + 1,
    tempsEcouleMs: etat.tempsEcouleMs + dtMs,
    joueurs,
  };
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

/** Applique a un joueur son entree et l'ecoulement du temps. */
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
  };
}

/**
 * Deplace un joueur selon son entree.
 *
 * Le vecteur recu est ramene a la distance parcourue pendant dt, puis la
 * position est bornee a la carte. Le legacy bornait de la meme facon, sur le
 * centre de l'entite (server.js:2665). Les murs arrivent a l'etape 1.2.
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

  const distance = (VITESSES.JOUEUR_PX_PAR_SECONDE * dtMs) / 1000;
  const pas = aLaLongueur(entree.deplacement, distance);

  const position = {
    x: borner(joueur.position.x + pas.x, 0, etat.carte.largeur),
    y: borner(joueur.position.y + pas.y, 0, etat.carte.hauteur),
  };

  const effectif = { x: position.x - joueur.position.x, y: position.y - joueur.position.y };

  return { ...joueur, position, direction: directionDuVecteur(effectif) };
}

/** Ramene une valeur entre deux bornes. */
function borner(valeur: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, valeur));
}
