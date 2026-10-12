/**
 * Bataille navale (etape 7.24, rendu 4B de la planche docs/design/etape-7-24/1-planche.png):
 * deux bateaux caches, de trois et deux cases, sur une mer de 5 sur 5, a couler en TIRS_PERMIS
 * tirs au plus. Les bateaux ne se touchent pas, meme en diagonale. Au pointeur, toucher une
 * case; au clavier, les fleches pour la case visee, Espace pour tirer.
 *
 * LA MER ET LE NOMBRE DE TIRS se reglent par simulation (fiche, « Les quatre mini-jeux »). Sur
 * 6 sur 6, il fallait 20 tirs pour qu'un joueur methodique gagne neuf fois sur dix, et le
 * porteur du projet l'a trouvee la plus difficile des quatre (essai du 11 octobre 2026). Sur
 * 5 sur 5, un joueur methodique, qui cherche une case sur deux puis suit un bateau touche,
 * coule les deux en 18 tirs 99 fois sur 100, en 12 en moyenne: un joueur moins methodique
 * echoue rarement.
 *
 * LE RYTHME. Chaque tir joue son animation pendant TIR_MS, et le suivant attend. La chance peut
 * couler les deux bateaux en cinq tirs, sous la duree minimale du serveur: la fenetre garde
 * alors l'ecran gagne jusqu'a elle.
 *
 * UN ECHEC (plus de tirs, un bateau a flot) montre les bateaux pendant PERTE_MS, puis une mer
 * neuve, d'une autre graine.
 */

import type {
  AvancementDuGeste,
  BaseDeGeste,
  CommandeDeGeste,
  PointDuGeste,
  ToucheDeGeste,
} from './commun.js';
import { avecEcho, tireur } from './commun.js';
import type { Case } from './caisses.js';

/** La mer, en cases de cote. */
export const COTE_DE_LA_MER = 5;

/** La mer dans l'espace du geste: son coin haut gauche et le cote d'une case. */
export const MER = { x: 56, y: 56, cote: 42 } as const;

/** Les longueurs des bateaux. */
export const BATEAUX = [3, 2] as const;

/** Les tirs permis pour les couler. */
export const TIRS_PERMIS = 18;

/** L'animation d'un tir, pendant laquelle on ne tire pas. */
export const TIR_MS = 700;

/** Ce que dure l'ecran perdu, les bateaux montres. */
export const PERTE_MS = 1400;

/** Un tir: sa case, s'il a touche, et quand. */
export interface Tir {
  readonly case_: Case;
  readonly touche: boolean;
  readonly instant: number;
}

/** Ou en est la partie. */
export interface EtatBataille extends BaseDeGeste {
  readonly nature: 'bataille';
  /** La graine de la mer en cours: une mer perdue prend la suivante. */
  readonly graine: number;
  /** Les cases de chaque bateau. */
  readonly bateaux: readonly (readonly Case[])[];
  readonly tirs: readonly Tir[];
  /** La case visee au clavier. */
  readonly visee: Case;
  /** La partie perdue, jusqu'a cet instant. */
  readonly perdueJusqua?: number;
}

/** Les deux cases sont-elles la meme. */
function meme(une: Case, autre: Case): boolean {
  return une[0] === autre[0] && une[1] === autre[1];
}

/** Les bateaux d'une mer de cette graine, sans se toucher, meme en diagonale. */
export function placerLesBateaux(graine: number): readonly (readonly Case[])[] {
  const t = tireur(graine);

  for (let essai = 0; essai < 200; essai += 1) {
    const places: (readonly Case[])[] = [];

    for (const longueur of BATEAUX) {
      const couche = t.reel(0, 1) < 0.5;
      const colonne = Math.floor(t.reel(0, COTE_DE_LA_MER - (couche ? longueur - 1 : 0)));
      const ligne = Math.floor(t.reel(0, COTE_DE_LA_MER - (couche ? 0 : longueur - 1)));
      const cases = Array.from({ length: longueur }, (_rien, rang): Case =>
        couche ? [colonne + rang, ligne] : [colonne, ligne + rang],
      );
      const touche = places.some((autre) =>
        autre.some(([c, l]) =>
          cases.some(([ac, al]) => Math.abs(ac - c) <= 1 && Math.abs(al - l) <= 1),
        ),
      );

      if (!touche) {
        places.push(cases);
      }
    }

    if (places.length === BATEAUX.length) {
      return places;
    }
  }

  return [
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [3, 3],
      [3, 4],
    ],
  ];
}

/** Une mer neuve de cette graine. */
export function creerBataille(graine: number): EtatBataille {
  return { ...merNeuve(graine), echos: [] };
}

function merNeuve(graine: number): Omit<EtatBataille, 'echos'> {
  return { nature: 'bataille', graine, bateaux: placerLesBateaux(graine), tirs: [], visee: [2, 2] };
}

/** Ce bateau est-il coule: toutes ses cases touchees. */
export function bateauCoule(etat: EtatBataille, bateau: readonly Case[]): boolean {
  return bateau.every((case_) => etat.tirs.some((tir) => meme(tir.case_, case_)));
}

/** Les bateaux coules. */
function coules(etat: EtatBataille): number {
  return etat.bateaux.filter((bateau) => bateauCoule(etat, bateau)).length;
}

/** Le dernier tir joue-t-il encore son animation. */
function tirEnCours(etat: EtatBataille, maintenant: number): boolean {
  const dernier = etat.tirs.at(-1);
  return dernier !== undefined && maintenant < dernier.instant + TIR_MS;
}

/** Tirer sur cette case, si l'on peut. */
function tirer(etat: EtatBataille, case_: Case, maintenant: number): EtatBataille {
  if (
    etat.perdueJusqua !== undefined ||
    coules(etat) === etat.bateaux.length ||
    etat.tirs.length >= TIRS_PERMIS ||
    tirEnCours(etat, maintenant) ||
    etat.tirs.some((tir) => meme(tir.case_, case_))
  ) {
    return etat;
  }

  const touche = etat.bateaux.some((bateau) => bateau.some((place) => meme(place, case_)));

  return avecEcho(
    { ...etat, visee: case_, tirs: [...etat.tirs, { case_, touche, instant: maintenant }] },
    touche ? 'touche' : 'eau',
  );
}

/** Le temps passe: plus de tirs et un bateau a flot, la mer est perdue; puis une mer neuve. */
function avancer(etat: EtatBataille, maintenant: number): EtatBataille {
  if (etat.perdueJusqua !== undefined) {
    return maintenant < etat.perdueJusqua
      ? etat
      : { ...merNeuve(etat.graine + 1), echos: etat.echos };
  }

  const dernier = etat.tirs.at(-1);

  if (
    dernier !== undefined &&
    etat.tirs.length >= TIRS_PERMIS &&
    coules(etat) < etat.bateaux.length &&
    maintenant >= dernier.instant + TIR_MS
  ) {
    return avecEcho({ ...etat, perdueJusqua: dernier.instant + TIR_MS + PERTE_MS }, 'perdue');
  }

  return etat;
}

/** La case de la mer sous ce point, s'il y en a une. */
export function caseSous(point: PointDuGeste): Case | undefined {
  const colonne = Math.floor((point.x - MER.x) / MER.cote);
  const ligne = Math.floor((point.y - MER.y) / MER.cote);

  return colonne >= 0 && colonne < COTE_DE_LA_MER && ligne >= 0 && ligne < COTE_DE_LA_MER
    ? [colonne, ligne]
    : undefined;
}

/** La case visee bouge d'un cran, sans sortir de la mer. */
function viser(etat: EtatBataille, dc: number, dl: number): EtatBataille {
  const borne = (valeur: number): number => Math.min(Math.max(valeur, 0), COTE_DE_LA_MER - 1);
  return { ...etat, visee: [borne(etat.visee[0] + dc), borne(etat.visee[1] + dl)] };
}

/** Une touche enfoncee: les fleches visent, Espace tire. */
function auClavier(etat: EtatBataille, touche: ToucheDeGeste, maintenant: number): EtatBataille {
  switch (touche) {
    case 'gauche':
      return viser(etat, -1, 0);
    case 'droite':
      return viser(etat, 1, 0);
    case 'haut':
      return viser(etat, 0, -1);
    case 'bas':
      return viser(etat, 0, 1);
    case 'espace':
      return tirer(etat, etat.visee, maintenant);
  }
}

/** La partie apres une commande. */
export function appliquerBataille(
  etat: EtatBataille,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatBataille {
  const avance = avancer(etat, maintenant);

  switch (commande.type) {
    case 'temps':
      return avance;

    case 'touche':
      return commande.enfoncee ? auClavier(avance, commande.touche, maintenant) : avance;

    case 'pointeur': {
      const case_ = commande.phase === 'bas' ? caseSous(commande) : undefined;
      return case_ === undefined ? avance : tirer(avance, case_, maintenant);
    }
  }
}

/** Les deux bateaux sont-ils coules, la derniere animation jouee. */
export function batailleFinie(etat: EtatBataille, maintenant: number): boolean {
  return coules(etat) === etat.bateaux.length && !tirEnCours(etat, maintenant);
}

/** Les bateaux coules. */
export function avancementDeLaBataille(etat: EtatBataille): AvancementDuGeste {
  return { faits: coules(etat), total: etat.bateaux.length };
}
