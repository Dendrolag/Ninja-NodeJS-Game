/**
 * La pluie de Rainy Tokyo, telle que le vrai rendu la dessine.
 *
 * LE DEFAUT QUE CE SCENARIO FERME, releve a la recette de l'etape 5.4: la pluie de
 * la carte Rainy Tokyo n'avait jamais ete portee. Le jeu d'origine la dessinait
 * par-dessus le fond, planche de trois images changee toutes les cent millisecondes
 * (RainEffect, legacy/js/MapManager.js). Le rendu de la reecriture chargeait le fond
 * et le premier plan, jamais la pluie.
 *
 * La page monte le vrai rendu sur la carte demandee, charge son decor, dessine deux
 * scenes vides qui ne different que par l'image de pluie, et compte les pixels qui
 * changent. Sur Rainy Tokyo la pluie anime le decor; sur Tokyo, carte au meme decor
 * mais sans pluie, rien ne bouge.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** La page: le decor d'une carte, dessine avec deux images de pluie differentes. */
function pageDeLaPluie(carte: string): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Pluie</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:400px;height:300px}</style>
<div class="hote" id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu } from '/paquets/client/rendu/pixi.js';

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2000, hauteur: 1500 },
    identifiantCarte: '${carte}',
    modeMiroir: false,
    lueur: false,
    largeur: 400,
    hauteur: 300,
  });
  await rendu.chargerLeDecor();

  const vide = {
    disques: [],
    cones: [],
    zones: [],
    objets: [],
    entites: [],
    reperes: [],
    sang: [],
    secousse: { x: 0, y: 0 },
  };
  const pixelsAvec = async (imageDePluie) => {
    rendu.dessiner({ ...vide, imageDePluie }, { x: 1000, y: 750, echelle: 1 });
    rendu.application.render();
    const { pixels } = await Promise.resolve(
      rendu.application.renderer.extract.pixels({
        target: rendu.application.stage,
        frame: rendu.application.screen,
      }),
    );
    return Uint8ClampedArray.from(pixels);
  };

  const premiere = await pixelsAvec(0);
  const seconde = await pixelsAvec(1);
  let differents = 0;

  for (let index = 0; index < premiere.length; index += 4) {
    const ecart = Math.max(
      Math.abs(premiere[index] - seconde[index]),
      Math.abs(premiere[index + 1] - seconde[index + 1]),
      Math.abs(premiere[index + 2] - seconde[index + 2]),
    );
    if (ecart > 4) differents += 1;
  }

  window.pluie = { differents, total: premiere.length / 4 };
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({
    '/rainy-tokyo.html': pageDeLaPluie('map1'),
    '/tokyo.html': pageDeLaPluie('map2'),
  });
});

test.afterAll(async () => {
  await serveur.arreter();
});

/** Charge une page de pluie et rend ce qu'elle a compte. */
async function compter(page: Page, chemin: string): Promise<{ differents: number; total: number }> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}${chemin}`);
  await page.waitForFunction(() => (window as unknown as { pluie?: unknown }).pluie, null, {
    timeout: 60_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  return (await page.evaluate(
    () => (window as unknown as { pluie: { differents: number; total: number } }).pluie,
  )) as { differents: number; total: number };
}

test('sur Rainy Tokyo, la pluie anime le decor', async ({ page }) => {
  const pluie = await compter(page, '/rainy-tokyo.html');

  // Une pluie clairsemee, a trente pour cent d'opacite, ne change qu'une petite part
  // des pixels: 933 sur 120 000 au bureau, 3 719 sur 480 000 en emulation mobile,
  // mesures a l'etape 5.4. Sans pluie, le compte vaut zero, comme sur Tokyo.
  expect(
    pluie.differents,
    `la pluie doit changer l'image ${JSON.stringify(pluie)}`,
  ).toBeGreaterThan(pluie.total / 1000);
});

test('sur Tokyo, sans pluie, le decor ne bouge pas', async ({ page }) => {
  const pluie = await compter(page, '/tokyo.html');

  expect(pluie.differents, `rien ne doit changer ${JSON.stringify(pluie)}`).toBe(0);
});
