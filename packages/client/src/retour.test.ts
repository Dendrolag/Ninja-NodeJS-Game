/**
 * Tests du retour en partie apres une coupure (etape 2.5).
 *
 * Ce qu'ils protegent: la page garde le jeton de retour tant que la place vaut
 * quelque chose, et l'oublie sinon; un lien tombe en pleine partie est rouvert
 * pendant le delai de retour, la partie restant affichee, puis le jeton presente;
 * une page rechargee presente sa place des que le lien s'ouvre; tout refus se dit,
 * et rien ne continue d'essayer apres.
 *
 * Le serveur est joue a la main par le banc d'essai du transport, et le temps par
 * une horloge et une minuterie manuelles.
 */

import type { InfosSalon, ResultatValidation } from '@neon-ninja/shared';
import { DELAI_DE_RETOUR_MS, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerClient } from './client.js';
import type { CoffreDeJeton } from './comptes/coffre.js';
import { creerCoffreDeJeton } from './comptes/coffre.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import { creerMinuterieManuelle } from './minuterie.js';
import { SERVEUR_INJOIGNABLE, creerReseauFactice } from './reseau.js';
import { ATTENTE_ENTRE_DEUX_RETOURS_MS, AVIS_PLACE_REPRISE } from './retour.js';

/** Le jeton remis a l'entree. */
const JETON = 'R'.repeat(43);

/** Le jeton remis au retour. */
const JETON_NEUF = 'N'.repeat(43);

/** Un salon minimal, au statut voulu. */
function salon(statut: InfosSalon['statut'] = 'salon'): InfosSalon {
  return {
    idRoom: 'partie-1',
    statut,
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [{ id: 'j-alice', pseudo: 'Alice', hote: true }],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Un client ouvert en invite, et de quoi jouer le serveur et le temps. */
function monter(coffreDeRetour: CoffreDeJeton = creerCoffreDeJeton()) {
  const reseau = creerReseauFactice();
  const horloge = creerHorlogeClientManuelle();
  const minuterie = creerMinuterieManuelle();
  const client = creerClient({ reseau, horloge, minuterie, coffreDeRetour });

  const avancer = (dtMs: number): void => {
    horloge.avancerDe(dtMs);
    minuterie.avancerDe(dtMs);
  };

  /** Repond a la derniere demande d'entree. */
  const repondreALEntree = (reponse: ResultatValidation<InfosSalon>): void => {
    const demande = reseau.dernier('rejoindre');
    if (demande === undefined) {
      throw new Error("Le client n'a demande a entrer nulle part.");
    }
    demande[1](reponse);
  };

  /** Repond a la derniere demande de retour. */
  const repondreAuRetour = (reponse: ResultatValidation<InfosSalon>): void => {
    const demande = reseau.dernier('revenir');
    if (demande === undefined) {
      throw new Error("Le client n'a demande a revenir nulle part.");
    }
    demande[1](reponse);
  };

  /** Le client entre dans le salon, et recoit sa place. */
  const entrerAuSalon = (): void => {
    client.ouvrir();
    reseau.simulerConnexion();
    client.rejoindre('Alice');
    reseau.recevoir('placeAttribuee', { joueur: 'j-alice', jetonDeRetour: JETON });
    repondreALEntree({ valide: true, valeur: salon() });
  };

  /** Le client entre, et la partie commence. */
  const entrerEnPartie = (): void => {
    entrerAuSalon();
    reseau.recevoir('partieLancee');
  };

  client.ouvrir();

  return {
    reseau,
    minuterie,
    client,
    coffreDeRetour,
    avancer,
    repondreAuRetour,
    entrerAuSalon,
    entrerEnPartie,
  };
}

describe('la place en partie', () => {
  it('garde le jeton de retour et l identifiant du joueur remis a l entree', () => {
    const { client, coffreDeRetour, entrerAuSalon } = monter();

    entrerAuSalon();

    expect(coffreDeRetour.lire()).toBe(JETON);
    expect(client.etat.moi).toBe('j-alice');
  });

  it('oublie la place en quittant la partie', () => {
    const { client, coffreDeRetour, entrerEnPartie } = monter();

    entrerEnPartie();
    client.quitter();

    expect(coffreDeRetour.lire()).toBeUndefined();
    expect(client.etat.moi).toBeUndefined();
  });

  it('oublie la place a la fin de la partie, et un lien tombe ensuite est une perte', () => {
    const { reseau, client, coffreDeRetour, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.recevoir('partieTerminee', { classement: [] });

    expect(coffreDeRetour.lire()).toBeUndefined();

    reseau.simulerDeconnexion();
    expect(client.etat.connexion).toBe('perdue');
  });

  it('une place reprise dans une autre page ramene a l accueil, le dit, et est oubliee', () => {
    const { reseau, client, coffreDeRetour, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.recevoir('placeReprise');

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.avisDeRetour).toBe(AVIS_PLACE_REPRISE);
    expect(client.etat.salon).toBeUndefined();
    expect(coffreDeRetour.lire()).toBeUndefined();
  });
});

describe('le retour apres un lien tombe en pleine partie', () => {
  it('laisse la partie affichee et rouvre le lien aussitot', () => {
    const { reseau, client, entrerEnPartie } = monter();

    entrerEnPartie();
    const ouvertures = reseau.ouvertures.length;
    reseau.simulerDeconnexion();

    expect(client.etat.connexion).toBe('retour');
    expect(client.etat.ecran).toBe('jeu');
    expect(client.etat.salon?.idRoom).toBe('partie-1');
    expect(reseau.ouvertures).toHaveLength(ouvertures + 1);
  });

  it('presente le jeton des que le lien revient, et retrouve la partie', () => {
    const { reseau, client, coffreDeRetour, repondreAuRetour, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();

    expect(reseau.dernier('revenir')?.[0]).toEqual({ jeton: JETON });
    expect(client.etat.connexion).toBe('retour');

    reseau.recevoir('placeAttribuee', { joueur: 'j-alice', jetonDeRetour: JETON_NEUF });
    repondreAuRetour({ valide: true, valeur: salon('enCours') });

    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.ecran).toBe('jeu');
    expect(client.etat.moi).toBe('j-alice');
    expect(coffreDeRetour.lire()).toBe(JETON_NEUF);
  });

  it('reessaie tant que le serveur ne repond pas, puis renonce au bout du delai', () => {
    const { reseau, minuterie, client, coffreDeRetour, avancer, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.simulerDeconnexion();
    const ouvertures = reseau.ouvertures.length;

    for (let ecoule = 0; ecoule < DELAI_DE_RETOUR_MS; ecoule += ATTENTE_ENTRE_DEUX_RETOURS_MS) {
      reseau.simulerRefus(SERVEUR_INJOIGNABLE);
      // Le reveil d'un serveur endormi ne s'en mele pas.
      expect(client.etat.connexion, `apres ${String(ecoule)} ms`).toBe('retour');
      avancer(ATTENTE_ENTRE_DEUX_RETOURS_MS);
    }

    expect(reseau.ouvertures).toHaveLength(
      ouvertures + DELAI_DE_RETOUR_MS / ATTENTE_ENTRE_DEUX_RETOURS_MS,
    );

    reseau.simulerRefus(SERVEUR_INJOIGNABLE);

    expect(client.etat.connexion).toBe('perdue');
    expect(client.etat.ecran).toBe('accueil');
    expect(coffreDeRetour.lire()).toBeUndefined();
    expect(minuterie.enAttente).toBe(0);
  });

  it('un lien qui retombe pendant la demande reessaie, et la reponse perdue ne compte plus', () => {
    const { reseau, client, avancer, repondreAuRetour, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();
    const demandeEnRoute = reseau.dernier('revenir');
    const ouvertures = reseau.ouvertures.length;

    reseau.simulerDeconnexion();
    avancer(ATTENTE_ENTRE_DEUX_RETOURS_MS);
    expect(reseau.ouvertures).toHaveLength(ouvertures + 1);

    demandeEnRoute?.[1]({ valide: true, valeur: salon('enCours') });
    expect(client.etat.connexion).toBe('retour');

    reseau.simulerConnexion();
    repondreAuRetour({ valide: true, valeur: salon('enCours') });
    expect(client.etat.connexion).toBe('connecte');
  });

  it('un refus du lien par le serveur lui-meme met fin au retour, et se dit', () => {
    const { reseau, minuterie, client, coffreDeRetour, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.simulerDeconnexion();
    reseau.simulerRefus('Session invalide ou expirée. Reconnectez-vous.');

    expect(client.etat.connexion).toBe('refusee');
    expect(client.etat.refusDeConnexion).toBe('Session invalide ou expirée. Reconnectez-vous.');
    expect(client.etat.ecran).toBe('accueil');
    expect(coffreDeRetour.lire()).toBeUndefined();
    expect(minuterie.enAttente).toBe(0);
  });

  it('un retour refuse ramene a l accueil avec son motif, lien ouvert, et oublie la place', () => {
    const { reseau, client, coffreDeRetour, repondreAuRetour, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.simulerDeconnexion();
    reseau.simulerConnexion();
    repondreAuRetour({
      valide: false,
      erreurs: [{ champ: 'retour', motif: "Votre place dans cette partie n'a pas été gardée." }],
    });

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.avisDeRetour).toBe("Votre place dans cette partie n'a pas été gardée.");
    expect(client.etat.salon).toBeUndefined();
    expect(coffreDeRetour.lire()).toBeUndefined();
  });

  it('quitter pendant le retour y renonce, et rouvre le lien comme au demarrage', () => {
    const { reseau, minuterie, client, coffreDeRetour, avancer, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.simulerDeconnexion();
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    const ouvertures = reseau.ouvertures.length;

    client.quitter();

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('horsLigne');
    expect(coffreDeRetour.lire()).toBeUndefined();
    expect(reseau.ouvertures).toHaveLength(ouvertures + 1);
    expect(minuterie.enAttente).toBe(0);

    avancer(ATTENTE_ENTRE_DEUX_RETOURS_MS);
    reseau.simulerConnexion();

    expect(reseau.dernier('revenir')).toBeUndefined();
    expect(client.etat.connexion).toBe('connecte');
  });

  it('dans le salon, un lien tombe est une perte: la place n y est pas gardee', () => {
    const { reseau, client, coffreDeRetour, entrerAuSalon } = monter();

    entrerAuSalon();
    const ouvertures = reseau.ouvertures.length;
    reseau.simulerDeconnexion();

    expect(client.etat.connexion).toBe('perdue');
    expect(client.etat.ecran).toBe('accueil');
    expect(coffreDeRetour.lire()).toBeUndefined();
    expect(reseau.ouvertures).toHaveLength(ouvertures);
  });

  it('n oublie aucun essai planifie en se fermant', () => {
    const { reseau, minuterie, client, entrerEnPartie } = monter();

    entrerEnPartie();
    reseau.simulerDeconnexion();
    reseau.simulerRefus(SERVEUR_INJOIGNABLE);
    expect(minuterie.enAttente).toBe(1);

    client.fermer();

    expect(minuterie.enAttente).toBe(0);
  });
});

describe('le retour d une page rechargee', () => {
  /** Un coffre qui garde deja une place, comme apres un rechargement. */
  function coffreAvecUnePlace(): CoffreDeJeton {
    const coffre = creerCoffreDeJeton();
    coffre.garder(JETON);
    return coffre;
  }

  it('presente la place gardee des que le lien s ouvre, et retourne en partie', () => {
    const { reseau, client, repondreAuRetour } = monter(coffreAvecUnePlace());

    reseau.simulerConnexion();

    expect(client.etat.connexion).toBe('retour');
    expect(client.etat.ecran).toBe('accueil');
    expect(reseau.dernier('revenir')?.[0]).toEqual({ jeton: JETON });

    reseau.recevoir('placeAttribuee', { joueur: 'j-alice', jetonDeRetour: JETON_NEUF });
    repondreAuRetour({ valide: true, valeur: salon('enCours') });
    reseau.recevoir('partieLancee');

    expect(client.etat.ecran).toBe('jeu');
    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.moi).toBe('j-alice');
  });

  it('dit sur l accueil pourquoi une place gardee ne vaut plus rien', () => {
    const { reseau, client, coffreDeRetour, repondreAuRetour } = monter(coffreAvecUnePlace());

    reseau.simulerConnexion();
    repondreAuRetour({
      valide: false,
      erreurs: [{ champ: 'partie', motif: "Cette partie n'est plus en cours." }],
    });

    expect(client.etat.ecran).toBe('accueil');
    expect(client.etat.connexion).toBe('connecte');
    expect(client.etat.avisDeRetour).toBe("Cette partie n'est plus en cours.");
    expect(coffreDeRetour.lire()).toBeUndefined();

    // La prochaine entree efface l'avis.
    client.rejoindre('Alice');
    expect(client.etat.avisDeRetour).toBeUndefined();
  });

  it('sans place gardee, n envoie aucune demande de retour', () => {
    const { reseau, client } = monter();

    reseau.simulerConnexion();

    expect(reseau.dernier('revenir')).toBeUndefined();
    expect(client.etat.connexion).toBe('connecte');
  });
});
