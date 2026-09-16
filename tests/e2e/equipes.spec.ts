import type { BrowserContextOptions, Locator, Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';

import {
  attendreLaFin,
  attendreLaPartie,
  entrer,
  lancer,
  regler,
  releverLesErreurs,
} from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le mode Equipes de l'etape 7.2, joue dans la page par deux joueurs.
 *
 * Alice cree une partie Equipes sur un ordinateur, Bob la rejoint depuis un telephone.
 *
 * CE QUI EST VERIFIE, DANS L'ORDRE DU PARCOURS.
 *
 *   1. Le salon range les joueurs dans deux colonnes, une par equipe: Alice arrive en
 *      Cyan, Bob dans l'equipe la moins nombreuse, donc en Magenta.
 *   2. Seule Alice, hote, voit « Lancer la partie », et pas tant qu'une equipe est
 *      vide: le salon dit alors pourquoi, des deux cotes.
 *   3. Bob change d'equipe depuis sa page, et les deux salons le montrent.
 *   4. En jeu, le classement du HUD classe les equipes et non les joueurs.
 *   5. A la fin, les deux pages montrent le score des deux equipes.
 *
 * UN SEUL CADRAGE, comme la partie a deux joueurs: ce scenario fabrique lui-meme son
 * ordinateur et son telephone, et le salon de Bob est lu sur un telephone. Le rejouer
 * dans le projet mobile doublerait sa duree sans rien verifier de plus.
 *
 * UNE PARTIE COURTE ET CALME. Personne n'a besoin de se toucher ici: ce qui est
 * verifie, ce sont les ecrans du mode. Les Black Ninjas et les zones sont coupes, pour
 * que le classement des equipes ne bouge que par ce que les joueurs font.
 */

/** Une partie courte, le temps de voir le HUD et l'ecran de fin. */
const PARTIE_EQUIPES = {
  dureePartieS: '30',
  nombreBotsInitial: '40',
  'zones.actives': false,
  'botsNoirs.actifs': false,
} as const;

/** Le telephone de Bob, a la densite de un: voir multijoueur.spec.ts. */
const TELEPHONE_DE_BOB: BrowserContextOptions = { ...devices['Pixel 7'], deviceScaleFactor: 1 };

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** La colonne d'une equipe dans le salon. */
function colonne(page: Page, equipe: 'cyan' | 'magenta'): Locator {
  return page.locator(`[data-equipe="${equipe}"]`);
}

test('creer une partie Equipes, y changer d equipe, la jouer et lire le score des equipes', async ({
  browser,
}) => {
  // Deux chargements de carte, une partie de trente secondes et son compte a rebours.
  test.setTimeout(180_000);

  const ordinateur = await browser.newContext(devices['Desktop Chrome']);
  const telephone = await browser.newContext(TELEPHONE_DE_BOB);
  const alice = await ordinateur.newPage();
  const bob = await telephone.newPage();
  const erreursDAlice = releverLesErreurs(alice);
  const erreursDeBob = releverLesErreurs(bob);

  try {
    // -- Alice cree la partie, et se trouve seule dans son equipe ----------------
    await alice.goto(jeu.url);
    await alice.getByPlaceholder('Votre pseudo').fill('Alice');
    await alice.getByRole('button', { name: 'Créer une partie' }).click();
    await alice.locator('label.tuile-choix[data-mode="equipes"]').click();
    await expect(alice.locator('.creation-recapitulatif h2')).toHaveText(/^Équipes · /u);
    await alice.getByRole('button', { name: 'Créer le salon' }).click();

    await expect(alice.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
    await expect(colonne(alice, 'cyan')).toContainText('Alice');
    await expect(colonne(alice, 'cyan')).toContainText('Votre équipe');
    await expect(colonne(alice, 'magenta')).toContainText('0 / 6');
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeHidden();
    await expect(alice.locator('.salon-consigne')).toHaveText(
      'Il faut au moins un joueur dans chaque équipe pour lancer la partie.',
    );

    // -- Bob arrive par la partie rapide, dans l'equipe la moins nombreuse -------
    await entrer(bob, jeu.url, 'Bob');

    for (const page of [alice, bob]) {
      await expect(colonne(page, 'cyan')).toContainText('Alice');
      await expect(colonne(page, 'magenta')).toContainText('Bob');
      await expect(colonne(page, 'cyan')).toContainText('1 / 6');
    }
    // Le salon de Bob se lit sur son telephone: ses deux colonnes y sont visibles.
    await expect(colonne(bob, 'cyan')).toBeVisible();
    await expect(colonne(bob, 'magenta')).toBeVisible();
    await expect(bob.getByRole('button', { name: 'Lancer la partie' })).toBeHidden();
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeVisible();

    // -- Bob passe en Cyan: plus personne en Magenta, donc plus de lancement -----
    await colonne(bob, 'cyan').getByRole('button').click();

    await expect(colonne(alice, 'cyan')).toContainText('2 / 6');
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeHidden();
    await expect(bob.locator('.salon-consigne')).toContainText('au moins un joueur dans chaque');

    await colonne(bob, 'magenta').getByRole('button').click();
    await expect(colonne(alice, 'magenta')).toContainText('Bob');
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeVisible();

    // -- La partie ---------------------------------------------------------------
    await regler(alice, PARTIE_EQUIPES);
    await lancer(alice);
    await Promise.all([attendreLaPartie(alice), attendreLaPartie(bob)]);

    expect(jeu.partie().mode).toBe('equipes');

    for (const page of [alice, bob]) {
      // Le HUD classe les equipes, et non les joueurs.
      await expect(page.locator('.hud-classement')).toContainText('Équipe Cyan');
      await expect(page.locator('.hud-classement')).toContainText('Équipe Magenta');
      await expect(page.locator('.hud-classement')).not.toContainText('Alice');
    }

    // -- La fin, qui montre le score des deux equipes ----------------------------
    await Promise.all([attendreLaFin(alice), attendreLaFin(bob)]);

    for (const page of [alice, bob]) {
      await expect(page.locator('.fin-equipe')).toHaveCount(2);
      await expect(page.locator('.podium')).toBeHidden();
      await expect(page.locator('.fin-titre')).toContainText(/équipe|Égalité/u);
    }

    expect(erreursDAlice).toEqual([]);
    expect(erreursDeBob).toEqual([]);
  } finally {
    await ordinateur.close();
    await telephone.close();
  }
});
