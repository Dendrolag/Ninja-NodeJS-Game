/**
 * Tests des reglages de partie.
 *
 * L'enjeu est la fusion: un appelant doit pouvoir changer une seule valeur sans
 * reecrire tout un groupe, et sans perdre le reste au passage. C'est ce qui evite
 * de recopier quarante reglages a chaque creation de partie, et donc d'en oublier
 * un en chemin.
 */

import { describe, expect, it } from 'vitest';

import type { ReglagesPartiels } from './reglages.js';
import { REGLAGES_PAR_DEFAUT, completerReglages } from './reglages.js';

describe('completerReglages', () => {
  it('rend les valeurs par defaut quand on ne fournit rien', () => {
    expect(completerReglages()).toEqual(REGLAGES_PAR_DEFAUT);
    expect(completerReglages({})).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it('remplace une valeur simple sans toucher au reste', () => {
    const reglages = completerReglages({ dureePartieS: 60 });

    expect(reglages.dureePartieS).toBe(60);
    expect(reglages.carte).toBe(REGLAGES_PAR_DEFAUT.carte);
  });

  it('descend dans les groupes au lieu de les remplacer en bloc', () => {
    const reglages = completerReglages({ bonus: { intervalleApparitionS: 1 } });

    expect(reglages.bonus.intervalleApparitionS).toBe(1);
    expect(reglages.bonus.types).toEqual(REGLAGES_PAR_DEFAUT.bonus.types);
  });

  it('descend jusqu au reglage d une seule nature de bonus', () => {
    const reglages = completerReglages({ bonus: { types: { vitesse: { dureeS: 25 } } } });

    expect(reglages.bonus.types.vitesse).toEqual({
      actif: true,
      dureeS: 25,
      tauxApparitionPourCent: 25,
    });
    expect(reglages.bonus.types.invincibilite).toEqual(
      REGLAGES_PAR_DEFAUT.bonus.types.invincibilite,
    );
  });

  it('ignore un champ explicitement absent', () => {
    // Les types interdisent d'ecrire cela, mais des reglages venus du reseau
    // peuvent tres bien contenir un champ a undefined. Il ne doit pas effacer la
    // valeur par defaut: c'est la difference entre « je ne change pas ce reglage »
    // et « je le mets a rien ».
    const venuDuReseau = {
      dureePartieS: undefined,
      modeMiroir: true,
    } as unknown as ReglagesPartiels;
    const reglages = completerReglages(venuDuReseau);

    expect(reglages.dureePartieS).toBe(REGLAGES_PAR_DEFAUT.dureePartieS);
    expect(reglages.modeMiroir).toBe(true);
  });

  it('ne modifie pas les valeurs par defaut', () => {
    completerReglages({
      zones: { actives: false },
      bonus: { types: { vitesse: { actif: false } } },
    });

    expect(REGLAGES_PAR_DEFAUT.zones.actives).toBe(true);
    expect(REGLAGES_PAR_DEFAUT.bonus.types.vitesse.actif).toBe(true);
  });

  it('reprend les valeurs du legacy', () => {
    // Reference: DEFAULT_GAME_SETTINGS (legacy/game-constants.js:79).
    const reglages = completerReglages();

    expect(reglages.bonus.intervalleApparitionS).toBe(4);
    expect(reglages.bonus.types.invincibilite.tauxApparitionPourCent).toBe(15);
    expect(reglages.malus.intervalleApparitionS).toBe(8);
    expect(reglages.malus.types.negatif.dureeS).toBe(14);
    expect(reglages.zones.intervalleApparitionS).toBe(15);
    expect(reglages.zones.dureeMaximumS).toBe(30);
  });
});
