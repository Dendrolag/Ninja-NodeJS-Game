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

import type { Mode, Visibilite } from './constantes.js';
import type { Vecteur } from './geometrie.js';
import type { ReglagesPartiels } from './reglages.js';

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
  /**
   * Pseudo au moment de l'entree en jeu: celui du compte pour un compte, le
   * pseudo demande et valide pour un invite.
   */
  readonly pseudo: string;
  /**
   * Le compte de ce joueur. Absent: le joueur est un invite (etape 3.2).
   *
   * Il vient de la session de compte presentee a l'ouverture de la connexion
   * reseau, jamais d'un message.
   */
  readonly compte?: CompteDeSession;
}

/** Le compte d'un joueur en partie, tel que le serveur le connait. */
export interface CompteDeSession {
  /** Identifiant du compte en base. Ne part jamais vers les autres joueurs. */
  readonly id: string;
  /** Niveau du compte a l'entree en partie, deduit de son XP. */
  readonly niveau: number;
}

/**
 * Ce qu'un joueur envoie pour entrer dans une partie existante.
 *
 * Il annonce un pseudo, et eventuellement la partie qu'il vise. Le pseudo est
 * une DEMANDE, pas une identite: le serveur le valide, verifie qu'il est libre
 * dans la partie, et c'est seulement apres qu'il fabrique la SessionJoueur qui
 * fera foi pour tout le reste de la connexion. Rien de ce qui suit ne relira ce
 * message.
 *
 * LE PSEUDO EST FACULTATIF POUR UN COMPTE (etape 3.2). Une connexion authentifiee
 * entre sous le pseudo de son compte: le pseudo de la demande, s'il y en a un,
 * n'est pas lu. Un invite, lui, doit en fournir un, et il ne peut pas prendre
 * celui d'un compte.
 *
 * TROIS FACONS D'ENTRER, ET UNE SEULE A LA FOIS:
 *
 *   - par un CODE D'INVITATION, pour une partie privee;
 *   - par l'IDENTIFIANT d'une partie choisie dans la liste publique. Une partie
 *     privee ne se rejoint jamais ainsi: ses identifiants se devinent (room-1,
 *     room-2), son code non;
 *   - SANS RIEN, et c'est la partie rapide du cadrage de l'etape 0.3: la premiere
 *     partie publique encore dans son salon et non pleine, ou une nouvelle partie
 *     publique aux reglages par defaut s'il n'y en a aucune.
 *
 * Un identifiant et un code ensemble sont refuses: la demande serait ambigue.
 */
export interface DemandeRejoindre {
  /** Pseudo souhaite, a valider. Exige d'un invite, ignore pour un compte. */
  readonly pseudo?: string;
  /** Partie publique visee, choisie dans la liste. */
  readonly idRoom?: string;
  /** Code d'invitation d'une partie privee. */
  readonly code?: string;
}

/**
 * Ce qui se choisit a la creation d'une partie, et ne change plus ensuite.
 *
 * Le mode est fige parce qu'il fixe la capacite: le changer pourrait exclure des
 * joueurs deja presents. La visibilite est figee pour qu'une partie ne disparaisse
 * pas de la liste sous les yeux de ceux qui la rejoignent. Les reglages, eux,
 * restent modifiables par l'hote dans le salon jusqu'au lancement. Voir la
 * section 4 du cadrage (docs/design/cadrage.md).
 */
export interface ConfigurationPartie {
  readonly mode: Mode;
  readonly visibilite: Visibilite;
  /** Reglages de depart. Ceux qui manquent prennent la valeur par defaut. */
  readonly reglages?: ReglagesPartiels;
}

/**
 * Ce qu'un joueur envoie pour creer une partie et en devenir l'hote.
 *
 * Le code d'invitation d'une partie privee n'y figure pas: c'est le serveur qui
 * le fabrique, et qui le rend dans le salon.
 */
export interface DemandeCreation {
  /** Pseudo souhaite, a valider. Exige d'un invite, ignore pour un compte. */
  readonly pseudo?: string;
  readonly configuration: ConfigurationPartie;
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
