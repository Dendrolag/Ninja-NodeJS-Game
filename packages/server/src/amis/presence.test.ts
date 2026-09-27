/**
 * Tests du registre de presence (etape 2.8): pages ouvertes et fermees, entrees et
 * sorties de partie, plusieurs pages d'un compte, et ce que les amis lisent d'une
 * partie publique ou privee.
 */

import type { Mode, StatutPartie, Visibilite } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { PartieObservee } from './presence.js';
import { RegistreDePresence, lieuDans, partieDUnAmi } from './presence.js';

/** Une partie d'essai: publique, en salon, deux joueurs sur douze, sauf precision. */
function partie(
  id: string,
  statut: StatutPartie = 'salon',
  visibilite: Visibilite = 'publique',
  mode: Mode = 'classique',
): PartieObservee {
  return {
    id,
    statut,
    visibilite,
    mode,
    capacite: 12,
    joueurs: [
      { id: 'j1', pseudo: 'Alice', hote: true },
      { id: 'j2', pseudo: 'Bob', hote: false },
    ],
  };
}

/** Un annuaire de parties d'essai. */
function parties(...liste: PartieObservee[]): (idRoom: string) => PartieObservee | undefined {
  const parId = new Map(liste.map((une) => [une.id, une]));

  return (idRoom) => parId.get(idRoom);
}

describe('RegistreDePresence, pages ouvertes et fermees', () => {
  it('dit en ligne un compte des sa premiere page, et hors ligne apres la derniere', () => {
    const registre = new RegistreDePresence();

    expect(registre.ouvrir('c1', 'alice')).toBe(true);
    expect(registre.enLigne('alice')).toBe(true);
    expect(registre.ouvrir('c2', 'alice')).toBe(false);
    expect(registre.connexionsDe('alice')).toEqual(['c1', 'c2']);

    expect(registre.fermer('c1')).toBeUndefined();
    expect(registre.enLigne('alice')).toBe(true);
    expect(registre.fermer('c2')).toBe('alice');
    expect(registre.enLigne('alice')).toBe(false);
    expect(registre.connexionsDe('alice')).toEqual([]);
  });

  it('ignore une connexion inconnue, celle d un invite', () => {
    const registre = new RegistreDePresence();

    expect(registre.fermer('invite')).toBeUndefined();
    expect(registre.entrer('invite', 'room-1')).toBeUndefined();
    expect(registre.sortir('invite')).toBeUndefined();
    expect(registre.compteDe('invite')).toBeUndefined();
    expect(registre.lieuDe('personne', parties())).toBeUndefined();
  });

  it('rouvrir une connexion connue ne la compte pas deux fois', () => {
    const registre = new RegistreDePresence();
    registre.ouvrir('c1', 'alice');

    expect(registre.ouvrir('c1', 'alice')).toBe(true);
    expect(registre.connexionsDe('alice')).toEqual(['c1']);
  });

  it('oublie tout en se vidant', () => {
    const registre = new RegistreDePresence();
    registre.ouvrir('c1', 'alice');
    registre.vider();

    expect(registre.enLigne('alice')).toBe(false);
    expect(registre.compteDe('c1')).toBeUndefined();
  });
});

describe('RegistreDePresence, entrees et sorties de partie', () => {
  it('suit la partie de chaque connexion, et les comptes de chaque partie', () => {
    const registre = new RegistreDePresence();
    registre.ouvrir('c1', 'alice');
    registre.ouvrir('c2', 'bob');
    registre.ouvrir('c3', 'alice');

    expect(registre.entrer('c1', 'room-1')).toBe('alice');
    registre.entrer('c2', 'room-1');
    registre.entrer('c3', 'room-1');

    expect(registre.partieDe('c1')).toBe('room-1');
    expect(registre.comptesDans('room-1')).toEqual(['alice', 'bob']);

    expect(registre.sortir('c2')).toBe('bob');
    expect(registre.partieDe('c2')).toBeUndefined();
    expect(registre.comptesDans('room-1')).toEqual(['alice']);
  });

  it('dit en ligne un compte sur les menus, dans un salon, puis en partie', () => {
    const registre = new RegistreDePresence();
    registre.ouvrir('c1', 'alice');

    expect(registre.lieuDe('alice', parties())).toEqual({ etat: 'enLigne' });

    registre.entrer('c1', 'room-1');
    expect(registre.lieuDe('alice', parties(partie('room-1')))?.etat).toBe('salon');
    expect(registre.lieuDe('alice', parties(partie('room-1', 'enCours')))?.etat).toBe('enPartie');

    registre.sortir('c1');
    expect(registre.lieuDe('alice', parties(partie('room-1')))).toEqual({ etat: 'enLigne' });
  });

  it('compte une partie disparue comme aucune partie', () => {
    const registre = new RegistreDePresence();
    registre.ouvrir('c1', 'alice');
    registre.entrer('c1', 'room-disparue');

    expect(registre.lieuDe('alice', parties())).toEqual({ etat: 'enLigne' });
  });

  it('donne a un compte de plusieurs pages son etat le plus engage', () => {
    const registre = new RegistreDePresence();
    registre.ouvrir('menus', 'alice');
    registre.ouvrir('salon', 'alice');
    registre.ouvrir('jeu', 'alice');
    registre.entrer('salon', 'room-salon');
    registre.entrer('jeu', 'room-jeu');

    const toutes = parties(partie('room-salon'), partie('room-jeu', 'enCours'));

    expect(registre.lieuDe('alice', toutes)?.etat).toBe('enPartie');

    registre.fermer('jeu');
    expect(registre.lieuDe('alice', toutes)?.etat).toBe('salon');

    registre.fermer('salon');
    expect(registre.lieuDe('alice', toutes)?.etat).toBe('enLigne');
  });
});

describe('ce que les amis lisent d une partie', () => {
  it('montre d une partie publique son identifiant, son mode, ses joueurs et sa capacite', () => {
    expect(partieDUnAmi(partie('room-7', 'salon', 'publique', 'massacre'))).toEqual({
      visibilite: 'publique',
      idRoom: 'room-7',
      mode: 'massacre',
      joueurs: 2,
      capacite: 12,
    });
  });

  it('ne montre d une partie privee que qu elle l est: ni identifiant, ni mode, ni code', () => {
    const privee = { ...partie('room-8', 'salon', 'privee'), code: 'NX7K2P' };

    expect(partieDUnAmi(privee)).toEqual({ visibilite: 'privee' });
    expect(JSON.stringify(lieuDans(privee))).not.toContain('NX7K2P');
    expect(JSON.stringify(lieuDans(privee))).not.toContain('room-8');
  });

  it('dit en ligne le joueur d une partie terminee', () => {
    expect(lieuDans(partie('room-1', 'terminee'))).toEqual({ etat: 'enLigne' });
  });
});
