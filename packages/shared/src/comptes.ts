/**
 * Les contrats des comptes: s'inscrire, se connecter, lire sa progression.
 *
 * LE COMPTE EST OPTIONNEL (decision du 11 septembre 2026). On joue en invite avec
 * un simple pseudo, comme depuis toujours; un compte fait entrer sous son pseudo
 * et avec son niveau, et garde la progression. Rien de ce fichier n'est donc
 * necessaire pour jouer.
 *
 * DEUX CANAUX, CHACUN POUR CE QU'IL SAIT FAIRE. L'inscription, la connexion et la
 * lecture de sa progression sont des questions ponctuelles, qui passent par HTTP
 * (routes ci-dessous). Le jeu passe par Socket.IO, et c'est a l'ouverture de la
 * connexion reseau que le client presente son jeton de session: le serveur sait
 * alors, une fois pour toutes, a quel compte il parle.
 *
 * LA SESSION EST UN JETON, PAS UN COOKIE (journal de conception, 11 septembre
 * 2026). Le client est prevu sur un domaine et le serveur sur un autre, et les
 * navigateurs restreignent de plus en plus les cookies envoyes d'un domaine a
 * l'autre. Un jeton, que le client garde et joint lui-meme a ses demandes, ne
 * depend d'aucune de ces regles.
 *
 * COMME AILLEURS, LE TYPE DIT L'INTENTION ET LE SCHEMA VERIFIE LE MESSAGE. Chaque
 * demande recue est revalidee par validation.ts avant d'aller plus loin.
 */

import type { CarteEnregistree, Mode } from './constantes.js';
import type { ErreurValidation } from './validation.js';

/** La racine des routes HTTP des comptes. */
export const RACINE_API_COMPTES = '/api/comptes';

/**
 * Les routes HTTP des comptes, adresses completes.
 *
 * Toutes repondent en JSON. Un refus porte toujours la forme ReponseRefusee.
 */
export const ROUTES_COMPTES = {
  /** POST, DemandeInscription. 201 et SessionOuverte; 400, 409 ou 429 sinon. */
  inscription: `${RACINE_API_COMPTES}/inscription`,
  /** POST, DemandeConnexion. 200 et SessionOuverte; 400, 401 ou 429 sinon. */
  connexion: `${RACINE_API_COMPTES}/connexion`,
  /** POST, jeton en en-tete. 204: la session est fermee; 401 sans jeton. */
  deconnexion: `${RACINE_API_COMPTES}/deconnexion`,
  /** GET, jeton en en-tete. 200 et MaProgression; 401 sans session valide. */
  moi: `${RACINE_API_COMPTES}/moi`,
  /** GET, jeton en en-tete. 200 et ProfilDuCompte; 401 sans session valide. */
  profil: `${RACINE_API_COMPTES}/profil`,
  /**
   * POST, jeton en en-tete, DemandeChangementMotDePasse (etape 3.4). 200 et
   * CodeDeSecoursEmis; 400, 401 sans session valide, 403 si le mot de passe actuel
   * est faux, 429.
   */
  motDePasse: `${RACINE_API_COMPTES}/mot-de-passe`,
  /**
   * POST, jeton en en-tete, DemandeCodeDeSecours (etape 3.4). 200 et
   * CodeDeSecoursEmis; 400, 401, 403 ou 429 sinon.
   */
  codeDeSecours: `${RACINE_API_COMPTES}/code-de-secours`,
  /**
   * POST, sans jeton, DemandeReinitialisation (etape 3.4). 200 et SessionInscrite;
   * 400, 401 si le pseudo ou le code ne correspondent pas, 429.
   */
  reinitialisation: `${RACINE_API_COMPTES}/reinitialisation`,
} as const;

/**
 * Le nom de l'en-tete HTTP qui porte le jeton, et son prefixe.
 *
 * C'est la forme standard: « Authorization: Bearer <jeton> ».
 */
export const PREFIXE_JETON_HTTP = 'Bearer ';

/** Ce qu'un joueur envoie pour creer un compte. */
export interface DemandeInscription {
  /** Le pseudo du compte, soumis aux regles du pseudo de partie, et unique. */
  readonly pseudo: string;
  /** Le mot de passe en clair. Il ne sera jamais stocke tel quel. */
  readonly motDePasse: string;
}

/** Ce qu'un joueur envoie pour se connecter a son compte. */
export interface DemandeConnexion {
  readonly pseudo: string;
  readonly motDePasse: string;
}

/** Un compte connecte, tel que son proprietaire le voit. */
export interface CompteConnecte {
  /** Le pseudo, dans l'ecriture choisie a l'inscription. */
  readonly pseudo: string;
  /** Le niveau, deduit de l'XP totale. Voir niveauDeXp. */
  readonly niveau: number;
}

/**
 * La reponse a une inscription ou a une connexion reussie.
 *
 * Le jeton est un SECRET: il vaut le mot de passe pendant la duree de la session.
 * Le client le garde pour lui et le joint a ses demandes, en en-tete HTTP et a
 * l'ouverture de la connexion reseau. Le serveur, lui, n'en garde qu'une empreinte.
 */
export interface SessionOuverte {
  readonly jeton: string;
  readonly compte: CompteConnecte;
}

/**
 * Un code de secours que le serveur vient d'emettre (etape 3.4).
 *
 * C'EST LA SEULE FOIS QUE LE CODE EST MONTRE. Le serveur n'en garde que l'empreinte
 * et ne peut pas le relire: le joueur doit le noter maintenant. Il remplace le code
 * precedent, qui ne vaut plus rien.
 */
export interface CodeDeSecoursEmis {
  /** Le code, en quatre groupes separes par des tirets: « K7QM-3X9D-TP4W-8HNE ». */
  readonly codeDeSecours: string;
}

/**
 * La reponse a une inscription ou a une reinitialisation reussie: une session, et
 * le code de secours qui accompagne le nouveau mot de passe.
 */
export interface SessionInscrite extends SessionOuverte, CodeDeSecoursEmis {}

/**
 * Ce qu'un compte connecte envoie pour changer son mot de passe (etape 3.4).
 *
 * Le mot de passe actuel est exige meme avec une session ouverte: un jeton vole ne
 * doit pas suffire a s'approprier le compte.
 */
export interface DemandeChangementMotDePasse {
  /** Le mot de passe actuel. */
  readonly motDePasse: string;
  /** Le nouveau, soumis a la regle de l'inscription. */
  readonly nouveauMotDePasse: string;
}

/** Ce qu'un compte connecte envoie pour obtenir un nouveau code de secours (etape 3.4). */
export interface DemandeCodeDeSecours {
  /** Le mot de passe actuel. */
  readonly motDePasse: string;
}

/**
 * Ce qu'un joueur qui a oublie son mot de passe envoie pour en choisir un autre
 * (etape 3.4). Aucune session: c'est le code de secours qui fait preuve.
 */
export interface DemandeReinitialisation {
  readonly pseudo: string;
  /** Le code tel que saisi: casse, espaces et tirets n'y comptent pas. */
  readonly codeDeSecours: string;
  readonly nouveauMotDePasse: string;
}

/**
 * La progression d'un compte, telle que son proprietaire la lit.
 *
 * C'est l'action reservee aux comptes que la fiche 3.2 demande de proteger: elle
 * n'est rendue qu'a une demande qui presente une session valide.
 */
export interface MaProgression extends CompteConnecte {
  readonly xpTotale: number;
  readonly pieces: number;
  readonly pointsLigue: number;
  /** Date d'inscription, au format ISO 8601. */
  readonly inscritLe: string;
}

/**
 * Combien de parties le profil montre.
 *
 * Les statistiques, elles, portent sur tout l'historique: le profil ne les calcule
 * pas a partir des seules parties affichees.
 */
export const PARTIES_DU_PROFIL = 10;

/**
 * Le nombre de joueurs a partir duquel une premiere place compte comme une victoire.
 *
 * Une partie jouee seul se termine a la premiere place a coup sur: la compter ferait
 * monter les victoires sans le moindre adversaire. Le seuil est celui des points de
 * ligue (progression.ts), pour la meme raison, mais il n'en depend pas: changer
 * l'une des deux regles n'a pas a changer l'autre.
 */
export const JOUEURS_POUR_UNE_VICTOIRE = 2;

/**
 * Ce que l'historique d'un compte dit de lui (cadrage, section 3, profil).
 *
 * Ces nombres se deduisent des resultats enregistres, a chaque lecture: aucune
 * colonne ne les tient a jour (cadrage, section 5).
 */
export interface StatistiquesDuCompte {
  readonly partiesJouees: number;
  /** Premieres places dans une partie d'au moins JOUEURS_POUR_UNE_VICTOIRE joueurs. */
  readonly victoires: number;
  /** Le meilleur score d'une partie. Absent tant qu'aucune partie n'est enregistree. */
  readonly meilleurScore?: number;
  /**
   * Le record personnel en Massacre: le meilleur score d'une partie Massacre jouee seul
   * (etape 7.4, decision 7 du porteur du projet). Absent tant qu'il n'y en a aucune.
   */
  readonly recordMassacreSolo?: number;
}

/** Une partie de l'historique d'un compte, telle que son profil la montre. */
export interface PartieDuProfil {
  readonly mode: Mode;
  /** Une partie ancienne peut porter une carte retiree du jeu depuis (etape 7.6). */
  readonly carte: CarteEnregistree;
  readonly modeMiroir: boolean;
  /** 1 pour le premier. */
  readonly placement: number;
  /** Tous les joueurs de la partie, invites et abandons compris. */
  readonly nombreJoueurs: number;
  readonly points: number;
  readonly xpGagnee: number;
  readonly piecesGagnees: number;
  /** Signee, telle qu'appliquee. */
  readonly variationPointsLigue: number;
  /** Fin de la partie, au format ISO 8601. */
  readonly termineeLe: string;
}

/**
 * Le profil d'un compte, tel que son proprietaire le lit (cadrage, section 3).
 *
 * Reserve, comme la progression, a une demande qui presente une session valide: le
 * profil d'un compte n'est montre qu'a lui. Pas de rang mondial, de pass de saison,
 * de skins, de succes ni de clan: reportes apres la v1.
 */
export interface ProfilDuCompte extends MaProgression {
  readonly statistiques: StatistiquesDuCompte;
  /** Les PARTIES_DU_PROFIL dernieres parties, de la plus recente a la plus ancienne. */
  readonly dernieresParties: readonly PartieDuProfil[];
  /**
   * Le compte a un code de secours (etape 3.4). Le code lui-meme ne se relit jamais:
   * le profil dit seulement s'il en existe un, pour qu'un compte cree avant l'etape,
   * qui n'en a pas, le sache et en cree un.
   */
  readonly codeDeSecours: boolean;
}

/** Le corps d'une reponse HTTP refusee. */
export interface ReponseRefusee {
  readonly erreurs: readonly ErreurValidation[];
}

/**
 * Ce que le client joint a l'ouverture de sa connexion Socket.IO.
 *
 * Sans jeton, la connexion est celle d'un invite. Avec un jeton, elle est celle
 * d'un compte, ou elle est refusee si la session n'est pas valide: un joueur qui
 * se croit connecte ne doit pas jouer en invite sans le savoir, et perdre la
 * progression de sa partie.
 *
 * La version (etape 5.3) est le commit dont la page est construite: un serveur
 * construit d'un autre commit refuse le lien. Voir version.ts.
 */
export interface AuthentificationReseau {
  readonly jeton?: string;
  readonly version?: string;
}
