import { expect, test } from '@playwright/test';

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
 * Un compte, de l'inscription au profil: le scenario des comptes de la reprise des
 * ecrans du jalon 3.
 *
 * Le joueur s'inscrit depuis la page, retrouve son compte apres un rechargement,
 * entre en partie sous son pseudo, joue une partie courte jusqu'a la fin, voit ce
 * qu'elle lui a rapporte, le retrouve dans son profil, puis se deconnecte. Aucune
 * erreur ne doit apparaitre dans la console.
 *
 * LE SERVEUR A DES COMPTES EN MEMOIRE (tests/outils/comptes-en-memoire.ts): les
 * scenarios tournent sans base. Ce qui est eprouve ici, c'est tout le chemin de la
 * page au serveur et retour: formulaire, jeton garde par le navigateur, lien du jeu
 * ouvert avec la session, recapitulatif de fin, route du profil. La base elle-meme
 * est eprouvee contre Neon, dans tests/base.
 *
 * LE SERVEUR EST L'ARBITRE. Les gains affiches a la fin sont compares a ceux que le
 * serveur a enregistres, pas a une valeur ecrite dans le scenario.
 *
 * UN SEUL CADRAGE: une partie entiere, que le cadrage mobile rejouerait sans rien
 * verifier de plus. Voir playwright.config.ts.
 */

/** Une partie seul, la plus courte que le serveur accepte. */
const PARTIE_COURTE = { dureePartieS: '30' } as const;

let jeu: ServeurDeJeu;
let comptes: ComptesEnMemoire;

test.beforeEach(async () => {
  comptes = creerComptesEnMemoire();
  jeu = await demarrerLeJeu({ comptes });
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('s inscrire, jouer, voir sa progression, puis se deconnecter', async ({ page }) => {
  // Une partie de trente secondes, son compte a rebours et le chargement de la carte.
  test.setTimeout(150_000);

  const erreurs = releverLesErreurs(page);
  const ecran = page.locator('.application');

  // -- L'inscription ----------------------------------------------------------
  await page.goto(jeu.url);
  await page.locator('.entete-connexion').click();
  await expect(ecran).toHaveAttribute('data-ecran', 'connexion');

  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill('Alice');
  await page.getByLabel('Mot de passe').fill('correct cheval pile agrafe');
  await page
    .locator('.connexion-formulaire')
    .getByRole('button', { name: 'Créer le compte' })
    .click();

  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await expect(page.locator('.carte-compte-pseudo')).toHaveText('Alice');
  await expect(page.locator('.anneau-niveau')).toHaveText('1');
  await expect(page.locator('.accueil-compte')).toContainText('Alice');

  // La session survit a un rechargement: le jeton est garde par le navigateur.
  await page.reload();
  await expect(page.locator('.carte-compte-pseudo')).toHaveText('Alice');

  // -- Une partie courte, sous le pseudo du compte ----------------------------
  await page.getByRole('button', { name: 'Partie rapide' }).click();
  await expect(ecran).toHaveAttribute('data-ecran', 'salon');
  await expect(page.locator('.carte-joueur-niveau')).toHaveText('Niveau 1');

  await regler(page, PARTIE_COURTE);
  await lancer(page);
  await attendreLaPartie(page);
  await attendreLaFin(page);

  // -- La fin enrichie, egale a ce que le serveur a enregistre ----------------
  const progression = page.locator('.fin-progression');
  await expect(progression.locator('.fin-xp')).toBeVisible({ timeout: 15_000 });

  expect(comptes.fins).toHaveLength(1);
  const resultat = comptes.fins[0]?.resultats[0];

  if (resultat === undefined) {
    throw new Error("Le serveur n'a enregistre aucun resultat pour le compte.");
  }

  expect(resultat.xpGagnee).toBeGreaterThan(0);
  await expect(progression.locator('.fin-xp')).toHaveText(`+${String(resultat.xpGagnee)} XP`);
  await expect(progression.locator('.gain-pieces strong')).toHaveText(
    `+${String(resultat.piecesGagnees)}`,
  );
  // Seul, et en trente secondes: la ligue ne bouge pas.
  await expect(progression.locator('.gain-ligue strong')).toHaveText('0');

  // -- Le profil compte la partie ---------------------------------------------
  await page.locator('.fin-actions').getByRole('button', { name: 'Accueil' }).click();
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await page.locator('.carte-compte').click();

  await expect(ecran).toHaveAttribute('data-ecran', 'profil');
  await expect(
    page.locator('.statistique', { hasText: 'Parties jouées' }).locator('strong'),
  ).toHaveText('1');
  await expect(page.locator('.tableau-historique tbody tr')).toHaveCount(1);
  await expect(page.locator('.tableau-historique tbody tr')).toContainText('1re sur 1');

  // -- La deconnexion ---------------------------------------------------------
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');
  await expect(page.locator('.entete-connexion')).toBeVisible();

  // Le jeton est oublie: un rechargement ne retrouve plus le compte.
  await page.reload();
  await expect(page.locator('.entete-connexion')).toBeVisible();
  await expect(page.locator('.carte-compte')).toBeHidden();

  expect(erreurs).toEqual([]);
});
