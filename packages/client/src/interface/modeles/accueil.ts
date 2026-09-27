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
 * CE QUE L'ACCUEIL DIT DU LIEN vient de modeles/lien.ts, que la ligne d'etat des
 * autres ecrans partage (etape 2.6):
 *
 *   - UN LIEN REFUSE SE DIT, ET LE JOUEUR CHOISIT (decision du 11 septembre 2026): le
 *     motif, puis reessayer ou, s'il presentait une session, continuer en invite;
 *   - UNE PLACE EN PARTIE SE REPREND AVANT TOUT (etape 2.5): pendant qu'une page
 *     rechargee y retourne, on ne joue pas ailleurs, et si la place est perdue,
 *     l'accueil dit pourquoi;
 *   - UN LIEN PERDU SE RETABLIT (etape 2.6): la page le dit, puis propose de
 *     reessayer si elle n'y parvient pas, sans avoir a recharger;
 *   - UNE PAGE D'UNE AUTRE VERSION SE RECHARGE (etape 5.3): seul un rechargement lui
 *     donne la page qui va avec le serveur.
 *
 * UNE PAGE OUVERTE PAR UN LIEN D'INVITATION (etape 2.7) propose d'entrer dans cette
 * partie: le bouton principal la rejoint par son code, au lieu de la partie rapide. Un
 * compte y entre d'un clic, un invite choisit d'abord son pseudo. Un lien dont le code
 * est mal forme se dit, et rien ne part au serveur.
 */

import { normaliserTexte, validerPseudo } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import type { Invitation } from '../../invitation.js';
import type { EtatDuLien } from './lien.js';
import { modeleDuLien } from './lien.js';

/** L'invitation, telle que l'accueil l'annonce. */
export interface InvitationAffichee {
  readonly titre: string;
  readonly texte: string;
  /** Le code de la partie; absent quand le lien est mal forme. */
  readonly code: string | undefined;
}

/** Ce que l'accueil affiche. */
export interface ModeleAccueil {
  readonly lien: EtatDuLien;
  /**
   * Ce que l'accueil dit du lien, y compris quand il est etabli (etape 5.5): le joueur
   * doit voir d'un coup d'oeil que le serveur repond.
   */
  readonly texteDuLien: string;
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
  /** Recharger la page est la seule issue: la page n'est pas de la version du serveur. */
  readonly peutRecharger: boolean;
  /** Le lien peut s'ouvrir a un nouvel essai: il est perdu, ou refuse pour autre chose que la version. */
  readonly peutReessayer: boolean;
  /** Le lien refuse presentait une session: on peut y renoncer et jouer en invite. */
  readonly peutContinuerEnInvite: boolean;
  /** L'invitation lue dans l'adresse de la page, tant qu'elle n'a pas servi (etape 2.7). */
  readonly invitation: InvitationAffichee | undefined;
  /** Le texte du bouton principal: la partie rapide, ou la partie de l'invitation. */
  readonly libelleDuBouton: string;
  /** Le code par lequel entrer; absent pour la partie rapide. */
  readonly codeDEntree: string | undefined;
}

/** Ce que l'accueil dit d'un lien etabli. */
export const TEXTE_LIEN_ETABLI = 'Connecté au serveur';

/** Ce que l'accueil dit a un joueur dont la session gardee a expire. */
export const AVIS_SESSION_EXPIREE =
  'Votre session a expiré : vous jouez en invité. Connectez-vous pour retrouver votre progression.';

/** Ce que l'accueil dit d'une invitation dont le code est bien forme. */
export const TEXTE_INVITATION = 'Une partie privée vous attend.';

/** Ce que l'accueil dit d'un lien d'invitation dont le code est mal forme. */
export const TITRE_INVITATION_MAL_FORMEE = "Ce lien d'invitation n'est pas valable.";

/**
 * Calcule l'accueil.
 *
 * @param etat   L'etat du client.
 * @param saisie Le texte du champ de pseudo, tel quel.
 */
export function modeleAccueil(etat: EtatClient, saisie: string): ModeleAccueil {
  const lien = modeleDuLien(etat);
  const session = etat.session;
  const pseudoRequis = session.nature === 'invite';
  const verdict = validerPseudo(saisie);
  const codeDEntree = etat.invitation?.nature === 'code' ? etat.invitation.code : undefined;

  // Un champ vide n'est pas une faute a signaler: c'est un champ pas encore
  // rempli. Le bouton reste simplement inactif.
  const erreurLocale =
    !pseudoRequis || verdict.valide || normaliserTexte(saisie) === ''
      ? undefined
      : verdict.erreurs[0]?.motif;

  return {
    lien: lien.lien,
    texteDuLien: lien.lien === 'etabli' ? TEXTE_LIEN_ETABLI : lien.texte,
    motifDuLien: lien.motif,
    pseudoRequis,
    pseudoDuCompte: session.nature === 'compte' ? session.progression.pseudo : undefined,
    // Une place perdue passe avant une session expiree: elle vient d'arriver.
    avis:
      etat.avisDeRetour ??
      (session.nature === 'invite' && session.sessionExpiree ? AVIS_SESSION_EXPIREE : undefined),
    erreur: erreurLocale ?? refusDuServeur(etat, saisie, pseudoRequis),
    enAttente: etat.entreeEnCours,
    pseudo: pseudoRequis && verdict.valide ? verdict.valeur : undefined,
    peutJouer: lien.lien === 'etabli' && !etat.entreeEnCours && (!pseudoRequis || verdict.valide),
    peutRecharger: lien.peutRecharger,
    peutReessayer: lien.peutReessayer,
    peutContinuerEnInvite: lien.peutContinuerEnInvite,
    invitation: invitationAffichee(etat.invitation),
    libelleDuBouton: codeDEntree === undefined ? 'Partie rapide' : 'Rejoindre la partie',
    codeDEntree,
  };
}

/** L'invitation mise en forme, ou rien. */
function invitationAffichee(invitation: Invitation | undefined): InvitationAffichee | undefined {
  if (invitation === undefined) {
    return undefined;
  }

  return invitation.nature === 'code'
    ? { titre: 'Invitation', texte: TEXTE_INVITATION, code: invitation.code }
    : { titre: TITRE_INVITATION_MAL_FORMEE, texte: invitation.motif, code: undefined };
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

  // Le refus d'une entree par l'invitation d'un ami s'affiche sur sa carte (etape 2.8).
  if (refus?.action !== 'rejoindre' || etat.invitationsDAmis.tentee !== undefined) {
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
