/**
 * La reconstruction de l'etat de partie a partir du flux recu du serveur.
 *
 * C'EST LE SEUL ENDROIT DU CLIENT QUI SACHE COMMENT LE FLUX EST FAIT, et c'est
 * tout l'interet de ce fichier. Aujourd'hui le serveur envoie un instantane
 * complet en JSON a chaque battement (etape 2.2): reconstruire revient donc a
 * adopter ce qui arrive. Si l'etape 2.3 remplace ce flux par un delta binaire,
 * c'est ici, et nulle part ailleurs, que le decodage et l'application du delta
 * viendront se poser. Le magasin, les ecrans et le rendu ne verront pas la
 * difference: ils continueront de lire une VuePartie.
 *
 * C'est la meme separation que cote serveur, ou instantane.ts est le seul a
 * savoir traduire l'etat du moteur vers le reseau.
 *
 * LE CLIENT NE SIMULE RIEN. Il n'extrapole pas les positions entre deux
 * battements, il ne devine pas ce qui va arriver, il n'applique aucune regle de
 * jeu. Il affiche ce que le serveur lui dit. Le lissage de l'affichage entre deux
 * instantanes est une affaire de rendu (etape 4.2), et il travaillera sur deux
 * vues successives sans jamais inventer d'etat.
 */

import type {
  EntiteVue,
  InstantanePartie,
  LigneClassement,
  ObjetVu,
  ZoneVue,
} from '@neon-ninja/shared';

/**
 * L'etat de la partie tel que le client le detient, a un battement donne.
 *
 * Sa forme est celle de InstantanePartie, et ce n'est pas un doublon inutile:
 * l'un est un MESSAGE, dont la forme appartient au contrat reseau, l'autre est
 * l'ETAT du client, dont la forme appartient au client. Le jour ou le message
 * devient un delta binaire, le message change et cet etat ne bouge pas. Le rendu
 * de l'etape 4.2 lit ce type, jamais le message.
 */
export interface VuePartie {
  /** Numero du dernier battement recu. Il croit de un a chaque instantane. */
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
 * Reconstruit l'etat de la partie a l'arrivee d'un instantane.
 *
 * UN INSTANTANE PERIME EST IGNORE. Le numero de battement croit de un a chaque
 * envoi d'une meme partie: un message dont le numero n'est pas plus grand que
 * celui deja detenu ne peut etre qu'un doublon ou un retardataire, et l'adopter
 * ferait reculer la partie a l'ecran. La regle ne coute rien aujourd'hui, ou le
 * transport garantit l'ordre; elle sera indispensable a un flux delta, ou
 * appliquer deux fois le meme delta donne un etat faux.
 *
 * ELLE SUPPOSE QUE LE COMPTEUR NE REPART PAS EN ARRIERE PENDANT UNE PARTIE, ce
 * que le contrat garantit. Il repart bien de zero a la partie SUIVANTE, et c'est
 * pour cela que le magasin oublie sa vue quand la partie est lancee: sans cet
 * oubli, la regle ci-dessus rejetterait toute la partie suivante.
 *
 * @param vue        Ce que le client detient deja, ou rien avant le premier
 *                   instantane.
 * @param instantane Ce qui vient d'arriver du serveur.
 */
export function reconstruire(vue: VuePartie | undefined, instantane: InstantanePartie): VuePartie {
  if (vue !== undefined && instantane.tick <= vue.tick) {
    return vue;
  }

  return {
    tick: instantane.tick,
    tempsRestantMs: instantane.tempsRestantMs,
    enPause: instantane.enPause,
    entites: instantane.entites,
    objets: instantane.objets,
    zones: instantane.zones,
    classement: instantane.classement,
  };
}

/** Retrouve une entite de la partie par son identifiant, si elle y est encore. */
export function entiteDe(vue: VuePartie | undefined, id: string): EntiteVue | undefined {
  return vue?.entites.find((entite) => entite.id === id);
}
