/**
 * Tests des schemas de validation des comptes (etape 3.2).
 *
 * Memes exigences que validation.test.ts: les bornes se verifient des deux cotes,
 * et rien n'est rogne en silence. S'y ajoute une exigence propre aux mots de
 * passe: ils ne sont pas normalises comme un pseudo. Leurs espaces et leur casse
 * font partie du secret.
 */

import { describe, expect, it } from 'vitest';

import { BORNES_JETON, BORNES_MOT_DE_PASSE } from './bornes.js';
import type { ResultatValidation } from './validation.js';
import {
  validerDemandeConnexion,
  validerDemandeCreation,
  validerDemandeInscription,
  validerJeton,
  validerMotDePasse,
} from './validation.js';

/** La valeur acceptee, ou un echec de test explicite si elle a ete refusee. */
function valeurAcceptee<T>(resultat: ResultatValidation<T>): T {
  if (!resultat.valide) {
    throw new Error(
      `Attendu accepte, recu refuse: ${resultat.erreurs.map((e) => `${e.champ} ${e.motif}`).join(' | ')}`,
    );
  }
  return resultat.valeur;
}

/** Les chemins des champs fautifs, ou un echec de test si l'entree a ete acceptee. */
function champsRefuses<T>(resultat: ResultatValidation<T>): readonly string[] {
  if (resultat.valide) {
    throw new Error('Attendu refuse, recu accepte.');
  }
  return resultat.erreurs.map((erreur) => erreur.champ);
}

describe('validerMotDePasse', () => {
  const { minimum, maximum } = BORNES_MOT_DE_PASSE.longueur;

  it('accepte la longueur minimale et refuse celle qui lui manque un caractere', () => {
    expect(valeurAcceptee(validerMotDePasse('a'.repeat(minimum)))).toBe('a'.repeat(minimum));
    expect(champsRefuses(validerMotDePasse('a'.repeat(minimum - 1)))).toEqual(['motDePasse']);
  });

  it('accepte la longueur maximale et refuse celle qui la depasse d un caractere', () => {
    expect(valeurAcceptee(validerMotDePasse('a'.repeat(maximum)))).toHaveLength(maximum);
    expect(champsRefuses(validerMotDePasse('a'.repeat(maximum + 1)))).toEqual(['motDePasse']);
  });

  it('compte les caracteres, pas les unites de codage', () => {
    // Huit caracteres hors du plan de base, soit seize unites de codage.
    const huit = '\u{1F512}'.repeat(minimum);

    expect(valeurAcceptee(validerMotDePasse(huit))).toBe(huit);
  });

  it('ne rogne ni les espaces ni la casse, qui font partie du secret', () => {
    expect(valeurAcceptee(validerMotDePasse('  Mot De Passe  '))).toBe('  Mot De Passe  ');
  });

  it('compose les lettres accentuees, pour qu un meme mot de passe ouvre le meme compte', () => {
    const decompose = 'café creme';
    const compose = 'café creme';

    expect(valeurAcceptee(validerMotDePasse(decompose))).toBe(compose);
  });

  it('refuse ce qui n est pas du texte', () => {
    expect(champsRefuses(validerMotDePasse(12345678))).toEqual(['motDePasse']);
    expect(champsRefuses(validerMotDePasse(undefined))).toEqual(['motDePasse']);
  });
});

describe('validerDemandeInscription', () => {
  it('accepte un pseudo et un mot de passe valides, pseudo normalise', () => {
    expect(
      valeurAcceptee(validerDemandeInscription({ pseudo: '  Alice ', motDePasse: 'secret123' })),
    ).toEqual({ pseudo: 'Alice', motDePasse: 'secret123' });
  });

  it('rend toutes les erreurs ensemble', () => {
    expect(
      champsRefuses(validerDemandeInscription({ pseudo: '<b>', motDePasse: 'court' })),
    ).toEqual(['pseudo', 'motDePasse']);
  });

  it('refuse ce qui n est pas un objet', () => {
    expect(champsRefuses(validerDemandeInscription('Alice'))).toEqual(['inscription']);
    expect(champsRefuses(validerDemandeInscription(null))).toEqual(['inscription']);
  });

  it('ignore les champs que la demande ajoute d elle-meme', () => {
    expect(
      valeurAcceptee(
        validerDemandeInscription({ pseudo: 'Alice', motDePasse: 'secret123', xpTotale: 99999 }),
      ),
    ).toEqual({ pseudo: 'Alice', motDePasse: 'secret123' });
  });
});

describe('validerDemandeConnexion', () => {
  it('n impose pas la longueur minimale, qui ne vaut que pour creer un mot de passe', () => {
    expect(valeurAcceptee(validerDemandeConnexion({ pseudo: 'Alice', motDePasse: 'x' }))).toEqual({
      pseudo: 'Alice',
      motDePasse: 'x',
    });
  });

  it('refuse un mot de passe demesure, pour epargner le hachage au serveur', () => {
    const demesure = 'a'.repeat(BORNES_MOT_DE_PASSE.longueur.maximum + 1);

    expect(
      champsRefuses(validerDemandeConnexion({ pseudo: 'Alice', motDePasse: demesure })),
    ).toEqual(['motDePasse']);
  });

  it('refuse un pseudo qu aucun compte ne peut porter', () => {
    expect(champsRefuses(validerDemandeConnexion({ pseudo: '', motDePasse: 'secret123' }))).toEqual(
      ['pseudo'],
    );
  });

  it('refuse un mot de passe qui n est pas du texte, et ce qui n est pas un objet', () => {
    expect(champsRefuses(validerDemandeConnexion({ pseudo: 'Alice' }))).toEqual(['motDePasse']);
    expect(champsRefuses(validerDemandeConnexion([]))).toEqual(['connexion']);
  });
});

describe('validerJeton', () => {
  it('accepte un jeton de la forme de ceux que le serveur fabrique', () => {
    const jeton = 'Ab0_-'.repeat(8).concat('xyz');

    expect(BORNES_JETON.forme.test(jeton)).toBe(true);
    expect(valeurAcceptee(validerJeton(jeton))).toBe(jeton);
  });

  it('refuse une longueur differente, un caractere etranger, et ce qui n est pas du texte', () => {
    expect(champsRefuses(validerJeton('a'.repeat(42)))).toEqual(['jeton']);
    expect(champsRefuses(validerJeton('a'.repeat(44)))).toEqual(['jeton']);
    expect(champsRefuses(validerJeton(`${'a'.repeat(42)}=`))).toEqual(['jeton']);
    expect(champsRefuses(validerJeton(42))).toEqual(['jeton']);
  });
});

describe('validerDemandeCreation sans pseudo', () => {
  it('accepte la demande d un compte, qui creera sous son propre pseudo', () => {
    const demande = valeurAcceptee(
      validerDemandeCreation({ configuration: { mode: 'classique', visibilite: 'privee' } }),
    );

    expect(demande.pseudo).toBeUndefined();
    expect('pseudo' in demande).toBe(false);
  });
});
