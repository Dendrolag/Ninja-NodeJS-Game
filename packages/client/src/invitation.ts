/**
 * Le lien d'invitation d'une partie privee (etape 2.7): le lire dans l'adresse de la
 * page, le fabriquer pour le partager, et l'oublier une fois qu'il a servi.
 *
 * UN LIEN, C'EST L'ADRESSE DE LA PAGE AVEC `?partie=CODE`. Il pointe vers la page,
 * pas vers le serveur de jeu: en production, la page est servie par un hebergeur et
 * le serveur par un autre (etape 5.3). Ouvert, il mene a l'accueil, qui propose
 * d'entrer dans cette partie.
 *
 * LE CODE EST VERIFIE PAR LA REGLE DU SERVEUR. validerCodeInvitation le ramene a sa
 * forme canonique (majuscules, sans espaces) et refuse ce qui n'a pas la forme d'un
 * code. Un code mal forme ne part jamais au serveur: l'accueil dit que le lien n'est
 * pas valable. Un code bien forme mais inconnu est refuse par le serveur, comme
 * s'il avait ete tape.
 *
 * AUCUN ETAT: des fonctions pures sur des adresses, et un branchement qui recoit la
 * fenetre en parametre, pour que les tests lui en donnent une d'essai.
 */

import { validerCodeInvitation } from '@neon-ninja/shared';

import type { Client } from './client.js';

/** Le nom du parametre de l'adresse qui porte le code. */
export const PARAMETRE_INVITATION = 'partie';

/** Une invitation lue dans l'adresse de la page. */
export type Invitation =
  /** Un code bien forme, sous sa forme canonique. */
  | { readonly nature: 'code'; readonly code: string }
  /** Un parametre qui n'a pas la forme d'un code, et pourquoi. */
  | { readonly nature: 'malFormee'; readonly motif: string };

/**
 * L'invitation que porte cette adresse, ou rien si elle n'en porte pas.
 *
 * Un parametre present mais vide est une invitation mal formee, pas une absence:
 * le joueur a ouvert un lien d'invitation, il doit apprendre qu'il ne vaut rien.
 *
 * @param recherche La partie de l'adresse qui suit le point d'interrogation, avec lui.
 */
export function lireLInvitation(recherche: string): Invitation | undefined {
  const brut = new URLSearchParams(recherche).get(PARAMETRE_INVITATION);

  if (brut === null) {
    return undefined;
  }

  const verdict = validerCodeInvitation(brut);

  return verdict.valide
    ? { nature: 'code', code: verdict.valeur }
    : {
        nature: 'malFormee',
        motif: verdict.erreurs[0]?.motif ?? "Ce code d'invitation n'est pas valable.",
      };
}

/**
 * Le lien d'invitation d'une partie, a partager.
 *
 * L'adresse de la page, sans rien de ce qu'elle portait apres son chemin: ni un
 * releve de performance (`?diagnostic=1`, etape 8.5), ni un fragment. Seul le code
 * s'y ajoute.
 *
 * @param adresseDeLaPage L'adresse complete de la page ou l'on se trouve.
 * @param code            Le code de la partie, sous sa forme canonique.
 */
export function adresseDInvitation(adresseDeLaPage: string, code: string): string {
  const adresse = new URL(adresseDeLaPage);

  adresse.search = '';
  adresse.hash = '';
  adresse.searchParams.set(PARAMETRE_INVITATION, code);

  return adresse.href;
}

/**
 * L'adresse de la page sans son invitation, ou rien si elle n'en porte pas.
 *
 * Les autres parametres restent: un releve de performance demande par l'adresse doit
 * survivre a l'entree en partie.
 */
export function adresseSansInvitation(adresseDeLaPage: string): string | undefined {
  const adresse = new URL(adresseDeLaPage);

  if (!adresse.searchParams.has(PARAMETRE_INVITATION)) {
    return undefined;
  }

  adresse.searchParams.delete(PARAMETRE_INVITATION);

  return adresse.href;
}

/** Ce que le branchement lit et ecrit de la fenetre: son adresse et son historique. */
export interface FenetreDInvitation {
  readonly location: { readonly href: string };
  readonly history: Pick<History, 'replaceState' | 'state'>;
}

/**
 * Retire l'invitation de l'adresse de la page des qu'elle a servi.
 *
 * Elle a servi quand l'etat du client n'en porte plus: une entree acceptee, ou le
 * joueur qui l'ignore. L'adresse change sans recharger la page ni ajouter d'entree
 * a l'historique. Sans cela, recharger la page apres une partie reproposerait
 * d'entrer dans une partie finie.
 *
 * Rend de quoi arreter d'ecouter.
 */
export function brancherLAdresseDInvitation(
  client: Pick<Client, 'etat' | 'abonner'>,
  fenetre: FenetreDInvitation,
): () => void {
  const surChangement = (): void => {
    if (client.etat.invitation !== undefined) {
      return;
    }

    const sansInvitation = adresseSansInvitation(fenetre.location.href);

    if (sansInvitation !== undefined) {
      fenetre.history.replaceState(fenetre.history.state, '', sansInvitation);
    }
  };

  return client.abonner(surChangement);
}
