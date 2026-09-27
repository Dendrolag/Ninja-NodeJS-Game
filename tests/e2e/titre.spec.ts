import type { Browser, Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';

import type { ComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import { creerComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le titre (etape 3.9): un compte le choisit depuis son profil, parmi ses succes obtenus,
 * puis un autre joueur le lit sous son pseudo, au salon et sur sa fiche.
 *
 * Deux navigateurs, comme deux appareils. Alice choisit « Centurion » dans la liste de
 * son profil, entre par la partie rapide, et Bob, entre apres elle, lit son titre sur sa
 * carte du salon et sur sa fiche. Aucune erreur ne doit apparaitre dans la console.
 *
 * LE SERVEUR A DES COMPTES EN MEMOIRE (tests/outils/comptes-en-memoire.ts), qui
 * appliquent la meme regle: un titre n'est qu'un succes obtenu. Le succes d'Alice lui est
 * accorde directement, comme par le rattrapage: gagner un succes en jouant est eprouve
 * par le scenario des comptes. La cle etrangere qui garde la regle en base est eprouvee
 * contre Neon, dans tests/base/titres.test.ts.
 *
 * UN SEUL CADRAGE: le cadrage mobile rejouerait les memes gestes sans rien verifier de
 * plus. Voir playwright.config.ts.
 */

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

test('choisir un titre au profil, puis le voir lu au salon par un autre joueur', async ({
  browser,
}) => {
  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);
  const erreurs = [releverLesErreurs(alice.page), releverLesErreurs(bob.page)];

  try {
    await inscrire(alice.page, jeu.url, 'Alice');
    await inscrire(bob.page, jeu.url, 'Bob');
    comptes.accorderUnSucces('Alice', 'premier-pas');
    comptes.accorderUnSucces('Alice', 'centurion');

    // -- Alice choisit son titre au profil ---------------------------------------------
    await alice.page.locator('.carte-compte').click();
    await expect(alice.page.locator('.application')).toHaveAttribute('data-ecran', 'profil');

    const liste = alice.page.getByLabel('Titre');
    await expect(liste.locator('option')).toHaveText(['Aucun', 'Premier pas', 'Centurion']);
    await expect(alice.page.locator('.profil-titre')).toBeHidden();

    await liste.selectOption({ label: 'Centurion' });

    await expect(alice.page.locator('.profil-titre')).toHaveText('Centurion');
    await expect(liste).toBeEnabled();
    expect(comptes.compteNomme('Alice')?.titre).toBe('centurion');

    // -- Au salon, Bob lit le titre d'Alice sous son pseudo ------------------------------
    const navigation = alice.page.getByRole('navigation', { name: 'Navigation principale' });
    await navigation.getByRole('button', { name: /^Jouer/u }).click();
    await expect(alice.page.locator('.application')).toHaveAttribute('data-ecran', 'accueil');
    await alice.page.getByRole('button', { name: 'Partie rapide' }).click();
    await expect(alice.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await bob.page.getByRole('button', { name: 'Partie rapide' }).click();
    await expect(bob.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await expect(bob.page.locator('.carte-joueur')).toHaveCount(2);

    const carteDAlice = bob.page.locator('.carte-joueur', { hasText: 'Alice' });
    await expect(carteDAlice.locator('.carte-joueur-titre')).toHaveText('Centurion');
    await expect(carteDAlice.locator('.carte-joueur-titre')).toHaveAttribute(
      'data-palier',
      'legende',
    );
    // Bob n'a pas de titre: sa carte n'en montre aucun.
    await expect(
      alice.page.locator('.carte-joueur', { hasText: 'Bob' }).locator('.carte-joueur-titre'),
    ).toHaveCount(0);

    // -- Et sur la fiche d'Alice ---------------------------------------------------------
    await bob.page.getByRole('button', { name: 'Alice, voir sa fiche' }).click();
    const fiche = bob.page.getByRole('dialog', { name: 'Fiche du joueur' });
    await expect(fiche.locator('.fiche-titre')).toHaveText('Centurion');

    expect(erreurs.flat()).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});
