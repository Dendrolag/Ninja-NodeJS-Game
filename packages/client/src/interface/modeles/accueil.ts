/**
 * L'ecran d'accueil, sous forme de donnees: peut-on jouer, et sinon pourquoi.
 *
 * FONCTION PURE, comme le HUD et la scene. L'ecran lui donne l'etat du client et
 * le texte du champ; elle rend ce qu'il faut afficher. Le jeu d'origine se
 * contentait de desactiver son bouton quand le champ etait vide
 * (client.js, startButton), sans jamais dire pourquoi un pseudo etait refuse:
 * le serveur ne refusait d'ailleurs rien.
 *
 * LE CLIENT REFLETE LA REGLE, IL NE LA REMPLACE PAS. Le pseudo est verifie ici
 * par validerPseudo, la fonction meme que le serveur applique: le joueur voit le
 * refus avant d'envoyer. Mais le serveur verifie a nouveau, et lui seul sait si
 * le pseudo est deja pris dans la partie. Son refus s'affiche au meme endroit.
 *
 * UN INVITE CHOISIT UN PSEUDO, UN COMPTE ENTRE SOUS LE SIEN (etape 3.2). L'accueil
 * ne demande donc de pseudo qu'a un invite.
 *
 * UN LIEN REFUSE SE DIT, ET LE JOUEUR CHOISIT (decision du 11 septembre 2026). Un
 * jeton qui n'ouvre plus rien fait refuser le lien; l'accueil montre le motif, et
 * propose de reessayer ou, s'il presentait une session, de continuer en invite.
 */

import { normaliserTexte, validerPseudo } from '@neon-ninja/shared';

import type { EtatClient, EtatConnexion } from '../../etat.js';

/** Ou en est le lien avec le serveur, du point de vue de l'accueil. */
export type EtatDuLien =
  /** Le lien s'etablit: on attend. */
  | 'enCours'
  /** Le lien est etabli: on peut jouer. */
  | 'etabli'
  /** Le lien a ete perdu. La reconnexion automatique n'existe pas. */
  | 'perdu'
  /** Le lien n'a pas pu s'ouvrir: le serveur l'a refuse, ou ne repond pas. */
  | 'refuse';

/** Ce que l'accueil affiche. */
export interface ModeleAccueil {
  readonly lien: EtatDuLien;
  /** Pourquoi le lien est refuse, tant qu'il l'est. */
  readonly motifDuLien: string | undefined;
  /** Le joueur doit-il choisir un pseudo: un invite oui, un compte non. */
  readonly pseudoRequis: boolean;
  /** Le pseudo du compte sous lequel on jouera, pour un compte. */
  readonly pseudoDuCompte: string | undefined;
  /** Une information sur la session, a montrer tant qu'elle vaut. */
  readonly avis: string | undefined;
  /** Ce qui cloche dans le pseudo saisi, ou le refus du serveur, a montrer sous le champ. */
  readonly erreur: string | undefined;
  /** Une demande d'entree attend sa reponse. */
  readonly enAttente: boolean;
  /** Le pseudo a envoyer, normalise comme le serveur; absent pour un compte, ou tant qu'il est invalide. */
  readonly pseudo: string | undefined;
  /** Le bouton pour jouer est-il actif. */
  readonly peutJouer: boolean;
  /** Le lien refuse presentait une session: on peut y renoncer et jouer en invite. */
  readonly peutContinuerEnInvite: boolean;
}

/** Ce que l'accueil dit de chaque etat du transport. */
const LIEN_SELON_LA_CONNEXION: Readonly<Record<EtatConnexion, EtatDuLien>> = {
  horsLigne: 'enCours',
  connecte: 'etabli',
  perdue: 'perdu',
  refusee: 'refuse',
};

/** Ce que l'accueil dit a un joueur dont la session gardee a expire. */
export const AVIS_SESSION_EXPIREE =
  'Votre session a expiré : vous jouez en invité. Connectez-vous pour retrouver votre progression.';

/**
 * Calcule l'accueil.
 *
 * @param etat   L'etat du client.
 * @param saisie Le texte du champ de pseudo, tel quel.
 */
export function modeleAccueil(etat: EtatClient, saisie: string): ModeleAccueil {
  const lien = LIEN_SELON_LA_CONNEXION[etat.connexion];
  const session = etat.session;
  const pseudoRequis = session.nature === 'invite';
  const verdict = validerPseudo(saisie);

  // Un champ vide n'est pas une faute a signaler: c'est un champ pas encore
  // rempli. Le bouton reste simplement inactif.
  const erreurLocale =
    !pseudoRequis || verdict.valide || normaliserTexte(saisie) === ''
      ? undefined
      : verdict.erreurs[0]?.motif;

  return {
    lien,
    motifDuLien: lien === 'refuse' ? etat.refusDeConnexion : undefined,
    pseudoRequis,
    pseudoDuCompte: session.nature === 'compte' ? session.progression.pseudo : undefined,
    avis: session.nature === 'invite' && session.sessionExpiree ? AVIS_SESSION_EXPIREE : undefined,
    erreur: erreurLocale ?? refusDuServeur(etat, saisie, pseudoRequis),
    enAttente: etat.entreeEnCours,
    pseudo: pseudoRequis && verdict.valide ? verdict.valeur : undefined,
    peutJouer: lien === 'etabli' && !etat.entreeEnCours && (!pseudoRequis || verdict.valide),
    peutContinuerEnInvite: lien === 'refuse' && !pseudoRequis,
  };
}

/**
 * Le refus d'entree du serveur, tant qu'il concerne ce que le joueur a sous les yeux.
 *
 * Pour un invite, des que la saisie differe du pseudo refuse, le refus ne la
 * concerne plus: le laisser affiche ferait croire que le nouveau pseudo est pris
 * lui aussi. Un compte, lui, n'a pas de saisie: le refus reste jusqu'a la demande
 * suivante.
 */
function refusDuServeur(
  etat: EtatClient,
  saisie: string,
  pseudoRequis: boolean,
): string | undefined {
  const refus = etat.refus;

  if (refus?.action !== 'rejoindre') {
    return undefined;
  }

  if (pseudoRequis) {
    if (etat.pseudoDemande === undefined) {
      return undefined;
    }

    if (normaliserTexte(etat.pseudoDemande) !== normaliserTexte(saisie)) {
      return undefined;
    }
  }

  return refus.erreurs.map((erreur) => erreur.motif).join(' ');
}
