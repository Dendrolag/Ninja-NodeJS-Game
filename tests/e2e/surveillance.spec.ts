import { expect, test } from '@playwright/test';

import { SurveillanceDuJeu, creerJournalEnMemoire } from '../../packages/server/dist/index.js';

import { attendreLaPartie, entrer, lancer, regler } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * La surveillance de la production (étape 5.15): une partie jouée envoie ses bulletins.
 *
 * Toutes les dix secondes, la page dit au serveur ce que le joueur a vécu: ses images, les
 * instantanés reçus, l'aller et retour mesuré par la sonde, et une fois l'appareil. Le
 * scénario joue une partie sur un serveur surveillé, puis lit ce que le serveur en a compté,
 * comme l'agent Alloy le lira en production. Le jeu, lui, ne change pas: les autres
 * scénarios jouent toutes leurs parties avec la surveillance de la page en marche.
 *
 * JOUÉ PAR LES DEUX PROJETS: sur le bureau, la page se dit ordinateur; sur le téléphone
 * simulé, téléphone. C'est l'étiquette qui sépare les deux dans le tableau.
 */

let jeu: ServeurDeJeu;
let surveillance: SurveillanceDuJeu;

test.beforeEach(async () => {
  surveillance = new SurveillanceDuJeu({ journal: creerJournalEnMemoire(), version: 'e2e' });
  jeu = await demarrerLeJeu({ surveillance });
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** La valeur d'une série dans le texte des métriques, ou zéro. */
function valeur(texte: string, serie: string): number {
  const ligne = texte.split('\n').find((candidate) => candidate.startsWith(`${serie} `));
  return ligne === undefined ? 0 : Number(ligne.slice(serie.length + 1));
}

test('une partie jouée envoie ses bulletins au serveur', async ({ page }, essai) => {
  test.setTimeout(120_000);
  const appareil = essai.project.name === 'mobile' ? 'telephone' : 'ordinateur';

  // Ce que la page envoie sur son lien: les bulletins y passent, codés en tableau.
  const bulletins: string[] = [];
  page.on('websocket', (lien) => {
    lien.on('framesent', ({ payload }) => {
      const texte = String(payload);
      if (texte.includes('"bulletin"')) {
        bulletins.push(texte);
      }
    });
  });

  await entrer(page, jeu.url, 'Alice');
  await regler(page, { dureePartieS: '60', nombreBotsInitial: '50' });
  await lancer(page);
  await attendreLaPartie(page);

  // Le premier bulletin part dix secondes après le montage de la partie.
  await expect.poll(() => bulletins.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  expect(bulletins[0]).toMatch(/^42\["bulletin",\[1,/u);

  // Le serveur le compte des qu'il l'a recu.
  await expect
    .poll(() =>
      valeur(surveillance.ecrire(), 'neon_bulletins_total{issue="accepte",version="e2e"}'),
    )
    .toBeGreaterThanOrEqual(1);

  const metriques = surveillance.ecrire();
  const etiquettes = `appareil="${appareil}",navigateur="chrome",version="e2e"`;

  expect(valeur(metriques, 'neon_bulletins_total{issue="mal_forme",version="e2e"}')).toBe(0);
  expect(valeur(metriques, `neon_page_images_total{${etiquettes}}`)).toBeGreaterThan(0);
  expect(valeur(metriques, `neon_page_instantanes_total{${etiquettes}}`)).toBeGreaterThan(0);
  expect(valeur(metriques, `neon_page_aller_retour_ms_count{${etiquettes}}`)).toBeGreaterThan(0);
  expect(
    valeur(
      metriques,
      `neon_page_appareils_total{appareil="${appareil}",navigateur="chrome",moteur="webgl",version="e2e"}`,
    ),
  ).toBe(1);
  expect(
    valeur(metriques, 'neon_battements_total{mode="classique",version="e2e"}'),
  ).toBeGreaterThan(100);

  // La partie continue: le HUD compte toujours le temps.
  await expect(page.locator('.hud-temps')).toHaveText(/\d:\d\d/u);
});
