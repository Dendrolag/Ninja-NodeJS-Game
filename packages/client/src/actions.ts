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
  FicheJoueur,
  FinDePartie,
  GesteDAmitie,
  InfosSalon,
  InvitationRecue,
  ListeDAmis,
  MaProgression,
  MessageChat,
  PartieEnPause,
  PartiePublique,
  PresenceDUnAmi,
  ProfilDuCompte,
  ProgressionDeFin,
  Refus,
  ReponseDeGeste,
  TrameDEtat,
} from '@neon-ninja/shared';

import type { EcranDeMenu } from './ecrans.js';
import type { NatureDemandeDeCompte } from './etat.js';
import type { FaitDeJeu } from './faits.js';
import type { Invitation } from './invitation.js';

/** Tout ce qui peut arriver au client. */
export type Action =
  /** Le client ouvre le lien, ou le rouvre avec une autre session. */
  | { readonly type: 'ouvertureDemandee' }
  /** Le transport est etabli. */
  | { readonly type: 'connexionEtablie' }
  /**
   * Le lien n'a pas pu etre retabli (etape 2.6). Ce qu'on attendait du serveur ne
   * viendra pas; un salon ou une partie sont quittes, avec cet avis s'il y en a un.
   */
  | { readonly type: 'connexionPerdue'; readonly avis?: string }
  /**
   * Le lien est tombe hors d'une partie en cours, et la page le retablit (etape 2.6).
   * Le joueur reste sur son ecran, sauf celui du jeu: la place en partie vient alors
   * d'etre perdue, et l'accueil le dit par cet avis.
   */
  | { readonly type: 'lienPerdu'; readonly avis?: string }
  /** Le lien est retabli, et la page redemande a entrer dans le salon qu'elle montrait (etape 2.6). */
  | { readonly type: 'salonRedemande' }
  /**
   * Le transport est tombe en pleine partie, et la page tente d'y revenir (etape 2.5).
   * La partie reste affichee telle qu'elle etait.
   */
  | { readonly type: 'lienPerduEnPartie' }
  /**
   * Le lien vient de s'ouvrir, et la place gardee est presentee au serveur (etape
   * 2.5): apres une coupure, ou au chargement de la page.
   */
  | { readonly type: 'retourDemande' }
  /**
   * Le serveur a rendu sa place au joueur (etape 2.5), ou l'a fait rentrer dans le
   * salon qu'il avait perdu (etape 2.6), et decrit la partie.
   */
  | { readonly type: 'retourAccepte'; readonly salon: InfosSalon }
  /**
   * La place n'a pas pu etre reprise, ou a ete reprise ailleurs (etape 2.5), ou le
   * salon n'a pas pu etre retrouve (etape 2.6), pour ce motif. Le lien, lui, est ouvert.
   */
  | { readonly type: 'retourRefuse'; readonly motif: string }
  /** Le serveur dit quel est notre joueur dans la partie ou l'on entre (etape 2.5). */
  | { readonly type: 'placeAttribuee'; readonly joueur: string }
  /** Le lien n'a pas pu s'ouvrir, pour ce motif. */
  | { readonly type: 'connexionRefusee'; readonly motif: string }
  /** Le serveur ne repond pas encore: un nouvel essai est planifie (etape 5.3). */
  | { readonly type: 'serveurEnReveil' }
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
  /**
   * Une demande de compte est partie, pour ce pseudo. Le pseudo est absent d'une
   * demande faite depuis le profil, qui porte sur le compte connecte.
   */
  | {
      readonly type: 'demandeDeCompteEnvoyee';
      readonly nature: NatureDemandeDeCompte;
      readonly pseudo: string | undefined;
    }
  /** La demande de compte a ete refusee. */
  | { readonly type: 'demandeDeCompteRefusee'; readonly erreurs: readonly ErreurValidation[] }
  /** La demande faite depuis le profil a abouti; la session reste la meme (etape 3.4). */
  | { readonly type: 'demandeDeCompteAcceptee' }
  /** Le serveur vient d'emettre ce code de secours, a montrer une fois (etape 3.4). */
  | { readonly type: 'codeDeSecoursEmis'; readonly code: string }
  /** Le joueur dit avoir note son code de secours: il est oublie (etape 3.4). */
  | { readonly type: 'codeDeSecoursNote' }
  /** La page a ete ouverte par un lien d'invitation (etape 2.7). */
  | { readonly type: 'invitationOuverte'; readonly invitation: Invitation }
  /** Le joueur ignore l'invitation: l'accueil redevient celui de tous les jours. */
  | { readonly type: 'invitationIgnoree' }
  /** Le joueur va vers un ecran de menu. */
  | { readonly type: 'navigation'; readonly vers: EcranDeMenu }
  /** La lecture du profil du compte est partie. */
  | { readonly type: 'profilDemande' }
  /** Le profil du compte est arrive. */
  | { readonly type: 'profilRecu'; readonly profil: ProfilDuCompte }
  /** Le profil n'a pas pu etre lu, pour ce motif. */
  | { readonly type: 'profilRefuse'; readonly motif: string }
  /** La lecture de la fiche de ce joueur est partie: elle s'ouvre (etape 3.5). */
  | { readonly type: 'ficheDemandee'; readonly pseudo: string }
  /** La fiche demandee pour ce pseudo est arrivee. */
  | { readonly type: 'ficheRecue'; readonly pseudo: string; readonly fiche: FicheJoueur }
  /** La fiche demandee pour ce pseudo n'a pas pu etre lue, pour ce motif. */
  | { readonly type: 'ficheRefusee'; readonly pseudo: string; readonly motif: string }
  /** Le joueur ferme la fiche. */
  | { readonly type: 'ficheFermee' }
  /** La lecture de la liste des amis est partie, sous ce numero (etape 3.6). */
  | { readonly type: 'amisDemandes'; readonly lecture: number }
  /** La liste des amis de cette lecture est arrivee. */
  | { readonly type: 'amisRecus'; readonly lecture: number; readonly liste: ListeDAmis }
  /** Cette lecture de la liste des amis a echoue, pour ce motif. */
  | { readonly type: 'amisRefuses'; readonly lecture: number; readonly motif: string }
  /** Un geste d'amitie est parti, vers ce pseudo (etape 3.6). */
  | { readonly type: 'gesteEnvoye'; readonly geste: GesteDAmitie; readonly pseudo: string }
  /** Le geste a ete fait: voici la relation qui en resulte, et la liste a jour. */
  | {
      readonly type: 'gesteFait';
      readonly geste: GesteDAmitie;
      readonly pseudo: string;
      readonly reponse: ReponseDeGeste;
    }
  /** Le geste a ete refuse, pour ce motif. */
  | {
      readonly type: 'gesteRefuse';
      readonly geste: GesteDAmitie;
      readonly pseudo: string;
      readonly motif: string;
    }
  /** Le serveur dit quels amis sont en ligne, et ou (etape 2.8). */
  | { readonly type: 'presenceDesAmis'; readonly presences: readonly PresenceDUnAmi[] }
  /** Un ami invite ce compte dans sa partie (etape 2.8). */
  | { readonly type: 'invitationRecue'; readonly invitation: InvitationRecue }
  /** Cette invitation ne vaut plus, dit le serveur (etape 2.8). */
  | { readonly type: 'invitationRetiree'; readonly id: string }
  /** Le joueur ignore cette invitation d'un ami: elle quitte sa page, en silence. */
  | { readonly type: 'invitationDAmiIgnoree'; readonly id: string }
  /** Une invitation part du salon vers cet ami (etape 2.8). */
  | { readonly type: 'invitationEnvoyee'; readonly pseudo: string }
  /** Le serveur l'a fait partir. */
  | { readonly type: 'invitationPartie'; readonly pseudo: string }
  /** Le serveur l'a refusee, pour ce motif. */
  | { readonly type: 'invitationRefusee'; readonly pseudo: string; readonly motif: string }
  /**
   * Le joueur demande a entrer, ou a creer une partie.
   *
   * Le pseudo souhaite est absent pour un compte, qui entre sous le sien. L'invitation
   * est celle d'un ami par laquelle il demande a entrer, s'il y en a une (etape 2.8).
   */
  | {
      readonly type: 'entreeDemandee';
      readonly pseudo: string | undefined;
      readonly invitation?: string;
    }
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
  /** Un invite modifie le pseudo qu'il saisit. */
  | { readonly type: 'pseudoSaisi'; readonly pseudo: string }
  /** La liste des parties publiques est demandee au serveur. */
  | { readonly type: 'listeDemandee' }
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
  /** Une trame du flux d'etat vient d'arriver: une image complete ou un delta. */
  | { readonly type: 'etat'; readonly trame: TrameDEtat }
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
