/**
 * Tests du modele du salon d'une partie Among Ninjas (etape 7.20): le lancement suspendu a
 * cinq joueurs, dit a l'hote avec la phrase meme du refus du serveur. Avant, la page
 * proposait « Lancer » a moins de cinq, et le serveur refusait sans que le salon l'ait dit. Et
 * le recapitulatif des reglages des taches (etape 7.21).
 */

import type { InfosSalon, JoueurDuSalon } from '@neon-ninja/shared';
import { AMONG_PAR_DEFAUT, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleSalon } from './salon.js';

/** Un salon Among Ninjas avec ces membres. */
function salon(joueurs: readonly JoueurDuSalon[]): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'salon',
    mode: 'among',
    visibilite: 'publique',
    capacite: 12,
    joueurs,
    reglages: { ...REGLAGES_PAR_DEFAUT, carte: 'map3' },
  };
}

/** Un client hote de ce salon, sous l'identifiant « moi ». */
function etat(infos: InfosSalon): EtatClient {
  return { ...ETAT_INITIAL, ecran: 'salon', connexion: 'connecte', moi: 'moi', salon: infos };
}

/** L'hote, puis tant d'autres joueurs. */
function membres(autres: number): readonly JoueurDuSalon[] {
  return [
    { id: 'moi', pseudo: 'Alice', hote: true },
    ...Array.from({ length: autres }, (_, rang) => ({
      id: `j${String(rang)}`,
      pseudo: `Joueur ${String(rang)}`,
      hote: false,
    })),
  ];
}

describe('le salon d une partie Among Ninjas', () => {
  it('ne se lance pas a quatre, et dit pourquoi', () => {
    const modele = modeleSalon(etat(salon(membres(3))));

    expect(modele?.peutLancer).toBe(false);
    expect(modele?.consigne).toBe(
      'Il faut au moins 5 joueurs pour lancer une partie Among Ninjas.',
    );
  });

  it('se lance a cinq joueurs', () => {
    const modele = modeleSalon(etat(salon(membres(4))));

    expect(modele?.peutLancer).toBe(true);
    expect(modele?.consigne).toBe(
      'Vous êtes l’hôte : lancez la partie quand tout le monde est là.',
    );
  });

  it('dit les taches visuelles et la barre des taches dans le recapitulatif (etape 7.21)', () => {
    const parDefaut = modeleSalon(etat(salon(membres(4))));
    const regle = modeleSalon(
      etat({
        ...salon(membres(4)),
        reglages: {
          ...REGLAGES_PAR_DEFAUT,
          among: {
            ...AMONG_PAR_DEFAUT,
            tachesVisuelles: false,
            barreDesTaches: 'reunions',
          },
        },
      }),
    );
    const ligne = (modele: typeof parDefaut) =>
      modele?.recapitulatif.find((recap) => recap.libelle === 'Tâches')?.valeur;

    expect(ligne(parDefaut)).toBe('Visuelles · barre toujours');
    expect(ligne(regle)).toBe('Invisibles · barre en réunion');
  });
});
