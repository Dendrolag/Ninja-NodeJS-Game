/**
 * La liste des parties publiques, sous forme de donnees: ce qu'on peut rejoindre, et
 * comment.
 *
 * CE QUE DIT LE CADRAGE (section 3, parties publiques): par partie, l'hote, le mode,
 * la carte avec le miroir, les joueurs sur la capacite, et « Rejoindre »; un champ de
 * code prive; un bouton pour creer. Ni latence, ni compteur de joueurs en ligne, ni
 * filtres de mode, ni statut « en jeu »: une partie commencee n'est pas listee.
 *
 * LA LISTE EST UNE PHOTOGRAPHIE (etape 2.4). Elle est redemandee a chaque arrivee
 * sur l'ecran et sur demande; une partie qui s'est remplie entre-temps refuse
 * l'entree, et ce refus s'affiche.
 *
 * LE CODE EST VERIFIE PAR LA REGLE DU SERVEUR. validerCodeInvitation le ramene a sa
 * forme canonique (majuscules, sans espaces) et refuse ce qui n'a pas la forme d'un
 * code, avant tout envoi.
 *
 * FONCTION PURE: l'etat du client, la saisie du code et le fait qu'un envoi ait ete
 * tente en entree; ce qu'il faut afficher en sortie.
 */

import type { PartiePublique } from '@neon-ninja/shared';
import { validerCodeInvitation } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { NOMS_DES_MODES, nomDeCarte } from './cartes.js';
import { pseudoDEntree } from './pseudo.js';
import { initiales } from './salon.js';

/** Une partie de la liste, telle qu'on l'affiche. */
export interface PartieAffichee {
  readonly idRoom: string;
  readonly hote: string;
  /** « Salon de Bob ». */
  readonly titre: string;
  readonly initiales: string;
  /** « Classique · Tokyo · Miroir ». */
  readonly details: string;
  /** « 3/12 ». */
  readonly joueurs: string;
}

/** Ce que l'ecran des parties affiche. */
export interface ModeleParties {
  /** « 3 parties ouvertes ». */
  readonly compteur: string;
  readonly parties: readonly PartieAffichee[];
  /** La liste est demandee, et sa reponse n'est pas arrivee. */
  readonly enChargement: boolean;
  /** Aucune partie ne s'est ouverte: l'ecran propose d'en creer une. */
  readonly vide: boolean;
  readonly pseudoRequis: boolean;
  /** Ce qui cloche dans le pseudo saisi par un invite. */
  readonly erreurPseudo: string | undefined;
  /** Ce qui manque a un invite pour rejoindre. */
  readonly aidePseudo: string | undefined;
  /** Le pseudo a envoyer; absent pour un compte. */
  readonly pseudo: string | undefined;
  /** Les boutons pour rejoindre sont-ils actifs. */
  readonly peutRejoindre: boolean;
  /** Ce qui cloche dans le code saisi, une fois l'envoi tente. */
  readonly erreurCode: string | undefined;
  /** Le code saisi, sous sa forme canonique, s'il est bien forme. */
  readonly code: string | undefined;
  /** Le refus d'entree du serveur. */
  readonly refus: string | undefined;
  /** Une demande d'entree attend sa reponse. */
  readonly enAttente: boolean;
  readonly lienEtabli: boolean;
}

/**
 * Calcule l'ecran des parties.
 *
 * @param saisieCode Le texte du champ de code, tel quel.
 * @param codeTente  Le joueur a deja tente d'envoyer ce code.
 */
export function modeleParties(
  etat: EtatClient,
  saisieCode: string,
  codeTente: boolean,
): ModeleParties {
  const pseudo = pseudoDEntree(etat);
  const verdictCode = validerCodeInvitation(saisieCode);
  const lienEtabli = etat.connexion === 'connecte';
  const nombre = etat.partiesPubliques.length;

  return {
    compteur:
      nombre === 0
        ? 'Aucune partie ouverte'
        : `${String(nombre)} ${nombre > 1 ? 'parties ouvertes' : 'partie ouverte'}`,
    parties: etat.partiesPubliques.map(partieAffichee),
    enChargement: etat.listeEnCours,
    vide: !etat.listeEnCours && nombre === 0,
    pseudoRequis: pseudo.requis,
    erreurPseudo: pseudo.erreur,
    aidePseudo: pseudo.manquant ? 'Choisissez un pseudo pour rejoindre une partie.' : undefined,
    pseudo: pseudo.valeur,
    peutRejoindre: lienEtabli && !etat.entreeEnCours && pseudo.pret,
    erreurCode: codeTente && !verdictCode.valide ? verdictCode.erreurs[0]?.motif : undefined,
    code: verdictCode.valide ? verdictCode.valeur : undefined,
    refus:
      etat.refus?.action === 'rejoindre'
        ? etat.refus.erreurs.map((erreur) => erreur.motif).join(' ')
        : undefined,
    enAttente: etat.entreeEnCours,
    lienEtabli,
  };
}

/** Une partie de la liste, mise en forme. */
function partieAffichee(partie: PartiePublique): PartieAffichee {
  return {
    idRoom: partie.idRoom,
    hote: partie.hote,
    titre: `Salon de ${partie.hote}`,
    initiales: initiales(partie.hote),
    details: `${NOMS_DES_MODES[partie.mode]} · ${nomDeCarte(partie.carte, partie.modeMiroir)}`,
    joueurs: `${String(partie.joueurs)}/${String(partie.capacite)}`,
  };
}
