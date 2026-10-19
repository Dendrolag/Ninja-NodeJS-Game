/**
 * Le Labyrinthe, tel que le vrai rendu le dessine (etape 8.12).
 *
 * La page monte le vrai rendu sur le Labyrinthe, de jour puis de nuit, charge son decor et
 * dessine une scene sans personnage, la camera posee sur la grande haie de l'ouest. Ce que
 * les tests unitaires ne voient pas, et qu'il faut prouver dans un vrai navigateur:
 *
 *   1. LA NUIT CHANGE LE FOND. Le decor de nuit est nettement plus sombre que celui de jour.
 *   2. LA NUIT CHANGE AUSSI L'AVANT-PLAN. Les haies passent devant les ninjas: de jour elles
 *      sont vertes, de nuit bleutees comme le reste du decor. Un avant-plan de jour pose sur
 *      un fond de nuit laisserait des haies en plein soleil.
 *   3. LE DECOR COUVRE TOUTE LA CARTE. Il mesure 1600 sur 1164 et la carte 2400 sur 1746: le
 *      rendu l'agrandit de moitie, et les haies tombent la ou sont leurs murs.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/**
 * La page: le Labyrinthe, dessine a la demi-echelle sur 800 par 450 pixels, soit la vue de
 * 1600 par 900 pixels de carte d'un ordinateur, centree a l'ouest du dedale.
 */
function pageDuLabyrinthe(nuit: boolean): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Labyrinthe</title>
<style>html,body{margin:0;height:100%;overflow:hidden}.hote{width:800px;height:450px}</style>
<div class="hote" id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu } from '/paquets/client/rendu/pixi.js';

  const rendu = await monterRendu({
    hote: document.querySelector('#terrain'),
    carte: { largeur: 2400, hauteur: 1746 },
    identifiantCarte: 'labyrinthe',
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

  rendu.dessiner(vide, { x: 600, y: 700, echelle: 0.5 });
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

  // La grande haie de l'ouest: de 187 a 243 en largeur, de 500 a 900 en hauteur sur la
  // carte, soit de 194 a 221 et de 125 a 325 a l'ecran. On en prend le coeur.
  window.labyrinthe = {
    fond: luminosite(couleur(0, 0, 800, 450)),
    haie: couleur(196, 130, 219, 320),
  };
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({
    '/labyrinthe-jour.html': pageDuLabyrinthe(false),
    '/labyrinthe-nuit.html': pageDuLabyrinthe(true),
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
  readonly haie: Couleur;
}

/** Charge une page du labyrinthe et rend ce qu'elle a mesure. */
async function relever(page: Page, chemin: string): Promise<Releve> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${serveur.url}${chemin}`);
  await page.waitForFunction(
    () => (window as unknown as { labyrinthe?: unknown }).labyrinthe,
    null,
    {
      timeout: 60_000,
    },
  );

  expect(erreurs, 'la page ne doit lever aucune erreur').toEqual([]);

  return (await page.evaluate(
    () => (window as unknown as { labyrinthe: Releve }).labyrinthe,
  )) as Releve;
}

test('la nuit assombrit le fond du labyrinthe', async ({ page }) => {
  const jour = await relever(page, '/labyrinthe-jour.html');
  const nuit = await relever(page, '/labyrinthe-nuit.html');

  expect(nuit.fond, JSON.stringify({ jour: jour.fond, nuit: nuit.fond })).toBeLessThan(
    jour.fond * 0.8,
  );
});

test('les haies sont vertes de jour et bleutees de nuit', async ({ page }, infos) => {
  const jour = await relever(page, '/labyrinthe-jour.html');
  await page.locator('canvas').screenshot({ path: infos.outputPath('labyrinthe-de-jour.png') });
  const nuit = await relever(page, '/labyrinthe-nuit.html');
  await page.locator('canvas').screenshot({ path: infos.outputPath('labyrinthe-de-nuit.png') });

  // Mesure des images livrees, sur ce rectangle: vert 130 et bleu 78 de jour, rouge 33 et
  // bleu 60 de nuit. La haie verte du jour sur la nuit, ou la nuit absente, ferait echouer.
  expect(jour.haie.vert - jour.haie.bleu, JSON.stringify(jour)).toBeGreaterThan(25);
  expect(nuit.haie.bleu - nuit.haie.rouge, JSON.stringify(nuit)).toBeGreaterThan(10);
});
