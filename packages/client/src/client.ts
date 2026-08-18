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
 * TOUS LES EVENEMENTS DESCENDANTS DU CONTRAT SONT BRANCHES, sans exception. Un
 * evenement recu que personne n'ecoute est un silence qu'on ne remarque qu'en
 * jouant, et c'est ce qui rendait le client d'origine si difficile a corriger.
 *
 * IL SE FERME. Toutes les ecoutes posees sont retenues et retirees par fermer().
 * Le legacy empilait des ecoutes a chaque entree en partie, si bien qu'un joueur
 * qui rejoignait trois fois traitait chaque message trois fois.
 */

import type { DemandeRejoindre, IntentionDeplacement, ReglagesPartiels } from '@neon-ninja/shared';

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
}

/**
 * Un client monte: son etat, et ce que le joueur peut demander.
 *
 * Les commandes portent le nom de l'action du joueur, pas celui de l'evenement
 * reseau. C'est ce que l'interface de l'etape 4.3 appellera, et elle n'a pas a
 * connaitre le protocole.
 */
export interface Client {
  /** L'etat courant. C'est ce que le rendu lit a chaque image. */
  readonly etat: EtatClient;
  /** S'abonne aux changements d'etat. Rend la fonction qui desabonne. */
  abonner(observateur: Observateur): () => void;
  /** Demande a entrer dans une partie, avec ce pseudo. */
  rejoindre(pseudo: string, idRoom?: string): void;
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

  // -- Le flux d'etat -------------------------------------------------------

  ecouter(
    reseau.sur('etat', (instantane) => {
      magasin.appliquer({ type: 'etat', instantane });
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

    rejoindre: (pseudo, idRoom) => {
      magasin.appliquer({ type: 'entreeDemandee', pseudo });

      // L'identifiant absent signifie n'importe quelle partie, et le contrat le
      // declare optionnel: le poser a undefined n'est pas la meme chose que ne
      // pas le poser du tout.
      const demande: DemandeRejoindre = idRoom === undefined ? { pseudo } : { pseudo, idRoom };

      reseau.emettre('rejoindre', demande, (reponse) => {
        magasin.appliquer(
          reponse.valide
            ? { type: 'entreeAcceptee', salon: reponse.valeur }
            : { type: 'entreeRefusee', erreurs: reponse.erreurs },
        );
      });
    },

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
