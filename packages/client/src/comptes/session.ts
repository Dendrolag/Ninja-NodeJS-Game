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
 */

import type { DemandeConnexion, DemandeInscription, SessionOuverte } from '@neon-ninja/shared';

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
      coffre.oublier();
      magasin.appliquer({ type: 'sessionDInvite', expiree: true });
      ouvrirLeLien(undefined);
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
   * Envoie une demande de connexion ou d'inscription, puis ouvre la session obtenue.
   *
   * Le jeton n'est garde qu'une fois la progression lue: un compte dont on ne sait
   * rien afficher ne doit pas remplacer la session d'invite.
   */
  const demanderUneSession = (
    nature: NatureDemandeDeCompte,
    pseudo: string,
    envoyer: (comptes: ApiComptes) => Promise<ReponseDesComptes<SessionOuverte>>,
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

  return {
    ouvrir: () => {
      void demarrer();
    },

    reessayer: () => {
      if (horsPartie()) {
        void demarrer();
      }
    },

    // Ce n'est pas une deconnexion: la session n'est pas fermee cote serveur, elle
    // n'est plus presentee. Le refus pouvait venir d'une base momentanement
    // injoignable, et le compte reste intact.
    continuerEnInvite: () => {
      if (!horsPartie()) {
        return;
      }

      coffre.oublier();
      magasin.appliquer({ type: 'sessionDInvite', expiree: false });
      ouvrirLeLien(undefined);
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
          coffre.oublier();
          magasin.appliquer({ type: 'sessionDInvite', expiree: true });
          ouvrirLeLien(undefined);
          return;
        }

        magasin.appliquer({
          type: 'profilRefuse',
          motif: reponse.erreurs.map((erreur) => erreur.motif).join(' '),
        });
      });
    },
  };
}
