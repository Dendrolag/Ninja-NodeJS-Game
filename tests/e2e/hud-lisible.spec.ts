/**
 * Le HUD lisible de l'etape 4.6, mesure dans un vrai navigateur.
 *
 * Sur ordinateur, le score, les effets en cours et l'annonce d'un objet etaient
 * minuscules. L'etape les agrandit: un grand titre au centre de l'ecran pour l'annonce
 * d'un objet, des cartes a jauge pour les effets, notre ligne du classement detachee.
 * Sur un ecran tactile, le HUD garde a peu pres ses tailles d'avant, pour ne pas couvrir
 * le terrain.
 *
 * La page monte la vraie surcouche et le vrai fil d'annonces, avec la vraie feuille de
 * style empaquetee, puis mesure ce que le navigateur en fait. Seul un vrai navigateur
 * calcule une taille de police effective et une disposition. Les animations sont
 * suspendues, pour mesurer le grand titre a sa taille pleine.
 */

import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** La page: la surcouche et le fil d'annonces montes dans l'ecran de jeu. */
function pageDuHud(): string {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HUD lisible</title>
<link rel="stylesheet" href="/page/styles.css">
<style>*, *::before, *::after { animation-play-state: paused !important; }</style>
<div class="application" data-ecran="jeu"><div class="ecran ecran-jeu"><div class="zone-hud"></div></div></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterSurcouche } from '/paquets/client/hud/surcouche.js';
  import { monterFilDAnnonces } from '/paquets/client/interface/composants/annonces.js';

  const surcouche = monterSurcouche({
    hote: document.querySelector('.zone-hud'),
    carte: { largeur: 2000, hauteur: 1500 },
  });
  const effet = (nature, categorie, libelle, couleur, resteS) => ({
    nature, categorie, libelle, couleur, resteMs: resteS * 1000, resteS,
    part: resteS / 10, finProche: false, auxAutres: false,
    icone: '/assets/objets/speed.png',
  });

  surcouche.afficher({
    temps: '2:55',
    tempsRestantMs: 175000,
    urgence: false,
    enPause: false,
    pausePar: undefined,
    retourEnCours: false,
    classement: ['Alice', 'Bob', 'Chloe'].map((pseudo, rang) => ({
      id: 'j' + rang, pseudo, couleur: '#FF00FF', points: 20 - rang, moi: rang === 0, rang: rang + 1,
    })),
    effets: [effet('vitesse', 'bonus', 'Boost', 0x00ff00, 4), effet('flou', 'malus', 'Vision floue', 0x44aaff, 7)],
    minimap: [],
    portee: undefined,
    charges: undefined,
    chasse: undefined,
    combo: undefined,
    arme: 'charges',
  });

  const fil = monterFilDAnnonces(document);
  document.querySelector('.application').append(fil.racine);
  fil.ajouter({
    texte: 'Bonus : Boost',
    ton: 'succes',
    grandTitre: {
      surtitre: 'Bonus', titre: 'Boost', ligne: 'Vitesse x1,7 pendant 10 s',
      couleur: 0x00ff00, icone: '/assets/objets/speed.png', brouille: false,
    },
  });

  window.pret = true;
</script>`;
}

/** Ce que le navigateur a fait des elements mesures. */
interface Mesures {
  readonly largeurDeCarte: number;
  readonly policeDuReste: number;
  readonly policeDeNosPoints: number;
  readonly policeDuTitre: number;
  readonly centreDuTitre: { readonly x: number; readonly y: number };
  readonly fenetre: { readonly largeur: number; readonly hauteur: number };
  readonly couleurDuTitre: string;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({ '/hud.html': pageDuHud() });
});

test.afterAll(async () => {
  await serveur.arreter();
});

test('le HUD grandit sur ordinateur et reste compact sur ecran tactile', async ({
  page,
  hasTouch,
}) => {
  await page.goto(`${serveur.url}/hud.html`);
  await page.waitForFunction(() => (window as unknown as { pret?: boolean }).pret, null, {
    timeout: 30_000,
  });

  const mesures = (await page.evaluate(() => {
    const element = (selecteur: string): HTMLElement =>
      document.querySelector(selecteur) as HTMLElement;
    const police = (selecteur: string): number =>
      Number.parseFloat(getComputedStyle(element(selecteur)).fontSize);
    const titre = element('.grand-titre-titre').getBoundingClientRect();

    return {
      largeurDeCarte: element('.hud-effet').getBoundingClientRect().width,
      policeDuReste: police('.hud-effet-reste'),
      policeDeNosPoints: police('.hud-ligne.moi .hud-points'),
      policeDuTitre: police('.grand-titre-titre'),
      centreDuTitre: { x: titre.left + titre.width / 2, y: titre.top + titre.height / 2 },
      fenetre: { largeur: innerWidth, hauteur: innerHeight },
      couleurDuTitre: getComputedStyle(element('.grand-titre-icone')).backgroundColor,
    };
  })) as Mesures;
  const detail = JSON.stringify(mesures);

  // Le grand titre, au centre et au-dessus du milieu, a la couleur de l'objet.
  expect(Math.abs(mesures.centreDuTitre.x - mesures.fenetre.largeur / 2), detail).toBeLessThan(4);
  expect(mesures.centreDuTitre.y, detail).toBeLessThan(mesures.fenetre.hauteur / 2);
  expect(mesures.couleurDuTitre, detail).toBe('rgb(0, 255, 0)');

  if (hasTouch) {
    expect(mesures.largeurDeCarte, detail).toBeLessThanOrEqual(210);
    expect(mesures.policeDuTitre, detail).toBeLessThanOrEqual(30);
    expect(mesures.policeDeNosPoints, detail).toBeLessThanOrEqual(16);
  } else {
    expect(mesures.largeurDeCarte, detail).toBeGreaterThanOrEqual(270);
    expect(mesures.policeDuReste, detail).toBeGreaterThanOrEqual(20);
    expect(mesures.policeDeNosPoints, detail).toBeGreaterThanOrEqual(22);
    expect(mesures.policeDuTitre, detail).toBeGreaterThanOrEqual(50);
  }
});
