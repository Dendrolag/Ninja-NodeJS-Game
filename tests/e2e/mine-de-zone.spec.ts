import { expect, test } from '@playwright/test';

import { commandeAuClavier, commandeAuPouce } from './harnais/commandes.js';
import {
  armerUneMineDeZone,
  attendreLaPartie,
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
 * Les mines de zone dans une vraie partie (etape 7.12), du reglage a la zone ouverte.
 *
 * La carte pose une mine de zone toutes les cinq secondes, dix au plus, et les objets et les
 * Black Ninjas sont coupes. Alice marche sur la plus proche: elle s'arme, et trois secondes
 * plus tard la zone s'ouvre a sa place, au rayon fixe de 220 pixels. Une capture d'ecran
 * montre la mine armee, une autre la zone ouverte et les mines qui attendent (jointes au
 * rapport, a relire a l'oeil).
 *
 * Le scenario n'ecrit jamais dans le serveur: il y lit ou sont Alice et les mines, pour la
 * guider.
 */

/** Combien de temps Alice a pour atteindre une mine de zone. */
const DELAI_D_ARMEMENT_MS = 60_000;

let jeu: ServeurDeJeu;

test.beforeEach(async () => {
  jeu = await demarrerLeJeu();
});

test.afterEach(async () => {
  await jeu.arreter();
});

test('armer une mine de zone, et voir sa zone s ouvrir', async ({ page, hasTouch }, infos) => {
  test.setTimeout(150_000);

  const erreurs = releverLesErreurs(page);
  const signes = await releverLesSignesVitaux(page);

  await entrer(page, jeu.url, 'Alice');
  await regler(page, {
    dureePartieS: '120',
    evade: false,
    'botsNoirs.actifs': false,
    'malus.actifs': false,
    'bonus.types.vitesse.actif': false,
    'bonus.types.invincibilite.actif': false,
    'bonus.types.revelation.actif': false,
    'objetsDePoche.fumee.actif': false,
    'objetsDePoche.mine.actif': false,
    'zones.intervalleApparitionS': '5',
    'zones.minesMaximum': '10',
  });
  await expect(page.locator('.recapitulatif')).toContainText('10 au plus');
  await lancer(page);
  await attendreLaPartie(page);
  const partie = jeu.partie();

  // La premiere mine de zone se pose au bout de l'intervalle, et aucune zone ne nait seule.
  await expect
    .poll(() => Object.keys(partie.etat.minesDeZone ?? {}).length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  expect(Object.keys(partie.etat.zones)).toEqual([]);

  const commande = hasTouch ? await commandeAuPouce(page) : commandeAuClavier(page);

  await expliquerLEchec({ Alice: signes }, async () => {
    await expect(async () => {
      await accomplir(armerUneMineDeZone(partie, 'Alice', commande));
    }).toPass({ timeout: DELAI_D_ARMEMENT_MS });
  });
  const armee = Object.values(partie.etat.minesDeZone ?? {}).find(
    (mine) => mine.avantOuvertureMs !== undefined,
  );
  await commande.relacher();
  // La mine armee, le bord de sa zone qui se trace (jointe au rapport, a relire a l'oeil).
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: infos.outputPath('mine-de-zone-armee.png') });

  await expect.poll(() => Object.values(partie.etat.zones).length, { timeout: 10_000 }).toBe(1);
  const [zone] = Object.values(partie.etat.zones);
  expect(zone?.rayon).toBe(220);
  // La zone s'ouvre a la place de la mine qu'Alice a armee, a deux pas d'elle.
  if (armee !== undefined) {
    expect(zone?.centre).toEqual(armee.position);
  }
  const alice = joueurNomme(partie, 'Alice').position;
  expect(Math.hypot(alice.x - (zone?.centre.x ?? 0), alice.y - (zone?.centre.y ?? 0))).toBeLessThan(
    220,
  );

  await page.screenshot({ path: infos.outputPath('mine-de-zone.png') });
  expect(erreurs).toEqual([]);
});
