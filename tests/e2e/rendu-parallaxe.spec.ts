/**
 * Le lointain de Spirit & Time, tel que le vrai rendu le dessine (etape 8.8).
 *
 * La page monte le vrai rendu sur Spirit & Time, charge son decor, et le dessine vu
 * par une camera posee a divers endroits. Deux choses a prouver dans un vrai
 * navigateur, que les tests unitaires ne voient pas:
 *
 *   1. LE TROU DU LOINTAIN NE PARAIT JAMAIS. Le centre du lointain est un rectangle
 *      noir, cache par le toit-terrasse. Le decor compose ne contient aucun pixel plus
 *      sombre que 10 sur 255: un pixel noir a l'ecran ne peut venir que du trou. On
 *      les compte aux quatre coins de la carte, la ou le lointain s'ecarte le plus,
 *      dans les deux sens de la carte.
 *   2. LE LOINTAIN GLISSE MOINS VITE QUE LE TERRAIN. La camera avance de 200 pixels de
 *      carte. Sur le toit, chaque point de la carte reste le meme; dans la ville au
 *      loin, l'image s'est decalee dans le sens de la camera, d'une part de son
 *      mouvement seulement. On retrouve ce decalage en cherchant celui qui recolle les
 *      deux images.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/**
 * La page: Spirit & Time, dessinee a la demi-echelle sur 800 par 450 pixels, soit la vue
 * de 1600 par 900 pixels de carte d'un ordinateur.
 */
function pageDuLointain(modeMiroir: boolean): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Lointain</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:800px;height:450px}</style>
<div class="hote" id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu } from '/paquets/client/rendu/pixi.js';

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2400, hauteur: 1760 },
    identifiantCarte: 'map3',
    modeMiroir: ${String(modeMiroir)},
    pluie: false,
    lueur: false,
    largeur: 800,
    hauteur: 450,
    densite: 1,
  });
  await rendu.chargerLeDecor();

  const vide = {
    disques: [],
    cones: [],
    zones: [],
    objets: [],
    entites: [],
    reperes: [],
    indicateur: { disques: [], parts: [], traits: [] },
    marques: [],
    fumees: [],
    mines: { disques: [], parts: [], traits: [] },
    explosions: [],
    impacts: [],
    sang: [],
    secousse: { x: 0, y: 0 },
  };

  /** Les pixels de l'ecran, la camera centree sur ce point de la carte. */
  const pixelsVusDe = async (x, y) => {
    rendu.dessiner(vide, { x, y, echelle: 0.5 });
    rendu.application.render();
    const { pixels } = await Promise.resolve(
      rendu.application.renderer.extract.pixels({
        target: rendu.application.stage,
        frame: rendu.application.screen,
      }),
    );
    return Uint8ClampedArray.from(pixels);
  };

  /** Combien de pixels noirs: seul le trou du lointain en a. */
  const noirs = (pixels) => {
    let compte = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) <= 6) compte += 1;
    }
    return compte;
  };

  // Les quatre coins de la course de la camera, et le centre.
  const places = [[800, 450], [1600, 450], [800, 1310], [1600, 1310], [1200, 880]];
  const pixelsNoirs = [];
  for (const [x, y] of places) pixelsNoirs.push(noirs(await pixelsVusDe(x, y)));

  // La camera en haut de sa course, puis 200 pixels de carte plus a droite (100 a l'ecran).
  // La bande comparee: le haut de l'ecran, au-dessus du toit, la ou l'on voit la ville.
  const avant = await pixelsVusDe(1100, 450);
  const apres = await pixelsVusDe(1300, 450);
  const ecart = (decalage) => {
    let somme = 0;
    let comptes = 0;
    for (let y = 4; y < 50; y += 1) {
      for (let x = 20; x < 200; x += 1) {
        const a = (y * 800 + x + decalage) * 4;
        const b = (y * 800 + x) * 4;
        // Le meme point de l'ecran apres, le point decale avant: la camera a avance de 100.
        somme +=
          Math.abs(avant[a] - apres[b]) +
          Math.abs(avant[a + 1] - apres[b + 1]) +
          Math.abs(avant[a + 2] - apres[b + 2]);
        comptes += 1;
      }
    }
    return somme / comptes;
  };
  let meilleur = 0;
  for (let decalage = 0; decalage <= 120; decalage += 1) {
    if (ecart(decalage) < ecart(meilleur)) meilleur = decalage;
  }

  window.lointain = {
    pixelsNoirs,
    decalageRecolle: meilleur,
    ecartRecolle: ecart(meilleur),
    ecartTerrain: ecart(100),
  };
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({
    '/lointain.html': pageDuLointain(false),
    '/lointain-miroir.html': pageDuLointain(true),
  });
});

test.afterAll(async () => {
  await serveur.arreter();
});

interface Releve {
  readonly pixelsNoirs: readonly number[];
  readonly decalageRecolle: number;
  readonly ecartRecolle: number;
  readonly ecartTerrain: number;
}

/** Charge la page du lointain et rend ce qu'elle a mesure. */
async function relever(page: Page, chemin: string): Promise<Releve> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}${chemin}`);
  await page.waitForFunction(() => (window as unknown as { lointain?: unknown }).lointain, null, {
    timeout: 60_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  return (await page.evaluate(
    () => (window as unknown as { lointain: Releve }).lointain,
  )) as Releve;
}

for (const [nom, chemin] of [
  ['a l endroit', '/lointain.html'],
  ['en miroir', '/lointain-miroir.html'],
] as const) {
  test(`le trou du lointain ne parait a aucun coin de la carte, ${nom}`, async ({ page }) => {
    const releve = await relever(page, chemin);

    expect(releve.pixelsNoirs, JSON.stringify(releve)).toEqual([0, 0, 0, 0, 0]);
  });
}

test('le lointain glisse dans le sens de la camera, moins vite que le terrain', async ({
  page,
}) => {
  const releve = await relever(page, '/lointain.html');

  // La camera a avance de 200 pixels de carte, 100 a l'ecran: le terrain recule de 100. Le
  // lointain suit 120 sur 400 du mouvement de la camera: il ne recule que de 70,
  // et c'est ce decalage qui recolle les deux images de la ville.
  expect(releve.decalageRecolle, JSON.stringify(releve)).toBeGreaterThanOrEqual(67);
  expect(releve.decalageRecolle, JSON.stringify(releve)).toBeLessThanOrEqual(73);
  // Et il recolle vraiment, la ou le mouvement du terrain ne recolle pas.
  expect(releve.ecartRecolle).toBeLessThan(releve.ecartTerrain / 4);
});
