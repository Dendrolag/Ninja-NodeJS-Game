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

import type { ProfilDuCompte, ProgressionDeFin, RelationDAmitie } from '@neon-ninja/shared';
import { reperePseudo } from '@neon-ninja/shared';

import type { Action } from './actions.js';
import { ecranSuivant, estUnEcranDeMenu } from './ecrans.js';
import type { Ecran } from './ecrans.js';
import type {
  EffetActif,
  EtatClient,
  EtatDeLaFiche,
  EtatConnexion,
  InvitationDuSalon,
  MessageAffiche,
  SessionDuClient,
} from './etat.js';
import {
  AMIS_INCONNUS,
  AUCUNE_DEMANDE_DE_COMPTE,
  AUCUNE_INVITATION,
  ETAT_INITIAL,
  FICHE_FERMEE,
  MAX_JOURNAL,
  MAX_MESSAGES,
  PROFIL_INCONNU,
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
  return ficheQuiSuit(etat, etatSuivant(etat, action));
}

/**
 * La fiche d'un joueur ne survit ni a un changement d'ecran, ni au retour en invite
 * (etape 3.5). Ouverte au salon, elle ne doit pas rester par-dessus la partie qui se
 * lance; et un invite n'a pas de fiche a lire.
 */
function ficheQuiSuit(avant: EtatClient, apres: EtatClient): EtatClient {
  if (apres.fiche.statut === 'fermee') {
    return apres;
  }

  return apres.ecran !== avant.ecran || apres.session.nature === 'invite'
    ? { ...apres, fiche: FICHE_FERMEE }
    : apres;
}

/** L'etat apres l'action, la fiche mise a part. */
function etatSuivant(etat: EtatClient, action: Action): EtatClient {
  const ecran = ecranSuivant(etat.ecran, action);

  switch (action.type) {
    // On rouvre: l'identifiant de l'ancien lien ne vaudra plus rien. Pendant qu'un
    // lien perdu se retablit (etape 2.6), une session qui change rouvre le lien a son
    // tour, et les essais continuent: c'est toujours un retablissement.
    case 'ouvertureDemandee':
      return {
        ...etat,
        ecran,
        connexion: etat.connexion === 'retablissement' ? 'retablissement' : 'horsLigne',
        moi: undefined,
        refusDeConnexion: undefined,
      };

    // Un lien neuf: le serveur va redire la presence des amis et les invitations qui
    // attendent (etape 2.8). Celles d'avant ne valent que ce qu'il en redira.
    case 'connexionEtablie':
      return {
        ...etat,
        ecran,
        connexion: 'connecte',
        refusDeConnexion: undefined,
        presences: [],
        invitationsDAmis: { ...etat.invitationsDAmis, recues: [] },
      };

    // Le lien n'a pas pu etre retabli (etape 2.6). Ce qu'on attendait du serveur ne
    // viendra pas. Un salon n'est plus le notre: on repart de l'accueil, avec l'avis.
    // Un menu ou la fin restent affiches, pour que le joueur puisse relancer les essais.
    case 'connexionPerdue':
      return quitteLaPartie(etat.ecran, ecran)
        ? { ...horsDeLaPartie(etat, ecran, 'perdue'), avisDeRetour: action.avis }
        : { ...etat, ecran, connexion: 'perdue', entreeEnCours: false, listeEnCours: false };

    // Tombe hors d'une partie en cours, le lien se retablit (etape 2.6): l'ecran reste,
    // ce qu'on attendait du serveur ne viendra pas, et un decompte affiche n'est plus
    // suivi. Si c'est la place en partie qui vient d'etre perdue, on repart de
    // l'accueil, avec l'avis.
    case 'lienPerdu':
      return quitteLaPartie(etat.ecran, ecran)
        ? { ...horsDeLaPartie(etat, ecran, 'retablissement'), avisDeRetour: action.avis }
        : {
            ...etat,
            ecran,
            connexion: 'retablissement',
            refusDeConnexion: undefined,
            entreeEnCours: false,
            listeEnCours: false,
            compteARebours: undefined,
          };

    // Le lien est revenu, et la demande d'entree dans le salon est partie (etape 2.6):
    // tant que le serveur n'a pas repondu, le salon affiche n'est pas le vrai.
    case 'salonRedemande':
      return {
        ...etat,
        ecran,
        connexion: 'retablissement',
        entreeEnCours: true,
        refus: undefined,
      };

    // Tombe en pleine partie, le lien peut revenir: rien de la partie n'est oublie,
    // l'ecran reste figé sur ce qu'il montrait, et le decompte n'a plus cours.
    case 'lienPerduEnPartie':
      return { ...etat, ecran, connexion: 'retour', compteARebours: undefined };

    case 'retourDemande':
      return { ...etat, ecran, connexion: 'retour', avisDeRetour: undefined };

    case 'retourAccepte':
      return {
        ...etat,
        ecran,
        connexion: 'connecte',
        salon: action.salon,
        entreeEnCours: false,
        refus: undefined,
        avisDeRetour: undefined,
      };

    // La place est perdue, ou le salon introuvable, mais le lien est ouvert: on repart
    // de l'accueil, avec le motif, comme apres une sortie.
    case 'retourRefuse':
      return { ...horsDeLaPartie(etat, ecran, 'connecte'), avisDeRetour: action.motif };

    case 'placeAttribuee':
      return { ...etat, ecran, moi: action.joueur };

    // Un lien refuse ne laisse aucun ecran de partie (etape 2.6): on repart de l'accueil.
    case 'connexionRefusee':
      return quitteLaPartie(etat.ecran, ecran)
        ? { ...horsDeLaPartie(etat, ecran, 'refusee'), refusDeConnexion: action.motif }
        : {
            ...etat,
            ecran,
            connexion: 'refusee',
            refusDeConnexion: action.motif,
            entreeEnCours: false,
          };

    // Aucun refus a montrer: la page attend le serveur, et reessaie d'elle-meme.
    case 'serveurEnReveil':
      return {
        ...etat,
        ecran,
        connexion: 'reveil',
        refusDeConnexion: undefined,
        entreeEnCours: false,
      };

    case 'sessionEnVerification':
      return { ...etat, ecran, session: { nature: 'verification' } };

    // Un joueur qui quitte son compte depuis le profil, ou depuis ses amis, revient a
    // l'accueil, pas a l'ecran de connexion.
    case 'sessionDInvite':
      return {
        ...etat,
        ecran:
          ecran === 'profil' || ecran === 'amis'
            ? 'accueil'
            : ecranPourLaSession(ecran, { nature: 'invite', sessionExpiree: action.expiree }),
        session: { nature: 'invite', sessionExpiree: action.expiree },
        demandeDeCompte: AUCUNE_DEMANDE_DE_COMPTE,
        profil: PROFIL_INCONNU,
        amis: AMIS_INCONNUS,
        presences: [],
        invitationsDAmis: AUCUNE_INVITATION,
      };

    // Les amis d'un autre compte ne sont pas les siens: ils se relisent, et sa presence
    // et ses invitations arriveront par le lien rouvert (etape 2.8).
    case 'sessionDeCompte': {
      const memeCompte =
        etat.session.nature === 'compte' &&
        reperePseudo(etat.session.progression.pseudo) === reperePseudo(action.progression.pseudo);

      return {
        ...etat,
        ecran,
        session: { nature: 'compte', progression: action.progression },
        demandeDeCompte: AUCUNE_DEMANDE_DE_COMPTE,
        profil: PROFIL_INCONNU,
        amis: memeCompte ? etat.amis : AMIS_INCONNUS,
        presences: memeCompte ? etat.presences : [],
        invitationsDAmis: memeCompte ? etat.invitationsDAmis : AUCUNE_INVITATION,
      };
    }

    case 'demandeDeCompteEnvoyee':
      return {
        ...etat,
        ecran,
        demandeDeCompte: {
          enCours: true,
          nature: action.nature,
          pseudo: action.pseudo,
          erreurs: [],
          acceptee: false,
        },
      };

    case 'demandeDeCompteRefusee':
      return {
        ...etat,
        ecran,
        demandeDeCompte: {
          ...etat.demandeDeCompte,
          enCours: false,
          erreurs: action.erreurs,
          acceptee: false,
        },
      };

    case 'demandeDeCompteAcceptee':
      return {
        ...etat,
        ecran,
        demandeDeCompte: { ...etat.demandeDeCompte, enCours: false, erreurs: [], acceptee: true },
      };

    // Le code se montre par-dessus n'importe quel ecran, jusqu'a ce que le joueur l'ait
    // note: un code emis remplace celui qui attendait encore, qui ne vaut plus rien.
    // Le profil deja lu sait desormais que le compte en a un.
    case 'codeDeSecoursEmis':
      return {
        ...etat,
        ecran,
        codeDeSecours: action.code,
        profil:
          etat.profil.statut === 'charge'
            ? { statut: 'charge', profil: { ...etat.profil.profil, codeDeSecours: true } }
            : etat.profil,
      };

    case 'codeDeSecoursNote':
      return { ...etat, ecran, codeDeSecours: undefined };

    case 'profilDemande':
      return { ...etat, ecran, profil: { statut: 'chargement' } };

    // Le profil porte la progression du moment: l'en-tete la suit.
    case 'profilRecu':
      return {
        ...etat,
        ecran,
        profil: { statut: 'charge', profil: action.profil },
        session: sessionDuProfil(etat.session, action.profil),
      };

    case 'profilRefuse':
      return { ...etat, ecran, profil: { statut: 'echec', motif: action.motif } };

    case 'ficheDemandee':
      return { ...etat, ecran, fiche: { statut: 'chargement', pseudo: action.pseudo } };

    // Une reponse ne vaut que pour la fiche qui l'attend encore: le joueur a pu la fermer,
    // ou en ouvrir une autre, entre-temps.
    case 'ficheRecue':
      return ficheALire(etat, action.pseudo)
        ? {
            ...etat,
            ecran,
            fiche: { statut: 'chargee', pseudo: action.pseudo, fiche: action.fiche },
          }
        : etat;

    case 'ficheRefusee':
      return ficheAttendue(etat, action.pseudo)
        ? { ...etat, ecran, fiche: { statut: 'echec', pseudo: action.pseudo, motif: action.motif } }
        : etat;

    case 'ficheFermee':
      return etat.fiche.statut === 'fermee' ? etat : { ...etat, ecran, fiche: FICHE_FERMEE };

    // La derniere liste lue reste affichee pendant qu'une autre se lit.
    case 'amisDemandes':
      return { ...etat, ecran, amis: { ...etat.amis, lecture: action.lecture } };

    // Une reponse ne vaut que pour la lecture qu'on attend encore.
    case 'amisRecus':
      return etat.amis.lecture === action.lecture
        ? {
            ...etat,
            ecran,
            amis: { ...etat.amis, liste: action.liste, lecture: undefined, motifDEchec: undefined },
          }
        : etat;

    case 'amisRefuses':
      return etat.amis.lecture === action.lecture
        ? {
            ...etat,
            ecran,
            amis: { ...etat.amis, lecture: undefined, motifDEchec: action.motif },
          }
        : etat;

    case 'gesteEnvoye':
      return {
        ...etat,
        ecran,
        amis: {
          ...etat.amis,
          geste: { statut: 'enCours', geste: action.geste, pseudo: action.pseudo },
        },
      };

    // La reponse porte la liste a jour, et le pseudo dans l'ecriture du compte, que
    // l'annonce reprend; la fiche ouverte sur ce joueur suit la relation. Une lecture
    // partie avant le geste rendrait une liste plus ancienne: elle ne vaut plus.
    case 'gesteFait':
      return {
        ...etat,
        ecran,
        amis: {
          ...etat.amis,
          liste: action.reponse.amis,
          lecture: undefined,
          motifDEchec: undefined,
          geste: {
            statut: 'fait',
            geste: action.geste,
            pseudo: action.reponse.pseudo,
            relation: action.reponse.relation,
          },
        },
        fiche: ficheApresLeGeste(etat.fiche, action.pseudo, action.reponse.relation),
      };

    case 'gesteRefuse':
      return {
        ...etat,
        ecran,
        amis: {
          ...etat.amis,
          geste: {
            statut: 'refuse',
            geste: action.geste,
            pseudo: action.pseudo,
            motif: action.motif,
          },
        },
      };

    // Un refus de compte ne suit pas le joueur sur un autre ecran. Une demande
    // en cours, elle, continue: sa reponse arrivera.
    // Un refus d'entree non plus: il concernait l'ecran que l'on quitte.
    // Le resultat d'un geste d'amitie non plus, ni celui d'une invitation tentee.
    case 'navigation':
      return {
        ...etat,
        ecran: ecranPourLaSession(ecran, etat.session),
        invitationsDAmis: { ...etat.invitationsDAmis, tentee: undefined },
        demandeDeCompte: etat.demandeDeCompte.enCours
          ? etat.demandeDeCompte
          : AUCUNE_DEMANDE_DE_COMPTE,
        amis:
          etat.amis.geste.statut === 'enCours' || etat.amis.geste.statut === 'aucun'
            ? etat.amis
            : { ...etat.amis, geste: { statut: 'aucun' } },
        refus: undefined,
      };

    // Rendre l'etat lui-meme quand rien ne change evite de reveiller l'application
    // a chaque touche qui ne modifie pas le champ.
    case 'pseudoSaisi':
      return action.pseudo === etat.pseudoSaisi
        ? etat
        : { ...etat, ecran, pseudoSaisi: action.pseudo };

    case 'invitationOuverte':
      return { ...etat, ecran, invitation: action.invitation };

    // La liste entiere des amis en ligne remplace la precedente (etape 2.8).
    case 'presenceDesAmis':
      return { ...etat, ecran, presences: action.presences };

    // Une invitation redite par le serveur, sur un lien neuf, ne se double pas.
    case 'invitationRecue':
      return {
        ...etat,
        ecran,
        invitationsDAmis: {
          ...etat.invitationsDAmis,
          recues: [
            ...etat.invitationsDAmis.recues.filter((recue) => recue.id !== action.invitation.id),
            action.invitation,
          ],
        },
      };

    case 'invitationRetiree':
    case 'invitationDAmiIgnoree':
      return etat.invitationsDAmis.recues.some((recue) => recue.id === action.id)
        ? {
            ...etat,
            ecran,
            invitationsDAmis: {
              ...etat.invitationsDAmis,
              recues: etat.invitationsDAmis.recues.filter((recue) => recue.id !== action.id),
            },
          }
        : etat;

    case 'invitationEnvoyee':
      return {
        ...etat,
        ecran,
        invitationsDAmis: invitationDuSalon(etat, { pseudo: action.pseudo, statut: 'enCours' }),
      };

    case 'invitationPartie':
      return {
        ...etat,
        ecran,
        invitationsDAmis: invitationDuSalon(etat, { pseudo: action.pseudo, statut: 'envoyee' }),
      };

    case 'invitationRefusee':
      return {
        ...etat,
        ecran,
        invitationsDAmis: invitationDuSalon(etat, {
          pseudo: action.pseudo,
          statut: 'refusee',
          motif: action.motif,
        }),
      };

    // Le refus d'une entree par l'invitation ne concerne plus rien a l'ecran.
    case 'invitationIgnoree':
      return {
        ...etat,
        ecran,
        invitation: undefined,
        refus: etat.refus?.action === 'rejoindre' ? undefined : etat.refus,
      };

    case 'listeDemandee':
      return { ...etat, ecran, listeEnCours: true };

    case 'entreeDemandee':
      return {
        ...etat,
        ecran,
        pseudoDemande: action.pseudo ?? etat.pseudoDemande,
        pseudoSaisi: action.pseudo ?? etat.pseudoSaisi,
        entreeEnCours: true,
        refus: undefined,
        avisDeRetour: undefined,
        invitationsDAmis: { ...etat.invitationsDAmis, tentee: action.invitation },
      };

    // Une entree acceptee consomme l'invitation, qu'elle ait servi a entrer ou que le
    // joueur soit alle ailleurs (etape 2.7). L'invitation d'un ami qui a fait entrer
    // aussi, sans attendre que le serveur la retire (etape 2.8), et les invitations
    // envoyees depuis un salon precedent ne concernent plus rien.
    case 'entreeAcceptee': {
      const { recues, tentee } = etat.invitationsDAmis;

      return {
        ...etat,
        ecran,
        salon: action.salon,
        entreeEnCours: false,
        refus: undefined,
        invitation: undefined,
        invitationsDAmis: {
          recues: recues.filter((recue) => recue.id !== tentee),
          tentee: undefined,
          envoyees: [],
        },
      };
    }

    case 'entreeRefusee':
      return {
        ...etat,
        ecran,
        entreeEnCours: false,
        refus: refusDe(action.action, action.erreurs),
      };

    // On quitte de soi-meme: le lien et la session restent, tout le reste s'efface,
    // notre identifiant de joueur compris. Quitter pendant un retour y renonce: le
    // lien, qui etait tombe, va se rouvrir. Quitter un salon dont le lien se retablit
    // laisse les essais continuer, depuis l'accueil (etape 2.6).
    case 'sortie':
      return horsDeLaPartie(
        etat,
        ecran,
        etat.connexion === 'retour' ? 'horsLigne' : etat.connexion,
      );

    // Une photographie de la liste, qui remplace la precedente.
    case 'partiesListees':
      return { ...etat, ecran, partiesPubliques: action.parties, listeEnCours: false };

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
        progressionDeFin: undefined,
        pausePar: undefined,
      };

    // UNE TRAME QUI N'APPREND RIEN REND L'ETAT LUI-MEME, et pas une copie
    // identique: une trame perimee, un delta qui ne s'applique pas, une trame
    // illisible. C'est ce qui permet au magasin de ne reveiller personne, et cela
    // compte: ce message arrive vingt fois par seconde.
    case 'etat': {
      const partie = reconstruire(etat.partie, action.trame);

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

    // La progression du compte, dans l'en-tete, suit ce que la base a ecrit: rien
    // n'est redemande au serveur.
    case 'progressionDeFin':
      return {
        ...etat,
        ecran,
        progressionDeFin: action.progression,
        session: sessionApresLaPartie(etat.session, action.progression),
      };

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

/** La fiche de ce pseudo est-elle ouverte, et attend-elle sa lecture. */
function ficheAttendue(etat: EtatClient, pseudo: string): boolean {
  return etat.fiche.statut === 'chargement' && etat.fiche.pseudo === pseudo;
}

/**
 * La fiche de ce pseudo peut-elle recevoir une lecture: la premiere, qu'elle attend, ou
 * une relecture de la fiche deja lue, apres un geste d'amitie (etape 3.6). Un refus
 * tardif, lui, ne remplace jamais une fiche lue: seule ficheAttendue le laisse passer.
 */
function ficheALire(etat: EtatClient, pseudo: string): boolean {
  return (
    ficheAttendue(etat, pseudo) || (etat.fiche.statut === 'chargee' && etat.fiche.pseudo === pseudo)
  );
}

/**
 * La fiche apres un geste d'amitie sur ce pseudo (etape 3.6): celle de ce joueur prend
 * sa nouvelle relation, et perd les parties jouees ensemble s'il n'est plus un ami.
 * Devenu ami, ses parties ensemble arrivent par la relecture que la session demande.
 */
function ficheApresLeGeste(
  fiche: EtatDeLaFiche,
  pseudo: string,
  relation: RelationDAmitie,
): EtatDeLaFiche {
  if (fiche.statut !== 'chargee' || reperePseudo(fiche.fiche.pseudo) !== reperePseudo(pseudo)) {
    return fiche;
  }

  const { ensemble, ...sansEnsemble } = fiche.fiche;

  return {
    ...fiche,
    fiche:
      relation === 'ami' && ensemble !== undefined
        ? { ...sansEnsemble, relation, ensemble }
        : { ...sansEnsemble, relation },
  };
}

/**
 * Les invitations apres le dernier etat connu d'une invitation envoyee a cet ami: elle
 * remplace la precedente du meme ami (etape 2.8).
 */
function invitationDuSalon(
  etat: EtatClient,
  invitation: InvitationDuSalon,
): EtatClient['invitationsDAmis'] {
  const repere = reperePseudo(invitation.pseudo);

  return {
    ...etat.invitationsDAmis,
    envoyees: [
      ...etat.invitationsDAmis.envoyees.filter(
        (envoyee) => reperePseudo(envoyee.pseudo) !== repere,
      ),
      invitation,
    ],
  };
}

/**
 * L'etat d'un joueur qui n'est plus dans aucune partie, de lui-meme ou non.
 *
 * Tout ce qui tenait a la partie s'efface, notre identifiant de joueur compris.
 * Survivent le pseudo saisi, pour reproposer la saisie, la session, qui ne depend pas
 * du lien, un code de secours pas encore note, que le serveur ne rendra plus, une
 * invitation qui n'a pas servi (etape 2.7), les amis du compte (etape 3.6), leur
 * presence et les invitations recues d'eux (etape 2.8). Celles envoyees depuis le salon
 * quitte ne concernent plus rien.
 */
function horsDeLaPartie(etat: EtatClient, ecran: Ecran, connexion: EtatConnexion): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran,
    connexion,
    pseudoDemande: etat.pseudoDemande,
    pseudoSaisi: etat.pseudoSaisi,
    session: etat.session,
    codeDeSecours: etat.codeDeSecours,
    invitation: etat.invitation,
    amis: etat.amis,
    presences: etat.presences,
    invitationsDAmis: { recues: etat.invitationsDAmis.recues, tentee: undefined, envoyees: [] },
  };
}

/** L'action fait-elle passer d'un ecran de partie (salon, jeu, fin) a un ecran de menu. */
function quitteLaPartie(avant: Ecran, apres: Ecran): boolean {
  return !estUnEcranDeMenu(avant) && estUnEcranDeMenu(apres);
}

/**
 * La session d'un compte, une fois les gains d'une partie enregistres.
 *
 * Seule une partie enregistree change quelque chose, et seulement pour un compte:
 * la progression d'apres remplace celle d'avant, telle que la base l'a rendue.
 */
function sessionApresLaPartie(
  session: SessionDuClient,
  progression: ProgressionDeFin,
): SessionDuClient {
  if (session.nature !== 'compte' || !progression.enregistree) {
    return session;
  }

  const { xpTotale, niveau, pieces, pointsLigue } = progression.apres;

  return {
    nature: 'compte',
    progression: { ...session.progression, xpTotale, niveau, pieces, pointsLigue },
  };
}

/** La session d'un compte, avec la progression que porte son profil. */
function sessionDuProfil(session: SessionDuClient, profil: ProfilDuCompte): SessionDuClient {
  if (session.nature !== 'compte') {
    return session;
  }

  const { pseudo, niveau, xpTotale, pieces, pointsLigue, inscritLe } = profil;

  return {
    nature: 'compte',
    progression: { pseudo, niveau, xpTotale, pieces, pointsLigue, inscritLe },
  };
}

/**
 * L'ecran de menu qui convient a la session.
 *
 * Un compte n'a rien a faire sur l'ecran de connexion, et le profil d'un invite
 * n'existe pas, ni ses amis (etape 3.6): il y est mene a la connexion, qui lui ouvre
 * un compte.
 */
function ecranPourLaSession(ecran: Ecran, session: SessionDuClient): Ecran {
  if (ecran === 'connexion' && session.nature === 'compte') {
    return 'accueil';
  }

  if ((ecran === 'profil' || ecran === 'amis') && session.nature === 'invite') {
    return 'connexion';
  }

  return ecran;
}

/**
 * Les effets affiches apres l'arrivee d'un fait.
 *
 * Trois faits seulement en ajoutent un: le bonus ramasse, le malus ramasse, et
 * le malus subi du fait d'un autre. Tous les autres passent sans rien changer.
 *
 * LES DUREES DES BONUS SE CUMULENT quand un effet deja en cours revient,
 * comportement a preserver numero 10 de CLAUDE.md: on ajoute la duree a la fin
 * prevue. UN MALUS QUI REVIENT REPART DE SA DUREE PLEINE, sans s'ajouter, comme le
 * fait le moteur (remplacer, dans packages/sim): la jauge l'annoncait plus long
 * qu'il n'etait jusqu'a l'etape 7.7.
 */
function effetsApres(effets: readonly EffetActif[], fait: FaitDeJeu): readonly EffetActif[] {
  switch (fait.nature) {
    case 'bonusActive':
      return ajouterLEffet(
        effets,
        'bonus',
        fait.charge.nature,
        true,
        fait.charge.dureeMs,
        fait.instant,
      );

    case 'malusRamasse':
      return ajouterLEffet(
        effets,
        'malus',
        fait.charge.nature,
        false,
        fait.charge.dureeMs,
        fait.instant,
      );

    case 'malusSubi':
      return ajouterLEffet(
        effets,
        'malus',
        fait.charge.nature,
        true,
        fait.charge.dureeMs,
        fait.instant,
      );

    default:
      return effets;
  }
}

/**
 * Ajoute un effet, ou change la fin de celui qui court deja: elle recule de la duree
 * pour un bonus, elle repart de la duree pleine pour un malus.
 *
 * Un effet dont la fin est deja passee ne compte pas comme courant: il vaut
 * mieux repartir de l'instant present que d'ajouter une duree a un passe que
 * personne n'a vu s'ecouler.
 */
function ajouterLEffet(
  effets: readonly EffetActif[],
  categorie: EffetActif['categorie'],
  nature: EffetActif['nature'],
  surMoi: boolean,
  dureeMs: number,
  instant: number,
): readonly EffetActif[] {
  // Les effets deja expires sont oublies au passage: personne ne les affiche
  // plus, et les garder ferait grandir la liste sans fin.
  const enCours = effets.filter((effet) => effet.finPrevueA > instant);
  const courant = enCours.find(
    (effet) => effet.nature === nature && effet.categorie === categorie && effet.surMoi === surMoi,
  );

  if (courant === undefined) {
    return [...enCours, { categorie, nature, surMoi, finPrevueA: instant + dureeMs, dureeMs }];
  }

  const finPrevueA =
    categorie === 'bonus'
      ? courant.finPrevueA + dureeMs
      : Math.max(courant.finPrevueA, instant + dureeMs);

  // La jauge repart pleine: elle se rapporte a ce qui reste au moment du ramassage.
  return enCours.map((effet) =>
    effet === courant ? { ...effet, finPrevueA, dureeMs: finPrevueA - instant } : effet,
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
