/**
 * Empiler des caisses (etape 7.24, rendu 1B de la planche docs/design/etape-7-24/1-planche.png):
 * une grille preparee de 6 colonnes sur 10 lignes, des caisses qui tombent par pieces de quatre,
 * et deux lignes a completer. Une ligne pleine s'efface. Au pointeur, quatre boutons sous la
 * grille: gauche, tourner, droite, descendre; au clavier, gauche et droite, Haut ou Espace pour
 * tourner, Bas tenu pour descendre.
 *
 * LA GRILLE EST TOUJOURS FAISABLE. Elle se construit a l'envers: une pile de caisses dont les
 * deux lignes du bas sont pleines, d'ou l'on retire les quatre pieces une a une, chacune par le
 * haut et posee sur quelque chose. Les poser dans l'ordre inverse, chacune tombee droit dans sa
 * colonne, refait les deux lignes.
 *
 * LE RYTHME. Une piece tombe d'une ligne toutes les CHUTE_MS, une fois et demie plus vite
 * descente tenue, jamais plus. Quatre pieces font de 11 a 14 secondes au plus vite, 12,6 en
 * mediane, et une vingtaine a l'allure de la chute (mesure des tests): la fenetre garde l'ecran
 * gagne jusqu'a la duree minimale du serveur pour le plus rapide.
 *
 * UN ECHEC (les quatre pieces posees sans les deux lignes, ou une piece qui ne peut plus
 * entrer) laisse l'ecran perdu une seconde, puis une partie neuve, d'une autre graine.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste, PointDuGeste } from './commun.js';
import { avecEcho, dansLeRectangle, tireur } from './commun.js';
import type { Tireur } from './commun.js';

/** La taille de la grille, en cases. */
export const COLONNES = 6;
export const LIGNES = 10;

/** Les pieces d'une partie, et les lignes a completer. */
export const PIECES_PAR_PARTIE = 4;
export const LIGNES_A_FAIRE = 2;

/** Une ligne de chute toutes les CHUTE_MS; toutes les DESCENTE_MS, descente tenue. */
export const CHUTE_MS = 600;
export const DESCENTE_MS = 400;

/** Ce que dure l'effacement d'une ligne pleine, et l'ecran perdu. */
export const EFFACEMENT_MS = 500;
export const PERTE_MS = 1000;

/** La grille dans l'espace du geste: son coin haut gauche et le cote d'une case. */
export const GRILLE = { x: 96, y: 26, cote: 22 } as const;

/** Ce que fait un bouton. */
export type BoutonDeCaisses = 'gauche' | 'tourner' | 'droite' | 'descendre';

/** Les quatre boutons sous la grille, dans l'espace du geste. */
export const BOUTONS: readonly {
  readonly bouton: BoutonDeCaisses;
  readonly x: number;
  readonly y: number;
  readonly largeur: number;
  readonly hauteur: number;
}[] = (['gauche', 'tourner', 'droite', 'descendre'] as const).map((bouton, rang) => ({
  bouton,
  x: 25 + rang * 90,
  y: 254,
  largeur: 80,
  hauteur: 40,
}));

/** Une case: sa colonne, puis sa ligne. */
export type Case = readonly [number, number];

/** Les sept formes de quatre caisses, dans leur premiere orientation. */
const FORMES: readonly (readonly Case[])[] = [
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
    [0, 2],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
];

/** Des cases ramenees en haut a gauche, rangees: deux orientations egales se comparent. */
function ramener(cases: readonly Case[]): readonly Case[] {
  const colonne = Math.min(...cases.map(([c]) => c));
  const ligne = Math.min(...cases.map(([, l]) => l));

  return cases
    .map(([c, l]): Case => [c - colonne, l - ligne])
    .sort((une, autre) => une[1] - autre[1] || une[0] - autre[0]);
}

/** Un quart de tour dans le sens des aiguilles d'une montre. */
function quartDeTour(cases: readonly Case[]): readonly Case[] {
  const bas = Math.max(...cases.map(([, l]) => l));

  return ramener(cases.map(([c, l]): Case => [bas - l, c]));
}

/** Les orientations distinctes de chaque forme, dans l'ordre ou l'on tourne. */
export const ORIENTATIONS: readonly (readonly (readonly Case[])[])[] = FORMES.map((forme) => {
  const vues: (readonly Case[])[] = [];
  let courante = ramener(forme);

  while (!vues.some((vue) => JSON.stringify(vue) === JSON.stringify(courante))) {
    vues.push(courante);
    courante = quartDeTour(courante);
  }

  return vues;
});

/** Une piece placee: sa forme, son orientation, et le coin haut gauche de ses cases. */
export interface Piece {
  readonly forme: number;
  readonly orientation: number;
  readonly colonne: number;
  readonly ligne: number;
}

/** Les cases d'une piece placee. */
export function casesDeLaPiece(piece: Piece): readonly Case[] {
  const orientation = ORIENTATIONS[piece.forme]?.[piece.orientation] ?? [];

  return orientation.map(([c, l]): Case => [piece.colonne + c, piece.ligne + l]);
}

/** Ce que contient une case de la grille. */
export const VIDE = 0;
export const PREPAREE = 1;
export const POSEE = 2;

/** Ou en est la partie. */
export interface EtatCaisses extends BaseDeGeste {
  readonly nature: 'caisses';
  /** La graine de la partie en cours: une partie perdue prend la suivante. */
  readonly graine: number;
  /** La grille, ligne par ligne: VIDE, PREPAREE ou POSEE. */
  readonly grille: readonly number[];
  /** Les formes des pieces, dans leur ordre d'arrivee. */
  readonly pieces: readonly number[];
  /** Le rang de la prochaine piece a entrer. */
  readonly suivante: number;
  /** La piece qui tombe. */
  readonly enJeu?: Piece;
  /** L'instant du prochain pas de chute; absent tant que la partie n'a pas commence. */
  readonly prochainPas?: number;
  /** La descente est-elle tenue. */
  readonly descente: boolean;
  /** Les lignes faites. */
  readonly lignes: number;
  /** Les lignes pleines qui s'effacent, jusqu'a cet instant. */
  readonly effacement?: { readonly lignes: readonly number[]; readonly jusqua: number };
  /** La partie perdue, jusqu'a cet instant. */
  readonly perdueJusqua?: number;
}

/** La case (colonne, ligne) est-elle hors de la grille ou pleine. */
function bloquee(grille: readonly number[], [colonne, ligne]: Case): boolean {
  return (
    colonne < 0 ||
    colonne >= COLONNES ||
    ligne >= LIGNES ||
    (ligne >= 0 && (grille[ligne * COLONNES + colonne] ?? VIDE) !== VIDE)
  );
}

/** La piece tient-elle a cette place. */
function tient(grille: readonly number[], piece: Piece): boolean {
  return casesDeLaPiece(piece).every((case_) => !bloquee(grille, case_));
}

// --------------------------------------------------------------------------
// La grille preparee
// --------------------------------------------------------------------------

/** Les caisses que garde au moins une grille preparee. */
export const CAISSES_PREPAREES_MINIMUM = 6;

/** Une grille preparee, et les formes des pieces qui la completent, dans leur ordre. */
export interface Preparation {
  readonly grille: readonly number[];
  readonly pieces: readonly number[];
  /** Les places ou poser les pieces, dans leur ordre: la solution, pour les tests. */
  readonly solution: readonly Piece[];
}

/** La pile de depart: les deux lignes du bas pleines, et des caisses au-dessus. */
function pileDeDepart(t: Tireur): Set<number> {
  const pleines = new Set<number>();

  for (let ligne = LIGNES - LIGNES_A_FAIRE; ligne < LIGNES; ligne += 1) {
    for (let colonne = 0; colonne < COLONNES; colonne += 1) {
      pleines.add(ligne * COLONNES + colonne);
    }
  }

  // Chaque ligne au-dessus ne garde des caisses que sur celles d'en dessous, et jamais pleine.
  const chances = [0.9, 0.7, 0.4];
  for (const [rang, chance] of chances.entries()) {
    const ligne = LIGNES - LIGNES_A_FAIRE - 1 - rang;
    const posees: number[] = [];

    for (let colonne = 0; colonne < COLONNES; colonne += 1) {
      if (pleines.has((ligne + 1) * COLONNES + colonne) && t.reel(0, 1) < chance) {
        posees.push(colonne);
      }
    }

    if (posees.length === COLONNES) {
      posees.splice(Math.floor(t.reel(0, COLONNES)), 1);
    }
    for (const colonne of posees) {
      pleines.add(ligne * COLONNES + colonne);
    }
  }

  return pleines;
}

/**
 * Les pieces qu'on peut retirer de cette pile: entierement dans la pile, sans caisse au-dessus
 * d'elles, et posees sur quelque chose une fois retirees.
 */
function retirables(pleines: ReadonlySet<number>): Piece[] {
  const trouvees: Piece[] = [];

  ORIENTATIONS.forEach((orientations, forme) => {
    orientations.forEach((_cases, orientation) => {
      for (let ligne = 0; ligne < LIGNES; ligne += 1) {
        for (let colonne = 0; colonne < COLONNES; colonne += 1) {
          const piece = { forme, orientation, colonne, ligne };
          const cases = casesDeLaPiece(piece);
          const siennes = new Set(cases.map(([c, l]) => l * COLONNES + c));
          const dedans = cases.every(
            ([c, l]) => c < COLONNES && l < LIGNES && pleines.has(l * COLONNES + c),
          );
          const degagee = cases.every(([c, l]) => {
            for (let dessus = 0; dessus < l; dessus += 1) {
              const indice = dessus * COLONNES + c;
              if (pleines.has(indice) && !siennes.has(indice)) {
                return false;
              }
            }
            return true;
          });
          const posee = cases.some(([c, l]) => {
            const dessous = (l + 1) * COLONNES + c;
            return l + 1 === LIGNES || (pleines.has(dessous) && !siennes.has(dessous));
          });

          if (dedans && degagee && posee) {
            trouvees.push(piece);
          }
        }
      }
    });
  });

  return trouvees;
}

/** Retire des pieces de la pile, en profondeur; rend celles retirees, de la derniere posee. */
function retirer(t: Tireur, pleines: ReadonlySet<number>, reste: number): Piece[] | undefined {
  if (reste === 0) {
    const troueesEnBas = Array.from({ length: LIGNES_A_FAIRE }, (_rien, rang) => {
      const ligne = LIGNES - 1 - rang;
      return Array.from({ length: COLONNES }, (_vide, c) => c).some(
        (colonne) => !pleines.has(ligne * COLONNES + colonne),
      );
    });
    return troueesEnBas.every(Boolean) ? [] : undefined;
  }

  // La derniere piece posee, la premiere retiree, bouche un trou des lignes a faire: il faut
  // les quatre pieces pour les finir.
  const candidates = retirables(pleines).filter(
    (piece) =>
      reste < PIECES_PAR_PARTIE ||
      casesDeLaPiece(piece).some(([, ligne]) => ligne >= LIGNES - LIGNES_A_FAIRE),
  );

  for (const piece of t.melanger(candidates).slice(0, 8)) {
    const sans = new Set(pleines);
    for (const [c, l] of casesDeLaPiece(piece)) {
      sans.delete(l * COLONNES + c);
    }
    const suite = retirer(t, sans, reste - 1);

    if (suite !== undefined) {
      return [piece, ...suite];
    }
  }

  return undefined;
}

/**
 * Une grille preparee de cette graine. Les essais d'une meme graine se suivent, tous tires du
 * meme generateur; en dernier recours, une grille ecrite a la main, faisable elle aussi.
 */
export function preparerLaGrille(graine: number): Preparation {
  const t = tireur(graine);

  for (let essai = 0; essai < 100; essai += 1) {
    const pile = pileDeDepart(t);
    const retirees = retirer(t, pile, PIECES_PAR_PARTIE);

    if (retirees !== undefined) {
      const solution = [...retirees].reverse();
      const restantes = new Set(pile);
      for (const piece of solution) {
        for (const [c, l] of casesDeLaPiece(piece)) {
          restantes.delete(l * COLONNES + c);
        }
      }
      // Une grille presque vide ne se lit pas comme une grille preparee: un autre essai.
      if (restantes.size < CAISSES_PREPAREES_MINIMUM) {
        continue;
      }
      return {
        grille: Array.from({ length: COLONNES * LIGNES }, (_rien, indice) =>
          restantes.has(indice) ? PREPAREE : VIDE,
        ),
        pieces: solution.map((piece) => piece.forme),
        solution,
      };
    }
  }

  return GRILLE_DE_SECOURS;
}

/** La grille ecrite a la main, si aucun essai n'aboutissait. */
const GRILLE_DE_SECOURS: Preparation = (() => {
  const solution: readonly Piece[] = [
    { forme: 0, orientation: 0, colonne: 0, ligne: 9 },
    { forme: 1, orientation: 0, colonne: 4, ligne: 8 },
    { forme: 0, orientation: 0, colonne: 0, ligne: 8 },
    { forme: 1, orientation: 0, colonne: 4, ligne: 6 },
  ];
  return {
    grille: Array.from({ length: COLONNES * LIGNES }, () => VIDE),
    pieces: solution.map((piece) => piece.forme),
    solution,
  };
})();

// --------------------------------------------------------------------------
// La partie
// --------------------------------------------------------------------------

/** Une partie neuve de cette graine, pas encore commencee. */
export function creerCaisses(graine: number): EtatCaisses {
  return { ...partieNeuve(graine), echos: [] };
}

function partieNeuve(graine: number): Omit<EtatCaisses, 'echos'> {
  const preparation = preparerLaGrille(graine);

  return {
    nature: 'caisses',
    graine,
    grille: preparation.grille,
    pieces: preparation.pieces,
    suivante: 0,
    descente: false,
    lignes: 0,
  };
}

/** Le pas suivant, a l'allure du moment. */
function pasSuivant(etat: EtatCaisses, depuis: number): number {
  return depuis + (etat.descente ? DESCENTE_MS : CHUTE_MS);
}

/** La piece suivante entre en haut, au milieu; si elle ne tient pas, la partie est perdue. */
function entrer(etat: EtatCaisses, instant: number): EtatCaisses {
  const forme = etat.pieces[etat.suivante];

  if (forme === undefined) {
    return perdre(etat, instant);
  }

  const largeur = Math.max(...(ORIENTATIONS[forme]?.[0] ?? []).map(([c]) => c)) + 1;
  const piece = { forme, orientation: 0, colonne: Math.floor((COLONNES - largeur) / 2), ligne: 0 };

  if (!tient(etat.grille, piece)) {
    return perdre(etat, instant);
  }

  return {
    ...etat,
    enJeu: piece,
    suivante: etat.suivante + 1,
    prochainPas: pasSuivant(etat, instant),
  };
}

/** La partie est perdue: l'ecran perdu, puis une partie neuve. */
function perdre(etat: EtatCaisses, instant: number): EtatCaisses {
  const { enJeu: _tombee, ...sansPiece } = etat;

  return avecEcho({ ...sansPiece, perdueJusqua: instant + PERTE_MS }, 'perdue');
}

/** La piece ne descend plus: elle se pose, et les lignes pleines commencent a s'effacer. */
function poser(etat: EtatCaisses, piece: Piece, instant: number): EtatCaisses {
  const grille = [...etat.grille];
  for (const [c, l] of casesDeLaPiece(piece)) {
    grille[l * COLONNES + c] = POSEE;
  }

  const pleines = Array.from({ length: LIGNES }, (_rien, ligne) => ligne).filter((ligne) =>
    grille.slice(ligne * COLONNES, (ligne + 1) * COLONNES).every((contenu) => contenu !== VIDE),
  );
  const { enJeu: _posee, ...sansPiece } = etat;
  const posee = avecEcho({ ...sansPiece, grille }, 'posee');

  if (pleines.length > 0) {
    return avecEcho(
      {
        ...posee,
        lignes: posee.lignes + pleines.length,
        effacement: { lignes: pleines, jusqua: instant + EFFACEMENT_MS },
      },
      'ligne',
    );
  }

  return suivre(posee, instant);
}

/** Apres une piece posee et ses lignes effacees: la piece suivante, ou la fin. */
function suivre(etat: EtatCaisses, instant: number): EtatCaisses {
  if (etat.lignes >= LIGNES_A_FAIRE) {
    return etat;
  }

  return etat.suivante >= etat.pieces.length ? perdre(etat, instant) : entrer(etat, instant);
}

/** Efface les lignes pleines: celles du dessus descendent. */
function effacer(etat: EtatCaisses, lignes: readonly number[], instant: number): EtatCaisses {
  const gardees = Array.from({ length: LIGNES }, (_rien, ligne) => ligne).filter(
    (ligne) => !lignes.includes(ligne),
  );
  const grille = [
    ...Array.from({ length: lignes.length * COLONNES }, () => VIDE),
    ...gardees.flatMap((ligne) => etat.grille.slice(ligne * COLONNES, (ligne + 1) * COLONNES)),
  ];
  const { effacement: _fini, ...sansEffacement } = etat;

  return suivre({ ...sansEffacement, grille }, instant);
}

/** Le temps passe jusqu'a maintenant: les pas de chute, les effacements, la partie neuve. */
function avancer(etat: EtatCaisses, maintenant: number): EtatCaisses {
  let courant = etat.prochainPas === undefined ? entrer(etat, maintenant) : etat;

  for (let garde = 0; garde < 1000; garde += 1) {
    if (courant.perdueJusqua !== undefined) {
      if (maintenant < courant.perdueJusqua) {
        return courant;
      }
      const debut = courant.perdueJusqua;
      courant = entrer({ ...partieNeuve(courant.graine + 1), echos: courant.echos }, debut);
      continue;
    }

    if (courant.effacement !== undefined) {
      if (maintenant < courant.effacement.jusqua) {
        return courant;
      }
      courant = effacer(courant, courant.effacement.lignes, courant.effacement.jusqua);
      continue;
    }

    const piece = courant.enJeu;
    const pas = courant.prochainPas;
    if (piece === undefined || pas === undefined || maintenant < pas) {
      return courant;
    }

    const plusBas = { ...piece, ligne: piece.ligne + 1 };
    courant = tient(courant.grille, plusBas)
      ? { ...courant, enJeu: plusBas, prochainPas: pasSuivant(courant, pas) }
      : poser(courant, piece, pas);
  }

  return courant;
}

/** La piece bouge si elle tient a sa nouvelle place; tourner essaie aussi a cote. */
function bouger(etat: EtatCaisses, bouton: BoutonDeCaisses, maintenant: number): EtatCaisses {
  const piece = etat.enJeu;

  if (bouton === 'descendre') {
    return descendre(etat, true, maintenant);
  }

  if (piece === undefined || etat.effacement !== undefined || etat.perdueJusqua !== undefined) {
    return etat;
  }

  const essais: readonly Piece[] =
    bouton === 'tourner'
      ? [0, -1, 1, -2].map((decalage) => ({
          ...piece,
          orientation: (piece.orientation + 1) % (ORIENTATIONS[piece.forme]?.length ?? 1),
          colonne: piece.colonne + decalage,
        }))
      : [{ ...piece, colonne: piece.colonne + (bouton === 'gauche' ? -1 : 1) }];
  const place = essais.find((essai) => tient(etat.grille, essai));

  return place === undefined ? etat : { ...etat, enJeu: place };
}

/** La descente tenue ou lachee; tenue, le prochain pas vient au plus tard dans DESCENTE_MS. */
function descendre(etat: EtatCaisses, tenue: boolean, maintenant: number): EtatCaisses {
  if (etat.descente === tenue) {
    return etat;
  }

  const prochain =
    tenue && etat.prochainPas !== undefined
      ? Math.min(etat.prochainPas, maintenant + DESCENTE_MS)
      : etat.prochainPas;

  return prochain === undefined
    ? { ...etat, descente: tenue }
    : { ...etat, descente: tenue, prochainPas: prochain };
}

/** Le bouton sous ce point, s'il y en a un. */
export function boutonSous(point: PointDuGeste): BoutonDeCaisses | undefined {
  return BOUTONS.find((bouton) =>
    dansLeRectangle(point, bouton.x, bouton.y, bouton.largeur, bouton.hauteur),
  )?.bouton;
}

/** La partie apres une commande. */
export function appliquerCaisses(
  etat: EtatCaisses,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatCaisses {
  const avance = avancer(etat, maintenant);

  switch (commande.type) {
    case 'temps':
      return avance;

    case 'touche':
      if (commande.touche === 'bas') {
        return descendre(avance, commande.enfoncee, maintenant);
      }
      if (!commande.enfoncee) {
        return avance;
      }
      return bouger(
        avance,
        commande.touche === 'gauche'
          ? 'gauche'
          : commande.touche === 'droite'
            ? 'droite'
            : 'tourner',
        maintenant,
      );

    case 'pointeur': {
      if (commande.phase === 'haut') {
        return descendre(avance, false, maintenant);
      }
      const bouton = commande.phase === 'bas' ? boutonSous(commande) : undefined;
      return bouton === undefined ? avance : bouger(avance, bouton, maintenant);
    }
  }
}

/** Les deux lignes sont-elles faites, et effacees. */
export function caissesFinies(etat: EtatCaisses, maintenant: number): boolean {
  return (
    etat.lignes >= LIGNES_A_FAIRE &&
    (etat.effacement === undefined || maintenant >= etat.effacement.jusqua)
  );
}

/** Les lignes faites. */
export function avancementDesCaisses(etat: EtatCaisses): AvancementDuGeste {
  return { faits: Math.min(etat.lignes, LIGNES_A_FAIRE), total: LIGNES_A_FAIRE };
}

/** La ou la piece en jeu se poserait, tombee droit: l'ombre que dessine la fenetre. */
export function atterrissage(etat: EtatCaisses): Piece | undefined {
  let piece = etat.enJeu;

  while (piece !== undefined && tient(etat.grille, { ...piece, ligne: piece.ligne + 1 })) {
    piece = { ...piece, ligne: piece.ligne + 1 };
  }

  return piece;
}
