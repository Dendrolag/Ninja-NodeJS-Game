/**
 * La limitation de debit: combien de messages un joueur a le droit d'envoyer.
 *
 * POURQUOI CECI EXISTE. Le legacy n'avait aucune limite, sur aucun evenement.
 * Deux consequences, l'une sur le jeu, l'autre sur le serveur.
 *
 * Sur le jeu, sa vitesse etait proportionnelle au debit du client: le
 * gestionnaire move deplacait le joueur a chaque message, si bien qu'emettre dix
 * fois plus vite revenait a courir dix fois plus vite (faille S2). Ce defaut-la
 * est deja mort, et pas par une limite de debit: le moteur avance
 * proportionnellement au temps ecoule, donc dix messages dans le meme battement
 * produisent le meme pas qu'un seul. La limite ne le rattrape pas, elle protege
 * autre chose.
 *
 * Sur le serveur, chaque message move declenchait un releve complet des
 * collisions, sur tous les joueurs et tous les bots. Un seul client bavard
 * saturait donc un coeur processeur et degradait la partie de tout le monde
 * (faille S4). C'est ce que ce fichier empeche.
 *
 * LE MODELE EST UN SEAU A JETONS. Un seau contient au plus « rafale » jetons et
 * se remplit continument de « parSeconde » jetons chaque seconde. Chaque message
 * consomme un jeton; un message qui se presente devant un seau vide est refuse.
 * Un seau tolere donc une bouffee courte apres un silence, ce qui arrive
 * normalement apres un a-coup de reseau, mais jamais un debit soutenu au-dessus
 * de la limite. Un compteur remis a zero toutes les secondes, plus simple en
 * apparence, refuserait le premier cas et laisserait passer le double du debit a
 * cheval sur deux fenetres.
 *
 * PURETE. Comme le moteur, ce fichier ne lit jamais l'horloge: le temps ecoule
 * lui est fourni. Un seau est une donnee, consommer rend un nouveau seau. La
 * couche reseau de l'etape 2.2 tiendra un seau par joueur et par type d'entree,
 * et lui passera le temps ecoule depuis le message precedent. Les tests, eux,
 * font passer les secondes qu'ils veulent, sans attendre.
 *
 * Les valeurs, elles, sont dans bornes.ts, avec toutes les autres limites du jeu.
 */

import type { LimiteDebit } from './bornes.js';

/** L'etat d'un seau a jetons. Une donnee, jamais modifiee sur place. */
export interface SeauAJetons {
  /** Jetons disponibles. Peut etre fractionnaire: le seau se remplit continument. */
  readonly jetons: number;
}

/** Ce que devient un seau apres qu'un message s'y est presente. */
export interface Consommation {
  /** Le message passe-t-il ? */
  readonly accepte: boolean;
  /** Le seau apres coup. Un refus ne consomme aucun jeton. */
  readonly seau: SeauAJetons;
}

/**
 * Un seau neuf, plein.
 *
 * Un joueur qui vient de se connecter dispose donc de toute sa rafale. C'est
 * voulu: le premier geste d'un client est souvent une salve, et le punir
 * donnerait l'impression d'un jeu qui ne repond pas.
 */
export function seauNeuf(limite: LimiteDebit): SeauAJetons {
  return { jetons: limite.rafale };
}

/**
 * Presente un message au seau, apres que dt millisecondes se sont ecoulees.
 *
 * Le remplissage est calcule d'abord, la consommation ensuite: un message qui
 * arrive apres une longue attente trouve donc le seau rempli. Le seau ne deborde
 * jamais au-dela de sa rafale, sans quoi une minute de silence autoriserait une
 * salve d'une minute entiere.
 *
 * @param seau Etat courant du seau.
 * @param limite Cadence autorisee pour ce type d'entree.
 * @param dtMs Temps ecoule depuis la derniere presentation, en millisecondes.
 */
export function consommer(seau: SeauAJetons, limite: LimiteDebit, dtMs: number): Consommation {
  if (!Number.isFinite(dtMs) || dtMs < 0) {
    throw new Error(`Le temps ecoule doit etre un nombre positif, recu ${dtMs}.`);
  }

  const remplis = Math.min(seau.jetons + (limite.parSeconde * dtMs) / 1000, limite.rafale);

  return remplis >= 1
    ? { accepte: true, seau: { jetons: remplis - 1 } }
    : { accepte: false, seau: { jetons: remplis } };
}
