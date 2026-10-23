/**
 * La lecture de la ligne de commande du harnais de charge: les options par defaut, et
 * celles de la carte de mesure (etape 5.10).
 */

import { describe, expect, it } from 'vitest';

import { BOTS_DE_LA_CARTE_DE_MESURE, PAR_DEFAUT, lirePlan } from './plan.ts';

describe('lirePlan', () => {
  it('joue les trois mesures habituelles sur Tokyo quand rien n est precise', () => {
    const plan = lirePlan([]);

    expect(plan.banc && plan.melange && plan.reseau).toBe(true);
    expect(plan.demarrage).toBe(false);
    expect(plan.carte).toBe('map1');
    expect(plan.terrainDeMesure).toBeUndefined();
    expect(plan.botsBanc).toEqual(PAR_DEFAUT.botsBanc);
    expect(plan.joueurs).toBe(12);
    expect(plan.echauffement).toBe(PAR_DEFAUT.echauffement);
    expect(plan.zoneDInteret).toBe(false);
    expect(plan.profil).toBeUndefined();
  });

  it('joue la carte de mesure et ses foules de 1 000 a 10 000 faux ninjas', () => {
    const plan = lirePlan(['--banc', '--carte-de-mesure', 'realiste']);

    expect(plan.terrainDeMesure).toBe('realiste');
    expect(plan.botsBanc).toEqual(BOTS_DE_LA_CARTE_DE_MESURE);
    expect(lirePlan(['--carte-de-mesure', 'vide', '--bots-banc', '5000']).botsBanc).toEqual([5000]);
  });

  it('refuse un terrain de mesure inconnu', () => {
    expect(() => lirePlan(['--carte-de-mesure', 'tokyo'])).toThrow(/realiste, vide/u);
  });

  it('lit le nombre de joueurs, l echauffement du banc, la zone d interet et le profil', () => {
    const plan = lirePlan([
      '--banc',
      '--joueurs',
      '60',
      '--echauffement-banc',
      '50',
      '--zone-d-interet',
      '--profil',
      'profils',
    ]);

    expect(plan.joueurs).toBe(60);
    expect(plan.echauffement).toBe(50);
    expect(plan.zoneDInteret).toBe(true);
    expect(plan.profil).toBe('profils');
    expect(() => lirePlan(['--echauffement-banc', '0'])).toThrow(/entiers positifs/u);
  });

  it('ne mesure que le demarrage quand il est seul demande', () => {
    const plan = lirePlan(['--demarrage']);

    expect(plan.demarrage).toBe(true);
    expect(plan.banc || plan.melange || plan.reseau).toBe(false);
  });
});
