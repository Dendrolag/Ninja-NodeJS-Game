/**
 * Tests du modele du salon d'une partie Equipes (etape 7.2): les deux equipes et leurs
 * membres, qui peut rejoindre quelle equipe, et le lancement suspendu tant qu'une
 * equipe est vide.
 */

import type { Equipe, InfosSalon, JoueurDuSalon } from '@neon-ninja/shared';
import { COULEURS_DES_EQUIPES, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleSalon } from './salon.js';

/** Un membre du salon, dans une equipe. */
function membre(id: string, equipe: Equipe, hote = false): JoueurDuSalon {
  return { id, pseudo: id, hote, equipe };
}

/** Un salon Equipes avec ces membres. */
function salon(
  joueurs: readonly JoueurDuSalon[],
  statut: InfosSalon['statut'] = 'salon',
): InfosSalon {
  return {
    idRoom: 'room-1',
    statut,
    mode: 'equipes',
    visibilite: 'publique',
    capacite: 12,
    joueurs,
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Un client dans ce salon, sous l'identifiant « moi ». */
function etat(infos: InfosSalon, modifications: Partial<EtatClient> = {}): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'salon',
    connexion: 'connecte',
    moi: 'moi',
    salon: infos,
    ...modifications,
  };
}

describe('le salon d une partie Equipes', () => {
  it('range les joueurs dans les deux equipes, et marque la notre', () => {
    const modele = modeleSalon(
      etat(salon([membre('moi', 'cyan', true), membre('bob', 'magenta'), membre('eve', 'cyan')])),
    );

    expect(
      modele?.equipes?.map(({ joueurs, ...equipe }) => ({
        ...equipe,
        joueurs: joueurs.map((joueur) => joueur.id),
      })),
    ).toEqual([
      {
        equipe: 'cyan',
        nom: 'Équipe Cyan',
        couleur: COULEURS_DES_EQUIPES.cyan,
        joueurs: ['moi', 'eve'],
        effectif: '2 / 6',
        mienne: true,
        complete: false,
        peutRejoindre: false,
      },
      {
        equipe: 'magenta',
        nom: 'Équipe Magenta',
        couleur: COULEURS_DES_EQUIPES.magenta,
        joueurs: ['bob'],
        effectif: '1 / 6',
        mienne: false,
        complete: false,
        peutRejoindre: true,
      },
    ]);
  });

  it('ne propose pas de rejoindre une equipe complete', () => {
    const magentas = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map((id) => membre(id, 'magenta'));
    const modele = modeleSalon(etat(salon([membre('moi', 'cyan', true), ...magentas])));
    const magenta = modele?.equipes?.[1];

    expect(magenta).toMatchObject({ complete: true, peutRejoindre: false, effectif: '6 / 6' });
  });

  it('ne propose aucun changement sans lien, ni une fois la partie lancee', () => {
    const joueurs = [membre('moi', 'cyan', true), membre('bob', 'magenta')];

    const sansLien = modeleSalon(etat(salon(joueurs), { connexion: 'retablissement' }));
    const lancee = modeleSalon(etat(salon(joueurs, 'enCours')));

    expect(sansLien?.equipes?.[1]?.peutRejoindre).toBe(false);
    expect(lancee?.equipes?.[1]?.peutRejoindre).toBe(false);
  });

  it('suspend le lancement tant qu une equipe est vide, et dit pourquoi a tous', () => {
    const hote = modeleSalon(etat(salon([membre('moi', 'cyan', true)])));
    const invite = modeleSalon(etat(salon([membre('bob', 'cyan', true), membre('moi', 'cyan')])));

    expect(hote?.peutLancer).toBe(false);
    expect(hote?.consigne).toBe(
      'Il faut au moins un joueur dans chaque équipe pour lancer la partie.',
    );
    expect(invite?.consigne).toBe(hote?.consigne);
  });

  it('laisse lancer des equipes inegales', () => {
    const modele = modeleSalon(
      etat(salon([membre('moi', 'cyan', true), membre('eve', 'cyan'), membre('bob', 'magenta')])),
    );

    expect(modele?.peutLancer).toBe(true);
  });

  it('n a pas d equipes hors du mode Equipes', () => {
    const modele = modeleSalon(
      etat({ ...salon([{ id: 'moi', pseudo: 'moi', hote: true }]), mode: 'classique' }),
    );

    expect(modele?.equipes).toBeUndefined();
    expect(modele?.peutLancer).toBe(true);
  });
});
