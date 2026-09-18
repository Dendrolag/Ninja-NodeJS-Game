import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { releverLesErreurs } from './harnais/parcours.js';
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
