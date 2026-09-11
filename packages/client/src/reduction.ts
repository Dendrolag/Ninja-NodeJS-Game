/**
 * Le calcul de l'etat suivant: une action, un etat, un nouvel etat.
 *
 * TOUTE LA LOGIQUE DE CHANGEMENT DU CLIENT TIENT ICI, dans une fonction pure.
 * Elle ne lit ni horloge, ni reseau, ni page: on lui donne ce qu'elle doit
 * savoir. Un test lui donne donc une suite d'actions et verifie l'etat obtenu, ce
 * qui rend verifiable ce qui, dans le client d'origine, ne se constatait qu'en
 * jouant.
 *
 * ELLE NE MODIFIE JAMAIS L'ETAT RECU: elle en construit un autre. Deux etats
 * successifs peuvent donc coexister, ce dont le rendu de l'etape 4.2 se servira
 * pour lisser l'affichage entre deux battements.
 *
 * CE QU'ELLE NE FAIT PAS, ET NE DOIT JAMAIS FAIRE: aucune regle de jeu. Elle ne
 * decide d'aucune capture, d'aucun score, d'aucune collision. Tout cela est
 * calcule par le serveur et arrive dans le flux. Si une regle de jeu apparaissait
 * ici, ce serait le debut de deux jeux qui divergent, ce qui etait exactement le
 * defaut du client d'origine.
 */

import type { Action } from './actions.js';
import { ecranSuivant } from './ecrans.js';
import type { Ecran } from './ecrans.js';
import type { EffetActif, EtatClient, MessageAffiche, SessionDuClient } from './etat.js';
import {
  AUCUNE_DEMANDE_DE_COMPTE,
  ETAT_INITIAL,
  MAX_JOURNAL,
  MAX_MESSAGES,
  refusDe,
} from './etat.js';
import type { FaitDeJeu } from './faits.js';
import { reconstruire } from './reconstruction.js';

/**
 * Calcule l'etat du client apres une action.
 *
 * @param etat   L'etat avant l'action.
 * @param action Ce qui vient d'arriver.
 */
export function reduire(etat: EtatClient, action: Action): EtatClient {
  const ecran = ecranSuivant(etat.ecran, action);

  switch (action.type) {
    // On rouvre: l'identifiant de l'ancien lien ne vaudra plus rien.
    case 'ouvertureDemandee':
      return {
        ...etat,
        ecran,
        connexion: 'horsLigne',
        moi: undefined,
        refusDeConnexion: undefined,
      };

    case 'connexionEtablie':
      return {
        ...etat,
        ecran,
        connexion: 'connecte',
        moi: action.identifiant,
        refusDeConnexion: undefined,
      };

    // Le lien est tombe: on ne sait plus rien de la partie, et on ne peut plus
    // rien en apprendre. Survivent le pseudo saisi, pour reproposer la saisie, et
    // la session, qui ne depend pas du lien.
    case 'connexionPerdue':
      return {
        ...ETAT_INITIAL,
        ecran,
        connexion: 'perdue',
        pseudoDemande: etat.pseudoDemande,
        session: etat.session,
      };

    case 'connexionRefusee':
      return {
        ...etat,
        ecran,
        connexion: 'refusee',
        refusDeConnexion: action.motif,
        entreeEnCours: false,
      };

    case 'sessionEnVerification':
      return { ...etat, ecran, session: { nature: 'verification' } };

    case 'sessionDInvite':
      return {
        ...etat,
        ecran: ecranPourLaSession(ecran, { nature: 'invite', sessionExpiree: action.expiree }),
        session: { nature: 'invite', sessionExpiree: action.expiree },
        demandeDeCompte: AUCUNE_DEMANDE_DE_COMPTE,
      };

    case 'sessionDeCompte':
      return {
        ...etat,
        ecran,
        session: { nature: 'compte', progression: action.progression },
        demandeDeCompte: AUCUNE_DEMANDE_DE_COMPTE,
      };

    case 'demandeDeCompteEnvoyee':
      return {
        ...etat,
        ecran,
        demandeDeCompte: {
          enCours: true,
          nature: action.nature,
          pseudo: action.pseudo,
          erreurs: [],
        },
      };

    case 'demandeDeCompteRefusee':
      return {
        ...etat,
        ecran,
        demandeDeCompte: { ...etat.demandeDeCompte, enCours: false, erreurs: action.erreurs },
      };

    // Un refus de compte ne suit pas le joueur sur un autre ecran. Une demande
    // en cours, elle, continue: sa reponse arrivera.
    case 'navigation':
      return {
        ...etat,
        ecran: ecranPourLaSession(ecran, etat.session),
        demandeDeCompte: etat.demandeDeCompte.enCours
          ? etat.demandeDeCompte
          : AUCUNE_DEMANDE_DE_COMPTE,
      };

    case 'entreeDemandee':
      return {
        ...etat,
        ecran,
        pseudoDemande: action.pseudo ?? etat.pseudoDemande,
        entreeEnCours: true,
        refus: undefined,
      };

    case 'entreeAcceptee':
      return { ...etat, ecran, salon: action.salon, entreeEnCours: false, refus: undefined };

    case 'entreeRefusee':
      return {
        ...etat,
        ecran,
        entreeEnCours: false,
        refus: refusDe(action.action, action.erreurs),
      };

    // On quitte de soi-meme: le lien et la session restent, tout le reste s'efface.
    case 'sortie':
      return {
        ...ETAT_INITIAL,
        ecran,
        connexion: etat.connexion,
        moi: etat.moi,
        pseudoDemande: etat.pseudoDemande,
        session: etat.session,
      };

    // Une photographie de la liste, qui remplace la precedente.
    case 'partiesListees':
      return { ...etat, ecran, partiesPubliques: action.parties };

    case 'salon':
      return { ...etat, ecran, salon: action.salon };

    case 'chat':
      return { ...etat, ecran, messages: ajouter(etat.messages, recu(action), MAX_MESSAGES) };

    case 'compteARebours':
      return { ...etat, ecran, compteARebours: action.compte };

    case 'demarrageAnnule':
      return { ...etat, ecran, compteARebours: undefined };

    // La partie commence: on repart d'une page blanche. Oublier la vue est
    // indispensable et pas seulement propre, parce que le numero de battement
    // repart de zero: sans cet oubli, la reconstruction prendrait toute la
    // nouvelle partie pour des messages perimes et n'afficherait plus rien.
    case 'partieLancee':
      return {
        ...etat,
        ecran,
        compteARebours: undefined,
        partie: undefined,
        effets: [],
        journal: [],
        fin: undefined,
        pausePar: undefined,
      };

    // UN INSTANTANE QUI N'APPREND RIEN REND L'ETAT LUI-MEME, et pas une copie
    // identique. C'est ce qui permet au magasin de ne reveiller personne, et
    // cela compte: ce message arrive vingt fois par seconde.
    case 'etat': {
      const partie = reconstruire(etat.partie, action.instantane);

      return partie === etat.partie ? etat : { ...etat, ecran, partie };
    }

    // L'annonce ne touche pas a l'indicateur enPause de la partie: celui-ci
    // vient du flux, qui fait foi et qui renseigne aussi celui qui entre dans une
    // partie deja suspendue. Ce qu'elle apporte en plus, c'est le NOM de l'hote
    // qui a suspendu, que le bandeau affiche et que le flux ne porte pas.
    case 'partieEnPause':
      return { ...etat, ecran, pausePar: action.pause.parPseudo };

    case 'partieReprise':
      return { ...etat, ecran, pausePar: undefined };

    // La partie s'arrete: les effets affiches s'effacent. C'est ce que le legacy
    // faisait avec un message clearMalusEffects, que le contrat ne porte pas
    // parce que la fin de partie suffit a le dire.
    case 'partieTerminee':
      return { ...etat, ecran, fin: action.fin, effets: [] };

    case 'fait':
      return {
        ...etat,
        ecran,
        journal: ajouter(etat.journal, action.fait, MAX_JOURNAL),
        effets: effetsApres(etat.effets, action.fait),
      };

    case 'refus':
      return { ...etat, ecran, refus: action.refus };
  }
}

/**
 * L'ecran de menu qui convient a la session.
 *
 * Un compte n'a rien a faire sur l'ecran de connexion. Les ecrans reserves aux
 * comptes arriveront avec le profil.
 */
function ecranPourLaSession(ecran: Ecran, session: SessionDuClient): Ecran {
  if (ecran === 'connexion' && session.nature === 'compte') {
    return 'accueil';
  }

  return ecran;
}

/**
 * Les effets affiches apres l'arrivee d'un fait.
 *
 * Trois faits seulement en ajoutent un: le bonus ramasse, le malus ramasse, et
 * le malus subi du fait d'un autre. Tous les autres passent sans rien changer.
 *
 * LES DUREES SE CUMULENT quand un effet deja en cours revient, comportement a
 * preserver numero 10 de CLAUDE.md. On ajoute donc la duree a la fin prevue, on
 * ne la remplace pas.
 */
function effetsApres(effets: readonly EffetActif[], fait: FaitDeJeu): readonly EffetActif[] {
  switch (fait.nature) {
    case 'bonusActive':
      return cumuler(effets, 'bonus', fait.charge.nature, fait.charge.dureeMs, fait.instant);

    case 'malusRamasse':
    case 'malusSubi':
      return cumuler(effets, 'malus', fait.charge.nature, fait.charge.dureeMs, fait.instant);

    default:
      return effets;
  }
}

/**
 * Ajoute un effet, ou repousse la fin de celui qui court deja.
 *
 * Un effet dont la fin est deja passee ne compte pas comme courant: il vaut
 * mieux repartir de l'instant present que d'ajouter une duree a un passe que
 * personne n'a vu s'ecouler.
 */
function cumuler(
  effets: readonly EffetActif[],
  categorie: EffetActif['categorie'],
  nature: EffetActif['nature'],
  dureeMs: number,
  instant: number,
): readonly EffetActif[] {
  // Les effets deja expires sont oublies au passage: personne ne les affiche
  // plus, et les garder ferait grandir la liste sans fin.
  const enCours = effets.filter((effet) => effet.finPrevueA > instant);
  const courant = enCours.find((effet) => effet.nature === nature && effet.categorie === categorie);

  if (courant === undefined) {
    return [...enCours, { categorie, nature, finPrevueA: instant + dureeMs }];
  }

  return enCours.map((effet) =>
    effet === courant ? { ...effet, finPrevueA: effet.finPrevueA + dureeMs } : effet,
  );
}

/** Le message de chat, date de son arrivee. */
function recu(action: Extract<Action, { type: 'chat' }>): MessageAffiche {
  return { ...action.message, recuA: action.instant };
}

/**
 * Ajoute un element a une liste bornee, en oubliant les plus anciens.
 *
 * Une liste qui ne se vide jamais est une fuite de memoire dans un onglet laisse
 * ouvert une soiree entiere.
 */
function ajouter<T>(liste: readonly T[], element: T, maximum: number): readonly T[] {
  const complete = [...liste, element];

  return complete.length <= maximum ? complete : complete.slice(complete.length - maximum);
}
