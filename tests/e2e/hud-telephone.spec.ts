/**
 * La disposition du HUD sur un ecran de telephone.
 *
 * LE DEFAUT QUE CE SCENARIO FERME, releve a la recette de l'etape 5.4 sur
 * telephone: le classement, pose en haut a gauche, descendait sur le temps restant
 * des qu'il comptait plusieurs joueurs. Depuis l'etape 5.5, le temps et le classement
 * tiennent dans une meme barre en haut de l'ecran, le temps au centre: le classement
 * doit rester a sa gauche, sans le chevaucher, meme quand sa liste descend.
 *
 * La page monte la vraie surcouche du HUD avec la vraie feuille de style de la page
 * empaquetee, un classement de huit joueurs, puis mesure ou le navigateur pose les
 * deux panneaux, a plusieurs largeurs de telephone. Seul un vrai navigateur calcule
 * une disposition.
 */

import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** La page: la surcouche montee dans l'ecran de jeu, avec un classement plein. */
function pageDuHud(): string {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HUD sur telephone</title>
<link rel="stylesheet" href="/page/styles.css">
<div class="ecran ecran-jeu"><div class="zone-hud"></div></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterSurcouche } from '/paquets/client/hud/surcouche.js';

  const surcouche = monterSurcouche({
    hote: document.querySelector('.zone-hud'),
    carte: { largeur: 2000, hauteur: 1500 },
  });
  const pseudos = ['Alice', 'Bob', 'Chloe', 'David', 'Emma', 'Farid', 'Gaelle', 'Hugo'];

  surcouche.afficher({
    temps: '2:55',
    tempsRestantMs: 175000,
    urgence: false,
    enPause: false,
    pausePar: undefined,
    classement: pseudos.map((pseudo, rang) => ({
      id: 'j' + rang, pseudo, couleur: '#FF00FF', points: 20 - rang, moi: rang === 0, rang: rang + 1,
    })),
    effets: [],
    minimap: [],
    charges: undefined,
  });

  window.pret = true;
</script>`;
}

/** Un rectangle mesure par le navigateur. */
interface Boite {
  readonly haut: number;
  readonly bas: number;
  readonly gauche: number;
  readonly droite: number;
}

/** Les deux panneaux mesures. */
interface Disposition {
  readonly temps: Boite;
  readonly classement: Boite;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({ '/hud.html': pageDuHud() });
});

test.afterAll(async () => {
  await serveur.arreter();
});

// Les largeurs courantes: petit Android, iPhone, grand Android.
const TELEPHONES = [
  { largeur: 360, hauteur: 640 },
  { largeur: 390, hauteur: 664 },
  { largeur: 412, hauteur: 915 },
] as const;

test('sur telephone, le classement reste a gauche du temps restant', async ({ page }) => {
  await page.goto(`${serveur.url}/hud.html`);
  await page.waitForFunction(() => (window as unknown as { pret?: boolean }).pret, null, {
    timeout: 30_000,
  });

  for (const telephone of TELEPHONES) {
    await page.setViewportSize({ width: telephone.largeur, height: telephone.hauteur });

    const disposition = (await page.evaluate(() => {
      const boite = (selecteur: string) => {
        const rect = (document.querySelector(selecteur) as HTMLElement).getBoundingClientRect();
        return { haut: rect.top, bas: rect.bottom, gauche: rect.left, droite: rect.right };
      };
      return { temps: boite('.hud-temps'), classement: boite('.hud-classement') };
    })) as Disposition;
    const detail = `${String(telephone.largeur)} px : ${JSON.stringify(disposition)}`;

    expect(disposition.classement.bas, `le classement doit etre plein ${detail}`).toBeGreaterThan(
      disposition.classement.haut + 150,
    );
    expect(
      disposition.classement.droite,
      `le classement doit rester a gauche du temps restant ${detail}`,
    ).toBeLessThanOrEqual(disposition.temps.gauche);
    expect(
      disposition.classement.bas,
      `le classement doit tenir dans l'ecran ${detail}`,
    ).toBeLessThanOrEqual(telephone.hauteur);
  }
});
