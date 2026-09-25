import { expect, test } from '@playwright/test';

import { attendreLaPartie, entrer, lancer, regler, releverLesErreurs } from './harnais/parcours.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * L'Evade dans une vraie partie (etape 7.9), du reglage au grand titre.
 *
 * Le salon annonce l'Evade dans son recapitulatif. La partie lancee, il apparait entre le
 * quart et les trois quarts de sa duree, et la page le dit a tous par un grand titre raye.
 * C'est le chemin complet: le tirage du moteur, la notification du serveur, le fait recu
 * par la page, et l'annonce dans le document.
 *
 * LA CAPTURE N'EST PAS JOUEE ICI. Plus rapide qu'un joueur sans bonus, l'Evade ne se
 * rattrape pas en ligne droite sur une vraie carte, et un scenario n'ecrit jamais dans le
 * serveur pour l'y aider. Elle est jouee a travers le vrai serveur, dans une arene fermee,
 * par ServeurSocket.evade.test.ts, et dans le moteur par evade.test.ts.
 */

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('le salon annonce l Evade, puis la partie le fait apparaitre en grand titre', async ({
  page,
}) => {
  // Trente secondes: il apparait entre 7,5 et 22,5 secondes de jeu.
  test.setTimeout(120_000);
  const erreurs = releverLesErreurs(page);

  await entrer(page, jeu.url, 'Alice');
  await regler(page, { dureePartieS: '30' });
  await expect(page.locator('.recapitulatif')).toContainText('L’Évadé');
  await lancer(page);
  await attendreLaPartie(page);

  const titre = page.locator('.grand-titre.raye');
  await expect(titre).toContainText('L’Évadé rôde !', { timeout: 40_000 });
  await expect(titre.locator('.grand-titre-x2')).toHaveText('x2');

  expect(jeu.partie().etat.evade?.surLaCarte).toBeDefined();
  expect(erreurs).toEqual([]);
});
