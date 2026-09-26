/**
 * Tests des schemas de validation des comptes (etape 3.2).
 *
 * Memes exigences que validation.test.ts: les bornes se verifient des deux cotes,
 * et rien n'est rogne en silence. S'y ajoute une exigence propre aux mots de
 * passe: ils ne sont pas normalises comme un pseudo. Leurs espaces et leur casse
 * font partie du secret.
 */

import { describe, expect, it } from 'vitest';

import { BORNES_CODE_DE_SECOURS, BORNES_JETON, BORNES_MOT_DE_PASSE } from './bornes.js';
import { GESTES_D_AMITIE, PARAMETRE_PSEUDO, ROUTES_COMPTES, adresseDeLaFiche } from './comptes.js';
import type { ResultatValidation } from './validation.js';
import {
  formaterCodeDeSecours,
  validerCodeDeSecours,
  validerDemandeChangementMotDePasse,
  validerDemandeCodeDeSecours,
  validerDemandeConnexion,
  validerDemandeCreation,
  validerDemandeDeGeste,
  validerDemandeInscription,
  validerDemandeReinitialisation,
  validerJeton,
  validerMotDePasse,
} from './validation.js';

/** Un code de secours normalise, de la forme de ceux que le serveur fabrique. */
const CODE = 'K7QM3X9DTP4W8HNE';

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

  it('nomme le champ demande dans ses erreurs', () => {
    expect(champsRefuses(validerMotDePasse('court', 'nouveauMotDePasse'))).toEqual([
      'nouveauMotDePasse',
    ]);
  });
});

describe('validerCodeDeSecours', () => {
  it('accepte un code normalise, et le rend tel quel', () => {
    expect(BORNES_CODE_DE_SECOURS.forme.test(CODE)).toBe(true);
    expect(valeurAcceptee(validerCodeDeSecours(CODE))).toBe(CODE);
  });

  it('pardonne la casse, les espaces et les tirets d une recopie', () => {
    expect(valeurAcceptee(validerCodeDeSecours(' k7qm-3x9d tp4w-8hne '))).toBe(CODE);
  });

  it('lit O comme zero, I et L comme un', () => {
    expect(valeurAcceptee(validerCodeDeSecours('OOOO-IIII-LLLL-oil0'))).toBe('0000111111110110');
  });

  it('accepte chacun des trente-deux caracteres de l alphabet', () => {
    const { alphabet } = BORNES_CODE_DE_SECOURS;

    expect(alphabet).toHaveLength(32);
    expect(valeurAcceptee(validerCodeDeSecours(alphabet.slice(0, 16)))).toBe(alphabet.slice(0, 16));
    expect(valeurAcceptee(validerCodeDeSecours(alphabet.slice(16)))).toBe(alphabet.slice(16));
  });

  it('refuse un code trop court, trop long, ou qui porte un U', () => {
    expect(champsRefuses(validerCodeDeSecours(CODE.slice(1)))).toEqual(['codeDeSecours']);
    expect(champsRefuses(validerCodeDeSecours(`${CODE}0`))).toEqual(['codeDeSecours']);
    expect(champsRefuses(validerCodeDeSecours(`U${CODE.slice(1)}`))).toEqual(['codeDeSecours']);
  });

  it('refuse une saisie demesuree, meme faite d espaces, et ce qui n est pas du texte', () => {
    const noye = `${' '.repeat(BORNES_CODE_DE_SECOURS.saisieMaximum)}${CODE}`;

    expect(champsRefuses(validerCodeDeSecours(noye))).toEqual(['codeDeSecours']);
    expect(champsRefuses(validerCodeDeSecours(42))).toEqual(['codeDeSecours']);
  });
});

describe('formaterCodeDeSecours', () => {
  it('ecrit quatre groupes de quatre separes par des tirets, que la validation relit', () => {
    const affiche = formaterCodeDeSecours(CODE);

    expect(affiche).toBe('K7QM-3X9D-TP4W-8HNE');
    expect(valeurAcceptee(validerCodeDeSecours(affiche))).toBe(CODE);
  });
});

describe('validerDemandeChangementMotDePasse', () => {
  it('accepte le mot de passe actuel sans longueur minimale, et un nouveau conforme', () => {
    expect(
      valeurAcceptee(
        validerDemandeChangementMotDePasse({ motDePasse: 'x', nouveauMotDePasse: 'secret123' }),
      ),
    ).toEqual({ motDePasse: 'x', nouveauMotDePasse: 'secret123' });
  });

  it('rend toutes les erreurs ensemble, chacune sous son champ', () => {
    expect(
      champsRefuses(validerDemandeChangementMotDePasse({ motDePasse: 3, nouveauMotDePasse: 'a' })),
    ).toEqual(['motDePasse', 'nouveauMotDePasse']);
  });

  it('refuse ce qui n est pas un objet', () => {
    expect(champsRefuses(validerDemandeChangementMotDePasse('secret123'))).toEqual(['changement']);
  });
});

describe('validerDemandeCodeDeSecours', () => {
  it('accepte le mot de passe actuel, et refuse ce qui n en est pas un', () => {
    expect(valeurAcceptee(validerDemandeCodeDeSecours({ motDePasse: 'x' }))).toEqual({
      motDePasse: 'x',
    });
    expect(champsRefuses(validerDemandeCodeDeSecours({}))).toEqual(['motDePasse']);
    expect(champsRefuses(validerDemandeCodeDeSecours(null))).toEqual(['code']);
  });

  it('refuse un mot de passe demesure', () => {
    const demesure = 'a'.repeat(BORNES_MOT_DE_PASSE.longueur.maximum + 1);

    expect(champsRefuses(validerDemandeCodeDeSecours({ motDePasse: demesure }))).toEqual([
      'motDePasse',
    ]);
  });
});

describe('validerDemandeReinitialisation', () => {
  it('accepte une demande valide, pseudo et code normalises', () => {
    expect(
      valeurAcceptee(
        validerDemandeReinitialisation({
          pseudo: ' Alice ',
          codeDeSecours: 'k7qm-3x9d-tp4w-8hne',
          nouveauMotDePasse: 'secret123',
        }),
      ),
    ).toEqual({ pseudo: 'Alice', codeDeSecours: CODE, nouveauMotDePasse: 'secret123' });
  });

  it('rend toutes les erreurs ensemble', () => {
    expect(
      champsRefuses(
        validerDemandeReinitialisation({ pseudo: '', codeDeSecours: 'abc', nouveauMotDePasse: '' }),
      ),
    ).toEqual(['pseudo', 'codeDeSecours', 'nouveauMotDePasse']);
  });

  it('refuse ce qui n est pas un objet', () => {
    expect(champsRefuses(validerDemandeReinitialisation(undefined))).toEqual(['reinitialisation']);
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

describe('adresseDeLaFiche', () => {
  /** Le pseudo tel que le serveur le relira dans l'adresse. */
  function pseudoRelu(adresse: string): string | null {
    const url = new URL(adresse, 'https://jeu.example');

    expect(url.pathname).toBe(ROUTES_COMPTES.joueur);

    return url.searchParams.get(PARAMETRE_PSEUDO);
  }

  it('porte le pseudo en parametre, sur la route de la fiche', () => {
    expect(adresseDeLaFiche('Alice')).toBe(`${ROUTES_COMPTES.joueur}?pseudo=Alice`);
  });

  it('rend relisible un pseudo avec espace, accent, point ou signe de requete', () => {
    for (const pseudo of ['Léa B.', 'a&b=c', 'x+y', '#1', '?']) {
      expect(pseudoRelu(adresseDeLaFiche(pseudo))).toBe(pseudo);
    }
  });

  it('ne laisse pas un pseudo en points sortir de la route', () => {
    for (const pseudo of ['.', '..', '../profil']) {
      expect(pseudoRelu(adresseDeLaFiche(pseudo))).toBe(pseudo);
    }
  });
});

describe('validerDemandeDeGeste (etape 3.6)', () => {
  it('accepte chacun des sept gestes, et normalise le pseudo', () => {
    expect(GESTES_D_AMITIE).toHaveLength(7);

    for (const geste of GESTES_D_AMITIE) {
      expect(valeurAcceptee(validerDemandeDeGeste({ geste, pseudo: '  Léa B.  ' }))).toEqual({
        geste,
        pseudo: 'Léa B.',
      });
    }
  });

  it('refuse un geste inconnu, absent ou qui n est pas du texte', () => {
    for (const geste of ['supprimer', 'Demander', '', undefined, 3, ['demander']]) {
      const verdict = validerDemandeDeGeste({ geste, pseudo: 'Bob' });

      expect(verdict.valide).toBe(false);
      expect(verdict.valide ? [] : verdict.erreurs.map((erreur) => erreur.champ)).toEqual([
        'geste',
      ]);
    }
  });

  it('refuse un pseudo mal forme avec le motif du pseudo', () => {
    for (const pseudo of ['', '   ', 'x'.repeat(40), 12, undefined]) {
      const verdict = validerDemandeDeGeste({ geste: 'demander', pseudo });

      expect(verdict.valide ? [] : verdict.erreurs.map((erreur) => erreur.champ)).toEqual([
        'pseudo',
      ]);
    }
  });

  it('refuse ce qui n est pas un objet', () => {
    for (const brut of [null, 'demander', 3, undefined]) {
      expect(validerDemandeDeGeste(brut).valide).toBe(false);
    }
  });

  it('ne lit rien d autre que le geste et le pseudo', () => {
    expect(
      valeurAcceptee(validerDemandeDeGeste({ geste: 'bloquer', pseudo: 'Bob', compte: 'x' })),
    ).toEqual({ geste: 'bloquer', pseudo: 'Bob' });
  });
});
