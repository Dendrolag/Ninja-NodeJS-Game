/**
 * Tests du contrat du mode Among Ninjas (etape 7.20): ses valeurs, ses lieux, ses couleurs,
 * ses reglages, leur validation et ce que le mode impose.
 */

import { describe, expect, it } from 'vitest';

import {
  AMONG,
  CARTE_DU_MODE_AMONG,
  COULEURS_NOMMEES,
  COULEUR_DE_LA_FOULE,
  LIEUX_DES_CARTES,
  RAYONS_DE_VISION,
  lieuxDuMode,
  nomDeCouleur,
  tueursMaximum,
} from './among.js';
import { CAPACITES, CARTES, COULEURS_JOUEURS, luminance } from './constantes.js';
import { AMONG_PAR_DEFAUT, completerReglages, imposerLesReglagesDuMode } from './reglages.js';
import { validerReglages } from './validation.js';

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
    for (const place of [lieux?.gong, ...(lieux?.stations ?? [])]) {
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
      x: CARTES.map1.largeur - (normal?.stations[0]?.x ?? 0),
      y: normal?.stations[0]?.y,
    });
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

describe('la validation des reglages du mode', () => {
  it('accepte des reglages dans leurs bornes', () => {
    const verdict = validerReglages({
      among: {
        tueurs: 3,
        tachesParProie: 8,
        rechargeMeurtreS: 10,
        dureeDuTourS: 0,
        discussionS: 120,
        voteS: 15,
        votesAnonymes: true,
        visionProie: 'large',
        visionTueur: 'reduite',
        foule: 80,
      },
    });

    expect(verdict.valide).toBe(true);
    expect(verdict.valide && verdict.valeur.among?.visionTueur).toBe('reduite');
  });

  it('refuse deux taches par proie, une duree de tour hors liste et un palier inconnu', () => {
    const verdict = validerReglages({
      among: { tachesParProie: 2, dureeDuTourS: 90, visionProie: 'immense', foule: 81 },
    });

    expect(verdict.valide).toBe(false);
    expect(!verdict.valide && verdict.erreurs.map((erreur) => erreur.champ).sort()).toEqual([
      'among.dureeDuTourS',
      'among.foule',
      'among.tachesParProie',
      'among.visionProie',
    ]);
  });

  it('refuse un groupe qui n est pas un objet', () => {
    expect(validerReglages({ among: 3 }).valide).toBe(false);
  });
});
