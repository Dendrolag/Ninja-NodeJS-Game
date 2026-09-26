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
 * Les amis (etape 3.6), de bout en bout.
 *
 * Deux scenarios. Par pseudo: Alice demande Bob depuis l'ecran Amis; Bob voit la
 * pastille des demandes recues, accepte; les deux se voient amis; Alice retire Bob
 * depuis sa fiche. Depuis le salon: Alice ajoute Bob depuis sa fiche, Bob accepte
 * depuis la sienne, ils jouent une partie courte, et la fiche de Bob montre a Alice une
 * partie jouee ensemble.
 *
 * LE SERVEUR A DES COMPTES EN MEMOIRE (tests/outils/comptes-en-memoire.ts), qui
 * appliquent les regles des amities du serveur: ce qui est eprouve ici, c'est le chemin
 * de la page au serveur. Les ecritures en base, le blocage silencieux et les bornes sont
 * eprouves contre la base, dans tests/base/amis.test.ts.
 *
 * UN SEUL CADRAGE: le cadrage mobile rejouerait les memes gestes sans rien verifier de
 * plus. Voir playwright.config.ts.
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

/** Va sur l'ecran Amis par la navigation, en passant par Parties pour relire la liste. */
async function allerAuxAmis(page: Page): Promise<void> {
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' });

  await navigation.getByRole('button', { name: /^Parties/u }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'parties');
  await navigation.getByRole('button', { name: /^Amis/u }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'amis');
}

test('devenir amis par le pseudo, puis se retirer', async ({ browser }) => {
  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);
  const erreurs = [releverLesErreurs(alice.page), releverLesErreurs(bob.page)];

  try {
    await inscrire(alice.page, jeu.url, 'Alice');
    await inscrire(bob.page, jeu.url, 'Bob');

    // -- Alice demande Bob par son pseudo -----------------------------------------
    await allerAuxAmis(alice.page);
    await alice.page.getByLabel('Ajouter par pseudo').fill('bob');
    await alice.page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(alice.page.locator('.amis-annonce')).toHaveText(
      'Votre demande à Bob est envoyée.',
    );
    await expect(alice.page.getByLabel('Ajouter par pseudo')).toHaveValue('');
    await expect(alice.page.locator('.amis-envoyees .ligne-ami-pseudo')).toHaveText(['Bob']);

    // -- Bob voit la pastille, et accepte ------------------------------------------
    const navigationDeBob = bob.page.getByRole('navigation', { name: 'Navigation principale' });
    await navigationDeBob.getByRole('button', { name: /^Parties/u }).click();
    const entreeAmis = navigationDeBob.getByRole('button', { name: 'Amis, 1 demande reçue' });
    await expect(entreeAmis).toBeVisible();
    await expect(entreeAmis.locator('.navigation-pastille')).toHaveText('1');

    await entreeAmis.click();
    await bob.page.locator('.amis-recues').getByRole('button', { name: 'Accepter' }).click();
    await expect(bob.page.locator('.amis-annonce')).toHaveText('Alice et vous êtes amis.');
    await expect(bob.page.locator('.amis-amis .ligne-ami-pseudo')).toHaveText(['Alice']);
    await expect(entreeAmis).toBeHidden();
    await expect(navigationDeBob.getByRole('button', { name: 'Amis', exact: true })).toBeVisible();

    // -- Alice voit Bob parmi ses amis, et le retire depuis sa fiche ------------------
    await allerAuxAmis(alice.page);
    await expect(alice.page.locator('.amis-amis .ligne-ami-pseudo')).toHaveText(['Bob']);
    await alice.page.getByRole('button', { name: 'Bob, voir sa fiche' }).click();

    const fiche = alice.page.getByRole('dialog', { name: 'Fiche du joueur' });
    await expect(fiche.locator('.fiche-relation')).toHaveText('Vous êtes amis.');
    await expect(fiche.locator('.fiche-ensemble')).toBeVisible();
    await fiche.getByRole('button', { name: 'Retirer des amis' }).click();
    await expect(fiche.getByRole('button', { name: 'Ajouter en ami' })).toBeVisible();
    await expect(fiche.locator('.fiche-relation')).toBeHidden();
    await expect(fiche.locator('.fiche-ensemble')).toBeHidden();
    await fiche.locator('.fenetre-pied').getByRole('button', { name: 'Fermer' }).click();

    await expect(alice.page.locator('.amis-amis .ligne-ami-pseudo')).toHaveCount(0);
    await expect(alice.page.locator('.amis-amis .amis-vide')).toBeVisible();

    expect(erreurs.flat()).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});

test('devenir amis au salon, et lire la partie jouee ensemble', async ({ browser }) => {
  // Deux chargements de carte, une partie de trente secondes et son compte a rebours.
  test.setTimeout(180_000);

  const alice = await ouvrir(browser);
  const bob = await ouvrir(browser);
  const erreurs = [releverLesErreurs(alice.page), releverLesErreurs(bob.page)];

  try {
    await inscrire(alice.page, jeu.url, 'Alice');
    await inscrire(bob.page, jeu.url, 'Bob');

    await alice.page.getByRole('button', { name: 'Partie rapide' }).click();
    await expect(alice.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await bob.page.getByRole('button', { name: 'Partie rapide' }).click();
    await expect(bob.page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
    await expect(alice.page.locator('.carte-joueur')).toHaveCount(2);

    // -- Alice ajoute Bob depuis sa fiche --------------------------------------------
    await alice.page.getByRole('button', { name: 'Bob, voir sa fiche' }).click();
    const ficheDeBob = alice.page.getByRole('dialog', { name: 'Fiche du joueur' });
    await ficheDeBob.getByRole('button', { name: 'Ajouter en ami' }).click();
    await expect(ficheDeBob.locator('.fiche-relation')).toHaveText(
      'Demande envoyée, en attente de réponse.',
    );
    await ficheDeBob.locator('.fenetre-pied').getByRole('button', { name: 'Fermer' }).click();

    // -- Bob accepte depuis la fiche d'Alice ------------------------------------------
    await bob.page.getByRole('button', { name: 'Alice, voir sa fiche' }).click();
    const ficheDAlice = bob.page.getByRole('dialog', { name: 'Fiche du joueur' });
    await expect(ficheDAlice.locator('.fiche-relation')).toHaveText(
      'Ce compte vous demande d’être amis.',
    );
    await ficheDAlice.getByRole('button', { name: 'Accepter' }).click();
    await expect(ficheDAlice.locator('.fiche-relation')).toHaveText('Vous êtes amis.');
    // La fiche relue montre les parties jouees ensemble: aucune encore.
    await expect(
      ficheDAlice.locator('.fiche-ensemble .statistique', { hasText: 'Parties ensemble' }),
    ).toContainText('0');
    await ficheDAlice.locator('.fenetre-pied').getByRole('button', { name: 'Fermer' }).click();

    // -- Une partie ensemble -----------------------------------------------------------
    await regler(alice.page, PARTIE_COURTE);
    await lancer(alice.page);
    await attendreLaPartie(alice.page);
    await attendreLaFin(alice.page);
    await attendreLaFin(bob.page);
    await expect(alice.page.locator('.fin-progression .fin-xp')).toBeVisible({ timeout: 15_000 });
    expect(comptes.fins).toHaveLength(1);

    // -- La fiche de Bob la montre a Alice -----------------------------------------------
    await alice.page
      .locator('.fin-classement')
      .getByRole('button', { name: 'Bob, voir sa fiche' })
      .click();
    await expect(ficheDeBob.locator('.fiche-relation')).toHaveText('Vous êtes amis.');
    await expect(
      ficheDeBob
        .locator('.fiche-ensemble .statistique', { hasText: 'Parties ensemble' })
        .locator('strong'),
    ).toHaveText('1');

    expect(erreurs.flat()).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});
