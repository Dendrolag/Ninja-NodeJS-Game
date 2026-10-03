/**
 * Tests des defis de la semaine (etape 3.10): la semaine d'un jour, le tirage des trois
 * defis et sa variete, l'avancee de chaque genre de defi.
 *
 * Les seuils et les recompenses sont ecrits en toutes lettres: ce sont ceux de la fiche
 * de l'etape. Si l'un change, ces tests doivent le signaler.
 */

import { describe, expect, it } from 'vitest';

import type { IdentifiantDefi } from './defis.js';
import {
  DEFIS,
  DUREE_MINIMUM_POUR_LES_DEFIS_S,
  FAMILLES_DE_DEFIS,
  XP_DES_FAMILLES,
  avanceeDuDefi,
  avancementsDeLaSemaine,
  compteePourLesDefis,
  defisDeLaSemaine,
  definitionDuDefi,
  estUnDefi,
  semaineDuJour,
  semaineSuivante,
} from './defis.js';
import type { PartieDuParcours } from './succes.js';

/** Une partie de Horde a deux, finie et perdue, de trois minutes, le lundi 5 octobre 2026. */
function partie(surcharge: Partial<PartieDuParcours> = {}): PartieDuParcours {
  return {
    mode: 'classique',
    carte: 'map1',
    modeMiroir: false,
    nombreJoueurs: 2,
    dureeS: 180,
    placement: 2,
    captures: 0,
    botsNoirsDetruits: 0,
    xpGagnee: 30,
    variationPointsLigue: 0,
    jour: '2026-10-05',
    amis: [],
    ...surcharge,
  };
}

/** L'avancee d'un defi sur ces parties. */
function avancee(id: IdentifiantDefi, parties: readonly PartieDuParcours[]): number {
  return avanceeDuDefi(definitionDuDefi(id), parties);
}

/** La semaine de rang n apres le lundi 5 octobre 2026. */
function semaineDeRang(n: number): string {
  let semaine = '2026-10-05';

  for (let i = 0; i < n; i += 1) {
    semaine = semaineSuivante(semaine);
  }

  return semaine;
}

describe('les definitions', () => {
  it('ont des identifiants uniques, en minuscules et tirets', () => {
    const ids = DEFIS.map((defi) => defi.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(id.length).toBeLessThanOrEqual(40);
      expect(estUnDefi(id)).toBe(true);
    }
    expect(estUnDefi('defi-retire')).toBe(false);
  });

  it('donnent au moins trois defis a chaque famille, pour que la regle des cycles tienne', () => {
    for (const famille of FAMILLES_DE_DEFIS) {
      expect(DEFIS.filter((defi) => defi.famille === famille).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('rapportent 300, 400 et 500 XP selon la famille', () => {
    expect(XP_DES_FAMILLES).toEqual({ assiduite: 300, action: 400, exploit: 500 });
  });

  it('refusent un identifiant inconnu', () => {
    expect(() => definitionDuDefi('inconnu' as IdentifiantDefi)).toThrow();
  });
});

describe('la semaine', () => {
  it('est celle du lundi, du lundi au dimanche', () => {
    expect(semaineDuJour('2026-10-05')).toBe('2026-10-05');
    expect(semaineDuJour('2026-10-07')).toBe('2026-10-05');
    expect(semaineDuJour('2026-10-11')).toBe('2026-10-05');
    expect(semaineDuJour('2026-10-12')).toBe('2026-10-12');
  });

  it("passe d'un mois et d'une annee a l'autre", () => {
    expect(semaineDuJour('2026-11-01')).toBe('2026-10-26');
    expect(semaineDuJour('2027-01-01')).toBe('2026-12-28');
    expect(semaineSuivante('2026-12-28')).toBe('2027-01-04');
    expect(semaineSuivante('2026-10-07')).toBe('2026-10-12');
  });

  it('refuse un jour mal ecrit ou qui n’existe pas', () => {
    expect(() => semaineDuJour('5 octobre')).toThrow();
    expect(() => semaineDuJour('2026-02-31')).toThrow();
  });
});

describe('le tirage', () => {
  it('donne trois defis, un par famille, dans leur ordre', () => {
    const defis = defisDeLaSemaine('2026-10-05');

    expect(defis.map((id) => definitionDuDefi(id).famille)).toEqual([...FAMILLES_DE_DEFIS]);
  });

  it('donne les memes a toute la semaine, et ne depend que d’elle', () => {
    expect(defisDeLaSemaine('2026-10-11')).toEqual(defisDeLaSemaine('2026-10-05'));
  });

  it('ne repete jamais un defi deux semaines de suite, sur cinq cents semaines', () => {
    let precedents = defisDeLaSemaine('2026-09-28');
    let semaine = '2026-10-05';

    for (let i = 0; i < 500; i += 1) {
      const defis = defisDeLaSemaine(semaine);

      for (const id of defis) {
        expect(precedents).not.toContain(id);
      }
      precedents = defis;
      semaine = semaineSuivante(semaine);
    }
  });

  it('fait passer chaque defi de sa famille avant de le reprendre', () => {
    for (const [index, famille] of FAMILLES_DE_DEFIS.entries()) {
      const taille = DEFIS.filter((defi) => defi.famille === famille).length;
      // Le rang de la semaine du 1er janvier 2024 est zero: un cycle commence a chaque
      // multiple de la taille. La semaine du 5 octobre 2026 est de rang 144.
      const debut = Math.ceil(144 / taille) * taille - 144;
      const vus = new Set<string>();

      for (let n = debut; n < debut + taille; n += 1) {
        vus.add(defisDeLaSemaine(semaineDeRang(n))[index] ?? '');
      }

      expect(vus.size).toBe(taille);
    }
  });

  it('tire aussi les semaines d’avant le lundi de reference', () => {
    expect(defisDeLaSemaine('2023-12-25')).toHaveLength(3);
  });
});

describe('les parties qui comptent', () => {
  it('sont finies et durent trois minutes au moins', () => {
    expect(DUREE_MINIMUM_POUR_LES_DEFIS_S).toBe(180);
    expect(compteePourLesDefis(partie())).toBe(true);
    // Un abandon ne rapporte aucune XP.
    expect(compteePourLesDefis(partie({ xpGagnee: 0 }))).toBe(false);
    expect(compteePourLesDefis(partie({ dureeS: 179 }))).toBe(false);
  });

  it('sont seules a avancer un defi', () => {
    expect(
      avancee('jouer-dix-parties', [partie(), partie({ xpGagnee: 0 }), partie({ dureeS: 60 })]),
    ).toBe(1);
  });
});

describe("l'avancee", () => {
  it('fait la somme des parties', () => {
    expect(avancee('jouer-dix-parties', [partie(), partie(), partie({ nombreJoueurs: 1 })])).toBe(
      3,
    );
    expect(avancee('jouer-chasse', [partie({ mode: 'chasse' }), partie()])).toBe(1);
    expect(avancee('parties-en-miroir', [partie({ modeMiroir: true }), partie()])).toBe(1);
    expect(
      avancee('parties-entre-amis', [partie({ amis: [{ compte: 'b', placement: 1 }] }), partie()]),
    ).toBe(1);
    expect(avancee('prendre-joueurs', [partie({ captures: 4 }), partie({ captures: 3 })])).toBe(7);
    expect(avancee('black-ninjas', [partie({ botsNoirsDetruits: 2, nombreJoueurs: 1 })])).toBe(2);
  });

  it('compte les cartes et les modes differents', () => {
    const parties = [
      partie(),
      partie({ carte: 'map3' }),
      partie({ carte: 'map3', mode: 'chasse' }),
    ];

    expect(avancee('trois-cartes', parties)).toBe(2);
    expect(avancee('trois-modes', parties)).toBe(2);
  });

  it('ne compte les faits de partie qu’a plusieurs', () => {
    expect(
      avancee('bonus', [
        partie({ faits: { bonusRamasses: 6 } }),
        partie({ faits: { bonusRamasses: 4 } }),
      ]),
    ).toBe(10);
    expect(avancee('bonus', [partie({ nombreJoueurs: 1, faits: { bonusRamasses: 6 } })])).toBe(0);
    expect(avancee('rallier', [partie({ faits: { ninjasRallies: 120 } })])).toBe(120);
    expect(avancee('evades', [partie()])).toBe(0);
  });

  it('garde la meilleure partie pour un record', () => {
    const parties = [
      partie({ faits: { meilleurMultiplicateur: 3 } }),
      partie({ faits: { meilleurMultiplicateur: 5 } }),
      partie({ faits: { meilleurMultiplicateur: 4 } }),
    ];

    expect(avancee('multiplicateur', parties)).toBe(5);
    expect(avancee('razzia', [partie({ nombreJoueurs: 1, faits: { meilleureRazzia: 30 } })])).toBe(
      0,
    );
  });

  it('compte les victoires et les podiums a plusieurs seulement', () => {
    expect(
      avancee('victoires', [partie({ placement: 1 }), partie({ placement: 1, nombreJoueurs: 1 })]),
    ).toBe(1);
    expect(
      avancee('gagner-massacre', [
        partie({ placement: 1, mode: 'massacre' }),
        partie({ placement: 1 }),
      ]),
    ).toBe(1);
    expect(
      avancee('podiums', [
        partie({ nombreJoueurs: 4, placement: 3 }),
        partie({ nombreJoueurs: 3, placement: 1 }),
      ]),
    ).toBe(1);
  });

  it('ne compte que les gains de points de ligue', () => {
    expect(
      avancee('points-de-ligue', [
        partie({ variationPointsLigue: 20 }),
        partie({ variationPointsLigue: -10 }),
      ]),
    ).toBe(20);
  });
});

describe('les avancements de la semaine', () => {
  it('plafonnent au seuil, et prennent la recompense de la famille', () => {
    const semaine = '2026-10-05';
    const parties = Array.from({ length: 30 }, () =>
      partie({ placement: 1, captures: 5, botsNoirsDetruits: 5, modeMiroir: true }),
    );
    const avancements = avancementsDeLaSemaine(semaine, parties, new Map());

    expect(avancements.map((a) => a.id)).toEqual(defisDeLaSemaine(semaine));
    for (const avancement of avancements) {
      const defi = definitionDuDefi(avancement.id);

      expect(avancement.actuel).toBeLessThanOrEqual(defi.seuil);
      expect(avancement.seuil).toBe(defi.seuil);
      expect(avancement.xp).toBe(XP_DES_FAMILLES[defi.famille]);
      expect(avancement.accompli).toBe(false);
    }
  });

  it("disent releve un defi inscrit, avec l'XP versee, quoi que dise le pli", () => {
    const semaine = '2026-10-05';
    const [premier] = defisDeLaSemaine(semaine);
    const avancements = avancementsDeLaSemaine(semaine, [], new Map([[premier ?? '', 250]]));

    expect(avancements[0]).toMatchObject({ id: premier, accompli: true, xp: 250 });
    expect(avancements[0]?.actuel).toBe(avancements[0]?.seuil);
  });
});
