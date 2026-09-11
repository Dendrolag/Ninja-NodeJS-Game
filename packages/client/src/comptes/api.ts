/**
 * Les requetes des comptes: s'inscrire, se connecter, se deconnecter, lire sa
 * progression.
 *
 * DERRIERE UNE INTERFACE, COMME LE TRANSPORT DU JEU (etape 4.1). Le reste du client
 * ne sait pas que ces questions passent par HTTP: la session (session.ts) appelle
 * ApiComptes, les tests lui donnent la version d'essai ci-dessous, et seule
 * l'implementation par fetch connait les adresses des routes.
 *
 * POURQUOI HTTP, ET PAS LA CONNEXION DU JEU. C'est le contrat de l'etape 3.2: le
 * jeton s'obtient avant d'ouvrir la connexion du jeu, puisque c'est a son ouverture
 * que le serveur identifie le compte. Voir packages/shared/src/comptes.ts.
 *
 * AUCUNE REQUETE NE LEVE. Un refus rend les motifs du serveur; un serveur
 * injoignable ou une reponse illisible rendent un motif lisible par le joueur.
 * Celui qui appelle n'a donc jamais d'exception a rattraper, et un formulaire a
 * toujours quelque chose a afficher.
 *
 * LE JETON EST UN SECRET. Il ne part qu'en en-tete, jamais dans une adresse, ou il
 * finirait dans les journaux des serveurs et dans l'historique du navigateur.
 */

import type {
  DemandeConnexion,
  DemandeInscription,
  ErreurValidation,
  MaProgression,
  SessionOuverte,
} from '@neon-ninja/shared';
import { PREFIXE_JETON_HTTP, ROUTES_COMPTES } from '@neon-ninja/shared';

/** La reponse a une requete des comptes. */
export type ReponseDesComptes<T> =
  | { readonly acceptee: true; readonly valeur: T }
  | {
      readonly acceptee: false;
      /** Le code HTTP du refus, ou STATUT_INJOIGNABLE si le serveur n'a pas repondu. */
      readonly statut: number;
      readonly erreurs: readonly ErreurValidation[];
    };

/** Le statut d'une requete restee sans reponse: le serveur est injoignable. */
export const STATUT_INJOIGNABLE = 0;

/** Le statut d'une requete refusee faute de session valable. */
export const STATUT_SESSION_ABSENTE = 401;

/** Ce que le client demande aux comptes. */
export interface ApiComptes {
  /** Cree un compte et ouvre sa premiere session. */
  inscrire(demande: DemandeInscription): Promise<ReponseDesComptes<SessionOuverte>>;
  /** Verifie des identifiants et ouvre une session. */
  connecter(demande: DemandeConnexion): Promise<ReponseDesComptes<SessionOuverte>>;
  /** Ferme la session de ce jeton. */
  deconnecter(jeton: string): Promise<ReponseDesComptes<undefined>>;
  /** La progression du compte dont ce jeton ouvre la session. */
  moi(jeton: string): Promise<ReponseDesComptes<MaProgression>>;
}

/** Ce qui envoie une requete HTTP: fetch, ou une piece d'essai qui lui ressemble. */
export type EnvoiHttp = (adresse: string, init: RequestInit) => Promise<Response>;

/** Ce qu'il faut pour parler aux routes des comptes. */
export interface OptionsApiComptesHttp {
  /**
   * L'origine du serveur, sans barre finale.
   *
   * Absente, les requetes partent vers l'origine de la page, ce qui est le cas
   * courant: le serveur sert la page et les routes ensemble.
   */
  readonly url?: string;
  /** L'envoi des requetes. fetch par defaut. */
  readonly envoyer?: EnvoiHttp;
}

/** Ce que le joueur lit quand le serveur ne repond pas. */
export const MOTIF_INJOIGNABLE =
  'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.';

/** Ce que le joueur lit quand la reponse du serveur ne se lit pas. */
const MOTIF_ILLISIBLE = 'La réponse du serveur est illisible. Réessayez plus tard.';

/** Le motif d'un refus dont le corps ne dit rien, selon son code. */
function motifDuStatut(statut: number): string {
  switch (statut) {
    case STATUT_SESSION_ABSENTE:
      return 'Session absente ou expirée. Connectez-vous.';
    case 429:
      return 'Trop de tentatives. Réessayez dans un moment.';
    case 503:
      return 'Les comptes sont indisponibles sur ce serveur.';
    default:
      return 'Le serveur a rencontré une erreur. Réessayez plus tard.';
  }
}

/** Parle aux routes HTTP des comptes. */
export function creerApiComptesHttp(options: OptionsApiComptesHttp = {}): ApiComptes {
  const racine = options.url ?? '';
  const envoyer: EnvoiHttp =
    options.envoyer ?? ((adresse, init) => globalThis.fetch(adresse, init));

  /**
   * Envoie une requete et traduit sa reponse.
   *
   * @param attendUnCorps La reponse acceptee porte une valeur. Sans corps lisible,
   *                      elle est alors traitee comme un refus: rendre undefined a la
   *                      place d'une progression ferait tomber l'ecran plus loin.
   */
  const demander = async <T>(
    chemin: string,
    init: RequestInit,
    attendUnCorps: boolean,
  ): Promise<ReponseDesComptes<T>> => {
    let reponse: Response;

    try {
      // Une reponse qui porte un jeton ou une progression ne se garde dans aucun cache.
      reponse = await envoyer(`${racine}${chemin}`, { ...init, cache: 'no-store' });
    } catch {
      return refusee(STATUT_INJOIGNABLE, MOTIF_INJOIGNABLE);
    }

    const corps = await lireLeCorps(reponse);

    if (reponse.ok) {
      if (attendUnCorps && corps === undefined) {
        return refusee(reponse.status, MOTIF_ILLISIBLE);
      }

      return { acceptee: true, valeur: corps as T };
    }

    return {
      acceptee: false,
      statut: reponse.status,
      erreurs: erreursDuCorps(corps) ?? [
        { champ: 'comptes', motif: motifDuStatut(reponse.status) },
      ],
    };
  };

  return {
    inscrire: (demande) => demander(ROUTES_COMPTES.inscription, envoiJson(demande), true),
    connecter: (demande) => demander(ROUTES_COMPTES.connexion, envoiJson(demande), true),
    deconnecter: (jeton) =>
      demander(
        ROUTES_COMPTES.deconnexion,
        { method: 'POST', headers: entetesDuJeton(jeton) },
        false,
      ),
    moi: (jeton) =>
      demander(ROUTES_COMPTES.moi, { method: 'GET', headers: entetesDuJeton(jeton) }, true),
  };
}

/** Une requete POST qui porte une demande en JSON. */
function envoiJson(demande: DemandeConnexion | DemandeInscription): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(demande),
  };
}

/** L'en-tete qui porte le jeton: « Authorization: Bearer <jeton> ». */
function entetesDuJeton(jeton: string): Record<string, string> {
  return { Authorization: `${PREFIXE_JETON_HTTP}${jeton}` };
}

/** Le corps d'une reponse, lu comme du JSON, ou undefined s'il est vide ou illisible. */
async function lireLeCorps(reponse: Response): Promise<unknown> {
  try {
    const texte = await reponse.text();

    return texte === '' ? undefined : (JSON.parse(texte) as unknown);
  } catch {
    return undefined;
  }
}

/**
 * Les motifs d'un corps de refus, s'il a la forme ReponseRefusee.
 *
 * Le corps vient de notre serveur, mais un mandataire place devant lui peut
 * repondre a sa place, avec un tout autre corps: la forme est donc verifiee.
 */
function erreursDuCorps(corps: unknown): readonly ErreurValidation[] | undefined {
  if (typeof corps !== 'object' || corps === null || !('erreurs' in corps)) {
    return undefined;
  }

  const erreurs = corps.erreurs;

  if (!Array.isArray(erreurs) || erreurs.length === 0) {
    return undefined;
  }

  const lisibles = erreurs.filter(
    (erreur): erreur is ErreurValidation =>
      typeof erreur === 'object' &&
      erreur !== null &&
      typeof (erreur as Record<string, unknown>)['champ'] === 'string' &&
      typeof (erreur as Record<string, unknown>)['motif'] === 'string',
  );

  return lisibles.length === erreurs.length ? lisibles : undefined;
}

/** Un refus a un seul motif. */
function refusee<T>(statut: number, motif: string): ReponseDesComptes<T> {
  return { acceptee: false, statut, erreurs: [{ champ: 'comptes', motif }] };
}

// --------------------------------------------------------------------------
// La version d'essai
// --------------------------------------------------------------------------

/** Le jeton que rend la version d'essai. Il a la forme des vrais. */
export const JETON_DESSAI = 'j'.repeat(43);

/** Une requete recue par la version d'essai. */
export interface AppelDesComptes {
  readonly nom: keyof ApiComptes;
  readonly argument: unknown;
}

/** Les reponses de la version d'essai, remplacables une a une. */
export type ReponsesDesComptes = { -readonly [Nom in keyof ApiComptes]: ApiComptes[Nom] };

/**
 * Des comptes que le test pilote a la main. Pour les tests, et pour eux seuls.
 *
 * Comme le banc d'essai du transport, elle ne simule aucune regle: elle retient ce
 * qu'on lui demande, et rend ce que le test a decide. Par defaut, tout est accepte
 * et le compte est un compte neuf.
 */
export interface ApiComptesFactice extends ApiComptes {
  /** Tout ce qui a ete demande, dans l'ordre. */
  readonly appels: readonly AppelDesComptes[];
  /** Ce que rend chaque requete. Le test remplace celles qu'il examine. */
  readonly reponses: ReponsesDesComptes;
}

/** Une progression de compte neuf, pour les tests. */
export function progressionDEssai(pseudo: string): MaProgression {
  return {
    pseudo,
    niveau: 1,
    xpTotale: 0,
    pieces: 0,
    pointsLigue: 0,
    inscritLe: '2026-09-11T10:00:00.000Z',
  };
}

/** Cree des comptes pilotes a la main. */
export function creerApiComptesFactice(): ApiComptesFactice {
  const appels: AppelDesComptes[] = [];
  let dernierPseudo = 'Alice';

  const reponses: ReponsesDesComptes = {
    inscrire: async (demande) => {
      dernierPseudo = demande.pseudo;
      return {
        acceptee: true,
        valeur: { jeton: JETON_DESSAI, compte: { pseudo: demande.pseudo, niveau: 1 } },
      };
    },
    connecter: async (demande) => {
      dernierPseudo = demande.pseudo;
      return {
        acceptee: true,
        valeur: { jeton: JETON_DESSAI, compte: { pseudo: demande.pseudo, niveau: 1 } },
      };
    },
    deconnecter: async () => ({ acceptee: true, valeur: undefined }),
    moi: async () => ({ acceptee: true, valeur: progressionDEssai(dernierPseudo) }),
  };

  return {
    appels,
    reponses,
    inscrire: (demande) => {
      appels.push({ nom: 'inscrire', argument: demande });
      return reponses.inscrire(demande);
    },
    connecter: (demande) => {
      appels.push({ nom: 'connecter', argument: demande });
      return reponses.connecter(demande);
    },
    deconnecter: (jeton) => {
      appels.push({ nom: 'deconnecter', argument: jeton });
      return reponses.deconnecter(jeton);
    },
    moi: (jeton) => {
      appels.push({ nom: 'moi', argument: jeton });
      return reponses.moi(jeton);
    },
  };
}
