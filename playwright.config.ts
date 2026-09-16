import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour les tests de bout en bout.
 *
 * A l'etape 0.1, il n'y avait qu'un scenario de fumee qui ne demarrait aucun
 * serveur. L'etape 4.2 a ajoute le banc de mesure du rendu, qui charge la
 * compilation du paquet client dans un vrai navigateur: d'ou l'etape de
 * compilation ci-dessous. Les etapes 4.3 et 4.4 ont ajoute les parcours sur le
 * vrai jeu: la navigation, le parcours solo et la partie a deux joueurs.
 *
 * AUCUN BLOC webServer. Chaque scenario de parcours demarre son propre serveur de
 * jeu dans son processus (harnais/serveur-de-jeu.ts), sur un port libre: deux
 * scenarios paralleles ne se retrouvent donc pas dans le meme salon, et le
 * scenario peut lire l'etat du serveur pour arbitrer ce que les pages affichent.
 *
 * Le projet mobile existe parce que la decision du 29 juin exige une verification
 * en fenetre mobile, meme si le bureau reste prioritaire.
 */
/** Le banc de mesure du rendu, joue par son propre projet et par lui seul. */
const BANC = '**/banc-rendu.spec.ts';

/**
 * La partie a deux joueurs, jouee par le seul projet bureau.
 *
 * Elle fabrique elle-meme ses deux appareils, un ordinateur et un telephone: la
 * rejouer dans le projet mobile doublerait sa duree pour la meme verification.
 */
const MULTIJOUEUR = '**/multijoueur.spec.ts';

/**
 * Les scenarios de la reprise des ecrans du jalon 3, joues par le seul projet bureau.
 *
 * Celui des parties fabrique lui-meme ses deux appareils. Celui du compte joue une
 * partie entiere; le cadrage mobile, deja eprouve par la navigation et le parcours
 * solo, doublerait sa duree sans rien verifier de plus.
 */
const PARTIES = '**/parties.spec.ts';
const COMPTE = '**/compte.spec.ts';

/**
 * Le retour dans sa partie apres un rechargement (etape 2.5), joue par le seul projet
 * bureau: il verifie le lien et la place, que le cadrage de l'ecran ne change pas, et
 * charge deux fois la carte.
 */
const RETOUR = '**/retour.spec.ts';

/**
 * La gestion du mot de passe (etape 3.4), jouee par le seul projet bureau: elle
 * verifie des formulaires et des sessions, que le cadrage de l'ecran ne change pas.
 */
const MOT_DE_PASSE = '**/mot-de-passe.spec.ts';

/**
 * Le lien perdu hors partie (etape 2.6), joue par le seul projet bureau: il eteint et
 * rallume le serveur sous une page, ce que le cadrage de l'ecran ne change pas.
 */
const LIEN = '**/lien.spec.ts';

/**
 * Le mode Equipes (etape 7.2), joue par le seul projet bureau: il fabrique lui-meme son
 * ordinateur et son telephone, et lit le salon en equipes sur les deux.
 */
const EQUIPES = '**/equipes.spec.ts';

export default defineConfig({
  testDir: './tests/e2e',
  // Les paquets sont compiles une fois avant les scenarios: le banc de mesure du
  // rendu charge packages/client/dist dans le navigateur, et une compilation
  // perimee lui ferait mesurer un code qui n'est plus le notre.
  globalSetup: './tests/e2e/harnais/compiler.ts',
  fullyParallel: true,
  // Interdit un test.only oublie dans une branche poussee.
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  // Une seule partie a la fois en integration continue. Sans carte graphique et
  // sur deux processeurs, deux scenarios de parties en parallele faisaient
  // dessiner quatre pages a la fois: les signes vitaux du run 34522355452 en
  // relevaient deux a sept images en deux secondes, et la partie a deux se
  // terminait avant que les joueurs se soient rejoints.
  //
  // Quatre a la fois en local. La valeur par defaut de Playwright, la moitie des
  // processeurs logiques, en lance huit sur la machine de developpement; sans carte
  // graphique, les pages des parcours s'y privaient de processeur au point de perdre
  // leur connexion au serveur de jeu ou de depasser leurs delais. Mesure a l'etape
  // 5.4: cinq passages complets sur six a huit en parallele comptaient un ou deux
  // echecs, jamais sur le meme scenario, sur la version courante comme sur celle
  // d'avant la pluie de Rainy Tokyo; deux passages a quatre, 25 scenarios sur 25,
  // en un peu plus de deux minutes, soit la meme duree.
  //
  // Trois a la fois depuis l'etape 2.5, qui a ajoute le scenario du rechargement de
  // page, et avec lui deux chargements de carte. A quatre, deux passages complets
  // sur trois ont compte un echec: une page restee a l'accueil avait perdu son lien,
  // la fragilite relevee a l'etape 5.4. Sans ce scenario, 26 sur 26 a quatre; avec
  // lui, a trois, 26 sur 26 deux fois, en 2,6 et 2,8 minutes.
  workers: process.env['CI'] ? 1 : 3,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'on-first-retry',
    // Sans limite, une action qui ne trouve jamais son element attend jusqu'au
    // delai du scenario entier, soit trois minutes pour la partie a deux joueurs,
    // et l'echec ne dit pas ou. Quinze secondes couvrent largement une page qui
    // se charge sur une machine lente.
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'bureau',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: BANC,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testIgnore: [BANC, MULTIJOUEUR, PARTIES, COMPTE, RETOUR, MOT_DE_PASSE, LIEN, EQUIPES],
    },
    // Le banc de mesure du rendu a son propre projet, et une seule execution:
    // il mesure le moteur de rendu, pas la taille de la fenetre. Le jouer dans
    // les deux cadrages doublerait la duree de l'integration continue pour un
    // second chiffre qui ne dirait rien de plus.
    {
      name: 'banc',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // On demande la carte graphique quand il y en a une. Sans ces options,
          // Chromium sans interface rasterise tout au processeur, et la mesure
          // ne dit plus rien du moteur de rendu. La ou il n'y a pas de carte,
          // comme en integration continue, elles sont sans effet et le rendu
          // logiciel reprend la main: c'est pourquoi les seuils de ce banc
          // portent sur la mise a l'echelle et sur notre propre cout, et non sur
          // une cadence absolue.
          args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'],
        },
      },
      testMatch: BANC,
      // Le banc joue apres tous les autres scenarios, donc seul. Depuis l'etape
      // 4.4, les parcours jouent des parties entieres qui dessinent pendant une
      // quarantaine de secondes. Joue en parallele d'eux, le banc partageait le
      // processeur et mesurait aussi leur charge: en integration continue, notre
      // code a couru 8,04 ms par image a 500 sprites, au-dela de son seuil, contre
      // 3,01 a 3,46 ms aux etapes 4.2 et 4.3.
      dependencies: ['bureau', 'mobile'],
      // Une mesure ne se rejoue pas: un banc qui echoue a la premiere tentative
      // et passe a la seconde ne dit rien, sinon que la machine etait occupee.
      retries: 0,
    },
  ],
});
