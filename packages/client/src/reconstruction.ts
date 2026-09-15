/**
 * La reconstruction de l'etat de partie a partir du flux recu du serveur.
 *
 * C'EST LE SEUL ENDROIT DU CLIENT QUI SACHE COMMENT LE FLUX EST FAIT, et c'est
 * tout l'interet de ce fichier. Depuis l'etape 2.3, le serveur envoie des trames
 * binaires: une image complete de la partie de temps en temps, et entre deux, des
 * deltas qui ne disent que ce qui a change. Le decodage lui-meme vit dans
 * @neon-ninja/shared (flux.ts), partage avec le serveur qui code: ce fichier
 * decide seulement quoi faire de chaque trame. Le magasin, les ecrans et le rendu
 * n'ont rien vu du changement: ils lisent toujours une VuePartie.
 *
 * C'est la meme separation que cote serveur, ou instantane.ts est le seul a
 * savoir traduire l'etat du moteur vers le reseau.
 *
 * LE CLIENT NE SIMULE RIEN. Il n'extrapole pas les positions entre deux
 * battements, il ne devine pas ce qui va arriver, il n'applique aucune regle de
 * jeu. Il affiche ce que le serveur lui dit. Le lissage de l'affichage entre deux
 * instantanes est une affaire de rendu (etape 4.2), et il travaille sur deux
 * vues successives sans jamais inventer d'etat.
 */

import type {
  EntiteVue,
  InstantanePartie,
  LigneClassement,
  ObjetVu,
  TrameDEtat,
  ZoneVue,
} from '@neon-ninja/shared';
import { ErreurDeTrame, appliquerTrame, lireEnTete } from '@neon-ninja/shared';

/**
 * L'etat de la partie tel que le client le detient, a un battement donne.
 *
 * Sa forme est celle de InstantanePartie, et ce n'est pas un doublon inutile:
 * l'un decrit ce que le serveur ENVOIE, dont la forme appartient au contrat
 * reseau, l'autre est l'ETAT du client, dont la forme appartient au client. Le
 * passage au delta binaire de l'etape 2.3 l'a montre: le message a change, cet
 * etat n'a pas bouge. Le rendu de l'etape 4.2 lit ce type, jamais le message.
 *
 * C'est aussi la reference du delta suivant: le client n'a rien d'autre a retenir
 * pour appliquer le prochain delta que la derniere partie qu'il affiche.
 */
export interface VuePartie {
  /** Numero du dernier battement recu. Il croit a chaque trame d'une meme partie. */
  readonly tick: number;
  /** Temps de jeu restant, en millisecondes. */
  readonly tempsRestantMs: number;
  /** La partie est suspendue: rien ne bouge et le temps ne descend plus. */
  readonly enPause: boolean;
  readonly entites: readonly EntiteVue[];
  readonly objets: readonly ObjetVu[];
  readonly zones: readonly ZoneVue[];
  /** Le classement, du meilleur au moins bon. */
  readonly classement: readonly LigneClassement[];
}

/**
 * Reconstruit l'etat de la partie a l'arrivee d'une trame.
 *
 * TROIS TRAMES SONT IGNOREES, et la vue detenue est rendue telle quelle: la meme
 * vue, et non une copie, ce qui permet au magasin de ne reveiller personne.
 *
 *   - UNE TRAME PERIMEE, dont le battement n'est pas plus recent que celui de la
 *     vue: un doublon ou un retardataire, qui ferait reculer la partie a l'ecran.
 *   - UN DELTA QUI NE S'APPLIQUE PAS a la vue detenue, parce qu'il decrit ce qui a
 *     change depuis un battement que le client n'a pas. C'est le cas ordinaire du
 *     joueur qui entre dans une partie en cours: il recoit le delta de la salle
 *     juste avant son image. Appliquer ce delta a autre chose fabriquerait un etat
 *     faux; l'ignorer ne coute qu'une attente jusqu'a l'image.
 *   - UNE TRAME ILLISIBLE. Elle ne peut venir que d'une faute: le client garde ce
 *     qu'il affiche plutot que de tomber, et la prochaine image le recale.
 *
 * ELLE SUPPOSE QUE LE COMPTEUR NE REPART PAS EN ARRIERE PENDANT UNE PARTIE, ce
 * que le contrat garantit. Il repart bien de zero a la partie SUIVANTE, et c'est
 * pour cela que le magasin oublie sa vue quand la partie est lancee: sans cet
 * oubli, la regle ci-dessus rejetterait toute la partie suivante.
 *
 * @param vue   Ce que le client detient deja, ou rien avant la premiere image.
 * @param trame Ce qui vient d'arriver du serveur.
 * @returns La partie reconstruite, ou la vue detenue si la trame est ignoree.
 */
export function reconstruire(vue: VuePartie | undefined, trame: TrameDEtat): VuePartie | undefined {
  try {
    if (vue !== undefined && lireEnTete(trame).tick <= vue.tick) {
      return vue;
    }

    const partie = appliquerTrame(vue, trame);

    return partie === undefined ? vue : vueDe(partie);
  } catch (erreur) {
    if (erreur instanceof ErreurDeTrame) {
      return vue;
    }

    throw erreur;
  }
}

/** La partie decodee, rangee comme l'etat du client la detient. */
function vueDe(partie: InstantanePartie): VuePartie {
  return {
    tick: partie.tick,
    tempsRestantMs: partie.tempsRestantMs,
    enPause: partie.enPause,
    entites: partie.entites,
    objets: partie.objets,
    zones: partie.zones,
    classement: partie.classement,
  };
}

/** Retrouve une entite de la partie par son identifiant, si elle y est encore. */
export function entiteDe(vue: VuePartie | undefined, id: string): EntiteVue | undefined {
  return vue?.entites.find((entite) => entite.id === id);
}
