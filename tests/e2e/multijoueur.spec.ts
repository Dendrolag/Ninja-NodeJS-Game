import type { Browser, BrowserContextOptions, Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';

import type { Joueur } from '../../packages/sim/dist/index.js';
import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import type { SignesVitaux } from './harnais/parcours.js';
import {
  allerAuContact,
  attendreLaFin,
  attendreLaPartie,
  capturerUnFauxNinja,
  classementAffiche,
  classementDuServeur,
  entrer,
  expliquerLEchec,
  joueurNomme,
  lancer,
  regler,
  releverLesAnnonces,
  releverLesErreurs,
  releverLesSignesVitaux,
} from './harnais/parcours.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Deux joueurs dans la meme partie: le scenario qui confirme la coherence du multijoueur.
 *
 * Alice joue sur un ordinateur, au clavier. Bob joue sur un telephone, au pouce.
 * Chacun a son propre contexte de navigateur, donc sa propre connexion, comme deux
 * personnes sur deux appareils.
 *
 * CE QUI EST VERIFIE, DANS L'ORDRE DU PARCOURS.
 *
 *   1. Le salon est le meme des deux cotes: meme titre, memes joueurs, meme hote,
 *      et les reglages choisis par l'hote s'affichent a l'identique chez l'invite.
 *   2. Seule l'hote regle et lance; le compte a rebours apparait chez les deux.
 *   3. Une capture de joueur est annoncee des deux cotes, a la bonne personne, avec
 *      le nombre de ninjas que le serveur a reellement transferes.
 *   4. Le classement final est le meme chez les deux, et c'est celui du serveur,
 *      cellule par cellule.
 *
 * LE SERVEUR EST L'ARBITRE. Quand deux joueurs se touchent et ont chacun le droit
 * de capturer, le moteur tire au sort le vainqueur. Le scenario ne le decide donc
 * pas: il le lit dans l'etat du serveur, puis verifie que chaque page raconte la
 * meme histoire que lui.
 *
 * UN SEUL POURSUIVANT. Chacun capture d'abord un faux ninja, puis Bob va jusqu'a
 * Alice, qui l'attend sur place. Deux joueurs qui se cherchent l'un l'autre peuvent
 * tourner sans fin autour d'un meme obstacle, chacun suivant la trace de l'autre:
 * c'est arrive en repetant ce scenario. Une cible immobile, elle, est toujours
 * atteinte.
 *
 * UNE PARTIE EPUREE, reglee par l'hote dans le salon comme n'importe quel joueur
 * pourrait le faire. Trois choses du jeu empecheraient le contact voulu dans le
 * temps d'une partie courte: l'invincibilite rend un joueur imprenable dix
 * secondes, un malus de controles inverses envoie le joueur a l'oppose de ce qu'il
 * demande, et les zones le poussent ou l'attirent. Les Black Ninjas sont retires
 * aussi, pour que le seul moyen de perdre ses ninjas soit la capture verifiee. Le
 * parcours solo, lui, joue avec tout.
 *
 * UN SEUL CADRAGE. Ce scenario fabrique lui-meme ses deux appareils: le rejouer
 * dans le projet mobile doublerait sa duree sans rien verifier de plus. Voir
 * playwright.config.ts.
 */

/**
 * Une partie d'une minute, peuplee, sans ce qui empecherait deux joueurs de se toucher.
 *
 * UNE MINUTE ET NON TRENTE SECONDES. En integration continue, les deux pages
 * dessinent sans carte graphique a quelques images par seconde, et chaque commande
 * part en retard. Avec trente secondes, la partie s'est terminee pendant que Bob
 * allait au contact: ses signes vitaux montraient deja l'ecran de fin (run
 * 34522355452).
 */
const PARTIE_EPUREE = {
  dureePartieS: '60',
  nombreBotsInitial: '100',
  'bonus.types.invincibilite.actif': false,
  'malus.actifs': false,
  'zones.actives': false,
  'botsNoirs.actifs': false,
} as const;

/**
 * Le telephone de Bob: le cadrage, le tactile et l'identite du Pixel 7, a la densite de un.
 *
 * Sans carte graphique, les deux pages d'une partie partagent le processeur pour
 * dessiner. Avec la vraie densite du Pixel 7 (2,625, soit sept fois plus de pixels
 * a calculer), toutes deux tombaient a cinq images par seconde pendant la partie,
 * contre neuf a la densite de un: mesure du 10 septembre 2026, une partie a la
 * fois. Or la saisie n'est lue qu'a chaque image, et cette lenteur retardait
 * chaque commande. Le parcours solo, seul dans sa page, joue le Pixel 7 a sa vraie
 * densite.
 */
const TELEPHONE_DE_BOB: BrowserContextOptions = { ...devices['Pixel 7'], deviceScaleFactor: 1 };

/**
 * Temps laisse a une page pour montrer l'annonce d'une capture, en millisecondes.
 *
 * Plusieurs pages qui dessinent sans carte graphique peuvent recevoir un message
 * quelques secondes apres le serveur: c'est mesure, pas suppose.
 */
const DELAI_ANNONCE_MS = 15_000;

/** Un joueur et son appareil. */
interface Appareil {
  readonly page: Page;
  readonly erreurs: readonly string[];
  /** Les annonces montrees a ce joueur, dans leur ordre d'apparition. */
  readonly annonces: readonly string[];
  /** Ce que la page dit d'elle-meme, pour expliquer un echec. */
  readonly signes: SignesVitaux;
  fermer(): Promise<void>;
}

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('deux joueurs, une capture, un seul et meme classement', async ({ browser }) => {
  // Deux chargements de carte, une partie d'une minute et son compte a rebours.
  test.setTimeout(180_000);

  const alice = await ouvrir(browser, devices['Desktop Chrome']);
  const bob = await ouvrir(browser, TELEPHONE_DE_BOB);

  try {
    // -- Le salon, vu des deux cotes ------------------------------------------
    await entrer(alice.page, jeu.url, 'Alice');
    await entrer(bob.page, jeu.url, 'Bob');

    for (const { page } of [alice, bob]) {
      await expect(page.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
      await expect(page.locator('.carte-joueur')).toHaveCount(2);
      await expect(
        page.locator('.carte-joueur', { hasText: 'Alice' }).locator('.badge-hote'),
      ).toBeVisible();
      await expect(
        page.locator('.carte-joueur', { hasText: 'Bob' }).locator('.badge-hote'),
      ).toHaveCount(0);
    }

    await expect(bob.page.getByRole('button', { name: 'Lancer la partie' })).toBeHidden();
    await expect(bob.page.getByRole('button', { name: 'Réglages', exact: true })).toBeHidden();

    await regler(alice.page, PARTIE_EPUREE);

    const recapitulatifs = [alice, bob].map(({ page }) => page.locator('.recapitulatif'));
    for (const recapitulatif of recapitulatifs) {
      await expect(recapitulatif).toContainText('1:00');
      await expect(recapitulatif).toContainText('100');
    }
    const [chezAlice, chezBob] = await Promise.all(
      recapitulatifs.map(async (recapitulatif) => recapitulatif.textContent()),
    );
    expect(chezBob).toBe(chezAlice);

    // -- Le lancement ----------------------------------------------------------
    await lancer(alice.page);

    for (const { page } of [alice, bob]) {
      await expect(page.getByText('La partie commence dans')).toBeVisible();
    }

    await Promise.all([attendreLaPartie(alice.page), attendreLaPartie(bob.page)]);

    for (const { page } of [alice, bob]) {
      await expect(page.locator('.hud-classement')).toContainText('Alice');
      await expect(page.locator('.hud-classement')).toContainText('Bob');
    }

    // -- La capture ------------------------------------------------------------
    const partie = jeu.partie();
    const clavier = commandeAuClavier(alice.page);
    const pouce = await commandeAuPouce(bob.page);

    await expliquerLEchec({ Alice: alice.signes, Bob: bob.signes }, async () => {
      // Chacun prend d'abord des ninjas, pour que la capture en transfere.
      await Promise.all([
        accomplir(capturerUnFauxNinja(partie, 'Alice', clavier)),
        accomplir(capturerUnFauxNinja(partie, 'Bob', pouce)),
      ]);

      // Puis Bob va jusqu'a Alice, qui l'attend.
      await accomplir(
        allerAuContact(partie, 'Bob', 'Alice', pouce, () =>
          Object.values(partie.etat.joueurs).some((joueur) => joueur.captures > 0),
        ),
      );
    });

    const { attaquant, victime } = rolesDeLaCapture(
      joueurNomme(partie, 'Alice'),
      joueurNomme(partie, 'Bob'),
    );
    const annoncesDe = (joueur: Joueur): readonly string[] =>
      (joueur.pseudo === 'Alice' ? alice : bob).annonces;
    const transferes = attaquant.botsGagnesAuTotal;

    await expect
      .poll(() => annoncesDe(attaquant), { timeout: DELAI_ANNONCE_MS })
      .toContain(
        `Vous avez capturé ${victime.pseudo} : +${String(transferes)} ${transferes > 1 ? 'ninjas' : 'ninja'}`,
      );
    await expect
      .poll(() => annoncesDe(victime), { timeout: DELAI_ANNONCE_MS })
      .toContain(`Capturé par ${attaquant.pseudo} !`);

    // -- La fin, identique des deux cotes et conforme au serveur ---------------
    await Promise.all([attendreLaFin(alice.page), attendreLaFin(bob.page)]);

    const attendu = classementDuServeur(partie);
    expect(attendu.find((ligne) => ligne[1] === attaquant.pseudo)?.[4]).toBe('1');
    expect(await classementAffiche(alice.page)).toEqual(attendu);
    expect(await classementAffiche(bob.page)).toEqual(attendu);

    for (const { page } of [alice, bob]) {
      await page.locator('.fin-actions').getByRole('button', { name: 'Accueil' }).click();
      await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'accueil');
    }

    expect(alice.erreurs).toEqual([]);
    expect(bob.erreurs).toEqual([]);
  } finally {
    await alice.fermer();
    await bob.fermer();
  }
});

/** Ouvre un appareil: un contexte de navigateur a lui, et une page. */
async function ouvrir(browser: Browser, options: BrowserContextOptions): Promise<Appareil> {
  const contexte = await browser.newContext(options);
  const page = await contexte.newPage();

  return {
    page,
    erreurs: releverLesErreurs(page),
    annonces: await releverLesAnnonces(page),
    signes: await releverLesSignesVitaux(page),
    fermer: async () => contexte.close(),
  };
}

/** Qui a capture qui, lu dans les compteurs du serveur apres une seule capture. */
function rolesDeLaCapture(
  premier: Joueur,
  second: Joueur,
): { readonly attaquant: Joueur; readonly victime: Joueur } {
  if (premier.captures + second.captures !== 1) {
    throw new Error(
      `Une seule capture etait attendue, le serveur en compte ${String(premier.captures + second.captures)}.`,
    );
  }

  return premier.captures === 1
    ? { attaquant: premier, victime: second }
    : { attaquant: second, victime: premier };
}
