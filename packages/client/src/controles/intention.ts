/**
 * De ce que le joueur fait a ce que le serveur recoit: la direction demandee.
 *
 * FONCTIONS PURES. Aucune ne touche au clavier, a l'ecran ni au reseau: elles
 * traduisent un ETAT DE SAISIE en INTENTION DE DEPLACEMENT, ce qui les rend
 * verifiables sans navigateur. Le branchement sur les evenements du document est
 * dans clavier.ts et tactile.ts, et il ne contient aucune regle.
 *
 * L'INTENTION NE CONTIENT QU'UNE DIRECTION, jamais un etat. C'est la regle posee
 * a l'etape 1.6 et inscrite dans le contrat: le client ne dit pas « je vais vite
 * parce que j'ai un bonus », il dit « je veux aller par la ». Le moteur decide du
 * reste. Le jeu d'origine faisait l'inverse et se laissait dicter la vitesse par
 * le client, ce qui etait la faille S2 de l'audit.
 *
 * ON N'INVERSE RIEN ICI NON PLUS. Le malus de controles inverses est applique par
 * le moteur depuis l'etape 1.4. Un client qui inverserait aussi annulerait le
 * malus, et le defaut serait invisible dans chaque paquet pris separement.
 */

import type { IntentionDeplacement, Vecteur } from '@neon-ninja/shared';

/** L'intention d'un joueur qui ne demande rien: il s'arrete et regarde devant lui. */
export const IMMOBILE: IntentionDeplacement = {
  deplacement: { x: 0, y: 0 },
  enMouvement: false,
};

/** Les quatre directions cardinales qu'une saisie peut demander. */
export interface DirectionsDemandees {
  readonly haut: boolean;
  readonly bas: boolean;
  readonly gauche: boolean;
  readonly droite: boolean;
}

/** Aucune direction demandee. */
export const AUCUNE_DIRECTION: DirectionsDemandees = {
  haut: false,
  bas: false,
  gauche: false,
  droite: false,
};

/**
 * Traduit un jeu de directions en intention.
 *
 * DEUX TOUCHES OPPOSEES S'ANNULENT, ce qui est le comportement attendu de
 * n'importe quel jeu et ce que le client d'origine ne faisait pas: chez lui, la
 * derniere condition evaluee l'emportait, si bien que presser haut et bas en meme
 * temps faisait descendre.
 *
 * LE VECTEUR EST NORMALISE, pour que la diagonale n'aille pas plus vite que la
 * ligne droite. Le serveur ne lit de toute facon que l'orientation, mais envoyer
 * un vecteur de longueur un rend le message lisible et le rendra comparable si un
 * jour l'intensite compte, par exemple pour une manette analogique.
 */
export function intentionDepuisDirections(directions: DirectionsDemandees): IntentionDeplacement {
  const x = (directions.droite ? 1 : 0) - (directions.gauche ? 1 : 0);
  const y = (directions.bas ? 1 : 0) - (directions.haut ? 1 : 0);

  if (x === 0 && y === 0) {
    return IMMOBILE;
  }

  return { deplacement: normaliser({ x, y }), enMouvement: true };
}

/**
 * Traduit la position d'une manette virtuelle en intention.
 *
 * @param ecart  Deplacement du pouce depuis le centre de la manette, en pixels.
 * @param rayon  Rayon de la manette. Au-dela, le pouce est ramene au bord.
 * @param seuil  Fraction du rayon en dessous de laquelle on ne bouge pas. C'est
 *               la zone morte, sans laquelle un pouce pose sans intention ferait
 *               partir le personnage.
 */
export function intentionDepuisManette(
  ecart: Vecteur,
  rayon: number,
  seuil = 0.2,
): IntentionDeplacement {
  const distance = Math.hypot(ecart.x, ecart.y);

  if (rayon <= 0 || distance < rayon * seuil) {
    return IMMOBILE;
  }

  return { deplacement: normaliser(ecart), enMouvement: true };
}

/** Ramene un vecteur a une longueur de un. Le vecteur nul reste nul. */
function normaliser(vecteur: Vecteur): Vecteur {
  const longueur = Math.hypot(vecteur.x, vecteur.y);

  return longueur === 0 ? vecteur : { x: vecteur.x / longueur, y: vecteur.y / longueur };
}

/**
 * Deux intentions demandent-elles la meme chose.
 *
 * Sert a n'emettre que ce qui change. Le client d'origine envoyait un message a
 * chaque battement de sa boucle de saisie, meme immobile: cinquante messages par
 * seconde pour dire « je ne bouge pas ».
 */
export function memeIntention(gauche: IntentionDeplacement, droite: IntentionDeplacement): boolean {
  return (
    gauche.enMouvement === droite.enMouvement &&
    Math.abs(gauche.deplacement.x - droite.deplacement.x) < TOLERANCE &&
    Math.abs(gauche.deplacement.y - droite.deplacement.y) < TOLERANCE
  );
}

/**
 * En dessous de cet ecart, deux directions sont considerees identiques.
 *
 * Une manette analogique bouge en continu: sans tolerance, chaque frisson du
 * pouce produirait un message.
 */
const TOLERANCE = 0.01;
