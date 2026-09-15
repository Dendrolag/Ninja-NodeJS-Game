/**
 * Le decodage du terrain: de l'image de collision a la carte des murs.
 *
 * C'EST LA DETTE LA PLUS ANCIENNE DU PROJET QUI SE FERME ICI. Depuis l'etape
 * 2.1, toutes les parties se jouaient sur une carte sans aucun mur: le moteur
 * savait tenir un terrain, personne ne lui en donnait. Le jeu tournait, mais ce
 * n'etait pas le jeu. La raison de l'attente etait bonne: le moteur n'a pas le
 * droit d'ouvrir un fichier, et decoder une image est une entree-sortie. Elle
 * appartient donc a ce paquet, et a lui seul.
 *
 * CE FICHIER EST LA FRONTIERE. Il ouvre un fichier, il decode un format, et il
 * rend une donnee pure que le moteur sait consommer. Rien de ce qui suit ne sait
 * qu'un fichier existe.
 *
 * DEUX PARTICULARITES DU JEU D'ORIGINE SONT REPRODUITES A L'IDENTIQUE, parce que
 * ce sont elles qui placent les murs la ou deux ans de jeu les ont mis.
 *
 * 1. LES IMAGES SONT REDIMENSIONNEES. Les six collision.png mesurent toutes
 *    3000x2000, alors que map1 et map2 mesurent 2000x1500. Le jeu d'origine les
 *    dessinait dans un canevas aux dimensions de la carte (server.js:352), ce
 *    qui les ecrase sans conserver les proportions. Ignorer ce redimensionnement
 *    donnerait des murs decales de plusieurs centaines de pixels par rapport au
 *    decor. Voir redimensionner ci-dessous.
 *
 * 2. LE SEUIL EST SUR LA MOYENNE DES TROIS COMPOSANTES, a 128, et l'opacite est
 *    ignoree. C'est la regle qui a dessine les murs des cartes existantes; elle
 *    vit dans packages/sim, avec la constante qui la porte.
 *
 * UNE CARTE DECODEE EST GARDEE EN MEMOIRE. Elle ne depend que de la carte et du
 * mode miroir, elle ne change jamais, et elle est partagee sans risque: la
 * CarteCollisions est en lecture seule et tous les etats successifs d'une partie
 * pointent deja vers la meme. Decoder six millions de pixels a chaque partie
 * lancee serait du travail refait pour un resultat identique.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DimensionsCarte, IdentifiantCarte } from '@neon-ninja/shared';
import { CARTES, cheminCarte } from '@neon-ninja/shared';
import type { CarteCollisions } from '@neon-ninja/sim';
import { carteDepuisPixels } from '@neon-ninja/sim';
import { PNG } from 'pngjs';

/** Nombre d'octets par pixel dans une image decodee: rouge, vert, bleu, opacite. */
const OCTETS_PAR_PIXEL = 4;

/**
 * Racine des ressources sur le disque du serveur.
 *
 * Elle se deduit de l'emplacement de ce fichier, ce qui la rend juste aussi bien
 * depuis les sources (packages/server/src) que depuis la compilation
 * (packages/server/dist). La variable d'environnement CHEMIN_RESSOURCES prend le
 * dessus, pour les environnements ou les ressources ne sont pas rangees a cote
 * du code.
 */
export function racineRessources(): string {
  const surchargee = process.env['CHEMIN_RESSOURCES'];

  if (surchargee !== undefined && surchargee.length > 0) {
    return resolve(surchargee);
  }

  // Ce fichier vit dans packages/server/{src,dist}: la racine du depot est trois
  // niveaux au-dessus.
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets');
}

/**
 * Ramene une image decodee aux dimensions d'une carte, en moyennant les pixels.
 *
 * POURQUOI UNE MOYENNE ET NON UN SIMPLE PRELEVEMENT. Le jeu d'origine confiait la
 * reduction au canevas du navigateur, qui lisse. Prendre un pixel sur trois
 * ferait disparaitre un mur fin d'un pixel de large deux fois sur trois, et le
 * ferait apparaitre deux fois plus epais la troisieme. Moyenner la zone source
 * qui correspond a chaque pixel de destination donne le meme genre de resultat
 * que le lissage du canevas, et il est deterministe: deux serveurs decodent la
 * meme carte a l'identique.
 *
 * L'IMAGE N'EST PAS REDIMENSIONNEE A PROPORTIONS EGALES, et c'est voulu: une
 * image 3000x2000 ramenee a 2000x1500 est ecrasee verticalement. C'est ce que
 * fait le jeu d'origine, et c'est ce que fera l'affichage du decor.
 *
 * @param pixels     Image source, quatre octets par pixel.
 * @param source     Dimensions de l'image source.
 * @param dimensions Dimensions voulues.
 */
export function redimensionner(
  pixels: Uint8Array,
  source: DimensionsCarte,
  dimensions: DimensionsCarte,
): Uint8Array {
  if (source.largeur === dimensions.largeur && source.hauteur === dimensions.hauteur) {
    return pixels;
  }

  const sortie = new Uint8Array(dimensions.largeur * dimensions.hauteur * OCTETS_PAR_PIXEL);
  const echelleX = source.largeur / dimensions.largeur;
  const echelleY = source.hauteur / dimensions.hauteur;

  for (let ligne = 0; ligne < dimensions.hauteur; ligne += 1) {
    const debutY = Math.floor(ligne * echelleY);
    const finY = Math.max(debutY + 1, Math.floor((ligne + 1) * echelleY));

    for (let colonne = 0; colonne < dimensions.largeur; colonne += 1) {
      const debutX = Math.floor(colonne * echelleX);
      const finX = Math.max(debutX + 1, Math.floor((colonne + 1) * echelleX));

      let rouge = 0;
      let vert = 0;
      let bleu = 0;
      let opacite = 0;
      let comptes = 0;

      for (let y = debutY; y < finY; y += 1) {
        for (let x = debutX; x < finX; x += 1) {
          const depart = (y * source.largeur + x) * OCTETS_PAR_PIXEL;
          rouge += pixels[depart] ?? 0;
          vert += pixels[depart + 1] ?? 0;
          bleu += pixels[depart + 2] ?? 0;
          opacite += pixels[depart + 3] ?? 0;
          comptes += 1;
        }
      }

      const destination = (ligne * dimensions.largeur + colonne) * OCTETS_PAR_PIXEL;
      sortie[destination] = Math.round(rouge / comptes);
      sortie[destination + 1] = Math.round(vert / comptes);
      sortie[destination + 2] = Math.round(bleu / comptes);
      sortie[destination + 3] = Math.round(opacite / comptes);
    }
  }

  return sortie;
}

/**
 * Decode une image de collision deja lue en memoire, et en tire une carte.
 *
 * Separee de la lecture du fichier pour une raison precise: elle se teste avec
 * une image fabriquee sur mesure, sans toucher au disque ni dependre du contenu
 * des cartes du jeu.
 */
export function terrainDepuisImage(image: Buffer, dimensions: DimensionsCarte): CarteCollisions {
  const decodee = PNG.sync.read(image);
  const pixels = redimensionner(
    Uint8Array.from(decodee.data),
    { largeur: decodee.width, hauteur: decodee.height },
    dimensions,
  );

  return carteDepuisPixels(pixels, dimensions);
}

/** Ce qui identifie un terrain: une carte, et son mode miroir. */
export interface CleDeTerrain {
  readonly carte: IdentifiantCarte;
  readonly modeMiroir: boolean;
}

/**
 * D'ou le serveur tire les murs d'une carte.
 *
 * UNE INTERFACE PLUTOT QUE LA CLASSE DIRECTEMENT, pour la meme raison que la
 * couche reseau du client passe par une interface: la couche qui monte les
 * parties n'a pas a savoir qu'un fichier existe. C'est aussi ce qui permet aux
 * tests de decider s'ils jouent avec des murs ou sans, sans jamais toucher au
 * disque.
 *
 * Rendre undefined signifie « cette partie se joue sans mur », et c'est une
 * reponse normale. Lever une erreur signifie « les murs devraient etre la et ils
 * n'y sont pas », ce qui est une anomalie d'installation.
 */
export interface SourceDeTerrain {
  charger(cle: CleDeTerrain): CarteCollisions | undefined;
}

/**
 * Une source qui ne fournit aucun mur, pour les parties qui n'en veulent pas.
 *
 * Les tests d'integration du serveur et du client s'en servent: ils verifient
 * des messages et des sequences, pas des collisions, et decoder six millions de
 * pixels avant chacun d'eux couterait des secondes pour un resultat qu'ils
 * n'observent pas. Les collisions, elles, sont couvertes la ou elles vivent,
 * dans packages/sim et dans les tests de ce fichier.
 */
export const SANS_TERRAIN: SourceDeTerrain = {
  charger: () => undefined,
};

/**
 * Le chargeur de terrains d'un serveur.
 *
 * C'EST UNE INSTANCE, PAS UNE VARIABLE DE MODULE, comme tout ce qui retient
 * quelque chose dans ce projet. Deux serveurs montes dans le meme processus,
 * comme le font les tests, ont chacun leur cache et ne se voient pas.
 */
export class ChargeurDeTerrain implements SourceDeTerrain {
  private readonly racine: string;
  private readonly cache = new Map<string, CarteCollisions>();

  /**
   * @param racine Racine des ressources sur le disque. Celle du depot par defaut.
   */
  constructor(racine: string = racineRessources()) {
    this.racine = racine;
  }

  /**
   * Le terrain d'une carte, decode au premier appel puis garde en memoire.
   *
   * @throws Si l'image est introuvable ou illisible. Le serveur doit s'en
   *         apercevoir au demarrage plutot que de faire jouer une partie sans
   *         murs sans le dire: c'est exactement ce que le jeu d'origine faisait,
   *         qui remplacait silencieusement une carte manquante par une carte
   *         vide.
   */
  charger({ carte, modeMiroir }: CleDeTerrain): CarteCollisions {
    const cle = `${carte}/${String(modeMiroir)}`;
    const deja = this.cache.get(cle);

    if (deja !== undefined) {
      return deja;
    }

    const chemin = join(this.racine, cheminCarte(carte, modeMiroir, 'collision'));
    const dimensions = CARTES[carte];
    const terrain = terrainDepuisImage(readFileSync(chemin), dimensions);

    this.cache.set(cle, terrain);

    return terrain;
  }

  /** Combien de terrains sont deja decodes. Sert aux tests et a la mesure. */
  get tailleDuCache(): number {
    return this.cache.size;
  }
}
