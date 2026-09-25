/**
 * Le mode miroir, tel que le vrai rendu le dessine (etape 8.3).
 *
 * Depuis l'etape 8.3, une carte n'a qu'un jeu d'images: la page retourne le decor
 * elle-meme au lieu de charger un second dossier d'images deja retournees. Ce
 * scenario monte le vrai rendu sur Tokyo, avec sa pluie, une fois dans chaque sens,
 * la camera au centre de la carte. Le centre etant sur l'axe du retournement, l'image
 * du miroir doit etre celle de la carte normale, retournee de gauche a droite.
 *
 * LA PLUIE EST COMPRISE, ET C'EST LE POINT DELICAT. Elle ne tombe pas dans les
 * interieurs vus en coupe: ses zones seches suivent le fond, et doivent le suivre une
 * fois retourne. La scene montre sa deuxieme image, pour verifier que le sens tient
 * quand la texture de la pluie change en cours de partie.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** La page: le decor de Tokyo dans les deux sens, et la comparaison des deux images. */
const PAGE_DU_MIROIR = `<!doctype html>
<meta charset="utf-8">
<title>Miroir</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:400px;height:300px}</style>
<div class="hote" id="hote-normal"></div>
<div class="hote" id="hote-miroir"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu } from '/paquets/client/rendu/pixi.js';

  const vide = {
    disques: [],
    cones: [],
    zones: [],
    objets: [],
    entites: [],
    reperes: [],
    indicateur: { disques: [], parts: [], traits: [] },
    sang: [],
    secousse: { x: 0, y: 0 },
    imageDePluie: 1,
  };

  const image = async (hote, modeMiroir) => {
    const rendu = await monterRendu({
      hote: document.querySelector(hote),
      carte: { largeur: 2000, hauteur: 1500 },
      identifiantCarte: 'map1',
      modeMiroir,
      pluie: true,
      lueur: false,
      largeur: 400,
      hauteur: 300,
    });
    await rendu.chargerLeDecor();
    rendu.dessiner(vide, { x: 1000, y: 750, echelle: 1 });
    rendu.application.render();
    return Promise.resolve(
      rendu.application.renderer.extract.pixels({
        target: rendu.application.stage,
        frame: rendu.application.screen,
      }),
    );
  };

  const normal = await image('#hote-normal', false);
  const miroir = await image('#hote-miroir', true);
  const { width: largeur, height: hauteur } = normal;

  const ecart = (a, b) =>
    Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  const pixel = (pixels, x, y) => {
    const depart = (y * largeur + x) * 4;
    return pixels.subarray(depart, depart + 4);
  };

  let differentsDuRetourne = 0;
  let differentsDuNormal = 0;

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const vu = pixel(miroir.pixels, x, y);
      if (ecart(vu, pixel(normal.pixels, largeur - 1 - x, y)) > 8) differentsDuRetourne += 1;
      if (ecart(vu, pixel(normal.pixels, x, y)) > 8) differentsDuNormal += 1;
    }
  }

  window.miroir = { differentsDuRetourne, differentsDuNormal, total: largeur * hauteur };
</script>`;

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({ '/miroir.html': PAGE_DU_MIROIR });
});

test.afterAll(async () => {
  await serveur.arreter();
});

/** Ce que la page a compte. */
interface Comptes {
  readonly differentsDuRetourne: number;
  readonly differentsDuNormal: number;
  readonly total: number;
}

/** Charge la page et rend ce qu'elle a compte. */
async function compter(page: Page): Promise<Comptes> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}/miroir.html`);
  await page.waitForFunction(() => (window as unknown as { miroir?: unknown }).miroir, null, {
    timeout: 60_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  return (await page.evaluate(() => (window as unknown as { miroir: Comptes }).miroir)) as Comptes;
}

test('le decor de Tokyo en miroir est celui de la carte normale, retourne, pluie comprise', async ({
  page,
}) => {
  const comptes = await compter(page);

  // Le miroir n'est pas la carte normale: le centre de Tokyo n'est pas symetrique.
  expect(
    comptes.differentsDuNormal,
    `le decor doit etre retourne ${JSON.stringify(comptes)}`,
  ).toBeGreaterThan(comptes.total / 20);
  // Il en est le retournement exact: zero pixel different sur 120 000 au bureau et sur
  // 480 000 en emulation mobile, mesure a l'etape 8.3, contre plus de la moitie sans
  // retournement. La marge d'un pour mille laisse sa place a une autre carte graphique.
  expect(
    comptes.differentsDuRetourne,
    `le decor retourne doit etre celui de la carte normale ${JSON.stringify(comptes)}`,
  ).toBeLessThan(comptes.total / 1000);
});
