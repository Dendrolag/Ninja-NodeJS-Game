/**
 * Ce que le reste du serveur attend des comptes, sans savoir qu'une base existe.
 *
 * DEUX INTERFACES, PARCE QUE DEUX CLIENTS. La couche Socket.IO a besoin de trois
 * questions et d'une ecriture: a quel compte ce jeton ouvre-t-il une session, sous
 * quel pseudo et a quel niveau ce compte entre-t-il en partie, ce pseudo
 * appartient-il a un compte, et, depuis l'etape 3.3, enregistrer la fin d'une
 * partie pour ses comptes. C'est l'annuaire. Les routes HTTP ont besoin, en plus,
 * d'inscrire, de connecter, de deconnecter et de lire la progression. C'est le
 * service.
 *
 * Ni l'un ni l'autre ne nomme la base: Authentification les implemente avec elle,
 * et les tests de la couche reseau peuvent leur substituer une version en memoire.
 * Un serveur sans base n'a ni annuaire ni service, et joue en invites seulement.
 */

import type {
  ErreurValidation,
  MaProgression,
  ProfilDuCompte,
  SessionOuverte,
} from '@neon-ninja/shared';

import type { NouveauResultat, NouvellePartie, ProgressionAppliquee } from '../base/parties.js';

/** Ce sous quoi un compte entre en partie. */
export interface IdentiteDeCompte {
  readonly pseudo: string;
  readonly niveau: number;
}

/** Ce que la couche reseau demande aux comptes. */
export interface AnnuaireDesComptes {
  /**
   * Enregistre une partie terminee: la partie, le resultat de chacun de ses comptes,
   * et leurs gains ajoutes a leur progression, en une seule fois (etape 3.3).
   *
   * @returns L'evolution reellement appliquee a la progression de chaque compte.
   * @throws Si l'enregistrement n'a pas pu se faire: rien n'a alors ete ecrit.
   */
  enregistrerFinDePartie(
    partie: NouvellePartie,
    resultats: readonly NouveauResultat[],
  ): Promise<readonly ProgressionAppliquee[]>;

  /**
   * Le compte dont ce jeton ouvre une session encore valable, ou undefined.
   *
   * Le jeton a deja la bonne forme: la couche reseau l'a valide.
   */
  compteDeSession(jeton: string): Promise<string | undefined>;

  /**
   * Le pseudo et le niveau actuels de ce compte, ou undefined s'il n'existe plus.
   *
   * Lus a chaque entree en partie, et non a l'ouverture de la connexion: le niveau
   * affiche au salon est celui du moment, meme apres une partie qui l'a fait monter.
   */
  identiteDe(compteId: string): Promise<IdentiteDeCompte | undefined>;

  /** Ce pseudo, quelle que soit son ecriture, est-il celui d'un compte. */
  pseudoDeCompte(pseudo: string): Promise<boolean>;
}

/** Pourquoi une demande de compte est refusee. */
export type MotifDeRefus =
  /** La demande est mal formee: 400. */
  | 'demandeInvalide'
  /** Le pseudo demande a l'inscription est deja celui d'un compte: 409. */
  | 'pseudoPris'
  /** Le pseudo ou le mot de passe ne correspondent pas: 401. */
  | 'identifiantsIncorrects'
  /** Aucune session valable n'accompagne la demande: 401. */
  | 'sessionAbsente'
  /** Trop de tentatives recentes: 429. */
  | 'tropDeTentatives';

/** La reponse a une demande de compte. */
export type ReponseDeCompte<T> =
  | { readonly acceptee: true; readonly valeur: T }
  | {
      readonly acceptee: false;
      readonly motif: MotifDeRefus;
      readonly erreurs: readonly ErreurValidation[];
      /** Pour un exces de tentatives: dans combien de temps reessayer. */
      readonly reessayerDansMs?: number;
    };

/** Ce que les routes HTTP des comptes demandent. */
export interface ServiceDeComptes extends AnnuaireDesComptes {
  /**
   * Cree un compte et ouvre sa premiere session.
   *
   * @param demande Le corps de la requete, a valider.
   * @param adresse L'adresse du demandeur, pour la limite de tentatives.
   */
  inscrire(demande: unknown, adresse: string): Promise<ReponseDeCompte<SessionOuverte>>;

  /** Verifie des identifiants et ouvre une session. */
  connecter(demande: unknown, adresse: string): Promise<ReponseDeCompte<SessionOuverte>>;

  /** Ferme la session de ce jeton. Fermer une session deja fermee ne fait rien. */
  deconnecter(jeton: string): Promise<void>;

  /** La progression du compte dont ce jeton ouvre la session. */
  maProgression(jeton: string): Promise<ReponseDeCompte<MaProgression>>;

  /**
   * Le profil du compte dont ce jeton ouvre la session: sa progression, ses
   * statistiques et ses dernieres parties (reprise des ecrans du jalon 3).
   */
  profil(jeton: string): Promise<ReponseDeCompte<ProfilDuCompte>>;
}
