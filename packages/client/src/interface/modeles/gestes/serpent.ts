/**
 * Nourrir le serpent (etape 7.24, rendu 2B de la planche docs/design/etape-7-24/1-planche.png):
 * un serpent sur une grille de 12 sur 9 mange cinq fruits, sans se mordre ni toucher le bord.
 * Il grandit d'une case par fruit. Au clavier, les fleches; au pointeur, glisser dans la
 * direction voulue, n'importe ou dans la fenetre.
 *
 * LE RYTHME. Le serpent part apres DEPART_MS et avance d'une case toutes les PAS_MS. Chaque
 * fruit tombe a ELOIGNEMENT_DU_FRUIT cases au moins de la tete (en lignes et colonnes): cinq
 * fruits font au moins 50 pas, 13,1 secondes au plus vite, au-dessus des 12 du serveur.
 *
 * UN ECHEC (un bord, ou le serpent qui se mord) laisse l'ecran perdu une seconde, puis une
 * partie neuve, d'une autre graine.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste, PointDuGeste } from './commun.js';
import { avecEcho, tireur } from './commun.js';
import type { Case } from './caisses.js';

/** La taille du terrain, en cases. */
export const COLONNES_DU_SERPENT = 12;
export const LIGNES_DU_SERPENT = 9;

/** Le terrain dans l'espace du geste: son coin haut gauche et le cote d'une case. */
export const TERRAIN = { x: 50, y: 44, cote: 25 } as const;

/** Les fruits a manger. */
export const FRUITS_A_MANGER = 5;

/** Le serpent avance d'une case toutes les PAS_MS, apres DEPART_MS. */
export const PAS_MS = 250;
export const DEPART_MS = 600;

/** Un fruit tombe a cette distance au moins de la tete, en cases, lignes et colonnes ajoutees. */
export const ELOIGNEMENT_DU_FRUIT = 10;

/** Ce qu'il faut glisser, en unites, pour tourner. */
export const GLISSE_MINIMALE = 22;

/** Ce que dure l'ecran perdu. */
export const PERTE_MS = 1000;

/** Une direction. */
export type Direction = 'gauche' | 'droite' | 'haut' | 'bas';

const PAS: Readonly<Record<Direction, Case>> = {
  gauche: [-1, 0],
  droite: [1, 0],
  haut: [0, -1],
  bas: [0, 1],
};

const CONTRAIRES: Readonly<Record<Direction, Direction>> = {
  gauche: 'droite',
  droite: 'gauche',
  haut: 'bas',
  bas: 'haut',
};

/** Ou en est la partie. */
export interface EtatSerpent extends BaseDeGeste {
  readonly nature: 'serpent';
  /** La graine de la partie en cours: une partie perdue prend la suivante. */
  readonly graine: number;
  /** Le corps, de la tete a la queue. */
  readonly corps: readonly Case[];
  /** La direction du dernier pas. */
  readonly direction: Direction;
  /** Les virages demandes, pas encore pris: deux au plus. */
  readonly virages: readonly Direction[];
  readonly fruit: Case;
  readonly manges: number;
  /** L'instant du prochain pas; absent tant que la partie n'a pas commence. */
  readonly prochainPas?: number;
  /** Ou le doigt a commence a glisser. */
  readonly glisse?: PointDuGeste;
  /** La partie perdue, jusqu'a cet instant. */
  readonly perdueJusqua?: number;
}

/** Les deux cases sont-elles la meme. */
function meme(une: Case, autre: Case): boolean {
  return une[0] === autre[0] && une[1] === autre[1];
}

/** Le fruit suivant: loin de la tete, hors du corps, tire de la graine et du rang du fruit. */
export function fruitSuivant(graine: number, manges: number, corps: readonly Case[]): Case {
  const tete = corps[0] ?? [0, 0];
  const libres: Case[] = [];

  for (let ligne = 0; ligne < LIGNES_DU_SERPENT; ligne += 1) {
    for (let colonne = 0; colonne < COLONNES_DU_SERPENT; colonne += 1) {
      if (!corps.some((case_) => meme(case_, [colonne, ligne]))) {
        libres.push([colonne, ligne]);
      }
    }
  }

  const ecart = ([colonne, ligne]: Case): number =>
    Math.abs(colonne - tete[0]) + Math.abs(ligne - tete[1]);
  const loin = libres.filter((case_) => ecart(case_) >= ELOIGNEMENT_DU_FRUIT);
  // Sans case assez loin, la plus loin: le serpent n'en est jamais la, mais rien ne casse.
  const choix =
    loin.length > 0
      ? loin
      : libres.filter((case_) => ecart(case_) === Math.max(...libres.map(ecart)));

  return tireur(graine * 31 + manges).melanger(choix)[0] ?? [0, 0];
}

/** Une partie neuve de cette graine, pas encore commencee. */
export function creerSerpent(graine: number): EtatSerpent {
  return { ...partieNeuve(graine), echos: [] };
}

function partieNeuve(graine: number): Omit<EtatSerpent, 'echos'> {
  const corps: readonly Case[] = [
    [4, 4],
    [3, 4],
    [2, 4],
  ];

  return {
    nature: 'serpent',
    graine,
    corps,
    direction: 'droite',
    virages: [],
    fruit: fruitSuivant(graine, 0, corps),
    manges: 0,
  };
}

/** Un pas, a cet instant: le serpent avance, mange, ou se perd. */
function unPas(etat: EtatSerpent, instant: number): EtatSerpent {
  const [virage, ...reste] = etat.virages;
  const direction = virage ?? etat.direction;
  const tete = etat.corps[0] ?? [0, 0];
  const [dc, dl] = PAS[direction];
  const suivante: Case = [tete[0] + dc, tete[1] + dl];
  const mange = meme(suivante, etat.fruit);
  // Sans fruit, la queue part en meme temps: on peut entrer dans sa case.
  const restant = mange ? etat.corps : etat.corps.slice(0, -1);
  const dehors =
    suivante[0] < 0 ||
    suivante[0] >= COLONNES_DU_SERPENT ||
    suivante[1] < 0 ||
    suivante[1] >= LIGNES_DU_SERPENT;

  if (dehors || restant.some((case_) => meme(case_, suivante))) {
    return avecEcho({ ...etat, virages: [], perdueJusqua: instant + PERTE_MS }, 'perdue');
  }

  const corps = [suivante, ...restant];
  const avance = { ...etat, corps, direction, virages: reste, prochainPas: instant + PAS_MS };

  if (!mange) {
    return avance;
  }

  const manges = etat.manges + 1;
  return avecEcho(
    {
      ...avance,
      manges,
      fruit: manges < FRUITS_A_MANGER ? fruitSuivant(etat.graine, manges, corps) : etat.fruit,
    },
    'fruit',
  );
}

/** Le temps passe jusqu'a maintenant: les pas, et la partie neuve apres un echec. */
function avancer(etat: EtatSerpent, maintenant: number): EtatSerpent {
  let courant =
    etat.prochainPas === undefined ? { ...etat, prochainPas: maintenant + DEPART_MS } : etat;

  for (let garde = 0; garde < 1000; garde += 1) {
    if (courant.perdueJusqua !== undefined) {
      if (maintenant < courant.perdueJusqua) {
        return courant;
      }
      courant = {
        ...partieNeuve(courant.graine + 1),
        echos: courant.echos,
        prochainPas: courant.perdueJusqua + DEPART_MS,
      };
      continue;
    }

    const pas = courant.prochainPas;
    if (courant.manges >= FRUITS_A_MANGER || pas === undefined || maintenant < pas) {
      return courant;
    }

    courant = unPas(courant, pas);
  }

  return courant;
}

/** Un virage demande: ni demi-tour, ni deux fois le meme, deux d'avance au plus. */
function virer(etat: EtatSerpent, direction: Direction): EtatSerpent {
  const derniere = etat.virages.at(-1) ?? etat.direction;

  if (
    etat.perdueJusqua !== undefined ||
    direction === derniere ||
    direction === CONTRAIRES[derniere] ||
    etat.virages.length >= 2
  ) {
    return etat;
  }

  return { ...etat, virages: [...etat.virages, direction] };
}

/** Le doigt glisse: assez loin, il tourne vers le sens ou il a le plus glisse, et repart de la. */
function glisser(etat: EtatSerpent, point: PointDuGeste): EtatSerpent {
  const depart = etat.glisse;

  if (depart === undefined) {
    return etat;
  }

  const dx = point.x - depart.x;
  const dy = point.y - depart.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < GLISSE_MINIMALE) {
    return etat;
  }

  const direction: Direction =
    Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'droite' : 'gauche') : dy > 0 ? 'bas' : 'haut';

  return { ...virer(etat, direction), glisse: point };
}

/** La partie apres une commande. */
export function appliquerSerpent(
  etat: EtatSerpent,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatSerpent {
  const avance = avancer(etat, maintenant);

  switch (commande.type) {
    case 'temps':
      return avance;

    case 'touche':
      return commande.enfoncee && commande.touche !== 'espace'
        ? virer(avance, commande.touche)
        : avance;

    case 'pointeur':
      if (commande.phase === 'bas') {
        return { ...avance, glisse: { x: commande.x, y: commande.y } };
      }
      if (commande.phase === 'deplace') {
        return glisser(avance, commande);
      }
      {
        const { glisse: _fini, ...sansGlisse } = glisser(avance, commande);
        return sansGlisse;
      }
  }
}

/** Les cinq fruits sont-ils manges. */
export function serpentFini(etat: EtatSerpent): boolean {
  return etat.manges >= FRUITS_A_MANGER;
}

/** Les fruits manges. */
export function avancementDuSerpent(etat: EtatSerpent): AvancementDuGeste {
  return { faits: etat.manges, total: FRUITS_A_MANGER };
}
