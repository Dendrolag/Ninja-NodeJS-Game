import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CONE_DU_KATANA } from '../../packages/sim/dist/index.js';
import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  approcherUnFauxNinja,
  attendreLaPartie,
  expliquerLEchec,
  lancer,
  regler,
  releverLesErreurs,
  releverLesSignesVitaux,
} from './harnais/parcours.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le mode Massacre de l'etape 7.4, joue seul dans la page.
 *
 * Alice cree une partie Massacre depuis l'ecran de creation, et la lance seule: le mode se
 * joue sans adversaire. Elle voit le bouton Katana et le compteur de combo, s'approche d'un
 * faux ninja et frappe: le serveur lui compte des points, le compteur dit sa premiere mort,
 * et un ninja de moins reste sur la carte.
 *
 * JOUE DANS LES DEUX CADRAGES, comme le Tactique: au clavier et a la barre d'espace sur
 * bureau, au pouce et au bouton en fenetre mobile.
 *
 * UN COUP PEUT MANQUER, ET LE SCENARIO REPREND L'APPROCHE: le faux ninja a pu sortir de
 * l'arc entre l'arret du pilote et le coup. Un coup dans le vide ne coute rien.
 *
 * Le sang, les traces de pas et la trainee se dessinent au GPU: ils sont verifies par les
 * tests de la page, qui decrivent ce qu'il faut dessiner. Une capture d'ecran de la partie
 * est jointe au rapport, pour qui veut le voir.
 */

/** Une partie longue et peuplee: beaucoup de faux ninjas a portee, et le temps d'approcher. */
const PARTIE_MASSACRE = {
  dureePartieS: '120',
  nombreBotsInitial: '120',
  'zones.actives': false,
} as const;

/** A cette distance d'un faux ninja, en pixels, Alice s'arrete pour frapper: dans l'arc. */
const DISTANCE_DE_COUP_PX = 40;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

/** Alice cree une partie Massacre depuis l'ecran de creation, et attend son salon. */
async function creerUnePartieMassacre(page: Page): Promise<void> {
  await page.goto(jeu.url);
  await page.getByPlaceholder('Votre pseudo').fill('Alice');
  await page.getByRole('button', { name: 'Créer une partie' }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'creation');
  await page.locator('label.tuile-choix[data-mode="massacre"]').click();
  await expect(page.locator('.creation-recapitulatif h2')).toHaveText(/^Massacre · /u);
  await expect(page.locator('.creation-recapitulatif')).toContainText('8 joueurs');
  await page.getByRole('button', { name: 'Créer le salon' }).click();
  await expect(page.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
}

test('creer une partie Massacre, la lancer seul et trancher un faux ninja', async ({
  page,
  hasTouch,
}, informations) => {
  // La partie, son compte a rebours, le chargement de la carte et plusieurs approches.
  test.setTimeout(180_000);

  const erreurs = releverLesErreurs(page);
  const signes = await releverLesSignesVitaux(page);

  // -- La creation et le salon: on lance seul ------------------------------------
  await creerUnePartieMassacre(page);
  await expect(page.locator('.salon-regle')).toContainText('katana', { ignoreCase: true });
  await regler(page, PARTIE_MASSACRE);
  await lancer(page);

  // -- La partie ---------------------------------------------------------------
  await attendreLaPartie(page);
  const partie = jeu.partie();
  expect(partie.mode).toBe('massacre');

  const bouton = page.locator('.hud-capture');
  await expect(bouton).toBeVisible();
  await expect(bouton.locator('.hud-capture-libelle')).toHaveText('Katana');
  await expect(page.locator('.hud-massacre-restants')).toHaveText('120 ninjas restants');

  if (!hasTouch) {
    await expect(page.locator('.jeu-rappel')).toContainText('Espace pour trancher');
  }

  const commande = hasTouch ? await commandeAuPouce(page) : commandeAuClavier(page);
  const frapper = async (): Promise<void> => {
    await (hasTouch ? bouton.tap() : page.keyboard.press('Space'));
  };
  const pointsDAlice = (): number =>
    partie.classement().find((ligne) => ligne.pseudo === 'Alice')?.points ?? 0;

  await expliquerLEchec({ Alice: signes }, async () => {
    await expect(async () => {
      await accomplir(
        approcherUnFauxNinja(partie, 'Alice', commande, DISTANCE_DE_COUP_PX, CONE_DU_KATANA),
      );
      await frapper();
      await expect.poll(pointsDAlice, { timeout: 2_000 }).toBeGreaterThan(0);
    }).toPass({ timeout: 120_000 });
  });

  // Le compteur dit la mort et le combo, et la carte compte un ninja de moins au moins.
  await expect(page.locator('.hud-massacre-restants')).not.toHaveText('120 ninjas restants');
  await expect(page.locator('.hud-classement')).toContainText(String(pointsDAlice()));

  await informations.attach('partie', {
    path: await page
      .screenshot({ path: informations.outputPath('partie.png') })
      .then(() => informations.outputPath('partie.png')),
    contentType: 'image/png',
  });

  expect(erreurs).toEqual([]);
});
