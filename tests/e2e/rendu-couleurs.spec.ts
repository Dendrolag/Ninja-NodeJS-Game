/**
 * Les couleurs des ninjas, telles que le vrai rendu les dessine.
 *
 * LE DEFAUT QUE CE SCENARIO FERME, releve a la recette de l'etape 5.4. Le rendu
 * teintait l'image entiere du ninja, en la croyant en niveaux de gris; elle est
 * rouge. Un faux ninja blanc s'affichait donc rouge, et un joueur vert noir aux
 * yeux verts. Les tests unitaires couvrent le decoupage en calques
 * (recoloration.test.ts); seul un vrai navigateur dit ce que PixiJS en fait.
 *
 * La page monte le rendu du paquet client, sans decor ni lueur, pose un joueur
 * vert et un faux ninja blanc au centre, grossis quatre fois, puis relit les
 * pixels dessines.
 */

import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** Ce que la page compte dans l'image dessinee. */
interface Comptes {
  readonly verts: number;
  readonly blancs: number;
  readonly rouges: number;
}

/** La page: elle dessine les deux ninjas avec le vrai rendu et compte les pixels. */
function pageDesCouleurs(): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Couleurs des ninjas</title>
<style>html,body{margin:0;height:100%;overflow:hidden}#terrain{width:640px;height:480px}</style>
<div id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu, prechargerLesSprites } from '/paquets/client/rendu/pixi.js';

  await prechargerLesSprites();

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2000, hauteur: 1500 },
    identifiantCarte: 'map1',
    modeMiroir: false,
    lueur: false,
    largeur: 640,
    hauteur: 480,
  });

  const ninja = (id, x, teinte) => ({
    id, texture: '/assets/ninja/idle.png', x, y: 750, taille: 32, teinte, alpha: 1,
  });

  rendu.dessiner(
    {
      disques: [], cones: [], zones: [], objets: [], reperes: [],
      entites: [ninja('joueur-vert', 960, 0x00ff00), ninja('bot-blanc', 1040, 0xffffff)],
    },
    { x: 1000, y: 750, echelle: 4 },
  );
  rendu.application.render();

  const { pixels } = await Promise.resolve(
    rendu.application.renderer.extract.pixels(rendu.application.stage),
  );
  let verts = 0;
  let blancs = 0;
  let rouges = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const [r, v, b] = [pixels[index], pixels[index + 1], pixels[index + 2]];

    if (v > 180 && r < 90 && b < 90) verts += 1;
    if (r > 200 && v > 200 && b > 200) blancs += 1;
    if (r > 180 && v < 90 && b < 90) rouges += 1;
  }

  window.comptes = { verts, blancs, rouges };
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({ '/couleurs.html': pageDesCouleurs() });
});

test.afterAll(async () => {
  await serveur.arreter();
});

test('un ninja prend la couleur de son proprietaire, sans noircir ni rougir', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}/couleurs.html`);
  await page.waitForFunction(() => (window as unknown as { comptes?: Comptes }).comptes, null, {
    timeout: 30_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  const comptes = (await page.evaluate(
    () => (window as unknown as { comptes: Comptes }).comptes,
  )) as Comptes;

  // Grossi quatre fois, le corps d'un ninja couvre plusieurs milliers de pixels.
  // Avant la correction, le joueur vert n'en montrait que ses yeux, et le faux
  // ninja blanc etait rouge.
  const detail = JSON.stringify(comptes);
  expect(comptes.verts, `le corps du joueur vert doit etre vert ${detail}`).toBeGreaterThan(1_000);
  expect(comptes.blancs, `le corps du faux ninja blanc doit etre blanc ${detail}`).toBeGreaterThan(
    1_000,
  );
  expect(comptes.rouges, `aucun ninja ne doit rester rouge ${detail}`).toBe(0);
});
