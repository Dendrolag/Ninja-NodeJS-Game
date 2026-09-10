import { expect, test } from '@playwright/test';

import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  attendreLaFin,
  attendreLaPartie,
  capturerUnFauxNinja,
  classementAffiche,
  classementDuServeur,
  entrer,
  lancer,
  regler,
  releverLesErreurs,
} from './harnais/parcours.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le parcours complet d'un joueur seul, de l'accueil au classement final.
 *
 * Le joueur entre, regle une partie courte, la lance, capture un faux ninja en se
 * deplacant lui-meme, voit son score monter, joue la partie jusqu'au bout, puis
 * retrouve au classement final exactement ce que le serveur a compte. Il revient
 * enfin a l'accueil. Aucune erreur ne doit apparaitre dans la console.
 *
 * SANS INSCRIPTION NI PROGRESSION. La fiche 4.4 les place dans ce parcours; le
 * jalon 1 n'a ni comptes (3.2) ni progression (3.3), et le ROADMAP fait foi.
 *
 * JOUE DANS LES DEUX CADRAGES, ET C'EST LE PARCOURS MOBILE DE LA FICHE. Sur bureau,
 * le joueur se deplace au clavier. En fenetre mobile, il se deplace au pouce, par
 * la manette virtuelle: c'est la premiere fois qu'un contact tactile traverse la
 * manette, le client, le reseau et le moteur jusqu'a une capture.
 *
 * LES REGLAGES SONT CEUX DU JEU, sauf deux: la duree la plus courte que le serveur
 * accepte, et beaucoup de faux ninjas, pour qu'une capture ne depende pas du hasard
 * des apparitions. Bonus, malus, zones et Black Ninjas restent en jeu.
 */

/** Une partie courte et peuplee. */
const PARTIE_COURTE = { dureePartieS: '30', nombreBotsInitial: '100' } as const;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('capturer un faux ninja, puis retrouver son score au classement final', async ({
  page,
  hasTouch,
}) => {
  // Une partie de trente secondes, son compte a rebours et le chargement de la carte.
  test.setTimeout(120_000);

  const erreurs = releverLesErreurs(page);
  const ecran = page.locator('.application');
  const manette = page.locator('.hud-manette');

  // -- Le salon ---------------------------------------------------------------
  await entrer(page, jeu.url, 'Alice');
  await regler(page, PARTIE_COURTE);
  await expect(page.locator('.recapitulatif')).toContainText('0:30');
  await lancer(page);

  // -- La partie --------------------------------------------------------------
  await attendreLaPartie(page);
  const partie = jeu.partie();
  const commande = hasTouch ? await commandeAuPouce(page) : commandeAuClavier(page);

  if (hasTouch) {
    // La manette n'existe a l'ecran que sous le pouce.
    await expect(manette).toBeHidden();
    await commande.orienter({ x: 1, y: 0 });
    await expect(manette).toBeVisible();
  }

  await accomplir(capturerUnFauxNinja(partie, 'Alice', commande));

  if (hasTouch) {
    await expect(manette).toBeHidden();
  }

  // Le score est un stock de faux ninjas: il n'est plus nul, et le HUD le montre.
  await expect(page.locator('.hud-ligne.moi .hud-points')).not.toHaveText('0');

  // -- La fin -----------------------------------------------------------------
  await attendreLaFin(page);
  expect(await classementAffiche(page)).toEqual(classementDuServeur(partie));

  await page.locator('.fin-actions').getByRole('button', { name: 'Accueil' }).click();
  await expect(ecran).toHaveAttribute('data-ecran', 'accueil');

  expect(erreurs).toEqual([]);
});
