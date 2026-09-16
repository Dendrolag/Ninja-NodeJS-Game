/**
 * Tests du modele du salon d'une partie Chasse (etape 7.3): le lancement suspendu a un
 * seul joueur, la phrase de capture du mode, et un recapitulatif sans Black Ninjas.
 */

import type { InfosSalon, JoueurDuSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { CAPTURES_DES_MODES } from './cartes.js';
import { modeleSalon } from './salon.js';

/** Un salon de ce mode avec ces membres. */
function salon(joueurs: readonly JoueurDuSalon[], mode: InfosSalon['mode'] = 'chasse'): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'salon',
    mode,
    visibilite: 'publique',
    capacite: 10,
    joueurs,
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Un client hote de ce salon, sous l'identifiant « moi ». */
function etat(infos: InfosSalon): EtatClient {
  return { ...ETAT_INITIAL, ecran: 'salon', connexion: 'connecte', moi: 'moi', salon: infos };
}

const MOI: JoueurDuSalon = { id: 'moi', pseudo: 'Alice', hote: true };
const BOB: JoueurDuSalon = { id: 'bob', pseudo: 'Bob', hote: false };

describe('le salon d une partie Chasse', () => {
  it('ne se lance pas a un seul joueur, et dit pourquoi', () => {
    const modele = modeleSalon(etat(salon([MOI])));

    expect(modele?.peutLancer).toBe(false);
    expect(modele?.consigne).toBe('Il faut au moins deux joueurs pour lancer une chasse.');
  });

  it('se lance a deux joueurs', () => {
    const modele = modeleSalon(etat(salon([MOI, BOB])));

    expect(modele?.peutLancer).toBe(true);
    expect(modele?.consigne).toBe(
      'Vous êtes l’hôte : lancez la partie quand tout le monde est là.',
    );
  });

  it('rappelle comment on capture en Chasse', () => {
    expect(modeleSalon(etat(salon([MOI])))?.regle).toBe(CAPTURES_DES_MODES.chasse);
    expect(modeleSalon(etat(salon([MOI])))?.sousTitre).toBe('Chasse · Rainy Tokyo');
  });

  it('ne parle pas de Black Ninjas dans son recapitulatif, a l inverse du Classique', () => {
    const libelles = (mode: InfosSalon['mode']): readonly string[] =>
      modeleSalon(etat(salon([MOI], mode)))?.recapitulatif.map((ligne) => ligne.libelle) ?? [];

    expect(libelles('chasse')).not.toContain('Black Ninjas');
    expect(libelles('classique')).toContain('Black Ninjas');
  });

  it('laisse lancer seul une partie Classique, comme avant', () => {
    expect(modeleSalon(etat(salon([MOI], 'classique')))?.peutLancer).toBe(true);
  });
});
