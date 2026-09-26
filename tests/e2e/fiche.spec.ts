import type { Browser, Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';

import type { ComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import { creerComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import {
  attendreLaFin,
  attendreLaPartie,
  lancer,
  regler,
  releverLesErreurs,
} from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * La fiche d'un joueur (etape 3.5), ouverte depuis le classement de fin.
 *
 * Alice et Bob s'inscrivent chacun depuis sa page, entrent dans la meme partie par la
 * partie rapide, et la jouent jusqu'a la fin. Au classement, Alice ouvre la fiche de
 * Bob d'un clic sur son pseudo, et y lit la partie qu'ils viennent de jouer: la fiche
 * se lit apres l'enregistrement de la partie, par la route du serveur.
 *
 * LE SERVEUR A DES COMPTES EN MEMOIRE (tests/outils/comptes-en-memoire.ts), comme le
 * scenario du compte: ce qui est eprouve ici, c'est le chemin de la page au serveur.
 * Les agregats eux-memes sont eprouves contre Neon, dans tests/base/fiche.test.ts.
 *
 * UN SEUL CADRAGE: une partie entiere a deux, que le cadrage mobile rejouerait sans
 * rien verifier de plus. Voir playwright.config.ts.
 */

/** Une partie a deux, la plus courte que le serveur accepte. */
const PARTIE_COURTE = { dureePartieS: '30' } as const;

const MOT_DE_PASSE = 'correct cheval pile agrafe';

let jeu: ServeurDeJeu;
let comptes: ComptesEnMemoire;

test.beforeEach(async () => {
  comptes = creerComptesEnMemoire();
  jeu = await demarrerLeJeu({ comptes });
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** Ouvre une page dans un contexte a elle, comme un second appareil. */
async function ouvrir(browser: Browser): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext(devices['Desktop Chrome']);

  return { page: await contexte.newPage(), fermer: async () => contexte.close() };
}

/**
 * Cree un compte depuis la page, note le code de secours que l'inscription remet, et
 * attend l'accueil sous son pseudo.
 */
async function inscrire(page: Page, url: string, pseudo: string): Promise<void> {
  await page.goto(url);
  await page.locator('.entete-connexion').click();
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page
    .locator('.connexion-formulaire')
    .getByRole('button', { name: 'Créer le compte' })
    .click();
  await page.getByRole('button', { name: 'J’ai noté mon code' }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'accueil');
  await expect(page.locator('.carte-compte-pseudo')).toHaveText(pseudo);
}

test('ouvrir la fiche d un autre compte depuis le classement de fin', async ({ browser }) => {
  // Deux chargements de carte, une partie de trente secondes et son compte a rebours.
  test.setTimeout(180_000);

  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);
  const erreurs = [releverLesErreurs(alice.page), releverLesErreurs(bob.page)];

  try {
    // -- Deux comptes, une meme partie -------------------------------------------
    await inscrire(alice.page, jeu.url, 'Alice');
    await inscrire(bob.page, jeu.url, 'Bob');

    await alice.page.getByRole('button', { name: 'Partie rapide' }).click();
    await expect(alice.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await bob.page.getByRole('button', { name: 'Partie rapide' }).click();
    await expect(bob.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await expect(alice.page.locator('.carte-joueur')).toHaveCount(2);

    // Au salon deja, le pseudo de Bob ouvre sa fiche.
    await expect(alice.page.getByRole('button', { name: 'Bob, voir sa fiche' })).toBeVisible();

    await regler(alice.page, PARTIE_COURTE);
    await lancer(alice.page);
    await attendreLaPartie(alice.page);
    await attendreLaFin(alice.page);
    await attendreLaFin(bob.page);

    // La fiche se lit apres l'enregistrement: le recapitulatif de fin le confirme.
    await expect(alice.page.locator('.fin-progression .fin-xp')).toBeVisible({ timeout: 15_000 });
    expect(comptes.fins).toHaveLength(1);

    // -- La fiche de Bob, depuis le classement -----------------------------------
    await alice.page
      .locator('.fin-classement')
      .getByRole('button', { name: 'Bob, voir sa fiche' })
      .click();

    const fiche = alice.page.getByRole('dialog', { name: 'Fiche du joueur' });
    await expect(fiche).toBeVisible();
    await expect(fiche.locator('.fiche-pseudo')).toHaveText('Bob');
    await expect(fiche.locator('.fiche-inscription')).toContainText('Membre depuis le');
    await expect(
      fiche.locator('.statistique', { hasText: 'Parties jouées' }).locator('strong'),
    ).toHaveText('1');
    await expect(
      fiche.locator('.statistique', { hasText: 'Mode préféré' }).locator('strong'),
    ).toHaveText('Horde');
    await expect(fiche.locator('.tableau-par-mode tbody tr')).toHaveCount(1);
    await expect(fiche.locator('.tableau-par-mode tbody th')).toHaveText('Horde');
    // Ce que la fiche ne montre jamais d'un autre.
    await expect(fiche).not.toContainText('Pièces');
    await expect(fiche).not.toContainText('Dernières parties');

    await fiche.locator('.fenetre-pied').getByRole('button', { name: 'Fermer' }).click();
    await expect(fiche).toBeHidden();
    await expect(alice.page.locator('.application')).toHaveAttribute('data-ecran', 'fin');

    expect(erreurs.flat()).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});
