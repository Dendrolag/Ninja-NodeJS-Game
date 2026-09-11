/**
 * Les actions: tout ce qui peut faire changer l'etat du client.
 *
 * UNE SEULE PORTE D'ENTREE POUR LE CHANGEMENT, et c'est le point central de
 * l'architecture de ce paquet. Rien ne modifie l'etat du client directement: on
 * decrit ce qui vient d'arriver, on le donne au magasin, et le magasin calcule
 * l'etat suivant. Le client d'origine faisait l'inverse, avec cent quarante
 * variables globales que n'importe quelle fonction pouvait ecrire, si bien que
 * personne ne pouvait dire d'ou venait une valeur fausse.
 *
 * D'OU VIENNENT LES ACTIONS. La plupart sont la traduction directe d'un
 * evenement recu du serveur, et portent son nom. Quelques-unes sont locales: la
 * connexion qui s'etablit ou se perd, l'entree demandee, la sortie. Aucune n'est
 * une decision de jeu: le client ne decide de rien, il enregistre.
 *
 * CE QUE LE TEMPS FAIT ICI. Les actions qui ont besoin d'une date la PORTENT,
 * plutot que de laisser le magasin lire une horloge. C'est ce qui rend le calcul
 * de l'etat suivant entierement previsible: memes actions, meme etat, sans
 * dependre du moment ou le test tourne.
 */

import type {
  ErreurValidation,
  EtatCompteARebours,
  FinDePartie,
  InfosSalon,
  InstantanePartie,
  MaProgression,
  MessageChat,
  PartieEnPause,
  PartiePublique,
  ProfilDuCompte,
  ProgressionDeFin,
  Refus,
} from '@neon-ninja/shared';

import type { EcranDeMenu } from './ecrans.js';
import type { NatureDemandeDeCompte } from './etat.js';
import type { FaitDeJeu } from './faits.js';

/** Tout ce qui peut arriver au client. */
export type Action =
  /** Le client ouvre le lien, ou le rouvre avec une autre session. */
  | { readonly type: 'ouvertureDemandee' }
  /** Le transport est etabli. L'identifiant est celui que le serveur a donne. */
  | { readonly type: 'connexionEtablie'; readonly identifiant: string }
  /** Le transport est tombe. Tout ce qui dependait de la partie est perdu. */
  | { readonly type: 'connexionPerdue' }
  /** Le lien n'a pas pu s'ouvrir, pour ce motif. */
  | { readonly type: 'connexionRefusee'; readonly motif: string }
  /** La session gardee par le navigateur est en cours de verification. */
  | { readonly type: 'sessionEnVerification' }
  /**
   * On joue desormais en invite.
   *
   * Expiree: la session gardee n'etait plus valable, et le joueur doit l'apprendre.
   */
  | { readonly type: 'sessionDInvite'; readonly expiree: boolean }
  /** On joue desormais avec un compte, dont voici la progression. */
  | { readonly type: 'sessionDeCompte'; readonly progression: MaProgression }
  /** Une demande de connexion ou d'inscription est partie, pour ce pseudo. */
  | {
      readonly type: 'demandeDeCompteEnvoyee';
      readonly nature: NatureDemandeDeCompte;
      readonly pseudo: string;
    }
  /** La demande de connexion ou d'inscription a ete refusee. */
  | { readonly type: 'demandeDeCompteRefusee'; readonly erreurs: readonly ErreurValidation[] }
  /** Le joueur va vers un ecran de menu. */
  | { readonly type: 'navigation'; readonly vers: EcranDeMenu }
  /** La lecture du profil du compte est partie. */
  | { readonly type: 'profilDemande' }
  /** Le profil du compte est arrive. */
  | { readonly type: 'profilRecu'; readonly profil: ProfilDuCompte }
  /** Le profil n'a pas pu etre lu, pour ce motif. */
  | { readonly type: 'profilRefuse'; readonly motif: string }
  /**
   * Le joueur demande a entrer, ou a creer une partie.
   *
   * Le pseudo souhaite est absent pour un compte, qui entre sous le sien.
   */
  | { readonly type: 'entreeDemandee'; readonly pseudo: string | undefined }
  /** Le serveur a accepte l'entree et decrit le salon. */
  | { readonly type: 'entreeAcceptee'; readonly salon: InfosSalon }
  /**
   * Le serveur a refuse l'entree ou la creation, en disant pourquoi.
   *
   * Le refus retient a quelle demande il repond: un formulaire d'entree et un
   * formulaire de creation ne montrent pas leurs motifs au meme endroit.
   */
  | {
      readonly type: 'entreeRefusee';
      readonly action: 'rejoindre' | 'creerPartie';
      readonly erreurs: readonly ErreurValidation[];
    }
  /** Le joueur quitte la partie de lui-meme. */
  | { readonly type: 'sortie' }
  /** Le serveur a rendu la liste des parties publiques ouvertes. */
  | { readonly type: 'partiesListees'; readonly parties: readonly PartiePublique[] }
  /** L'etat du salon a change. */
  | { readonly type: 'salon'; readonly salon: InfosSalon }
  /** Quelqu'un a parle. La date est celle de l'arrivee, cote client. */
  | { readonly type: 'chat'; readonly message: MessageChat; readonly instant: number }
  /** Le compte a rebours de demarrage avance. */
  | { readonly type: 'compteARebours'; readonly compte: EtatCompteARebours }
  /** Le compte a rebours a ete annule. */
  | { readonly type: 'demarrageAnnule' }
  /** La partie commence. */
  | { readonly type: 'partieLancee' }
  /** Un instantane du flux d'etat vient d'arriver. */
  | { readonly type: 'etat'; readonly instantane: InstantanePartie }
  /** La partie vient d'etre suspendue par l'hote. */
  | { readonly type: 'partieEnPause'; readonly pause: PartieEnPause }
  /** La partie repart. */
  | { readonly type: 'partieReprise' }
  /** La partie est finie, le classement est definitif. */
  | { readonly type: 'partieTerminee'; readonly fin: FinDePartie }
  /** Ce que la partie a rapporte a notre compte, une fois enregistre. */
  | { readonly type: 'progressionDeFin'; readonly progression: ProgressionDeFin }
  /** Un fait vient d'arriver: capture, bonus, arrivee, depart. */
  | { readonly type: 'fait'; readonly fait: FaitDeJeu }
  /** Une demande du joueur a ete refusee. */
  | { readonly type: 'refus'; readonly refus: Refus };
