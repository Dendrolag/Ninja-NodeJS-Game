import type { Browser, Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';

import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Creer et rejoindre des parties depuis la page: le scenario des parties de la
 * reprise des ecrans du jalon 3.
 *
 * Deux joueurs, chacun dans son contexte de navigateur, comme deux personnes sur
 * deux ordinateurs. Aucune partie n'est lancee: ce qui est eprouve ici, c'est le
 * chemin qui mene au meme salon, par un code ou par la liste.
 *
 *   1. Alice cree une partie privee sur Spirit & Time; son salon montre le code.
 *      Bob ne la voit pas dans la liste, et la rejoint en tapant ce code, en
 *      minuscules. Les deux salons sont identiques, code compris.
 *   2. Alice cree une partie publique; Bob la trouve dans la liste, et la rejoint.
 *
 * UN SEUL CADRAGE: le scenario fabrique lui-meme ses deux appareils. Voir
 * playwright.config.ts.
 */

/** Un joueur et son navigateur. */
interface Appareil {
  readonly page: Page;
  readonly erreurs: readonly string[];
  fermer(): Promise<void>;
}

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** Ouvre un navigateur d'ordinateur, dont les erreurs de console sont relevees. */
async function ouvrir(browser: Browser): Promise<Appareil> {
  const contexte = await browser.newContext(devices['Desktop Chrome']);
  const page = await contexte.newPage();

  return {
    page,
    erreurs: releverLesErreurs(page),
    fermer: async () => contexte.close(),
  };
}

/** Ouvre le jeu et choisit un pseudo d'invite. */
async function arriver(page: Page, pseudo: string): Promise<void> {
  await page.goto(jeu.url);
  await page.getByPlaceholder('Votre pseudo').fill(pseudo);
}

/** Cree une partie depuis l'ecran de creation, et attend son salon. */
async function creer(page: Page, visibilite: 'publique' | 'privee', carte: string): Promise<void> {
  await page.getByRole('button', { name: 'Créer une partie' }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'creation');
  await page.locator(`label.tuile-choix[data-visibilite="${visibilite}"]`).click();
  // Le nom exact: « Tokyo » est aussi dans « Rainy Tokyo ».
  await page
    .locator('label.carte-choix', {
      has: page.locator('.carte-nom').getByText(carte, { exact: true }),
    })
    .click();
  await page.getByRole('button', { name: 'Créer le salon' }).click();
  await expect(page.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
}

test('une partie privee creee par Alice, rejointe par Bob avec son code', async ({ browser }) => {
  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);

  try {
    await arriver(alice.page, 'Alice');
    await creer(alice.page, 'privee', 'Spirit & Time');

    const code = (await alice.page.locator('.salon-code-valeur').textContent()) ?? '';
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/u);

    await arriver(bob.page, 'Bob');
    await bob.page.getByRole('button', { name: 'Parcourir' }).click();

    // Une partie privee n'est jamais listee.
    await expect(bob.page.locator('.parties-vide')).toBeVisible();

    await bob.page.locator('input[name="code"]').fill(code.toLowerCase());
    await bob.page.getByRole('button', { name: 'Joindre' }).click();

    for (const { page } of [alice, bob]) {
      await expect(page.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
      await expect(page.locator('.carte-joueur')).toHaveCount(2);
      await expect(page.locator('.badge-visibilite')).toHaveText('Partie privée');
      await expect(page.locator('.salon-code-valeur')).toHaveText(code);
      await expect(page.locator('.recapitulatif')).toContainText('Spirit & Time');
    }

    // Les deux joueurs sont dans la seule partie du serveur.
    expect(jeu.partie().joueurs).toHaveLength(2);
    expect([...alice.erreurs, ...bob.erreurs]).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});

test('une partie publique trouvee dans la liste, et rejointe', async ({ browser }) => {
  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);

  try {
    await arriver(alice.page, 'Alice');
    await creer(alice.page, 'publique', 'Tokyo');

    await arriver(bob.page, 'Bob');
    await bob.page.getByRole('button', { name: 'Parcourir' }).click();

    const salon = bob.page.locator('.partie', { hasText: 'Salon de Alice' });
    await expect(salon).toContainText('Classique · Tokyo');
    await expect(salon.locator('.partie-joueurs')).toHaveText('1/12');

    await bob.page.getByRole('button', { name: 'Rejoindre le salon de Alice' }).click();

    for (const { page } of [alice, bob]) {
      await expect(page.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
      await expect(page.locator('.carte-joueur')).toHaveCount(2);
      await expect(page.locator('.badge-visibilite')).toHaveText('Partie publique');
      await expect(page.locator('.salon-code')).toBeHidden();
    }

    expect([...alice.erreurs, ...bob.erreurs]).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});
