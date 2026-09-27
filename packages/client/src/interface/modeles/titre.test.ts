/**
 * Tests du modele du titre (etape 3.9).
 *
 * Ce qu'ils protegent: un titre s'affiche sous le nom de son succes, a la couleur de son
 * palier, et un identifiant inconnu n'affiche rien; la liste du profil ne propose que les
 * succes obtenus, groupes par palier, et selectionne le titre porte.
 */

import type { ProfilDuCompte } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { profilDEssai } from '../../comptes/api.js';
import { AUCUN_CHOIX_DE_TITRE } from '../../etat.js';
import { SANS_TITRE, choixDuTitreAffiche, titreAffiche } from './titre.js';

/** Un profil qui a obtenu ces succes. */
function profilAvec(obtenus: readonly string[], titre?: ProfilDuCompte['titre']): ProfilDuCompte {
  const profil = profilDEssai('Alice');

  return {
    ...profil,
    succes: profil.succes.map((succes) =>
      obtenus.includes(succes.id) ? { ...succes, debloqueLe: '2026-09-20T10:00:00.000Z' } : succes,
    ),
    ...(titre === undefined ? {} : { titre }),
  };
}

describe('titreAffiche', () => {
  it('donne le nom et le palier du succes', () => {
    expect(titreAffiche('premier-pas')).toEqual({ nom: 'Premier pas', palier: 'decouverte' });
    expect(titreAffiche('centurion')).toEqual({ nom: 'Centurion', palier: 'legende' });
  });

  it('n affiche rien sans titre, ni pour un succes que la page ne connait pas', () => {
    expect(titreAffiche(undefined)).toBeUndefined();
    expect(titreAffiche('succes-retire')).toBeUndefined();
  });
});

describe('choixDuTitreAffiche', () => {
  it('ne propose que les succes obtenus, palier par palier, du plus facile au plus rare', () => {
    const choix = choixDuTitreAffiche(
      profilAvec(['centurion', 'premier-pas', 'premiere-prise', 'habitue']),
      AUCUN_CHOIX_DE_TITRE,
    );

    expect(choix.groupes).toEqual([
      {
        palier: 'decouverte',
        nom: 'Découverte',
        titres: [
          { id: 'premier-pas', nom: 'Premier pas' },
          { id: 'premiere-prise', nom: 'Première prise' },
        ],
      },
      { palier: 'habitue', nom: 'Habitué', titres: [{ id: 'habitue', nom: 'Habitué' }] },
      { palier: 'legende', nom: 'Légende', titres: [{ id: 'centurion', nom: 'Centurion' }] },
    ]);
  });

  it('selectionne le titre porte, ou aucun', () => {
    expect(
      choixDuTitreAffiche(profilAvec(['premier-pas'], 'premier-pas'), AUCUN_CHOIX_DE_TITRE).valeur,
    ).toBe('premier-pas');
    expect(choixDuTitreAffiche(profilAvec(['premier-pas']), AUCUN_CHOIX_DE_TITRE).valeur).toBe(
      SANS_TITRE,
    );
  });

  it('ne propose rien sans succes obtenu', () => {
    expect(choixDuTitreAffiche(profilAvec([]), AUCUN_CHOIX_DE_TITRE).groupes).toEqual([]);
  });

  it('dit l attente et le refus du dernier choix', () => {
    const profil = profilAvec(['premier-pas'], 'premier-pas');

    expect(choixDuTitreAffiche(profil, { statut: 'enCours' })).toMatchObject({
      enCours: true,
      erreur: undefined,
    });
    expect(
      choixDuTitreAffiche(profil, {
        statut: 'refuse',
        motif: 'Ce succès n’est pas encore obtenu.',
      }),
    ).toMatchObject({ enCours: false, erreur: 'Ce succès n’est pas encore obtenu.' });
  });
});
