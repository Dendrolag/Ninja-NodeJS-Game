/**
 * Ranger des mines (etape 7.21): glisser quatre mines, prises a gauche, dans les quatre
 * alveoles de la mallette. Au clavier, les fleches choisissent l'alveole et Espace y pose la
 * mine suivante.
 *
 * Chaque mine rangee joue son animation (MINE_MS) avant la suivante: quatre mines font 3,6
 * secondes au plus vite, au-dessus des 3,5 secondes du serveur.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste, PointDuGeste } from './commun.js';
import { avecEcho, distance } from './commun.js';

/** Ce que dure une mine rangee, son animation comprise. */
export const MINE_MS = 900;

/** Le nombre de mines. */
export const NOMBRE_DE_MINES = 4;

/** Le tas des mines a ranger, et le rayon ou on en prend une. */
export const TAS = { x: 90, y: 155, rayon: 50 } as const;

/** Les quatre alveoles de la mallette, deux par deux, et leur rayon. */
export const ALVEOLES: readonly PointDuGeste[] = [
  { x: 245, y: 110 },
  { x: 330, y: 110 },
  { x: 245, y: 200 },
  { x: 330, y: 200 },
];
export const RAYON_D_UNE_ALVEOLE = 34;

/** Ou en est le rangement. */
export interface EtatMines extends BaseDeGeste {
  readonly nature: 'mines';
  /** Les alveoles garnies. */
  readonly rangees: readonly boolean[];
  /** La fin de l'animation de la derniere mine rangee. */
  readonly finDeLaMine: number;
  /** La mine tenue au pointeur, et sa place. */
  readonly prise?: PointDuGeste;
  /** L'alveole que le clavier choisit. */
  readonly curseur: number;
}

/** Une mallette vide. */
export function creerMines(): EtatMines {
  return {
    nature: 'mines',
    rangees: ALVEOLES.map(() => false),
    finDeLaMine: 0,
    curseur: 0,
    echos: [],
  };
}

/** Le nombre de mines encore au tas, la mine tenue a part. */
export function minesAuTas(etat: EtatMines): number {
  return (
    NOMBRE_DE_MINES -
    etat.rangees.filter((rangee) => rangee).length -
    (etat.prise === undefined ? 0 : 1)
  );
}

/** Range une mine dans cette alveole, si elle est vide et que la precedente est rangee. */
function ranger(etat: EtatMines, alveole: number, maintenant: number): EtatMines {
  const { prise: _lachee, ...sansPrise } = etat;

  if (etat.rangees[alveole] !== false || maintenant < etat.finDeLaMine) {
    return sansPrise;
  }

  const rangees = etat.rangees.map((rangee, rang) => rangee || rang === alveole);
  // Le clavier passe a l'alveole vide suivante.
  const vide = rangees.findIndex((rangee, rang) => !rangee && rang > alveole);

  return avecEcho(
    {
      ...sansPrise,
      rangees,
      finDeLaMine: maintenant + MINE_MS,
      curseur: vide >= 0 ? vide : Math.max(rangees.indexOf(false), 0),
    },
    'mine',
  );
}

/** Le rangement apres une commande. */
export function appliquerMines(
  etat: EtatMines,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatMines {
  if (commande.type === 'temps') {
    return etat;
  }

  if (commande.type === 'touche') {
    return commande.enfoncee ? toucher(etat, commande.touche, maintenant) : etat;
  }

  const { prise: _lachee, ...sansPrise } = etat;

  switch (commande.phase) {
    case 'bas':
      return distance(commande, TAS) <= TAS.rayon &&
        minesAuTas(etat) > 0 &&
        maintenant >= etat.finDeLaMine
        ? { ...etat, prise: { x: commande.x, y: commande.y } }
        : etat;

    case 'deplace':
      return etat.prise === undefined ? etat : { ...etat, prise: { x: commande.x, y: commande.y } };

    case 'haut': {
      if (etat.prise === undefined) {
        return etat;
      }

      const alveole = ALVEOLES.findIndex(
        (centre) => distance(centre, commande) <= RAYON_D_UNE_ALVEOLE + 8,
      );

      return alveole < 0 ? sansPrise : ranger(etat, alveole, maintenant);
    }
  }
}

/** Une touche enfoncee: les fleches dans la grille de deux sur deux, Espace pour poser. */
function toucher(
  etat: EtatMines,
  touche: Extract<CommandeDeGeste, { type: 'touche' }>['touche'],
  maintenant: number,
): EtatMines {
  const colonne = etat.curseur % 2;
  const ligne = Math.floor(etat.curseur / 2);

  switch (touche) {
    case 'gauche':
    case 'droite':
      return { ...etat, curseur: ligne * 2 + (1 - colonne) };
    case 'haut':
    case 'bas':
      return { ...etat, curseur: (1 - ligne) * 2 + colonne };
    case 'espace':
      return minesAuTas(etat) > 0 ? ranger(etat, etat.curseur, maintenant) : etat;
  }
}

/** Le rangement est-il fini: quatre mines, la derniere rangee. */
export function minesFinies(etat: EtatMines, maintenant: number): boolean {
  return etat.rangees.every((rangee) => rangee) && maintenant >= etat.finDeLaMine;
}

/** Les mines rangees. */
export function avancementDesMines(etat: EtatMines): AvancementDuGeste {
  return { faits: etat.rangees.filter((rangee) => rangee).length, total: NOMBRE_DE_MINES };
}
