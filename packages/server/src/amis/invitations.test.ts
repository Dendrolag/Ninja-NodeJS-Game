/**
 * Tests du registre des invitations (etape 2.8): emission, remplacement, limite par
 * ami, validite, expiration sur l'horloge, retraits et fermeture.
 */

import { BORNES_INVITATIONS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { HorlogeManuelle } from '../horloge.js';
import { creerHorlogeManuelle } from '../horloge.js';
import type { Invitation } from './invitations.js';
import { INVITATION_TROP_TOT, RegistreDesInvitations } from './invitations.js';

/** Ce que l'invite lit, sans l'identifiant. */
const DESCRIPTION = {
  de: 'Alice',
  mode: 'classique',
  visibilite: 'privee',
  joueurs: 2,
  capacite: 12,
} as const;

/** Un registre sur une horloge manuelle, avec des identifiants previsibles. */
function monter(): {
  registre: RegistreDesInvitations;
  horloge: HorlogeManuelle;
  expirees: Invitation[];
} {
  const horloge = creerHorlogeManuelle();
  const expirees: Invitation[] = [];
  let compteur = 0;

  const registre = new RegistreDesInvitations({
    horloge,
    tirerIdentifiant: () => {
      compteur += 1;
      return `invitation-${String(compteur)}`;
    },
    surExpiration: (invitation) => {
      expirees.push(invitation);
    },
  });

  return { registre, horloge, expirees };
}

/** L'invitation emise, ou un echec de test explicite. */
function emise(registre: RegistreDesInvitations, de: string, pour: string, idRoom = 'room-1') {
  const emission = registre.emettre(de, pour, idRoom, DESCRIPTION);

  if (!emission.valide) {
    throw new Error(`Invitation refusee: ${emission.erreurs.map((e) => e.motif).join(', ')}`);
  }

  return emission.valeur;
}

describe('RegistreDesInvitations, emission', () => {
  it('emet un droit d entree sous un identifiant tire, que l invite lira', () => {
    const { registre } = monter();

    const { invitation, remplacee } = emise(registre, 'alice', 'bob');

    expect(invitation).toEqual({
      id: 'invitation-1',
      de: 'alice',
      pour: 'bob',
      idRoom: 'room-1',
      recue: { id: 'invitation-1', ...DESCRIPTION },
    });
    expect(remplacee).toBeUndefined();
    expect(registre.nombre).toBe(1);
  });

  it('tire par defaut un identifiant de la forme d un jeton de session', () => {
    const registre = new RegistreDesInvitations({
      horloge: creerHorlogeManuelle(),
      surExpiration: () => undefined,
    });
    const emission = registre.emettre('alice', 'bob', 'room-1', DESCRIPTION);

    expect(emission.valide && emission.valeur.invitation.id).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    registre.fermer();
  });

  it('refuse d inviter le meme ami avant une minute, puis l accepte et remplace l ancienne', () => {
    const { registre, horloge } = monter();
    emise(registre, 'alice', 'bob');

    horloge.avancerDe(BORNES_INVITATIONS.intervalleParAmiMs - 1);
    const tropTot = registre.emettre('alice', 'bob', 'room-2', DESCRIPTION);
    expect(tropTot).toEqual({
      valide: false,
      erreurs: [{ champ: 'invitation', motif: INVITATION_TROP_TOT }],
    });

    horloge.avancerDe(1);
    const { invitation, remplacee } = emise(registre, 'alice', 'bob', 'room-2');

    expect(remplacee?.id).toBe('invitation-1');
    expect(invitation.idRoom).toBe('room-2');
    expect(registre.nombre).toBe(1);
    expect(registre.valable('invitation-1', 'bob')).toBeUndefined();
  });

  it('ne limite pas un inviteur vers deux amis, ni deux inviteurs vers le meme ami', () => {
    const { registre } = monter();

    emise(registre, 'alice', 'bob');
    emise(registre, 'alice', 'carole');
    emise(registre, 'david', 'bob');

    expect(registre.nombre).toBe(3);
    expect(registre.enAttentePour('bob').map((invitation) => invitation.de)).toEqual([
      'alice',
      'david',
    ]);
  });
});

describe('RegistreDesInvitations, validite', () => {
  it('ne vaut que pour le compte invite', () => {
    const { registre } = monter();
    emise(registre, 'alice', 'bob');

    expect(registre.valable('invitation-1', 'bob')?.idRoom).toBe('room-1');
    expect(registre.valable('invitation-1', 'carole')).toBeUndefined();
    expect(registre.valable('invitation-1', undefined)).toBeUndefined();
    expect(registre.valable('inconnue', 'bob')).toBeUndefined();
  });

  it('expire au bout de deux minutes, et le dit', () => {
    const { registre, horloge, expirees } = monter();
    emise(registre, 'alice', 'bob');

    horloge.avancerDe(BORNES_INVITATIONS.validiteMs - 1);
    expect(registre.valable('invitation-1', 'bob')).toBeDefined();
    expect(expirees).toEqual([]);

    horloge.avancerDe(1);
    expect(registre.valable('invitation-1', 'bob')).toBeUndefined();
    expect(expirees.map((invitation) => invitation.id)).toEqual(['invitation-1']);

    horloge.avancerDe(BORNES_INVITATIONS.validiteMs * 3);
    expect(expirees).toHaveLength(1);
  });

  it('une invitation remplacee n expire plus', () => {
    const { registre, horloge, expirees } = monter();
    emise(registre, 'alice', 'bob');
    horloge.avancerDe(BORNES_INVITATIONS.intervalleParAmiMs);
    emise(registre, 'alice', 'bob');

    horloge.avancerDe(BORNES_INVITATIONS.validiteMs - BORNES_INVITATIONS.intervalleParAmiMs);
    expect(expirees).toEqual([]);

    horloge.avancerDe(BORNES_INVITATIONS.intervalleParAmiMs);
    expect(expirees.map((invitation) => invitation.id)).toEqual(['invitation-2']);
  });
});

describe('RegistreDesInvitations, retraits', () => {
  it('retire une invitation, sans qu elle expire ensuite', () => {
    const { registre, horloge, expirees } = monter();
    emise(registre, 'alice', 'bob');

    expect(registre.retirer('invitation-1')?.pour).toBe('bob');
    expect(registre.retirer('invitation-1')).toBeUndefined();

    horloge.avancerDe(BORNES_INVITATIONS.validiteMs);
    expect(expirees).toEqual([]);
  });

  it('retire celles d une partie, et rend lesquelles', () => {
    const { registre } = monter();
    emise(registre, 'alice', 'bob', 'room-1');
    emise(registre, 'alice', 'carole', 'room-1');
    emise(registre, 'david', 'bob', 'room-2');

    const retirees = registre.retirerSi((invitation) => invitation.idRoom === 'room-1');

    expect(retirees.map((invitation) => invitation.pour)).toEqual(['bob', 'carole']);
    expect(registre.nombre).toBe(1);
  });

  it('sait s il existe une invitation entre deux comptes, dans un sens ou l autre', () => {
    const { registre } = monter();
    emise(registre, 'alice', 'bob');

    expect(registre.existeEntre('alice', 'bob')).toBe(true);
    expect(registre.existeEntre('bob', 'alice')).toBe(true);
    expect(registre.existeEntre('alice', 'carole')).toBe(false);
  });

  it('arrete tous les delais en se fermant, sans prevenir', () => {
    const { registre, horloge, expirees } = monter();
    emise(registre, 'alice', 'bob');
    registre.fermer();

    horloge.avancerDe(BORNES_INVITATIONS.validiteMs);
    expect(expirees).toEqual([]);
    expect(registre.nombre).toBe(0);

    // La limite par ami est oubliee aussi.
    emise(registre, 'alice', 'bob');
  });
});
