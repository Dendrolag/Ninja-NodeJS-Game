import type { BrowserContextOptions, Page } from '@playwright/test';
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
 * Le mode Chasse de l'etape 7.3, joue dans la page par deux joueurs.
 *
 * Alice cree une partie Chasse sur un ordinateur, Bob la rejoint depuis un telephone.
 *
 * CE QUI EST VERIFIE, DANS L'ORDRE DU PARCOURS.
 *
 *   1. Seule, Alice ne peut pas lancer: le salon dit qu'il faut deux joueurs.
 *   2. Bob arrive, et « Lancer la partie » apparait chez Alice.
 *   3. En jeu, chacun lit son role: un traqueur et une proie. Le traqueur a le bouton de
 *      capture, avec ses trois vies; la proie ne l'a pas.
 *   4. A la fin, le classement et le podium sont ceux du Classique, aux points.
 *
 * UN SEUL CADRAGE, comme la partie Equipes: ce scenario fabrique lui-meme son ordinateur
 * et son telephone.
 *
 * UNE PARTIE COURTE ET CALME. Personne ne tire: ce qui est verifie, ce sont les ecrans du
 * mode. Les regles du tir sont verifiees par les tests du moteur et du serveur.
 */

/** Une partie courte, le temps de voir le HUD et l'ecran de fin. */
const PARTIE_CHASSE = {
  dureePartieS: '30',
  nombreBotsInitial: '40',
  'zones.actives': false,
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

/** Le role lu dans le bandeau du HUD. */
async function roleDe(page: Page): Promise<string> {
  const role = page.locator('.hud-chasse-role');
  await expect(role).toHaveText(/^(Traqueur|Proie)$/u);

  return (await role.textContent()) ?? '';
}

test('creer une partie Chasse, la lancer a deux et lire son role', async ({ browser }) => {
  // Deux chargements de carte, une partie de trente secondes et son compte a rebours.
  test.setTimeout(180_000);

  const ordinateur = await browser.newContext(devices['Desktop Chrome']);
  const telephone = await browser.newContext(TELEPHONE_DE_BOB);
  const alice = await ordinateur.newPage();
  const bob = await telephone.newPage();
  const erreursDAlice = releverLesErreurs(alice);
  const erreursDeBob = releverLesErreurs(bob);

  try {
    // -- Alice cree la partie, et ne peut pas la lancer seule -----------------
    await alice.goto(jeu.url);
    await alice.getByPlaceholder('Votre pseudo').fill('Alice');
    await alice.getByRole('button', { name: 'Créer une partie' }).click();
    await alice.locator('label.tuile-choix[data-mode="chasse"]').click();
    await expect(alice.locator('.creation-recapitulatif h2')).toHaveText(/^Chasse · /u);
    await expect(alice.locator('.creation-recapitulatif')).toContainText('10 joueurs');
    await alice.getByRole('button', { name: 'Créer le salon' }).click();

    await expect(alice.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeHidden();
    await expect(alice.locator('.salon-consigne')).toHaveText(
      'Il faut au moins deux joueurs pour lancer une chasse.',
    );

    // -- Bob arrive par la partie rapide ---------------------------------------
    await entrer(bob, jeu.url, 'Bob');
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeVisible();

    // -- La partie ---------------------------------------------------------------
    await regler(alice, PARTIE_CHASSE);
    await lancer(alice);
    await Promise.all([attendreLaPartie(alice), attendreLaPartie(bob)]);

    expect(jeu.partie().mode).toBe('chasse');

    const roles = [await roleDe(alice), await roleDe(bob)];
    expect([...roles].sort()).toEqual(['Proie', 'Traqueur']);

    const [traqueur, proie] = roles[0] === 'Traqueur' ? [alice, bob] : [bob, alice];
    await expect(traqueur.locator('.hud-capture')).toBeVisible();
    await expect(traqueur.locator('.hud-capture')).toHaveAttribute(
      'aria-label',
      'Capturer, 3 vies sur 3',
    );
    await expect(proie.locator('.hud-capture')).toBeHidden();
    await expect(proie.locator('.hud-chasse-proies')).toHaveText('1 proie restante');

    // -- La fin: classement et podium du Classique -------------------------------
    await Promise.all([attendreLaFin(alice), attendreLaFin(bob)]);

    for (const page of [alice, bob]) {
      await expect(page.locator('.podium')).toBeVisible();
      await expect(page.locator('.fin-classement tbody tr')).toHaveCount(2);
      await expect(page.locator('.fin-contexte')).toContainText('Chasse');
    }

    expect(erreursDAlice).toEqual([]);
    expect(erreursDeBob).toEqual([]);
  } finally {
    await ordinateur.close();
    await telephone.close();
  }
});
