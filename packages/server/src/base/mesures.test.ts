/**
 * Tests du texte du releve de retention (etape 3.7). Les requetes, elles, sont verifiees
 * contre une vraie base (tests/base/mesures.test.ts).
 */

import { describe, expect, it } from 'vitest';

import type { ReleveDeRetention, Repartition } from './mesures.js';
import { rapportDeRetention } from './mesures.js';

const REPARTITION: Repartition = { moyenne: 1.25, mediane: 1, neuvieme: 3, maximum: 9 };

/** Un releve ordinaire. */
const RELEVE: ReleveDeRetention = {
  comptesActifsParSemaine: [
    { semaine: '2026-09-14', comptes: 12 },
    { semaine: '2026-09-21', comptes: 9 },
  ],
  cohortes: [
    { semaine: '2026-09-07', comptes: 4, revenus: 1 },
    { semaine: '2026-09-14', comptes: 6, revenus: 3 },
  ],
  calibration: {
    resultats: 340,
    prisesParPartie: REPARTITION,
    blackNinjasParPartie: REPARTITION,
    victoiresParCompte: REPARTITION,
    partiesParCompteEtParSemaine: REPARTITION,
  },
};

describe('rapportDeRetention', () => {
  it('ecrit les semaines actives, les retours par cohorte et leur ensemble, puis la calibration', () => {
    const rapport = rapportDeRetention(RELEVE, '2026-09-26');

    expect(rapport).toContain('Releve du 2026-09-26');
    expect(rapport).toContain('  2026-09-14: 12');
    expect(rapport).toContain('  2026-09-07: 1 sur 4 (25 %)');
    expect(rapport).toContain('  ensemble: 4 sur 10 (40 %)');
    expect(rapport).toContain('Calibration des seuils, sur 340 resultats');
    expect(rapport).toContain(
      '  Prises par partie: moyenne 1,3, mediane 1, 9 sur 10 sous 3, maximum 9',
    );
  });

  it('dit ce qui manque, sans diviser par zero', () => {
    const rapport = rapportDeRetention(
      { ...RELEVE, comptesActifsParSemaine: [], cohortes: [] },
      '2026-09-26',
    );

    expect(rapport).toContain('  aucune partie enregistree');
    expect(rapport).toContain('  aucune cohorte assez ancienne');
    expect(rapport).toContain('  ensemble: 0 sur 0 (-)');
  });
});
