/**
 * Tests du juge de stabilite de l'affichage.
 *
 * RECETTE DE L'ETAPE 5.4, SIGNALEMENT DU PORTEUR DU PROJET: au lancement d'une
 * partie, le jeu ramait sur telephone avant de se stabiliser. Mesure faite, les
 * premieres images dessinees portaient des taches longues (le decor envoye a la
 * carte graphique, la lueur preparee). L'ecran de preparation reste donc pose
 * jusqu'a ce que l'affichage soit fluide, et jamais plus de quelques secondes.
 */

import { describe, expect, it } from 'vitest';

import { STABILITE } from './apparence.js';
import { creerJugeDeStabilite } from './stabilite.js';

/** Fait passer une suite d'images au juge, a ces intervalles, et rend son dernier avis. */
function jouer(
  juge: ReturnType<typeof creerJugeDeStabilite>,
  depart: number,
  intervalles: readonly number[],
  partieDessinee = true,
): { readonly stable: boolean; readonly instant: number } {
  let instant = depart;
  let stable = juge.observer(instant, partieDessinee);

  for (const intervalle of intervalles) {
    instant += intervalle;
    stable = juge.observer(instant, partieDessinee);
  }

  return { stable, instant };
}

describe('creerJugeDeStabilite', () => {
  it('ne declare rien tant que la partie n est pas dessinee, meme apres longtemps', () => {
    const juge = creerJugeDeStabilite();

    const { stable } = jouer(juge, 0, Array(200).fill(16), false);

    expect(stable).toBe(false);
  });

  it('declare l affichage stable apres assez d images rapides d affilee', () => {
    const juge = creerJugeDeStabilite();
    const rapides = Array(STABILITE.imagesRapidesRequises).fill(16);

    expect(jouer(juge, 1_000, rapides.slice(1)).stable).toBe(false);
    expect(juge.observer(1_000 + 16 * STABILITE.imagesRapidesRequises, true)).toBe(true);
  });

  it('recommence a compter apres une image lente', () => {
    const juge = creerJugeDeStabilite();
    const presque = Array(STABILITE.imagesRapidesRequises - 1).fill(16);
    const lente = STABILITE.dureeImageRapideMs + 40;

    const { stable, instant } = jouer(juge, 0, [...presque, lente]);
    expect(stable).toBe(false);

    // Autant d'images rapides qu'avant l'image lente: le compte est reparti de zero.
    let apres = instant;
    let stableApres = false;
    for (const intervalle of presque) {
      apres += intervalle;
      stableApres = juge.observer(apres, true);
    }

    expect(stableApres).toBe(false);
  });

  it('rend la main au plus tard apres l attente maximale, meme si les images restent lentes', () => {
    const juge = creerJugeDeStabilite();
    const lente = STABILITE.dureeImageRapideMs + 100;
    const nombre = Math.ceil(STABILITE.attenteMaximaleMs / lente);

    const avant = jouer(juge, 0, Array(nombre - 1).fill(lente));

    expect(avant.stable).toBe(false);
    expect(juge.observer(avant.instant + lente, true)).toBe(true);
  });

  it('reste stable une fois stable, quoi qu il arrive ensuite', () => {
    const juge = creerJugeDeStabilite();
    const { instant } = jouer(juge, 0, Array(STABILITE.imagesRapidesRequises).fill(16));

    expect(juge.observer(instant + 2_000, true)).toBe(true);
  });
});
