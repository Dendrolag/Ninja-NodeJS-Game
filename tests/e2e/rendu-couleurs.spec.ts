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
    pluie: true,
    lueur: false,
    largeur: 640,
    hauteur: 480,
  });

  const ninja = (id, x, teinte) => ({
    id, texture: '/assets/ninja/idle.png', x, y: 750, taille: 32, teinte, alpha: 1,
  });

  rendu.dessiner(
    {
      disques: [], cones: [], zones: [], objets: [], reperes: [], sang: [], secousse: { x: 0, y: 0 },
      indicateur: { disques: [], parts: [], traits: [] },
      marques: [],
      fumees: [],
      mines: { disques: [], parts: [], traits: [] },
      explosions: [],
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

/**
 * La page du halo: la meme scene dessinee deux fois, avec et sans la lueur neon.
 *
 * LE DEFAUT QU'ELLE FERME, releve a la recette de l'etape 5.4 sur telephone: la
 * lueur etait posee sur le calque des ninjas, et tout ninja de couleur claire
 * rayonnait. Le jeu d'origine ne faisait briller aucun personnage. Des ninjas
 * jaune, blanc et cyan, les couleurs les plus claires, doivent donc etre dessines
 * au pixel pres de la meme facon, lueur allumee ou non.
 */
function pageDuHalo(): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Halo des ninjas</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:320px;height:240px}</style>
<div class="hote" id="avec"></div>
<div class="hote" id="sans"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu, prechargerLesSprites } from '/paquets/client/rendu/pixi.js';

  await prechargerLesSprites();

  const ninja = (id, x, teinte) => ({
    id, texture: '/assets/ninja/idle.png', x, y: 750, taille: 32, teinte, alpha: 1,
  });
  const scene = {
    disques: [], cones: [], zones: [], objets: [], reperes: [], sang: [], secousse: { x: 0, y: 0 },
    indicateur: { disques: [], parts: [], traits: [] },
    marques: [],
    fumees: [],
    mines: { disques: [], parts: [], traits: [] },
    explosions: [],
    entites: [
      ninja('jaune', 970, 0xffff00),
      ninja('blanc', 1000, 0xffffff),
      ninja('cyan', 1030, 0x00ffff),
    ],
  };

  const pixelsDe = async (hote, lueur) => {
    const rendu = await monterRendu({
      hote, carte: { largeur: 2000, hauteur: 1500 }, identifiantCarte: 'map1',
      modeMiroir: false, pluie: true, lueur, largeur: 320, hauteur: 240,
    });
    rendu.dessiner(scene, { x: 1000, y: 750, echelle: 3 });
    rendu.application.render();
    const { pixels } = await Promise.resolve(
      rendu.application.renderer.extract.pixels({
        target: rendu.application.stage,
        frame: rendu.application.screen,
      }),
    );
    return pixels;
  };

  const avec = await pixelsDe(document.querySelector('#avec'), true);
  const sans = await pixelsDe(document.querySelector('#sans'), false);
  let differents = 0;
  let allumes = 0;

  for (let index = 0; index < sans.length; index += 4) {
    const ecart = Math.max(
      Math.abs(avec[index] - sans[index]),
      Math.abs(avec[index + 1] - sans[index + 1]),
      Math.abs(avec[index + 2] - sans[index + 2]),
    );
    if (ecart > 8) differents += 1;
    if (sans[index] > 200 && sans[index + 1] > 200) allumes += 1;
  }

  window.halo = { differents, allumes, total: sans.length / 4 };
</script>`;
}

/** Ce que la page du bord compare et compte. */
interface Bord {
  /** Le plus grand ecart, sur une composante, entre le ninja dessine et l'attendu. */
  readonly plusGrandEcart: number;
  /** Les pixels du ninja compares: ceux que le sprite ne laisse pas transparents. */
  readonly compares: number;
  /** Les pixels restes rouges sur le ninja vert grossi six fois. */
  readonly rouges: number;
  /** Les pixels verts du ninja grossi, pour s'assurer qu'il est dessine. */
  readonly verts: number;
}

/**
 * La page du bord des ninjas (etape 4.8).
 *
 * LE DEFAUT QU'ELLE FERME, releve par le porteur du projet le 2 octobre 2026: de pres,
 * un ninja colore avait un bord en escalier, borde de rouge. Le corps du sprite est
 * adouci vers son contour, et le partage tout ou rien du jeu d'origine coupait cet
 * adoucissement (recoloration.ts).
 *
 * Deux mesures. A l'echelle un, chaque pixel du sprite tombe sur un pixel de l'ecran,
 * sans lissage: le ninja vert dessine se compare au pixel pres a l'image attendue,
 * chaque pixel du sprite repeint selon sa part de rouge et pose sur le fond. Grossi
 * six fois, comme de tres pres, il ne doit garder aucun pixel rouge.
 */
function pageDuBord(): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Bord des ninjas</title>
<style>html,body{margin:0;height:100%;overflow:hidden}#terrain{width:640px;height:480px}</style>
<div id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu, prechargerLesSprites } from '/paquets/client/rendu/pixi.js';
  import { partDeRouge } from '/paquets/client/rendu/recoloration.js';

  const IMAGE = '/assets/ninja/south_1.png';
  const VERT = [0, 255, 0];

  await prechargerLesSprites();

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2000, hauteur: 1500 },
    identifiantCarte: 'map1',
    modeMiroir: false,
    pluie: true,
    lueur: false,
    largeur: 640,
    hauteur: 480,
    densite: 1,
  });

  const scene = (entites) => ({
    disques: [], cones: [], zones: [], objets: [], reperes: [], sang: [], secousse: { x: 0, y: 0 },
    indicateur: { disques: [], parts: [], traits: [] },
    marques: [],
    fumees: [],
    mines: { disques: [], parts: [], traits: [] },
    explosions: [],
    entites,
  });
  const ninja = { id: 'vert', texture: IMAGE, x: 1000, y: 750, taille: 32, teinte: 0x00ff00, alpha: 1 };
  const lire = async (entites, echelle) => {
    rendu.dessiner(scene(entites), { x: 1000, y: 750, echelle });
    rendu.application.render();
    const { pixels } = await Promise.resolve(
      rendu.application.renderer.extract.pixels({
        target: rendu.application.stage,
        frame: rendu.application.screen,
      }),
    );
    return pixels;
  };

  // Les pixels du sprite, lus comme le rendu les lit.
  const image = new Image();
  image.src = IMAGE;
  await image.decode();
  const canevas = document.createElement('canvas');
  canevas.width = 32;
  canevas.height = 32;
  const contexte = canevas.getContext('2d');
  contexte.drawImage(image, 0, 0);
  const sprite = contexte.getImageData(0, 0, 32, 32).data;

  // A l'echelle un: le coin du sprite tombe sur le pixel (304, 224) de l'ecran.
  const fond = await lire([], 1);
  const dessin = await lire([ninja], 1);
  let plusGrandEcart = 0;
  let compares = 0;

  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const source = (y * 32 + x) * 4;
      const ecran = ((224 + y) * 640 + 304 + x) * 4;
      const [r, v, b, opacite] = [sprite[source], sprite[source + 1], sprite[source + 2], sprite[source + 3]];

      if (opacite === 0) continue;

      const part = partDeRouge(r, v, b);
      const fondDuPixel = part === 1 ? [0, 0, 0] : [(r - part * 255) / (1 - part), v / (1 - part), b / (1 - part)];
      const a = opacite / 255;

      compares += 1;
      for (let composante = 0; composante < 3; composante += 1) {
        const repeint = part * VERT[composante] + (1 - part) * Math.min(255, Math.max(0, fondDuPixel[composante]));
        const attendu = repeint * a + fond[ecran + composante] * (1 - a);
        plusGrandEcart = Math.max(plusGrandEcart, Math.abs(attendu - dessin[ecran + composante]));
      }
    }
  }

  // Grossi six fois.
  const grossi = await lire([ninja], 6);
  let rouges = 0;
  let verts = 0;

  for (let index = 0; index < grossi.length; index += 4) {
    const [r, v, b] = [grossi[index], grossi[index + 1], grossi[index + 2]];

    if (r > Math.max(v, b) + 40 && Math.abs(v - b) <= 18) rouges += 1;
    if (v > 180 && r < 90 && b < 90) verts += 1;
  }

  window.bord = { plusGrandEcart, compares, rouges, verts };
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({
    '/couleurs.html': pageDesCouleurs(),
    '/halo.html': pageDuHalo(),
    '/bord.html': pageDuBord(),
  });
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

test('un ninja colore garde le bord adouci de son dessin, sans liseré rouge', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}/bord.html`);
  await page.waitForFunction(() => (window as unknown as { bord?: unknown }).bord, null, {
    timeout: 30_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  const bord = (await page.evaluate(() => (window as unknown as { bord: Bord }).bord)) as Bord;
  const detail = JSON.stringify(bord);

  // Le sprite de face couvre plus de cinq cents pixels. Avant la correction, ceux du bord
  // s'ecartaient de l'attendu de 133 sur une composante, et le ninja grossi gardait 125
  // pixels rouges.
  expect(bord.compares, `le ninja doit etre compare ${detail}`).toBeGreaterThan(500);
  expect(bord.plusGrandEcart, `le ninja doit etre dessine comme attendu ${detail}`).toBeLessThan(4);
  expect(bord.verts, `le ninja grossi doit etre dessine ${detail}`).toBeGreaterThan(2_000);
  expect(bord.rouges, `le ninja grossi ne doit garder aucun pixel rouge ${detail}`).toBe(0);
});

test('aucun ninja ne rayonne, meme de la couleur la plus claire', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}/halo.html`);
  await page.waitForFunction(() => (window as unknown as { halo?: unknown }).halo, null, {
    timeout: 30_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  const halo = (await page.evaluate(
    () => (window as unknown as { halo: { differents: number; allumes: number } }).halo,
  )) as { differents: number; allumes: number };
  const detail = JSON.stringify(halo);

  // Les ninjas sont bien dessines, et en couleurs claires: sinon l'egalite des deux
  // images ne prouverait rien.
  expect(halo.allumes, `les ninjas clairs doivent etre dessines ${detail}`).toBeGreaterThan(500);
  expect(halo.differents, `la lueur ne doit changer aucun pixel des ninjas ${detail}`).toBe(0);
});
