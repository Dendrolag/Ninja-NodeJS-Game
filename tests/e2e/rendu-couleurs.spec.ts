/**
 * Les couleurs des ninjas, telles que le vrai rendu les dessine.
 *
 * LE DEFAUT QUE CE SCENARIO FERME, releve a la recette de l'etape 5.4. Le rendu
 * teintait l'image entiere du ninja, en la croyant en niveaux de gris; elle est
 * rouge. Un faux ninja blanc s'affichait donc rouge, et un joueur vert noir aux
 * yeux verts. Les tests unitaires couvrent le decoupage en calques
 * (recoloration.test.ts); seul un vrai navigateur dit ce que PixiJS en fait.
 *
 * LE SECOND DEFAUT QU'IL FERME, releve a la meme recette, sur telephone. Le rendu
 * placait le point vise par la camera en divisant la taille de l'ecran par sa
 * densite, une fois de trop: sur un ecran de densite 3, le joueur tombait au tiers de
 * l'ecran, sous le HUD. Invisible au bureau, ou la densite vaut 1; le projet mobile de
 * Playwright en emule une de 2,625, et ce scenario y relisait une image vide.
 *
 * La page monte le rendu du paquet client, sans decor ni lueur, pose un joueur
 * vert et un faux ninja blanc au point vise par la camera, grossis quatre fois, puis
 * relit les pixels de l'ecran.
 */

import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** Ce que la page compte dans l'image dessinee. */
interface Comptes {
  readonly verts: number;
  readonly blancs: number;
  readonly rouges: number;
  /** Pixels verts ou blancs dans la moitie centrale de l'ecran. */
  readonly auCentre: number;
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
      entites: [ninja('joueur-vert', 980, 0x00ff00), ninja('bot-blanc', 1020, 0xffffff)],
    },
    { x: 1000, y: 750, echelle: 4 },
  );
  rendu.application.render();

  // L'ecran lui-meme, et non le seul contenu dessine, ou qu'il soit: c'est ce qui dit
  // si la camera pose le point vise au milieu.
  const { pixels, width, height } = await Promise.resolve(
    rendu.application.renderer.extract.pixels({
      target: rendu.application.stage,
      frame: rendu.application.screen,
    }),
  );
  let verts = 0;
  let blancs = 0;
  let rouges = 0;
  let auCentre = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const [r, v, b] = [pixels[index], pixels[index + 1], pixels[index + 2]];
    const x = (index / 4) % width;
    const y = Math.floor(index / 4 / width);
    const central = x > width / 4 && x < (3 * width) / 4 && y > height / 4 && y < (3 * height) / 4;
    const vert = v > 180 && r < 90 && b < 90;
    const blanc = r > 200 && v > 200 && b > 200;

    if (vert) verts += 1;
    if (blanc) blancs += 1;
    if (r > 180 && v < 90 && b < 90) rouges += 1;
    if (central && (vert || blanc)) auCentre += 1;
  }

  window.comptes = { verts, blancs, rouges, auCentre };
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
  // Les deux ninjas encadrent le point vise: presque tous leurs pixels doivent etre
  // dans la moitie centrale de l'ecran. Une proportion, et non un nombre de pixels,
  // pour valoir a toutes les densites.
  expect(
    comptes.auCentre / (comptes.verts + comptes.blancs),
    `les ninjas vises doivent etre au milieu ${detail}`,
  ).toBeGreaterThan(0.9);
});
