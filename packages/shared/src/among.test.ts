/**
 * Tests du contrat du mode Among Ninjas (etape 7.20): ses valeurs, ses lieux, ses couleurs,
 * ses taches courtes (etape 7.21), ses sabotages (etape 7.22), ses reglages, leur validation et
 * ce que le mode impose.
 */

import { describe, expect, it } from 'vitest';

import {
  AMONG,
  BARRES_DES_TACHES,
  CARTE_DU_MODE_AMONG,
  COULEURS_NOMMEES,
  COULEUR_DE_LA_FOULE,
  DUREES_MINIMALES_DES_TACHES_MS,
  LIEUX_DES_CARTES,
  NATURES_DE_SABOTAGE,
  NATURES_DE_TACHE,
  NUISANCES,
  RAYONS_DE_VISION,
  TACHES_VISUELLES,
  estUneNuisance,
  lieuxDuMode,
  nomDeCouleur,
  tueursMaximum,
} from './among.js';
import { BORNES_REGLAGES } from './bornes.js';
import { CAPACITES, CARTES, COULEURS_JOUEURS, TYPES_MALUS, luminance } from './constantes.js';
import { AMONG_PAR_DEFAUT, completerReglages, imposerLesReglagesDuMode } from './reglages.js';
import {
  validerDemandeMalediction,
  validerDemandeSabotage,
  validerReglages,
} from './validation.js';

describe('les valeurs du mode', () => {
  it('accueille douze joueurs, et en demande cinq', () => {
    expect(CAPACITES.among).toBe(12);
    expect(AMONG.JOUEURS_MINIMUM).toBe(5);
  });

  it('borne les tueurs au nombre de joueurs: un, puis deux des sept, trois des neuf', () => {
    expect([5, 6, 7, 8, 9, 12].map(tueursMaximum)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('voit moins loin en proie qu en tueur, a chaque palier', () => {
    for (const palier of ['reduite', 'normale', 'large'] as const) {
      expect(RAYONS_DE_VISION.proie[palier]).toBeLessThan(RAYONS_DE_VISION.tueur[palier]);
    }
    expect(RAYONS_DE_VISION.tueur.normale).toBe(320);
    expect(RAYONS_DE_VISION.proie.normale).toBe(260);
  });
});

describe('les couleurs', () => {
  it('nomme douze couleurs distinctes, aucune grise comme la foule', () => {
    const couleurs = COULEURS_NOMMEES.map((nommee) => nommee.couleur.toUpperCase());

    expect(new Set(couleurs).size).toBe(12);
    expect(new Set(COULEURS_NOMMEES.map((nommee) => nommee.nom)).size).toBe(12);
    expect(couleurs).not.toContain(COULEUR_DE_LA_FOULE.toUpperCase());
  });

  it('retrouve le nom d une couleur, sans tenir compte de la casse', () => {
    expect(nomDeCouleur('#ff8c1a')).toBe('Orange');
    expect(nomDeCouleur(COULEURS_JOUEURS[0])).toBeUndefined();
  });

  it('garde des couleurs assez claires pour se voir la nuit sur Tokyo', () => {
    for (const { couleur } of COULEURS_NOMMEES) {
      expect(luminance(couleur)).toBeGreaterThanOrEqual(0.18);
    }
  });
});

describe('les lieux', () => {
  it('donne a Tokyo son gong et treize stations dans la carte', () => {
    const lieux = lieuxDuMode('map1', false);

    expect(lieux).toBe(LIEUX_DES_CARTES.map1);
    expect(lieux?.stations).toHaveLength(13);
    for (const place of [
      lieux?.gong,
      ...(lieux?.stations ?? []),
      lieux?.boitier,
      ...(lieux?.consoles ?? []),
    ]) {
      expect(place?.x).toBeGreaterThan(0);
      expect(place?.x).toBeLessThan(CARTES.map1.largeur);
      expect(place?.y).toBeGreaterThan(0);
      expect(place?.y).toBeLessThan(CARTES.map1.hauteur);
    }
  });

  it('retourne les lieux avec la carte en miroir', () => {
    const normal = lieuxDuMode('map1', false);
    const miroir = lieuxDuMode('map1', true);

    expect(miroir?.gong).toEqual({
      x: CARTES.map1.largeur - (normal?.gong.x ?? 0),
      y: normal?.gong.y,
    });
    expect(miroir?.stations[0]).toEqual({
      ...normal?.stations[0],
      x: CARTES.map1.largeur - (normal?.stations[0]?.x ?? 0),
    });
    // Les postes des sabotages (etape 7.22).
    expect(miroir?.boitier).toEqual({
      x: CARTES.map1.largeur - (normal?.boitier.x ?? 0),
      y: normal?.boitier.y,
    });
    expect(miroir?.consoles[1]).toEqual({
      x: CARTES.map1.largeur - (normal?.consoles[1].x ?? 0),
      y: normal?.consoles[1].y,
    });
  });

  it('dit les sabotages, dont trois nuisances qui sont les malus du jeu', () => {
    expect(NATURES_DE_SABOTAGE).toEqual([
      'flou',
      'negatif',
      'controlesInverses',
      'nuage',
      'panne',
      'surchauffe',
    ]);
    expect(NATURES_DE_SABOTAGE.filter(estUneNuisance)).toEqual([...NUISANCES]);
    expect([...NUISANCES].sort()).toEqual([...TYPES_MALUS].sort());
  });

  it('nomme chaque station, et lui donne au moins une tache, sans doublon', () => {
    const stations = LIEUX_DES_CARTES.map1?.stations ?? [];

    expect(new Set(stations.map((station) => station.nom)).size).toBe(stations.length);
    for (const station of stations) {
      expect(station.nom.length).toBeGreaterThan(0);
      expect(station.natures.length).toBeGreaterThan(0);
      expect(new Set(station.natures).size).toBe(station.natures.length);
    }
  });

  it('fait faire chacune des sept taches courtes a une station au moins', () => {
    const faites = new Set(LIEUX_DES_CARTES.map1?.stations.flatMap((station) => station.natures));

    expect([...faites].sort()).toEqual([...NATURES_DE_TACHE].sort());
  });

  it('n en donne pas aux autres cartes', () => {
    expect(lieuxDuMode('quartier', false)).toBeUndefined();
  });
});

describe('les reglages imposes', () => {
  it('imposent Tokyo, la foule, et retirent tout ce qui frappe au hasard', () => {
    const reglages = imposerLesReglagesDuMode(
      'among',
      completerReglages({ carte: 'quartier', nombreBotsInitial: 200 }),
    );

    expect(reglages.carte).toBe(CARTE_DU_MODE_AMONG);
    expect(reglages.nombreBotsInitial).toBe(AMONG_PAR_DEFAUT.foule);
    expect(reglages.evade).toBe(false);
    expect(reglages.botsNoirs.actifs).toBe(false);
    expect(reglages.malus.actifs).toBe(false);
    expect(reglages.zones.actives).toBe(false);
    expect(Object.values(reglages.bonus.types).every((bonus) => !bonus.actif)).toBe(true);
    expect(Object.values(reglages.objetsDePoche).every((objet) => !objet.actif)).toBe(true);
    expect(reglages.objetsTactiques).toBeUndefined();
    expect(reglages.among).toEqual(AMONG_PAR_DEFAUT);
  });

  it('gardent les reglages du mode choisis par l hote, et le miroir', () => {
    const reglages = imposerLesReglagesDuMode(
      'among',
      completerReglages({ modeMiroir: true, among: { foule: 0, votesAnonymes: true } }),
    );

    expect(reglages.modeMiroir).toBe(true);
    expect(reglages.nombreBotsInitial).toBe(0);
    expect(reglages.among?.votesAnonymes).toBe(true);
  });
});

describe('les taches courtes', () => {
  it('demandent de trois a trois secondes et demie au moins, chacune', () => {
    for (const nature of NATURES_DE_TACHE) {
      expect(DUREES_MINIMALES_DES_TACHES_MS[nature]).toBeGreaterThanOrEqual(3000);
      expect(DUREES_MINIMALES_DES_TACHES_MS[nature]).toBeLessThanOrEqual(3500);
    }
  });

  it('ne rendent visibles que le katana et la fumee', () => {
    expect([...TACHES_VISUELLES].sort()).toEqual(['fumee', 'katana']);
  });

  it('montrent les taches visuelles et la barre a jour par defaut', () => {
    expect(AMONG_PAR_DEFAUT.tachesVisuelles).toBe(true);
    expect(AMONG_PAR_DEFAUT.barreDesTaches).toBe('toujours');
    expect(BARRES_DES_TACHES).toEqual(['toujours', 'reunions', 'jamais']);
  });
});

describe('la validation des sabotages et des maledictions (etape 7.22)', () => {
  it('accepte un sabotage connu, et le nuage avec sa station', () => {
    expect(validerDemandeSabotage({ nature: 'panne' })).toEqual({
      valide: true,
      valeur: { nature: 'panne' },
    });
    // Une station sans objet hors du nuage est oubliee.
    expect(validerDemandeSabotage({ nature: 'flou', station: 3 })).toEqual({
      valide: true,
      valeur: { nature: 'flou' },
    });
    expect(validerDemandeSabotage({ nature: 'nuage', station: 3 })).toEqual({
      valide: true,
      valeur: { nature: 'nuage', station: 3 },
    });
  });

  it('refuse un sabotage mal forme', () => {
    for (const brut of [
      null,
      'panne',
      { nature: 'grele' },
      { nature: 'nuage' },
      { nature: 'nuage', station: -1 },
      { nature: 'nuage', station: 1.5 },
      { nature: 'nuage', station: 64 },
      { nature: 'nuage', station: '2' },
    ]) {
      expect(validerDemandeSabotage(brut).valide, JSON.stringify(brut)).toBe(false);
    }
  });

  it('n accepte comme malediction que les trois nuisances', () => {
    for (const nature of NUISANCES) {
      expect(validerDemandeMalediction(nature)).toEqual({ valide: true, valeur: nature });
    }
    for (const brut of ['panne', 'nuage', '', null, { nature: 'flou' }]) {
      expect(validerDemandeMalediction(brut).valide).toBe(false);
    }
  });
});

describe('la validation des reglages du mode', () => {
  it('ne regle jamais plus de taches par proie que de natures de tache', () => {
    // Une proie ne fait jamais deux fois la meme tache (retour d'essai du porteur du projet,
    // 10 octobre 2026): une liste plus longue que les natures serait impossible.
    expect(BORNES_REGLAGES.among.tachesParProie.maximum).toBe(NATURES_DE_TACHE.length);
    expect(
      validerReglages({
        among: { ...AMONG_PAR_DEFAUT, tachesParProie: NATURES_DE_TACHE.length + 1 },
      }).valide,
    ).toBe(false);
  });

  it('accepte des reglages dans leurs bornes', () => {
    const verdict = validerReglages({
      among: {
        tueurs: 3,
        tachesParProie: 7,
        rechargeMeurtreS: 10,
        dureeDuTourS: 0,
        discussionS: 120,
        voteS: 15,
        votesAnonymes: true,
        visionProie: 'large',
        visionTueur: 'reduite',
        foule: 80,
        tachesVisuelles: false,
        barreDesTaches: 'reunions',
      },
    });

    expect(verdict.valide).toBe(true);
    expect(verdict.valide && verdict.valeur.among?.visionTueur).toBe('reduite');
    expect(verdict.valide && verdict.valeur.among?.tachesVisuelles).toBe(false);
    expect(verdict.valide && verdict.valeur.among?.barreDesTaches).toBe('reunions');
  });

  it('refuse deux taches par proie, une duree de tour hors liste et un palier inconnu', () => {
    const verdict = validerReglages({
      among: {
        tachesParProie: 2,
        dureeDuTourS: 90,
        visionProie: 'immense',
        foule: 81,
        tachesVisuelles: 'oui',
        barreDesTaches: 'parfois',
      },
    });

    expect(verdict.valide).toBe(false);
    expect(!verdict.valide && verdict.erreurs.map((erreur) => erreur.champ).sort()).toEqual([
      'among.barreDesTaches',
      'among.dureeDuTourS',
      'among.foule',
      'among.tachesParProie',
      'among.tachesVisuelles',
      'among.visionProie',
    ]);
  });

  it('refuse un groupe qui n est pas un objet', () => {
    expect(validerReglages({ among: 3 }).valide).toBe(false);
  });
});
