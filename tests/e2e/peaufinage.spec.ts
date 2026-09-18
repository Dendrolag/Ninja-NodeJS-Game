import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { attendreLaPartie, entrer, lancer, releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Les defauts d'affichage releves par le porteur du projet a l'etape 5.5.
 *
 * Ce sont des defauts de mise en page: seul un vrai navigateur, qui calcule les
 * polices et les largeurs, peut les voir. Chaque verification echouait avant sa
 * correction. Joue au bureau et sur telephone, sauf mention contraire.
 */

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

/**
 * La largeur qu'occupe un texte dans la police calculee d'un champ de saisie,
 * lettres espacees et majuscules comprises, comparee a la place que le champ lui
 * laisse.
 */
async function placeDuTexteIndicatif(
  page: Page,
  selecteur: string,
): Promise<{ texte: number; place: number }> {
  return page.locator(selecteur).evaluate((element) => {
    const champ = element as HTMLInputElement;
    const style = getComputedStyle(champ, '::placeholder');
    const mesure = document.createElement('span');
    mesure.textContent = champ.placeholder;
    Object.assign(mesure.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre',
      font: style.font,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
    });
    document.body.append(mesure);
    const texte = mesure.getBoundingClientRect().width;
    mesure.remove();

    const cadre = getComputedStyle(champ);
    const place =
      champ.clientWidth - parseFloat(cadre.paddingLeft) - parseFloat(cadre.paddingRight);

    return { texte, place };
  });
}

test('le champ du code prive montre son texte indicatif en entier', async ({ page }) => {
  const erreurs = releverLesErreurs(page);

  await page.goto(jeu.url);
  await page.getByRole('button', { name: 'Parcourir' }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'parties');

  // On ne lisait que « CODE PRI » avant le bouton « Joindre ».
  const { texte, place } = await placeDuTexteIndicatif(page, 'input[name="code"]');

  expect(texte).toBeLessThanOrEqual(place);
  expect(erreurs).toEqual([]);
});

/** La boite d'un element, lue dans la page. */
async function boite(page: Page, selecteur: string) {
  const cadre = await page.locator(selecteur).first().boundingBox();
  if (cadre === null) {
    throw new Error(`${selecteur} n'est pas affiche.`);
  }
  return cadre;
}

test('le HUD tient dans une seule barre en haut, au fond peu opaque', async ({ page }) => {
  // Demande du porteur du projet: le temps au centre, le classement a gauche, les
  // boutons a droite, sur une seule barre qui laisse le jeu lisible. Avant, trois
  // panneaux separes, et sur telephone le temps et le classement sous les boutons.
  const erreurs = releverLesErreurs(page);

  await entrer(page, jeu.url, 'Alice');
  await lancer(page);
  await attendreLaPartie(page);

  const fenetre = page.viewportSize();
  const barre = await boite(page, '.jeu-barre');

  expect(barre.y).toBe(0);
  expect(barre.width).toBe(fenetre?.width);

  // Le centre de chaque element tombe dans la barre.
  for (const selecteur of ['.hud-temps', '.hud-ligne.moi', '.jeu-quitter']) {
    const element = await boite(page, selecteur);
    const milieu = element.y + element.height / 2;

    expect(milieu, selecteur).toBeGreaterThan(barre.y);
    expect(milieu, selecteur).toBeLessThan(barre.y + barre.height);
  }

  // Le temps au milieu, le classement a gauche, les boutons a droite.
  const temps = await boite(page, '.hud-temps');
  const ligne = await boite(page, '.hud-ligne.moi');
  const quitter = await boite(page, '.jeu-quitter');

  expect(Math.abs(temps.x + temps.width / 2 - barre.width / 2)).toBeLessThan(2);
  expect(ligne.x + ligne.width).toBeLessThan(temps.x);
  expect(quitter.x).toBeGreaterThan(temps.x + temps.width);

  const opacite = await page
    .locator('.jeu-barre')
    .evaluate((element) =>
      Number(/[\d.]+(?=\)$)/u.exec(getComputedStyle(element).backgroundColor)?.[0]),
    );

  expect(opacite).toBeLessThanOrEqual(0.5);
  expect(erreurs).toEqual([]);
});

test('l en-tete des menus tient dans un petit telephone, compte compris', async ({ page }) => {
  // Sur telephone, le logo, le niveau, la monnaie et les pictogrammes debordaient,
  // et la page se laissait zoomer ou dezoomer. Le niveau et la monnaie d'un compte
  // sont montres de force, avec de grands nombres: le pire cas, sans base de donnees.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(jeu.url);
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('.entete-compte > *')) {
      element.toggleAttribute('hidden', element.classList.contains('entete-connexion'));
    }
    const pieces = document.querySelector('.pastille-pieces');
    pieces?.append(document.createTextNode('128 450'));
    const niveau = document.querySelector('.anneau-niveau span');
    if (niveau !== null) {
      niveau.textContent = '42';
    }
  });

  const mesure = await page.evaluate(() => {
    const entete = document.querySelector('.entete') as HTMLElement;
    const enfants = [...entete.querySelectorAll('*')]
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .map((element) => element.getBoundingClientRect());
    return {
      largeurPage: document.documentElement.scrollWidth,
      hauteur: entete.getBoundingClientRect().height,
      droite: Math.max(...enfants.map((boite) => boite.right)),
      zoom: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
    };
  });

  expect(mesure.largeurPage).toBeLessThanOrEqual(360);
  expect(mesure.droite).toBeLessThanOrEqual(360);
  expect(mesure.hauteur).toBeLessThanOrEqual(60);
  expect(mesure.zoom).toContain('user-scalable=no');
});
