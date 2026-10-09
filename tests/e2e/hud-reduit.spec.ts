/**
 * Le HUD reduit du 9 octobre 2026, mesure dans un vrai navigateur.
 *
 * LE DEFAUT QUE CE SCENARIO FERME, releve par le porteur du projet sur un Samsung A56
 * tenu a l'horizontale: la barre du haut prenait trop de hauteur, et le bouton de capture,
 * celui de la localisation, le compteur de combo et la minimap s'empilaient a droite les uns
 * sur les autres, jusque sur le bouton « Quitter ». Le HUD complet est donc monte, avec tout
 * ce qu'une partie peut montrer a la fois, puis le navigateur dit ou il pose chaque bloc:
 * aucun ne doit en chevaucher un autre, et tous doivent tenir dans l'ecran. Joue sur des
 * telephones tenus a l'horizontale et a la verticale, et sur ordinateur.
 *
 * La page monte la vraie surcouche et les vrais boutons de la barre, avec la vraie feuille
 * de style de la page empaquetee. Seul un vrai navigateur calcule une disposition.
 */

import type { Browser } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** La page: la barre du jeu et la surcouche, avec tout ce qu'une partie peut montrer. */
function pageDuHud(): string {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HUD reduit</title>
<link rel="stylesheet" href="/page/styles.css">
<style>*, *::before, *::after { animation: none !important; }</style>
<div class="application" data-ecran="jeu">
  <section class="ecran ecran-jeu">
    <div class="terrain"></div>
    <div class="jeu-barre"></div>
    <div class="zone-hud"></div>
  </section>
</div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterSurcouche } from '/paquets/client/hud/surcouche.js';
  import { bouton, creer } from '/paquets/client/interface/dom.js';

  const ecran = document.querySelector('.ecran-jeu');
  const compteurs = creer(document, 'div', { classe: 'jeu-compteurs' });
  ecran.append(
    creer(
      document,
      'div',
      { classe: 'jeu-actions' },
      compteurs,
      bouton(document, { classe: 'bouton-icone', icone: 'son', etiquette: 'Son' }),
      bouton(document, { classe: 'bouton bouton-secondaire', texte: 'Pause', icone: 'pause' }),
      bouton(document, { classe: 'bouton bouton-danger jeu-quitter', texte: 'Quitter', icone: 'stop' }),
    ),
  );

  const rien = () => undefined;
  const surcouche = monterSurcouche({
    hote: document.querySelector('.zone-hud'),
    compteurs,
    capturer: rien,
    localiser: rien,
    utiliserLaPoche: rien,
  });
  const effet = (nature, libelle, couleur, resteS) => ({
    nature, categorie: 'bonus', libelle, couleur, resteMs: resteS * 1000, resteS,
    part: resteS / 10, finProche: false, auxAutres: false, icone: '/assets/objets/speed.png',
  });
  const pseudos = ['Rikki', 'Bob', 'Chloe', 'David', 'Emma', 'Farid'];

  surcouche.afficher({
    temps: '6:35',
    tempsRestantMs: 395000,
    urgence: false,
    enPause: false,
    pausePar: undefined,
    retourEnCours: false,
    classement: pseudos.map((pseudo, rang) => ({
      id: 'j' + rang, pseudo, couleur: '#3D7DFF', points: 470 - rang * 20,
      moi: rang === 4, rang: rang + 1, doubleur: false,
    })),
    effets: [effet('vitesse', 'Boost', 0x00ff00, 4), effet('bouclier', 'Bouclier', 0x44aaff, 7)],
    poche: { nature: 'fumee', libelle: 'Fumée', couleur: 0xb8c4d6, icone: '/assets/objets/fumee.svg' },
    radar: [
      { id: 'j4', x: 0, y: 0, couleur: '#3D7DFF', moi: true, auBord: false },
      { id: 'j1', x: 0.4, y: -0.3, couleur: '#FF2E7E', moi: false, auBord: false },
      { id: 'j2', x: -1, y: 0, couleur: '#FF2E7E', moi: false, auBord: true },
    ],
    charges: { disponibles: 3, maximum: 5, recharge: 0.4 },
    chasse: undefined,
    combo: { multiplicateur: 5, compte: '27 morts', fenetre: 0.6 },
    restants: { nombre: 120, libelle: '120 ninjas restants' },
    arme: 'charges',
  });

  window.pret = true;
</script>`;
}

/** Les blocs du HUD qui ne doivent pas se chevaucher. */
const BLOCS = {
  classement: '.hud-ligne',
  temps: '.hud-temps',
  barre: '.jeu-actions',
  radar: '.hud-radar',
  combo: '.hud-combo',
  poche: '.hud-poche',
  localiser: '.hud-localiser',
  capture: '.hud-capture',
  effets: '.hud-effets',
} as const;

/** Un rectangle mesure par le navigateur. */
interface Boite {
  readonly haut: number;
  readonly bas: number;
  readonly gauche: number;
  readonly droite: number;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({ '/hud.html': pageDuHud() });
});

test.afterAll(async () => {
  await serveur.arreter();
});

/** Ouvre la page dans un nouvel appareil et mesure chaque bloc, nom du bouton compris. */
async function mesurer(
  browser: Browser,
  appareil: { largeur: number; hauteur: number; tactile: boolean },
  capture: string,
): Promise<Record<string, readonly Boite[]>> {
  const contexte = await browser.newContext({
    viewport: { width: appareil.largeur, height: appareil.hauteur },
    hasTouch: appareil.tactile,
    isMobile: appareil.tactile,
  });
  const page = await contexte.newPage();

  await page.goto(`${serveur.url}/hud.html`);
  await page.waitForFunction(() => (window as unknown as { pret?: boolean }).pret, null, {
    timeout: 30_000,
  });

  const boites = (await page.evaluate((blocs) => {
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right };
    };
    const resultat: Record<string, unknown[]> = {};
    for (const [nom, selecteur] of Object.entries(blocs)) {
      resultat[nom] = Array.from(document.querySelectorAll(selecteur))
        .filter((element) => (element as HTMLElement).offsetParent !== null)
        .map((element) => {
          // Un bouton d'action et son nom, ecrit dessous, forment un seul bloc.
          const boite = rect(element);
          const libelle = element.querySelector('.hud-bouton-libelle');
          if (libelle === null) {
            return boite;
          }
          const sous = rect(libelle);
          return {
            haut: Math.min(boite.haut, sous.haut),
            bas: Math.max(boite.bas, sous.bas),
            gauche: Math.min(boite.gauche, sous.gauche),
            droite: Math.max(boite.droite, sous.droite),
          };
        });
    }
    return resultat;
  }, BLOCS)) as Record<string, readonly Boite[]>;

  await page.screenshot({ path: capture });
  await contexte.close();

  return boites;
}

/** Deux rectangles se chevauchent. */
function chevauchent(a: Boite, b: Boite): boolean {
  return a.gauche < b.droite && b.gauche < a.droite && a.haut < b.bas && b.haut < a.bas;
}

const APPAREILS = [
  // Le Samsung A56 du porteur du projet, tenu a l'horizontale, barre du navigateur comprise.
  { nom: 'telephone en paysage', largeur: 800, hauteur: 360, tactile: true },
  { nom: 'petit telephone en paysage', largeur: 640, hauteur: 320, tactile: true },
  // Le meme telephone, et un petit, tenus a la verticale.
  { nom: 'telephone a la verticale', largeur: 412, hauteur: 780, tactile: true },
  { nom: 'petit telephone a la verticale', largeur: 360, hauteur: 640, tactile: true },
  { nom: 'ordinateur', largeur: 1280, hauteur: 720, tactile: false },
] as const;

for (const appareil of APPAREILS) {
  test(`sur ${appareil.nom}, aucun bloc du HUD n en chevauche un autre`, async ({
    browser,
  }, infos) => {
    const boites = await mesurer(
      browser,
      appareil,
      infos.outputPath(`hud-${String(appareil.largeur)}.png`),
    );
    const detail = JSON.stringify(boites);
    const blocs = Object.entries(boites).flatMap(([nom, liste]) =>
      liste.map((boite) => ({ nom, boite })),
    );

    // Le bouton de la poche ne se montre que sur un ecran tactile.
    expect(boites['poche'] ?? [], detail).toHaveLength(appareil.tactile ? 1 : 0);
    for (const nom of ['classement', 'temps', 'barre', 'radar', 'combo', 'localiser', 'capture']) {
      expect(boites[nom]?.length ?? 0, `${nom} doit etre affiche ${detail}`).toBeGreaterThan(0);
    }

    for (const { nom, boite } of blocs) {
      expect(boite.gauche, `${nom} sort a gauche ${detail}`).toBeGreaterThanOrEqual(0);
      expect(boite.haut, `${nom} sort en haut ${detail}`).toBeGreaterThanOrEqual(0);
      expect(boite.droite, `${nom} sort a droite ${detail}`).toBeLessThanOrEqual(appareil.largeur);
      expect(boite.bas, `${nom} sort en bas ${detail}`).toBeLessThanOrEqual(appareil.hauteur);
    }

    blocs.forEach((premier, rang) => {
      for (const second of blocs.slice(rang + 1)) {
        if (premier.nom === second.nom) {
          continue;
        }
        expect(
          chevauchent(premier.boite, second.boite),
          `${premier.nom} chevauche ${second.nom} ${detail}`,
        ).toBe(false);
      }
    });
  });
}

test('sur telephone, la barre du haut tient en moins de quarante pixels', async ({
  browser,
}, infos) => {
  const boites = await mesurer(
    browser,
    { largeur: 800, hauteur: 360, tactile: true },
    infos.outputPath('barre.png'),
  );
  const barre = boites['barre']?.[0];

  expect(barre?.bas ?? Infinity).toBeLessThanOrEqual(40);
});
