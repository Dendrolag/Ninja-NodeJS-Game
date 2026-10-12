/**
 * Tests de la verification horaire de la production (etape 5.15): un commit qui touche le
 * jeu ne doit pas attendre plus d'une heure de partir en ligne; un commit de documentation
 * peut attendre toujours; le secours doit etre a la version de la production.
 */

import { describe, expect, it } from 'vitest';

import type { EtatDeLaProduction } from './productionAJour.ts';
import {
  DELAI_DE_MISE_EN_LIGNE_MS,
  lireLeJournalGit,
  problemesDeLaProduction,
} from './productionAJour.ts';

const EN_LIGNE = 'a'.repeat(40);
const TETE = 'c'.repeat(40);
const MAINTENANT = Date.UTC(2026, 9, 12, 12);

/** La production a jour: la tete est en ligne. */
const A_JOUR: EtatDeLaProduction = {
  production: 'oracle',
  versionEnLigne: TETE,
  tete: TETE,
  enAttente: [],
  dateDeLaTeteMs: MAINTENANT - 3 * DELAI_DE_MISE_EN_LIGNE_MS,
  maintenantMs: MAINTENANT,
};

describe('la production a jour', () => {
  it('ne signale rien quand la tete de master est en ligne', () => {
    expect(problemesDeLaProduction(A_JOUR)).toEqual([]);
  });

  it('ne signale rien quand seule la documentation attend, depuis longtemps', () => {
    expect(
      problemesDeLaProduction({
        ...A_JOUR,
        versionEnLigne: EN_LIGNE,
        enAttente: [
          {
            commit: TETE,
            dateMs: MAINTENANT - 5 * DELAI_DE_MISE_EN_LIGNE_MS,
            fichiers: ['docs/plan/ROADMAP.md', 'tests/e2e/a.spec.ts'],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('laisse une heure a la mise en ligne d un commit qui touche le jeu', () => {
    const etat = {
      ...A_JOUR,
      versionEnLigne: EN_LIGNE,
      enAttente: [
        {
          commit: TETE,
          dateMs: MAINTENANT - DELAI_DE_MISE_EN_LIGNE_MS + 1000,
          fichiers: ['packages/sim/src/moteur.ts'],
        },
      ],
    };

    expect(problemesDeLaProduction(etat)).toEqual([]);
    expect(problemesDeLaProduction({ ...etat, maintenantMs: MAINTENANT + 2000 })).toEqual([
      `la production (oracle) sert ${EN_LIGNE}, et le commit ${TETE}, qui touche le jeu, attend depuis plus d'une heure de partir en ligne.`,
    ]);
  });

  it('juge sur le plus ancien commit qui touche le jeu, pas sur la tete', () => {
    const ancien = 'b'.repeat(40);

    expect(
      problemesDeLaProduction({
        ...A_JOUR,
        versionEnLigne: EN_LIGNE,
        enAttente: [
          {
            commit: ancien,
            dateMs: MAINTENANT - 2 * DELAI_DE_MISE_EN_LIGNE_MS,
            fichiers: ['packages/server/src/serveur.ts'],
          },
          { commit: TETE, dateMs: MAINTENANT - 60_000, fichiers: ['docs/deploiement.md'] },
        ],
      })[0],
    ).toContain(ancien);
  });

  it('juge sur la tete quand l historique manque', () => {
    const sansHistorique = { ...A_JOUR, versionEnLigne: EN_LIGNE, enAttente: undefined };

    expect(problemesDeLaProduction(sansHistorique)[0]).toContain(`la tete de master ${TETE}`);
    expect(
      problemesDeLaProduction({ ...sansHistorique, dateDeLaTeteMs: MAINTENANT - 60_000 }),
    ).toEqual([]);
  });

  it('signale une page qui ne joint aucun serveur, et un serveur qui ne dit pas sa version', () => {
    expect(problemesDeLaProduction({ ...A_JOUR, production: undefined })[0]).toMatch(
      /ne joint aucun/u,
    );
    expect(problemesDeLaProduction({ ...A_JOUR, versionEnLigne: undefined })[0]).toMatch(
      /ne dit pas sa version/u,
    );
  });

  it('verifie le secours quand on l a lu', () => {
    expect(problemesDeLaProduction({ ...A_JOUR, secours: { version: TETE } })).toEqual([]);
    expect(problemesDeLaProduction({ ...A_JOUR, secours: { version: EN_LIGNE } })).toEqual([
      `le secours (render) sert ${EN_LIGNE}, la production ${TETE}: une bascule refuserait.`,
    ]);
    expect(problemesDeLaProduction({ ...A_JOUR, secours: { version: undefined } })).toEqual([
      'le secours (render) ne dit pas sa version.',
    ]);
  });
});

describe('le journal de git', () => {
  it('se lit commit par commit, du plus ancien au plus recent', () => {
    const sortie = [
      `@${TETE} 1760000100`,
      '',
      'docs/a.md',
      'packages/sim/src/b.ts',
      '',
      `@${EN_LIGNE} 1760000000`,
      '',
      'tests/c.test.ts',
      '',
    ].join('\n');

    expect(lireLeJournalGit(sortie)).toEqual([
      { commit: EN_LIGNE, dateMs: 1_760_000_000_000, fichiers: ['tests/c.test.ts'] },
      { commit: TETE, dateMs: 1_760_000_100_000, fichiers: ['docs/a.md', 'packages/sim/src/b.ts'] },
    ]);
  });
});
