/**
 * Les ecrans du client, et les seules transitions autorisees entre eux.
 *
 * DEUX FAMILLES D'ECRANS. Les ecrans de MENU, ou l'on va de soi-meme (l'accueil, la
 * connexion a un compte, et au fil du jalon 3 les parties, la creation et le
 * profil). Et les ecrans de PARTIE (salon, jeu, fin), ou l'on n'arrive que parce que
 * le serveur a accepte une entree ou fait avancer la partie. Le jalon 1 ne portait
 * que les ecrans du legacy; la reprise des ecrans du jalon 3 ajoute ceux de la
 * maquette, dans la version reduite du cadrage (section 3).
 *
 * ON NE QUITTE PAS UNE PARTIE EN NAVIGUANT. Une navigation n'a d'effet que depuis
 * un ecran de menu. Depuis le salon, le jeu ou la fin, on sort en quittant la
 * partie, ce qui la dit au serveur; un clic qui changerait d'ecran sans rien lui
 * dire laisserait le joueur dans une partie qu'il ne voit plus.
 *
 * POURQUOI UNE FONCTION PURE PLUTOT QUE DES APPELS DISPERSES. Dans le client
 * d'origine, chaque gestionnaire d'evenement montrait et cachait des div lui-meme.
 * Il y avait donc autant de reponses a la question « quand passe-t-on au salon »
 * qu'il y avait d'endroits ou la question se posait, et elles ne s'accordaient
 * pas toutes. Ici il y a une seule reponse, et elle se lit sans lancer le jeu.
 *
 * CE QUE CETTE FONCTION NE FAIT PAS: elle ne touche a aucun element de page.
 * Elle dit quel ecran DOIT etre affiche; le montrer est le travail de
 * l'application (interface/application.ts), qui lit cette valeur dans le magasin.
 */

import type { StatutPartie } from '@neon-ninja/shared';

import type { Action } from './actions.js';

/** Les ecrans ou l'on va de soi-meme, hors de toute partie. */
export const ECRANS_DE_MENU = ['accueil', 'connexion', 'profil'] as const;

/** Un ecran de menu. */
export type EcranDeMenu = (typeof ECRANS_DE_MENU)[number];

/** L'ecran affiche. */
export type Ecran =
  /** Accueil: on choisit comment jouer. Le mainMenu du legacy, enrichi. */
  | 'accueil'
  /** Connexion: se connecter a un compte, ou en creer un. */
  | 'connexion'
  /** Profil: la progression, les statistiques et les dernieres parties d'un compte. */
  | 'profil'
  /** Salon: on attend, on discute, l'hote regle et lance. Le waitingRoom du legacy. */
  | 'salon'
  /** Jeu: la partie se joue. Le gameScreen du legacy. */
  | 'jeu'
  /** Fin: le classement definitif, et ce que la partie a rapporte. */
  | 'fin';

/** Cet ecran est-il un ecran de menu, ou l'on peut naviguer. */
export function estUnEcranDeMenu(ecran: Ecran): ecran is EcranDeMenu {
  return (ECRANS_DE_MENU as readonly Ecran[]).includes(ecran);
}

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

    case 'navigation':
      return estUnEcranDeMenu(ecran) ? action.vers : ecran;

    // Connecte: l'ecran de connexion a fait son travail.
    case 'sessionDeCompte':
      return ecran === 'connexion' ? 'accueil' : ecran;

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
