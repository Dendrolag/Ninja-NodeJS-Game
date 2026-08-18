/**
 * Tests des transitions d'ecran.
 *
 * C'est le troisieme jeu de tests que la fiche de l'etape 4.1 exige. Il porte
 * sur une fonction pure: on lui donne l'ecran affiche et ce qui vient d'arriver,
 * elle dit quel ecran afficher ensuite. Aucun element de page n'est en jeu ici,
 * et c'est justement ce qui rend la question verifiable.
 */

import type { InfosSalon, StatutPartie } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import type { Ecran } from './ecrans.js';
import { ecranSuivant } from './ecrans.js';

/** Un salon minimal, dans le statut que le test veut examiner. */
function salon(statut: StatutPartie): InfosSalon {
  return {
    idRoom: 'partie-1',
    statut,
    joueurs: [{ id: 'j1', pseudo: 'Alice', hote: true }],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Les quatre ecrans, pour verifier qu'une action se comporte pareil depuis tous. */
const TOUS_LES_ECRANS: readonly Ecran[] = ['accueil', 'salon', 'jeu', 'fin'];

describe('transitions d ecran', () => {
  it('mene au salon quand on entre dans une partie qui attend', () => {
    expect(ecranSuivant('accueil', { type: 'entreeAcceptee', salon: salon('salon') })).toBe(
      'salon',
    );
  });

  it('mene directement au jeu quand on rejoint une partie deja commencee', () => {
    // Le serveur autorise a rejoindre une partie en cours et envoie partieLancee
    // juste apres. Aller directement au bon ecran evite d'afficher le salon le
    // temps d'un aller-retour.
    expect(ecranSuivant('accueil', { type: 'entreeAcceptee', salon: salon('enCours') })).toBe(
      'jeu',
    );
  });

  it('mene a l ecran de fin quand la partie rejointe est deja terminee', () => {
    expect(ecranSuivant('accueil', { type: 'entreeAcceptee', salon: salon('terminee') })).toBe(
      'fin',
    );
  });

  it('mene au jeu quand la partie est lancee', () => {
    expect(ecranSuivant('salon', { type: 'partieLancee' })).toBe('jeu');
  });

  it('mene a la fin quand la partie se termine', () => {
    expect(ecranSuivant('jeu', { type: 'partieTerminee', fin: { classement: [] } })).toBe('fin');
  });

  it('ramene a l accueil quand on quitte, depuis n importe quel ecran', () => {
    for (const ecran of TOUS_LES_ECRANS) {
      expect(ecranSuivant(ecran, { type: 'sortie' })).toBe('accueil');
    }
  });

  it('ramene a l accueil quand le lien est perdu, depuis n importe quel ecran', () => {
    for (const ecran of TOUS_LES_ECRANS) {
      expect(ecranSuivant(ecran, { type: 'connexionPerdue' })).toBe('accueil');
    }
  });

  it('laisse a l accueil quand l entree est refusee', () => {
    expect(
      ecranSuivant('accueil', {
        type: 'entreeRefusee',
        erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est deja pris dans cette partie.' }],
      }),
    ).toBe('accueil');
  });

  it('ne change pas d ecran pour le trafic ordinaire', () => {
    const ordinaires: readonly Action[] = [
      {
        type: 'etat',
        instantane: {
          tick: 1,
          tempsRestantMs: 1000,
          enPause: false,
          entites: [],
          objets: [],
          zones: [],
          classement: [],
        },
      },
      { type: 'chat', message: { auteur: 'j1', pseudo: 'Alice', texte: 'salut' }, instant: 0 },
      { type: 'compteARebours', compte: { secondesRestantes: 3, annulable: false } },
      { type: 'demarrageAnnule' },
      { type: 'partieEnPause', pause: { parPseudo: 'Alice' } },
      { type: 'partieReprise' },
      { type: 'salon', salon: salon('salon') },
      { type: 'refus', refus: { action: 'chat', erreurs: [] } },
    ];

    for (const ecran of TOUS_LES_ECRANS) {
      for (const action of ordinaires) {
        expect(ecranSuivant(ecran, action)).toBe(ecran);
      }
    }
  });

  it('ne quitte pas l accueil sur une connexion etablie', () => {
    // Se connecter ne fait pas entrer dans une partie: on reste sur l'accueil,
    // ou le joueur saisit son pseudo.
    expect(ecranSuivant('accueil', { type: 'connexionEtablie', identifiant: 'abc' })).toBe(
      'accueil',
    );
  });
});
