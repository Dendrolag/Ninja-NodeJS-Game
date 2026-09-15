/**
 * Ou en est le lien avec le serveur, sous forme de donnees: ce qu'on en dit, et ce
 * que le joueur peut y faire.
 *
 * UNE SEULE REPONSE, POUR TOUS LES ECRANS (etape 2.6). Jusque-la, seul l'accueil
 * disait ou en etait le lien: il suffisait, puisqu'un lien perdu y ramenait. Depuis
 * que le joueur reste sur son ecran pendant que la page retablit le lien, la ligne
 * d'etat commune (composants/lien.ts) le dit ailleurs, avec les memes mots et les
 * memes boutons que l'accueil, qui calcule son etat du lien ici.
 *
 * FONCTION PURE: l'etat du client en entree, ce qu'il faut afficher en sortie.
 */

import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';

import type { Ecran } from '../../ecrans.js';
import type { EtatClient, EtatConnexion } from '../../etat.js';

/** Ou en est le lien avec le serveur, du point de vue du joueur. */
export type EtatDuLien =
  /** Le lien s'etablit: on attend. */
  | 'enCours'
  /** Le lien est etabli: on peut jouer. */
  | 'etabli'
  /** Le lien a ete perdu, et la page n'a pas pu le retablir. */
  | 'perdu'
  /** Le lien n'a pas pu s'ouvrir: le serveur l'a refuse, ou ne repond toujours pas. */
  | 'refuse'
  /** Le serveur ne repond pas encore: la page reessaie d'elle-meme (etape 5.3). */
  | 'reveil'
  /** Une place en partie attend: la page tente d'y revenir (etape 2.5). */
  | 'retour'
  /** Le lien est tombe hors partie: la page le retablit d'elle-meme (etape 2.6). */
  | 'retablissement';

/** Ce qu'on dit du lien, et ce qu'on propose. */
export interface ModeleDuLien {
  readonly lien: EtatDuLien;
  /** Ce qu'on dit du lien. Vide quand il est etabli. */
  readonly texte: string;
  /** Pourquoi le lien est refuse, tant qu'il l'est. */
  readonly motif: string | undefined;
  /** Recharger la page est la seule issue: la page n'est pas de la version du serveur. */
  readonly peutRecharger: boolean;
  /** Le lien peut s'ouvrir a un nouvel essai: il est perdu, ou refuse pour autre chose que la version. */
  readonly peutReessayer: boolean;
  /** Le lien refuse presentait une session: on peut y renoncer et jouer en invite. */
  readonly peutContinuerEnInvite: boolean;
}

/** Ce que dit un lien perdu que la page retablit, hors du salon. */
export const TEXTE_RETABLISSEMENT = 'Connexion perdue. Reconnexion…';

/** Ce que dit un lien perdu que la page retablit, dans le salon, ou elle retournera. */
export const TEXTE_RETABLISSEMENT_DU_SALON = 'Connexion perdue. Retour dans le salon…';

/** Ce que dit un lien que la page n'a pas pu retablir. */
export const TEXTE_LIEN_PERDU = 'La connexion au serveur a été perdue.';

/** Ce que l'on dit de chaque etat du transport. */
const LIEN_SELON_LA_CONNEXION: Readonly<Record<EtatConnexion, EtatDuLien>> = {
  horsLigne: 'enCours',
  connecte: 'etabli',
  perdue: 'perdu',
  refusee: 'refuse',
  reveil: 'reveil',
  retour: 'retour',
  retablissement: 'retablissement',
};

/** Ce que l'on dit du lien, hors d'un refus, qui dit son propre motif. */
const TEXTES_DU_LIEN: Readonly<Record<Exclude<EtatDuLien, 'refuse' | 'retablissement'>, string>> = {
  enCours: 'Connexion au serveur…',
  etabli: '',
  perdu: TEXTE_LIEN_PERDU,
  reveil:
    'Le serveur de jeu démarre, cela peut prendre jusqu’à une minute. Nouvel essai automatique…',
  retour: 'Retour dans votre partie…',
};

/** Calcule ce qu'on dit du lien, et ce qu'on propose. */
export function modeleDuLien(etat: EtatClient): ModeleDuLien {
  const lien = LIEN_SELON_LA_CONNEXION[etat.connexion];
  const motif = lien === 'refuse' ? etat.refusDeConnexion : undefined;
  const pagePerimee = motif === MOTIF_VERSION_DIFFERENTE;

  return {
    lien,
    texte: texteDuLien(lien, motif, etat.ecran),
    motif,
    peutRecharger: pagePerimee,
    peutReessayer: lien === 'perdu' || (lien === 'refuse' && !pagePerimee),
    peutContinuerEnInvite: lien === 'refuse' && etat.session.nature !== 'invite' && !pagePerimee,
  };
}

/**
 * La ligne d'etat commune doit-elle se montrer.
 *
 * Pas sur l'accueil, qui dit le lien lui-meme, ni en jeu, ou le HUD a son bandeau;
 * nulle part quand le lien est etabli.
 */
export function lienAMontrer(etat: EtatClient): boolean {
  const lien = LIEN_SELON_LA_CONNEXION[etat.connexion];

  return etat.ecran !== 'accueil' && etat.ecran !== 'jeu' && lien !== 'etabli' && lien !== 'retour';
}

/** Ce qu'on dit du lien. */
function texteDuLien(lien: EtatDuLien, motif: string | undefined, ecran: Ecran): string {
  switch (lien) {
    case 'refuse':
      return motif ?? '';
    case 'retablissement':
      return ecran === 'salon' ? TEXTE_RETABLISSEMENT_DU_SALON : TEXTE_RETABLISSEMENT;
    default:
      return TEXTES_DU_LIEN[lien];
  }
}
