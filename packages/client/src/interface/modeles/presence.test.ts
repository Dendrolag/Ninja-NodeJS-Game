/**
 * Tests des modeles de la presence et des invitations (etape 2.8): la ligne d'un ami,
 * l'ordre des amis, la partie qu'on peut rejoindre, les cartes d'invitation et la
 * section « Inviter des amis » du salon.
 */

import type {
  InfosSalon,
  InvitationRecue,
  LieuDUnAmi,
  MaProgression,
  PresenceDUnAmi,
} from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from '../../actions.js';
import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { reduire } from '../../reduction.js';
import { modeleAmis } from './amis.js';
import {
  cartesDInvitation,
  lieuDe,
  modeleInvitationsDuSalon,
  partieARejoindre,
  presenceAffichee,
} from './presence.js';

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

function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

const PUBLIQUE_EN_SALON: LieuDUnAmi = {
  etat: 'salon',
  partie: { visibilite: 'publique', idRoom: 'room-4', mode: 'massacre', joueurs: 3, capacite: 12 },
};

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'privee',
  code: 'NX7K2P',
  capacite: 12,
  joueurs: [
    { id: 'moi', pseudo: 'Bob', hote: true, compte: { niveau: 1 } },
    { id: 'eve', pseudo: 'Eve', hote: false, compte: { niveau: 1 } },
  ],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Bob, connecte, avec ses amis lus et leur presence. */
function bobAvec(presences: readonly PresenceDUnAmi[], ...suite: Action[]): EtatClient {
  return apres([
    { type: 'sessionDeCompte', progression: progression('Bob') },
    { type: 'connexionEtablie' },
    { type: 'amisDemandes', lecture: 1 },
    {
      type: 'amisRecus',
      lecture: 1,
      liste: {
        amis: ['Alice', 'Carole', 'David', 'Eve', 'Zoe'].map((pseudo) => ({ pseudo, niveau: 3 })),
        recues: [],
        envoyees: [],
        bloques: [],
      },
    },
    { type: 'presenceDesAmis', presences },
    ...suite,
  ]);
}

function invitation(id: string, de = 'Alice'): InvitationRecue {
  return { id, de, mode: 'classique', visibilite: 'privee', joueurs: 2, capacite: 12 };
}

describe('la presence d un ami, en une ligne', () => {
  it('dit hors ligne, en ligne, un salon ou une partie', () => {
    expect(presenceAffichee(undefined)).toEqual({ etat: 'horsLigne', texte: 'Hors ligne' });
    expect(presenceAffichee({ etat: 'enLigne' })).toEqual({ etat: 'enLigne', texte: 'En ligne' });
    expect(presenceAffichee(PUBLIQUE_EN_SALON)).toEqual({
      etat: 'salon',
      texte: 'Dans un salon · Massacre · 3 sur 12',
    });
    expect(presenceAffichee({ etat: 'salon', partie: { visibilite: 'privee' } }).texte).toBe(
      'Dans le salon d’une partie privée',
    );
    expect(presenceAffichee({ etat: 'enPartie', partie: { visibilite: 'privee' } }).texte).toBe(
      'En partie privée',
    );
    expect(presenceAffichee({ ...PUBLIQUE_EN_SALON, etat: 'enPartie' }).texte).toBe(
      'En partie · Massacre',
    );
  });

  it('ne propose de rejoindre que le salon d une partie publique qui a de la place', () => {
    expect(partieARejoindre(PUBLIQUE_EN_SALON)).toBe('room-4');
    expect(partieARejoindre(undefined)).toBeUndefined();
    expect(partieARejoindre({ etat: 'enLigne' })).toBeUndefined();
    expect(partieARejoindre({ ...PUBLIQUE_EN_SALON, etat: 'enPartie' })).toBeUndefined();
    expect(partieARejoindre({ etat: 'salon', partie: { visibilite: 'privee' } })).toBeUndefined();
    expect(
      partieARejoindre({
        etat: 'salon',
        partie: { ...PUBLIQUE_EN_SALON.partie, joueurs: 12 } as never,
      }),
    ).toBeUndefined();
  });

  it('retrouve un ami quelle que soit l ecriture de son pseudo', () => {
    const etat = bobAvec([{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);

    expect(lieuDe(etat, ' alice ')).toEqual({ etat: 'enLigne' });
    expect(lieuDe(etat, 'Carole')).toBeUndefined();
  });
});

describe('l ecran Amis, avec la presence', () => {
  it('range les amis par presence, puis par pseudo, et propose de rejoindre', () => {
    const etat = bobAvec([
      { pseudo: 'Zoe', lieu: { etat: 'enLigne' } },
      { pseudo: 'David', lieu: { etat: 'enPartie', partie: { visibilite: 'privee' } } },
      { pseudo: 'Eve', lieu: PUBLIQUE_EN_SALON },
      { pseudo: 'Carole', lieu: { etat: 'enLigne' } },
    ]);
    const modele = modeleAmis(etat);

    if (modele.nature !== 'chargee') {
      throw new Error('Attendu une liste chargee.');
    }

    expect(modele.amis.lignes.map((ligne) => ligne.pseudo)).toEqual([
      'Eve',
      'Carole',
      'Zoe',
      'David',
      'Alice',
    ]);
    expect(modele.amis.lignes[0]?.rejoindre).toBe('room-4');
    expect(modele.amis.lignes.slice(1).every((ligne) => ligne.rejoindre === undefined)).toBe(true);
    expect(modele.amis.lignes.at(-1)?.presence).toEqual({ etat: 'horsLigne', texte: 'Hors ligne' });
  });
});

describe('les cartes d invitation', () => {
  it('se montrent sur les menus, de la plus recente a la plus ancienne', () => {
    const etat = bobAvec(
      [],
      { type: 'invitationRecue', invitation: invitation('i1') },
      {
        type: 'invitationRecue',
        invitation: { ...invitation('i2', 'Carole'), visibilite: 'publique' },
      },
    );

    expect(cartesDInvitation(etat)).toEqual([
      {
        id: 'i2',
        titre: 'Carole vous invite',
        detail: 'Horde · 2 sur 12',
        peutRejoindre: true,
        erreur: undefined,
      },
      {
        id: 'i1',
        titre: 'Alice vous invite',
        detail: 'Horde · partie privée · 2 sur 12',
        peutRejoindre: true,
        erreur: undefined,
      },
    ]);
  });

  it('attendent pendant une partie, et ne se montrent pas a un invite', () => {
    const auSalon = bobAvec(
      [],
      { type: 'invitationRecue', invitation: invitation('i1') },
      { type: 'entreeAcceptee', salon: SALON },
    );

    expect(cartesDInvitation(auSalon)).toEqual([]);
    expect(auSalon.invitationsDAmis.recues).toHaveLength(1);
    expect(cartesDInvitation(reduire(auSalon, { type: 'sortie' }))).toHaveLength(1);
    expect(
      cartesDInvitation(apres([{ type: 'invitationRecue', invitation: invitation('i1') }])),
    ).toEqual([]);
  });

  it('ne laissent pas rejoindre pendant une entree en cours, et disent le refus de la leur', () => {
    const tentee = bobAvec(
      [],
      { type: 'invitationRecue', invitation: invitation('i1') },
      { type: 'invitationRecue', invitation: invitation('i2', 'Carole') },
      { type: 'entreeDemandee', pseudo: undefined, invitation: 'i1' },
    );

    expect(cartesDInvitation(tentee).map((carte) => carte.peutRejoindre)).toEqual([false, false]);

    const refusee = reduire(tentee, {
      type: 'entreeRefusee',
      action: 'rejoindre',
      erreurs: [{ champ: 'capacite', motif: 'Cette partie est complète.' }],
    });

    expect(cartesDInvitation(refusee).map((carte) => carte.erreur)).toEqual([
      undefined,
      'Cette partie est complète.',
    ]);
  });
});

describe('la section Inviter des amis du salon', () => {
  it('liste les amis en ligne qui ne sont pas deja la, dans l ordre de la presence', () => {
    const etat = bobAvec(
      [
        { pseudo: 'Zoe', lieu: { etat: 'enPartie', partie: { visibilite: 'privee' } } },
        { pseudo: 'Eve', lieu: { etat: 'enLigne' } },
        { pseudo: 'Carole', lieu: { etat: 'enLigne' } },
        { pseudo: 'Alice', lieu: PUBLIQUE_EN_SALON },
      ],
      { type: 'entreeAcceptee', salon: SALON },
    );

    expect(modeleInvitationsDuSalon(etat)?.amis.map((ami) => ami.pseudo)).toEqual([
      'Alice',
      'Carole',
      'Zoe',
    ]);
  });

  it('dit, ami par ami, ce qu il en est de l invitation', () => {
    const etat = bobAvec(
      [
        { pseudo: 'Alice', lieu: { etat: 'enLigne' } },
        { pseudo: 'Carole', lieu: { etat: 'enLigne' } },
        { pseudo: 'David', lieu: { etat: 'enLigne' } },
      ],
      { type: 'entreeAcceptee', salon: SALON },
      { type: 'invitationEnvoyee', pseudo: 'Alice' },
      { type: 'invitationPartie', pseudo: 'Carole' },
      { type: 'invitationRefusee', pseudo: 'David', motif: 'Trop tôt.' },
    );
    const amis = modeleInvitationsDuSalon(etat)?.amis ?? [];

    expect(
      amis.map(({ pseudo, libelle, enCours, note, refusee }) => ({
        pseudo,
        libelle,
        enCours,
        note,
        refusee,
      })),
    ).toEqual([
      { pseudo: 'Alice', libelle: 'Inviter', enCours: true, note: undefined, refusee: false },
      {
        pseudo: 'Carole',
        libelle: 'Réinviter',
        enCours: false,
        note: 'Invitation envoyée.',
        refusee: false,
      },
      { pseudo: 'David', libelle: 'Inviter', enCours: false, note: 'Trop tôt.', refusee: true },
    ]);
  });

  it('dit pourquoi elle est vide, et n existe pas pour un invite', () => {
    const sansAmiEnLigne = bobAvec([], { type: 'entreeAcceptee', salon: SALON });
    const sansAmi = apres([
      { type: 'sessionDeCompte', progression: progression('Bob') },
      { type: 'entreeAcceptee', salon: SALON },
    ]);

    expect(modeleInvitationsDuSalon(sansAmiEnLigne)?.vide).toBe(
      'Aucun ami en ligne pour l’instant.',
    );
    expect(modeleInvitationsDuSalon(sansAmi)?.vide).toBe(
      'Ajoutez des amis depuis l’écran Amis pour les inviter ici.',
    );
    expect(modeleInvitationsDuSalon(apres([{ type: 'entreeAcceptee', salon: SALON }]))).toBe(
      undefined,
    );
  });
});
