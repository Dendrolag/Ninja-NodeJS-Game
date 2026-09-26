/**
 * Tests du lien d'invitation (etape 2.7): le lire dans l'adresse, le fabriquer,
 * l'oublier une fois qu'il a servi, et ce que le client en fait.
 *
 * Ce qu'ils protegent: un code mal forme ne part jamais au serveur, le lien partage
 * pointe vers la page sans rien emporter d'autre, et une invitation qui a servi ne
 * reste ni dans l'etat ni dans l'adresse, ou un rechargement la reproposerait.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from './client.js';
import { creerClient } from './client.js';
import type { FenetreDInvitation, Invitation } from './invitation.js';
import {
  adresseDInvitation,
  adresseSansInvitation,
  brancherLAdresseDInvitation,
  lireLInvitation,
} from './invitation.js';
import { ETAT_INITIAL } from './etat.js';
import type { EtatClient } from './etat.js';
import { reduire } from './reduction.js';
import type { ReseauFactice } from './reseau.js';
import { creerReseauFactice } from './reseau.js';

/** Le motif de validerCodeInvitation pour un code qui n'en a pas la forme. */
const MOTIF_MAL_FORME = "Un code d'invitation compte 6 lettres ou chiffres.";

/** Le salon d'une partie privee. */
const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'privee',
  code: 'K7XM3Q',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Bob', hote: false }],
  reglages: REGLAGES_PAR_DEFAUT,
};

describe('lireLInvitation', () => {
  it('ne trouve rien dans une adresse sans parametre partie', () => {
    expect(lireLInvitation('')).toBeUndefined();
    expect(lireLInvitation('?diagnostic=1')).toBeUndefined();
  });

  it('lit un code bien forme', () => {
    expect(lireLInvitation('?partie=K7XM3Q')).toStrictEqual({ nature: 'code', code: 'K7XM3Q' });
  });

  it('ramene un code en minuscules ou entoure d espaces a sa forme canonique', () => {
    expect(lireLInvitation('?partie=k7xm3q')).toStrictEqual({ nature: 'code', code: 'K7XM3Q' });
    expect(lireLInvitation('?partie=%20K7XM3Q%20')).toStrictEqual({
      nature: 'code',
      code: 'K7XM3Q',
    });
  });

  it('lit le code parmi d autres parametres', () => {
    expect(lireLInvitation('?diagnostic=1&partie=K7XM3Q')).toStrictEqual({
      nature: 'code',
      code: 'K7XM3Q',
    });
  });

  it('refuse un code mal forme, avec le motif de la regle du serveur', () => {
    const malFormee: Invitation = { nature: 'malFormee', motif: MOTIF_MAL_FORME };

    // Trop court, trop long, un caractere hors de l'alphabet (O et 0 s'y confondent).
    expect(lireLInvitation('?partie=K7XM3')).toStrictEqual(malFormee);
    expect(lireLInvitation('?partie=K7XM3QQ')).toStrictEqual(malFormee);
    expect(lireLInvitation('?partie=K7XM3O')).toStrictEqual(malFormee);
    expect(lireLInvitation('?partie=%3Cscript%3E')).toStrictEqual(malFormee);
  });

  it('tient un parametre vide pour une invitation mal formee, pas pour une absence', () => {
    expect(lireLInvitation('?partie=')).toStrictEqual({
      nature: 'malFormee',
      motif: MOTIF_MAL_FORME,
    });
  });
});

describe('adresseDInvitation', () => {
  it('ajoute le code a l adresse de la page', () => {
    expect(adresseDInvitation('https://neon-ninja.example/', 'K7XM3Q')).toBe(
      'https://neon-ninja.example/?partie=K7XM3Q',
    );
  });

  it('garde le chemin, mais ni les parametres ni le fragment de la page', () => {
    expect(
      adresseDInvitation(
        'http://localhost:3000/jeu/?diagnostic=1&densite=1&partie=AAAAAA#salon',
        'K7XM3Q',
      ),
    ).toBe('http://localhost:3000/jeu/?partie=K7XM3Q');
  });

  it('se relit en la meme invitation', () => {
    const lien = new URL(adresseDInvitation('https://neon-ninja.example/', 'K7XM3Q'));

    expect(lireLInvitation(lien.search)).toStrictEqual({ nature: 'code', code: 'K7XM3Q' });
  });
});

describe('adresseSansInvitation', () => {
  it('retire le parametre partie, et le point d interrogation avec lui', () => {
    expect(adresseSansInvitation('https://neon-ninja.example/?partie=K7XM3Q')).toBe(
      'https://neon-ninja.example/',
    );
  });

  it('garde les autres parametres et le fragment', () => {
    expect(adresseSansInvitation('http://localhost:3000/?diagnostic=1&partie=K7XM3Q#x')).toBe(
      'http://localhost:3000/?diagnostic=1#x',
    );
  });

  it('ne rend rien pour une adresse sans invitation', () => {
    expect(adresseSansInvitation('https://neon-ninja.example/?diagnostic=1')).toBeUndefined();
  });
});

describe('l invitation dans le client', () => {
  let reseau: ReseauFactice;

  beforeEach(() => {
    reseau = creerReseauFactice();
  });

  it('entre dans l etat a la creation du client, et lui seul', () => {
    const invitation: Invitation = { nature: 'code', code: 'K7XM3Q' };

    expect(creerClient({ reseau, invitation }).etat.invitation).toStrictEqual(invitation);
    expect(creerClient({ reseau: creerReseauFactice() }).etat.invitation).toBeUndefined();
  });

  it('s efface quand le joueur l ignore', () => {
    const client = creerClient({ reseau, invitation: { nature: 'code', code: 'K7XM3Q' } });

    client.ignorerLInvitation();

    expect(client.etat.invitation).toBeUndefined();
  });

  it('s efface a l entree acceptee, pas au refus', () => {
    const client = creerClient({ reseau, invitation: { nature: 'code', code: 'K7XM3Q' } });
    reseau.simulerConnexion();

    client.rejoindre('Bob', { code: 'K7XM3Q' });
    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Bob', code: 'K7XM3Q' });

    reseau.dernier('rejoindre')?.[1]({
      valide: false,
      erreurs: [{ champ: 'code', motif: 'Aucune partie ne porte ce code.' }],
    });
    expect(client.etat.invitation).toStrictEqual({ nature: 'code', code: 'K7XM3Q' });

    client.rejoindre('Bob', { code: 'K7XM3Q' });
    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    expect(client.etat.ecran).toBe('salon');
    expect(client.etat.invitation).toBeUndefined();
  });
});

describe('l invitation dans l etat', () => {
  const INVITATION: Invitation = { nature: 'code', code: 'K7XM3Q' };

  it('survit a une sortie de partie: un retour en partie passe avant elle', () => {
    const enPartie: EtatClient = {
      ...ETAT_INITIAL,
      ecran: 'jeu',
      connexion: 'connecte',
      invitation: INVITATION,
    };

    expect(reduire(enPartie, { type: 'sortie' })).toMatchObject({
      ecran: 'accueil',
      invitation: INVITATION,
    });
  });

  it('ignoree, emporte le refus d entree qu elle avait provoque, et lui seul', () => {
    const refusee: EtatClient = {
      ...ETAT_INITIAL,
      invitation: INVITATION,
      refus: { action: 'rejoindre', erreurs: [{ champ: 'code', motif: 'Partie introuvable.' }] },
    };
    const refusDeChat: EtatClient = {
      ...refusee,
      refus: { action: 'chat', erreurs: [{ champ: 'texte', motif: 'Trop long.' }] },
    };

    expect(reduire(refusee, { type: 'invitationIgnoree' })).toMatchObject({
      invitation: undefined,
      refus: undefined,
    });
    expect(reduire(refusDeChat, { type: 'invitationIgnoree' }).refus).toBe(refusDeChat.refus);
  });
});

describe('brancherLAdresseDInvitation', () => {
  /** Une fenetre d'essai: son adresse, et les remplacements faits dans son historique. */
  function fenetreDEssai(href: string): FenetreDInvitation & { remplacements: string[] } {
    const remplacements: string[] = [];
    const fenetre = {
      location: { href },
      remplacements,
      history: {
        state: { cle: 'etat' },
        replaceState: (etat: unknown, _titre: string, url?: string | URL | null) => {
          expect(etat).toStrictEqual({ cle: 'etat' });
          const nouvelle = String(url);
          remplacements.push(nouvelle);
          fenetre.location.href = nouvelle;
        },
      },
    };

    return fenetre;
  }

  let reseau: ReseauFactice;
  let client: Client;

  beforeEach(() => {
    reseau = creerReseauFactice();
    client = creerClient({ reseau, invitation: { nature: 'code', code: 'K7XM3Q' } });
  });

  it('laisse l adresse tant que l invitation n a pas servi', () => {
    const fenetre = fenetreDEssai('https://neon-ninja.example/?partie=K7XM3Q');
    brancherLAdresseDInvitation(client, fenetre);

    reseau.simulerConnexion();
    client.saisirPseudo('Bob');

    expect(fenetre.remplacements).toEqual([]);
  });

  it('retire l invitation de l adresse une fois ignoree, une seule fois', () => {
    const fenetre = fenetreDEssai('https://neon-ninja.example/?diagnostic=1&partie=K7XM3Q');
    brancherLAdresseDInvitation(client, fenetre);

    client.ignorerLInvitation();
    client.saisirPseudo('Bob');

    expect(fenetre.remplacements).toEqual(['https://neon-ninja.example/?diagnostic=1']);
  });

  it('retire l invitation de l adresse a l entree dans la partie', () => {
    const fenetre = fenetreDEssai('https://neon-ninja.example/?partie=K7XM3Q');
    brancherLAdresseDInvitation(client, fenetre);
    reseau.simulerConnexion();

    client.rejoindre('Bob', { code: 'K7XM3Q' });
    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    expect(fenetre.remplacements).toEqual(['https://neon-ninja.example/']);
  });

  it('cesse d ecouter quand on le lui demande', () => {
    const fenetre = fenetreDEssai('https://neon-ninja.example/?partie=K7XM3Q');
    const arreter = brancherLAdresseDInvitation(client, fenetre);

    arreter();
    client.ignorerLInvitation();

    expect(fenetre.remplacements).toEqual([]);
  });
});
