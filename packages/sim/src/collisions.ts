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
  /**
   * Le morceau principal de la carte (etape 8.10), un bit par point entier, ecrit a la
   * construction comme murs. Absent sur une carte sans mur, d'un seul tenant par
   * construction. Il se lit par dansLeMorceauPrincipal.
   */
  readonly morceauPrincipal?: Uint8Array;
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

/** Allume le bit du pixel d'indice donne: un mur dans murs, un point du morceau dans morceauPrincipal. */
function allumerBit(bits: Uint8Array, index: number): void {
  const octet = index >> 3;
  bits[octet] = caseSure(bits, octet) | (1 << (index & 7));
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

  if (estUnMur === undefined) {
    return { largeur, hauteur, murs };
  }

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (estUnMur(x, y)) {
        allumerBit(murs, y * largeur + x);
      }
    }
  }

  return avecMorceauPrincipal({ largeur, hauteur, murs });
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
      allumerBit(murs, index);
    }
  }

  return avecMorceauPrincipal({ largeur, hauteur, murs });
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

/**
 * LE MORCEAU PRINCIPAL D'UNE CARTE (etape 8.10).
 *
 * positionTenable ne regarde que dix-sept points du disque d'une entite, ecartes de huit
 * pixels au plus. Un trait de mur plus fin que neuf pixels peut passer entre deux d'entre
 * eux: la place a cheval sur lui est jugee bonne. Au pied d'un tel trait naissent des
 * places tenables coupees du reste de la carte, des poches. Le jeu d'origine en avait onze
 * sur Tokyo, et une apparition pouvait y tomber: le ninja y restait toute la partie.
 *
 * On ne touche pas a positionTenable, qui regle la facon dont les ninjas frolent les murs
 * depuis deux ans. On calcule plutot, une fois pour toutes a la construction de la carte,
 * le plus grand morceau d'un seul tenant, et les apparitions s'y tiennent.
 *
 * Le calcul porte sur les points entiers de la carte. Deux points voisins par un cote sont
 * relies: aller de l'un a l'autre est un pas d'un pixel, que trajetTenable accepte des que
 * l'arrivee tient. Tout le morceau est donc atteignable a coup sur. Les diagonales ne
 * comptent pas: elles pourraient relier une poche par un coin que le moteur refuse, et
 * aucune carte du jeu n'en a besoin pour rester d'un seul tenant (mesure de l'etape 8.10).
 *
 * Le morceau est celui d'une entite de taille ordinaire, RAYON_ENTITE: c'est la taille de
 * tout ce qui apparait.
 */

/** Les quatre points entiers qui entourent une position a coordonnees reelles. */
const COINS_D_UNE_CASE: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/** Une carte et son morceau principal, calcule une fois. */
function avecMorceauPrincipal(carte: CarteCollisions): CarteCollisions {
  return { ...carte, morceauPrincipal: calculerMorceauPrincipal(carte) };
}

/**
 * Les seize decalages du contour d'une entite ordinaire, exactement ceux de positionTenable
 * (meme produit, meme somme en virgule flottante).
 */
const DECALAGES_DU_CONTOUR: readonly Vecteur[] = CONTOUR_UNITAIRE.flatMap((direction) => [
  { x: direction.x * RAYON_ENTITE, y: direction.y * RAYON_ENTITE },
  {
    x: direction.x * (RAYON_ENTITE * FACTEUR_RAYON_INTERIEUR),
    y: direction.y * (RAYON_ENTITE * FACTEUR_RAYON_INTERIEUR),
  },
]);

/**
 * Le plus grand decalage du contour, en pixels: seize, le long des axes. Un point plus
 * proche du bord n'est jamais tenable, son contour sortant de la carte.
 */
const PORTEE_DU_CONTOUR = Math.round(RAYON_ENTITE);

/**
 * Abscisse a partir de laquelle les decalages du contour, arrondis au pixel, ne changent
 * plus. En dessous, la virgule flottante peut faire tomber un decalage presque nul (le
 * contour vers le haut, a un milliardieme de pixel pres) d'un cote ou de l'autre d'une
 * colonne: ces premieres colonnes ont chacune leurs decalages.
 */
const ABSCISSE_DES_DECALAGES_FIXES = 64;

/**
 * Les seize decalages du contour en indices du tableau des murs, pour un point d'abscisse
 * donnee: positionTenable lit la case Math.floor(x + dx), Math.floor(y + dy), et ces
 * indices la designent sans refaire le calcul.
 */
function decalagesEnIndices(x: number, largeur: number): Int32Array {
  const y = ABSCISSE_DES_DECALAGES_FIXES;
  return Int32Array.from(
    DECALAGES_DU_CONTOUR,
    (decalage) => (Math.floor(y + decalage.y) - y) * largeur + (Math.floor(x + decalage.x) - x),
  );
}

/**
 * Un octet par point entier: 1 si une entite ordinaire y tient.
 *
 * Le meme verdict que positionTenable, point par point, mais sur une copie des murs a un
 * octet par pixel et des decalages precalcules: juger les trois a quatre millions de points
 * d'une carte reste ainsi l'affaire de quelques dizaines de millisecondes, sans bloquer
 * le serveur qui la charge.
 *
 * Exportee pour ses tests seulement, qui la comparent a positionTenable; le paquet ne
 * l'expose pas.
 */
export function pointsTenables(carte: CarteCollisions): Uint8Array {
  const { largeur, hauteur } = carte;
  const total = largeur * hauteur;
  const murs = new Uint8Array(total);
  const tenables = new Uint8Array(total);

  for (let index = 0; index < total; index += 1) {
    murs[index] = (caseSure(carte.murs, index >> 3) >> (index & 7)) & 1;
  }

  const fixes = decalagesEnIndices(ABSCISSE_DES_DECALAGES_FIXES, largeur);
  const premieres = Array.from({ length: ABSCISSE_DES_DECALAGES_FIXES }, (_, x) =>
    decalagesEnIndices(x, largeur),
  );

  for (let y = PORTEE_DU_CONTOUR; y < hauteur - PORTEE_DU_CONTOUR; y += 1) {
    for (let x = PORTEE_DU_CONTOUR; x < largeur - PORTEE_DU_CONTOUR; x += 1) {
      const index = y * largeur + x;
      const decalages = x < ABSCISSE_DES_DECALAGES_FIXES ? (premieres[x] ?? fixes) : fixes;

      if (caseSure(murs, index) === 0 && contourLibre(murs, index, decalages)) {
        tenables[index] = 1;
      }
    }
  }

  return tenables;
}

/** Aucun des seize points du contour ne tombe sur un mur. */
function contourLibre(murs: Uint8Array, index: number, decalages: Int32Array): boolean {
  for (let rang = 0; rang < decalages.length; rang += 1) {
    if (caseSure(murs, index + caseSure(decalages, rang)) === 1) {
      return false;
    }
  }

  return true;
}

/**
 * Parcourt le morceau d'un seul tenant qui contient un point, en marquant ses points dans
 * vus. Rend le nombre de points du morceau, ranges en tete de file.
 *
 * Aucun test de bord: un point tenable est a seize pixels au moins du bord de la carte
 * (PORTEE_DU_CONTOUR), si bien que ses quatre voisins sont toujours dans la carte, et sur
 * sa ligne pour ceux de gauche et de droite.
 *
 * @param file Tableau de travail, de la taille de la carte, prete pour eviter d'en
 *        allouer un a chaque morceau.
 */
function parcourirMorceau(
  tenables: Uint8Array,
  largeur: number,
  depart: number,
  vus: Uint8Array,
  file: Int32Array,
): number {
  const voisins = Int32Array.of(1, -1, largeur, -largeur);
  let lecture = 0;
  let ecriture = 1;
  file[0] = depart;
  vus[depart] = 1;

  while (lecture < ecriture) {
    const point = caseSure(file, lecture);
    lecture += 1;

    for (let rang = 0; rang < voisins.length; rang += 1) {
      const voisin = point + caseSure(voisins, rang);

      if (caseSure(tenables, voisin) === 1 && caseSure(vus, voisin) === 0) {
        vus[voisin] = 1;
        file[ecriture] = voisin;
        ecriture += 1;
      }
    }
  }

  return ecriture;
}

/**
 * Le plus grand morceau d'un seul tenant de la carte, un bit par point entier. A egalite,
 * le premier rencontre dans l'ordre de lecture, pour que le calcul reste deterministe.
 * Vide quand aucun point ne tient.
 */
function calculerMorceauPrincipal(carte: CarteCollisions): Uint8Array {
  const { largeur, hauteur } = carte;
  const tenables = pointsTenables(carte);
  const file = new Int32Array(tenables.length);
  const vus = new Uint8Array(tenables.length);
  let meilleurDepart = -1;
  let meilleureTaille = 0;

  for (let point = 0; point < tenables.length; point += 1) {
    if (caseSure(tenables, point) === 1 && caseSure(vus, point) === 0) {
      const taille = parcourirMorceau(tenables, largeur, point, vus, file);

      if (taille > meilleureTaille) {
        meilleureTaille = taille;
        meilleurDepart = point;
      }
    }
  }

  const morceau = new Uint8Array(tailleEnOctets(largeur, hauteur));

  if (meilleurDepart >= 0) {
    const retenus = new Uint8Array(tenables.length);
    const taille = parcourirMorceau(tenables, largeur, meilleurDepart, retenus, file);

    for (let rang = 0; rang < taille; rang += 1) {
      allumerBit(morceau, caseSure(file, rang));
    }
  }

  return morceau;
}

/**
 * Ce point entier est-il dans le morceau principal ? Il n'est demande que pour les coins
 * d'une place qui tient, a seize pixels au moins du bord: il est toujours dans la carte.
 */
function pointDuMorceau(
  carte: CarteCollisions,
  morceau: Uint8Array,
  x: number,
  y: number,
): boolean {
  const index = y * carte.largeur + x;
  return (caseSure(morceau, index >> 3) & (1 << (index & 7))) !== 0;
}

/**
 * Une entite ordinaire posee ici est-elle dans le morceau principal de la carte ?
 *
 * Vrai si elle tient, et si un trajet tenable la mene a l'un des quatre points entiers qui
 * l'entourent, pris dans le morceau. Sur une carte sans morceau calcule, une carte sans
 * mur, il suffit qu'elle tienne.
 */
export function dansLeMorceauPrincipal(carte: CarteCollisions, position: Position): boolean {
  if (!positionTenable(carte, position)) {
    return false;
  }

  const morceau = carte.morceauPrincipal;
  if (morceau === undefined) {
    return true;
  }

  const x = Math.floor(position.x);
  const y = Math.floor(position.y);

  return COINS_D_UNE_CASE.some(([dx, dy]) => {
    const coin = { x: x + dx, y: y + dy };
    return pointDuMorceau(carte, morceau, coin.x, coin.y) && trajetTenable(carte, position, coin);
  });
}
