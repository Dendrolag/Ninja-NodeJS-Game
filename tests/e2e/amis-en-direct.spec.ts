import type { Browser, Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';

import type { ComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import { creerComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Les amis en direct (etape 2.8), de bout en bout.
 *
 * Deux scenarios. D'abord tout ce qui arrive sans naviguer: Alice demande Bob, et la
 * pastille de Bob s'allume sur l'accueil. Bob accepte, et Alice le voit apparaitre
 * parmi ses amis, en ligne. Alice cree une partie privee, et Bob la voit « dans le
 * salon d'une partie privee ». Alice l'invite depuis son salon, Bob rejoint par la carte
 * d'invitation, sans avoir vu de code, et Alice le voit entrer. Ensuite, Bob rejoint
 * d'un clic, depuis l'ecran Amis, le salon public d'Alice.
 *
 * LE SERVEUR A DES COMPTES EN MEMOIRE (tests/outils/comptes-en-memoire.ts), qui
 * appliquent les regles des amities du serveur et previennent la couche reseau de
 * chaque geste, comme la base. Ce qui est eprouve ici, c'est le chemin de la page au
 * serveur et retour, en direct.
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

/** Cree un compte depuis la page, note son code de secours, et attend l'accueil. */
async function inscrire(page: Page, pseudo: string): Promise<void> {
  await page.goto(jeu.url);
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

/** La navigation laterale de cette page. */
function navigation(page: Page) {
  return page.getByRole('navigation', { name: 'Navigation principale' });
}

/**
 * Alice demande Bob depuis son ecran Amis, Bob accepte depuis le sien. Alice reste sur
 * son ecran Amis, Bob aussi.
 */
async function devenirAmis(alice: Page, bob: Page): Promise<void> {
  await navigation(alice).getByRole('button', { name: /^Amis/u }).click();
  await alice.getByLabel('Ajouter par pseudo').fill('bob');
  await alice.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(alice.locator('.amis-envoyees .ligne-ami-pseudo')).toHaveText(['Bob']);

  await navigation(bob).getByRole('button', { name: 'Amis, 1 demande reçue' }).click();
  await bob.locator('.amis-recues').getByRole('button', { name: 'Accepter' }).click();
  await expect(bob.locator('.amis-amis .ligne-ami-pseudo')).toHaveText(['Alice']);
}

/** Cree une partie de cette visibilite depuis l'accueil, et attend son salon. */
async function creer(page: Page, visibilite: 'publique' | 'privee'): Promise<void> {
  await navigation(page)
    .getByRole('button', { name: /^Créer/u })
    .click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'creation');
  await page.locator(`label.tuile-choix[data-visibilite="${visibilite}"]`).click();
  await page.getByRole('button', { name: 'Créer le salon' }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
}

test('la pastille, la presence et l invitation, sans naviguer', async ({ browser }) => {
  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);
  const erreurs = [releverLesErreurs(alice.page), releverLesErreurs(bob.page)];

  try {
    await inscrire(alice.page, 'Alice');
    await inscrire(bob.page, 'Bob');

    // -- La demande d'Alice allume la pastille de Bob, sur l'accueil -------------------
    await navigation(alice.page).getByRole('button', { name: /^Amis/u }).click();
    await alice.page.getByLabel('Ajouter par pseudo').fill('bob');
    await alice.page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(alice.page.locator('.amis-envoyees .ligne-ami-pseudo')).toHaveText(['Bob']);

    const entreeDeBob = navigation(bob.page).getByRole('button', {
      name: 'Amis, 1 demande reçue',
    });
    await expect(entreeDeBob).toBeVisible();
    await expect(bob.page.locator('.application')).toHaveAttribute('data-ecran', 'accueil');

    // -- Bob accepte: Alice le voit parmi ses amis, en ligne, sans naviguer -------------
    await entreeDeBob.click();
    await bob.page.locator('.amis-recues').getByRole('button', { name: 'Accepter' }).click();
    await expect(alice.page.locator('.amis-amis .ligne-ami-pseudo')).toHaveText(['Bob']);
    await expect(alice.page.locator('.amis-amis .ligne-ami-presence')).toHaveText('En ligne');
    await expect(bob.page.locator('.amis-amis .ligne-ami-presence')).toHaveText('En ligne');

    // -- Alice cree une partie privee: Bob la voit dans son salon, sans code -----------
    await creer(alice.page, 'privee');
    const code = (await alice.page.locator('.salon-code-valeur').textContent()) ?? '';
    expect(code).toMatch(/^[A-Z0-9]{6}$/u);
    await expect(bob.page.locator('.amis-amis .ligne-ami-presence')).toHaveText(
      'Dans le salon d’une partie privée',
    );

    // -- Alice invite Bob depuis son salon ----------------------------------------------
    const section = alice.page.locator('.salon-amis');
    await expect(section.locator('.salon-ami-pseudo')).toHaveText(['Bob']);
    await section.getByRole('button', { name: 'Inviter Bob' }).click();
    await expect(section.locator('.salon-ami-note')).toHaveText('Invitation envoyée.');

    // -- Bob rejoint par la carte, sans avoir vu le code ---------------------------------
    const carte = bob.page.locator('.invitation-d-ami');
    await expect(carte.locator('.invitation-titre')).toHaveText('Alice vous invite');
    await expect(carte.locator('.invitation-detail')).toHaveText(
      'Horde · partie privée · 1 sur 12',
    );
    expect(await bob.page.locator('body').textContent()).not.toContain(code);

    await carte.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(bob.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await expect(bob.page.locator('.salon-code-valeur')).toHaveText(code);
    await expect(bob.page.locator('.invitation-d-ami')).toHaveCount(0);

    // -- Alice le voit entrer --------------------------------------------------------------
    await expect(alice.page.locator('.carte-joueur')).toHaveCount(2);
    await expect(section.locator('.salon-amis-vide')).toHaveText(
      'Aucun ami en ligne pour l’instant.',
    );

    expect(erreurs.flat()).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});

test('rejoindre d un clic le salon public d un ami', async ({ browser }) => {
  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);
  const erreurs = [releverLesErreurs(alice.page), releverLesErreurs(bob.page)];

  try {
    await inscrire(alice.page, 'Alice');
    await inscrire(bob.page, 'Bob');
    await devenirAmis(alice.page, bob.page);

    await creer(alice.page, 'publique');

    const ligneDAlice = bob.page.locator('.amis-amis .ligne-ami');
    await expect(ligneDAlice.locator('.ligne-ami-presence')).toHaveText(
      'Dans un salon · Horde · 1 sur 12',
    );
    await ligneDAlice.getByRole('button', { name: 'Rejoindre' }).click();

    await expect(bob.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await expect(alice.page.locator('.carte-joueur')).toHaveCount(2);

    expect(erreurs.flat()).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});
