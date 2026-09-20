/**
 * L'adaptateur PixiJS: le seul fichier du client qui sache dessiner.
 *
 * IL NE DECIDE RIEN. Il recoit une Scene, deja calculee par scene.ts, et la pose
 * sur le GPU. Aucune regle d'apparence ici: pas de couleur choisie, pas de halo
 * decide, pas de visibilite evaluee. Si une condition de jeu apparaissait dans ce
 * fichier, elle serait au mauvais endroit.
 *
 * LA LUEUR NEON EST UN FILTRE POSE SUR UN CALQUE ENTIER: une passe GPU dont le
 * cout depend de la surface dessinee et non du nombre d'objets. Elle ne couvre que
 * les fleches de localisation. Correction de l'etape 5.4: ce fichier affirmait que
 * le jeu d'origine faisait rayonner chaque entite par un shadowBlur; il n'en posait
 * qu'un seul, sur ces fleches (client.js:3556). La lueur posee sur tout le calque
 * des ninjas faisait rayonner les couleurs claires, un halo que le jeu d'origine
 * n'avait pas.
 *
 * LES OBJETS D'AFFICHAGE SONT REUTILISES, JAMAIS RECONSTRUITS. Chaque entite
 * garde son sprite d'une image a l'autre, retrouve par identifiant; seules ses
 * coordonnees changent. Detruire et recreer soixante fois par seconde ferait
 * travailler le ramasse-miettes en continu, ce qui se voit sous forme de
 * micro-saccades regulieres.
 *
 * SEUL CE QUI CHANGE EST TRANSMIS, ET SEUL CE QUE LA CAMERA MONTRE (etape 5.7). A
 * cinq cents entites, reposer a chaque image la texture, la taille et la teinte de
 * chaque personnage coutait plus de trois millisecondes par image a un telephone
 * d'entree de gamme; et PixiJS parcourait ensuite tous les sprites, y compris ceux
 * que la camera ne montrait pas, alors qu'au cadrage d'un telephone elle en montre
 * quelques-uns. Un personnage retient donc ce qu'on lui a donne, et un personnage
 * hors du champ est cache sans etre mis a jour. Ce n'est pas une regle d'apparence:
 * ce qui se voit est le meme.
 *
 * LES TEXTURES SONT PARTAGEES. Dix-sept images de ninja suffisent a cinq cents
 * personnages: chaque image est coupee une fois en deux calques, et la couleur est
 * appliquee par TEINTE sur le GPU, au seul calque du corps (recoloration.ts). Le
 * jeu d'origine fabriquait un canevas colore PAR ENTITE ET PAR COULEUR, qu'il
 * gardait dans un cache sans borne. Teinter l'image entiere, comme le faisait ce
 * fichier jusqu'a l'etape 5.4, noircissait tout ninja qui n'etait ni rouge ni jaune:
 * le sprite est rouge, et une teinte multiplie.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES, et c'est assume: il n'y a
 * rien a y verifier sans GPU. Ce qu'il fait est verifie par le banc de mesure de
 * tests/e2e/banc-rendu.spec.ts, qui le fait tourner dans un vrai navigateur, et
 * depuis l'etape 4.3 par le scenario de navigation, qui joue une vraie partie.
 */

import type { DimensionsCarte, IdentifiantCarte } from '@neon-ninja/shared';
import {
  CARTES,
  COTE_IMAGE_OBJET_PX,
  IMAGES_DE_PLUIE,
  IMAGES_PAR_OBJET,
  RACINE_RESSOURCES,
  cheminCarte,
  cheminPluie,
  tousLesNinjas,
  tousLesObjets,
} from '@neon-ninja/shared';
import { AdvancedBloomFilter } from 'pixi-filters';
import type { Container as ConteneurPixi } from 'pixi.js';
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  RenderTexture,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';

import {
  BORDURE_TERRAIN,
  COULEUR_FOND,
  DENSITE_MAXIMALE,
  LUEUR,
  MARGE_HORS_CHAMP_PX,
  PLUIE,
} from './apparence.js';
import type { Camera, ZoneVisible } from './camera.js';
import { dansLaZone, versEcran, zoneVisible } from './camera.js';
import type { IndicateurScene } from './charges.js';
import { separerLesCalques } from './recoloration.js';
import type { FormeDeSang } from './sang.js';
import { adresseDImage, adresseDesDetails, adresseDuCorps } from './textures.js';
import type { ConeScene, DisqueScene, Scene, SpriteScene, ZoneScene } from './scene.js';

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
 * Charge d'avance toutes les images des personnages et des objets, et fabrique
 * les textures qui s'en deduisent.
 *
 * A APPELER AVANT LA PREMIERE IMAGE. Une texture demandee en cours de partie
 * arriverait une ou deux images plus tard, et le personnage clignoterait a chaque
 * changement de direction. Dix-sept sprites et six icones se chargent en un
 * instant, et servent ensuite a cinq cents entites.
 *
 * Chaque image de ninja est coupee en ses deux calques, et chaque planche d'objet
 * en ses images (textures.ts). C'est fait une fois: une deuxieme partie retrouve
 * les textures deja rangees.
 */
export async function prechargerLesSprites(): Promise<void> {
  const versAdresse = (relatif: string): string => `${RACINE_RESSOURCES}/${relatif}`;
  const ninjas = tousLesNinjas().map(versAdresse);
  const objets = tousLesObjets().map(versAdresse);

  const [imagesDeNinja, planches] = await Promise.all([
    Promise.all(ninjas.map(async (adresse) => Assets.load<Texture>(adresse))),
    Promise.all(objets.map(async (adresse) => Assets.load<Texture>(adresse))),
  ]);

  imagesDeNinja.forEach((texture, rang) => {
    rangerLesCalques(ninjas[rang] as string, texture);
  });
  planches.forEach((planche, rang) => {
    rangerLesImages(objets[rang] as string, planche);
  });
}

/**
 * Precharge tout ce qu'une partie affichera: les images des personnages et des objets,
 * et le decor de sa carte.
 *
 * APPELE DES LE COMPTE A REBOURS DU SALON (recette de l'etape 5.4). Le decor d'une
 * carte pese pres de trois megaoctets: telecharge au lancement meme, il se chargeait
 * pendant que la partie tournait deja. Le montage de l'ecran de jeu retrouve ensuite
 * ces textures deja chargees.
 */
export async function prechargerLaPartie(
  carte: string,
  modeMiroir: boolean,
  pluie: boolean,
): Promise<void> {
  const adresse = (couche: 'background' | 'foreground'): string =>
    `${RACINE_RESSOURCES}/${cheminCarte(carte, modeMiroir, couche)}`;
  const dimensions = CARTES[carte as IdentifiantCarte] as DimensionsCarte | undefined;

  await Promise.all([
    prechargerLesSprites(),
    Assets.load<Texture>(adresse('background')),
    Assets.load<Texture>(adresse('foreground')),
    dimensions === undefined ? [] : imagesDePluie(carte, modeMiroir, pluie, dimensions),
  ]);
}

/**
 * Les images de pluie d'une carte, a sa taille; aucune pour une carte sans pluie, ni
 * quand la partie a coupe la pluie (ReglagesPartie.pluie, etape 7.6).
 *
 * LA PLANCHE N'EST JAMAIS ENVOYEE A LA CARTE GRAPHIQUE. Elle mesure 9000 pixels de
 * large, au-dela de la plus grande texture qu'acceptent bien des telephones (4096 ou
 * 8192). Elle est decodee comme une simple image, chacune de ses images est recopiee
 * sur un canevas a la taille de la carte, puis la planche est abandonnee. Le jeu
 * d'origine etirait deja chaque image aux dimensions de la carte (RainEffect,
 * legacy/js/MapManager.js:44): ce sont celles qui s'affichent.
 *
 * Fait une fois: une deuxieme partie retrouve les images rangees.
 */
async function imagesDePluie(
  carte: string,
  modeMiroir: boolean,
  pluie: boolean,
  dimensions: DimensionsCarte,
): Promise<readonly Texture[]> {
  const chemin = pluie ? cheminPluie(carte, modeMiroir) : undefined;

  if (chemin === undefined) {
    return [];
  }

  const adresse = `${RACINE_RESSOURCES}/${chemin}`;
  const noms = Array.from({ length: IMAGES_DE_PLUIE }, (_, rang) => adresseDImage(adresse, rang));

  if (!noms.every((nom) => Assets.cache.has(nom))) {
    const planche = new Image();
    planche.src = adresse;
    await planche.decode();

    const largeurImage = planche.naturalWidth / IMAGES_DE_PLUIE;

    noms.forEach((nom, rang) => {
      const contexte = contexteDeCanevas(dimensions.largeur, dimensions.hauteur);
      contexte.drawImage(
        planche,
        rang * largeurImage,
        0,
        largeurImage,
        planche.naturalHeight,
        0,
        0,
        dimensions.largeur,
        dimensions.hauteur,
      );
      Assets.cache.set(nom, Texture.from(contexte.canvas));
    });
  }

  return noms.map((nom) => Assets.get<Texture>(nom));
}

/**
 * Coupe une image de ninja en son corps et ses details, et range les deux textures.
 *
 * Les pixels se lisent en posant l'image sur un canevas, comme le faisait le jeu
 * d'origine; mais c'est fait une fois par image chargee, et non une fois par
 * entite et par couleur.
 */
function rangerLesCalques(adresse: string, texture: Texture): void {
  if (Assets.cache.has(adresseDuCorps(adresse))) {
    return;
  }

  const largeur = texture.source.pixelWidth;
  const hauteur = texture.source.pixelHeight;
  const contexte = contexteDeCanevas(largeur, hauteur);

  contexte.drawImage(texture.source.resource as CanvasImageSource, 0, 0);

  const calques = separerLesCalques(contexte.getImageData(0, 0, largeur, hauteur).data);

  Assets.cache.set(adresseDuCorps(adresse), textureDePixels(calques.corps, largeur, hauteur));
  Assets.cache.set(adresseDesDetails(adresse), textureDePixels(calques.details, largeur, hauteur));
}

/** Range chaque image d'une planche d'objet comme une texture, qui partage l'image chargee. */
function rangerLesImages(adresse: string, planche: Texture): void {
  for (let rang = 0; rang < IMAGES_PAR_OBJET; rang += 1) {
    const nom = adresseDImage(adresse, rang);

    if (!Assets.cache.has(nom)) {
      const cadre = new Rectangle(
        rang * COTE_IMAGE_OBJET_PX,
        0,
        COTE_IMAGE_OBJET_PX,
        COTE_IMAGE_OBJET_PX,
      );

      Assets.cache.set(nom, new Texture({ source: planche.source, frame: cadre }));
    }
  }
}

/** Une texture faite de ces pixels. */
function textureDePixels(pixels: Uint8ClampedArray, largeur: number, hauteur: number): Texture {
  const contexte = contexteDeCanevas(largeur, hauteur);

  contexte.putImageData(new ImageData(Uint8ClampedArray.from(pixels), largeur, hauteur), 0, 0);

  return Texture.from(contexte.canvas);
}

/** Le contexte de dessin d'un canevas neuf, de cette taille. */
function contexteDeCanevas(largeur: number, hauteur: number): CanvasRenderingContext2D {
  const canevas = document.createElement('canvas');
  canevas.width = largeur;
  canevas.height = hauteur;

  const contexte = canevas.getContext('2d', { willReadFrequently: true });

  if (contexte === null) {
    throw new Error('Le navigateur ne fournit pas de canevas 2D pour preparer les sprites.');
  }

  return contexte;
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
  /** La pluie tombe-t-elle, sur une carte qui en a une (reglage de la partie, etape 7.6). */
  readonly pluie: boolean;
  /** Poser ou non la lueur neon. Utile au banc de mesure, qui compare. */
  readonly lueur?: boolean;
  /** Largeur et hauteur du canevas. Celles de l'hote par defaut. */
  readonly largeur?: number;
  readonly hauteur?: number;
}

/** Du sang a imprimer au sol: une eclaboussure du Massacre, ou une empreinte de pas. */
export interface SangAImprimer {
  /** Identifiant stable: une tache deja imprimee ne l'est pas une seconde fois. */
  readonly id: string;
  readonly formes: readonly FormeDeSang[];
}

/**
 * La resolution du calque du sol, par rapport a la carte: la moitie.
 *
 * Le sang s'imprime une fois sur une texture qui couvre toute la carte, et ne coute plus
 * rien ensuite. A pleine resolution, celle de map3 pese 24 Mo de memoire graphique; a
 * demi-resolution, 6 Mo, et une tache de quelques pixels n'y perd rien de visible
 * (docs/design/idee-mode-massacre.md).
 */
const RESOLUTION_DU_SOL = 0.5;

/** Combien de cotes pour dessiner une ellipse tournee: assez pour qu'elle paraisse ronde. */
const COTES_D_UNE_ELLIPSE = 14;

/** Un rendu monte, pret a recevoir des scenes. */
export interface Rendu {
  /** Le moteur de rendu, pour la mesure et le redimensionnement. */
  readonly application: Application;
  /** Charge les images de la carte. A appeler avant la premiere image. */
  chargerLeDecor(): Promise<void>;
  /** Pose cette scene, vue par cette camera. */
  dessiner(scene: Scene, camera: Camera): void;
  /** Imprime du sang au sol, une fois pour toutes (mode Massacre, etape 7.4). */
  imprimer(taches: readonly SangAImprimer[]): void;
  /**
   * Pose un filtre CSS sur le terrain seul, le HUD restant net: le flou et le gris des
   * malus (etape 7.7). « none » le retire.
   */
  filtrer(filtre: string): void;
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
    // Le rendu suit la densite de l'ecran, pour ne pas etre flou, mais jamais
    // au-dela de DENSITE_MAXIMALE (apparence.ts): un telephone de densite 3 faisait
    // dessiner neuf fois plus de pixels qu'un ecran ordinaire, lueur comprise.
    resolution: Math.min(globalThis.devicePixelRatio, DENSITE_MAXIMALE),
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
  // Les personnages se dessinent dans l'ordre de la scene, que leur rang fixe (etape 5.7).
  // Le nom permet au banc de mesure de compter ceux qui sont affiches.
  const entites = new Container({ label: 'personnages', sortableChildren: true });
  // L'arc de nos charges du Tactique, sur les personnages et sous les toits (etape 7.7).
  const indicateur = new Graphics();
  const premierPlan = new Container();
  const reperes = new Graphics();
  /** Le numero de l'image en cours: il marque les personnages que la scene nomme encore. */
  let numeroDImage = 0;

  monde.addChild(
    decor,
    zones,
    libelles,
    disques,
    objets,
    entites,
    indicateur,
    premierPlan,
    reperes,
  );
  application.stage.addChild(monde);

  if (options.lueur !== false) {
    // Un seul filtre, sur le calque des reperes: les fleches de localisation, seul
    // dessin que le jeu d'origine faisait rayonner (shadowBlur, client.js:3556).
    // Pose sur le calque des entites jusqu'a l'etape 5.4, il faisait rayonner tout
    // ninja de couleur claire, ce que le porteur du projet ne veut pas.
    const bloom = new AdvancedBloomFilter({
      threshold: LUEUR.seuil,
      bloomScale: LUEUR.intensite,
      blur: LUEUR.flou,
    });

    reperes.filters = [bloom];
  }

  /** Les objets d'affichage deja crees, retrouves par identifiant de scene. */
  const spritesEntites = new Map<string, Personnage>();
  /** Les deux calques de chaque image de ninja deja demandee, retrouves par son adresse. */
  const calquesParImage = new Map<string, Calques>();
  const spritesObjets = new Map<string, Sprite>();
  const textesZones = new Map<string, Text>();

  const fond = new Sprite();
  const dessus = new Sprite();
  // La pluie tombe sur le fond et sous tout le reste, comme dans le jeu d'origine
  // (MapManager.draw, legacy/js/MapManager.js:388). Cachee sur une carte sans pluie.
  const pluie = new Sprite();
  pluie.alpha = PLUIE.opacite;
  pluie.visible = false;
  /** Les images de pluie de la carte, une fois le decor charge. */
  let imagesPluie: readonly Texture[] = [];
  // Le sol du Massacre: le sang s'y imprime une fois, a demi-resolution, sur le fond et
  // sous la pluie. Cree a la premiere tache seulement: les autres modes n'en paient rien.
  const sol = new Sprite();
  sol.scale.set(1 / RESOLUTION_DU_SOL);
  let texteDuSol: RenderTexture | undefined;
  const imprimees = new Set<string>();
  decor.addChild(fond, sol, pluie);
  premierPlan.addChild(dessus);

  const imprimer = (taches: readonly SangAImprimer[]): void => {
    const nouvelles = taches.filter((tache) => !imprimees.has(tache.id));

    if (nouvelles.length === 0) {
      return;
    }

    if (texteDuSol === undefined) {
      texteDuSol = RenderTexture.create({
        width: Math.ceil(options.carte.largeur * RESOLUTION_DU_SOL),
        height: Math.ceil(options.carte.hauteur * RESOLUTION_DU_SOL),
      });
      sol.texture = texteDuSol;
    }

    const pinceau = new Graphics();
    pinceau.scale.set(RESOLUTION_DU_SOL);

    for (const tache of nouvelles) {
      imprimees.add(tache.id);
      for (const forme of tache.formes) {
        dessinerUneForme(pinceau, forme);
      }
    }

    application.renderer.render({ container: pinceau, target: texteDuSol, clear: false });
    pinceau.destroy();
  };

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

      const [texteFond, texteDessus, images] = await Promise.all([
        Assets.load<Texture>(adresse('background')),
        Assets.load<Texture>(adresse('foreground')),
        imagesDePluie(options.identifiantCarte, options.modeMiroir, options.pluie, options.carte),
      ]);

      fond.texture = texteFond;
      dessus.texture = texteDessus;

      imagesPluie = images;
      const premiere = images[0];

      if (premiere !== undefined) {
        pluie.texture = premiere;
        pluie.width = options.carte.largeur;
        pluie.height = options.carte.hauteur;
        pluie.visible = true;
      }

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

    imprimer,

    filtrer(filtre: string) {
      // Ecrire le style a chaque image obligerait le navigateur a le relire: on ne
      // l'ecrit que s'il change.
      const canevas = application.canvas as unknown as HTMLCanvasElement;

      if (canevas.style.filter !== filtre) {
        canevas.style.filter = filtre;
      }
    },

    dessiner(scene: Scene, camera: Camera) {
      placerLaCamera(monde, camera, application);
      // La secousse d'un coup de katana decale le monde de quelques pixels (etape 7.4).
      monde.position.x += scene.secousse.x * camera.echelle;
      monde.position.y += scene.secousse.y * camera.echelle;
      imprimer(scene.sang);

      // Toutes les images de la planche ont la meme taille: changer de texture garde
      // l'etirement pose au chargement.
      const imagePluie =
        scene.imageDePluie === undefined
          ? undefined
          : imagesPluie[scene.imageDePluie % imagesPluie.length];

      if (imagePluie !== undefined && pluie.texture !== imagePluie) {
        pluie.texture = imagePluie;
      }

      // Le champ se mesure sur l'ecran de PixiJS, celui qui vient de placer la camera.
      numeroDImage += 1;
      const ecran = { largeur: application.screen.width, hauteur: application.screen.height };
      const champ = zoneVisible(camera, ecran, MARGE_HORS_CHAMP_PX);

      dessinerLesZones(zones, libelles, textesZones, scene.zones);
      dessinerLesDisques(disques, scene.disques, champ);
      dessinerLesCones(disques, scene.cones);
      majSprites(spritesObjets, objets, scene.objets);
      majPersonnages(spritesEntites, entites, scene.entites, champ, numeroDImage, calquesParImage);
      dessinerLIndicateur(indicateur, scene.indicateur, champ);
      dessinerLesReperes(reperes, scene.reperes);
    },

    redimensionner(largeur: number, hauteur: number) {
      application.renderer.resize(largeur, hauteur);
    },

    detruire() {
      texteDuSol?.destroy(true);
      imprimees.clear();
      application.destroy(true, { children: true });
      spritesEntites.clear();
      calquesParImage.clear();
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
 *
 * L'ECRAN SE MESURE EN PIXELS CSS, CEUX DE LA CAMERA. Dans PixiJS 8, l'ecran de
 * l'application l'est deja. Ce fichier divisait jusqu'a l'etape 5.4 la largeur du
 * rendu par sa densite, une fois de trop: invisible sur un ecran de densite 1, mais
 * sur un telephone de densite 3 le point vise tombait au tiers de l'ecran, le
 * joueur sous le HUD et la carte arretee aux deux tiers (recette de l'etape 5.4).
 */
function placerLaCamera(monde: Container, camera: Camera, application: Application): void {
  const ecran = { largeur: application.screen.width, hauteur: application.screen.height };
  const origine = versEcran({ x: 0, y: 0 }, camera, ecran);

  monde.scale.set(camera.echelle);
  monde.position.set(origine.x, origine.y);
}

/**
 * Redessine tous les disques d'un coup.
 *
 * UN SEUL OBJET GRAPHIQUE POUR TOUS LES DISQUES, refait a chaque image. C'est
 * volontaire: leurs rayons pulsent, donc leur geometrie change de toute facon, et
 * un seul objet donne un seul appel de dessin la ou cent objets en donneraient
 * cent.
 *
 * SEULS LES DISQUES QUE LA CAMERA MONTRE SONT TRACES (etape 5.7). Refaire la geometrie
 * des halos de tous les Black Ninjas de la carte etait, au cadrage d'un telephone, le
 * plus gros travail de PixiJS a chaque image.
 */
function dessinerLesDisques(
  graphique: Graphics,
  disques: readonly DisqueScene[],
  champ: ZoneVisible,
): void {
  graphique.clear();

  for (const disque of disques) {
    if (!dansLaZone(champ, disque.x, disque.y, Math.max(disque.rayon, 0))) {
      continue;
    }

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

/**
 * Dessine les cones du mode Tactique dans l'objet graphique des disques, sans
 * l'effacer: ils passent par-dessus les halos et sous les entites.
 */
function dessinerLesCones(graphique: Graphics, cones: readonly ConeScene[]): void {
  for (const cone of cones) {
    graphique
      .moveTo(cone.x, cone.y)
      .arc(
        cone.x,
        cone.y,
        Math.max(cone.rayon, 0),
        cone.angle - cone.demiOuverture,
        cone.angle + cone.demiOuverture,
      )
      .closePath();
    graphique.fill({ color: cone.remplissage.couleur, alpha: cone.remplissage.alpha });

    if (cone.contour !== undefined) {
      graphique.stroke({
        color: cone.contour.couleur,
        alpha: cone.contour.alpha,
        width: cone.contour.epaisseur,
      });
    }
  }
}

/**
 * Redessine l'arc de nos charges du Tactique (etape 7.7): ses points, la part de la charge
 * qui revient, et ses traits. Meme principe que les disques.
 */
function dessinerLIndicateur(
  graphique: Graphics,
  indicateur: IndicateurScene,
  champ: ZoneVisible,
): void {
  dessinerLesDisques(graphique, indicateur.disques, champ);
  dessinerLesCones(graphique, indicateur.parts);

  for (const trait of indicateur.traits) {
    graphique.poly([...trait.points], false);
    graphique.stroke({
      color: trait.couleur,
      alpha: trait.alpha,
      width: trait.epaisseur,
      cap: 'round',
      join: 'round',
    });
  }
}

/**
 * Redessine les reperes, par-dessus tout le reste: les anneaux qui designent notre
 * personnage (etape 7.8). Meme principe que les disques, dans leur propre calque, le seul
 * qui rayonne.
 */
function dessinerLesReperes(graphique: Graphics, reperes: readonly DisqueScene[]): void {
  graphique.clear();

  for (const repere of reperes) {
    graphique.circle(repere.x, repere.y, Math.max(repere.rayon, 0));

    if (repere.contour !== undefined) {
      graphique.stroke({
        color: repere.contour.couleur,
        alpha: repere.contour.alpha,
        width: repere.contour.epaisseur,
      });
    }
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

/**
 * Un personnage affiche: ses details intacts, et son corps teinte par-dessus.
 *
 * Il retient ce qu'on lui a donne, pour que la transmission ne repose que ce qui
 * change (etape 5.7): c'est l'etat de l'adaptateur, jamais une regle d'apparence.
 */
interface Personnage {
  readonly racine: Container;
  readonly details: Sprite;
  readonly corps: Sprite;
  /** Le numero de la derniere image dont la scene le nommait: un autre, et il est parti. */
  image: number;
  /** L'adresse de l'image dont ses deux calques sont tires; aucune avant sa premiere texture. */
  texture: string | undefined;
  /** La taille posee; aucune quand elle est a reposer, apres un changement de texture. */
  taille: number | undefined;
  /** La teinte posee sur le corps. */
  teinte: number | undefined;
}

/**
 * Met les personnages en accord avec la scene.
 *
 * Meme principe que majSprites, avec deux sprites par personnage. SEUL LE CORPS
 * EST TEINTE: teinter l'image entiere multiplierait aussi le contour et les yeux,
 * et, sur un sprite rouge, ferait du vert un noir (recoloration.ts). L'opacite se
 * pose sur le conteneur, pour que les deux calques s'effacent ensemble.
 *
 * DEUX ALLEGEMENTS DE L'ETAPE 5.7, sans rien changer a ce qui se voit.
 *
 *   - Un personnage hors du champ est cache, et n'est pas mis a jour: PixiJS ne le
 *     parcourt plus. Il ne nait qu'en entrant dans le champ, et, a son retour, recoit
 *     ce qui a change pendant son absence. La marge du champ fait qu'il est deja la
 *     quand son sprite atteint le bord de l'ecran.
 *   - La texture, la taille et la teinte ne sont reposees que si elles changent. La
 *     position, la rotation et l'opacite le sont a chaque image: PixiJS les compare
 *     lui-meme, sans rien convertir.
 *
 * L'ORDRE DE DESSIN EST CELUI DE LA SCENE, par le rang de chaque personnage. Sans lui,
 * tout personnage cree en cours de partie passait devant les autres: un cadavre du
 * Massacre, que la scene met dessous, et desormais tout personnage qui entre dans le
 * champ.
 */
function majPersonnages(
  connus: Map<string, Personnage>,
  parent: ConteneurPixi,
  modele: readonly SpriteScene[],
  champ: ZoneVisible,
  image: number,
  calquesParImage: Map<string, Calques>,
): void {
  modele.forEach((decrit, rang) => {
    let personnage = connus.get(decrit.id);

    if (!dansLaZone(champ, decrit.x, decrit.y)) {
      if (personnage !== undefined) {
        personnage.image = image;
        personnage.racine.visible = false;
      }

      return;
    }

    if (personnage === undefined) {
      personnage = nouveauPersonnage(parent);
      connus.set(decrit.id, personnage);
    }

    personnage.image = image;
    poserLApparence(personnage, decrit, calquesParImage);
    personnage.racine.visible = true;
    personnage.racine.zIndex = rang;
    personnage.racine.position.set(decrit.x, decrit.y);
    personnage.racine.rotation = decrit.rotation ?? 0;
    personnage.racine.alpha = decrit.alpha;
  });

  for (const [id, personnage] of connus) {
    if (personnage.image !== image) {
      personnage.racine.destroy({ children: true });
      connus.delete(id);
    }
  }
}

/** Un personnage neuf, sans texture, pose dans son calque. */
function nouveauPersonnage(parent: ConteneurPixi): Personnage {
  const personnage: Personnage = {
    racine: new Container(),
    details: new Sprite(),
    corps: new Sprite(),
    image: 0,
    texture: undefined,
    taille: undefined,
    teinte: undefined,
  };

  personnage.details.anchor.set(0.5);
  personnage.corps.anchor.set(0.5);
  personnage.racine.addChild(personnage.details, personnage.corps);
  parent.addChild(personnage.racine);

  return personnage;
}

/** Les deux calques d'une image de ninja: le corps a teinter, et les details intacts. */
interface Calques {
  readonly corps: Texture;
  readonly details: Texture;
}

/**
 * Les deux calques de cette image de ninja, ou rien s'ils ne sont pas encore fabriques.
 *
 * Toutes les entites qui marchent changent d'image au meme instant (animation.ts): sans
 * ce rangement, chacune recomposait les deux noms et les cherchait parmi les textures, des
 * centaines de fois dans la meme image.
 */
function calquesDe(calquesParImage: Map<string, Calques>, adresse: string): Calques | undefined {
  const connus = calquesParImage.get(adresse);

  if (connus !== undefined) {
    return connus;
  }

  const corps = Assets.get<Texture>(adresseDuCorps(adresse));
  const details = Assets.get<Texture>(adresseDesDetails(adresse));

  if (corps === undefined || details === undefined) {
    return undefined;
  }

  const calques = { corps, details };
  calquesParImage.set(adresse, calques);

  return calques;
}

/**
 * Pose la texture, la taille et la teinte que la scene demande, seulement si elles ont
 * change.
 *
 * Les deux calques ne se cherchent qu'au changement d'image, et une seule fois par image
 * pour tout le rendu. La taille se repose apres un changement de texture, parce que
 * PixiJS l'exprime en proportion de la texture. La teinte se compare avant d'etre posee:
 * PixiJS la convertit avant de la comparer.
 */
function poserLApparence(
  personnage: Personnage,
  decrit: SpriteScene,
  calquesParImage: Map<string, Calques>,
): void {
  if (personnage.texture !== decrit.texture) {
    const calques = calquesDe(calquesParImage, decrit.texture);

    // Une texture absente est redemandee a l'image suivante.
    if (calques !== undefined) {
      personnage.details.texture = calques.details;
      personnage.corps.texture = calques.corps;
      personnage.texture = decrit.texture;
      personnage.taille = undefined;
    }
  }

  if (personnage.taille !== decrit.taille) {
    poserLaTaille(personnage.details, decrit.taille);
    poserLaTaille(personnage.corps, decrit.taille);
    personnage.taille = decrit.taille;
  }

  if (personnage.teinte !== decrit.teinte) {
    personnage.corps.tint = decrit.teinte;
    personnage.teinte = decrit.teinte;
  }
}

/**
 * Dessine une forme de sang: une ellipse pleine, tournee. PixiJS ne sait pas tourner une
 * ellipse seule dans un objet graphique commun: elle est tracee en polygone.
 */
function dessinerUneForme(pinceau: Graphics, forme: FormeDeSang): void {
  const points: number[] = [];
  const cos = Math.cos(forme.rotation);
  const sin = Math.sin(forme.rotation);

  for (let cote = 0; cote < COTES_D_UNE_ELLIPSE; cote += 1) {
    const t = (2 * Math.PI * cote) / COTES_D_UNE_ELLIPSE;
    const ex = Math.cos(t) * forme.rayonX;
    const ey = Math.sin(t) * forme.rayonY;
    points.push(forme.x + ex * cos - ey * sin, forme.y + ex * sin + ey * cos);
  }

  pinceau.poly(points).fill({ color: forme.couleur, alpha: forme.alpha });
}

/**
 * Etire un sprite a ce cote, d'apres les dimensions de sa texture. C'est ce que font
 * les proprietes width et height de PixiJS, sans leurs calculs de signe.
 */
function poserLaTaille(sprite: Sprite, cote: number): void {
  const { width, height } = sprite.texture.orig;

  sprite.scale.set(cote / width, cote / height);
}
