/**
 * Mesure la structure des cartes du jeu, telle que le moteur la voit.
 *
 * CE N'EST PAS DU CODE DE JEU. Rien dans packages/ ne connait ce fichier, et le
 * jeu tourne sans lui. C'est l'outil de mesure de l'etude 8.1
 * (docs/mesures/etude-structures-de-carte.md): il existe pour que les chiffres
 * de l'etude soient reverifiables plutot qu'affirmes.
 *
 * IL DECODE LES CARTES PAR LE CHEMIN REEL DU SERVEUR, terrainDepuisImage, qui
 * ecrase l'image 3000x2000 aux dimensions de la carte puis seuille a 128. Donner
 * ici une version approchee du decodage produirait des chiffres qui ne seraient
 * pas ceux du jeu. Le miroir aussi se decode comme le serveur le fait depuis
 * l'etape 8.3: l'unique image de la carte, retournee avant d'etre etiree.
 *
 * Lancement, depuis la racine du depot, apres pnpm build:
 *
 *   node docs/mesures/mesurer-les-cartes.mjs
 *
 * Il ecrit docs/mesures/cartes.json et resume a l'ecran.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Le module de decodage, et non l'index du serveur: on ne veut ni Express ni
// Socket.IO pour lire une image.
import { terrainDepuisImage } from '../../packages/server/dist/terrain.js';
import {
  APPARITION,
  CARTES,
  RAYON_ENTITE,
  VITESSES,
  cheminCarte,
} from '../../packages/shared/dist/index.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RESSOURCES = join(RACINE, 'assets');

/**
 * Finesse de la grille sur laquelle se calculent les distances de trajet.
 *
 * Un pixel par pixel couterait des minutes pour une precision que personne ne
 * lit: a un ninja de 32 pixels de diametre, quatre pixels sont un huitieme de
 * son corps. Les parts de surface et les largeurs de passage, elles, se
 * calculent au pixel.
 */
const PAS_DE_GRILLE = 4;

/**
 * Nombre de points de depart tires pour estimer les distances typiques.
 *
 * Porte de vingt-quatre a quatre-vingts a l'etape 8.2. VINGT-QUATRE NE SUFFISAIENT
 * PAS: deplacer une place de trente pixels faisait bouger le detour median de cinq
 * centiemes dans un sens ou dans l'autre, parce que les vingt-quatre points tires
 * n'etaient plus les memes. Sur les deux cartes ouvertes de l'etape 8.1, ou tous
 * les trajets se ressemblent, cela ne se voyait pas. Sur une carte structuree, ou
 * un point tire dans une cour ne vaut pas un point tire sur une artere, le bruit
 * devenait plus grand que ce qu'on cherchait a mesurer. Quatre-vingts points font
 * six mille trajets, et deux fois plus de calcul: c'est le prix d'un chiffre qu'on
 * peut comparer a lui-meme.
 */
const DEPARTS_TIRES = 80;

/** Graine du tirage des points de depart: deux executions donnent les memes chiffres. */
const GRAINE = 20260920;

/** Les six terrains reellement jouables: trois cartes, chacune en normal et en miroir. */
const TERRAINS = [
  { carte: 'map1', nom: 'Tokyo', miroir: false },
  { carte: 'map1', nom: 'Tokyo', miroir: true },
  { carte: 'map3', nom: 'Spirit & Time', miroir: false },
  { carte: 'map3', nom: 'Spirit & Time', miroir: true },
  { carte: 'quartier', nom: 'Quartier', miroir: false },
  { carte: 'quartier', nom: 'Quartier', miroir: true },
];

/** Un pixel de la carte est-il un mur ? Meme lecture de bits que packages/sim. */
function estMur(carte, x, y) {
  const index = y * carte.largeur + x;
  return (carte.murs[index >> 3] & (1 << (index & 7))) !== 0;
}

/**
 * Distance de chaque pixel libre au mur le plus proche, en pixels.
 *
 * Transformee de distance euclidienne exacte, par la methode de Felzenszwalb et
 * Huttenlocher: une passe par colonnes, une passe par lignes. Le dehors de la
 * carte compte comme un mur, comme dans le moteur (estMur rend vrai hors
 * bornes): c'est le role du min avec la distance au bord, a la fin.
 */
function degagement(carte) {
  const { largeur, hauteur } = carte;
  const carres = new Float64Array(largeur * hauteur);
  // UN TRES GRAND NOMBRE FINI, ET NON L'INFINI. La methode compare des paraboles
  // en soustrayant leurs hauteurs: deux infinis donnent NaN, toutes les
  // comparaisons deviennent fausses, et la boucle qui empile les paraboles ne
  // sort jamais. Le plus grand carre de distance possible ici est de l'ordre de
  // dix millions; mille milliards ne se confond avec aucun.
  const INFINI = 1e12;

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      carres[y * largeur + x] = estMur(carte, x, y) ? 0 : INFINI;
    }
  }

  const taille = Math.max(largeur, hauteur);
  const ligne = new Float64Array(taille);
  const sortie = new Float64Array(taille);
  const sommets = new Int32Array(taille);
  const bornes = new Float64Array(taille + 1);

  // Transformee a une dimension, appliquee d'abord a chaque colonne puis a
  // chaque ligne. C'est ce qui rend la mesure exacte et non approchee.
  const transformer = (longueur) => {
    let dernier = 0;
    sommets[0] = 0;
    bornes[0] = Number.NEGATIVE_INFINITY;
    bornes[1] = Number.POSITIVE_INFINITY;

    for (let position = 1; position < longueur; position += 1) {
      let intersection;
      for (;;) {
        const sommet = sommets[dernier];
        intersection =
          (ligne[position] + position * position - (ligne[sommet] + sommet * sommet)) /
          (2 * position - 2 * sommet);
        if (intersection > bornes[dernier]) {
          break;
        }
        dernier -= 1;
      }
      dernier += 1;
      sommets[dernier] = position;
      bornes[dernier] = intersection;
      bornes[dernier + 1] = Number.POSITIVE_INFINITY;
    }

    let courant = 0;
    for (let position = 0; position < longueur; position += 1) {
      while (bornes[courant + 1] < position) {
        courant += 1;
      }
      const sommet = sommets[courant];
      const ecart = position - sommet;
      sortie[position] = ecart * ecart + ligne[sommet];
    }
  };

  for (let x = 0; x < largeur; x += 1) {
    for (let y = 0; y < hauteur; y += 1) {
      ligne[y] = carres[y * largeur + x];
    }
    transformer(hauteur);
    for (let y = 0; y < hauteur; y += 1) {
      carres[y * largeur + x] = sortie[y];
    }
  }

  const distances = new Float32Array(largeur * hauteur);

  for (let y = 0; y < hauteur; y += 1) {
    const depart = y * largeur;
    for (let x = 0; x < largeur; x += 1) {
      ligne[x] = carres[depart + x];
    }
    transformer(largeur);
    for (let x = 0; x < largeur; x += 1) {
      const auBord = Math.min(x + 1, largeur - x, y + 1, hauteur - y);
      distances[depart + x] = Math.min(Math.sqrt(sortie[x]), auBord);
    }
  }

  return distances;
}

/**
 * Les morceaux d'un seul tenant ou un ninja peut circuler.
 *
 * Un pixel est tenable quand un disque de son rayon y tient entierement. C'est
 * un poil plus severe que le moteur, qui echantillonne dix-sept points au lieu
 * de tester tout le disque: une carte jugee bonne ici l'est donc aussi en jeu.
 * Deux pixels tenables voisins communiquent, parce que le moteur balaie les
 * trajets pixel par pixel (trajetTenable).
 */
function morceaux(carte, distances, rayon) {
  const { largeur, hauteur } = carte;
  const total = largeur * hauteur;
  const appartenance = new Int32Array(total).fill(-1);
  const aires = [];
  const pile = new Int32Array(total);

  for (let depart = 0; depart < total; depart += 1) {
    if (distances[depart] < rayon || appartenance[depart] !== -1) {
      continue;
    }

    const numero = aires.length;
    let sommet = 0;
    let aire = 0;
    pile[sommet] = depart;
    sommet += 1;
    appartenance[depart] = numero;

    while (sommet > 0) {
      sommet -= 1;
      const index = pile[sommet];
      aire += 1;
      const x = index % largeur;
      const y = (index - x) / largeur;

      const ajouter = (voisin) => {
        if (appartenance[voisin] === -1 && distances[voisin] >= rayon) {
          appartenance[voisin] = numero;
          pile[sommet] = voisin;
          sommet += 1;
        }
      };

      if (x > 0) {
        ajouter(index - 1);
      }
      if (x < largeur - 1) {
        ajouter(index + 1);
      }
      if (y > 0) {
        ajouter(index - largeur);
      }
      if (y < hauteur - 1) {
        ajouter(index + largeur);
      }
    }

    aires.push(aire);
  }

  let principal = 0;
  for (let numero = 1; numero < aires.length; numero += 1) {
    if (aires[numero] > aires[principal]) {
      principal = numero;
    }
  }

  return { appartenance, aires, principal };
}

/** Generateur a graine, pour que deux executions tirent les memes points. */
function tirage(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    return etat / 4294967296;
  };
}

/**
 * Tas binaire minimal, de quoi faire tourner un Dijkstra sans dependance.
 *
 * EN TABLEAUX TYPES, ET SANS ECHANGE PAR DESTRUCTURATION. Une premiere version
 * en tableaux ordinaires, qui echangeait ses cases par [a, b] = [b, a], allouait
 * un tableau a chaque comparaison et n'a pas fini sa premiere carte en dix
 * minutes. Celle-ci fait les quatre cartes en une poignee de secondes: c'est la
 * difference entre remonter une valeur de proche en proche et recreer deux
 * tableaux par etage de l'arbre.
 */
function creerTas(capacite) {
  const cles = new Float64Array(capacite);
  const valeurs = new Int32Array(capacite);
  let taille = 0;
  let derniereCle = 0;
  let derniereValeur = 0;

  return {
    get taille() {
      return taille;
    },
    get cle() {
      return derniereCle;
    },
    get valeur() {
      return derniereValeur;
    },
    vider() {
      taille = 0;
    },
    pousser(cle, valeur) {
      let enfant = taille;
      taille += 1;

      while (enfant > 0) {
        const parent = (enfant - 1) >> 1;
        if (cles[parent] <= cle) {
          break;
        }
        cles[enfant] = cles[parent];
        valeurs[enfant] = valeurs[parent];
        enfant = parent;
      }

      cles[enfant] = cle;
      valeurs[enfant] = valeur;
    },
    retirer() {
      derniereCle = cles[0];
      derniereValeur = valeurs[0];
      taille -= 1;

      if (taille > 0) {
        const cle = cles[taille];
        const valeur = valeurs[taille];
        let parent = 0;

        for (;;) {
          const gauche = parent * 2 + 1;
          if (gauche >= taille) {
            break;
          }
          const droite = gauche + 1;
          const enfant = droite < taille && cles[droite] < cles[gauche] ? droite : gauche;
          if (cles[enfant] >= cle) {
            break;
          }
          cles[parent] = cles[enfant];
          valeurs[parent] = valeurs[enfant];
          parent = enfant;
        }

        cles[parent] = cle;
        valeurs[parent] = valeur;
      }
    },
  };
}

/**
 * La grille de trajet: le morceau principal, ramene a une case tous les quatre
 * pixels, sur laquelle se calculent les distances par les chemins.
 */
function grilleDeTrajet(carte, appartenance, principal) {
  const largeur = Math.floor(carte.largeur / PAS_DE_GRILLE);
  const hauteur = Math.floor(carte.hauteur / PAS_DE_GRILLE);
  const ouvertes = new Uint8Array(largeur * hauteur);
  const cases = [];

  for (let ligne = 0; ligne < hauteur; ligne += 1) {
    for (let colonne = 0; colonne < largeur; colonne += 1) {
      const x = colonne * PAS_DE_GRILLE + (PAS_DE_GRILLE >> 1);
      const y = ligne * PAS_DE_GRILLE + (PAS_DE_GRILLE >> 1);
      if (appartenance[y * carte.largeur + x] === principal) {
        ouvertes[ligne * largeur + colonne] = 1;
        cases.push(ligne * largeur + colonne);
      }
    }
  }

  return { largeur, hauteur, ouvertes, cases };
}

/**
 * Distances par les chemins depuis une case, en pixels de carte.
 *
 * Le tas et le tableau des distances sont fournis par l'appelant et reutilises
 * d'un depart au suivant: une carte en demande une trentaine, et les reallouer
 * a chaque fois couterait plus cher que le calcul lui-meme.
 */
function distancesDepuis(grille, depart, distances, tas) {
  distances.fill(Number.POSITIVE_INFINITY);
  tas.vider();

  distances[depart] = 0;
  tas.pousser(0, depart);

  const diagonale = Math.SQRT2 * PAS_DE_GRILLE;
  const droite = PAS_DE_GRILLE;

  while (tas.taille > 0) {
    tas.retirer();
    const cle = tas.cle;
    const valeur = tas.valeur;
    if (cle > distances[valeur]) {
      continue;
    }

    const colonne = valeur % grille.largeur;
    const ligne = (valeur - colonne) / grille.largeur;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const voisineColonne = colonne + dx;
        const voisineLigne = ligne + dy;
        if (
          voisineColonne < 0 ||
          voisineColonne >= grille.largeur ||
          voisineLigne < 0 ||
          voisineLigne >= grille.hauteur
        ) {
          continue;
        }
        const voisine = voisineLigne * grille.largeur + voisineColonne;
        if (grille.ouvertes[voisine] === 0) {
          continue;
        }
        // Une diagonale ne se coupe que si les deux cotes sont ouverts: sans
        // cela, un ninja passerait en biais par le coin de deux murs.
        if (dx !== 0 && dy !== 0) {
          if (
            grille.ouvertes[ligne * grille.largeur + voisineColonne] === 0 ||
            grille.ouvertes[voisineLigne * grille.largeur + colonne] === 0
          ) {
            continue;
          }
        }
        const candidate = cle + (dx !== 0 && dy !== 0 ? diagonale : droite);
        if (candidate < distances[voisine]) {
          distances[voisine] = candidate;
          tas.pousser(candidate, voisine);
        }
      }
    }
  }

  return distances;
}

/** La case la plus loin d'un point, et sa distance. */
function laPlusLoin(distances) {
  let meilleure = -1;
  let valeur = -1;
  for (let index = 0; index < distances.length; index += 1) {
    const distance = distances[index];
    if (Number.isFinite(distance) && distance > valeur) {
      valeur = distance;
      meilleure = index;
    }
  }
  return { case: meilleure, distance: valeur };
}

/** Le quantile d'une suite triee. */
function quantile(triee, part) {
  if (triee.length === 0) {
    return 0;
  }
  const rang = Math.min(triee.length - 1, Math.max(0, Math.round(part * (triee.length - 1))));
  return triee[rang];
}

/** Arrondit a une decimale, pour que le JSON reste lisible. */
function arrondi(valeur, decimales = 1) {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

/** Mesure un terrain, et rend tout ce que l'etude en dit. */
function mesurer({ carte: identifiant, nom, miroir }) {
  const dimensions = CARTES[identifiant];
  const chemin = join(RESSOURCES, cheminCarte(identifiant, 'collision'));
  const carte = terrainDepuisImage(readFileSync(chemin), dimensions, miroir);
  const { largeur, hauteur } = carte;
  const total = largeur * hauteur;

  const distances = degagement(carte);

  let sol = 0;
  for (let index = 0; index < total; index += 1) {
    if (distances[index] > 0) {
      sol += 1;
    }
  }

  const { appartenance, aires, principal } = morceaux(carte, distances, RAYON_ENTITE);
  const tenable = aires.reduce((somme, aire) => somme + aire, 0);
  const airePrincipale = aires[principal] ?? 0;

  // Les largeurs de passage, lues sur le seul morceau ou l'on joue.
  const degagements = new Float32Array(airePrincipale);
  let ecrits = 0;
  for (let index = 0; index < total; index += 1) {
    if (appartenance[index] === principal) {
      degagements[ecrits] = distances[index];
      ecrits += 1;
    }
  }
  degagements.sort();

  // La bande ou les apparitions se tirent: cent pixels de bord en moins.
  let bandeDApparition = 0;
  for (let y = APPARITION.MARGE_BORD; y < hauteur - APPARITION.MARGE_BORD; y += 1) {
    for (let x = APPARITION.MARGE_BORD; x < largeur - APPARITION.MARGE_BORD; x += 1) {
      if (appartenance[y * largeur + x] === principal) {
        bandeDApparition += 1;
      }
    }
  }

  const grille = grilleDeTrajet(carte, appartenance, principal);
  const cases = grille.largeur * grille.hauteur;
  const versTous = new Float64Array(cases);
  // Huit voisines par case au plus: le tas ne peut pas recevoir davantage.
  const tas = creerTas(cases * 8 + 1);

  // Le diametre par les chemins: deux balayages, la methode habituelle.
  distancesDepuis(grille, grille.cases[0], versTous, tas);
  const extremite = laPlusLoin(versTous);
  distancesDepuis(grille, extremite.case, versTous, tas);
  const oppose = laPlusLoin(versTous);

  // Les distances typiques, entre points tires comme le fait une apparition.
  const suivant = tirage(GRAINE);
  const departs = [];
  for (let compte = 0; compte < DEPARTS_TIRES; compte += 1) {
    departs.push(grille.cases[Math.floor(suivant() * grille.cases.length)]);
  }

  const parcours = [];
  const detours = [];
  for (const depart of departs) {
    distancesDepuis(grille, depart, versTous, tas);
    const colonneDepart = depart % grille.largeur;
    const ligneDepart = (depart - colonneDepart) / grille.largeur;

    for (const arrivee of departs) {
      if (arrivee === depart) {
        continue;
      }
      const parcourue = versTous[arrivee];
      if (!Number.isFinite(parcourue)) {
        continue;
      }
      const colonneArrivee = arrivee % grille.largeur;
      const ligneArrivee = (arrivee - colonneArrivee) / grille.largeur;
      const vol =
        Math.hypot(colonneArrivee - colonneDepart, ligneArrivee - ligneDepart) * PAS_DE_GRILLE;
      parcours.push(parcourue);
      if (vol > 0) {
        detours.push(parcourue / vol);
      }
    }
  }

  parcours.sort((gauche, droite) => gauche - droite);
  detours.sort((gauche, droite) => gauche - droite);

  const vitesse = VITESSES.JOUEUR_PX_PAR_SECONDE;

  return {
    carte: identifiant,
    nom,
    miroir,
    dimensions: { largeur, hauteur },
    surfaceMpx: arrondi(total / 1e6, 2),
    partDeSolPct: arrondi((sol / total) * 100),
    partTenablePct: arrondi((tenable / total) * 100),
    morceaux: aires.length,
    partDuPrincipalPct: arrondi((airePrincipale / Math.max(1, tenable)) * 100, 2),
    airesIsoleesPx: tenable - airePrincipale,
    plusGrosMorceauIsolePx:
      aires.length > 1 ? Math.max(...aires.filter((_, i) => i !== principal)) : 0,
    partDeLaBandeDApparitionPct: arrondi((bandeDApparition / Math.max(1, airePrincipale)) * 100),
    degagementPx: {
      p10: arrondi(quantile(degagements, 0.1)),
      median: arrondi(quantile(degagements, 0.5)),
      p90: arrondi(quantile(degagements, 0.9)),
      maximum: arrondi(quantile(degagements, 1)),
    },
    traverseePx: Math.round(oppose.distance),
    traverseeS: arrondi(oppose.distance / vitesse),
    parcoursTypiquePx: Math.round(quantile(parcours, 0.5)),
    parcoursTypiqueS: arrondi(quantile(parcours, 0.5) / vitesse),
    parcoursCourtS: arrondi(quantile(parcours, 0.1) / vitesse),
    parcoursLongS: arrondi(quantile(parcours, 0.9) / vitesse),
    detourMedian: arrondi(quantile(detours, 0.5), 2),
  };
}

/**
 * Les terrains a mesurer: tous, ou seulement ceux que la ligne de commande nomme.
 *
 * Mesurer coute quelques secondes par terrain, et mettre au point une carte
 * nouvelle en demande des dizaines d'essais (etape 8.2). Nommer la carte qu'on
 * travaille evite de remesurer celles qui n'ont pas bouge. Dans ce cas cartes.json
 * n'est pas reecrit: il perdrait les cartes qu'on vient de sauter.
 */
const FILTRE = process.argv.slice(2);
const A_MESURER =
  FILTRE.length === 0 ? TERRAINS : TERRAINS.filter((terrain) => FILTRE.includes(terrain.carte));

const mesures = A_MESURER.map((terrain) => {
  const debut = Date.now();
  const mesure = mesurer(terrain);
  console.log(
    `${mesure.nom}${mesure.miroir ? ' (miroir)' : ''}: ` +
      `${String(mesure.partDeSolPct)} pour cent de sol, ` +
      `${String(mesure.partTenablePct)} pour cent tenable, ` +
      `${String(mesure.morceaux)} morceaux, ` +
      `passage median ${String(mesure.degagementPx.median)} px, ` +
      `detour median ${String(mesure.detourMedian)}, ` +
      `bande d apparition ${String(mesure.partDeLaBandeDApparitionPct)} pour cent, ` +
      `traversee ${String(mesure.traverseeS)} s ` +
      `[${String(Math.round((Date.now() - debut) / 1000))} s de calcul]`,
  );
  return mesure;
});

const sortie = {
  genereLe: new Date().toISOString().slice(0, 10),
  outil: 'docs/mesures/mesurer-les-cartes.mjs',
  reglages: {
    rayonEntitePx: RAYON_ENTITE,
    margeDeBordPx: APPARITION.MARGE_BORD,
    vitessePxParSeconde: VITESSES.JOUEUR_PX_PAR_SECONDE,
    pasDeGrillePx: PAS_DE_GRILLE,
    departsTires: DEPARTS_TIRES,
    graine: GRAINE,
  },
  cartes: mesures,
};

if (FILTRE.length === 0) {
  writeFileSync(
    join(RACINE, 'docs', 'mesures', 'cartes.json'),
    `${JSON.stringify(sortie, null, 2)}\n`,
  );
  console.log('Ecrit: docs/mesures/cartes.json');
} else {
  console.log('Mesure partielle: cartes.json n a pas ete reecrit.');
}
