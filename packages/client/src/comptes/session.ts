/**
 * La session du client: jouer en invite ou avec un compte, et le lien reseau qui va
 * avec.
 *
 * TROIS PIECES, UN SEUL ORDRE. Le jeton est garde par le coffre, la progression se
 * lit par les requetes des comptes, et le lien du jeu s'ouvre en presentant le
 * jeton. Le serveur identifie le compte a l'ouverture du lien, une fois pour toutes
 * (etape 3.2): toute la logique de ce fichier revient donc a savoir quelle session
 * on a AVANT d'ouvrir, et a rouvrir quand elle change.
 *
 * AU DEMARRAGE:
 *
 *   - sans jeton, on ouvre en invite;
 *   - avec un jeton, on lit la progression. Acceptee, on est un compte et on ouvre
 *     avec le jeton. Refusee faute de session, le jeton est oublie, on ouvre en
 *     invite, et l'etat retient que la session a expire, pour que l'accueil le
 *     dise. Restee sans reponse, on garde le jeton et on ouvre avec: le serveur de
 *     jeu tranchera, et la progression sera relue une fois le lien etabli.
 *
 * UN LIEN REFUSE NE SE RABAT JAMAIS EN INVITE EN SILENCE (decision du 11 septembre
 * 2026): un joueur qui se croit connecte ne doit pas jouer toute une partie sans
 * que sa progression compte. Le refus arrive dans l'etat, et c'est le joueur qui
 * choisit de reessayer ou de continuer en invite.
 *
 * RIEN NE CHANGE DE SESSION PENDANT UNE PARTIE. Rouvrir le lien ferait sortir le
 * joueur de son salon, ou de sa partie: les commandes sont ignorees tant que l'etat
 * connait un salon. Les ecrans ne les proposent de toute facon que hors partie.
 *
 * LE JETON N'ENTRE PAS DANS L'ETAT. L'etat se serialise, se compare et se montre
 * dans les tests: un secret n'a rien a y faire. Seul le coffre le connait.
 *
 * LE MOT DE PASSE SE GERE ICI AUSSI (etape 3.4). Un mot de passe oublie se
 * reinitialise avec le code de secours, comme une connexion: la session obtenue
 * remplace celle d'invite. Changer son mot de passe et demander un nouveau code se
 * font depuis le profil, avec la session du compte, qui ne change pas. Chacune de
 * ces demandes, et l'inscription, remet un code de secours: il entre dans l'etat
 * pour s'afficher, a l'inverse du jeton, et en sort des que le joueur l'a note.
 */

import type {
  CodeDeSecoursEmis,
  DemandeChangementMotDePasse,
  DemandeCodeDeSecours,
  DemandeConnexion,
  DemandeInscription,
  DemandeReinitialisation,
  SessionInscrite,
  SessionOuverte,
} from '@neon-ninja/shared';

import type { NatureDemandeDeCompte } from '../etat.js';
import type { Magasin } from '../magasin.js';
import type { Reseau } from '../reseau.js';
import type { ApiComptes, ReponseDesComptes } from './api.js';
import { STATUT_SESSION_ABSENTE } from './api.js';
import type { CoffreDeJeton } from './coffre.js';

/** Ce qu'il faut pour brancher la session. */
export interface OptionsSession {
  readonly magasin: Magasin;
  readonly reseau: Reseau;
  /** Les requetes des comptes. Absentes, on ne joue qu'en invite. */
  readonly api: ApiComptes | undefined;
  readonly coffre: CoffreDeJeton;
  /** Retient une ecoute posee, pour que le client la retire en se fermant. */
  readonly ecouter: (retirer: () => void) => void;
}

/** Ce que le joueur peut demander de sa session. */
export interface CommandesDeSession {
  /** Ouvre le lien du jeu, avec la session gardee s'il y en a une. A appeler une fois, au demarrage. */
  ouvrir(): void;
  /** Rouvre le lien apres un refus, avec la session gardee. */
  reessayer(): void;
  /** Oublie la session gardee, et rouvre le lien en invite. */
  continuerEnInvite(): void;
  /** Se connecte a un compte, puis rouvre le lien avec sa session. */
  seConnecter(demande: DemandeConnexion): void;
  /** Cree un compte, puis rouvre le lien avec sa session. */
  sInscrire(demande: DemandeInscription): void;
  /** Ferme la session, et rouvre le lien en invite. */
  seDeconnecter(): void;
  /** Lit le profil du compte. Sans effet pour un invite, ou pendant qu'une lecture attend. */
  chargerLeProfil(): void;
  /**
   * Choisit un nouveau mot de passe avec le code de secours, puis rouvre le lien avec
   * la session obtenue (etape 3.4).
   */
  reinitialiserMotDePasse(demande: DemandeReinitialisation): void;
  /** Change le mot de passe du compte connecte (etape 3.4). Sans effet pour un invite. */
  changerMotDePasse(demande: DemandeChangementMotDePasse): void;
  /** Demande un nouveau code de secours pour le compte connecte (etape 3.4). */
  demanderUnCodeDeSecours(demande: DemandeCodeDeSecours): void;
  /** Le joueur a note son code de secours: il est oublie (etape 3.4). */
  noterLeCodeDeSecours(): void;
  /**
   * Ouvre la fiche du joueur qui porte ce pseudo, et la lit (etape 3.5). Sans effet
   * pour un invite, qui n'a pas de fiche a lire, ou si cette fiche se lit deja.
   */
  ouvrirLaFiche(pseudo: string): void;
  /** Ferme la fiche ouverte. Une lecture en cours sera ignoree a son arrivee. */
  fermerLaFiche(): void;
}

/** Le motif d'une demande de compte sans comptes a joindre. */
const COMPTES_ABSENTS = 'Les comptes sont indisponibles.';

/** Branche la session sur le magasin et le transport, et rend ses commandes. */
export function brancherLaSession(options: OptionsSession): CommandesDeSession {
  const { magasin, reseau, api, coffre } = options;

  const horsPartie = (): boolean => magasin.etat.salon === undefined;

  /** Ouvre le lien, en presentant ce jeton s'il y en a un. */
  const ouvrirLeLien = (jeton: string | undefined): void => {
    magasin.appliquer({ type: 'ouvertureDemandee' });
    reseau.ouvrir(jeton === undefined ? {} : { jeton });
  };

  /**
   * La session gardee n'ouvre plus rien: on l'oublie, on rouvre le lien en invite, et
   * l'accueil dira qu'elle a expire.
   */
  const perdreLaSession = (): void => {
    coffre.oublier();
    magasin.appliquer({ type: 'sessionDInvite', expiree: true });
    ouvrirLeLien(undefined);
  };

  /** Le demarrage: verifier la session gardee, puis ouvrir. */
  const demarrer = async (): Promise<void> => {
    const jeton = coffre.lire();

    if (jeton === undefined) {
      ouvrirLeLien(undefined);
      return;
    }

    magasin.appliquer({ type: 'sessionEnVerification' });

    if (api === undefined) {
      ouvrirLeLien(jeton);
      return;
    }

    const reponse = await api.moi(jeton);

    // Le joueur a pu changer de session pendant l'attente: la reponse ne le concerne plus.
    if (coffre.lire() !== jeton) {
      return;
    }

    if (reponse.acceptee) {
      magasin.appliquer({ type: 'sessionDeCompte', progression: reponse.valeur });
      ouvrirLeLien(jeton);
      return;
    }

    if (reponse.statut === STATUT_SESSION_ABSENTE) {
      perdreLaSession();
      return;
    }

    ouvrirLeLien(jeton);
  };

  // Un lien ouvert avec un jeton que la lecture de la progression n'a pas pu
  // confirmer: le serveur de jeu vient de l'accepter, la progression peut se relire.
  options.ecouter(
    reseau.surConnexion(() => {
      const jeton = coffre.lire();

      if (api === undefined || jeton === undefined) {
        return;
      }

      if (magasin.etat.session.nature !== 'verification') {
        return;
      }

      void api.moi(jeton).then((reponse) => {
        if (
          reponse.acceptee &&
          coffre.lire() === jeton &&
          magasin.etat.session.nature === 'verification'
        ) {
          magasin.appliquer({ type: 'sessionDeCompte', progression: reponse.valeur });
        }
      });
    }),
  );

  /**
   * Envoie une demande de connexion, d'inscription ou de reinitialisation, puis ouvre
   * la session obtenue.
   *
   * Le jeton n'est garde qu'une fois la progression lue: un compte dont on ne sait
   * rien afficher ne doit pas remplacer la session d'invite. Le code de secours, lui,
   * se montre des qu'il arrive, meme si la suite echoue: le serveur ne le rendra plus.
   */
  const demanderUneSession = (
    nature: NatureDemandeDeCompte,
    pseudo: string,
    envoyer: (comptes: ApiComptes) => Promise<ReponseDesComptes<SessionOuverte | SessionInscrite>>,
  ): void => {
    if (magasin.etat.demandeDeCompte.enCours || !horsPartie()) {
      return;
    }

    magasin.appliquer({ type: 'demandeDeCompteEnvoyee', nature, pseudo });

    if (api === undefined) {
      magasin.appliquer({
        type: 'demandeDeCompteRefusee',
        erreurs: [{ champ: 'comptes', motif: COMPTES_ABSENTS }],
      });
      return;
    }

    void (async () => {
      const session = await envoyer(api);

      if (!session.acceptee) {
        magasin.appliquer({ type: 'demandeDeCompteRefusee', erreurs: session.erreurs });
        return;
      }

      if ('codeDeSecours' in session.valeur) {
        magasin.appliquer({ type: 'codeDeSecoursEmis', code: session.valeur.codeDeSecours });
      }

      const { jeton } = session.valeur;
      const progression = await api.moi(jeton);

      if (!progression.acceptee) {
        magasin.appliquer({ type: 'demandeDeCompteRefusee', erreurs: progression.erreurs });
        return;
      }

      coffre.garder(jeton);
      magasin.appliquer({ type: 'sessionDeCompte', progression: progression.valeur });
      ouvrirLeLien(jeton);
    })();
  };

  /**
   * Envoie une demande faite depuis le profil, qui porte sur le compte connecte et
   * rend un nouveau code de secours (etape 3.4).
   *
   * Une session que le serveur ne reconnait plus se traite comme a la lecture du
   * profil. Un mot de passe faux, lui, est un refus comme un autre (403): il ne
   * deconnecte pas.
   */
  const demanderDepuisLeProfil = (
    nature: 'motDePasse' | 'codeDeSecours',
    envoyer: (comptes: ApiComptes, jeton: string) => Promise<ReponseDesComptes<CodeDeSecoursEmis>>,
  ): void => {
    const jeton = coffre.lire();

    if (
      api === undefined ||
      jeton === undefined ||
      magasin.etat.session.nature !== 'compte' ||
      magasin.etat.demandeDeCompte.enCours ||
      !horsPartie()
    ) {
      return;
    }

    magasin.appliquer({ type: 'demandeDeCompteEnvoyee', nature, pseudo: undefined });

    void envoyer(api, jeton).then((reponse) => {
      // Le joueur a change de session pendant l'attente: la reponse ne le concerne plus.
      if (coffre.lire() !== jeton) {
        return;
      }

      if (reponse.acceptee) {
        magasin.appliquer({ type: 'codeDeSecoursEmis', code: reponse.valeur.codeDeSecours });
        magasin.appliquer({ type: 'demandeDeCompteAcceptee' });
        return;
      }

      if (reponse.statut === STATUT_SESSION_ABSENTE && horsPartie()) {
        perdreLaSession();
        return;
      }

      magasin.appliquer({ type: 'demandeDeCompteRefusee', erreurs: reponse.erreurs });
    });
  };

  return {
    ouvrir: () => {
      void demarrer();
    },

    reessayer: () => {
      if (horsPartie()) {
        void demarrer();
      }
    },

    // La session laissee derriere soi est fermee cote serveur, comme a la
    // deconnexion, sans attendre la reponse: sinon elle restait valide jusqu'a son
    // expiration (recette de l'etape 5.4). Le compte, lui, reste intact. Si le
    // refus venait d'une base injoignable, la fermeture echoue en silence, et la
    // session expirera d'elle-meme.
    continuerEnInvite: () => {
      if (!horsPartie()) {
        return;
      }

      const jeton = coffre.lire();

      coffre.oublier();
      magasin.appliquer({ type: 'sessionDInvite', expiree: false });
      ouvrirLeLien(undefined);

      if (jeton !== undefined && api !== undefined) {
        void api.deconnecter(jeton);
      }
    },

    seConnecter: (demande) => {
      demanderUneSession('connexion', demande.pseudo, (comptes) => comptes.connecter(demande));
    },

    sInscrire: (demande) => {
      demanderUneSession('inscription', demande.pseudo, (comptes) => comptes.inscrire(demande));
    },

    seDeconnecter: () => {
      if (!horsPartie()) {
        return;
      }

      const jeton = coffre.lire();

      // Oublier d'abord: la session ne doit plus etre presentee, que le serveur
      // reponde ou non. Elle expirerait de toute facon.
      coffre.oublier();
      magasin.appliquer({ type: 'sessionDInvite', expiree: false });
      ouvrirLeLien(undefined);

      if (jeton !== undefined && api !== undefined) {
        void api.deconnecter(jeton);
      }
    },

    // Une session expiree decouverte en lisant le profil se traite comme au
    // demarrage: le jeton est oublie, le lien rouvert en invite, et l'accueil le dit.
    chargerLeProfil: () => {
      const jeton = coffre.lire();

      if (
        api === undefined ||
        jeton === undefined ||
        magasin.etat.session.nature === 'invite' ||
        magasin.etat.profil.statut === 'chargement'
      ) {
        return;
      }

      magasin.appliquer({ type: 'profilDemande' });

      void api.profil(jeton).then((reponse) => {
        if (coffre.lire() !== jeton) {
          return;
        }

        if (reponse.acceptee) {
          magasin.appliquer({ type: 'profilRecu', profil: reponse.valeur });
          return;
        }

        if (reponse.statut === STATUT_SESSION_ABSENTE && horsPartie()) {
          perdreLaSession();
          return;
        }

        magasin.appliquer({
          type: 'profilRefuse',
          motif: reponse.erreurs.map((erreur) => erreur.motif).join(' '),
        });
      });
    },

    reinitialiserMotDePasse: (demande) => {
      demanderUneSession('reinitialisation', demande.pseudo, (comptes) =>
        comptes.reinitialiser(demande),
      );
    },

    changerMotDePasse: (demande) => {
      demanderDepuisLeProfil('motDePasse', (comptes, jeton) =>
        comptes.changerMotDePasse(jeton, demande),
      );
    },

    demanderUnCodeDeSecours: (demande) => {
      demanderDepuisLeProfil('codeDeSecours', (comptes, jeton) =>
        comptes.nouveauCodeDeSecours(jeton, demande),
      );
    },

    noterLeCodeDeSecours: () => {
      if (magasin.etat.codeDeSecours !== undefined) {
        magasin.appliquer({ type: 'codeDeSecoursNote' });
      }
    },

    // La fiche s'ouvre aussi pendant une partie, au salon comme a la fin: une session
    // que le serveur ne reconnait plus ne s'y perd donc pas, la fiche dit seulement
    // son refus. Hors partie, elle se traite comme a la lecture du profil.
    ouvrirLaFiche: (pseudo) => {
      const jeton = coffre.lire();
      const fiche = magasin.etat.fiche;

      if (
        api === undefined ||
        jeton === undefined ||
        magasin.etat.session.nature !== 'compte' ||
        (fiche.statut === 'chargement' && fiche.pseudo === pseudo)
      ) {
        return;
      }

      magasin.appliquer({ type: 'ficheDemandee', pseudo });

      void api.joueur(jeton, pseudo).then((reponse) => {
        if (coffre.lire() !== jeton) {
          return;
        }

        if (reponse.acceptee) {
          magasin.appliquer({ type: 'ficheRecue', pseudo, fiche: reponse.valeur });
          return;
        }

        if (reponse.statut === STATUT_SESSION_ABSENTE && horsPartie()) {
          perdreLaSession();
          return;
        }

        magasin.appliquer({
          type: 'ficheRefusee',
          pseudo,
          motif: reponse.erreurs.map((erreur) => erreur.motif).join(' '),
        });
      });
    },

    fermerLaFiche: () => {
      magasin.appliquer({ type: 'ficheFermee' });
    },
  };
}
