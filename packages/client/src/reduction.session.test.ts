/**
 * Tests du calcul de l'etat suivant pour la session et la navigation (reprise des
 * ecrans du jalon 3).
 *
 * Ce qu'ils protegent: la session survit a tout ce qui n'est pas un changement de
 * session, un refus du lien se dit sans rien laisser en attente, et on ne quitte
 * jamais une partie en naviguant.
 */

import type { InfosSalon, MaProgression } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import type { EtatClient } from './etat.js';
import { AUCUNE_DEMANDE_DE_COMPTE, ETAT_INITIAL } from './etat.js';
import { reduire } from './reduction.js';

/** Applique une suite d'actions a l'etat de depart. */
function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

const PROGRESSION: MaProgression = {
  pseudo: 'Alice',
  niveau: 2,
  xpTotale: 150,
  pieces: 15,
  pointsLigue: 20,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true }],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Un compte connecte, dans son salon. */
const COMPTE_AU_SALON: readonly Action[] = [
  { type: 'sessionDeCompte', progression: PROGRESSION },
  { type: 'connexionEtablie', identifiant: 'moi' },
  { type: 'entreeDemandee', pseudo: undefined },
  { type: 'entreeAcceptee', salon: SALON },
];

describe('la session', () => {
  it('survit a la sortie d une partie', () => {
    const etat = apres([...COMPTE_AU_SALON, { type: 'sortie' }]);

    expect(etat.session).toEqual({ nature: 'compte', progression: PROGRESSION });
    expect(etat.ecran).toBe('accueil');
  });

  it('survit a la perte du lien', () => {
    const etat = apres([...COMPTE_AU_SALON, { type: 'connexionPerdue' }]);

    expect(etat.session.nature).toBe('compte');
    expect(etat.connexion).toBe('perdue');
  });

  it('se verifie, puis devient celle d un invite dont la session a expire', () => {
    const verification = apres([{ type: 'sessionEnVerification' }]);
    const expiree = reduire(verification, { type: 'sessionDInvite', expiree: true });

    expect(verification.session).toEqual({ nature: 'verification' });
    expect(expiree.session).toEqual({ nature: 'invite', sessionExpiree: true });
  });

  it('garde le pseudo deja demande quand une entree part sans pseudo', () => {
    const etat = apres([
      { type: 'entreeDemandee', pseudo: 'Alice' },
      { type: 'sortie' },
      { type: 'entreeDemandee', pseudo: undefined },
    ]);

    expect(etat.pseudoDemande).toBe('Alice');
  });
});

describe('le lien', () => {
  it('se refuse avec son motif, et libere une entree qui attendait', () => {
    const etat = apres([
      { type: 'entreeDemandee', pseudo: 'Alice' },
      { type: 'connexionRefusee', motif: 'Session invalide ou expirée. Reconnectez-vous.' },
    ]);

    expect(etat.connexion).toBe('refusee');
    expect(etat.refusDeConnexion).toBe('Session invalide ou expirée. Reconnectez-vous.');
    expect(etat.entreeEnCours).toBe(false);
  });

  it('se rouvre en oubliant l identifiant de l ancien lien et le refus', () => {
    const etat = apres([
      { type: 'connexionEtablie', identifiant: 'ancien' },
      { type: 'connexionRefusee', motif: 'Le serveur de jeu ne répond pas.' },
      { type: 'ouvertureDemandee' },
    ]);

    expect(etat.connexion).toBe('horsLigne');
    expect(etat.moi).toBeUndefined();
    expect(etat.refusDeConnexion).toBeUndefined();
  });

  it('s etablit en effacant un refus precedent', () => {
    const etat = apres([
      { type: 'connexionRefusee', motif: 'Le serveur de jeu ne répond pas.' },
      { type: 'connexionEtablie', identifiant: 'moi' },
    ]);

    expect(etat.refusDeConnexion).toBeUndefined();
  });
});

describe('la navigation', () => {
  it('mene d un ecran de menu a un autre', () => {
    expect(apres([{ type: 'navigation', vers: 'connexion' }]).ecran).toBe('connexion');
  });

  it('n a aucun effet pendant une partie', () => {
    const etat = apres([...COMPTE_AU_SALON, { type: 'navigation', vers: 'accueil' }]);

    expect(etat.ecran).toBe('salon');
    expect(etat.salon).toBe(SALON);
  });

  it('ne laisse pas un compte sur l ecran de connexion', () => {
    const etat = apres([
      { type: 'sessionDeCompte', progression: PROGRESSION },
      { type: 'navigation', vers: 'connexion' },
    ]);

    expect(etat.ecran).toBe('accueil');
  });

  it('quitte l ecran de connexion une fois le compte connecte', () => {
    const etat = apres([
      { type: 'navigation', vers: 'connexion' },
      { type: 'sessionDeCompte', progression: PROGRESSION },
    ]);

    expect(etat.ecran).toBe('accueil');
  });
});

describe('les demandes de compte', () => {
  const REFUSEE: readonly Action[] = [
    { type: 'navigation', vers: 'connexion' },
    { type: 'demandeDeCompteEnvoyee', nature: 'connexion', pseudo: 'Alice' },
    {
      type: 'demandeDeCompteRefusee',
      erreurs: [{ champ: 'connexion', motif: 'Pseudo ou mot de passe incorrect.' }],
    },
  ];

  it('retiennent leur refus, leur nature et leur pseudo', () => {
    expect(apres(REFUSEE).demandeDeCompte).toEqual({
      enCours: false,
      nature: 'connexion',
      pseudo: 'Alice',
      erreurs: [{ champ: 'connexion', motif: 'Pseudo ou mot de passe incorrect.' }],
    });
  });

  it('oublient leur refus quand le joueur change d ecran', () => {
    const etat = apres([...REFUSEE, { type: 'navigation', vers: 'accueil' }]);

    expect(etat.demandeDeCompte).toBe(AUCUNE_DEMANDE_DE_COMPTE);
  });

  it('continuent d attendre leur reponse quand le joueur change d ecran', () => {
    const etat = apres([
      { type: 'navigation', vers: 'connexion' },
      { type: 'demandeDeCompteEnvoyee', nature: 'inscription', pseudo: 'Bob' },
      { type: 'navigation', vers: 'accueil' },
    ]);

    expect(etat.demandeDeCompte.enCours).toBe(true);
  });
});

describe('le pseudo saisi et la liste des parties', () => {
  it('garde le pseudo saisi, sans changer d etat quand rien ne change', () => {
    const saisi = apres([{ type: 'pseudoSaisi', pseudo: 'Ali' }]);

    expect(saisi.pseudoSaisi).toBe('Ali');
    expect(reduire(saisi, { type: 'pseudoSaisi', pseudo: 'Ali' })).toBe(saisi);
  });

  it('garde le pseudo saisi a la sortie d une partie et a la perte du lien', () => {
    const debut: readonly Action[] = [
      { type: 'pseudoSaisi', pseudo: 'Alice' },
      { type: 'connexionEtablie', identifiant: 'moi' },
    ];

    expect(apres([...debut, { type: 'sortie' }]).pseudoSaisi).toBe('Alice');
    expect(apres([...debut, { type: 'connexionPerdue' }]).pseudoSaisi).toBe('Alice');
  });

  it('reprend le pseudo d une entree demandee', () => {
    expect(apres([{ type: 'entreeDemandee', pseudo: 'Bob' }]).pseudoSaisi).toBe('Bob');
  });

  it('marque la liste en attente jusqu a sa reponse', () => {
    const demandee = apres([{ type: 'listeDemandee' }]);

    expect(demandee.listeEnCours).toBe(true);
    expect(reduire(demandee, { type: 'partiesListees', parties: [] }).listeEnCours).toBe(false);
  });

  it('efface un refus d entree en changeant d ecran', () => {
    const etat = apres([
      { type: 'entreeDemandee', pseudo: 'Alice' },
      {
        type: 'entreeRefusee',
        action: 'rejoindre',
        erreurs: [{ champ: 'code', motif: 'Aucune partie ne correspond à ce code.' }],
      },
      { type: 'navigation', vers: 'parties' },
    ]);

    expect(etat.refus).toBeUndefined();
  });
});

describe('le profil', () => {
  it('n existe pas pour un invite, mene a la connexion', () => {
    expect(apres([{ type: 'navigation', vers: 'profil' }]).ecran).toBe('connexion');
  });

  it('se quitte vers l accueil quand le compte redevient invite', () => {
    const etat = apres([
      { type: 'sessionDeCompte', progression: PROGRESSION },
      { type: 'navigation', vers: 'profil' },
      { type: 'profilDemande' },
      { type: 'sessionDInvite', expiree: false },
    ]);

    expect(etat.ecran).toBe('accueil');
    expect(etat.profil).toEqual({ statut: 'inconnu' });
  });

  it('se lit, puis se garde avec la progression qu il porte', () => {
    const profil = {
      ...PROGRESSION,
      xpTotale: 400,
      niveau: 3,
      statistiques: { partiesJouees: 3, victoires: 1, meilleurScore: 12 },
      dernieresParties: [],
    };
    const etat = apres([
      { type: 'sessionDeCompte', progression: PROGRESSION },
      { type: 'navigation', vers: 'profil' },
      { type: 'profilDemande' },
      { type: 'profilRecu', profil },
    ]);

    expect(etat.profil).toEqual({ statut: 'charge', profil });
    expect(etat.session).toEqual({
      nature: 'compte',
      progression: { ...PROGRESSION, xpTotale: 400, niveau: 3 },
    });
  });

  it('retient le motif d une lecture refusee', () => {
    expect(apres([{ type: 'profilRefuse', motif: 'Le serveur ne répond pas.' }]).profil).toEqual({
      statut: 'echec',
      motif: 'Le serveur ne répond pas.',
    });
  });
});
