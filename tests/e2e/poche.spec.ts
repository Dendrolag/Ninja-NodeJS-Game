import { expect, test } from '@playwright/test';

import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  attendreLaPartie,
  entrer,
  expliquerLEchec,
  joueurNomme,
  lancer,
  ramasserUneFumee,
  regler,
  releverLesErreurs,
  releverLesSignesVitaux,
} from './harnais/parcours.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * La poche et la fumee dans une vraie partie (etape 7.10), du reglage au nuage.
 *
 * La fumee apparait a coup sur toutes les deux secondes, et les autres objets sont coupes,
 * pour qu'Alice trouve vite la sienne. Elle la met en poche: la carte de la poche le dit au
 * HUD. Puis elle s'en sert, par la touche E sur ordinateur, par le bouton de la poche sur
 * telephone: le serveur la fait reparaitre ailleurs, la poche se vide, et la carte s'en va.
 * Une capture d'ecran prise dans l'instant montre le nuage (jointe au rapport, a relire a
 * l'oeil).
 *
 * Le scenario n'ecrit jamais dans le serveur: il y lit ou sont Alice et les fumees, pour
 * la guider, comme les scenarios du Tactique.
 */

/** Combien de temps Alice a pour trouver une fumee. */
const DELAI_DE_RAMASSAGE_MS = 60_000;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('ramasser une fumee, la voir en poche, et s enfuir dans un nuage', async ({
  page,
  hasTouch,
}, infos) => {
  test.setTimeout(150_000);

  const erreurs = releverLesErreurs(page);
  const signes = await releverLesSignesVitaux(page);

  await entrer(page, jeu.url, 'Alice');
  await regler(page, {
    dureePartieS: '90',
    evade: false,
    'zones.actives': false,
    'botsNoirs.actifs': false,
    'malus.actifs': false,
    'bonus.intervalleApparitionS': '2',
    'bonus.types.vitesse.actif': false,
    'bonus.types.invincibilite.actif': false,
    'bonus.types.revelation.actif': false,
    'objetsDePoche.fumee.tauxApparitionPourCent': '100',
  });
  await expect(page.locator('.recapitulatif')).toContainText('À garder en poche');
  await lancer(page);
  await attendreLaPartie(page);
  const partie = jeu.partie();

  const commande = hasTouch ? await commandeAuPouce(page) : commandeAuClavier(page);

  await expliquerLEchec({ Alice: signes }, async () => {
    await expect(async () => {
      await accomplir(ramasserUneFumee(partie, 'Alice', commande));
    }).toPass({ timeout: DELAI_DE_RAMASSAGE_MS });
  });

  const carte = page.locator('.hud-effet-poche');
  await expect(carte).toContainText('Fumée');

  const depart = joueurNomme(partie, 'Alice').position;

  if (hasTouch) {
    await page.locator('.hud-poche').tap();
  } else {
    await page.keyboard.press('e');
  }

  await expect.poll(() => joueurNomme(partie, 'Alice').poche).toBeUndefined();
  await page.screenshot({ path: infos.outputPath('fumee.png') });

  expect(joueurNomme(partie, 'Alice').position).not.toEqual(depart);
  await expect(carte).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
