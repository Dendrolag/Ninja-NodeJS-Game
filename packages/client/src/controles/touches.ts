/**
 * Quelles touches font quoi.
 *
 * TABLE PURE, SANS AUCUN EVENEMENT. Elle dit seulement quelles touches
 * correspondent a quelle direction; l'ecoute du clavier est ailleurs. C'est ce
 * qui permet de verifier le plan de touches par un test, et ce qui rendra un
 * jour la reconfiguration possible sans toucher au reste.
 *
 * ZQSD ET LES FLECHES, comme le jeu d'origine et comme la maquette. Le clavier
 * francais est celui du jeu; les fleches marchent partout. WASD est ajoute
 * parce que la meme touche physique porte W sur un clavier qwerty et Z sur un
 * azerty: sans lui, un joueur au clavier qwerty ne peut pas avancer.
 *
 * LES NOMS SONT CEUX DE LA PROPRIETE key DU NAVIGATEUR, en minuscules. On ne se
 * sert pas de code, qui designe la touche physique: un joueur qui a choisi une
 * disposition de clavier s'attend a ce que ses lettres soient celles qu'il voit.
 */

import type { DirectionsDemandees } from './intention.js';
import { AUCUNE_DIRECTION } from './intention.js';

/** Les touches acceptees pour chacune des quatre directions. */
export const TOUCHES: Readonly<Record<keyof DirectionsDemandees, readonly string[]>> = {
  haut: ['z', 'w', 'arrowup'],
  bas: ['s', 'arrowdown'],
  gauche: ['q', 'a', 'arrowleft'],
  droite: ['d', 'arrowright'],
};

/** Toutes les touches que le jeu consomme, pour savoir lesquelles intercepter. */
export const TOUCHES_DU_JEU: ReadonlySet<string> = new Set(Object.values(TOUCHES).flat());

/** Normalise le nom d'une touche tel que le navigateur le donne. */
export function nomDeTouche(touche: string): string {
  return touche.toLowerCase();
}

/** Quelles directions un jeu de touches enfoncees demande. */
export function directionsDepuisTouches(enfoncees: ReadonlySet<string>): DirectionsDemandees {
  if (enfoncees.size === 0) {
    return AUCUNE_DIRECTION;
  }

  return {
    haut: TOUCHES.haut.some((touche) => enfoncees.has(touche)),
    bas: TOUCHES.bas.some((touche) => enfoncees.has(touche)),
    gauche: TOUCHES.gauche.some((touche) => enfoncees.has(touche)),
    droite: TOUCHES.droite.some((touche) => enfoncees.has(touche)),
  };
}
