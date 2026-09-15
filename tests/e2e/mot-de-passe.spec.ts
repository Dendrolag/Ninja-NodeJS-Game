import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import type { ComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import { creerComptesEnMemoire } from '../outils/comptes-en-memoire.js';
import { releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * La gestion du mot de passe, de la page au serveur (etape 3.4).
 *
 * Le joueur s'inscrit et note son code de secours; une seconde page se connecte au
 * meme compte; depuis le profil, il se trompe de mot de passe actuel, puis change
 * son mot de passe, ce qui ferme la session de l'autre page et renouvelle son code.
 * Deconnecte, son ancien mot de passe ne l'ouvre plus: il passe par le mot de passe
 * oublie, ou l'ancien code est refuse et le nouveau le connecte.
 *
 * LE SERVEUR A DES COMPTES EN MEMOIRE (tests/outils/comptes-en-memoire.ts), comme le
 * scenario des comptes: ce qui est eprouve ici, c'est le chemin de la page au
 * serveur et retour. Les regles elles-memes (hachage, transactions, limites) sont
 * eprouvees contre Neon, dans tests/base/motDePasse.test.ts.
 *
 * UN SEUL CADRAGE: les formulaires sont ceux du bureau, que le cadrage mobile
 * rejouerait sans rien verifier de plus. Voir playwright.config.ts.
 */

const ANCIEN = 'correct cheval pile agrafe';
const NOUVEAU = 'batterie agrafe cheval correct';
const DERNIER = 'agrafe pile cheval batterie';

/** La forme d'un code de secours affiche. */
const FORME_DU_CODE = /^[0-9A-Z]{4}(?:-[0-9A-Z]{4}){3}$/u;

/**
 * Les refus que ce scenario provoque expres (mot de passe faux, code faux, session
 * fermee): le navigateur les note dans sa console comme des ressources en echec. Ce
 * ne sont pas des erreurs de la page.
 */
const REFUS_ATTENDU = /Failed to load resource: the server responded with a status of 40[13]/u;

let jeu: ServeurDeJeu;
let comptes: ComptesEnMemoire;

test.beforeEach(async () => {
  comptes = creerComptesEnMemoire();
  jeu = await demarrerLeJeu({ comptes });
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** La fenetre du code de secours. */
function fenetreDuCode(page: Page) {
  return page.getByRole('dialog', { name: 'Votre code de secours' });
}

/** Lit le code de secours affiche, le note, et le rend. */
async function noterLeCode(page: Page): Promise<string> {
  const fenetre = fenetreDuCode(page);
  await expect(fenetre).toBeVisible();

  const code = (await fenetre.locator('.code-de-secours').textContent()) ?? '';
  expect(code).toMatch(FORME_DU_CODE);

  await fenetre.getByRole('button', { name: 'J’ai noté mon code' }).click();
  await expect(fenetre).toBeHidden();

  return code;
}

/** Ouvre l'ecran de connexion depuis l'en-tete. */
async function ouvrirLaConnexion(page: Page): Promise<void> {
  await page.locator('.entete-connexion').click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'connexion');
}

/** Se connecte au compte d'Alice avec ce mot de passe. */
async function seConnecter(page: Page, motDePasse: string): Promise<void> {
  await ouvrirLaConnexion(page);
  await page.getByLabel('Pseudo').fill('Alice');
  await page.getByLabel('Mot de passe', { exact: true }).fill(motDePasse);
  await page.locator('.connexion-formulaire').getByRole('button', { name: 'Se connecter' }).click();
}

test('changer son mot de passe depuis le profil, puis le retrouver par le code de secours', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);

  const erreurs = releverLesErreurs(page);
  const ecran = page.locator('.application');

  // -- L'inscription remet un code ---------------------------------------------
  await page.goto(jeu.url);
  await ouvrirLaConnexion(page);
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill('Alice');
  await page.getByLabel('Mot de passe').fill(ANCIEN);
  await page
    .locator('.connexion-formulaire')
    .getByRole('button', { name: 'Créer le compte' })
    .click();

  const premierCode = await noterLeCode(page);
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await expect(page.locator('.carte-compte-pseudo')).toHaveText('Alice');

  // -- Une autre page se connecte au meme compte ------------------------------
  const autreNavigateur = await browser.newContext();
  const autre = await autreNavigateur.newPage();
  await autre.goto(jeu.url);
  await seConnecter(autre, ANCIEN);
  await expect(autre.locator('.carte-compte-pseudo')).toHaveText('Alice');
  expect(comptes.sessionsDe('Alice')).toBe(2);

  // -- Le changement depuis le profil -----------------------------------------
  await page.locator('.carte-compte').click();
  await expect(ecran).toHaveAttribute('data-ecran', 'profil');

  const changement = page.locator('.securite-formulaire', { hasText: 'Changer le mot de passe' });
  await changement.getByLabel('Mot de passe actuel').fill('pas le bon');
  await changement.getByLabel('Nouveau mot de passe').fill(NOUVEAU);
  await changement.getByRole('button', { name: 'Changer le mot de passe' }).click();

  await expect(changement.getByText('Mot de passe incorrect.')).toBeVisible();
  await expect(fenetreDuCode(page)).toBeHidden();
  expect(comptes.sessionsDe('Alice')).toBe(2);

  await changement.getByLabel('Mot de passe actuel').fill(ANCIEN);
  await changement.getByRole('button', { name: 'Changer le mot de passe' }).click();

  const deuxiemeCode = await noterLeCode(page);
  expect(deuxiemeCode).not.toBe(premierCode);
  await expect(
    changement.getByText('Mot de passe changé. Vos autres appareils ont été déconnectés.'),
  ).toBeVisible();
  await expect(changement.getByLabel('Mot de passe actuel')).toHaveValue('');
  expect(comptes.sessionsDe('Alice')).toBe(1);

  // -- L'autre page n'est plus connectee ---------------------------------------
  await autre.reload();
  await expect(autre.getByText('Votre session a expiré')).toBeVisible();
  await expect(autre.locator('.entete-connexion')).toBeVisible();
  await autreNavigateur.close();

  // -- Deconnecte, l'ancien mot de passe n'ouvre plus le compte ---------------
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await seConnecter(page, ANCIEN);
  await expect(page.locator('.connexion-erreur')).toHaveText('Pseudo ou mot de passe incorrect.');

  // -- Le mot de passe oublie: l'ancien code est refuse, le nouveau connecte ---
  await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await expect(page.locator('.connexion-titre')).toHaveText('Mot de passe oublié');

  // Le formulaire, et non la page: la fenetre « Votre code de secours » porte aussi
  // ces mots dans son nom.
  const formulaire = page.locator('.connexion-formulaire');
  await formulaire.getByLabel('Code de secours').fill(premierCode.toLowerCase());
  await formulaire.getByLabel('Nouveau mot de passe').fill(DERNIER);
  await formulaire.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.locator('.connexion-erreur')).toHaveText(
    'Pseudo ou code de secours incorrect.',
  );

  await formulaire.getByLabel('Code de secours').fill(deuxiemeCode);
  await formulaire.getByRole('button', { name: 'Changer le mot de passe' }).click();

  const troisiemeCode = await noterLeCode(page);
  expect(troisiemeCode).not.toBe(deuxiemeCode);
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await expect(page.locator('.carte-compte-pseudo')).toHaveText('Alice');
  expect(comptes.compteNomme('Alice')?.motDePasse).toBe(DERNIER);

  expect(erreurs.filter((erreur) => !REFUS_ATTENDU.test(erreur))).toEqual([]);
});
