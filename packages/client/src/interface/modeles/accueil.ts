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
 */

import { normaliserTexte, validerPseudo } from '@neon-ninja/shared';

import type { EtatClient, EtatConnexion } from '../../etat.js';

/** Ou en est le lien avec le serveur, du point de vue de l'accueil. */
export type EtatDuLien =
  /** Le lien s'etablit: on attend. */
  | 'enCours'
  /** Le lien est etabli: on peut jouer. */
  | 'etabli'
  /** Le lien a ete perdu. La reconnexion n'existe pas avant l'etape 3.2. */
  | 'perdu';

/** Ce que l'accueil affiche. */
export interface ModeleAccueil {
  readonly lien: EtatDuLien;
  /** Ce qui cloche dans le pseudo saisi, a montrer sous le champ. */
  readonly erreur: string | undefined;
  /** Une demande d'entree attend sa reponse. */
  readonly enAttente: boolean;
  /** Le bouton pour jouer est-il actif. */
  readonly peutJouer: boolean;
}

/** Ce que l'accueil dit de chaque etat du transport. */
const LIEN_SELON_LA_CONNEXION: Readonly<Record<EtatConnexion, EtatDuLien>> = {
  horsLigne: 'enCours',
  connecte: 'etabli',
  perdue: 'perdu',
};

/**
 * Calcule l'accueil.
 *
 * @param etat   L'etat du client.
 * @param saisie Le texte du champ de pseudo, tel quel.
 */
export function modeleAccueil(etat: EtatClient, saisie: string): ModeleAccueil {
  const lien = LIEN_SELON_LA_CONNEXION[etat.connexion];
  const verdict = validerPseudo(saisie);

  // Un champ vide n'est pas une faute a signaler: c'est un champ pas encore
  // rempli. Le bouton reste simplement inactif.
  const erreurLocale =
    verdict.valide || normaliserTexte(saisie) === '' ? undefined : verdict.erreurs[0]?.motif;

  return {
    lien,
    erreur: erreurLocale ?? refusDuServeur(etat, saisie),
    enAttente: etat.entreeEnCours,
    peutJouer: lien === 'etabli' && verdict.valide && !etat.entreeEnCours,
  };
}

/**
 * Le refus du serveur, tant que le joueur n'a pas change de pseudo.
 *
 * Des que la saisie differe du pseudo refuse, le refus ne la concerne plus: le
 * laisser affiche ferait croire que le nouveau pseudo est pris lui aussi.
 */
function refusDuServeur(etat: EtatClient, saisie: string): string | undefined {
  const refus = etat.refus;

  if (refus?.action !== 'rejoindre' || etat.pseudoDemande === undefined) {
    return undefined;
  }

  if (normaliserTexte(etat.pseudoDemande) !== normaliserTexte(saisie)) {
    return undefined;
  }

  return refus.erreurs.map((erreur) => erreur.motif).join(' ');
}
