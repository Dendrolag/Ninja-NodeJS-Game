/**
 * Le banc de mesure du rendu: PixiJS tient-il la charge visee.
 *
 * C'EST LA MESURE QUE LA FICHE DE L'ETAPE 4.2 EXIGE, et c'est elle qui justifie
 * ou non le choix du moteur de rendu. Le jeu vise plus de cent bots a l'ecran; le
 * jeu d'origine, en canevas 2D avec un flou par entite, s'essoufflait bien avant.
 * On mesure donc a 100, 200 et 500 sprites animes.
 *
 * IL FAIT TOURNER LE VRAI CODE. Un banc qui mesurerait un extrait ecrit pour
 * l'occasion ne dirait rien: la page charge la compilation du paquet client,
 * construit ses scenes avec construireScene et les pose avec monterRendu, exactement
 * comme le fera le jeu. La lueur neon est active. Depuis l'etape 5.4, elle ne couvre
 * plus que les fleches de localisation et non les sprites: les series avec et sans
 * lueur doivent donc rester proches.
 *
 * DEUX NOMBRES SONT RELEVES, ET ILS NE DISENT PAS LA MEME CHOSE.
 *
 *   - LES IMAGES PAR SECONDE, qui dependent de la machine et de sa carte
 *     graphique. C'est ce que le joueur ressent, et c'est la mesure demandee.
 *   - LE COUT PAR IMAGE DE NOTRE PROPRE CODE, c'est-a-dire le temps passe a
 *     construire la scene et a la transmettre a PixiJS, hors dessin. C'est le
 *     seul des deux qui mesure notre travail plutot que le materiel, et c'est
 *     donc lui qui porte les seuils stricts. Il doit rester une petite fraction
 *     du budget d'une image.
 *
 * LES SEUILS DE CADENCE DEPENDENT DE QUI DESSINE. En integration continue, le
 * navigateur n'a pas de carte graphique: SwiftShader rasterise tout au
 * processeur, a trois ou quatre images par seconde quelle que soit la charge,
 * et chaque sprite y coute son poids en pixels calcules un par un. Mesurer la
 * cadence la-bas, c'est mesurer SwiftShader, pas notre rendu: le premier passage
 * en CI l'a montre en echouant sur un plancher calibre sur une autre machine.
 * Le banc detecte donc le moteur qui dessine.
 *
 *   - Sur une vraie carte graphique, il exige la cadence et la mise a l'echelle:
 *     c'est la que la charge visee se valide.
 *   - En rendu logiciel, il n'exige que ce qui ne depend pas du materiel: notre
 *     propre cout par image, toutes les entites dessinees, des images qui
 *     avancent.
 *
 * Les valeurs mesurees dans les deux situations sont consignees dans le handoff
 * de l'etape, avec la machine.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** Les charges mesurees, en nombre de sprites animes simultanement. */
const CHARGES = [100, 200, 500] as const;

/** Duree de chaque mesure, en millisecondes. */
const DUREE_MESURE_MS = 3_000;

/**
 * Plancher d'images par seconde sur une vraie carte graphique, a toutes les
 * charges.
 *
 * La moitie de la cadence d'un ecran ordinaire. Mesure sur carte graphique a
 * l'etape 4.2: soixante, plafonne par la synchronisation de l'ecran, a 100, 200
 * et 500 sprites.
 */
const PLANCHER_GPU_IMAGES_PAR_SECONDE = 30;

/**
 * Plancher d'images par seconde en rendu logiciel: les images doivent avancer,
 * rien de plus.
 *
 * Mesure en integration continue a l'etape 4.2: 2,7 images par seconde au plus
 * bas, a 500 sprites avec lueur. Sous un, le rendu ne rend plus.
 */
const PLANCHER_LOGICIEL_IMAGES_PAR_SECONDE = 1;

/**
 * Les moteurs de rendu qui ne sont pas une carte graphique.
 *
 * SwiftShader est celui de Chromium sans GPU, llvmpipe et softpipe ceux de Mesa
 * sous Linux, et le pilote de base de Windows s'annonce comme tel.
 */
const RENDU_LOGICIEL = /swiftshader|llvmpipe|softpipe|software|basic render/iu;

/**
 * Part de la cadence a cent sprites qui doit survivre a cinq cents, sur carte
 * graphique.
 *
 * C'est le seuil qui valide reellement le choix du moteur de rendu: voir la note
 * qui accompagne son usage.
 */
const PART_CONSERVEE_A_CINQ_CENTS = 0.5;

/** Plafond du cout de notre propre code, par image, en millisecondes. */
const PLAFOND_COUT_PROPRE_MS = 8;

/**
 * Le ralentissement du processeur qui approche un telephone d'entree de gamme, comme a
 * la mesure du client de l'etape 5.2 (section 11.9 de docs/mesures/charge-serveur.md):
 * Chromium ralentit lui-meme son processeur, comme dans ses outils de developpement.
 */
const RALENTISSEMENT_TELEPHONE = 6;

/**
 * Les charges mesurees au processeur ralenti: les plafonds de faux ninjas de Tokyo et
 * de Spirit & Time (etape 7.6), joueurs et Black Ninjas en plus comptes large.
 */
const CHARGES_TELEPHONE = [300, 500] as const;

/**
 * L'echauffement de chaque charge de la serie telephone, non compte. Au processeur
 * ralenti, la premiere seconde d'une charge nouvelle paie la compilation du code et la
 * creation des sprites: mesuree avec le reste, elle doublait la pointe (etape 7.6).
 */
const ECHAUFFEMENT_TELEPHONE_MS = 1_000;

/** Les joueurs d'une vraie partie pleine, pour la composition de la serie telephone. */
const JOUEURS_D_UNE_PARTIE_PLEINE = 12;

/**
 * Plafond du cout de notre propre code au processeur ralenti six fois, a 500 entites
 * toutes a l'ecran comme au cadrage d'un telephone: le quart du budget d'une image a
 * soixante images par seconde (etape 5.7). Les trois quarts restants sont a PixiJS et
 * au navigateur.
 */
const PLAFOND_COUT_PROPRE_TELEPHONE_MS = 16.7 / 4;

/**
 * La fenetre d'un telephone tenu en paysage, celle du Pixel 7 du projet mobile.
 *
 * La serie au cadrage d'un telephone (etape 5.7) la prend, avec la camera serree du jeu
 * sur telephone: c'est ce qui decide combien d'entites la camera montre.
 */
const FENETRE_TELEPHONE = { width: 915, height: 412 } as const;

/**
 * Les charges de la serie au cadrage d'un telephone, chacune sur la carte dont elle est
 * le plafond de faux ninjas (etape 7.6): 300 sur Tokyo, 500 sur Spirit & Time.
 */
const CHARGES_CADRAGE_TELEPHONE = [
  { entites: 300, carte: 'map1' },
  { entites: 500, carte: 'map3' },
] as const;

/** Le resultat d'une mesure. */
interface Mesure {
  readonly sprites: number;
  readonly imagesParSeconde: number;
  readonly coutMoyenMs: number;
  readonly coutMaximumMs: number;
  /**
   * Le temps que PixiJS passe sur le processeur, par image, a preparer et envoyer le
   * dessin: transformations, collecte des sprites, lots. Hors de notre code, mais un
   * telephone le paie aussi, et c'est lui que le tri par la camera allege (etape 5.7).
   */
  readonly coutPixiMs: number;
  readonly entitesDessinees: number;
  /** Les personnages que le rendu affiche a la derniere image (etape 5.7). */
  readonly personnagesAffiches: number;
  /** Les entites de la derniere scene que la camera montre, marge comprise. */
  readonly personnagesDansLeChamp: number;
}

/** Comment jouer une serie de mesures. */
interface OptionsSerie {
  /** Les joueurs d'une vraie partie; la composition de l'etape 4.2 sans eux. */
  readonly joueurs?: number;
  readonly dureeMs?: number;
  /**
   * Remonter le rendu avant la serie, ce que fait toute serie par defaut. Une mesure qui
   * suit son echauffement ne le remonte pas: remonte, le rendu renverrait ses textures a
   * la carte graphique, et l'echauffement n'aurait rechauffe que le code (etape 5.7).
   */
  readonly remonter?: boolean;
  /** La carte montee, Tokyo par defaut. */
  readonly carte?: 'map1' | 'map3';
  /**
   * Les entites reparties sur toute la carte, et la camera serree du jeu sur telephone.
   * Sinon, toutes les entites tournent autour du centre, devant une camera de bureau.
   */
  readonly cadrageTelephone?: boolean;
}

/** La page du banc: elle charge le vrai code et rend une fonction de mesure. */
function pageDuBanc(): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>Banc de rendu Neon Ninja</title>
<style>html,body{margin:0;height:100%;overflow:hidden}#terrain{width:100vw;height:100vh}</style>
<div id="terrain"></div>
<script type="importmap">${CARTE_IMPORTATION}</script>
<script type="module">
  import { monterRendu, prechargerLesSprites } from '/paquets/client/rendu/pixi.js';
  import { construireScene } from '/paquets/client/rendu/scene.js';
  import { TamponDeLissage } from '/paquets/client/rendu/interpolation.js';
  import { cameraSur, dansLaZone, suivre, zoneVisible } from '/paquets/client/rendu/camera.js';
  import { MARGE_HORS_CHAMP_PX } from '/paquets/client/rendu/apparence.js';
  import { ETAT_INITIAL } from '/paquets/client/etat.js';

  const CARTES = { map1: { largeur: 2000, hauteur: 1500 }, map3: { largeur: 3000, hauteur: 2000 } };
  let CARTE = CARTES.map1;
  const DIRECTIONS = ['nord', 'nord_est', 'est', 'sud_est', 'sud', 'sud_ouest', 'ouest', 'nord_ouest'];
  const COULEURS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];

  /**
   * Fabrique un instantane de partie a un tour donne.
   *
   * Les entites tournent sur des cercles de rayons differents: elles bougent
   * toutes, en permanence, et pas deux a la meme vitesse. Une scene ou rien ne
   * bouge ne mesurerait rien, PixiJS n'ayant alors aucune position a transmettre.
   *
   * Sans nombre de joueurs, la composition est celle de l'etape 4.2, gardee pour
   * comparer: un sprite sur quatre est un joueur, avec son pseudo. Avec un nombre de
   * joueurs, elle est celle d'une vraie partie (etape 7.6): ces joueurs-la, un Black
   * Ninja par centaine d'entites, et des faux ninjas pour le reste.
   */
  function natureDe(index, joueurs) {
    if (joueurs === undefined) {
      return index === 0 ? 'joueur' : index % 25 === 0 ? 'botNoir' : index % 4 === 0 ? 'joueur' : 'bot';
    }

    return index < joueurs ? 'joueur' : index % 100 === 99 ? 'botNoir' : 'bot';
  }

  /**
   * Le centre et le rayon du cercle d'une entite. Autour du centre de la carte, toutes
   * devant la camera; ou repartis sur toute la carte comme dans une vraie partie (etape
   * 5.7), par une suite qui couvre la surface sans amas ni vide, la meme a chaque fois.
   */
  function cercleDe(index, repartie) {
    if (!repartie) {
      return { x: CARTE.largeur / 2, y: CARTE.hauteur / 2, rayon: 150 + (index % 17) * 35 };
    }

    return {
      x: CARTE.largeur * ((0.5 + index * 0.7548776662) % 1),
      y: CARTE.hauteur * ((0.5 + index * 0.569840291) % 1),
      rayon: 20 + (index % 7) * 6,
    };
  }

  function instantane(tick, nombre, tour, joueurs, repartie) {
    const entites = [];

    for (let index = 0; index < nombre; index += 1) {
      const cercle = cercleDe(index, repartie);
      const angle = tour * (0.4 + (index % 11) * 0.05) + index;

      entites.push({
        type: natureDe(index, joueurs),
        id: 'e' + index,
        x: cercle.x + Math.cos(angle) * cercle.rayon,
        y: cercle.y + Math.sin(angle) * cercle.rayon * 0.7,
        couleur: COULEURS[index % COULEURS.length],
        direction: DIRECTIONS[Math.floor(angle / 0.8) % DIRECTIONS.length],
        pseudo: 'j' + index,
        invincible: false,
        protege: false,
      });
    }

    return {
      tick,
      tempsRestantMs: 120000,
      enPause: false,
      entites,
      objets: [
        { id: 'o1', categorie: 'bonus', nature: 'vitesse', x: 400, y: 400, dureeDeVieRestanteMs: 8000 },
        { id: 'o2', categorie: 'malus', nature: 'flou', x: 900, y: 700, dureeDeVieRestanteMs: 2000 },
      ],
      zones: [
        { id: 'z1', type: 'chaos', x: 700, y: 500, rayon: 180, dureeRestanteMs: 9000 },
      ],
      classement: [],
    };
  }

  let rendu;
  /** Le temps passe par PixiJS a preparer le dessin, cumule depuis le debut de la mesure. */
  let tempsPixiMs = 0;

  await prechargerLesSprites();

  /**
   * Monte le rendu, avec ou sans la lueur neon.
   *
   * Mesurer les deux est ce qui chiffre le prix du filtre: c'est le coeur du
   * choix technique de cette etape, et une affirmation non chiffree ne vaut rien.
   */
  window.preparer = async (lueur, identifiant = 'map1') => {
    rendu?.detruire();
    document.querySelector('#terrain').replaceChildren();
    CARTE = CARTES[identifiant];

    rendu = await monterRendu({
      hote: document.querySelector('#terrain'),
      carte: CARTE,
      identifiantCarte: identifiant,
      modeMiroir: false,
      pluie: true,
      lueur,
    });

    await rendu.chargerLeDecor();

    // PixiJS dessine a chaque image par renderer.render, appele depuis son propre
    // minuteur: on le chronometre sans rien changer a ce qu'il fait.
    const renderer = rendu.application.renderer;
    const rendre = renderer.render.bind(renderer);
    renderer.render = (...parametres) => {
      const avant = performance.now();
      rendre(...parametres);
      tempsPixiMs += performance.now() - avant;
    };
  };

  await window.preparer(true);

  /**
   * Mesure une charge donnee pendant une duree donnee.
   *
   * On compte les images reellement produites par le navigateur et on chronometre
   * separement ce que NOTRE code consomme dans chacune.
   */
  window.mesurer = async (sprites, dureeMs, joueurs, cadrageTelephone) => {
    const etat = { ...ETAT_INITIAL, ecran: 'jeu', moi: 'e0' };
    const tampon = new TamponDeLissage();
    const taille = { largeur: window.innerWidth, hauteur: window.innerHeight };

    let camera = cameraSur({ x: CARTE.largeur / 2, y: CARTE.hauteur / 2 }, taille, CARTE, cadrageTelephone);
    let tick = 0;
    let images = 0;
    let cumulMs = 0;
    let maximumMs = 0;
    let entitesDessinees = 0;
    let derniereScene;
    let precedent;

    const debut = performance.now();
    tempsPixiMs = 0;

    await new Promise((termine) => {
      const image = (instant) => {
        // Un nouveau battement toutes les cinquante millisecondes, comme le
        // serveur: le lissage travaille donc dans les memes conditions qu'en jeu.
        const battement = Math.floor((instant - debut) / 50);

        if (battement > tick) {
          tick = battement;
          tampon.observer(instantane(tick, sprites, tick * 0.05, joueurs, cadrageTelephone), instant);
        }

        const avant = performance.now();
        const lissee = tampon.vueLissee(instant);
        const scene = construireScene(etat, lissee, instant);
        camera = suivre(camera, { x: camera.x, y: camera.y }, taille, CARTE, precedent === undefined ? 0 : instant - precedent);
        rendu.dessiner(scene, camera);
        const cout = performance.now() - avant;

        precedent = instant;
        images += 1;
        cumulMs += cout;
        maximumMs = Math.max(maximumMs, cout);
        entitesDessinees = scene.entites.length;
        derniereScene = scene;

        if (instant - debut >= dureeMs) {
          termine();
          return;
        }

        requestAnimationFrame(image);
      };

      requestAnimationFrame(image);
    });

    const ecoule = performance.now() - debut;

    // Ce que le rendu affiche, compte dans PixiJS, contre ce que la camera montre, compte
    // ici: le tri par la camera ne doit rien cacher de ce qui se voit (etape 5.7).
    const champ = zoneVisible(camera, taille, MARGE_HORS_CHAMP_PX);
    const calque = rendu.application.stage.getChildByLabel('personnages', true);
    const personnagesAffiches = calque.children.filter((personnage) => personnage.visible).length;
    const personnagesDansLeChamp = derniereScene.entites.filter((entite) =>
      dansLaZone(champ, entite.x, entite.y),
    ).length;

    return {
      sprites,
      imagesParSeconde: (images * 1000) / ecoule,
      coutMoyenMs: cumulMs / images,
      coutMaximumMs: maximumMs,
      coutPixiMs: tempsPixiMs / images,
      entitesDessinees,
      personnagesAffiches,
      personnagesDansLeChamp,
    };
  };

  /**
   * Qui dessine reellement: une vraie carte graphique, ou le rendu logiciel.
   *
   * Sans cette information, deux mesures ecartees d'un facteur six seraient
   * incomprehensibles. Elle est ecrite dans le rapport a cote des chiffres.
   */
  window.quiDessine = () => {
    const canevas = document.createElement('canvas');
    const gl = canevas.getContext('webgl2') ?? canevas.getContext('webgl');

    if (gl === null) {
      return 'aucun contexte WebGL';
    }

    const info = gl.getExtension('WEBGL_debug_renderer_info');

    return info === null ? gl.getParameter(gl.RENDERER) : gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
  };

  window.bancPret = true;
</script>`;
}

let serveur: ServeurStatique;

test.beforeAll(async () => {
  serveur = await demarrerServeurStatique({ '/banc.html': pageDuBanc() });
});

test.afterAll(async () => {
  await serveur.arreter();
});

/**
 * Ouvre la page du banc et attend qu'elle soit prete.
 *
 * Les erreurs de la page sont recueillies et rejouees dans le message d'echec: sans
 * cela, un module qui ne se charge pas se manifeste par une attente qui expire, ce qui
 * ne dit rien de la cause.
 */
async function ouvrirLeBanc(page: Page): Promise<void> {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreurs.push(message.text());
    }
  });

  await page.goto(`${serveur.url}/banc.html`);

  try {
    await page.waitForFunction(
      () => (window as unknown as { bancPret?: boolean }).bancPret === true,
      { timeout: 30_000 },
    );
  } catch (echec) {
    const detail = erreurs.length === 0 ? '(aucune)' : erreurs.join(' | ');
    throw new Error(`Le banc ne s'est pas initialise. Erreurs de la page: ${detail}`, {
      cause: echec,
    });
  }

  expect(erreurs, 'la page du banc ne doit lever aucune erreur').toEqual([]);
}

/** Joue une serie de mesures, lueur allumee ou eteinte, a ces charges. */
async function mesurerUneSerie(
  page: Page,
  lueur: boolean,
  charges: readonly number[],
  options: OptionsSerie = {},
): Promise<Mesure[]> {
  if (options.remonter !== false) {
    await page.evaluate(
      async ([avecLueur, carte]) =>
        (window as unknown as { preparer: (l: boolean, c: string) => Promise<void> }).preparer(
          avecLueur,
          carte,
        ),
      [lueur, options.carte ?? 'map1'] as const,
    );
  }

  const relevees: Mesure[] = [];

  for (const sprites of charges) {
    relevees.push(
      (await page.evaluate(
        async ([nombre, duree, presents, telephone]) =>
          (
            window as unknown as {
              mesurer: (n: number, d: number, j: number | undefined, t: boolean) => Promise<Mesure>;
            }
          ).mesurer(nombre, duree, presents, telephone),
        [
          sprites,
          options.dureeMs ?? DUREE_MESURE_MS,
          options.joueurs,
          options.cadrageTelephone ?? false,
        ] as const,
      )) as Mesure,
    );
  }

  return relevees;
}

/**
 * Mesure une charge apres une seconde d'echauffement non comptee, sur le meme rendu.
 *
 * Au processeur ralenti, la premiere seconde d'une charge nouvelle paie la compilation du
 * code, la creation des sprites et l'envoi des textures a la carte graphique: mesuree avec
 * le reste, elle doublait la pointe (etape 7.6).
 */
async function mesurerApresEchauffement(
  page: Page,
  charge: number,
  options: OptionsSerie,
): Promise<Mesure> {
  await mesurerUneSerie(page, true, [charge], { ...options, dureeMs: ECHAUFFEMENT_TELEPHONE_MS });
  const [mesure] = await mesurerUneSerie(page, true, [charge], { ...options, remonter: false });

  return mesure as Mesure;
}

/** Une ligne du rapport: la cadence, notre cout et celui de PixiJS. */
function ligneDuRapport(mesure: Mesure): string {
  return (
    `  ${String(mesure.sprites).padStart(3)} sprites: ` +
    `${mesure.imagesParSeconde.toFixed(1)} images/s, ` +
    `cout propre ${mesure.coutMoyenMs.toFixed(2)} ms/image ` +
    `(pointe ${mesure.coutMaximumMs.toFixed(2)} ms), ` +
    `PixiJS ${mesure.coutPixiMs.toFixed(2)} ms/image, ` +
    `${String(mesure.personnagesAffiches)} affiches`
  );
}

/** Le rendu affiche exactement les personnages que la camera montre, marge comprise. */
function verifierLeChamp(mesure: Mesure): void {
  expect(mesure.entitesDessinees, 'la scene decrit toutes les entites').toBe(mesure.sprites);
  expect(
    mesure.personnagesAffiches,
    `${String(mesure.sprites)} sprites: le rendu doit afficher ce que la camera montre`,
  ).toBe(mesure.personnagesDansLeChamp);
}

/**
 * Joue les mesures au processeur ralenti six fois, comme un telephone d'entree de gamme,
 * chacune apres son echauffement. Rend les mesures, et si le rendu est logiciel.
 */
async function mesurerAuProcesseurRalenti(
  page: Page,
  charges: readonly (OptionsSerie & { readonly entites: number })[],
): Promise<{ readonly mesures: Mesure[]; readonly logiciel: boolean }> {
  await ouvrirLeBanc(page);

  const dessinePar = (await page.evaluate(() =>
    (window as unknown as { quiDessine: () => string }).quiDessine(),
  )) as string;
  const logiciel = RENDU_LOGICIEL.test(dessinePar);

  test.info().annotations.push({
    type: 'rendu',
    description: logiciel
      ? `logiciel (${dessinePar}): plafond de cout au processeur ralenti non exige`
      : `carte graphique (${dessinePar})`,
  });

  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: RALENTISSEMENT_TELEPHONE });

  const mesures: Mesure[] = [];

  for (const { entites, ...options } of charges) {
    mesures.push(await mesurerApresEchauffement(page, entites, options));
  }

  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  return { mesures, logiciel };
}

test.describe('banc de mesure du rendu PixiJS', () => {
  // Trois charges, trois secondes chacune, plus le chargement des images.
  test.setTimeout(60_000);

  test('tient la charge a 100, 200 et 500 sprites animes', async ({ page }) => {
    await ouvrirLeBanc(page);

    /** Joue une serie de mesures, lueur allumee ou eteinte. */
    const serie = async (lueur: boolean): Promise<Mesure[]> =>
      mesurerUneSerie(page, lueur, CHARGES);

    const dessinePar = (await page.evaluate(() =>
      (window as unknown as { quiDessine: () => string }).quiDessine(),
    )) as string;

    const logiciel = RENDU_LOGICIEL.test(dessinePar);

    // Le mode retenu apparait dans le rapport de Playwright: un banc qui a
    // renonce a une exigence doit le dire, pas le taire.
    test.info().annotations.push({
      type: 'rendu',
      description: logiciel
        ? `logiciel (${dessinePar}): cadence et mise a l'echelle non exigees`
        : `carte graphique (${dessinePar})`,
    });

    const avecLueur = await serie(true);
    const sansLueur = await serie(false);

    // Les valeurs mesurees sont ecrites dans le rapport: c'est ce qui permet de
    // les reporter dans le handoff, et de comparer d'une execution a l'autre.
    console.log(
      [
        '',
        'Banc de rendu PixiJS',
        `  dessine par: ${dessinePar}`,
        ...avecLueur.map((mesure, index) => {
          const sans = sansLueur[index];

          return (
            `  ${String(mesure.sprites).padStart(3)} sprites: ` +
            `${mesure.imagesParSeconde.toFixed(1)} images/s avec lueur, ` +
            `${sans === undefined ? '?' : sans.imagesParSeconde.toFixed(1)} sans lueur, ` +
            `cout propre ${mesure.coutMoyenMs.toFixed(2)} ms/image ` +
            `(pointe ${mesure.coutMaximumMs.toFixed(2)} ms), ` +
            `PixiJS ${mesure.coutPixiMs.toFixed(2)} ms/image`
          );
        }),
        '',
      ].join('\n'),
    );

    const plancher = logiciel
      ? PLANCHER_LOGICIEL_IMAGES_PAR_SECONDE
      : PLANCHER_GPU_IMAGES_PAR_SECONDE;

    for (const mesure of [...avecLueur, ...sansLueur]) {
      verifierLeChamp(mesure);

      // Le seuil qui porte partout: notre propre code doit rester une petite
      // fraction du budget d'une image, quelle que soit la charge et quel que
      // soit le materiel.
      expect(
        mesure.coutMoyenMs,
        `${String(mesure.sprites)} sprites: notre propre code coute trop cher par image`,
      ).toBeLessThan(PLAFOND_COUT_PROPRE_MS);

      expect(
        mesure.imagesParSeconde,
        `${String(mesure.sprites)} sprites: cadence insuffisante en rendu ${logiciel ? 'logiciel' : 'GPU'}`,
      ).toBeGreaterThan(plancher);
    }

    // LA PROPRIETE QUI VALIDE LE CHOIX DU MOTEUR. Multiplier par cinq le nombre
    // de sprites ne doit pas diviser la cadence par cinq: des sprites regroupes sur
    // le GPU, aux textures partagees, coutent peu chacun.
    //
    // Elle ne s'exige que sur carte graphique. En rendu logiciel, chaque sprite
    // coute ses pixels calcules par le processeur: la cadence y baisse avec la
    // charge par nature, et le rapport mesurerait SwiftShader, pas notre rendu.
    if (logiciel) {
      return;
    }

    const cent = avecLueur[0];
    const cinqCents = avecLueur[avecLueur.length - 1];

    expect(cent, 'la mesure a 100 sprites doit exister').toBeDefined();
    expect(cinqCents, 'la mesure a 500 sprites doit exister').toBeDefined();

    expect(
      (cinqCents as Mesure).imagesParSeconde / (cent as Mesure).imagesParSeconde,
      'passer de 100 a 500 sprites ne doit pas effondrer la cadence',
    ).toBeGreaterThan(PART_CONSERVEE_A_CINQ_CENTS);
  });

  // Etape 7.6: plus de 150 faux ninjas. Le cout de notre code se mesure la ou il pese le
  // plus, sur un processeur de telephone d'entree de gamme, et d'abord dans le pire cas:
  // toutes les entites devant la camera, qui ne peut en ecarter aucune.
  //
  // LE PLAFOND NE S'EXIGE QUE SUR CARTE GRAPHIQUE (decision du porteur du projet, 19
  // septembre 2026). En integration continue, le ralentissement multiplie la vitesse
  // d'une machine partagee, qui varie du simple au double d'une execution a l'autre:
  // pour le meme code, 300 sprites y ont coute de 5,5 a 9,3 ms par image, et le banc
  // echouait selon la machine attribuee. La-bas, il mesure et affiche ses chiffres sans
  // echouer, comme pour la cadence. L'etape 5.7 abaisse le plafond a 500 entites au
  // quart d'une image.
  test('tient les plafonds de faux ninjas au processeur ralenti six fois', async ({ page }) => {
    const { mesures, logiciel } = await mesurerAuProcesseurRalenti(
      page,
      CHARGES_TELEPHONE.map((entites) => ({ entites, joueurs: JOUEURS_D_UNE_PARTIE_PLEINE })),
    );

    console.log(
      [
        '',
        `Banc de rendu PixiJS, processeur ralenti ${String(RALENTISSEMENT_TELEPHONE)} fois, tout a l'ecran`,
        ...mesures.map(ligneDuRapport),
        '',
      ].join('\n'),
    );

    for (const mesure of mesures) {
      verifierLeChamp(mesure);

      if (logiciel) {
        continue;
      }

      expect(
        mesure.coutMoyenMs,
        `${String(mesure.sprites)} sprites au processeur ralenti: notre code coute trop cher`,
      ).toBeLessThan(
        mesure.sprites >= 500 ? PLAFOND_COUT_PROPRE_TELEPHONE_MS : PLAFOND_COUT_PROPRE_MS,
      );
    }
  });

  // Etape 5.7: une vraie partie sur telephone. Les entites sont reparties sur toute la
  // carte, et la camera serree du jeu sur telephone n'en montre qu'une petite part: c'est
  // la que le tri par la camera fait son effet. Memes conditions d'exigence.
  test('tient les plafonds de faux ninjas au cadrage d un telephone', async ({ page }) => {
    await page.setViewportSize(FENETRE_TELEPHONE);

    const { mesures, logiciel } = await mesurerAuProcesseurRalenti(
      page,
      CHARGES_CADRAGE_TELEPHONE.map(({ entites, carte }) => ({
        entites,
        carte,
        joueurs: JOUEURS_D_UNE_PARTIE_PLEINE,
        cadrageTelephone: true,
      })),
    );

    console.log(
      [
        '',
        `Banc de rendu PixiJS, processeur ralenti ${String(RALENTISSEMENT_TELEPHONE)} fois, cadrage d'un telephone`,
        ...mesures.map(ligneDuRapport),
        '',
      ].join('\n'),
    );

    for (const mesure of mesures) {
      verifierLeChamp(mesure);

      // La serie mesure bien ce qu'elle dit: la camera d'un telephone ne montre qu'une
      // petite part des entites.
      expect(mesure.personnagesAffiches).toBeLessThan(mesure.sprites / 4);

      if (logiciel) {
        continue;
      }

      expect(
        mesure.coutMoyenMs,
        `${String(mesure.sprites)} sprites au cadrage d'un telephone: notre code coute trop cher`,
      ).toBeLessThan(PLAFOND_COUT_PROPRE_TELEPHONE_MS);
    }
  });
});
