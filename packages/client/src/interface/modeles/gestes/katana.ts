/**
 * Aiguiser un katana (etape 7.21): glisser la lame sur la pierre, de la garde a la pointe,
 * cinq fois. Une passe a l'envers ne compte pas. Au clavier, la fleche droite joue une passe.
 *
 * Chaque passe comptee se joue en entier (PASSE_MS): la suivante attend qu'elle finisse, et le
 * geste n'est fini qu'a la fin de la derniere. Cinq passes font 3,25 secondes au plus vite,
 * au-dessus des 3 secondes du serveur.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste } from './commun.js';
import { avecEcho, dansLeRectangle } from './commun.js';

/** Le nombre de passes a faire. */
export const PASSES_DU_KATANA = 5;

/** Ce que dure une passe comptee, son animation comprise. */
export const PASSE_MS = 650;

/** La pierre, dans l'espace du geste. */
export const PIERRE = { gauche: 70, haut: 175, largeur: 260, hauteur: 40 } as const;

/** La bande ou l'on peut saisir la lame: au-dessus de la pierre et sur elle. */
const BANDE = { haut: 100, hauteur: 140 } as const;

/** Ou la lame se saisit pour une passe dans le bon sens: du cote de la garde. */
const SAISIE_MAXIMUM_X = 180;

/** Le chemin a parcourir vers la pointe pour qu'une passe compte. */
const COURSE_D_UNE_PASSE = 150;

/** Ou en est l'aiguisage. */
export interface EtatKatana extends BaseDeGeste {
  readonly nature: 'katana';
  readonly passes: number;
  /** La fin de l'animation de la derniere passe comptee: rien ne compte avant. */
  readonly finDeLaPasse: number;
  /** La lame tenue au pointeur: d'ou la prise est partie, et ou elle en est. */
  readonly prise?: { readonly departX: number; readonly x: number };
}

/** L'aiguisage au debut. */
export function creerKatana(): EtatKatana {
  return { nature: 'katana', passes: 0, finDeLaPasse: 0, echos: [] };
}

/** Une passe de plus, si la precedente est finie et qu'il en reste. */
function passer(etat: EtatKatana, maintenant: number): EtatKatana {
  if (maintenant < etat.finDeLaPasse || etat.passes >= PASSES_DU_KATANA) {
    return etat;
  }

  const { prise: _lachee, ...sansPrise } = etat;

  return avecEcho(
    { ...sansPrise, passes: etat.passes + 1, finDeLaPasse: maintenant + PASSE_MS },
    'passe',
  );
}

/** L'aiguisage apres une commande. */
export function appliquerKatana(
  etat: EtatKatana,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatKatana {
  if (commande.type === 'touche') {
    return commande.enfoncee && commande.touche === 'droite' ? passer(etat, maintenant) : etat;
  }

  if (commande.type === 'temps') {
    return etat;
  }

  const { prise: _lachee, ...sansPrise } = etat;

  switch (commande.phase) {
    case 'bas':
      return dansLeRectangle(commande, 0, BANDE.haut, SAISIE_MAXIMUM_X, BANDE.hauteur)
        ? { ...etat, prise: { departX: commande.x, x: commande.x } }
        : etat;

    case 'deplace': {
      if (etat.prise === undefined) {
        return etat;
      }

      if (!dansLeRectangle(commande, 0, BANDE.haut, 400, BANDE.hauteur)) {
        return sansPrise;
      }

      return commande.x - etat.prise.departX >= COURSE_D_UNE_PASSE &&
        maintenant >= etat.finDeLaPasse
        ? passer(etat, maintenant)
        : { ...etat, prise: { ...etat.prise, x: commande.x } };
    }

    case 'haut':
      return sansPrise;
  }
}

/** L'aiguisage est-il fini: cinq passes, la derniere jouee. */
export function katanaFini(etat: EtatKatana, maintenant: number): boolean {
  return etat.passes >= PASSES_DU_KATANA && maintenant >= etat.finDeLaPasse;
}

/** Les passes faites. */
export function avancementDuKatana(etat: EtatKatana): AvancementDuGeste {
  return { faits: etat.passes, total: PASSES_DU_KATANA };
}
