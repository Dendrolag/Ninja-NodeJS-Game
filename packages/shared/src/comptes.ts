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
 */
export interface AuthentificationReseau {
  readonly jeton?: string;
}
