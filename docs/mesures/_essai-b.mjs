/**
 * Dessine la carte de travail « Quartier », et ecrit ses huit images.
 *
 * CE N'EST PAS DU CODE DE JEU. Rien dans packages/ ne connait ce fichier, et le
 * jeu tourne sans lui. C'est l'outil de l'etape 8.2 (docs/plan/etape-8-2.md):
 * il existe pour que la geometrie de la carte soit une chose qu'on relit et
 * qu'on corrige, et non une image qu'on redessine.
 *
 * POURQUOI UN PROGRAMME PLUTOT QU'UN DESSIN. Une carte se juge a la mesure
 * (docs/mesures/etude-structures-de-carte.md, section 4), et la mesure demande
 * des essais: deplacer une rue de trente pixels, refaire tourner, regarder le
 * detour. Dans un editeur d'images, chaque essai serait un nouveau dessin. Ici
 * c'est une ligne du plan ci-dessous, et deux secondes de calcul.
 *
 * Lancement, depuis la racine du depot:
 *
 *   node docs/mesures/dessiner-le-quartier.mjs
 *   node docs/mesures/mesurer-les-cartes.mjs quartier
 *
 * AUCUN ANTICRENELAGE. Chaque pixel de collision.png est noir pur ou blanc pur.
 * Le seuil de luminosite du serveur (128) ne rencontre donc aucun gris, et le
 * mur reel est exactement le mur dessine. Un bord adouci donnerait un mur un
 * peu plus gros que le trait, de la moitie de l'adoucissement.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOSSIER = join(RACINE, 'assets', 'cartes', 'quartier');

/** Dimensions de la carte, celles decidees par le porteur du projet le 20 septembre 2026. */
const LARGEUR = 2400;
const HAUTEUR = 1800;

/**
 * Les bandes qui se succedent d'ouest en est.
 *
 * Un quartier n'est que cela: des bandes d'ilots separees par des bandes de rue.
 * Les tailles s'additionnent exactement a la largeur de la carte, et un controle
 * le verifie plus bas: des bandes qui ne tombent pas juste donneraient un bord de
 * travers que personne ne remarquerait avant d'y jouer.
 *
 * AUCUNE RUE NE LONGE LE BORD DE LA CARTE. Les ilots y touchent directement. Un
 * boulevard peripherique a ete essaye puis abandonne: il offrait un contournement
 * gratuit de tout le quartier, et il remplissait de sol la bande de cent pixels ou
 * se tirent toutes les apparitions, qui doit en contenir le moins possible
 * (critere 3 de l'etude).
 */
const BANDES_X = [
  { nature: 'ilot', taille: 530 },
  { nature: 'rue', taille: 120 },
  { nature: 'ilot', taille: 480 },
  { nature: 'artere', taille: 170 },
  { nature: 'ilot', taille: 490 },
  { nature: 'rue', taille: 120 },
  { nature: 'ilot', taille: 490 },
];

/** Les memes bandes, du nord au sud. */
const BANDES_Y = [
  { nature: 'ilot', taille: 545 },
  { nature: 'rue', taille: 120 },
  { nature: 'ilot', taille: 490 },
  { nature: 'artere', taille: 150 },
  { nature: 'ilot', taille: 495 },
];

/**
 * Le plan du quartier: ce qu'on fait de chacune des douze cellules.
 *
 * Les cellules se numerotent [ligne, colonne], a partir de zero, du nord-ouest.
 * Quatre colonnes, trois lignes.
 *
 * TROIS NATURES D'ILOT, ET C'EST LA TOUTE LA CARTE.
 *
 * - `plein`: un pate de maisons compact, qu'on contourne et rien d'autre.
 * - `cour`: le pate de maisons d'un vrai quartier, c'est-a-dire une ceinture de
 *   batiments autour d'une cour. Il coute bien moins de mur qu'un ilot plein pour
 *   le meme encombrement, et il rend sa cour au jeu: c'est ce qui permet a cette
 *   carte d'avoir une vraie structure sans devenir un dedale.
 * - `place`: la cellule reste vide. Une place, un parc, un terrain vague.
 *
 * LES OUVERTURES D'UNE COUR DECIDENT DE CE QU'ELLE VAUT. Une seule ouverture
 * donne une cachette, et un cul-de-sac. Deux ouvertures opposees donnent un
 * raccourci, et rabaissent le detour. Le melange est voulu.
 *
 * `fusion` soude la cellule a sa voisine, rue comprise. C'EST CE QUI DONNE SON
 * DETOUR A LA CARTE: dans une grille reguliere, tous les chemins en escalier ont
 * exactement la meme longueur, et le detour n'y depasse jamais celui de Manhattan.
 * Une rue coupee oblige a un vrai contournement. Une fusion ne traverse jamais une
 * artere: les deux arteres sont les seules voies qui vont d'un bout a l'autre de
 * la carte, et c'est par elles qu'on se repere.
 */
const PLAN = [
  { cellule: [0, 0], nature: 'cour', ouvertures: [{ cote: 'est', part: 0.65 }, { cote: 'sud', part: 0.5 }] },
  { cellule: [0, 1], nature: 'cour', ouvertures: [{ cote: 'sud', part: 0.35 }, { cote: 'est', part: 0.5 }] },
  { cellule: [0, 2], nature: 'cour', fusion: 'est', ouvertures: [{ cote: 'sud', part: 0.3 }, { cote: 'ouest', part: 0.5 }] },
  { cellule: [1, 0], nature: 'cour', fusion: 'sud', ouvertures: [{ cote: 'est', part: 0.4 }, { cote: 'nord', part: 0.5 }] },
  { cellule: [1, 1], nature: 'plein' },
  { cellule: [1, 2], nature: 'cour', fusion: 'est', ouvertures: [{ cote: 'ouest', part: 0.5 }, { cote: 'nord', part: 0.5 }] },
  { cellule: [2, 1], nature: 'cour', ouvertures: [{ cote: 'nord', part: 0.55 }, { cote: 'est', part: 0.5 }] },
  { cellule: [2, 2], nature: 'cour', fusion: 'est', ouvertures: [{ cote: 'nord', part: 0.4 }, { cote: 'ouest', part: 0.5 }] },
];

/** Epaisseur de la ceinture de batiments d'une cour, en pixels. */
const EPAISSEUR_ILOT = 65;

/** Largeur d'une ouverture de cour, en pixels. Un ninja fait trente-deux pixels de diametre. */
const LARGEUR_OUVERTURE = 120;

/**
 * Les couleurs du decor de travail.
 *
 * Ce decor n'a aucune pretention: il dit ou sont les murs, parce qu'un mur
 * invisible se vit comme un bug (critere 10 de l'etude). Les arteres et les
 * places sont d'un sol legerement plus clair, ce qui suffit a se reperer sans
 * rien ecrire dessus.
 */
const COULEURS = {
  solRue: [7, 11, 18],
  solArtere: [15, 23, 38],
  solPlace: [13, 20, 33],
  mur: [22, 30, 48],
  lisereMur: [0, 200, 224],
};

/** Epaisseur du lisere qui borde chaque batiment dans le decor, en pixels. */
const EPAISSEUR_LISERE = 3;

/** Cote de la vignette montree dans les reglages de partie. */
const COTE_VIGNETTE = 120;

/** Les bornes de chaque bande, une fois les tailles additionnees. */
function bornes(bandes, total) {
  const somme = bandes.reduce((cumul, bande) => cumul + bande.taille, 0);

  if (somme !== total) {
    throw new Error(`Les bandes totalisent ${String(somme)} au lieu de ${String(total)}.`);
  }

  const calculees = [];
  let debut = 0;

  for (const bande of bandes) {
    calculees.push({ ...bande, debut, fin: debut + bande.taille });
    debut += bande.taille;
  }

  return calculees;
}

const COLONNES = bornes(BANDES_X, LARGEUR);
const LIGNES = bornes(BANDES_Y, HAUTEUR);

/** Les bandes d'ilot, dans l'ordre: ce sont elles que le plan numerote. */
const ILOTS_X = COLONNES.filter((bande) => bande.nature === 'ilot');
const ILOTS_Y = LIGNES.filter((bande) => bande.nature === 'ilot');

/** Le rectangle d'une cellule, fusion comprise quand elle en porte une. */
function emprise({ cellule, fusion }) {
  const [ligne, colonne] = cellule;
  const ligneFin = fusion === 'sud' ? ligne + 1 : ligne;
  const colonneFin = fusion === 'est' ? colonne + 1 : colonne;

  return {
    x: ILOTS_X[colonne].debut,
    y: ILOTS_Y[ligne].debut,
    largeur: ILOTS_X[colonneFin].fin - ILOTS_X[colonne].debut,
    hauteur: ILOTS_Y[ligneFin].fin - ILOTS_Y[ligne].debut,
  };
}

/**
 * La carte, pixel par pixel: 1 quand c'est un mur, 0 quand c'est du sol.
 *
 * Trois passes par ilot, dans cet ordre: on remplit l'emprise, on creuse la cour,
 * on perce les ouvertures. Une place ne fait aucune des trois.
 */
/**
 * Le croisement des deux arteres: le centre de la carte, et son seul repere.
 *
 * IL NE RETIRE AUCUN MUR. Une vraie place, taillee dans les angles des quatre
 * ilots voisins, a ete essayee puis abandonnee: elle faisait tomber le detour de
 * 1,24 a 1,21, et surtout elle entamait la ceinture d'un ilot, ce qui laissait un
 * point ou un ninja tenait sans pouvoir en sortir. Le croisement se contente donc
 * d'une teinte de sol: le repere est la, la structure est intacte.
 */
function croisementDesArteres() {
  const artereX = COLONNES.find((bande) => bande.nature === 'artere');
  const artereY = LIGNES.find((bande) => bande.nature === 'artere');

  return {
    x: artereX.debut,
    y: artereY.debut,
    largeur: artereX.taille,
    hauteur: artereY.taille,
  };
}

function dessiner() {
  const murs = new Uint8Array(LARGEUR * HAUTEUR);

  const remplir = (x, y, largeur, hauteur, valeur) => {
    const xFin = Math.min(LARGEUR, x + largeur);
    const yFin = Math.min(HAUTEUR, y + hauteur);

    for (let ligne = Math.max(0, y); ligne < yFin; ligne += 1) {
      murs.fill(valeur, ligne * LARGEUR + Math.max(0, x), ligne * LARGEUR + xFin);
    }
  };

  for (const ilot of PLAN) {
    if (ilot.nature === 'place') {
      continue;
    }

    const forme = emprise(ilot);
    remplir(forme.x, forme.y, forme.largeur, forme.hauteur, 1);

    if (ilot.nature !== 'cour') {
      continue;
    }

    remplir(
      forme.x + EPAISSEUR_ILOT,
      forme.y + EPAISSEUR_ILOT,
      forme.largeur - 2 * EPAISSEUR_ILOT,
      forme.hauteur - 2 * EPAISSEUR_ILOT,
      0,
    );

    for (const ouverture of ilot.ouvertures ?? []) {
      const horizontale = ouverture.cote === 'nord' || ouverture.cote === 'sud';
      // UNE OUVERTURE QUI DONNE SUR LE BORD DE LA CARTE NE S'OUVRE SUR RIEN: le
      // dehors est un mur pour le moteur, et la cour devient un morceau isole,
      // ou un joueur qui y apparaitrait passerait la partie entiere. C'est
      // arrive au premier essai, et cela ne se voyait pas sur l'image.
      const surLeBord =
        (ouverture.cote === 'nord' && forme.y === 0) ||
        (ouverture.cote === 'sud' && forme.y + forme.hauteur === HAUTEUR) ||
        (ouverture.cote === 'ouest' && forme.x === 0) ||
        (ouverture.cote === 'est' && forme.x + forme.largeur === LARGEUR);

      if (surLeBord) {
        throw new Error(
          `L'ouverture ${ouverture.cote} de la cellule ` +
            `[${String(ilot.cellule[0])}, ${String(ilot.cellule[1])}] donne sur le bord de la carte.`,
        );
      }

      const libre = horizontale
        ? forme.largeur - 2 * EPAISSEUR_ILOT - LARGEUR_OUVERTURE
        : forme.hauteur - 2 * EPAISSEUR_ILOT - LARGEUR_OUVERTURE;
      const glissement = EPAISSEUR_ILOT + Math.round(libre * ouverture.part);

      if (horizontale) {
        const y = ouverture.cote === 'nord' ? forme.y : forme.y + forme.hauteur - EPAISSEUR_ILOT;
        remplir(forme.x + glissement, y, LARGEUR_OUVERTURE, EPAISSEUR_ILOT, 0);
      } else {
        const x = ouverture.cote === 'ouest' ? forme.x : forme.x + forme.largeur - EPAISSEUR_ILOT;
        remplir(x, forme.y + glissement, EPAISSEUR_ILOT, LARGEUR_OUVERTURE, 0);
      }
    }
  }

  return murs;
}

/** La nature du sol sous chaque pixel, pour que le decor la montre. */
function zones() {
  const natures = new Uint8Array(LARGEUR * HAUTEUR);

  const remplir = (x, y, largeur, hauteur, valeur) => {
    for (let ligne = y; ligne < y + hauteur; ligne += 1) {
      natures.fill(valeur, ligne * LARGEUR + x, ligne * LARGEUR + x + largeur);
    }
  };

  for (const colonne of COLONNES) {
    if (colonne.nature === 'artere') {
      remplir(colonne.debut, 0, colonne.taille, HAUTEUR, 1);
    }
  }

  for (const ligne of LIGNES) {
    if (ligne.nature === 'artere') {
      remplir(0, ligne.debut, LARGEUR, ligne.taille, 1);
    }
  }

  for (const ilot of PLAN) {
    if (ilot.nature === 'place') {
      const forme = emprise(ilot);
      remplir(forme.x, forme.y, forme.largeur, forme.hauteur, 2);
    }
  }

  const croisement = croisementDesArteres();
  remplir(croisement.x, croisement.y, croisement.largeur, croisement.hauteur, 2);

  return natures;
}

/** Vrai quand le pixel est un mur qui touche le sol a moins de EPAISSEUR_LISERE. */
function estLisere(murs, x, y) {
  for (let dy = -EPAISSEUR_LISERE; dy <= EPAISSEUR_LISERE; dy += 1) {
    for (let dx = -EPAISSEUR_LISERE; dx <= EPAISSEUR_LISERE; dx += 1) {
      const voisinX = x + dx;
      const voisinY = y + dy;

      if (voisinX < 0 || voisinX >= LARGEUR || voisinY < 0 || voisinY >= HAUTEUR) {
        continue;
      }

      if (murs[voisinY * LARGEUR + voisinX] === 0) {
        return true;
      }
    }
  }

  return false;
}

/** L'image de collision: du noir pur pour les murs, du blanc pur pour le sol. */
function imageDeCollision(murs) {
  const pixels = Buffer.alloc(LARGEUR * HAUTEUR * 4);

  for (let index = 0; index < murs.length; index += 1) {
    const ton = murs[index] === 1 ? 0 : 255;
    pixels[index * 4] = ton;
    pixels[index * 4 + 1] = ton;
    pixels[index * 4 + 2] = ton;
    pixels[index * 4 + 3] = 255;
  }

  return pixels;
}

/** Le decor: un sol sombre, des batiments un peu plus clairs, un lisere qui les borde. */
function imageDeDecor(murs, natures) {
  const pixels = Buffer.alloc(LARGEUR * HAUTEUR * 4);
  const solParNature = [COULEURS.solRue, COULEURS.solArtere, COULEURS.solPlace];

  for (let y = 0; y < HAUTEUR; y += 1) {
    for (let x = 0; x < LARGEUR; x += 1) {
      const index = y * LARGEUR + x;
      let couleur;

      if (murs[index] === 1) {
        couleur = estLisere(murs, x, y) ? COULEURS.lisereMur : COULEURS.mur;
      } else {
        couleur = solParNature[natures[index]];
      }

      pixels[index * 4] = couleur[0];
      pixels[index * 4 + 1] = couleur[1];
      pixels[index * 4 + 2] = couleur[2];
      pixels[index * 4 + 3] = 255;
    }
  }

  return pixels;
}

/**
 * L'avant-plan: une image entierement transparente.
 *
 * Une carte de travail ne cache rien. L'avant-plan existe parce que le client en
 * demande un pour chaque carte, et il ne doit rien masquer tant que la structure
 * n'est pas jugee.
 */
function imageDAvantPlan() {
  return Buffer.alloc(LARGEUR * HAUTEUR * 4);
}

/** La vignette: le decor ramene a 120 sur 120, par moyenne des pixels couverts. */
function imageDeVignette(decor) {
  const pixels = Buffer.alloc(COTE_VIGNETTE * COTE_VIGNETTE * 4);
  const pasX = LARGEUR / COTE_VIGNETTE;
  const pasY = HAUTEUR / COTE_VIGNETTE;

  for (let ligne = 0; ligne < COTE_VIGNETTE; ligne += 1) {
    for (let colonne = 0; colonne < COTE_VIGNETTE; colonne += 1) {
      const xDebut = Math.floor(colonne * pasX);
      const xFin = Math.floor((colonne + 1) * pasX);
      const yDebut = Math.floor(ligne * pasY);
      const yFin = Math.floor((ligne + 1) * pasY);
      const somme = [0, 0, 0];
      let comptes = 0;

      for (let y = yDebut; y < yFin; y += 1) {
        for (let x = xDebut; x < xFin; x += 1) {
          const index = (y * LARGEUR + x) * 4;
          somme[0] += decor[index];
          somme[1] += decor[index + 1];
          somme[2] += decor[index + 2];
          comptes += 1;
        }
      }

      const index = (ligne * COTE_VIGNETTE + colonne) * 4;
      pixels[index] = Math.round(somme[0] / comptes);
      pixels[index + 1] = Math.round(somme[1] / comptes);
      pixels[index + 2] = Math.round(somme[2] / comptes);
      pixels[index + 3] = 255;
    }
  }

  return pixels;
}

/** La meme image, retournee de gauche a droite. C'est ce que le dossier mirror attend. */
function retourner(pixels, largeur, hauteur) {
  const retournes = Buffer.alloc(pixels.length);

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const source = (y * largeur + x) * 4;
      const cible = (y * largeur + (largeur - 1 - x)) * 4;
      pixels.copy(retournes, cible, source, source + 4);
    }
  }

  return retournes;
}

/**
 * Encodage PNG, en vingt lignes.
 *
 * POURQUOI PAS pngjs, QUE LE SERVEUR UTILISE DEJA. Ce dossier n'est pas un
 * paquet: node n'y resout aucune dependance du depot, et aller chercher la
 * bibliotheque dans packages/server/node_modules dependrait de la facon dont
 * pnpm range ses fichiers ce jour-la. Ecrire un PNG tient en quelques lignes,
 * et node sait deja compresser.
 */
const TABLE_CRC = (() => {
  const table = new Uint32Array(256);

  for (let octet = 0; octet < 256; octet += 1) {
    let valeur = octet;

    for (let bit = 0; bit < 8; bit += 1) {
      valeur = valeur & 1 ? 0xedb88320 ^ (valeur >>> 1) : valeur >>> 1;
    }

    table[octet] = valeur >>> 0;
  }

  return table;
})();

function crc32(donnees) {
  let valeur = 0xffffffff;

  for (const octet of donnees) {
    valeur = TABLE_CRC[(valeur ^ octet) & 0xff] ^ (valeur >>> 8);
  }

  return (valeur ^ 0xffffffff) >>> 0;
}

function bloc(nom, contenu) {
  const entete = Buffer.alloc(8);
  entete.writeUInt32BE(contenu.length, 0);
  entete.write(nom, 4, 'ascii');

  const somme = Buffer.alloc(4);
  somme.writeUInt32BE(crc32(Buffer.concat([Buffer.from(nom, 'ascii'), contenu])), 0);

  return Buffer.concat([entete, contenu, somme]);
}

function encoderPng(largeur, hauteur, pixels) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  // Huit bits par composante, type 6: rouge, vert, bleu et opacite.
  entete[8] = 8;
  entete[9] = 6;

  // Chaque ligne est precedee de son numero de filtre. Zero: aucun filtre.
  const brut = Buffer.alloc(hauteur * (1 + largeur * 4));

  for (let y = 0; y < hauteur; y += 1) {
    const source = y * largeur * 4;
    pixels.copy(brut, y * (1 + largeur * 4) + 1, source, source + largeur * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

/** Ecrit une image et rend ce qu'elle pese. */
function ecrire(chemin, largeur, hauteur, pixels) {
  const png = encoderPng(largeur, hauteur, pixels);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, png);

  return png.length;
}

const murs = dessiner();
const natures = zones();
const collision = imageDeCollision(murs);
const decor = imageDeDecor(murs, natures);
const avantPlan = imageDAvantPlan();
const vignette = imageDeVignette(decor);

let poids = 0;

for (const orientation of ['normal', 'mirror']) {
  const miroir = orientation === 'mirror';
  const transformer = (pixels) => (miroir ? retourner(pixels, LARGEUR, HAUTEUR) : pixels);

  poids += ecrire(
    join(DOSSIER, orientation, 'collision.png'),
    LARGEUR,
    HAUTEUR,
    transformer(collision),
  );
  poids += ecrire(
    join(DOSSIER, orientation, 'background.png'),
    LARGEUR,
    HAUTEUR,
    transformer(decor),
  );
  poids += ecrire(
    join(DOSSIER, orientation, 'foreground.png'),
    LARGEUR,
    HAUTEUR,
    transformer(avantPlan),
  );
}

poids += ecrire(join(DOSSIER, 'preview.png'), COTE_VIGNETTE, COTE_VIGNETTE, vignette);

let murPixels = 0;

for (const pixel of murs) {
  murPixels += pixel;
}

const cours = PLAN.filter((ilot) => ilot.nature === 'cour').length;
const places = PLAN.filter((ilot) => ilot.nature === 'place').length;

console.log(
  `Quartier: ${String(LARGEUR)} sur ${String(HAUTEUR)}, ` +
    `${String(PLAN.length - places)} ilots dont ${String(cours)} a cour, ` +
    `${String(places)} places, ` +
    `${String(Math.round((murPixels / (LARGEUR * HAUTEUR)) * 1000) / 10)} pour cent de mur, ` +
    `${String(Math.round(poids / 1024))} Ko d'images.`,
);
