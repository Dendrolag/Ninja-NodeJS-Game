import { expect, test } from '@playwright/test';

import { commandeAuClavier } from './harnais/commandes.js';
import {
  attendreLaPartie,
  capturerUnFauxNinja,
  entrer,
  expliquerLEchec,
  joueurNomme,
  lancer,
  regler,
  releverLesErreurs,
  releverLesSignesVitaux,
} from './harnais/parcours.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Un rechargement de page en pleine partie: le scenario de l'etape 2.5.
 *
 * Alice entre, lance, rallie des faux ninjas, puis recharge sa page. Elle doit
 * retrouver sa partie, sans repasser par l'accueil ni le salon: le meme joueur dans
 * l'etat du serveur, la meme couleur, ses ninjas, et une partie qui a continue.
 *
 * CE QUI EST VERIFIE, ET PAR QUI. Le serveur est l'arbitre: c'est lui qui dit si le
 * joueur est le meme, s'il est encore absent, et combien de ninjas portent sa
 * couleur. La page, elle, doit montrer la partie en cours et son joueur dans le
 * classement.
 *
 * UNE PARTIE EPUREE, reglee dans le salon comme un joueur le ferait. Seule, Alice ne
 * peut perdre ses ninjas que par un Black Ninja ou une zone de chaos: les retirer
 * fait du nombre de ses ninjas un compte qui ne peut que monter, et donc une preuve.
 */
const PARTIE_EPUREE = {
  dureePartieS: '120',
  nombreBotsInitial: '100',
  'bonus.types.invincibilite.actif': false,
  'malus.actifs': false,
  'zones.actives': false,
  'botsNoirs.actifs': false,
} as const;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('un rechargement en pleine partie ramene le joueur dans sa partie, avec sa couleur et ses ninjas', async ({
  page,
}) => {
  // Deux chargements de la carte, et une capture.
  test.setTimeout(150_000);

  const erreurs = releverLesErreurs(page);
  const signes = await releverLesSignesVitaux(page);

  await entrer(page, jeu.url, 'Alice');
  await regler(page, PARTIE_EPUREE);
  await lancer(page);
  await attendreLaPartie(page);

  const partie = jeu.partie();
  await expliquerLEchec({ Alice: signes }, async () => {
    await accomplir(capturerUnFauxNinja(partie, 'Alice', commandeAuClavier(page)));
  });

  const avant = joueurNomme(partie, 'Alice');
  const ninjasAvant = ninjasDe(partie, 'Alice');
  const battementAvant = partie.etat.tick;
  expect(ninjasAvant).toBeGreaterThan(0);

  await page.reload();

  // Sans repasser par le salon: l'ecran de jeu, puis la partie jouable.
  await attendreLaPartie(page);

  const apres = joueurNomme(partie, 'Alice');
  expect(apres.id).toBe(avant.id);
  expect(apres.couleur).toBe(avant.couleur);
  expect(partie.estAbsent(apres.id)).toBe(false);
  expect(partie.joueurs).toHaveLength(1);
  expect(ninjasDe(partie, 'Alice')).toBeGreaterThanOrEqual(ninjasAvant);
  expect(partie.etat.tick).toBeGreaterThan(battementAvant);
  expect(partie.bilan().joueurs.filter((joueur) => joueur.abandon)).toEqual([]);

  await expect(page.locator('.hud-classement')).toContainText('Alice');
  await expect(page.locator('.hud-retour')).toBeHidden();

  // Et la page commande de nouveau son joueur.
  await expliquerLEchec({ Alice: signes }, async () => {
    await accomplir(capturerUnFauxNinja(partie, 'Alice', commandeAuClavier(page)));
  });

  expect(erreurs).toEqual([]);
});

/** Le nombre de ninjas qui portent la couleur de ce joueur, selon le serveur. */
function ninjasDe(partie: ReturnType<ServeurDeJeu['partie']>, pseudo: string): number {
  return partie.classement().find((ligne) => ligne.pseudo === pseudo)?.botsPortes ?? 0;
}
