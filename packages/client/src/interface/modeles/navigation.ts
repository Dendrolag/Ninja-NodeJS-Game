/**
 * La navigation laterale, sous forme de donnees.
 *
 * SES QUATRE DESTINATIONS EXISTENT DESORMAIS: Jouer, Parties, Creer, Profil. Le
 * cadrage la reprend a ce moment-la (section 3, en-tete commun); elle etait masquee
 * tant que trois de ses entrees auraient mene a des ecrans absents (decision du 10
 * septembre 2026).
 *
 * ELLE N'EST PROPOSEE QUE HORS PARTIE. Dans le salon, en jeu ou a la fin, un clic sur
 * « Parties » ferait quitter la partie sans le dire au serveur: on en sort par ses
 * propres boutons, qui la quittent vraiment.
 *
 * FONCTION PURE.
 */

import type { EcranDeMenu } from '../../ecrans.js';
import { estUnEcranDeMenu } from '../../ecrans.js';
import type { EtatClient } from '../../etat.js';

/** Les ecrans que la navigation propose. La connexion n'y est pas: le profil y mene. */
export type DestinationDeNavigation = Exclude<EcranDeMenu, 'connexion'>;

/** Une entree de la navigation, telle qu'on l'affiche. */
export interface EntreeDeNavigation {
  readonly vers: DestinationDeNavigation;
  readonly libelle: string;
  /** L'entree de l'ecran affiche. */
  readonly actif: boolean;
}

/** Ce que la navigation affiche. */
export interface ModeleNavigation {
  readonly visible: boolean;
  readonly entrees: readonly EntreeDeNavigation[];
}

/** Les entrees, dans l'ordre de la maquette. */
export const DESTINATIONS: readonly {
  readonly vers: DestinationDeNavigation;
  readonly libelle: string;
}[] = [
  { vers: 'accueil', libelle: 'Jouer' },
  { vers: 'parties', libelle: 'Parties' },
  { vers: 'creation', libelle: 'Créer' },
  { vers: 'profil', libelle: 'Profil' },
];

/** Calcule la navigation. */
export function modeleNavigation(etat: EtatClient): ModeleNavigation {
  return {
    visible: estUnEcranDeMenu(etat.ecran),
    entrees: DESTINATIONS.map(({ vers, libelle }) => ({
      vers,
      libelle,
      // L'ecran de connexion est celui du compte: un invite y arrive par le profil.
      actif: etat.ecran === vers || (vers === 'profil' && etat.ecran === 'connexion'),
    })),
  };
}
