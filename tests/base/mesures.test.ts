/**
 * Tests d'integration du releve de retention et de calibration (etape 3.7).
 *
 * Les autres tests de la base ecrivent en meme temps des parties de 2026 et au-dela: ces
 * tests jouent en 2019, une annee que personne d'autre n'occupe, et ne lisent que ses
 * semaines.
 */

import { randomUUID } from 'node:crypto';

import { creerCompte, enregistrerPartie, releverLaRetention } from '@neon-ninja/server';
import { describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, pseudoNeuf } from './contexte.js';

describe.runIf(baseDisponible())('releve de retention', () => {
  const db = baseDeTest();

  /** Un compte neuf. */
  async function nouveauCompte(): Promise<string> {
    return accepte(await creerCompte(db(), pseudoNeuf('Mesure'))).id;
  }

  /** Une partie jouee seul par ce compte, terminee a cette heure. */
  async function jouer(compteId: string, termineeLe: string, captures = 0): Promise<void> {
    await enregistrerPartie(
      db(),
      {
        id: randomUUID(),
        mode: 'classique',
        carte: 'map1',
        modeMiroir: false,
        dureeS: 180,
        nombreJoueurs: 1,
        termineeLe: new Date(termineeLe),
      },
      [
        {
          compteId,
          placement: 1,
          points: 0,
          captures,
          botsNoirsDetruits: 0,
          xpGagnee: 0,
          piecesGagnees: 0,
          variationPointsLigue: 0,
        },
      ],
    );
  }

  it('compte les actifs par semaine, et les revenus sept jours ou plus apres leur premiere partie', async () => {
    const alice = await nouveauCompte();
    const bob = await nouveauCompte();
    const carla = await nouveauCompte();

    // Semaine du lundi 4 mars 2019. Alice revient huit jours apres, Bob six jours apres
    // seulement, Carla ne revient pas.
    await jouer(alice, '2019-03-05T12:00:00Z', 4);
    await jouer(alice, '2019-03-13T12:00:00Z');
    await jouer(bob, '2019-03-06T12:00:00Z');
    await jouer(bob, '2019-03-12T11:00:00Z');
    await jouer(carla, '2019-03-07T12:00:00Z');

    const releve = await releverLaRetention(db());

    expect(releve.comptesActifsParSemaine).toEqual(
      expect.arrayContaining([
        { semaine: '2019-03-04', comptes: 3 },
        { semaine: '2019-03-11', comptes: 2 },
      ]),
    );
    expect(releve.cohortes).toEqual(
      expect.arrayContaining([{ semaine: '2019-03-04', comptes: 3, revenus: 1 }]),
    );
    expect(releve.calibration.resultats).toBeGreaterThanOrEqual(5);
    expect(releve.calibration.prisesParPartie.maximum).toBeGreaterThanOrEqual(4);
  });

  it('place une partie dans la semaine de Paris, et non dans celle du temps universel', async () => {
    const compte = await nouveauCompte();

    // Lundi 22 avril 2019 a 0 h 30 a Paris, encore dimanche en temps universel.
    await jouer(compte, '2019-04-21T22:30:00Z');

    const releve = await releverLaRetention(db());

    expect(releve.comptesActifsParSemaine).toEqual(
      expect.arrayContaining([{ semaine: '2019-04-22', comptes: 1 }]),
    );
  });
});
