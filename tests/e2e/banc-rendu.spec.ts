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
 * comme le fera le jeu. La lueur neon est active, puisque c'est elle qui coutait
 * cher dans l'ancienne version.
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
 * POURQUOI LE SEUIL D'IMAGES PAR SECONDE EST BAS. En integration continue, le
 * navigateur tourne sans carte graphique: tout est rasterise par le processeur.
 * Un seuil calibre sur une machine equipee ferait echouer la CI sans qu'aucune
 * regression n'ait eu lieu. Le seuil garde ici est un plancher: il attrape
 * l'effondrement, pas la baisse de quelques images. Les valeurs reellement
 * mesurees sont consignees dans le handoff de l'etape, avec la machine.
 */

import { expect, test } from '@playwright/test';

import { CARTE_IMPORTATION, demarrerServeurStatique } from './harnais/serveur-statique.js';
import type { ServeurStatique } from './harnais/serveur-statique.js';

/** Les charges mesurees, en nombre de sprites animes simultanement. */
const CHARGES = [100, 200, 500] as const;

/** Duree de chaque mesure, en millisecondes. */
const DUREE_MESURE_MS = 3_000;

/**
 * Plancher d'images par seconde, tous nombres de sprites confondus.
 *
 * Volontairement tres bas: voir la note en tete de fichier. Sous ce seuil, ce
 * n'est plus une machine sans carte graphique, c'est un rendu qui ne rend plus.
 * Ce n'est pas ce seuil qui garde la performance, ce sont les deux suivants.
 */
const PLANCHER_IMAGES_PAR_SECONDE = 4;

/**
 * Part de la cadence a cent sprites qui doit survivre a cinq cents.
 *
 * C'est le seuil qui valide reellement le choix du moteur de rendu: voir la note
 * qui accompagne son usage.
 */
const PART_CONSERVEE_A_CINQ_CENTS = 0.5;

/** Plafond du cout de notre propre code, par image, en millisecondes. */
const PLAFOND_COUT_PROPRE_MS = 8;

/** Le resultat d'une mesure. */
interface Mesure {
  readonly sprites: number;
  readonly imagesParSeconde: number;
  readonly coutMoyenMs: number;
  readonly coutMaximumMs: number;
  readonly entitesDessinees: number;
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
  import { cameraSur, suivre } from '/paquets/client/rendu/camera.js';
  import { ETAT_INITIAL } from '/paquets/client/etat.js';

  const CARTE = { largeur: 2000, hauteur: 1500 };
  const DIRECTIONS = ['nord', 'nord_est', 'est', 'sud_est', 'sud', 'sud_ouest', 'ouest', 'nord_ouest'];
  const COULEURS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];

  /**
   * Fabrique un instantane de partie a un tour donne.
   *
   * Les entites tournent sur des cercles de rayons differents: elles bougent
   * toutes, en permanence, et pas deux a la meme vitesse. Une scene ou rien ne
   * bouge ne mesurerait rien, PixiJS n'ayant alors aucune position a transmettre.
   */
  function instantane(tick, nombre, tour) {
    const entites = [];

    for (let index = 0; index < nombre; index += 1) {
      const rayon = 150 + (index % 17) * 35;
      const angle = tour * (0.4 + (index % 11) * 0.05) + index;

      entites.push({
        type: index === 0 ? 'joueur' : index % 25 === 0 ? 'botNoir' : index % 4 === 0 ? 'joueur' : 'bot',
        id: 'e' + index,
        x: CARTE.largeur / 2 + Math.cos(angle) * rayon,
        y: CARTE.hauteur / 2 + Math.sin(angle) * rayon * 0.7,
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

  await prechargerLesSprites();

  /**
   * Monte le rendu, avec ou sans la lueur neon.
   *
   * Mesurer les deux est ce qui chiffre le prix du filtre: c'est le coeur du
   * choix technique de cette etape, et une affirmation non chiffree ne vaut rien.
   */
  window.preparer = async (lueur) => {
    rendu?.detruire();
    document.querySelector('#terrain').replaceChildren();

    rendu = await monterRendu({
      hote: document.querySelector('#terrain'),
      carte: CARTE,
      identifiantCarte: 'map1',
      modeMiroir: false,
      lueur,
    });

    await rendu.chargerLeDecor();
  };

  await window.preparer(true);

  /**
   * Mesure une charge donnee pendant une duree donnee.
   *
   * On compte les images reellement produites par le navigateur et on chronometre
   * separement ce que NOTRE code consomme dans chacune.
   */
  window.mesurer = async (sprites, dureeMs) => {
    const etat = { ...ETAT_INITIAL, ecran: 'jeu', moi: 'e0' };
    const tampon = new TamponDeLissage();
    const taille = { largeur: window.innerWidth, hauteur: window.innerHeight };

    let camera = cameraSur({ x: CARTE.largeur / 2, y: CARTE.hauteur / 2 }, taille, CARTE, false);
    let tick = 0;
    let images = 0;
    let cumulMs = 0;
    let maximumMs = 0;
    let entitesDessinees = 0;
    let precedent;

    const debut = performance.now();

    await new Promise((termine) => {
      const image = (instant) => {
        // Un nouveau battement toutes les cinquante millisecondes, comme le
        // serveur: le lissage travaille donc dans les memes conditions qu'en jeu.
        const battement = Math.floor((instant - debut) / 50);

        if (battement > tick) {
          tick = battement;
          tampon.observer(instantane(tick, sprites, tick * 0.05), instant);
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

        if (instant - debut >= dureeMs) {
          termine();
          return;
        }

        requestAnimationFrame(image);
      };

      requestAnimationFrame(image);
    });

    const ecoule = performance.now() - debut;

    return {
      sprites,
      imagesParSeconde: (images * 1000) / ecoule,
      coutMoyenMs: cumulMs / images,
      coutMaximumMs: maximumMs,
      entitesDessinees,
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

test.describe('banc de mesure du rendu PixiJS', () => {
  // Trois charges, trois secondes chacune, plus le chargement des images.
  test.setTimeout(60_000);

  test('tient la charge a 100, 200 et 500 sprites animes', async ({ page }) => {
    // Les erreurs de la page sont recueillies et rejouees dans le message
    // d'echec: sans cela, un module qui ne se charge pas se manifeste par une
    // attente qui expire, ce qui ne dit rien de la cause.
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

    /** Joue une serie de mesures, lueur allumee ou eteinte. */
    const serie = async (lueur: boolean): Promise<Mesure[]> => {
      await page.evaluate(
        async (avecLueur) =>
          (window as unknown as { preparer: (l: boolean) => Promise<void> }).preparer(avecLueur),
        lueur,
      );

      const relevees: Mesure[] = [];

      for (const sprites of CHARGES) {
        relevees.push(
          (await page.evaluate(
            async ([nombre, duree]) =>
              (window as unknown as { mesurer: (n: number, d: number) => Promise<Mesure> }).mesurer(
                nombre as number,
                duree as number,
              ),
            [sprites, DUREE_MESURE_MS],
          )) as Mesure,
        );
      }

      return relevees;
    };

    const dessinePar = (await page.evaluate(() =>
      (window as unknown as { quiDessine: () => string }).quiDessine(),
    )) as string;

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
            `(pointe ${mesure.coutMaximumMs.toFixed(2)} ms)`
          );
        }),
        '',
      ].join('\n'),
    );

    for (const mesure of [...avecLueur, ...sansLueur]) {
      expect(
        mesure.entitesDessinees,
        `${String(mesure.sprites)} sprites demandes doivent etre dessines`,
      ).toBe(mesure.sprites);

      // Le seuil qui porte vraiment: notre propre code doit rester une petite
      // fraction du budget d'une image, quelle que soit la charge.
      expect(
        mesure.coutMoyenMs,
        `${String(mesure.sprites)} sprites: notre propre code coute trop cher par image`,
      ).toBeLessThan(PLAFOND_COUT_PROPRE_MS);

      expect(
        mesure.imagesParSeconde,
        `${String(mesure.sprites)} sprites: plus rien ne s'affiche`,
      ).toBeGreaterThan(PLANCHER_IMAGES_PAR_SECONDE);
    }

    // LA PROPRIETE QUI VALIDE LE CHOIX DU MOTEUR. Multiplier par cinq le nombre
    // de sprites ne doit pas diviser la cadence par cinq: c'est tout l'interet
    // d'une lueur posee en filtre de calque plutot qu'en flou par entite. Le jeu
    // d'origine, lui, payait le flou une fois par entite, donc son cout croissait
    // proportionnellement.
    const cent = avecLueur[0];
    const cinqCents = avecLueur[avecLueur.length - 1];

    expect(cent, 'la mesure a 100 sprites doit exister').toBeDefined();
    expect(cinqCents, 'la mesure a 500 sprites doit exister').toBeDefined();

    expect(
      (cinqCents as Mesure).imagesParSeconde / (cent as Mesure).imagesParSeconde,
      'passer de 100 a 500 sprites ne doit pas effondrer la cadence',
    ).toBeGreaterThan(PART_CONSERVEE_A_CINQ_CENTS);
  });
});
