/**
 * Tests du modele de la liste des parties publiques.
 *
 * Ce qu'ils protegent: la liste affichee est la liste recue, un code mal forme ne
 * part pas, un invite ne rejoint rien sans pseudo valide, et le refus du serveur se
 * dit.
 */

import type { MaProgression, PartiePublique } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleParties } from './parties.js';

const PARTIES: readonly PartiePublique[] = [
  {
    idRoom: 'room-1',
    hote: 'KageOni',
    mode: 'classique',
    carte: 'map2',
    modeMiroir: false,
    joueurs: 3,
    capacite: 12,
  },
  {
    idRoom: 'room-2',
    hote: 'Akumu',
    mode: 'classique',
    carte: 'map3',
    modeMiroir: true,
    joueurs: 11,
    capacite: 12,
  },
];

const COMPTE: MaProgression = {
  pseudo: 'Alice',
  niveau: 1,
  xpTotale: 0,
  pieces: 0,
  pointsLigue: 0,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

/** Un invite relie au serveur, qui a saisi Alice et recu la liste. */
const INVITE: EtatClient = {
  ...ETAT_INITIAL,
  connexion: 'connecte',
  moi: 'moi',
  pseudoSaisi: 'Alice',
  partiesPubliques: PARTIES,
};

describe('modeleParties', () => {
  it('reprend la liste recue, dans son ordre', () => {
    expect(modeleParties(INVITE, '', false).parties).toEqual([
      {
        idRoom: 'room-1',
        hote: 'KageOni',
        titre: 'Salon de KageOni',
        initiales: 'KO',
        details: 'Classique · Tokyo',
        joueurs: '3/12',
      },
      {
        idRoom: 'room-2',
        hote: 'Akumu',
        titre: 'Salon de Akumu',
        initiales: 'AK',
        details: 'Classique · Spirit & Time · Miroir',
        joueurs: '11/12',
      },
    ]);
  });

  it('compte les parties ouvertes', () => {
    expect(modeleParties(INVITE, '', false).compteur).toBe('2 parties ouvertes');
    expect(
      modeleParties({ ...INVITE, partiesPubliques: PARTIES.slice(0, 1) }, '', false).compteur,
    ).toBe('1 partie ouverte');
    expect(modeleParties({ ...INVITE, partiesPubliques: [] }, '', false).compteur).toBe(
      'Aucune partie ouverte',
    );
  });

  it('distingue une liste qui se charge d une liste vide', () => {
    const attendue = modeleParties(
      { ...INVITE, partiesPubliques: [], listeEnCours: true },
      '',
      false,
    );
    const vide = modeleParties({ ...INVITE, partiesPubliques: [] }, '', false);

    expect([attendue.enChargement, attendue.vide]).toEqual([true, false]);
    expect([vide.enChargement, vide.vide]).toEqual([false, true]);
  });

  it('laisse un invite rejoindre avec un pseudo valide, et lui dit sinon ce qui manque', () => {
    const sansPseudo = modeleParties({ ...INVITE, pseudoSaisi: '' }, '', false);
    const pseudoInvalide = modeleParties({ ...INVITE, pseudoSaisi: 'Al<b>' }, '', false);
    const pret = modeleParties(INVITE, '', false);

    expect(sansPseudo.peutRejoindre).toBe(false);
    expect(sansPseudo.aidePseudo).toBe('Choisissez un pseudo pour rejoindre une partie.');
    expect(pseudoInvalide.peutRejoindre).toBe(false);
    expect(pseudoInvalide.erreurPseudo).toContain("n'accepte que");
    expect([pret.peutRejoindre, pret.pseudo]).toEqual([true, 'Alice']);
  });

  it('laisse un compte rejoindre sans pseudo', () => {
    const modele = modeleParties(
      { ...INVITE, pseudoSaisi: '', session: { nature: 'compte', progression: COMPTE } },
      '',
      false,
    );

    expect(modele.pseudoRequis).toBe(false);
    expect(modele.pseudo).toBeUndefined();
    expect(modele.peutRejoindre).toBe(true);
  });

  it('ramene un code a sa forme canonique, et ne signale un code mal forme qu une fois l envoi tente', () => {
    expect(modeleParties(INVITE, ' nx7k2p ', false).code).toBe('NX7K2P');
    expect(modeleParties(INVITE, 'abc', false).erreurCode).toBeUndefined();
    expect(modeleParties(INVITE, 'abc', true).code).toBeUndefined();
    expect(modeleParties(INVITE, 'abc', true).erreurCode).toContain('6');
  });

  it('montre le refus d entree du serveur, et lui seul', () => {
    const complet = {
      ...INVITE,
      refus: {
        action: 'rejoindre' as const,
        erreurs: [{ champ: 'rejoindre', motif: 'Cette partie est complète.' }],
      },
    };
    const chat = {
      ...INVITE,
      refus: { action: 'chat' as const, erreurs: [{ champ: 'texte', motif: 'Trop long.' }] },
    };

    expect(modeleParties(complet, '', false).refus).toBe('Cette partie est complète.');
    expect(modeleParties(chat, '', false).refus).toBeUndefined();
  });

  it('ne laisse rien partir sans lien, ni pendant qu une entree attend', () => {
    const horsLigne = modeleParties({ ...INVITE, connexion: 'horsLigne' }, '', false);

    expect([horsLigne.peutRejoindre, horsLigne.lienEtabli]).toEqual([false, false]);
    expect(modeleParties({ ...INVITE, entreeEnCours: true }, '', false).peutRejoindre).toBe(false);
  });
});
