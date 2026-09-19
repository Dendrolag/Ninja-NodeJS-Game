/**
 * Tests du retablissement d'un lien perdu hors partie (etape 2.6).
 *
 * Ce qu'ils protegent: hors d'une partie en cours, une page qui perd son lien reste
 * sur son ecran et le rouvre d'elle-meme; elle reessaie toutes les trois secondes
 * pendant une minute et demie, puis le dit et laisse relancer; un refus du serveur
 * arrete tout; dans le salon, elle y redemande sa place, par le bon acces et sous le
 * bon pseudo, et dit pourquoi si le salon n'est plus la; la place en partie perdue au
 * bout du delai de retour laisse le lien continuer de se retablir.
 *
 * Le serveur est joue a la main par le banc d'essai du transport, et le temps par une
 * horloge et une minuterie manuelles.
 */

import type { InfosSalon, PartiePublique, ResultatValidation } from '@neon-ninja/shared';
import { DELAI_DE_RETOUR_MS, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerClient } from './client.js';
import { creerCoffreDeJeton } from './comptes/coffre.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import { creerMinuterieManuelle } from './minuterie.js';
import { SERVEUR_INJOIGNABLE, creerReseauFactice } from './reseau.js';
import {
  ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS,
  AVIS_PARTIE_PERDUE,
  AVIS_SALON_PERDU,
  DUREE_DU_RETABLISSEMENT_MS,
} from './retablissement.js';
import { ATTENTE_ENTRE_DEUX_RETOURS_MS } from './retour.js';

/** Le motif d'un lien refuse par le serveur lui-meme. */
const SESSION_INVALIDE = 'Session invalide ou expirée. Reconnectez-vous.';

/** Un jeton de session gardee, pour une page ouverte avec un compte. */
const JETON_DE_SESSION = 'S'.repeat(43);

/** Un salon ou Bob commande et ou Alice attend. */
function salon(modifications: Partial<InfosSalon> = {}): InfosSalon {
  return {
    idRoom: 'room-7',
    statut: 'salon',
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [
      { id: 'j-bob', pseudo: 'Bob', hote: true },
      { id: 'j-alice', pseudo: 'Alice', hote: false },
    ],
    reglages: REGLAGES_PAR_DEFAUT,
    ...modifications,
  };
}

/** Une partie publique, telle que la liste la montre. */
const PARTIE: PartiePublique = {
  idRoom: 'room-1',
  hote: 'Bob',
  mode: 'classique',
  carte: 'map1',
  modeMiroir: false,
  joueurs: 3,
  capacite: 12,
};

/** Ce qu'une page peut avoir en ouvrant. */
interface OptionsDuMontage {
  /** Une session gardee: la page est celle d'un compte. */
  readonly jetonDeSession?: string;
  /** Faux: le lien ne s'etablit pas au montage. */
  readonly connecter?: boolean;
}

/** Un client ouvert, et de quoi jouer le serveur, le temps et le reseau retrouve. */
function monter(options: OptionsDuMontage = {}) {
  const reseau = creerReseauFactice();
  const horloge = creerHorlogeClientManuelle();
  const minuterie = creerMinuterieManuelle();
  const coffre = creerCoffreDeJeton();

  if (options.jetonDeSession !== undefined) {
    coffre.garder(options.jetonDeSession);
  }

  let signaler: (() => void) | undefined;

  const client = creerClient({
    reseau,
    horloge,
    minuterie,
    coffre,
    surReseauRetrouve: (gestionnaire) => {
      signaler = gestionnaire;
      return () => {
        signaler = undefined;
      };
    },
  });

  const avancer = (dtMs: number): void => {
    horloge.avancerDe(dtMs);
    minuterie.avancerDe(dtMs);
  };

  /** La page revient au premier plan, ou le navigateur annonce le reseau retrouve. */
  const reseauRetrouve = (): void => {
    signaler?.();
  };

  /** Repond a la derniere demande d'entree. */
  const repondreALEntree = (reponse: ResultatValidation<InfosSalon>): void => {
    const demande = reseau.dernier('rejoindre');
    if (demande === undefined) {
      throw new Error("Le client n'a demande a entrer nulle part.");
    }
    demande[1](reponse);
  };

  /** Les demandes d'entree emises jusque-la. */
  const demandesDEntree = (): number =>
    reseau.emis.filter((message) => message.nom === 'rejoindre').length;

  /** Le client entre dans le salon, et recoit sa place. */
  const entrerAuSalon = (infos: InfosSalon = salon()): void => {
    client.rejoindre(options.jetonDeSession === undefined ? 'Alice' : undefined);
    reseau.recevoir('placeAttribuee', { joueur: 'j-alice', jetonDeRetour: 'R'.repeat(43) });
    repondreALEntree({ valide: true, valeur: infos });
  };

  client.ouvrir();

  if (options.connecter !== false) {
    reseau.simulerConnexion();
  }

  return {
    reseau,
    minuterie,
    client,
    avancer,
    reseauRetrouve,
    repondreALEntree,
    demandesDEntree,
    entrerAuSalon,
  };
}

describe('hors d une partie, un lien perdu se retablit', () => {
  it('reste sur l ecran ou il est, avec ce qui y est saisi, et rouvre le lien aussitot', () => {
    const { reseau, client } = monter();

    client.naviguer('creation');
    client.saisirPseudo('Alice');
    const ouvertures = reseau.ouvertures.length;
    reseau.simulerDeconnexion();

    expect(client.etat.connexion).toBe('retablissement');
    expect(client.etat.ecran).toBe('creation');
    expect(client.etat.pseudoSaisi).toBe('Alice');
    expect(reseau.ouvertures).toHaveLength(ouvertures + 1);

    reseau.simulerConnexion();

    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.ecran).toBe('creation');
  });

  it('rouvre le lien avec la session gardee, sans passer par sa verification', () => {
    const { reseau, client } = monter({ jetonDeSession: JETON_DE_SESSION });

    reseau.simulerDeconnexion();

    expect(reseau.ouvertures.at(-1)).toEqual({ jeton: JETON_DE_SESSION });
    expect(client.etat.connexion).toBe('retablissement');
  });

  it('reessaie toutes les trois secondes, sans que le reveil s en mele, puis le dit au bout d une minute et demie', () => {
    const { reseau, minuterie, client, avancer } = monter();

    client.naviguer('profil');
    reseau.simulerDeconnexion();
    const ouvertures = reseau.ouvertures.length;

    for (
      let ecoule = 0;
      ecoule < DUREE_DU_RETABLISSEMENT_MS;
      ecoule += ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS
    ) {
      reseau.simulerRefus(SERVEUR_INJOIGNABLE);
      expect(client.etat.connexion, `apres ${String(ecoule)} ms`).toBe('retablissement');
      avancer(ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS);
    }

    expect(reseau.ouvertures).toHaveLength(
      ouvertures + DUREE_DU_RETABLISSEMENT_MS / ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS,
    );

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    // Invite, le profil mene a la connexion: l'ecran reste celui-la.
    expect(client.etat.connexion).toBe('perdue');
    expect(client.etat.ecran).toBe('connexion');
    expect(minuterie.enAttente).toBe(0);
  });

  it('relance une nouvelle serie d essais quand le joueur reessaie apres la perte', () => {
    const { reseau, minuterie, client, avancer } = monter();

    reseau.simulerDeconnexion();
    avancer(DUREE_DU_RETABLISSEMENT_MS);
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    expect(client.etat.connexion).toBe('perdue');
    const ouvertures = reseau.ouvertures.length;

    client.reessayer();

    expect(client.etat.connexion).toBe('retablissement');
    expect(reseau.ouvertures).toHaveLength(ouvertures + 1);

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.connexion).toBe('retablissement');
    expect(minuterie.enAttente).toBe(1);
  });

  it('rouvre aussitot quand la page revient au premier plan, pendant les essais comme apres la perte', () => {
    const { reseau, minuterie, client, avancer, reseauRetrouve } = monter();

    // Lien etabli: rien a faire.
    reseauRetrouve();
    expect(reseau.ouvertures).toHaveLength(1);

    reseau.simulerDeconnexion();
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    const pendant = reseau.ouvertures.length;

    reseauRetrouve();

    expect(reseau.ouvertures).toHaveLength(pendant + 1);
    expect(minuterie.enAttente).toBe(0);

    // Un essai deja en route n'est pas double.
    reseauRetrouve();
    expect(reseau.ouvertures).toHaveLength(pendant + 1);

    avancer(DUREE_DU_RETABLISSEMENT_MS);
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    expect(client.etat.connexion).toBe('perdue');

    reseauRetrouve();

    expect(client.etat.connexion).toBe('retablissement');
    expect(reseau.ouvertures).toHaveLength(pendant + 2);
  });

  it('s arrete sur un refus du serveur lui-meme, qui se dit, et reste sur un menu', () => {
    const { reseau, minuterie, client, avancer } = monter();

    // La creation, et non la liste des parties, qui planifie son propre rafraichissement.
    client.naviguer('creation');
    reseau.simulerDeconnexion();
    reseau.simulerRefus(SESSION_INVALIDE);
    const ouvertures = reseau.ouvertures.length;

    expect(client.etat.connexion).toBe('refusee');
    expect(client.etat.refusDeConnexion).toBe(SESSION_INVALIDE);
    expect(client.etat.ecran).toBe('creation');
    expect(minuterie.enAttente).toBe(0);

    avancer(ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS * 2);
    expect(reseau.ouvertures).toHaveLength(ouvertures);
  });

  it('garde la liste des parties affichee, et la redemande au retour du lien', () => {
    const { reseau, client } = monter();

    client.naviguer('parties');
    reseau.dernier('listerParties')?.[0]([PARTIE]);
    const demandes = reseau.emis.filter((message) => message.nom === 'listerParties').length;

    reseau.simulerDeconnexion();
    expect(client.etat.partiesPubliques).toEqual([PARTIE]);

    reseau.simulerConnexion();

    expect(reseau.emis.filter((message) => message.nom === 'listerParties')).toHaveLength(
      demandes + 1,
    );
    expect(client.etat.listeEnCours).toBe(true);
  });

  it('ne demande pas la liste sans lien, et la demande des qu il s etablit', () => {
    const { reseau, client } = monter({ connecter: false });

    client.naviguer('parties');

    expect(client.etat.listeEnCours).toBe(false);
    expect(reseau.dernier('listerParties')).toBeUndefined();

    reseau.simulerConnexion();

    expect(reseau.dernier('listerParties')).toBeDefined();
    expect(client.etat.listeEnCours).toBe(true);
  });

  it('n oublie aucun essai planifie en se fermant', () => {
    const { reseau, minuterie, client } = monter();

    reseau.simulerDeconnexion();
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    expect(minuterie.enAttente).toBe(1);

    client.fermer();

    expect(minuterie.enAttente).toBe(0);
  });
});

describe('dans le salon, un lien perdu y ramene', () => {
  it('garde le salon affiche sans son decompte, puis y redemande la place par l identifiant d une partie publique', () => {
    const { reseau, client, repondreALEntree, demandesDEntree, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.recevoir('compteARebours', { secondesRestantes: 4, annulable: true });
    reseau.simulerDeconnexion();

    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.connexion).toBe('retablissement');
    expect(client.etat.salon?.idRoom).toBe('room-7');
    expect(client.etat.compteARebours).toBeUndefined();

    const demandes = demandesDEntree();
    reseau.simulerConnexion();

    expect(demandesDEntree()).toBe(demandes + 1);
    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ idRoom: 'room-7', pseudo: 'Alice' });
    expect(client.etat.connexion).toBe('retablissement');
    expect(client.etat.entreeEnCours).toBe(true);

    reseau.recevoir('placeAttribuee', { joueur: 'j-alice-2', jetonDeRetour: 'N'.repeat(43) });
    repondreALEntree({
      valide: true,
      valeur: salon({
        joueurs: [
          { id: 'j-bob', pseudo: 'Bob', hote: true },
          { id: 'j-alice-2', pseudo: 'Alice', hote: false },
        ],
      }),
    });

    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.moi).toBe('j-alice-2');
    expect(client.etat.entreeEnCours).toBe(false);
  });

  it('redemande une partie privee par son code', () => {
    const { reseau, entrerAuSalon } = monter();

    entrerAuSalon(salon({ visibilite: 'privee', code: 'NX7K2P' }));
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ code: 'NX7K2P', pseudo: 'Alice' });
  });

  it('fait revenir un compte sous son propre pseudo, sans en envoyer', () => {
    const { reseau, entrerAuSalon } = monter({ jetonDeSession: JETON_DE_SESSION });

    entrerAuSalon();
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ idRoom: 'room-7' });
  });

  it('ramene a l accueil un salon qui n est plus la, et dit pourquoi', () => {
    const { reseau, client, repondreALEntree, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();
    repondreALEntree({
      valide: false,
      erreurs: [{ champ: 'idRoom', motif: "Cette partie n'existe plus." }],
    });

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.avisDeRetour).toBe(`${AVIS_SALON_PERDU} Cette partie n'existe plus.`);
    expect(client.etat.salon).toBeUndefined();
    expect(client.etat.pseudoSaisi).toBe('Alice');
  });

  it('ignore la reponse d une demande partie sur un lien retombe, et redemande au retour', () => {
    const { reseau, client, demandesDEntree, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();
    const enRoute = reseau.dernier('rejoindre');

    reseau.simulerDeconnexion();
    enRoute?.[1]({ valide: true, valeur: salon() });

    expect(client.etat.connexion).toBe('retablissement');
    expect(client.etat.entreeEnCours).toBe(false);

    const demandes = demandesDEntree();
    reseau.simulerConnexion();

    expect(demandesDEntree()).toBe(demandes + 1);
  });

  it('quitter pendant la coupure n y redemande rien, et les essais continuent depuis l accueil', () => {
    const { reseau, minuterie, client, avancer, demandesDEntree, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.simulerDeconnexion();
    client.quitter();

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('retablissement');

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    expect(minuterie.enAttente).toBe(1);
    avancer(ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS);

    const demandes = demandesDEntree();
    reseau.simulerConnexion();

    expect(demandesDEntree()).toBe(demandes);
    expect(client.etat.connexion).toBe('connecte');
  });

  it('quitter pendant la demande: la reponse ne ramene pas au salon', () => {
    const { reseau, client, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();
    const enRoute = reseau.dernier('rejoindre');

    client.quitter();
    enRoute?.[1]({ valide: true, valeur: salon() });

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.salon).toBeUndefined();
  });

  it('oublie le salon au bout d une minute et demie sans lien, et le dit sur l accueil', () => {
    const { reseau, client, avancer, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.simulerDeconnexion();
    avancer(DUREE_DU_RETABLISSEMENT_MS);
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('perdue');
    expect(client.etat.avisDeRetour).toBe(AVIS_SALON_PERDU);
    expect(client.etat.salon).toBeUndefined();
  });

  it('ne garde pas le salon quand le serveur refuse le lien', () => {
    const { reseau, client, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.simulerDeconnexion();
    reseau.simulerRefus(SESSION_INVALIDE);

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('refusee');
    expect(client.etat.refusDeConnexion).toBe(SESSION_INVALIDE);
    expect(client.etat.salon).toBeUndefined();
  });
});

describe('a la fin de la partie, un lien perdu se retablit', () => {
  it('garde le classement affiche, et ne redemande rien au retour du lien', () => {
    const { reseau, client, demandesDEntree, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.recevoir('partieLancee');
    reseau.recevoir('partieTerminee', { classement: [] });
    reseau.simulerDeconnexion();

    expect(client.etat.ecran).toBe('fin');
    expect(client.etat.connexion).toBe('retablissement');
    expect(client.etat.fin).toBeDefined();

    const demandes = demandesDEntree();
    reseau.simulerConnexion();

    expect(demandesDEntree()).toBe(demandes);
    expect(reseau.dernier('revenir')).toBeUndefined();
    expect(client.etat.ecran).toBe('fin');
    expect(client.etat.connexion).toBe('connecte');
  });
});

describe('apres le delai de retour en partie', () => {
  it('la place perdue ramene a l accueil, le dit, et le lien se retablit jusqu a la minute et demie', () => {
    const { reseau, minuterie, client, avancer, entrerAuSalon } = monter();

    entrerAuSalon();
    reseau.recevoir('partieLancee');
    reseau.simulerDeconnexion();
    expect(client.etat.connexion).toBe('retour');

    for (let ecoule = 0; ecoule < DELAI_DE_RETOUR_MS; ecoule += ATTENTE_ENTRE_DEUX_RETOURS_MS) {
      reseau.simulerRefus(SERVEUR_INJOIGNABLE);
      avancer(ATTENTE_ENTRE_DEUX_RETOURS_MS);
    }

    const ouvertures = reseau.ouvertures.length;
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('retablissement');
    expect(client.etat.avisDeRetour).toBe(AVIS_PARTIE_PERDUE);
    expect(client.etat.salon).toBeUndefined();
    // Le lien se rouvre aussitot, et rien d'autre n'est planifie pour ce refus.
    expect(reseau.ouvertures).toHaveLength(ouvertures + 1);
    expect(minuterie.enAttente).toBe(0);

    for (
      let ecoule = DELAI_DE_RETOUR_MS;
      ecoule < DUREE_DU_RETABLISSEMENT_MS;
      ecoule += ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS
    ) {
      reseau.simulerRefus(SERVEUR_INJOIGNABLE);
      expect(client.etat.connexion, `apres ${String(ecoule)} ms`).toBe('retablissement');
      avancer(ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS);
    }

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.connexion).toBe('perdue');
    expect(client.etat.ecran).toBe('accueil');
    expect(minuterie.enAttente).toBe(0);
  });
});
