/**
 * Tests des modeles des amis (etape 3.6): l'ecran Amis, la pastille de la navigation,
 * les gestes proposes et ce que chaque geste annonce.
 *
 * Ce qu'ils protegent: on ne propose que les gestes que la relation permet, les
 * sections suivent la liste lue, la pastille compte les demandes recues d'un compte
 * seulement, et aucune phrase ne genre le joueur.
 */

import type { ListeDAmis, MaProgression, RelationDAmitie } from '@neon-ninja/shared';
import { GESTES_D_AMITIE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { LISTE_D_AMIS_VIDE } from '../../comptes/api.js';
import type { EtatClient } from '../../etat.js';
import { AMIS_INCONNUS, ETAT_INITIAL } from '../../etat.js';
import {
  annonceDuGeste,
  demandesEnAttente,
  gestesDeLaRelation,
  modeleAmis,
  modeleDuGeste,
  phraseDeLaRelation,
} from './amis.js';
import { modeleNavigation } from './navigation.js';

const PROGRESSION: MaProgression = {
  pseudo: 'Alice',
  niveau: 2,
  xpTotale: 150,
  pieces: 15,
  pointsLigue: 20,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

const LISTE: ListeDAmis = {
  amis: [
    { pseudo: 'Bob', niveau: 3 },
    { pseudo: 'Léa B.', niveau: 12 },
  ],
  recues: [{ pseudo: 'Carole', niveau: 1 }],
  envoyees: [{ pseudo: 'David', niveau: 7 }],
  bloques: [],
};

/** L'etat d'un compte connecte, avec ces amis. */
function compteAvec(amis: Partial<EtatClient['amis']>): EtatClient {
  return {
    ...ETAT_INITIAL,
    session: { nature: 'compte', progression: PROGRESSION },
    amis: { ...AMIS_INCONNUS, ...amis },
  };
}

describe('gestesDeLaRelation', () => {
  it('ne propose que ce que la relation permet', () => {
    const gestes = (relation: RelationDAmitie): string[] =>
      gestesDeLaRelation(relation).map((propose) => propose.geste);

    expect(gestes('soi')).toEqual([]);
    expect(gestes('aucune')).toEqual(['demander', 'bloquer']);
    expect(gestes('demandeEnvoyee')).toEqual(['annuler', 'bloquer']);
    expect(gestes('demandeRecue')).toEqual(['accepter', 'refuser', 'bloquer']);
    expect(gestes('ami')).toEqual(['retirer', 'bloquer']);
    expect(gestes('bloque')).toEqual(['debloquer']);
  });

  it('tient a part les gestes qui defont', () => {
    for (const propose of gestesDeLaRelation('ami')) {
      expect(propose.nature).toBe('defait');
    }
    expect(gestesDeLaRelation('aucune')[0]).toEqual({
      geste: 'demander',
      libelle: 'Ajouter en ami',
      nature: 'principal',
    });
  });
});

describe('ce que la fiche et l ecran disent', () => {
  it('dit la relation sans genrer personne, et rien sans relation', () => {
    expect(phraseDeLaRelation('aucune')).toBeUndefined();
    expect(phraseDeLaRelation('soi')).toBeUndefined();
    expect(phraseDeLaRelation('demandeRecue')).toBe('Ce compte vous demande d’être amis.');
  });

  it('annonce chaque geste fait, et une demande croisee comme une amitie', () => {
    const annonces = GESTES_D_AMITIE.map((geste) => annonceDuGeste(geste, 'Bob', 'aucune'));

    expect(annonces).toEqual([
      'Votre demande à Bob est envoyée.',
      'Bob et vous êtes amis.',
      'Demande de Bob refusée.',
      'Demande à Bob annulée.',
      'Bob ne fait plus partie de vos amis.',
      'Compte de Bob bloqué.',
      'Compte de Bob débloqué.',
    ]);
    expect(annonceDuGeste('demander', 'Bob', 'ami')).toBe('Bob et vous êtes amis.');
    for (const annonce of annonces) {
      expect(annonce).not.toMatch(/\b(il|elle|lui)\b/u);
    }
  });

  it('met en forme le dernier geste', () => {
    expect(modeleDuGeste({ statut: 'aucun' })).toEqual({
      enCours: false,
      annonce: undefined,
      erreur: undefined,
    });
    expect(modeleDuGeste({ statut: 'enCours', geste: 'demander', pseudo: 'Bob' }).enCours).toBe(
      true,
    );
    expect(
      modeleDuGeste({ statut: 'refuse', geste: 'demander', pseudo: 'Bob', motif: 'Non.' }).erreur,
    ).toBe('Non.');
  });
});

describe('modeleAmis', () => {
  it('se lit, ou dit pourquoi la premiere lecture a echoue', () => {
    expect(modeleAmis(compteAvec({ lecture: 1 }))).toEqual({ nature: 'chargement' });
    expect(modeleAmis(compteAvec({ motifDEchec: 'Injoignable.' }))).toEqual({
      nature: 'echec',
      motif: 'Injoignable.',
    });
  });

  it('garde la liste deja lue malgre un echec de relecture', () => {
    expect(modeleAmis(compteAvec({ liste: LISTE, motifDEchec: 'Injoignable.' })).nature).toBe(
      'chargee',
    );
  });

  it('range les demandes recues, les amis, les demandes envoyees et les blocages', () => {
    const modele = modeleAmis(compteAvec({ liste: LISTE }));

    if (modele.nature !== 'chargee') {
      throw new Error('Liste chargee attendue.');
    }

    expect(modele.compte).toBe('2 sur 200');
    expect(modele.recues.lignes).toEqual([
      {
        pseudo: 'Carole',
        initiales: 'CA',
        niveau: 'Niv. 1',
        gestes: [
          { geste: 'accepter', libelle: 'Accepter', nature: 'principal' },
          { geste: 'refuser', libelle: 'Refuser', nature: 'secondaire' },
          { geste: 'bloquer', libelle: 'Bloquer', nature: 'defait' },
        ],
      },
    ]);
    expect(modele.amis.lignes.map((ligne) => [ligne.pseudo, ligne.niveau, ligne.gestes])).toEqual([
      ['Bob', 'Niv. 3', []],
      ['Léa B.', 'Niv. 12', []],
    ]);
    expect(modele.envoyees.lignes[0]?.gestes.map((propose) => propose.geste)).toEqual(['annuler']);
    expect(modele.bloques.lignes).toEqual([]);
    // Seule la section des amis dit quelque chose une fois vide.
    expect(modele.amis.vide).toBeDefined();
    expect([modele.recues.vide, modele.envoyees.vide, modele.bloques.vide]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('la pastille des demandes recues', () => {
  it('compte les demandes recues d un compte', () => {
    const etat = compteAvec({ liste: LISTE });

    expect(demandesEnAttente(etat)).toBe(1);
    expect(modeleNavigation(etat).entrees.map((entree) => [entree.vers, entree.pastille])).toEqual([
      ['accueil', 0],
      ['parties', 0],
      ['creation', 0],
      ['amis', 1],
      ['profil', 0],
    ]);
  });

  it('est vide pour un compte sans liste lue, et pour un invite', () => {
    expect(demandesEnAttente(compteAvec({}))).toBe(0);
    expect(demandesEnAttente({ ...ETAT_INITIAL, amis: { ...AMIS_INCONNUS, liste: LISTE } })).toBe(
      0,
    );
    expect(demandesEnAttente(compteAvec({ liste: LISTE_D_AMIS_VIDE }))).toBe(0);
  });

  it('marque l entree Amis sur son ecran', () => {
    const etat: EtatClient = { ...compteAvec({ liste: LISTE }), ecran: 'amis' };

    expect(
      modeleNavigation(etat)
        .entrees.filter((entree) => entree.actif)
        .map((entree) => entree.vers),
    ).toEqual(['amis']);
  });
});
