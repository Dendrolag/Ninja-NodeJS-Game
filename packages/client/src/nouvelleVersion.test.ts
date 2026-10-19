/**
 * Tests de l'attente de la nouvelle version (16 octobre 2026): refusee pour sa version pendant
 * une mise en ligne, la page lit la version publiee, et ne se recharge que lorsque la nouvelle
 * page est la, au lieu de se recharger sur l'ancienne.
 */

import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import type { Observateur } from './magasin.js';
import {
  INTERVALLE_DE_LECTURE_MS,
  LECTURES_AU_PLUS,
  attendreLaNouvelleVersion,
} from './nouvelleVersion.js';

const REFUSEE: EtatClient = {
  ...ETAT_INITIAL,
  connexion: 'refusee',
  refusDeConnexion: MOTIF_VERSION_DIFFERENTE,
};

/** Un client dont on change l'etat a la main, et une horloge de rappels a la main. */
function monter(versionsPubliees: readonly (string | undefined)[], version = 'ancienne') {
  const observateurs = new Set<Observateur>();
  const client = {
    etat: ETAT_INITIAL,
    abonner(observateur: Observateur) {
      observateurs.add(observateur);
      return () => observateurs.delete(observateur);
    },
  };
  const rappels: { rappel: () => void; delaiMs: number }[] = [];
  const lectures: number[] = [];
  let recharges = 0;
  let rang = 0;
  const arreter = attendreLaNouvelleVersion({
    client,
    versionDeLaPage: version,
    lireLaVersionPubliee: async () => {
      lectures.push(rang);
      const publiee = versionsPubliees[Math.min(rang, versionsPubliees.length - 1)];
      rang += 1;
      return Promise.resolve(publiee);
    },
    recharger: () => {
      recharges += 1;
    },
    planifier: (rappel, delaiMs) => {
      const prevu = { rappel, delaiMs };
      rappels.push(prevu);
      return () => {
        rappels.splice(rappels.indexOf(prevu), 1);
      };
    },
  });
  const changer = (etat: EtatClient): void => {
    client.etat = etat;
    for (const observateur of observateurs) {
      observateur(etat);
    }
  };
  /** Laisse les lectures en cours se resoudre. */
  const attendre = async (): Promise<void> => {
    for (let tour = 0; tour < 5; tour += 1) {
      await Promise.resolve();
    }
  };
  /** Fait passer le prochain rappel. */
  const avancer = async (): Promise<void> => {
    rappels.shift()?.rappel();
    await attendre();
  };

  return {
    changer,
    attendre,
    avancer,
    arreter,
    rappels,
    lectures,
    recharges: () => recharges,
  };
}

describe('l attente de la nouvelle version', () => {
  it('ne fait rien tant que le lien n est pas refuse pour la version', async () => {
    const page = monter(['nouvelle']);

    page.changer({ ...ETAT_INITIAL, connexion: 'refusee', refusDeConnexion: 'Pseudo pris' });
    await page.attendre();

    expect(page.lectures).toEqual([]);
    expect(page.recharges()).toBe(0);
  });

  it('attend que la nouvelle page soit publiee, puis se recharge, une fois', async () => {
    const page = monter(['ancienne', 'ancienne', 'nouvelle']);

    page.changer(REFUSEE);
    await page.attendre();
    expect(page.lectures).toHaveLength(1);
    expect(page.recharges()).toBe(0);
    expect(page.rappels.map(({ delaiMs }) => delaiMs)).toEqual([INTERVALLE_DE_LECTURE_MS]);

    await page.avancer();
    expect(page.recharges()).toBe(0);
    await page.avancer();
    expect(page.recharges()).toBe(1);
    expect(page.rappels).toEqual([]);
  });

  it('ne se recharge pas sur une version illisible, et s arrete au bout de trois minutes', async () => {
    const page = monter([undefined, '']);

    page.changer(REFUSEE);
    await page.attendre();
    while (page.rappels.length > 0) {
      await page.avancer();
    }

    expect(page.lectures).toHaveLength(LECTURES_AU_PLUS);
    expect(page.recharges()).toBe(0);
  });

  it('cesse d attendre quand le lien n est plus refuse, ou qu on l arrete', async () => {
    const page = monter(['ancienne']);

    page.changer(REFUSEE);
    await page.attendre();
    page.changer({ ...ETAT_INITIAL, connexion: 'connecte' });
    expect(page.rappels).toEqual([]);

    page.changer(REFUSEE);
    await page.attendre();
    page.arreter();
    expect(page.rappels).toEqual([]);
  });

  it('n attend rien pour une page sans version, celle du developpement', async () => {
    const page = monter(['nouvelle'], '');

    page.changer(REFUSEE);
    await page.attendre();

    expect(page.lectures).toEqual([]);
  });
});
