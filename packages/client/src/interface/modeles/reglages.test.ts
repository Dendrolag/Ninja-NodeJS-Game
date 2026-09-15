/**
 * Tests du formulaire des reglages.
 *
 * LE TEST EXIGE PAR LA FICHE 4.3: une configuration invalide est signalee cote
 * client, de facon coherente avec le refus du serveur. La coherence est ici
 * verifiee champ par champ sur les bornes; le va-et-vient avec un vrai serveur est
 * dans tests/client/integration/reglages-serveur.test.ts.
 */

import { REGLAGES_PAR_DEFAUT, completerReglages, validerReglages } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import {
  erreursParChamp,
  reglagesDepuisValeurs,
  tousLesChamps,
  valeursDepuisReglages,
  verifierLesValeurs,
} from './reglages.js';

/** Les chemins de toutes les valeurs d'un objet de reglages, a plat. */
function feuilles(objet: object, prefixe = ''): string[] {
  return Object.entries(objet).flatMap(([cle, valeur]) => {
    const chemin = prefixe === '' ? cle : `${prefixe}.${cle}`;

    return typeof valeur === 'object' && valeur !== null
      ? feuilles(valeur as object, chemin)
      : [chemin];
  });
}

/** Les valeurs par defaut, avec un champ change. */
function valeursAvec(chemin: string, valeur: string | boolean): Record<string, string | boolean> {
  return { ...valeursDepuisReglages(REGLAGES_PAR_DEFAUT), [chemin]: valeur };
}

describe('la description du formulaire', () => {
  it('donne un champ, et un seul, a chaque reglage de la partie', () => {
    const chemins = tousLesChamps().map((champ) => champ.chemin);

    expect([...chemins].sort()).toEqual(feuilles(REGLAGES_PAR_DEFAUT).sort());
    expect(new Set(chemins).size).toBe(chemins.length);
  });

  it('retrouve exactement les reglages dont il est parti', () => {
    const valeurs = valeursDepuisReglages(REGLAGES_PAR_DEFAUT);

    expect(completerReglages(reglagesDepuisValeurs(valeurs))).toEqual(REGLAGES_PAR_DEFAUT);
    expect(verifierLesValeurs(valeurs)).toEqual({ valide: true, valeur: REGLAGES_PAR_DEFAUT });
  });

  it('annonce pour chaque nombre les bornes que le serveur applique', () => {
    for (const champ of tousLesChamps()) {
      if (champ.nature !== 'entier') {
        continue;
      }

      const motifsA = (valeur: number): string[] =>
        (() => {
          const verdict = validerReglages(
            reglagesDepuisValeurs({ [champ.chemin]: String(valeur) }),
          );

          return verdict.valide
            ? []
            : verdict.erreurs.filter((erreur) => erreur.champ === champ.chemin).map((e) => e.motif);
        })();

      const horsBornes = (valeur: number): boolean =>
        motifsA(valeur).some((motif) => motif.includes('se trouver entre'));

      // Juste au-dela des bornes affichees, le serveur refuse pour cette raison;
      // sur les bornes elles-memes, jamais.
      expect(horsBornes(champ.bornes.minimum - 1), champ.chemin).toBe(true);
      expect(horsBornes(champ.bornes.maximum + 1), champ.chemin).toBe(true);
      expect(horsBornes(champ.bornes.minimum), champ.chemin).toBe(false);
      expect(horsBornes(champ.bornes.maximum), champ.chemin).toBe(false);
    }
  });
});

describe('verifierLesValeurs', () => {
  it('signale une duree hors bornes sur son propre champ', () => {
    const verdict = verifierLesValeurs(valeursAvec('dureePartieS', '700'));

    expect(verdict.valide).toBe(false);
    expect(verdict.valide ? undefined : erreursParChamp(verdict.erreurs).get('dureePartieS')).toBe(
      'Ce réglage doit se trouver entre 30 et 600, bornes comprises.',
    );
  });

  it('refuse un champ vide plutot que de garder l ancienne valeur', () => {
    const verdict = verifierLesValeurs(valeursAvec('bonus.types.vitesse.dureeS', ''));

    expect(verdict.valide ? [] : verdict.erreurs.map((erreur) => erreur.champ)).toEqual([
      'bonus.types.vitesse.dureeS',
    ]);
  });

  it('refuse un nombre a virgule plutot que de l arrondir', () => {
    const verdict = verifierLesValeurs(valeursAvec('nombreBotsInitial', '12.5'));

    expect(verdict.valide ? undefined : verdict.erreurs[0]?.motif).toBe(
      'Ce réglage doit être un nombre entier.',
    );
  });

  it('refuse une duree minimale de zone plus longue que la maximale', () => {
    const verdict = verifierLesValeurs(valeursAvec('zones.dureeMinimumS', '40'));

    expect(verdict.valide ? [] : verdict.erreurs.map((erreur) => erreur.champ)).toEqual([
      'zones.dureeMinimumS',
    ]);
  });
});

describe('erreursParChamp', () => {
  it('joint les motifs d un meme champ', () => {
    const parChamp = erreursParChamp([
      { champ: 'carte', motif: 'Un.' },
      { champ: 'carte', motif: 'Deux.' },
      { champ: 'dureePartieS', motif: 'Trois.' },
    ]);

    expect(parChamp.get('carte')).toBe('Un. Deux.');
    expect(parChamp.get('dureePartieS')).toBe('Trois.');
  });
});
