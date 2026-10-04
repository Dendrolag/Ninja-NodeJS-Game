/**
 * La Station lunaire, telle que le vrai rendu la dessine (etape 8.9).
 *
 * La page monte le vrai rendu sur la Station lunaire, de jour puis de nuit, charge son
 * decor, et dessine une scene sans personnage, avec et sans le vaisseau, vu par une camera
 * posee a deux endroits. Ce que les tests unitaires ne voient pas, et qu'il faut prouver
 * dans un vrai navigateur:
 *
 *   1. LA NUIT CHANGE LE FOND. Le decor de nuit est nettement plus sombre que celui de jour.
 *   2. LE VAISSEAU SE DESSINE, la ou la scene le place, de jour comme de nuit.
 *   3. SON OMBRE TOMBE DE JOUR, ET DE JOUR SEULEMENT. Une bande du sol que le vaisseau ne
 *      couvre pas, du cote ou le soleil pousse l'ombre, s'assombrit de jour et reste
 *      intacte de nuit.
 *   4. IL VOLE. La camera avance de 200 pixels de carte, 100 a l'ecran: le sol recule de
 *      100, le vaisseau de plus, parce qu'il est plus pres de l'oeil.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/**
 * La page: la Station lunaire, dessinee a la demi-echelle sur 800 par 450 pixels, soit la
 * vue de 1600 par 900 pixels de carte d'un ordinateur.
 */
function pageDeLaStation(nuit: boolean): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Station</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:800px;height:450px}</style>
<div class="hote" id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu } from '/paquets/client/rendu/pixi.js';

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2000, hauteur: 1524 },
    identifiantCarte: 'station',
    modeMiroir: false,
    pluie: false,
    nuit: ${String(nuit)},
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
  // Le vaisseau au-dessus du centre de la station, cap au sud: l'image telle que livree.
  const avecVaisseau = { ...vide, vaisseau: { x: 1000, y: 760, cap: Math.PI / 2 } };

  /** Les pixels de l'ecran pour cette scene, la camera centree sur ce point de la carte. */
  const pixelsDe = async (scene, x, y) => {
    rendu.dessiner(scene, { x, y, echelle: 0.5 });
    rendu.application.render();
    const { pixels } = await Promise.resolve(
      rendu.application.renderer.extract.pixels({
        target: rendu.application.stage,
        frame: rendu.application.screen,
      }),
    );
    return Uint8ClampedArray.from(pixels);
  };

  /** La luminosite moyenne d'un rectangle de l'ecran. */
  const luminosite = (pixels, gauche, haut, droite, bas) => {
    let somme = 0;
    let comptes = 0;
    for (let y = haut; y < bas; y += 1) {
      for (let x = gauche; x < droite; x += 1) {
        const i = (y * 800 + x) * 4;
        somme += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        comptes += 1;
      }
    }
    return somme / comptes;
  };

  /** Le centre des pixels qui different entre deux images, et leur nombre. */
  const ecarts = (a, b) => {
    let nombre = 0;
    let sommeX = 0;
    let sommeY = 0;
    for (let index = 0; index < a.length; index += 4) {
      const ecart =
        Math.abs(a[index] - b[index]) +
        Math.abs(a[index + 1] - b[index + 1]) +
        Math.abs(a[index + 2] - b[index + 2]);
      if (ecart > 30) {
        const pixel = index / 4;
        nombre += 1;
        sommeX += pixel % 800;
        sommeY += Math.floor(pixel / 800);
      }
    }
    return { nombre, x: nombre === 0 ? 0 : sommeX / nombre, y: nombre === 0 ? 0 : sommeY / nombre };
  };

  const sol = await pixelsDe(vide, 1000, 760);
  const dessus = await pixelsDe(avecVaisseau, 1000, 760);
  const solDecale = await pixelsDe(vide, 1200, 760);
  const dessusDecale = await pixelsDe(avecVaisseau, 1200, 760);

  // De cap sud, la coque du vaisseau couvre a l'ecran une bande etroite, de 355 a 445 en
  // largeur sous les ailes. Son ombre, poussee vers la droite et le bas, la deborde: le
  // rectangle de 455 a 490 en largeur, de 240 a 330 en hauteur, n'a que l'ombre.
  window.station = {
    fond: luminosite(sol, 0, 0, 800, 450),
    vaisseau: ecarts(sol, dessus),
    vaisseauDecale: ecarts(solDecale, dessusDecale),
    bandeSansVaisseau: luminosite(sol, 455, 240, 490, 330),
    bandeAvecVaisseau: luminosite(dessus, 455, 240, 490, 330),
  };
  rendu.dessiner(avecVaisseau, { x: 1000, y: 760, echelle: 0.5 });
  rendu.application.render();
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({
    '/station-jour.html': pageDeLaStation(false),
    '/station-nuit.html': pageDeLaStation(true),
  });
});

test.afterAll(async () => {
  await serveur.arreter();
});

interface Ecarts {
  readonly nombre: number;
  readonly x: number;
  readonly y: number;
}

interface Releve {
  readonly fond: number;
  readonly vaisseau: Ecarts;
  readonly vaisseauDecale: Ecarts;
  readonly bandeSansVaisseau: number;
  readonly bandeAvecVaisseau: number;
}

/** Charge une page de la station et rend ce qu'elle a mesure. */
async function relever(page: Page, chemin: string): Promise<Releve> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}${chemin}`);
  await page.waitForFunction(() => (window as unknown as { station?: unknown }).station, null, {
    timeout: 60_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  return (await page.evaluate(() => (window as unknown as { station: Releve }).station)) as Releve;
}

test('la nuit assombrit le fond de la station', async ({ page }) => {
  const jour = await relever(page, '/station-jour.html');
  const nuit = await relever(page, '/station-nuit.html');

  expect(nuit.fond, JSON.stringify({ jour: jour.fond, nuit: nuit.fond })).toBeLessThan(
    jour.fond * 0.7,
  );
});

for (const [nom, chemin] of [
  ['de jour', '/station-jour.html'],
  ['de nuit', '/station-nuit.html'],
] as const) {
  test(`le vaisseau se dessine la ou la scene le place, ${nom}`, async ({ page }, infos) => {
    const releve = await relever(page, chemin);

    // Une bonne part de son image, au milieu de l'ecran, ou la camera le regarde. Le centre
    // des pixels changes s'ecarte un peu du sien: de jour, l'ombre le tire a droite; de nuit,
    // le nez sombre se confond avec le sol et le tire vers le haut.
    expect(releve.vaisseau.nombre, JSON.stringify(releve)).toBeGreaterThan(20_000);
    expect(Math.abs(releve.vaisseau.x - 400), JSON.stringify(releve)).toBeLessThan(50);
    expect(Math.abs(releve.vaisseau.y - 225), JSON.stringify(releve)).toBeLessThan(60);

    await page
      .locator('canvas')
      .screenshot({ path: infos.outputPath(`station-${nom.replace(' ', '-')}.png`) });
  });
}

test('l ombre du vaisseau tombe de jour, et pas de nuit', async ({ page }) => {
  const jour = await relever(page, '/station-jour.html');
  const nuit = await relever(page, '/station-nuit.html');

  expect(jour.bandeAvecVaisseau, JSON.stringify(jour)).toBeLessThan(jour.bandeSansVaisseau * 0.8);
  expect(nuit.bandeAvecVaisseau, JSON.stringify(nuit)).toBeCloseTo(nuit.bandeSansVaisseau, 0);
});

test('le vaisseau vole: il recule plus vite que le sol quand la camera avance', async ({
  page,
}) => {
  // De nuit, sans ombre: seuls les pixels du vaisseau changent.
  const releve = await relever(page, '/station-nuit.html');
  const recul = releve.vaisseau.x - releve.vaisseauDecale.x;

  // Le sol recule de 100 pixels d'ecran; le vaisseau, a 15 pour cent d'altitude, de 115.
  expect(recul, JSON.stringify(releve)).toBeGreaterThan(108);
  expect(recul, JSON.stringify(releve)).toBeLessThan(122);
});
