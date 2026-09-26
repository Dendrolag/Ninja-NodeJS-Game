/**
 * Tests du modele de la fiche d'un joueur (etape 3.5).
 *
 * Ce qu'ils protegent: la fenetre suit l'etat de la fiche, et la fiche lue se met en
 * forme comme le profil, sans rien recalculer. Depuis l'etape 3.6, elle dit la relation
 * et propose les gestes qu'elle permet.
 */

import type { FicheJoueur } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { AMIS_INCONNUS, ETAT_INITIAL } from '../../etat.js';
import { modeleFiche } from './fiche.js';
import { formaterJour } from './profil.js';
import { formaterNombre } from './progression.js';

const FICHE: FicheJoueur = {
  pseudo: 'ShadowFox',
  inscritLe: '2026-09-11T12:00:00.000Z',
  niveau: 12,
  palier: 'platine',
  relation: 'aucune',
  statistiques: {
    partiesJouees: 40,
    partiesAPlusieurs: 38,
    victoires: 12,
    modePrefere: 'tactique',
    parMode: [
      {
        mode: 'tactique',
        partiesJouees: 30,
        partiesAPlusieurs: 29,
        victoires: 10,
        meilleurScore: 1280,
        meilleurScoreSeul: 900,
      },
      { mode: 'equipes', partiesJouees: 10, partiesAPlusieurs: 9, victoires: 2, meilleurScore: 64 },
    ],
  },
};

describe('modeleFiche', () => {
  it('est fermee sans fiche ouverte', () => {
    expect(modeleFiche(ETAT_INITIAL)).toEqual({ nature: 'fermee' });
  });

  it('dit quelle fiche se lit, et pourquoi elle n a pas pu l etre', () => {
    expect(
      modeleFiche({ ...ETAT_INITIAL, fiche: { statut: 'chargement', pseudo: 'Bob' } }),
    ).toEqual({ nature: 'chargement', pseudo: 'Bob' });
    expect(
      modeleFiche({
        ...ETAT_INITIAL,
        fiche: { statut: 'echec', pseudo: 'Bob', motif: 'Aucun compte ne porte ce pseudo.' },
      }),
    ).toEqual({ nature: 'echec', pseudo: 'Bob', motif: 'Aucun compte ne porte ce pseudo.' });
  });

  it('met en forme la fiche lue: identite, tuiles et tableau par mode', () => {
    expect(
      modeleFiche({
        ...ETAT_INITIAL,
        fiche: { statut: 'chargee', pseudo: 'shadowfox', fiche: FICHE },
      }),
    ).toEqual({
      nature: 'chargee',
      // L'ecriture du compte, pas celle de la demande.
      pseudo: 'ShadowFox',
      initiales: 'SF',
      niveau: 'Niveau 12',
      palier: 'Platine',
      inscription: `Membre depuis le ${formaterJour(FICHE.inscritLe)}`,
      statistiques: [
        { libelle: 'Parties jouées', valeur: '40' },
        { libelle: 'Victoires', valeur: '12', detail: 'sur 38 parties à plusieurs' },
        { libelle: 'Mode préféré', valeur: 'Tactique' },
      ],
      parMode: [
        {
          mode: 'Tactique',
          parties: '30',
          victoires: '10 sur 29',
          meilleurScore: formaterNombre(1280),
          meilleurScoreSeul: '900',
        },
        {
          mode: 'Équipes',
          parties: '10',
          victoires: '2 sur 9',
          meilleurScore: '64',
          meilleurScoreSeul: '—',
        },
      ],
      // Etape 3.6: aucune relation, on peut l'ajouter ou la bloquer.
      amitie: {
        phrase: undefined,
        gestes: [
          { geste: 'demander', libelle: 'Ajouter en ami', nature: 'principal' },
          { geste: 'bloquer', libelle: 'Bloquer', nature: 'defait' },
        ],
        enCours: false,
        erreur: undefined,
      },
    });
  });

  /** Le modele de la fiche de ShadowFox, lue avec cette relation et ce dernier geste. */
  function ficheAvec(
    relation: FicheJoueur['relation'],
    ecart: Partial<FicheJoueur> = {},
    geste: EtatClient['amis']['geste'] = { statut: 'aucun' },
  ) {
    const modele = modeleFiche({
      ...ETAT_INITIAL,
      fiche: { statut: 'chargee', pseudo: 'ShadowFox', fiche: { ...FICHE, relation, ...ecart } },
      amis: { ...AMIS_INCONNUS, geste },
    });

    if (modele.nature !== 'chargee') {
      throw new Error('Fiche chargee attendue.');
    }

    return modele;
  }

  it('ne propose aucun geste sur sa propre fiche', () => {
    expect(ficheAvec('soi')).not.toHaveProperty('amitie');
  });

  it('dit la relation, et propose les gestes qu elle permet (etape 3.6)', () => {
    const gestes = (relation: FicheJoueur['relation']): string[] =>
      (ficheAvec(relation).amitie?.gestes ?? []).map((propose) => propose.geste);

    expect(gestes('demandeEnvoyee')).toEqual(['annuler', 'bloquer']);
    expect(gestes('demandeRecue')).toEqual(['accepter', 'refuser', 'bloquer']);
    expect(gestes('ami')).toEqual(['retirer', 'bloquer']);
    expect(gestes('bloque')).toEqual(['debloquer']);
    expect(ficheAvec('ami').amitie?.phrase).toBe('Vous êtes amis.');
    expect(ficheAvec('bloque').amitie?.phrase).toBe(
      'Vous avez bloqué ce compte : ses demandes sont ignorées.',
    );
  });

  it('montre a un ami les parties jouees ensemble, sans genrer personne', () => {
    expect(
      ficheAvec('ami', { ensemble: { partiesEnsemble: 14, devant: 9, derriere: 4 } }).ensemble,
    ).toEqual([
      { libelle: 'Parties ensemble', valeur: '14' },
      { libelle: 'Vous devant', valeur: '9' },
      { libelle: 'ShadowFox devant', valeur: '4' },
    ]);
    // Un face-a-face qui trainerait sur une fiche qui n'est plus celle d'un ami ne se montre pas.
    expect(
      ficheAvec('aucune', { ensemble: { partiesEnsemble: 1, devant: 1, derriere: 0 } }),
    ).not.toHaveProperty('ensemble');
  });

  it('suit le dernier geste sur ce compte, et lui seul, quelle que soit l ecriture', () => {
    expect(
      ficheAvec('aucune', {}, { statut: 'enCours', geste: 'demander', pseudo: 'shadowfox' }).amitie
        ?.enCours,
    ).toBe(true);
    expect(
      ficheAvec(
        'bloque',
        {},
        {
          statut: 'refuse',
          geste: 'demander',
          pseudo: 'ShadowFox',
          motif: 'Vous avez bloqué ce compte.',
        },
      ).amitie?.erreur,
    ).toBe('Vous avez bloqué ce compte.');
    expect(
      ficheAvec('aucune', {}, { statut: 'enCours', geste: 'demander', pseudo: 'Bob' }).amitie
        ?.enCours,
    ).toBe(false);
  });
});
