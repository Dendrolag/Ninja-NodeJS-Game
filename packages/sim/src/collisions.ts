/**
 * Le terrain: ou l'on peut marcher, et ou l'on ne peut pas.
 *
 * Portage de CollisionMap (legacy/server.js:327). Quatre differences de fond
 * avec l'original, toutes voulues.
 *
 * 1. AUCUNE LECTURE D'IMAGE ICI. Le legacy ouvrait un fichier collision.png au
 *    demarrage, le dessinait dans un canvas et lisait ses pixels. C'est une
 *    entree-sortie, interdite dans le coeur de simulation. Le decodage de
 *    l'image appartient a packages/server; ce module recoit des pixels deja
 *    decodes (carteDepuisPixels) ou une simple regle (creerCarteCollisions), et
 *    n'en garde qu'une donnee: un mur ou pas, pixel par pixel.
 *
 * 2. LA CARTE NE CONNAIT PLUS DE PARTIE EN COURS. Le legacy allait chercher les
 *    dimensions dans une variable de module a chaque test de collision. Ici les
 *    dimensions sont portees par la carte elle-meme, donc deux parties sur deux
 *    cartes de tailles differentes ne peuvent plus se marcher dessus.
 *
 * 3. UN BIT PAR PIXEL AU LIEU D'UN TABLEAU DE BOOLEENS. Le legacy construisait un
 *    tableau de tableaux de booleens aux dimensions de la carte: six millions
 *    d'entrees pour la grande carte, soit plusieurs dizaines de megaoctets. La
 *    meme information tient ici dans 750 kilo-octets, a resolution identique, le
 *    pixel. On ne perd donc aucune precision par rapport au jeu d'origine, et on
 *    reste taille-agnostique: seules les dimensions recues comptent.
 *
 * 4. LE TRAJET EST BALAYE, PAS SEULEMENT SON POINT D'ARRIVEE. C'est la correction
 *    du defaut X15 de l'audit, expliquee sur trajetTenable.
 *
 * Une carte est une donnee constante pour toute la duree d'une partie: on la
 * construit une fois, on ne l'ecrit plus jamais ensuite.
 */

import type { DimensionsCarte, Position, Vecteur } from '@neon-ninja/shared';
import { RAYON_ENTITE } from '@neon-ninja/shared';

/**
 * Un pixel est un mur quand la moyenne de ses trois composantes de couleur passe
 * sous ce seuil. Valeur du legacy (server.js:369), c'est-a-dire la regle qui a
 * dessine les murs des cartes existantes: elle ne se change pas sans redessiner
 * les cartes.
 */
export const SEUIL_MUR_LUMINOSITE = 128;

/**
 * Nombre de points testes sur le pourtour d'une entite, en plus de son centre.
 * Le legacy en teste huit, sur deux cercles concentriques, soit seize points.
 */
const POINTS_CONTOUR = 8;

/** Rayon du second cercle de controle, en proportion du rayon de l'entite. */
const FACTEUR_RAYON_INTERIEUR = 0.7;

/**
 * Finesse du balayage d'un trajet, en pixels.
 *
 * Un pixel: c'est la resolution de la carte elle-meme, donc aucun mur, si fin
 * soit-il, ne peut se glisser entre deux points de controle.
 */
const PAS_BALAYAGE_PX = 1;

/** Les huit directions de controle, en vecteurs unitaires, calculees une fois. */
const CONTOUR_UNITAIRE: readonly Vecteur[] = Array.from({ length: POINTS_CONTOUR }, (_, index) => {
  const angle = (index / POINTS_CONTOUR) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

/**
 * Le terrain d'une partie: ses dimensions, et un mur ou du sol pour chaque pixel.
 *
 * Le champ murs est un tableau d'octets ou chaque bit vaut un pixel. Il se lit
 * par estMur et ne s'ecrit qu'a la construction. Personne ne doit y toucher
 * ensuite: la carte est partagee par tous les etats successifs d'une partie,
 * l'ecrire reviendrait a introduire l'etat global mutable que ce projet refuse.
 */
export interface CarteCollisions {
  readonly largeur: number;
  readonly hauteur: number;
  readonly murs: Uint8Array;
}

/** Nombre d'octets necessaires pour stocker un bit par pixel. */
function tailleEnOctets(largeur: number, hauteur: number): number {
  return Math.ceil((largeur * hauteur) / 8);
}

/**
 * Lit une case d'un tableau dont on sait deja que l'indice est valide.
 *
 * Le projet compile avec noUncheckedIndexedAccess, qui suppose toute lecture
 * indexee possiblement vide. C'est une excellente regle, mais ici l'indice vient
 * toujours d'un calcul borne juste avant. Ecrire un repli « ou zero » ajouterait
 * un cas qu'aucun test ne peut atteindre, donc une ligne morte deguisee en
 * prudence. On declare l'invariant a un seul endroit, celui-ci.
 */
function caseSure(tableau: ArrayLike<number>, index: number): number {
  return tableau[index] as number;
}

/** Allume le bit du pixel d'indice donne: ce pixel devient un mur. */
function marquerMur(murs: Uint8Array, index: number): void {
  const octet = index >> 3;
  murs[octet] = caseSure(murs, octet) | (1 << (index & 7));
}

/** Verifie que des dimensions de carte ont un sens avant de construire quoi que ce soit. */
function verifierDimensions(dimensions: DimensionsCarte): void {
  const { largeur, hauteur } = dimensions;
  if (!Number.isInteger(largeur) || !Number.isInteger(hauteur) || largeur <= 0 || hauteur <= 0) {
    throw new Error(
      `Les dimensions d'une carte doivent etre des entiers positifs, recu ${largeur}x${hauteur}.`,
    );
  }
}

/**
 * Construit une carte a partir d'une regle: pour chaque pixel, mur ou pas.
 *
 * C'est la porte d'entree la plus simple, celle des tests et des cartes
 * generees. Sans regle, la carte est entierement praticable: c'est l'equivalent
 * de initializeEmptyCollisionMap (legacy/server.js:459), le repli du legacy
 * quand son image de collision manquait.
 */
export function creerCarteCollisions(
  dimensions: DimensionsCarte,
  estUnMur?: (x: number, y: number) => boolean,
): CarteCollisions {
  verifierDimensions(dimensions);

  const { largeur, hauteur } = dimensions;
  const murs = new Uint8Array(tailleEnOctets(largeur, hauteur));

  if (estUnMur !== undefined) {
    for (let y = 0; y < hauteur; y += 1) {
      for (let x = 0; x < largeur; x += 1) {
        if (estUnMur(x, y)) {
          marquerMur(murs, y * largeur + x);
        }
      }
    }
  }

  return { largeur, hauteur, murs };
}

/** Une carte entierement praticable, bornee par ses seuls bords. */
export function carteSansMur(dimensions: DimensionsCarte): CarteCollisions {
  return creerCarteCollisions(dimensions);
}

/**
 * Construit une carte a partir des pixels d'une image de collision deja decodee.
 *
 * Portage de la boucle de seuillage de CollisionMap.initialize
 * (legacy/server.js:355 a 372). Les donnees attendues sont celles d'un canvas:
 * quatre octets par pixel, rouge, vert, bleu, opacite, ligne par ligne depuis le
 * coin superieur gauche. L'opacite est ignoree, comme dans le legacy.
 *
 * Le decodage du fichier PNG lui-meme n'a pas sa place ici: il vit dans
 * packages/server, qui appelle cette fonction avec le resultat.
 */
export function carteDepuisPixels(
  donnees: ArrayLike<number>,
  dimensions: DimensionsCarte,
): CarteCollisions {
  verifierDimensions(dimensions);

  const { largeur, hauteur } = dimensions;
  const attendu = largeur * hauteur * 4;
  if (donnees.length !== attendu) {
    throw new Error(
      `Une image de ${largeur}x${hauteur} doit fournir ${attendu} octets, recu ${donnees.length}.`,
    );
  }

  const murs = new Uint8Array(tailleEnOctets(largeur, hauteur));

  for (let index = 0; index < largeur * hauteur; index += 1) {
    const depart = index * 4;
    const rouge = caseSure(donnees, depart);
    const vert = caseSure(donnees, depart + 1);
    const bleu = caseSure(donnees, depart + 2);

    if ((rouge + vert + bleu) / 3 < SEUIL_MUR_LUMINOSITE) {
      marquerMur(murs, index);
    }
  }

  return { largeur, hauteur, murs };
}

/**
 * Y a-t-il un mur a cet endroit ?
 *
 * Portage de checkCollision (legacy/server.js:430), y compris son parti pris le
 * plus utile: tout ce qui est hors de la carte compte comme un mur. C'est ce qui
 * enferme les entites dans le terrain sans avoir a traiter les bords a part.
 *
 * Les coordonnees sont continues, la carte est discrete: on prend le pixel qui
 * contient le point, comme le legacy.
 */
export function estMur(carte: CarteCollisions, x: number, y: number): boolean {
  const colonne = Math.floor(x);
  const ligne = Math.floor(y);

  if (colonne < 0 || colonne >= carte.largeur || ligne < 0 || ligne >= carte.hauteur) {
    return true;
  }

  const index = ligne * carte.largeur + colonne;
  return (caseSure(carte.murs, index >> 3) & (1 << (index & 7))) !== 0;
}

/**
 * Une entite de ce rayon tient-elle a cet endroit ?
 *
 * Portage de la partie « points de controle » de canMove (legacy/server.js:411 a
 * 424): le centre, puis huit directions sur deux cercles concentriques. Ces
 * seize points sont un echantillonnage du disque de l'entite, pas le disque
 * entier: c'est la geometrie du jeu d'origine, et la caracterisation l'a figee
 * au pixel pres (un mur arrete l'entite quand son point de contour l'atteint,
 * pas quand son centre l'atteint).
 *
 * Le test de bornes explicite du legacy n'est pas porte: il faisait double
 * emploi avec le hors-carte de estMur, qui refuse deja tout point sorti.
 */
export function positionTenable(
  carte: CarteCollisions,
  position: Position,
  rayon: number = RAYON_ENTITE,
): boolean {
  if (estMur(carte, position.x, position.y)) {
    return false;
  }

  const rayonInterieur = rayon * FACTEUR_RAYON_INTERIEUR;

  for (const direction of CONTOUR_UNITAIRE) {
    if (estMur(carte, position.x + direction.x * rayon, position.y + direction.y * rayon)) {
      return false;
    }
    if (
      estMur(
        carte,
        position.x + direction.x * rayonInterieur,
        position.y + direction.y * rayonInterieur,
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Une entite peut-elle aller d'ici a la, sans traverser de mur ?
 *
 * C'EST ICI QUE LE DEFAUT X15 DE L'AUDIT EST CORRIGE. Le canMove du legacy
 * recevait un point de depart et ne le lisait jamais: il ne testait que
 * l'arrivee. Un mur de deux pixels de large se traversait donc en un seul
 * deplacement, aucun point de controle ne tombant dessus. Les tests de
 * caracterisation le montrent (« laisse traverser un mur fin en un seul
 * deplacement »), et le signalent comme une limite de methode a corriger par
 * conception, pas comme un reglage de jeu a preserver.
 *
 * La correction consiste a balayer le trajet: on avance d'un pixel a la fois du
 * depart vers l'arrivee, et l'entite doit tenir a chaque etape. Un mur ne peut
 * plus passer entre deux controles, puisque le pas de balayage vaut exactement
 * la resolution de la carte.
 *
 * Le point de depart n'est pas teste: c'est la ou l'entite se trouve deja. Une
 * entite placee de force dans un mur par un appelant y reste donc bloquee, ce
 * qui est le comportement voulu: les positions viennent soit d'une apparition
 * validee, soit d'un deplacement lui-meme valide.
 */
export function trajetTenable(
  carte: CarteCollisions,
  depart: Position,
  arrivee: Position,
  rayon: number = RAYON_ENTITE,
): boolean {
  const dx = arrivee.x - depart.x;
  const dy = arrivee.y - depart.y;
  const etapes = Math.max(1, Math.ceil(Math.hypot(dx, dy) / PAS_BALAYAGE_PX));

  for (let etape = 1; etape <= etapes; etape += 1) {
    const fraction = etape / etapes;
    const intermediaire = { x: depart.x + dx * fraction, y: depart.y + dy * fraction };

    if (!positionTenable(carte, intermediaire, rayon)) {
      return false;
    }
  }

  return true;
}
