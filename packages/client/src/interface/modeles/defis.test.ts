/**
 * Tests de la mise en forme des defis de la semaine (etape 3.10): une ligne par defi, le
 * temps restant avant les suivants, et rien pour un invite.
 */

import { describe, expect, it } from 'vitest';

import { defisDEssai } from '../../comptes/api.js';
import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import {
  defiAffiche,
  defisRelevesAffiches,
  modeleDesDefis,
  phraseDuRenouvellement,
} from './defis.js';

/** La fin de la semaine d'essai: lundi 12 octobre 2026, 0 h a Paris. */
const FIN = '2026-10-11T22:00:00.000Z';

/** L'etat d'un compte, avec ces defis lus. */
function etatDuCompte(defis: EtatClient['defis']): EtatClient {
  return {
    ...ETAT_INITIAL,
    session: {
      nature: 'compte',
      progression: {
        pseudo: 'Alice',
        niveau: 1,
        xpTotale: 0,
        pieces: 0,
        pointsLigue: 0,
        inscritLe: '2026-09-11T10:00:00.000Z',
      },
    },
    defis,
  };
}

describe('un defi', () => {
  it('dit son texte, sa famille, sa recompense et son avancee', () => {
    expect(
      defiAffiche({ id: 'prendre-joueurs', actuel: 11, seuil: 15, xp: 400, accompli: false }),
    ).toEqual({
      id: 'prendre-joueurs',
      famille: 'action',
      nomDeFamille: 'Action',
      icone: 'target',
      texte: 'Prendre 15 joueurs.',
      xp: '+400 XP',
      avancee: '11 / 15',
      pourCent: 73,
      accompli: false,
    });
  });

  it('se dit releve, sa jauge pleine, avec l XP versee', () => {
    expect(
      defiAffiche({ id: 'rallier', actuel: 300, seuil: 300, xp: 350, accompli: true }),
    ).toMatchObject({ avancee: 'Relevé', pourCent: 100, xp: '+350 XP', accompli: true });
  });

  it('ecrit les grands nombres a la francaise', () => {
    expect(
      defiAffiche({ id: 'rallier', actuel: 1200, seuil: 300, xp: 1500, accompli: false }),
    ).toMatchObject({ avancee: '1 200 / 300', pourCent: 100, xp: '+1 500 XP' });
  });
});

describe('le renouvellement', () => {
  const avant = (ms: number): number => Date.parse(FIN) - ms;

  it('compte en jours et en heures, puis en heures et en minutes, puis en minutes', () => {
    expect(phraseDuRenouvellement(FIN, avant((3 * 24 + 14) * 3_600_000))).toBe(
      'Nouveaux défis dans 3 j 14 h',
    );
    expect(phraseDuRenouvellement(FIN, avant(5 * 3_600_000 + 12 * 60_000))).toBe(
      'Nouveaux défis dans 5 h 12 min',
    );
    expect(phraseDuRenouvellement(FIN, avant(12 * 60_000))).toBe('Nouveaux défis dans 12 min');
  });

  it('ne dit jamais zero minute, et annonce les nouveaux defis une fois la semaine passee', () => {
    expect(phraseDuRenouvellement(FIN, avant(5_000))).toBe('Nouveaux défis dans 1 min');
    expect(phraseDuRenouvellement(FIN, avant(0))).toBe('Nouveaux défis disponibles');
  });
});

describe('les defis de l accueil', () => {
  it('n existent pas pour un invite, ni tant qu ils ne sont pas lus', () => {
    expect(modeleDesDefis(ETAT_INITIAL, 0)).toBeUndefined();
    expect(modeleDesDefis(etatDuCompte({ statut: 'chargement' }), 0)).toBeUndefined();
    expect(modeleDesDefis(etatDuCompte({ statut: 'echec', motif: 'Non.' }), 0)).toBeUndefined();
  });

  it('montrent les trois defis lus, le bilan et le temps restant', () => {
    const lus = defisDEssai();
    const modele = modeleDesDefis(
      etatDuCompte({
        statut: 'charge',
        defis: { ...lus, defis: lus.defis.map((defi, i) => ({ ...defi, accompli: i === 0 })) },
      }),
      Date.parse(FIN) - 3_600_000,
    );

    expect(modele?.defis.map((defi) => defi.id)).toEqual(lus.defis.map((defi) => defi.id));
    expect(modele?.bilan).toBe('1 défi relevé sur 3');
    expect(modele?.renouvellement).toBe('Nouveaux défis dans 1 h 0 min');
  });
});

describe('les defis releves d une fin de partie', () => {
  it('se disent releves, avec leur XP', () => {
    expect(defisRelevesAffiches([{ id: 'bonus', xp: 400 }])).toEqual([
      { id: 'bonus', texte: 'Défi relevé : Ramasser 15 bonus, à plusieurs.', xp: '+400 XP' },
    ]);
  });
});
