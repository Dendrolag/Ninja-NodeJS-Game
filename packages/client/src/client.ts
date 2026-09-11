/**
 * Le cablage: ce qui relie le transport au magasin, et les commandes du joueur
 * au transport.
 *
 * IL NE CONTIENT AUCUN CALCUL. Chaque message recu devient une action, chaque
 * commande devient un message. Rien n'est decide ici: ce que devient l'etat est
 * calcule par reduction.ts, ce que le message veut dire est fixe par le contrat
 * de @neon-ninja/shared. C'est deliberement le fichier le plus bete du paquet, et
 * c'est ce qui permet de lire d'un coup d'oeil la liste complete de ce que le
 * client sait recevoir et de ce qu'il sait demander.
 *
 * TOUS LES EVENEMENTS DU CONTRAT SONT BRANCHES, sans exception, dans les deux
 * sens. Un evenement recu que personne n'ecoute est un silence qu'on ne remarque
 * qu'en jouant, et c'est ce qui rendait le client d'origine si difficile a
 * corriger. Depuis l'etape 2.4, cela comprend la creation de partie et la liste
 * des parties publiques, que les ecrans du jalon 3 appelleront.
 *
 * IL SE FERME. Toutes les ecoutes posees sont retenues et retirees par fermer().
 * Le legacy empilait des ecoutes a chaque entree en partie, si bien qu'un joueur
 * qui rejoignait trois fois traitait chaque message trois fois.
 */

import type {
  ConfigurationPartie,
  DemandeRejoindre,
  InfosSalon,
  IntentionDeplacement,
  ReglagesPartiels,
  ResultatValidation,
} from '@neon-ninja/shared';

import type { ApiComptes } from './comptes/api.js';
import type { CoffreDeJeton } from './comptes/coffre.js';
import { creerCoffreDeJeton } from './comptes/coffre.js';
import type { CommandesDeSession } from './comptes/session.js';
import { brancherLaSession } from './comptes/session.js';
import type { EcranDeMenu } from './ecrans.js';
import type { EtatClient } from './etat.js';
import { fait } from './faits.js';
import type { HorlogeClient } from './horloge.js';
import { horlogeNavigateur } from './horloge.js';
import type { Magasin, Observateur } from './magasin.js';
import { creerMagasin } from './magasin.js';
import type { Reseau } from './reseau.js';

/** Ce qu'il faut pour monter un client. */
export interface OptionsClient {
  /** Le transport. Un vrai en production, un banc d'essai dans les tests. */
  readonly reseau: Reseau;
  /** L'horloge locale. Celle du navigateur par defaut. */
  readonly horloge?: HorlogeClient;
  /** Le magasin. Un neuf par defaut. */
  readonly magasin?: Magasin;
  /** Les requetes des comptes. Absentes, on ne joue qu'en invite. */
  readonly comptes?: ApiComptes;
  /** Le coffre du jeton de session. Un coffre en memoire par defaut. */
  readonly coffre?: CoffreDeJeton;
}

/**
 * Comment viser une partie precise en y entrant.
 *
 * Par son identifiant, choisi dans la liste des parties publiques, ou par le code
 * d'invitation d'une partie privee. Sans l'un ni l'autre, c'est la partie rapide.
 */
export type AccesPartie = { readonly idRoom: string } | { readonly code: string };

/**
 * Un client monte: son etat, et ce que le joueur peut demander.
 *
 * Les commandes portent le nom de l'action du joueur, pas celui de l'evenement
 * reseau. C'est ce que l'interface appelle, et elle n'a pas a connaitre le
 * protocole.
 */
export interface Client extends CommandesDeSession {
  /** L'etat courant. C'est ce que le rendu lit a chaque image. */
  readonly etat: EtatClient;
  /** S'abonne aux changements d'etat. Rend la fonction qui desabonne. */
  abonner(observateur: Observateur): () => void;
  /** Va vers un ecran de menu. Sans effet pendant une partie: on en sort en la quittant. */
  naviguer(vers: EcranDeMenu): void;
  /** Retient le pseudo qu'un invite saisit, pour tous les ecrans qui le demandent. */
  saisirPseudo(pseudo: string): void;
  /**
   * Demande a entrer dans une partie.
   *
   * @param pseudo Le pseudo souhaite. Absent pour un compte, qui entre sous le sien.
   * @param acces  La partie visee. Absent: la partie rapide.
   */
  rejoindre(pseudo: string | undefined, acces?: AccesPartie): void;
  /** Cree une partie et en devient l'hote. Le pseudo est absent pour un compte. */
  creerPartie(pseudo: string | undefined, configuration: ConfigurationPartie): void;
  /** Demande la liste des parties publiques ouvertes. Elle arrive dans l'etat. */
  listerParties(): void;
  /** Quitte la partie sans couper le lien. */
  quitter(): void;
  /** Annonce ou l'on veut aller. */
  deplacer(intention: IntentionDeplacement): void;
  /** Parle dans le chat. */
  parler(texte: string): void;
  /** Change les reglages de la partie. Reserve a l'hote. */
  changerReglages(reglages: ReglagesPartiels): void;
  /** Lance le compte a rebours de demarrage. Reserve a l'hote. */
  demarrer(): void;
  /** Annule le compte a rebours. Reserve a l'hote. */
  annulerDemarrage(): void;
  /** Suspend la partie. Reserve a l'hote. */
  mettreEnPause(): void;
  /** Reprend la partie. Reserve a l'hote. */
  reprendre(): void;
  /** Retire toutes les ecoutes et coupe le lien. */
  fermer(): void;
}

/**
 * Monte un client: le magasin, les ecoutes reseau, et les commandes.
 *
 * Les ecoutes sont posees AVANT que le lien ne soit etabli, de sorte qu'aucun
 * message ne puisse arriver avant que quelqu'un ne l'attende.
 */
export function creerClient(options: OptionsClient): Client {
  const { reseau } = options;
  const horloge = options.horloge ?? horlogeNavigateur;
  const magasin = options.magasin ?? creerMagasin();

  const desabonnements: (() => void)[] = [];

  /** Pose une ecoute et retient de quoi la retirer. */
  const ecouter = (retirer: () => void): void => {
    desabonnements.push(retirer);
  };

  /** Instant local, lu une seule fois par message. */
  const maintenant = (): number => horloge.maintenant();

  /**
   * Ce que devient l'etat quand le serveur repond a une entree ou a une creation.
   *
   * Un refus retient a quelle demande il repond.
   */
  const surReponseDEntree =
    (demande: 'rejoindre' | 'creerPartie') =>
    (reponse: ResultatValidation<InfosSalon>): void => {
      magasin.appliquer(
        reponse.valide
          ? { type: 'entreeAcceptee', salon: reponse.valeur }
          : { type: 'entreeRefusee', action: demande, erreurs: reponse.erreurs },
      );
    };

  // -- L'etat du lien -------------------------------------------------------

  ecouter(
    reseau.surConnexion(() => {
      magasin.appliquer({ type: 'connexionEtablie', identifiant: reseau.identifiant ?? '' });
    }),
  );

  ecouter(
    reseau.surDeconnexion(() => {
      magasin.appliquer({ type: 'connexionPerdue' });
    }),
  );

  ecouter(
    reseau.surRefus((motif) => {
      magasin.appliquer({ type: 'connexionRefusee', motif });
    }),
  );

  // -- La session ------------------------------------------------------------

  const session = brancherLaSession({
    magasin,
    reseau,
    api: options.comptes,
    coffre: options.coffre ?? creerCoffreDeJeton(),
    ecouter,
  });

  /** Demande la liste des parties publiques ouvertes. */
  const listerParties = (): void => {
    magasin.appliquer({ type: 'listeDemandee' });
    reseau.emettre('listerParties', (parties) => {
      magasin.appliquer({ type: 'partiesListees', parties });
    });
  };

  // -- Le salon -------------------------------------------------------------

  ecouter(
    reseau.sur('salon', (salon) => {
      magasin.appliquer({ type: 'salon', salon });
    }),
  );

  ecouter(
    reseau.sur('joueurArrive', (joueur) => {
      magasin.appliquer({ type: 'fait', fait: fait('joueurArrive', joueur, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('joueurParti', (joueur) => {
      magasin.appliquer({ type: 'fait', fait: fait('joueurParti', joueur, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('chat', (message) => {
      magasin.appliquer({ type: 'chat', message, instant: maintenant() });
    }),
  );

  // -- Le cycle de la partie ------------------------------------------------

  ecouter(
    reseau.sur('compteARebours', (compte) => {
      magasin.appliquer({ type: 'compteARebours', compte });
    }),
  );

  ecouter(
    reseau.sur('demarrageAnnule', () => {
      magasin.appliquer({ type: 'demarrageAnnule' });
    }),
  );

  ecouter(
    reseau.sur('partieLancee', () => {
      magasin.appliquer({ type: 'partieLancee' });
    }),
  );

  ecouter(
    reseau.sur('partieEnPause', (pause) => {
      magasin.appliquer({ type: 'partieEnPause', pause });
    }),
  );

  ecouter(
    reseau.sur('partieReprise', () => {
      magasin.appliquer({ type: 'partieReprise' });
    }),
  );

  ecouter(
    reseau.sur('partieTerminee', (fin) => {
      magasin.appliquer({ type: 'partieTerminee', fin });
    }),
  );

  ecouter(
    reseau.sur('progressionDeFin', (progression) => {
      magasin.appliquer({ type: 'progressionDeFin', progression });
    }),
  );

  // -- Le flux d'etat -------------------------------------------------------

  ecouter(
    reseau.sur('etat', (trame) => {
      magasin.appliquer({ type: 'etat', trame });
    }),
  );

  // -- Les notifications adressees ------------------------------------------

  ecouter(
    reseau.sur('captureSubie', (charge) => {
      magasin.appliquer({ type: 'fait', fait: fait('captureSubie', charge, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('captureReussie', (charge) => {
      magasin.appliquer({ type: 'fait', fait: fait('captureReussie', charge, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('captureParBotNoir', (charge) => {
      magasin.appliquer({ type: 'fait', fait: fait('captureParBotNoir', charge, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('botNoirDetruit', (charge) => {
      magasin.appliquer({ type: 'fait', fait: fait('botNoirDetruit', charge, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('bonusActive', (charge) => {
      magasin.appliquer({ type: 'fait', fait: fait('bonusActive', charge, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('malusRamasse', (charge) => {
      magasin.appliquer({ type: 'fait', fait: fait('malusRamasse', charge, maintenant()) });
    }),
  );

  ecouter(
    reseau.sur('malusSubi', (charge) => {
      magasin.appliquer({ type: 'fait', fait: fait('malusSubi', charge, maintenant()) });
    }),
  );

  // -- Les refus ------------------------------------------------------------

  ecouter(
    reseau.sur('refus', (refus) => {
      magasin.appliquer({ type: 'refus', refus });
    }),
  );

  return {
    get etat() {
      return magasin.etat;
    },

    abonner: (observateur) => magasin.abonner(observateur),

    ...session,

    // Le profil se relit a chaque arrivee sur son ecran. La lecture part apres la
    // navigation, et non pendant le montage de l'ecran: un changement d'etat au
    // milieu d'un montage arriverait a l'ecran qu'on quitte.
    naviguer: (vers) => {
      magasin.appliquer({ type: 'navigation', vers });

      // La liste des parties aussi: une photographie ancienne proposerait des
      // parties deja pleines ou lancees.
      if (magasin.etat.ecran === 'profil') {
        session.chargerLeProfil();
      } else if (magasin.etat.ecran === 'parties') {
        listerParties();
      }
    },

    saisirPseudo: (pseudo) => {
      magasin.appliquer({ type: 'pseudoSaisi', pseudo });
    },

    rejoindre: (pseudo, acces) => {
      magasin.appliquer({ type: 'entreeDemandee', pseudo });

      // Le contrat declare le pseudo, l'identifiant et le code optionnels, et les
      // poser a undefined n'est pas la meme chose que ne pas les poser du tout.
      const demande: DemandeRejoindre = { ...pseudoDe(pseudo), ...acces };

      reseau.emettre('rejoindre', demande, surReponseDEntree('rejoindre'));
    },

    creerPartie: (pseudo, configuration) => {
      magasin.appliquer({ type: 'entreeDemandee', pseudo });
      reseau.emettre(
        'creerPartie',
        { ...pseudoDe(pseudo), configuration },
        surReponseDEntree('creerPartie'),
      );
    },

    listerParties,

    quitter: () => {
      reseau.emettre('quitter');
      magasin.appliquer({ type: 'sortie' });
    },

    /**
     * ATTENTION, PIEGE CONNU: ne jamais inverser cette intention quand le malus
     * de controles inverses est actif. C'est le MOTEUR qui inverse, depuis
     * l'etape 1.4 (decision du 14 aout 2026). Le faire aussi ici annulerait le
     * malus, et le defaut serait invisible dans chaque paquet pris separement.
     * La saisie envoie donc toujours la direction que le joueur a demandee.
     */
    deplacer: (intention) => {
      reseau.emettre('deplacer', intention);
    },

    parler: (texte) => {
      reseau.emettre('chat', { texte });
    },

    changerReglages: (reglages) => {
      reseau.emettre('reglages', reglages);
    },

    demarrer: () => {
      reseau.emettre('demarrer');
    },

    annulerDemarrage: () => {
      reseau.emettre('annulerDemarrage');
    },

    mettreEnPause: () => {
      reseau.emettre('mettreEnPause');
    },

    reprendre: () => {
      reseau.emettre('reprendre');
    },

    fermer: () => {
      for (const retirer of desabonnements.splice(0)) {
        retirer();
      }

      reseau.fermer();
    },
  };
}

/** Le pseudo d'une demande, a etaler: absent pour un compte. */
function pseudoDe(pseudo: string | undefined): { readonly pseudo?: string } {
  return pseudo === undefined ? {} : { pseudo };
}
