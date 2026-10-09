/**
 * Prison Island, telle que le vrai rendu la dessine (etape 8.11).
 *
 * La page monte le vrai rendu sur Prison Island, de jour puis de nuit, charge son decor et
 * dessine une scene sans personnage, la camera posee sur la cantine. Ce que les tests
 * unitaires ne voient pas, et qu'il faut prouver dans un vrai navigateur:
 *
 *   1. LA NUIT CHANGE LE FOND. Le decor de nuit est nettement plus sombre que celui de jour.
 *   2. LA NUIT CHANGE AUSSI L'AVANT-PLAN. Les tables de la cantine passent devant les ninjas:
 *      de jour elles sont brunes, de nuit bleutees comme le reste du decor. Un avant-plan de
 *      jour pose sur un fond de nuit laisserait des tables en plein soleil.
 *   3. LE DECOR COUVRE TOUTE LA CARTE. Il est livre a 1838 sur 1337 et la carte mesure 2390
 *      sur 1738: le rendu l'agrandit, et les tables tombent la ou sont leurs murs.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/**
 * La page: Prison Island, dessinee a la demi-echelle sur 800 par 450 pixels, soit la vue de
 * 1600 par 900 pixels de carte d'un ordinateur, centree sur la cantine.
 */
function pageDeLaPrison(nuit: boolean): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Prison</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:800px;height:450px}</style>
<div class="hote" id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu } from '/paquets/client/rendu/pixi.js';

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2390, hauteur: 1738 },
    identifiantCarte: 'prison',
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

  rendu.dessiner(vide, { x: 1090, y: 790, echelle: 0.5 });
  rendu.application.render();
  const { pixels } = await Promise.resolve(
    rendu.application.renderer.extract.pixels({
      target: rendu.application.stage,
      frame: rendu.application.screen,
    }),
  );

  /** Les composantes moyennes d'un rectangle de l'ecran. */
  const couleur = (gauche, haut, droite, bas) => {
    let rouge = 0;
    let vert = 0;
    let bleu = 0;
    let comptes = 0;
    for (let y = haut; y < bas; y += 1) {
      for (let x = gauche; x < droite; x += 1) {
        const i = (y * 800 + x) * 4;
        rouge += pixels[i];
        vert += pixels[i + 1];
        bleu += pixels[i + 2];
        comptes += 1;
      }
    }
    return { rouge: rouge / comptes, vert: vert / comptes, bleu: bleu / comptes };
  };
  const luminosite = ({ rouge, vert, bleu }) => (rouge + vert + bleu) / 3;

  // La premiere rangee de tables de la cantine: de 939 a 1241 en largeur, de 770 a 811 en
  // hauteur sur la carte, soit de 324 a 475 et de 215 a 235 a l'ecran. On en prend le coeur.
  window.prison = {
    fond: luminosite(couleur(0, 0, 800, 450)),
    tables: couleur(330, 218, 470, 232),
  };
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({
    '/prison-jour.html': pageDeLaPrison(false),
    '/prison-nuit.html': pageDeLaPrison(true),
  });
});

test.afterAll(async () => {
  await serveur.arreter();
});

interface Couleur {
  readonly rouge: number;
  readonly vert: number;
  readonly bleu: number;
}

interface Releve {
  readonly fond: number;
  readonly tables: Couleur;
}

/** Charge une page de la prison et rend ce qu'elle a mesure. */
async function relever(page: Page, chemin: string): Promise<Releve> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}${chemin}`);
  await page.waitForFunction(() => (window as unknown as { prison?: unknown }).prison, null, {
    timeout: 60_000,
  });

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  return (await page.evaluate(() => (window as unknown as { prison: Releve }).prison)) as Releve;
}

test('la nuit assombrit le fond de la prison', async ({ page }) => {
  const jour = await relever(page, '/prison-jour.html');
  const nuit = await relever(page, '/prison-nuit.html');

  expect(nuit.fond, JSON.stringify({ jour: jour.fond, nuit: nuit.fond })).toBeLessThan(
    jour.fond * 0.8,
  );
});

test('les tables de la cantine sont brunes de jour et bleutees de nuit', async ({
  page,
}, infos) => {
  const jour = await relever(page, '/prison-jour.html');
  await page.locator('canvas').screenshot({ path: infos.outputPath('prison-de-jour.png') });
  const nuit = await relever(page, '/prison-nuit.html');
  await page.locator('canvas').screenshot({ path: infos.outputPath('prison-de-nuit.png') });

  // Mesure des images livrees, sur ce rectangle: rouge 60 et bleu 42 de jour, rouge 26 et
  // bleu 34 de nuit. Le bois brun du jour sur la nuit, ou la nuit absente, ferait echouer.
  expect(jour.tables.rouge - jour.tables.bleu, JSON.stringify(jour)).toBeGreaterThan(10);
  expect(nuit.tables.bleu - nuit.tables.rouge, JSON.stringify(nuit)).toBeGreaterThan(3);
});
