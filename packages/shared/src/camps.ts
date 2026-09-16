/**
 * La place d'un joueur dans un mode qui se gagne par camp: les Equipes (etape 7.2) et la
 * Chasse (etape 7.3).
 *
 * Dans ces modes, le placement ne dit plus ce qu'un joueur devance: un vainqueur ne
 * devance pas les autres membres de son camp. Chaque joueur present recoit donc, en plus
 * de son placement, le devancement qui fait ses recompenses (progression.ts).
 *
 * CE FICHIER EST PUR: le serveur l'appelle pour le bilan, et chaque mode par camp pour sa
 * propre issue.
 */

import type { Devancement } from './progression.js';

/** La place d'un joueur present a la fin d'une partie qui se gagne par camp. */
export interface PlaceDansUnCamp {
  /** Ce que retiennent l'historique, l'ecran de fin et les victoires du profil. */
  readonly placement: number;
  /** Ce que valent ses recompenses: le placement ne le dit pas. */
  readonly devancement: Devancement;
}

/** Ce qu'il faut savoir pour placer un joueur present quand un camp a gagne. */
export interface IssueParCamp {
  /** Le joueur est-il dans le camp vainqueur. */
  readonly vainqueur: boolean;
  /** Combien de joueurs du camp vainqueur sont presents a la fin. */
  readonly vainqueursPresents: number;
  /** Tous les joueurs de la partie, abandons compris. */
  readonly nombreJoueurs: number;
  /** Tous les joueurs presents a la fin, des deux camps. */
  readonly presents: number;
}

/**
 * La place d'un joueur present quand un camp a gagne (decision 8 du porteur du projet pour
 * les Equipes, reprise pour la Chasse).
 *
 *   - Un vainqueur est place premier. Il devance tous les joueurs qui ne sont pas de son
 *     camp, abandons compris, et prend les points de ligue du premier.
 *   - Un perdant est place juste apres les vainqueurs presents. Il ne devance que les
 *     abandons, et prend les points de ligue du dernier.
 *
 * Les abandons, eux, restent comptes derniers, comme dans tout mode: ils ne passent pas
 * par cette fonction.
 */
export function placeDansUnCamp(issue: IssueParCamp): PlaceDansUnCamp {
  const abandons = Math.max(issue.nombreJoueurs - issue.presents, 0);

  return issue.vainqueur
    ? {
        placement: 1,
        devancement: {
          joueursDevances: issue.nombreJoueurs - issue.vainqueursPresents,
          partDevancee: 1,
        },
      }
    : {
        placement: issue.vainqueursPresents + 1,
        devancement: { joueursDevances: abandons, partDevancee: 0 },
      };
}
