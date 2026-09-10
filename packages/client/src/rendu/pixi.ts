/**
 * L'adaptateur PixiJS: le seul fichier du client qui sache dessiner.
 *
 * IL NE DECIDE RIEN. Il recoit une Scene, deja calculee par scene.ts, et la pose
 * sur le GPU. Aucune regle d'apparence ici: pas de couleur choisie, pas de halo
 * decide, pas de visibilite evaluee. Si une condition de jeu apparaissait dans ce
 * fichier, elle serait au mauvais endroit.
 *
 * C'EST ICI QUE LA LUEUR NEON CHANGE DE NATURE, et c'est la raison d'etre de
 * cette etape. Le jeu d'origine posait un shadowBlur sur le contexte 2D avant
 * chaque trace: le flou etait donc recalcule par le PROCESSEUR une fois par
 * entite et par image. A cent entites, cette seule ligne dominait le cout de la
 * boucle de rendu, et c'est ce qui interdisait de depasser la cinquantaine de
 * bots. Ici, la lueur est un FILTRE POSE SUR UN CALQUE ENTIER: une passe GPU dont
 * le cout depend de la surface de l'ecran et non du nombre d'entites. Passer de
 * cent a cinq cents sprites ne change rien a son prix.
 *
 * LES OBJETS D'AFFICHAGE SONT REUTILISES, JAMAIS RECONSTRUITS. Chaque entite
 * garde son sprite d'une image a l'autre, retrouve par identifiant; seules ses
 * coordonnees changent. Detruire et recreer soixante fois par seconde ferait
 * travailler le ramasse-miettes en continu, ce qui se voit sous forme de
 * micro-saccades regulieres.
 *
 * LES TEXTURES SONT PARTAGEES. Dix-sept images de ninja suffisent a cinq cents
 * personnages: la couleur est appliquee par TEINTE sur le GPU. Le jeu d'origine
 * fabriquait un canevas colore PAR ENTITE ET PAR COULEUR, qu'il gardait dans un
 * cache sans borne.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES, et c'est assume: il n'y a
 * rien a y verifier sans GPU. Ce qu'il fait est verifie par le banc de mesure de
 * tests/e2e/banc-rendu.spec.ts, qui le fait tourner dans un vrai navigateur, et
 * depuis l'etape 4.3 par le scenario de navigation, qui joue une vraie partie.
 */

import type { DimensionsCarte } from '@neon-ninja/shared';
import { RACINE_RESSOURCES, cheminCarte, tousLesNinjas, tousLesObjets } from '@neon-ninja/shared';
import { AdvancedBloomFilter } from 'pixi-filters';
import type { Container as ConteneurPixi, Renderer, Texture } from 'pixi.js';
import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js';

import { BORDURE_TERRAIN, COULEUR_FOND, LUEUR } from './apparence.js';
import type { Camera } from './camera.js';
import type { DisqueScene, FlecheScene, Scene, SpriteScene, ZoneScene } from './scene.js';

/**
 * La police des libelles de zone.
 *
 * Celle des titres de l'interface depuis l'etape 4.3, pour que le terrain et les
 * menus parlent la meme langue visuelle. La page la charge; ecranDeJeu.ts attend
 * qu'elle soit prete avant de monter le rendu, sans quoi PixiJS mesurerait le
 * texte dans la police de secours et ne le referait jamais.
 */
const POLICE_DES_LIBELLES = ['Chakra Petch', 'sans-serif'];

/**
 * Charge d'avance toutes les images des personnages et des objets.
 *
 * A APPELER AVANT LA PREMIERE IMAGE. Une texture demandee en cours de partie
 * arriverait une ou deux images plus tard, et le personnage clignoterait a chaque
 * changement de direction. Dix-sept sprites et six icones se chargent en un
 * instant, et servent ensuite a cinq cents entites: la couleur est appliquee par
 * teinte sur le GPU, pas en fabriquant une image par joueur comme le faisait le
 * jeu d'origine.
 */
export async function prechargerLesSprites(): Promise<void> {
  const adresses = [...tousLesNinjas(), ...tousLesObjets()].map(
    (relatif) => `${RACINE_RESSOURCES}/${relatif}`,
  );

  await Promise.all(adresses.map(async (adresse) => Assets.load<Texture>(adresse)));
}

/** Ce qu'il faut pour monter le rendu. */
export interface OptionsRendu {
  /** L'element qui recevra le canevas. */
  readonly hote: HTMLElement;
  /** La carte jouee: ses dimensions decident du decor et des limites. */
  readonly carte: DimensionsCarte;
  /** Identifiant de la carte, pour trouver ses images. */
  readonly identifiantCarte: string;
  /** Mode miroir de la carte. */
  readonly modeMiroir: boolean;
  /** Poser ou non la lueur neon. Utile au banc de mesure, qui compare. */
  readonly lueur?: boolean;
  /** Largeur et hauteur du canevas. Celles de l'hote par defaut. */
  readonly largeur?: number;
  readonly hauteur?: number;
}

/** Un rendu monte, pret a recevoir des scenes. */
export interface Rendu {
  /** Le moteur de rendu, pour la mesure et le redimensionnement. */
  readonly application: Application;
  /** Charge les images de la carte. A appeler avant la premiere image. */
  chargerLeDecor(): Promise<void>;
  /** Pose cette scene, vue par cette camera. */
  dessiner(scene: Scene, camera: Camera): void;
  /** Adapte le canevas a une nouvelle taille de fenetre. */
  redimensionner(largeur: number, hauteur: number): void;
  /** Detruit tout et libere le GPU. */
  detruire(): void;
}

/**
 * Monte le rendu et rend de quoi le piloter.
 *
 * L'ORDRE DES CALQUES EST L'ORDRE DU JEU, et il n'est ecrit qu'ici: le decor, les
 * zones, les disques, les objets, les entites, le premier plan qui passe devant
 * tout le monde, puis les reperes qui passent devant le premier plan. Le jeu
 * d'origine obtenait le meme ordre par la seule succession de ses appels de
 * dessin, si bien que le deplacer revenait a reordonner trois cents lignes.
 */
export async function monterRendu(options: OptionsRendu): Promise<Rendu> {
  const application = new Application();

  await application.init({
    background: COULEUR_FOND,
    width: options.largeur ?? options.hote.clientWidth,
    height: options.hauteur ?? options.hote.clientHeight,
    antialias: true,
    // Le rendu suit la densite de l'ecran: sans cela, le jeu est flou sur un
    // ecran haute definition et sur un telephone.
    resolution: globalThis.devicePixelRatio,
    autoDensity: true,
  });

  options.hote.append(application.canvas as unknown as Node);

  /** Le monde: tout ce qui vit en coordonnees de carte. La camera le deplace. */
  const monde = new Container();
  const decor = new Container();
  const zones = new Graphics();
  const libelles = new Container();
  const disques = new Graphics();
  const objets = new Container();
  const entites = new Container();
  const premierPlan = new Container();
  const reperes = new Graphics();

  monde.addChild(decor, zones, libelles, disques, objets, entites, premierPlan, reperes);
  application.stage.addChild(monde);

  if (options.lueur !== false) {
    // Un seul filtre, sur le calque des entites et de leurs halos. C'est la
    // difference de fond avec le shadowBlur par entite du jeu d'origine.
    const bloom = new AdvancedBloomFilter({
      threshold: LUEUR.seuil,
      bloomScale: LUEUR.intensite,
      blur: LUEUR.flou,
    });

    entites.filters = [bloom];
  }

  /** Les objets d'affichage deja crees, retrouves par identifiant de scene. */
  const spritesEntites = new Map<string, Sprite>();
  const spritesObjets = new Map<string, Sprite>();
  const textesZones = new Map<string, Text>();

  const fond = new Sprite();
  const dessus = new Sprite();
  decor.addChild(fond);
  premierPlan.addChild(dessus);

  /** Le trait qui marque les limites du terrain, dessine une seule fois. */
  const limites = new Graphics();
  limites.rect(0, 0, options.carte.largeur, options.carte.hauteur).stroke({
    color: BORDURE_TERRAIN.couleur,
    alpha: BORDURE_TERRAIN.alpha,
    width: BORDURE_TERRAIN.epaisseur,
  });
  decor.addChild(limites);

  return {
    application,

    async chargerLeDecor() {
      const adresse = (couche: 'background' | 'foreground'): string =>
        `${RACINE_RESSOURCES}/${cheminCarte(options.identifiantCarte, options.modeMiroir, couche)}`;

      const [texteFond, texteDessus] = await Promise.all([
        Assets.load<Texture>(adresse('background')),
        Assets.load<Texture>(adresse('foreground')),
      ]);

      fond.texture = texteFond;
      dessus.texture = texteDessus;

      // Les images de carte mesurent toutes 3000x2000, y compris celles des
      // cartes de 2000x1500: le jeu d'origine les etire aux dimensions de la
      // carte sans conserver les proportions, et le decodage du terrain fait de
      // meme cote serveur. Reproduire l'etirement est ce qui garantit que les
      // murs sont la ou le decor les montre.
      for (const image of [fond, dessus]) {
        image.width = options.carte.largeur;
        image.height = options.carte.hauteur;
      }
    },

    dessiner(scene: Scene, camera: Camera) {
      placerLaCamera(monde, camera, application.renderer);

      dessinerLesZones(zones, libelles, textesZones, scene.zones);
      dessinerLesDisques(disques, scene.disques);
      majSprites(spritesObjets, objets, scene.objets);
      majSprites(spritesEntites, entites, scene.entites);
      dessinerLesReperes(reperes, scene.reperes);
    },

    redimensionner(largeur: number, hauteur: number) {
      application.renderer.resize(largeur, hauteur);
    },

    detruire() {
      application.destroy(true, { children: true });
      spritesEntites.clear();
      spritesObjets.clear();
      textesZones.clear();
    },
  };
}

/**
 * Place le monde sous la camera.
 *
 * Deplacer un seul conteneur plutot que chaque objet est ce qui rend la camera
 * gratuite: le GPU applique une matrice, quel que soit le nombre de sprites.
 */
function placerLaCamera(monde: Container, camera: Camera, moteur: Renderer): void {
  monde.scale.set(camera.echelle);
  monde.position.set(
    moteur.width / moteur.resolution / 2 - camera.x * camera.echelle,
    moteur.height / moteur.resolution / 2 - camera.y * camera.echelle,
  );
}

/**
 * Redessine tous les disques d'un coup.
 *
 * UN SEUL OBJET GRAPHIQUE POUR TOUS LES DISQUES, refait a chaque image. C'est
 * volontaire: leurs rayons pulsent, donc leur geometrie change de toute facon, et
 * un seul objet donne un seul appel de dessin la ou cent objets en donneraient
 * cent.
 */
function dessinerLesDisques(graphique: Graphics, disques: readonly DisqueScene[]): void {
  graphique.clear();

  for (const disque of disques) {
    graphique.circle(disque.x, disque.y, Math.max(disque.rayon, 0));

    if (disque.remplissage !== undefined) {
      graphique.fill({ color: disque.remplissage.couleur, alpha: disque.remplissage.alpha });
    }

    if (disque.contour !== undefined) {
      graphique.stroke({
        color: disque.contour.couleur,
        alpha: disque.contour.alpha,
        width: disque.contour.epaisseur,
      });
    }
  }
}

/** Redessine les reperes, par-dessus tout le reste. Meme principe que les disques. */
function dessinerLesReperes(graphique: Graphics, fleches: readonly FlecheScene[]): void {
  graphique.clear();

  for (const fleche of fleches) {
    graphique.poly([...fleche.points]);
    graphique.fill({ color: fleche.remplissage.couleur, alpha: fleche.remplissage.alpha });
    graphique.stroke({
      color: fleche.contour.couleur,
      alpha: fleche.contour.alpha,
      width: fleche.contour.epaisseur,
    });
  }
}

/** Redessine les zones speciales et place leur libelle. */
function dessinerLesZones(
  graphique: Graphics,
  libelles: Container,
  textes: Map<string, Text>,
  zones: readonly ZoneScene[],
): void {
  graphique.clear();
  const vues = new Set<string>();

  for (const zone of zones) {
    vues.add(zone.id);
    graphique.circle(zone.x, zone.y, zone.rayon);

    if (zone.remplissage !== undefined) {
      graphique.fill({ color: zone.remplissage.couleur, alpha: zone.remplissage.alpha });
    }

    if (zone.contour !== undefined) {
      graphique.stroke({
        color: zone.contour.couleur,
        alpha: zone.contour.alpha,
        width: zone.contour.epaisseur,
      });
    }

    let texte = textes.get(zone.id);

    if (texte === undefined) {
      texte = new Text({
        text: zone.libelle,
        style: { fill: 0xffffff, fontSize: 20, fontFamily: POLICE_DES_LIBELLES, fontWeight: '600' },
      });
      texte.anchor.set(0.5);
      libelles.addChild(texte);
      textes.set(zone.id, texte);
    }

    texte.position.set(zone.x, zone.y);
  }

  for (const [id, texte] of textes) {
    if (!vues.has(id)) {
      texte.destroy();
      textes.delete(id);
    }
  }
}

/**
 * Met un ensemble de sprites en accord avec la scene.
 *
 * Trois cas, dans l'ordre de frequence: le sprite existe et il suffit de le
 * deplacer; il n'existe pas encore et on le cree; il n'est plus dans la scene et
 * on le detruit. Le premier cas est de tres loin le plus courant, et c'est celui
 * qui ne coute presque rien.
 */
function majSprites(
  connus: Map<string, Sprite>,
  parent: ConteneurPixi,
  modele: readonly SpriteScene[],
): void {
  const vus = new Set<string>();

  for (const decrit of modele) {
    vus.add(decrit.id);
    let sprite = connus.get(decrit.id);

    if (sprite === undefined) {
      sprite = new Sprite();
      sprite.anchor.set(0.5);
      parent.addChild(sprite);
      connus.set(decrit.id, sprite);
    }

    // La texture change quand l'entite change de direction ou d'image de marche.
    // Assets.get rend la texture deja chargee, sans aller la rechercher.
    const texture = Assets.get<Texture>(decrit.texture);

    if (texture !== undefined && sprite.texture !== texture) {
      sprite.texture = texture;
    }

    sprite.position.set(decrit.x, decrit.y);
    sprite.width = decrit.taille;
    sprite.height = decrit.taille;
    sprite.tint = decrit.teinte;
    sprite.alpha = decrit.alpha;
  }

  for (const [id, sprite] of connus) {
    if (!vus.has(id)) {
      sprite.destroy();
      connus.delete(id);
    }
  }
}
