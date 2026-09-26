/**
 * Tests du calcul de l'etat suivant pour les amis (etape 3.6).
 *
 * Ce qu'ils protegent: la liste lue reste affichee pendant qu'une autre se lit; un
 * geste passe par en cours, puis fait ou refuse; la fiche ouverte sur le joueur vise
 * suit la relation, et perd les parties ensemble d'un ami retire; les amis survivent a
 * une sortie de partie, pas a un changement de session; le resultat d'un geste ne
 * suit pas le joueur sur un autre ecran; et un invite n'a pas d'ecran Amis.
 */

import type { FicheJoueur, ListeDAmis, MaProgression } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import { LISTE_D_AMIS_VIDE, ficheDEssai } from './comptes/api.js';
import type { EtatClient } from './etat.js';
import { AMIS_INCONNUS, ETAT_INITIAL } from './etat.js';
import { reduire } from './reduction.js';

/** Applique une suite d'actions a l'etat de depart. */
function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

/** La progression d'un compte de ce pseudo. */
function progression(pseudo: string): MaProgression {
  return {
    pseudo,
    niveau: 2,
    xpTotale: 150,
    pieces: 15,
    pointsLigue: 20,
    inscritLe: '2026-09-11T10:00:00.000Z',
  };
}

const BOB_AMI: ListeDAmis = { ...LISTE_D_AMIS_VIDE, amis: [{ pseudo: 'Bob', niveau: 3 }] };

/** La fiche de Bob, amie, avec des parties jouees ensemble. */
const FICHE_DE_BOB_AMIE: FicheJoueur = {
  ...ficheDEssai('Bob'),
  relation: 'ami',
  ensemble: { partiesEnsemble: 3, devant: 2, derriere: 1 },
};

/** Alice, connectee, sur l'accueil, avec sa liste lue. */
const ALICE: readonly Action[] = [
  { type: 'sessionDeCompte', progression: progression('Alice') },
  { type: 'amisDemandes', lecture: 1 },
  { type: 'amisRecus', lecture: 1, liste: BOB_AMI },
];

describe('la liste des amis', () => {
  it('se lit, puis arrive', () => {
    const lecture = apres([
      { type: 'sessionDeCompte', progression: progression('Alice') },
      { type: 'amisDemandes', lecture: 1 },
    ]);

    expect(lecture.amis).toEqual({ ...AMIS_INCONNUS, lecture: 1 });
    expect(apres(ALICE).amis).toEqual({ ...AMIS_INCONNUS, liste: BOB_AMI });
  });

  it('reste affichee pendant une relecture, et apres un echec', () => {
    const relecture = apres([...ALICE, { type: 'amisDemandes', lecture: 2 }]);
    const echec = apres([{ type: 'amisRefuses', lecture: 2, motif: 'Injoignable.' }], relecture);

    expect(relecture.amis.liste).toEqual(BOB_AMI);
    expect(echec.amis).toMatchObject({
      liste: BOB_AMI,
      lecture: undefined,
      motifDEchec: 'Injoignable.',
    });

    const relue = apres(
      [
        { type: 'amisDemandes', lecture: 3 },
        { type: 'amisRecus', lecture: 3, liste: LISTE_D_AMIS_VIDE },
      ],
      echec,
    );

    expect(relue.amis.motifDEchec).toBeUndefined();
  });

  it('ignore la reponse d une lecture qu on n attend plus', () => {
    const relecture = apres([...ALICE, { type: 'amisDemandes', lecture: 2 }]);

    expect(reduire(relecture, { type: 'amisRecus', lecture: 1, liste: LISTE_D_AMIS_VIDE })).toBe(
      relecture,
    );
    expect(reduire(relecture, { type: 'amisRefuses', lecture: 1, motif: 'Tard.' })).toBe(relecture);
  });

  it('ne laisse pas une lecture partie avant un geste remplacer la liste qu il a rendue', () => {
    const apresLeGeste = apres([
      ...ALICE,
      { type: 'amisDemandes', lecture: 2 },
      { type: 'gesteEnvoye', geste: 'retirer', pseudo: 'Bob' },
      {
        type: 'gesteFait',
        geste: 'retirer',
        pseudo: 'Bob',
        reponse: { pseudo: 'Bob', relation: 'aucune', amis: LISTE_D_AMIS_VIDE },
      },
    ]);

    expect(apresLeGeste.amis.lecture).toBeUndefined();
    expect(
      reduire(apresLeGeste, { type: 'amisRecus', lecture: 2, liste: BOB_AMI }).amis.liste,
    ).toEqual(LISTE_D_AMIS_VIDE);
  });

  it('survit a une sortie de partie', () => {
    const sortie = apres([
      ...ALICE,
      { type: 'connexionEtablie' },
      { type: 'entreeDemandee', pseudo: undefined },
      {
        type: 'retourRefuse',
        motif: 'La partie est terminée.',
      },
    ]);

    expect(sortie.amis.liste).toEqual(BOB_AMI);
  });

  it('s oublie au retour en invite, et pour un autre compte, pas pour le meme', () => {
    expect(apres([...ALICE, { type: 'sessionDInvite', expiree: false }]).amis).toEqual(
      AMIS_INCONNUS,
    );
    expect(
      apres([...ALICE, { type: 'sessionDeCompte', progression: progression('Carole') }]).amis,
    ).toEqual(AMIS_INCONNUS);
    expect(
      apres([...ALICE, { type: 'sessionDeCompte', progression: progression('alice') }]).amis.liste,
    ).toEqual(BOB_AMI);
  });
});

describe('un geste d amitie', () => {
  it('passe par en cours, puis fait, avec la liste a jour', () => {
    const envoye = apres([...ALICE, { type: 'gesteEnvoye', geste: 'retirer', pseudo: 'Bob' }]);
    const fait = apres(
      [
        {
          type: 'gesteFait',
          geste: 'retirer',
          pseudo: 'Bob',
          reponse: { pseudo: 'Bob', relation: 'aucune', amis: LISTE_D_AMIS_VIDE },
        },
      ],
      envoye,
    );

    expect(envoye.amis.geste).toEqual({ statut: 'enCours', geste: 'retirer', pseudo: 'Bob' });
    expect(fait.amis.geste).toEqual({
      statut: 'fait',
      geste: 'retirer',
      pseudo: 'Bob',
      relation: 'aucune',
    });
    expect(fait.amis.liste).toEqual(LISTE_D_AMIS_VIDE);
  });

  it('retient le pseudo dans l ecriture du compte, pas dans celle de la demande', () => {
    const fait = apres([
      ...ALICE,
      { type: 'gesteEnvoye', geste: 'demander', pseudo: 'bob' },
      {
        type: 'gesteFait',
        geste: 'demander',
        pseudo: 'bob',
        reponse: { pseudo: 'Bob', relation: 'demandeEnvoyee', amis: BOB_AMI },
      },
    ]);

    expect(fait.amis.geste).toMatchObject({ statut: 'fait', pseudo: 'Bob' });
  });

  it('est refuse, pour ce motif, sans toucher a la liste', () => {
    const refuse = apres([
      ...ALICE,
      { type: 'gesteEnvoye', geste: 'accepter', pseudo: 'Carole' },
      { type: 'gesteRefuse', geste: 'accepter', pseudo: 'Carole', motif: 'Aucune demande.' },
    ]);

    expect(refuse.amis.geste).toEqual({
      statut: 'refuse',
      geste: 'accepter',
      pseudo: 'Carole',
      motif: 'Aucune demande.',
    });
    expect(refuse.amis.liste).toEqual(BOB_AMI);
  });

  it('ne suit pas le joueur sur un autre ecran, sauf s il attend encore sa reponse', () => {
    const fait = apres([
      ...ALICE,
      { type: 'gesteRefuse', geste: 'accepter', pseudo: 'Carole', motif: 'Aucune demande.' },
      { type: 'navigation', vers: 'amis' },
    ]);
    const enCours = apres([
      ...ALICE,
      { type: 'gesteEnvoye', geste: 'demander', pseudo: 'Carole' },
      { type: 'navigation', vers: 'amis' },
    ]);

    expect(fait.amis.geste).toEqual({ statut: 'aucun' });
    expect(enCours.amis.geste.statut).toBe('enCours');
  });

  it('fait suivre la relation a la fiche ouverte sur ce joueur, quelle que soit l ecriture', () => {
    const ficheOuverte = apres([
      ...ALICE,
      { type: 'ficheDemandee', pseudo: 'bob' },
      { type: 'ficheRecue', pseudo: 'bob', fiche: FICHE_DE_BOB_AMIE },
    ]);

    const retire = apres(
      [
        {
          type: 'gesteFait',
          geste: 'retirer',
          pseudo: 'BOB',
          reponse: { pseudo: 'Bob', relation: 'aucune', amis: LISTE_D_AMIS_VIDE },
        },
      ],
      ficheOuverte,
    );

    expect(retire.fiche).toEqual({
      statut: 'chargee',
      pseudo: 'bob',
      fiche: { ...ficheDEssai('Bob'), relation: 'aucune' },
    });

    const autre = apres(
      [
        {
          type: 'gesteFait',
          geste: 'bloquer',
          pseudo: 'Carole',
          reponse: { pseudo: 'Carole', relation: 'bloque', amis: BOB_AMI },
        },
      ],
      ficheOuverte,
    );

    expect(autre.fiche).toBe(ficheOuverte.fiche);
  });

  it('laisse une fiche relue apres le geste prendre sa place, mais pas un refus tardif', () => {
    const ficheOuverte = apres([
      ...ALICE,
      { type: 'ficheDemandee', pseudo: 'Bob' },
      { type: 'ficheRecue', pseudo: 'Bob', fiche: ficheDEssai('Bob') },
    ]);
    const relue = apres(
      [{ type: 'ficheRecue', pseudo: 'Bob', fiche: FICHE_DE_BOB_AMIE }],
      ficheOuverte,
    );

    expect(relue.fiche).toEqual({ statut: 'chargee', pseudo: 'Bob', fiche: FICHE_DE_BOB_AMIE });
    expect(reduire(relue, { type: 'ficheRefusee', pseudo: 'Bob', motif: 'Tard.' })).toBe(relue);
    expect(
      reduire(relue, { type: 'ficheRecue', pseudo: 'Carole', fiche: ficheDEssai('Carole') }),
    ).toBe(relue);
  });
});

describe('l ecran Amis', () => {
  it('s ouvre pour un compte', () => {
    expect(apres([...ALICE, { type: 'navigation', vers: 'amis' }]).ecran).toBe('amis');
  });

  it('mene un invite a la connexion', () => {
    expect(apres([{ type: 'navigation', vers: 'amis' }]).ecran).toBe('connexion');
  });

  it('ramene a l accueil un compte qui redevient invite', () => {
    expect(
      apres([
        ...ALICE,
        { type: 'navigation', vers: 'amis' },
        { type: 'sessionDInvite', expiree: true },
      ]).ecran,
    ).toBe('accueil');
  });
});
