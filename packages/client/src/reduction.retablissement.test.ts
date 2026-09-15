/**
 * Tests du calcul de l'etat quand le lien tombe hors d'une partie en cours (etape 2.6).
 *
 * Ce qu'ils protegent: le joueur reste sur son ecran, avec ce qu'il y a saisi, et ce
 * qu'il attendait du serveur ne le bloque pas; le salon reste affiche le temps d'y
 * revenir; seul le jeu est quitte, quand la place en partie est perdue; un lien qui
 * ne revient pas, ou que le serveur refuse, ne laisse pas d'ecran de partie.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { reduire } from './reduction.js';

/** Applique une suite d'actions a l'etat de depart. */
function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

/** Un salon minimal. */
const SALON: InfosSalon = {
  idRoom: 'partie-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true }],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Jusqu'au salon, un message de chat recu et un decompte lance. */
const AU_SALON: readonly Action[] = [
  { type: 'connexionEtablie' },
  { type: 'entreeDemandee', pseudo: 'Alice' },
  { type: 'placeAttribuee', joueur: 'moi' },
  { type: 'entreeAcceptee', salon: SALON },
  { type: 'chat', message: { auteur: 'moi', pseudo: 'Alice', texte: 'salut' }, instant: 1 },
  { type: 'compteARebours', compte: { secondesRestantes: 4, annulable: true } },
];

describe('le lien perdu hors partie', () => {
  it('garde l ecran et ce qui y est saisi, et n attend plus rien du serveur', () => {
    const etat = apres([
      { type: 'connexionEtablie' },
      { type: 'navigation', vers: 'parties' },
      { type: 'entreeDemandee', pseudo: 'Alice' },
      { type: 'listeDemandee' },
      { type: 'lienPerdu' },
    ]);

    expect(etat.ecran).toBe('parties');
    expect(etat.connexion).toBe('retablissement');
    expect(etat.pseudoSaisi).toBe('Alice');
    expect(etat.entreeEnCours).toBe(false);
    expect(etat.listeEnCours).toBe(false);
  });

  it('garde le salon, notre joueur et les messages, et efface le decompte', () => {
    const avant = apres(AU_SALON);
    const etat = reduire(avant, { type: 'lienPerdu' });

    expect(etat.ecran).toBe('salon');
    expect(etat.salon).toBe(avant.salon);
    expect(etat.moi).toBe('moi');
    expect(etat.messages).toHaveLength(1);
    expect(etat.compteARebours).toBeUndefined();
  });

  it('depuis le jeu, la place est perdue: accueil, avec l avis, sans rien de la partie', () => {
    const etat = apres([
      ...AU_SALON,
      { type: 'partieLancee' },
      { type: 'lienPerduEnPartie' },
      { type: 'lienPerdu', avis: 'Place perdue.' },
    ]);

    expect(etat.ecran).toBe('accueil');
    expect(etat.connexion).toBe('retablissement');
    expect(etat.avisDeRetour).toBe('Place perdue.');
    expect(etat.salon).toBeUndefined();
    expect(etat.moi).toBeUndefined();
    expect(etat.pseudoDemande).toBe('Alice');
  });

  it('reste en retablissement tant que le salon redemande n a pas repondu', () => {
    const redemande = apres([
      ...AU_SALON,
      { type: 'lienPerdu' },
      { type: 'connexionEtablie' },
      { type: 'salonRedemande' },
    ]);

    expect(redemande.connexion).toBe('retablissement');
    expect(redemande.entreeEnCours).toBe(true);
    expect(redemande.ecran).toBe('salon');

    const retrouve = reduire(redemande, { type: 'retourAccepte', salon: SALON });

    expect(retrouve.connexion).toBe('connecte');
    expect(retrouve.entreeEnCours).toBe(false);
    expect(retrouve.ecran).toBe('salon');
  });

  it('n est pas interrompu par une session qui rouvre le lien', () => {
    expect(apres([{ type: 'lienPerdu' }, { type: 'ouvertureDemandee' }]).connexion).toBe(
      'retablissement',
    );
    expect(apres([{ type: 'connexionEtablie' }, { type: 'ouvertureDemandee' }]).connexion).toBe(
      'horsLigne',
    );
  });

  it('laisse les essais continuer depuis l accueil quand on quitte le salon', () => {
    const etat = apres([...AU_SALON, { type: 'lienPerdu' }, { type: 'sortie' }]);

    expect(etat.ecran).toBe('accueil');
    expect(etat.connexion).toBe('retablissement');
    expect(etat.salon).toBeUndefined();
  });
});

describe('le lien qui ne revient pas', () => {
  it('garde un menu et ce qui y est affiche', () => {
    const etat = apres([
      { type: 'connexionEtablie' },
      { type: 'navigation', vers: 'parties' },
      {
        type: 'partiesListees',
        parties: [
          {
            idRoom: 'room-1',
            hote: 'Bob',
            mode: 'classique',
            carte: 'map2',
            modeMiroir: false,
            joueurs: 3,
            capacite: 12,
          },
        ],
      },
      { type: 'lienPerdu' },
      { type: 'connexionPerdue' },
    ]);

    expect(etat.ecran).toBe('parties');
    expect(etat.connexion).toBe('perdue');
    expect(etat.partiesPubliques).toHaveLength(1);
  });

  it('garde la fin et son classement', () => {
    const etat = apres([
      ...AU_SALON,
      { type: 'partieLancee' },
      { type: 'partieTerminee', fin: { classement: [] } },
      { type: 'lienPerdu' },
      { type: 'connexionPerdue' },
    ]);

    expect(etat.ecran).toBe('fin');
    expect(etat.connexion).toBe('perdue');
    expect(etat.fin).toEqual({ classement: [] });
  });

  it('quitte le salon pour l accueil, avec l avis', () => {
    const etat = apres([
      ...AU_SALON,
      { type: 'lienPerdu' },
      { type: 'connexionPerdue', avis: 'Salon perdu.' },
    ]);

    expect(etat.ecran).toBe('accueil');
    expect(etat.connexion).toBe('perdue');
    expect(etat.avisDeRetour).toBe('Salon perdu.');
    expect(etat.salon).toBeUndefined();
    expect(etat.messages).toEqual([]);
  });
});

describe('le lien refuse', () => {
  it('quitte le salon, le jeu et la fin pour l accueil, avec le motif', () => {
    for (const jusque of [
      AU_SALON,
      [...AU_SALON, { type: 'partieLancee' }],
      [...AU_SALON, { type: 'partieLancee' }, { type: 'partieTerminee', fin: { classement: [] } }],
    ] as const satisfies readonly (readonly Action[])[]) {
      const etat = apres([...jusque, { type: 'connexionRefusee', motif: 'Refus.' }]);

      expect(etat.ecran).toBe('accueil');
      expect(etat.connexion).toBe('refusee');
      expect(etat.refusDeConnexion).toBe('Refus.');
      expect(etat.salon).toBeUndefined();
    }
  });

  it('garde un menu', () => {
    const etat = apres([
      { type: 'navigation', vers: 'creation' },
      { type: 'connexionRefusee', motif: 'Refus.' },
    ]);

    expect(etat.ecran).toBe('creation');
    expect(etat.connexion).toBe('refusee');
  });
});
