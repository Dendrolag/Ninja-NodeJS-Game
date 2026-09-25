import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CONE_DU_KATANA } from '../../packages/sim/dist/index.js';
import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  attendreLaPartie,
  expliquerLEchec,
  lancer,
  prendreUnFauxNinjaDUnCoup,
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
 * bureau, au pouce et au bouton en fenetre mobile, d'un second doigt, sans lever le
 * pouce (etape 8.7).
 *
 * ALICE FRAPPE EN ROUTE, des qu'un faux ninja passe dans l'arc de son katana. Un coup
 * peut manquer: le faux ninja a pu sortir de l'arc avant que le coup parte. Un coup dans
 * le vide ne coute rien, et Alice refrappe des qu'un faux ninja y repasse.
 *
 * Le sang, les traces de pas et la trainee se dessinent au GPU: ils sont verifies par les
 * tests de la page, qui decrivent ce qu'il faut dessiner. Une capture d'ecran de la partie
 * est jointe au rapport, pour qui veut le voir.
 */

/** Une partie longue et peuplee: beaucoup de faux ninjas a portee, et le temps d'approcher. */
const PARTIE_MASSACRE = {
  dureePartieS: '150',
  nombreBotsInitial: '120',
  'zones.actives': false,
} as const;

/**
 * Le temps laisse a Alice pour trancher un faux ninja, en millisecondes.
 *
 * Moins que la partie, dont le lancement a deja pris quelques secondes: un echec doit se
 * dire pendant la partie, et non apres sa fin, quand plus personne ne bouge (etape 8.7).
 *
 * Large, et la partie avec lui: le katana ne porte qu'a soixante pixels, et sur une page
 * qui dessine deux images par seconde, le joueur glisse de cent a deux cents pixels apres
 * le lever du pouce. S'arreter a portee d'un faux ninja choisi y tient de la chance; les
 * prises viennent surtout des faux ninjas qui passent pendant l'affut. A deux processeurs,
 * une prise sur cinq a demande pres de cent secondes. Le scenario s'arrete a la prise: la
 * marge ne coute rien quand il reussit.
 */
const DELAI_DE_PRISE_MS = 130_000;

/**
 * Densite de pixels un, dans les deux cadrages (etape 8.7).
 *
 * Le Pixel 7 emule dessine a densite deux, quatre fois plus de pixels, et la machine
 * d'integration continue n'a pas de carte graphique: la page y dessinait trois images par
 * seconde, chaque contact tactile attendait pres d'une seconde, et un coup partait plus
 * d'une seconde apres la decision. Mesure a deux processeurs: deux images par seconde a
 * densite deux, huit et demie a densite un, un contact en 0,25 seconde au lieu de 1,15.
 * Ce scenario verifie le pouce, le bouton et les regles, pas le rendu: le rendu a densite
 * deux reste exerce par les autres scenarios du cadrage telephone et par le banc.
 */
test.use({ deviceScaleFactor: 1 });

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
  test.setTimeout(210_000);

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

  const pouce = hasTouch ? await commandeAuPouce(page) : undefined;
  const commande = pouce ?? commandeAuClavier(page);
  const frapper =
    pouce === undefined
      ? async (): Promise<void> => {
          await page.keyboard.press('Space');
        }
      : await pouce.appuiSur(bouton);
  const pointsDAlice = (): number =>
    partie.classement().find((ligne) => ligne.pseudo === 'Alice')?.points ?? 0;

  await expliquerLEchec({ Alice: signes }, async () => {
    await expect(async () => {
      await accomplir(
        prendreUnFauxNinjaDUnCoup(
          partie,
          'Alice',
          commande,
          CONE_DU_KATANA,
          frapper,
          () => pointsDAlice() > 0,
        ),
      );
    }).toPass({ timeout: DELAI_DE_PRISE_MS });
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
