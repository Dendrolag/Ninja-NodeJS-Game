/**
 * La pause d'une partie: suspendre le temps de jeu, puis le rendre.
 *
 * Deux fonctions, et rien d'autre. Elles ne decident de RIEN: ni qui a le droit
 * de suspendre une partie, ni quand, ni pour combien de temps. Elles posent un
 * indicateur dans l'etat, et c'est tick qui en tire toutes les consequences.
 *
 * CE QUE LE LEGACY FAISAIT, ET POURQUOI CE N'EST PAS CE QUI EST PORTE ICI. Sa
 * pause vivait dans trois variables de module (isPaused, pauseStartTime et
 * totalPauseDuration, server.js:122 a 125). Suspendre une partie notait l'heure,
 * la reprendre ajoutait la duree ecoulee a un cumul, et toute lecture du temps
 * restant retranchait ce cumul de l'heure du mur (calculateTimeLeft,
 * server.js:1537). Il fallait donc tenir cette comptabilite juste dans les cinq
 * endroits qui remettaient une partie a zero, et le legacy la recopiait
 * effectivement cinq fois.
 *
 * Ici il n'y a rien a cumuler ni a retrancher. Le temps de jeu du moteur n'avance
 * que de ce que tick lui donne, et pendant la pause il ne lui donne rien: le
 * temps ne passe pas, donc il n'y a pas de temps a rattraper. La comptabilite
 * disparait avec le probleme qu'elle resolvait.
 *
 * QUI A LE DROIT DE METTRE EN PAUSE N'EST PAS UNE QUESTION POUR CE FICHIER. Le
 * moteur n'a jamais connu ni session, ni hote, ni connexion, et il ne retient
 * donc pas qui a demande la pause. La reponse est dans GameRoom et dans la couche
 * reseau: c'est l'hote, comme pour les reglages et le lancement.
 */

import type { EtatPartie } from './etat.js';
import { evaluerFinDePartie } from './moteur.js';

/**
 * Suspend une partie.
 *
 * Une partie deja suspendue est rendue telle quelle: la demande est sans effet,
 * pas une erreur. Une partie TERMINEE l'est aussi, et pour la meme raison que
 * dans le legacy, qui gardait sa pause derriere un `if (!isGameOver)`: suspendre
 * ce qui est fini ne veut rien dire, et laisserait une partie terminee dans un
 * etat que la reprise seule pourrait defaire.
 *
 * @param etat Etat courant. Il n'est pas modifie.
 * @returns Le nouvel etat, ou celui recu s'il n'y avait rien a faire.
 */
export function mettreEnPause(etat: EtatPartie): EtatPartie {
  if (etat.enPause || evaluerFinDePartie(etat).terminee) {
    return etat;
  }

  return { ...etat, enPause: true };
}

/**
 * Rend son temps a une partie suspendue.
 *
 * Une partie qui n'etait pas suspendue est rendue telle quelle. Le jeu reprend
 * exactement ou il s'etait arrete: les positions, les durees de bonus et les
 * comptes a rebours d'apparition n'ont pas bouge pendant la pause, puisque le
 * temps n'a pas passe pour eux.
 *
 * @param etat Etat courant. Il n'est pas modifie.
 * @returns Le nouvel etat, ou celui recu s'il n'y avait rien a faire.
 */
export function reprendre(etat: EtatPartie): EtatPartie {
  if (!etat.enPause) {
    return etat;
  }

  return { ...etat, enPause: false };
}
