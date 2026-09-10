/**
 * Les ecrans du client, et les seules transitions autorisees entre eux.
 *
 * QUATRE ECRANS, PAS SEPT. La maquette de docs/design en propose sept (accueil,
 * navigateur de parties, creation, salon, jeu, fin, profil). Le jalon 1 porte le
 * jeu d'aujourd'hui a l'identique: ses ecrans sont donc ceux du legacy, soit
 * mainMenu, waitingRoom, gameScreen et sa fenetre de fin. Le navigateur de
 * parties et la creation ont leurs contrats depuis l'etape 2.4; leurs ecrans
 * arrivent au jalon 3, avec le profil et les comptes. Voir la section 3 de
 * docs/plan/ROADMAP.md.
 *
 * POURQUOI UNE FONCTION PURE PLUTOT QUE DES APPELS DISPERSES. Dans le client
 * d'origine, chaque gestionnaire d'evenement montrait et cachait des div lui-meme.
 * Il y avait donc autant de reponses a la question « quand passe-t-on au salon »
 * qu'il y avait d'endroits ou la question se posait, et elles ne s'accordaient
 * pas toutes. Ici il y a une seule reponse, elle tient en vingt lignes, et elle
 * se lit sans lancer le jeu.
 *
 * CE QUE CETTE FONCTION NE FAIT PAS: elle ne touche a aucun element de page.
 * Elle dit quel ecran DOIT etre affiche; le montrer est le travail de l'etape
 * 4.3, qui lira cette valeur dans le magasin.
 */

import type { StatutPartie } from '@neon-ninja/shared';

import type { Action } from './actions.js';

/** L'ecran affiche. */
export type Ecran =
  /** Accueil: on saisit son pseudo et on demande a entrer. Le mainMenu du legacy. */
  | 'accueil'
  /** Salon: on attend, on discute, l'hote regle et lance. Le waitingRoom du legacy. */
  | 'salon'
  /** Jeu: la partie se joue. Le gameScreen du legacy. */
  | 'jeu'
  /** Fin: le classement definitif. La fenetre de fin du legacy. */
  | 'fin';

/**
 * Quel ecran afficher apres cette action.
 *
 * Toute action non citee laisse l'ecran ou il est: recevoir un message de chat
 * ou un instantane ne fait pas changer d'ecran, et c'est le cas de la grande
 * majorite du trafic.
 *
 * @param ecran  L'ecran affiche avant l'action.
 * @param action Ce qui vient d'arriver.
 */
export function ecranSuivant(ecran: Ecran, action: Action): Ecran {
  switch (action.type) {
    // On entre dans une partie. Elle peut deja etre en cours: le serveur autorise
    // a rejoindre une partie commencee, et il enverra partieLancee juste apres.
    // Aller directement au bon ecran evite d'afficher le salon le temps d'un
    // aller-retour.
    case 'entreeAcceptee':
      return ecranDuStatut(action.salon.statut);

    case 'partieLancee':
      return 'jeu';

    case 'partieTerminee':
      return 'fin';

    // On n'est plus dans aucune partie, volontairement ou non: retour a l'accueil.
    // Une entree refusee n'a jamais fait quitter l'accueil, la citer ici n'aurait
    // donc rien change; c'est justement pour cela qu'elle n'y est pas.
    case 'sortie':
    case 'connexionPerdue':
      return 'accueil';

    default:
      return ecran;
  }
}

/** L'ecran qui correspond a l'etat d'une partie que l'on vient de rejoindre. */
function ecranDuStatut(statut: StatutPartie): Ecran {
  switch (statut) {
    case 'salon':
      return 'salon';
    case 'enCours':
      return 'jeu';
    // Inatteignable aujourd'hui: une partie terminee refuse les nouveaux venus.
    // Traite quand meme, pour que l'ajout d'un statut au contrat se remarque ici.
    case 'terminee':
      return 'fin';
  }
}
