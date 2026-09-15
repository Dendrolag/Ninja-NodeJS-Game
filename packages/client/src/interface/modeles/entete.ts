/**
 * Le compte dans l'en-tete commun, sous forme de donnees.
 *
 * CE QUE DIT LE CADRAGE (section 3, en-tete commun): une fois connecte, le niveau
 * avec sa progression, le pseudo, le palier et les pieces. Pas de gemmes, reportees
 * avec une boutique. Un invite y trouve de quoi se connecter.
 *
 * FONCTION PURE. Tout se deduit de la progression gardee dans la session: le niveau
 * de l'XP, le palier des points de ligue, par les regles du paquet partage.
 *
 * RIEN NE MENE HORS D'UNE PARTIE. Pendant le salon, le jeu ou la fin, le compte
 * reste affiche mais ne propose aucune navigation: on sort d'une partie en la
 * quittant, pas en cliquant dans l'en-tete.
 */

import { palierDePoints } from '@neon-ninja/shared';

import { estUnEcranDeMenu } from '../../ecrans.js';
import type { EtatClient } from '../../etat.js';
import { NOMS_DES_PALIERS, barreDeNiveau, formaterNombre } from './progression.js';
import { initiales } from './salon.js';

/** Ce que l'en-tete montre du compte. */
export type ModeleCompteDeLEntete =
  /** La session se verifie: rien a montrer encore. */
  | { readonly nature: 'aucun' }
  /** Un invite: de quoi se connecter, hors partie. */
  | { readonly nature: 'invite'; readonly peutSeConnecter: boolean }
  | {
      readonly nature: 'compte';
      readonly pseudo: string;
      readonly initiales: string;
      readonly niveau: number;
      /** Part du niveau faite, de 0 a 99, pour l'anneau. */
      readonly avancementPourCent: number;
      /** « 40 / 200 XP ». */
      readonly xp: string;
      /** Le nom du palier. */
      readonly palier: string;
      readonly pieces: string;
      /** La carte du compte mene-t-elle au profil. Pas pendant une partie. */
      readonly peutOuvrirLeProfil: boolean;
    };

/** Calcule le compte de l'en-tete. */
export function modeleCompteDeLEntete(etat: EtatClient): ModeleCompteDeLEntete {
  const horsPartie = estUnEcranDeMenu(etat.ecran);

  switch (etat.session.nature) {
    case 'verification':
      return { nature: 'aucun' };

    case 'invite':
      return { nature: 'invite', peutSeConnecter: horsPartie && etat.ecran !== 'connexion' };

    case 'compte': {
      const progression = etat.session.progression;
      const barre = barreDeNiveau(progression.xpTotale);

      return {
        nature: 'compte',
        pseudo: progression.pseudo,
        initiales: initiales(progression.pseudo),
        niveau: barre.niveau,
        avancementPourCent: barre.pourCent,
        xp: barre.xp,
        palier: NOMS_DES_PALIERS[palierDePoints(progression.pointsLigue)],
        pieces: formaterNombre(progression.pieces),
        peutOuvrirLeProfil: horsPartie && etat.ecran !== 'profil',
      };
    }
  }
}
