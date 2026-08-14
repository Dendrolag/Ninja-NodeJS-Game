/**
 * Ce qu'un joueur envoie au serveur, et ce que le serveur en fait.
 *
 * LA REGLE DE CETTE ETAPE, EN UNE PHRASE: le message d'un joueur ne contient que
 * son INTENTION, jamais son ETAT. Une direction, un texte, un choix de reglage.
 * Jamais « je suis invincible », jamais « je vais deux fois plus vite », jamais
 * « je m'appelle Alice » quand la session dit le contraire.
 *
 * Le legacy faisait l'inverse sur trois points, et chacun etait exploitable par un
 * client modifie:
 *
 *   - Le gestionnaire move (server.js:2604) lisait data.speedBoostActive et
 *     data.isMobile et les appliquait comme multiplicateurs de vitesse, cumulables
 *     a trois virgule quatre. Faille S2 de l'audit.
 *   - Le meme gestionnaire deplacait le joueur A CHAQUE MESSAGE RECU: la vitesse
 *     etait donc proportionnelle au debit du client, pas au temps ecoule. Un
 *     client qui emettait mille messages par seconde allait cinquante fois plus
 *     vite. Faille S2 encore, et faille S4 pour la charge que cela imposait.
 *   - Le gestionnaire chatMessage (:2220) rediffusait le champ nickname fourni par
 *     le client sans le comparer a l'identite de la connexion: n'importe qui
 *     pouvait ecrire sous le nom de n'importe qui. Faille S3.
 *
 * Ces trois failles ne sont pas des reglages de jeu et ne se caracterisent donc
 * pas: elles se corrigent par conception. C'est ce que font ce fichier et son
 * voisin validation.ts.
 *
 * OU CES TYPES SONT UTILISES. Le client les emet (etape 4.1), la couche reseau les
 * valide a la frontiere (etape 2.2), le moteur consomme l'intention de
 * deplacement (packages/sim la republie sous le nom EntreeJoueur). Les trois
 * parlent donc du meme contrat, ecrit une seule fois.
 */

import type { Vecteur } from './geometrie.js';

/**
 * Ce qu'un joueur demande pendant un battement: une direction, et rien d'autre.
 *
 * Seule l'ORIENTATION du vecteur compte. Sa longueur est ignoree: le moteur le
 * ramene lui-meme a la distance que la vitesse du joueur autorise pendant dt. Un
 * client qui envoie un vecteur de longueur mille n'avance donc pas plus vite
 * qu'un client qui envoie un vecteur de longueur un.
 *
 * Il n'y a deliberement aucun champ d'etat ici, et il ne faut jamais en ajouter.
 * Le bonus de vitesse, l'invincibilite, les commandes inversees et la protection
 * d'apparition sont detenus par le moteur, qui les a lui-meme accordes.
 *
 * LE FACTEUR MOBILE N'EST PAS PORTE. Le legacy accordait un facteur deux au
 * joueur dont le message annoncait isMobile, ce qui d'une part se declarait
 * librement, et d'autre part se cumulait a une cadence d'envoi plus rapide sur
 * mobile (16 millisecondes contre 20): un joueur mobile avancait a 375 pixels par
 * seconde contre 150 sur ordinateur. Ce n'etait pas un equilibrage, c'etait
 * l'accumulation de deux defauts. Le moteur avancant maintenant proportionnellement
 * au temps ecoule, tous les appareils sont deja a la meme vitesse, et il n'y a
 * plus rien a compenser. Si un ecart de confort se revelait a l'usage, il se
 * reglerait par une caracteristique de session etablie a la connexion, jamais par
 * un champ de message.
 */
export interface IntentionDeplacement {
  /** Direction souhaitee. Seule son orientation compte. */
  readonly deplacement: Vecteur;
  /** Faux quand le joueur relache ses touches: il s'arrete et regarde devant lui. */
  readonly enMouvement: boolean;
}

/**
 * L'identite d'un joueur, etablie a la connexion et hors de sa portee.
 *
 * C'est la seule source d'identite du jeu. Aucun message entrant n'en fournit
 * une: quand un contenu doit etre attribue a quelqu'un, c'est cette session qui
 * le signe. Voir validerMessageChat.
 */
export interface SessionJoueur {
  /** Identifiant de la connexion. Cote serveur, l'identifiant de la socket. */
  readonly id: string;
  /** Pseudo valide au moment de l'entree en jeu. */
  readonly pseudo: string;
}

/**
 * Ce qu'un joueur envoie pour entrer dans une partie.
 *
 * Il annonce un pseudo, et eventuellement la partie qu'il vise. Le pseudo est
 * une DEMANDE, pas une identite: le serveur le valide, verifie qu'il est libre
 * dans la partie, et c'est seulement apres qu'il fabrique la SessionJoueur qui
 * fera foi pour tout le reste de la connexion. Rien de ce qui suit ne relira ce
 * message.
 *
 * L'identifiant de partie absent signifie « n'importe laquelle »: le serveur
 * choisit. C'est ce que faisait le legacy, qui n'avait qu'un seul salon. Le
 * choix explicite d'une partie prendra tout son sens a l'etape 2.4, avec les
 * codes d'invitation.
 */
export interface DemandeRejoindre {
  /** Pseudo souhaite, a valider. */
  readonly pseudo: string;
  /** Partie visee. Absent: le serveur en choisit une. */
  readonly idRoom?: string;
}

/** Ce qu'un joueur envoie pour parler dans le chat: un texte, et rien d'autre. */
export interface DemandeChat {
  readonly texte: string;
}

/**
 * Un message de chat pret a etre diffuse.
 *
 * L'auteur et le pseudo viennent de la session, le texte vient du joueur. Ce
 * type ne peut donc pas etre fabrique a partir du seul message recu, et c'est
 * exactement le but: la faille S3 du legacy consistait a rediffuser un nom que le
 * client avait choisi lui-meme.
 *
 * Le texte est du TEXTE, jamais du balisage. Le valider a l'entree ne dispense
 * pas de l'echapper a l'affichage: le client de l'etape 4.3 le pose avec
 * textContent, jamais avec innerHTML. Les deux sont exiges, parce qu'ils ne
 * protegent pas de la meme chose.
 */
export interface MessageChat {
  /** Identifiant de la session qui parle. */
  readonly auteur: string;
  /** Pseudo de cette session, tel qu'elle l'a valide en entrant. */
  readonly pseudo: string;
  /** Ce que le joueur a ecrit, normalise et borne. */
  readonly texte: string;
}
