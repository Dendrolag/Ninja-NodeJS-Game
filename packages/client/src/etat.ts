/**
 * L'etat du client: la source de verite unique, et tout ce qu'elle contient.
 *
 * UN SEUL OBJET, IMMUABLE, POUR TOUT CE QUE LE CLIENT SAIT. C'est l'exact
 * contraire du client d'origine, qui repartissait la meme information entre des
 * variables globales, des attributs de l'objet de jeu et le contenu du document:
 * le score existait a trois endroits, et rien ne garantissait qu'ils disaient la
 * meme chose. Ici il existe une fois. Le rendu (etape 4.2) et les menus (etape
 * 4.3) le LISENT; seul le magasin le remplace.
 *
 * TOUS LES CHAMPS SONT EN LECTURE SEULE, jusqu'au contenu des listes. Une
 * modification sur place est donc une erreur de compilation, et pas un defaut a
 * chercher. C'est ce qui permet aussi au rendu de comparer deux etats par
 * identite pour savoir si quelque chose a change, sans les parcourir.
 *
 * CE QUI N'EST PAS DEDANS. Aucune reference a un element de page, aucun objet de
 * rendu, aucune socket. L'etat se serialise, se compare et se rejoue tel quel,
 * ce dont les tests profitent directement.
 */

import type {
  ErreurValidation,
  EtatCompteARebours,
  FinDePartie,
  InfosSalon,
  MessageChat,
  Refus,
  TypeBonus,
  TypeMalus,
} from '@neon-ninja/shared';

import type { Ecran } from './ecrans.js';
import type { FaitDeJeu } from './faits.js';
import type { VuePartie } from './reconstruction.js';

/** Ou en est le transport. */
export type EtatConnexion =
  /** Le lien n'a pas encore ete etabli. */
  | 'horsLigne'
  /** Le lien est etabli: on peut demander a entrer dans une partie. */
  | 'connecte'
  /**
   * Le lien a ete etabli, puis perdu.
   *
   * Ajoute a l'etape 4.3. Distinguer une perte d'une attente est ce qui permet a
   * l'accueil de dire au joueur que la connexion est tombee, plutot que de lui
   * faire attendre une connexion qui ne viendra pas: la reconnexion automatique
   * est coupee (handoff 4.1). L'information ne pouvait pas vivre dans l'ecran
   * d'accueil, qui est monte a neuf au moment meme ou le lien tombe.
   */
  | 'perdue';

/**
 * Un message de chat, date a son arrivee chez nous.
 *
 * Le serveur n'envoie aucune heure, et c'est delibere: la sienne est monotone et
 * sa valeur absolue n'a aucun sens ailleurs (decision du 14 aout 2026). Le client
 * date donc a la reception, ce qui suffit tant qu'il n'y a pas d'historique de
 * conversation a reconstituer.
 */
export interface MessageAffiche extends MessageChat {
  /** Instant local d'arrivee, lu sur l'horloge du client. */
  readonly recuA: number;
}

/**
 * Un effet en cours sur ce joueur, tel que l'affichage doit le montrer.
 *
 * CE N'EST PAS UNE SIMULATION, c'est un affichage. Le moteur seul detient les
 * durees et les fait decroitre; il n'existe aucun message « mon bonus a expire »,
 * et la regle de l'etape 1.6 l'interdit. Mais une jauge doit bien descendre a
 * l'ecran entre le ramassage et la fin: le client apprend la duree au ramassage
 * et la decompte pour la dessiner. Aucune decision de jeu n'en depend, et si les
 * deux comptes divergeaient d'une demi-seconde, seule la jauge serait fausse.
 *
 * LES DUREES SE CUMULENT, c'est le comportement a preserver numero 10 de
 * CLAUDE.md: deux bonus de vitesse ramasses coup sur coup donnent vingt secondes,
 * ils ne se remplacent pas. Le moteur le fait, l'affichage doit donc le faire
 * aussi, sans quoi la jauge annoncerait une fin qui n'arrive pas.
 */
export interface EffetActif {
  readonly categorie: 'bonus' | 'malus';
  readonly nature: TypeBonus | TypeMalus;
  /** Instant local auquel l'effet doit cesser d'etre affiche. */
  readonly finPrevueA: number;
}

/** Tout ce que le client sait, a un instant donne. */
export interface EtatClient {
  /** L'ecran a afficher. */
  readonly ecran: Ecran;
  /** Ou en est le transport. */
  readonly connexion: EtatConnexion;
  /**
   * Notre identifiant de session, donne par le serveur a la connexion.
   *
   * C'est la clef qui permet de se reconnaitre parmi les entites et les lignes
   * du classement, donc de savoir ou centrer la camera et quelle ligne mettre en
   * avant. Absent tant que le lien n'est pas etabli.
   */
  readonly moi: string | undefined;
  /**
   * Le pseudo demande a l'entree, tel que le joueur l'a saisi.
   *
   * Ce n'est pas forcement celui que porte la session: le serveur normalise, et
   * peut refuser. Il sert a reproposer la saisie apres un refus. Le pseudo qui
   * fait foi est celui du salon.
   */
  readonly pseudoDemande: string | undefined;
  /**
   * Une demande d'entree est partie, et sa reponse n'est pas arrivee.
   *
   * Ajoute a l'etape 4.3. Sans lui, l'accueil laisserait redemander a entrer
   * pendant l'attente, et le serveur refuserait la seconde demande d'une
   * connexion deja entree. Le cas se produit en rejouant: on quitte la partie
   * finie, on passe un instant par l'accueil, et on redemande aussitot.
   */
  readonly entreeEnCours: boolean;
  /** Le salon de la partie ou l'on se trouve, reglages compris. */
  readonly salon: InfosSalon | undefined;
  /** Le compte a rebours de demarrage, tant qu'il tourne. */
  readonly compteARebours: EtatCompteARebours | undefined;
  /** L'etat de la partie, reconstruit a partir du flux. */
  readonly partie: VuePartie | undefined;
  /** Les effets en cours sur nous, pour l'affichage seul. */
  readonly effets: readonly EffetActif[];
  /** Les messages de chat recus, du plus ancien au plus recent. */
  readonly messages: readonly MessageAffiche[];
  /** Les faits recents, du plus ancien au plus recent. */
  readonly journal: readonly FaitDeJeu[];
  /**
   * Le pseudo de l'hote qui a suspendu la partie, tant qu'elle l'est.
   *
   * Que la partie soit suspendue se lit dans le flux, sur la vue de partie. Ce
   * champ ne porte que le NOM, que le flux ne transporte pas et dont le bandeau
   * a besoin pour dire qui a suspendu.
   */
  readonly pausePar: string | undefined;
  /** Le classement definitif, une fois la partie finie. */
  readonly fin: FinDePartie | undefined;
  /** Le dernier refus recu, a montrer au joueur. */
  readonly refus: Refus | undefined;
}

/**
 * Combien de messages de chat le client garde.
 *
 * Une conversation ne se relit pas indefiniment, et une liste qui ne se vide
 * jamais est une fuite de memoire dans un onglet reste ouvert une soiree. Le
 * client d'origine ne bornait rien.
 */
export const MAX_MESSAGES = 100;

/** Combien de faits le client garde. Meme raison que pour les messages. */
export const MAX_JOURNAL = 50;

/** L'etat d'un client qui vient de demarrer: rien de connu, personne de connecte. */
export const ETAT_INITIAL: EtatClient = {
  ecran: 'accueil',
  connexion: 'horsLigne',
  moi: undefined,
  pseudoDemande: undefined,
  entreeEnCours: false,
  salon: undefined,
  compteARebours: undefined,
  partie: undefined,
  effets: [],
  messages: [],
  journal: [],
  pausePar: undefined,
  fin: undefined,
  refus: undefined,
};

/** Un refus fabrique a partir d'erreurs de validation, pour un evenement donne. */
export function refusDe(action: Refus['action'], erreurs: readonly ErreurValidation[]): Refus {
  return { action, erreurs };
}
