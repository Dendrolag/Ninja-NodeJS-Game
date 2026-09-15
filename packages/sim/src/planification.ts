/**
 * Comment le moteur planifie ce qui doit arriver plus tard, sans minuterie.
 *
 * C'EST LE REMPLACANT DU DEFAUT X1 DE L'AUDIT. Le legacy planifiait l'apparition
 * des bonus, des malus et des zones par setTimeout, et ces minuteries se
 * replanifiaient elles-memes sans jamais etre annulees. Elles etaient demarrees
 * au lancement du serveur, puis a chaque debut de partie, puis a chaque remise a
 * zero: chaque partie ajoutait une chaine parallele qui ne s'arretait plus. Apres
 * cinq parties, les bonus apparaissaient environ cinq fois plus vite. C'est ce
 * qui donnait la sensation d'un jeu qui devient incoherent au fil des parties et
 * redevient normal apres un redemarrage du serveur.
 *
 * Ici il n'y a pas de minuterie a annuler: un compte a rebours vit dans l'etat,
 * le moteur le fait decroitre du temps ecoule, et l'echeance atteinte declenche
 * l'evenement puis rearme le compteur. Une nouvelle partie part d'un nouvel etat,
 * donc de compteurs neufs. Le defaut ne peut pas revenir.
 *
 * RATTRAPAGE. Si le temps ecoule depasse le compte a rebours de plusieurs
 * intervalles, toutes les echeances franchies se produisent, l'une apres l'autre.
 * Le nombre d'apparitions ne depend donc pas du decoupage du temps: appeler le
 * moteur vingt fois avec un dt de cinquante millisecondes ou une fois avec un dt
 * d'une seconde produit les memes apparitions. La boucle se termine toujours,
 * chaque tour ajoutant au moins une milliseconde au compte a rebours.
 */

import type { Alea, Tirage } from '@neon-ninja/shared';
import { OBJETS, reel } from '@neon-ninja/shared';

import type { EtatPartie, ProchainesApparitions } from './etat.js';

/** Duree minimale d'un intervalle, en millisecondes. Garde-fou contre un reglage a zero. */
const INTERVALLE_MINIMUM_MS = 1;

/**
 * Fait avancer un compte a rebours et declenche ce qu'il annonce.
 *
 * @param etat Etat courant.
 * @param dtMs Temps ecoule depuis le battement precedent.
 * @param compteur Lequel des comptes a rebours avancer.
 * @param tirerIntervalle Duree jusqu'a la prochaine echeance. Elle peut etre
 *                        tiree au sort, d'ou le generateur en parametre.
 * @param declencher Ce qui se produit a l'echeance. Peut ne rien faire, par
 *                   exemple quand le plafond d'objets simultanes est atteint:
 *                   le compteur se rearme quand meme, comme dans le legacy.
 */
export function avancerUneEcheance(
  etat: EtatPartie,
  dtMs: number,
  compteur: keyof ProchainesApparitions,
  tirerIntervalle: (alea: Alea) => Tirage<number>,
  declencher: (etat: EtatPartie) => EtatPartie,
): EtatPartie {
  let courant = etat;
  let restantMs = etat.prochainesApparitions[compteur] - dtMs;

  while (restantMs <= 0) {
    courant = declencher(courant);

    const tirage = tirerIntervalle(courant.alea);
    restantMs += Math.max(tirage.valeur, INTERVALLE_MINIMUM_MS);
    courant = { ...courant, alea: tirage.alea };
  }

  return {
    ...courant,
    prochainesApparitions: { ...courant.prochainesApparitions, [compteur]: restantMs },
  };
}

/**
 * Tire un intervalle d'apparition autour de sa valeur moyenne.
 *
 * Portage de la formule du legacy (server.js:1610 et :672): l'intervalle varie de
 * plus ou moins un quart autour de sa valeur reglee, pour que les apparitions ne
 * tombent pas toutes au meme rythme. Quatre secondes donnent donc un tirage entre
 * trois et cinq secondes.
 */
export function intervalleVariable(alea: Alea, intervalleS: number): Tirage<number> {
  const moyenneMs = intervalleS * 1000;
  const amplitudeMs = (moyenneMs * OBJETS.VARIATION_INTERVALLE) / 2;

  return reel(alea, moyenneMs - amplitudeMs, moyenneMs + amplitudeMs);
}

/** Un intervalle fixe, sans hasard: celui des zones speciales dans le legacy. */
export function intervalleFixe(alea: Alea, intervalleS: number): Tirage<number> {
  return { valeur: intervalleS * 1000, alea };
}
