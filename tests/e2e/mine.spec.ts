import { expect, test } from '@playwright/test';

import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  attendreLaPartie,
  entrer,
  expliquerLEchec,
  joueurNomme,
  lancer,
  ramasserUnObjetDePoche,
  regler,
  releverLesErreurs,
  releverLesSignesVitaux,
} from './harnais/parcours.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * La mine dans une vraie partie (etape 7.11), du reglage a la mine posee.
 *
 * La mine apparait a coup sur toutes les deux secondes, et les autres objets sont coupes,
 * pour qu'Alice trouve vite la sienne. Elle la met en poche: la carte de la poche le dit au
 * HUD. Puis elle la pose, par la touche E sur ordinateur, par le bouton de la poche sur
 * telephone: le serveur la pose sous ses pieds, la poche se vide, et la carte s'en va. Une
 * capture d'ecran montre la mine posee, vue de son poseur (jointe au rapport, a relire a
 * l'oeil). L'armement et l'explosion, qui demandent un adversaire, sont joues a travers le
 * vrai serveur dans ServeurSocket.mine.test.ts.
 *
 * Le scenario n'ecrit jamais dans le serveur: il y lit ou sont Alice et les mines, pour la
 * guider.
 */

/** Combien de temps Alice a pour trouver une mine. */
const DELAI_DE_RAMASSAGE_MS = 60_000;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('ramasser une mine, la voir en poche, et la poser', async ({ page, hasTouch }, infos) => {
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
    'objetsDePoche.fumee.actif': false,
    'objetsDePoche.mine.tauxApparitionPourCent': '100',
  });
  await expect(page.locator('.recapitulatif')).toContainText('À poser');
  await lancer(page);
  await attendreLaPartie(page);
  const partie = jeu.partie();

  const commande = hasTouch ? await commandeAuPouce(page) : commandeAuClavier(page);

  await expliquerLEchec({ Alice: signes }, async () => {
    await expect(async () => {
      await accomplir(ramasserUnObjetDePoche(partie, 'Alice', commande, 'mine'));
    }).toPass({ timeout: DELAI_DE_RAMASSAGE_MS });
  });

  const carte = page.locator('.hud-effet-poche');
  await expect(carte).toContainText('Mine');

  if (hasTouch) {
    await page.locator('.hud-poche').tap();
  } else {
    await page.keyboard.press('e');
  }

  await expect.poll(() => joueurNomme(partie, 'Alice').poche).toBeUndefined();
  const alice = joueurNomme(partie, 'Alice');
  const mines = Object.values(partie.etat.minesPosees ?? {});

  expect(mines).toHaveLength(1);
  expect(mines[0]?.poseur).toBe(alice.id);
  await expect(carte).toHaveCount(0);

  // Alice s'ecarte de sa mine, que son ninja cachait, avant la capture d'ecran: la premiere
  // direction qui n'est pas barree par un mur.
  const mine = mines[0]?.position ?? alice.position;
  const ecartee = (): boolean => {
    const ici = joueurNomme(partie, 'Alice').position;
    return Math.hypot(ici.x - mine.x, ici.y - mine.y) >= 45;
  };

  for (const direction of [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]) {
    await commande.orienter(direction);
    await expect
      .poll(ecartee, { timeout: 2000 })
      .toBe(true)
      .catch(() => undefined);
    await commande.relacher();

    if (ecartee()) {
      break;
    }
  }

  await page.screenshot({ path: infos.outputPath('mine.png') });
  expect(erreurs).toEqual([]);
});
