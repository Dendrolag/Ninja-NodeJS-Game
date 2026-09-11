/**
 * Le pseudo sous lequel on entre dans une partie: la regle commune a l'accueil, a la
 * liste des parties et a la creation.
 *
 * UN INVITE CHOISIT UN PSEUDO, UN COMPTE ENTRE SOUS LE SIEN (etape 3.2). Pour un
 * invite, le pseudo saisi est verifie par validerPseudo, la fonction meme du
 * serveur; pour un compte, aucun pseudo ne part.
 *
 * FONCTION PURE: elle ne lit que l'etat, ou vit le pseudo saisi.
 */

import { normaliserTexte, validerPseudo } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';

/** Ce qu'il faut savoir du pseudo pour entrer dans une partie. */
export interface PseudoDEntree {
  /** Faut-il un pseudo: un invite oui, un compte non. */
  readonly requis: boolean;
  /** Le pseudo a envoyer, normalise; absent pour un compte, ou tant qu'il est invalide. */
  readonly valeur: string | undefined;
  /** Ce qui cloche dans le pseudo saisi. Un champ vide n'est pas une faute. */
  readonly erreur: string | undefined;
  /** Le champ est vide, alors qu'un pseudo est requis. */
  readonly manquant: boolean;
  /** Peut-on entrer: sans pseudo requis, ou avec un pseudo valide. */
  readonly pret: boolean;
}

/** Le pseudo d'entree, d'apres la session et la saisie. */
export function pseudoDEntree(etat: EtatClient): PseudoDEntree {
  // Une session en verification a presente un jeton que le serveur de jeu
  // acceptera: elle entre sous le pseudo de son compte.
  if (etat.session.nature !== 'invite') {
    return { requis: false, valeur: undefined, erreur: undefined, manquant: false, pret: true };
  }

  const verdict = validerPseudo(etat.pseudoSaisi);
  const manquant = normaliserTexte(etat.pseudoSaisi) === '';

  return {
    requis: true,
    valeur: verdict.valide ? verdict.valeur : undefined,
    erreur: verdict.valide || manquant ? undefined : verdict.erreurs[0]?.motif,
    manquant,
    pret: verdict.valide,
  };
}
