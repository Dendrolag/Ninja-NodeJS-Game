/**
 * Petits outils partages par les quatre suites de caracterisation.
 *
 * Rien ici ne touche au legacy: ce sont des raccourcis de lecture, pour que les
 * scenarios se lisent comme des situations de jeu et non comme du bricolage.
 */

import type { EntiteLegacy, Harnais, JoueurLegacy } from './charger-legacy.js';

/** Duree de la protection accordee a un joueur qui vient d'apparaitre, en ms. */
export const PROTECTION_DE_SPAWN_MS = 3000;

/** Delai impose entre deux captures d'un meme joueur, en ms. */
export const DELAI_ENTRE_CAPTURES_MS = 1000;

/**
 * Avance l'horloge juste assez pour que les joueurs deja crees ne soient plus
 * proteges par leur apparition. Sans cela, aucune capture n'est possible.
 */
export function sortirDeLaProtectionDeSpawn(harnais: Harnais): void {
  harnais.horloge.avancerDe(PROTECTION_DE_SPAWN_MS + 1);
}

/** Compte les bots portant chaque couleur, pour un instantane lisible. */
export function botsParCouleur(harnais: Harnais): Record<string, number> {
  const comptes: Record<string, number> = {};
  for (const bot of Object.values(harnais.bots)) {
    comptes[bot.color] = (comptes[bot.color] ?? 0) + 1;
  }
  return comptes;
}

/**
 * Resume l'etat d'un joueur en ne gardant que ce qui est determine par les
 * regles du jeu. La position et la couleur tirees au sort lors d'une
 * reapparition sont volontairement exclues: elles dependent du hasard, pas du
 * comportement que l'on veut figer.
 */
export function resumeDeJoueur(joueur: JoueurLegacy): Record<string, unknown> {
  return {
    pseudo: joueur.nickname,
    captures: joueur.captures,
    botsControlled: joueur.botsControlled,
    totalBotsCaptures: joueur.totalBotsCaptures,
    capturedByBlackBot: joueur.capturedByBlackBot,
    blackBotsDestroyed: joueur.blackBotsDestroyed,
    capturedPlayers: joueur.capturedPlayers,
    capturedBy: joueur.capturedBy,
  };
}

/** Liste les evenements emis vers une cible, dans l'ordre, sans leurs donnees. */
export function evenementsVers(harnais: Harnais, cible: string): string[] {
  return harnais.emissionsVers(cible).map((emission) => emission.evenement);
}

/** Place une entite a une position donnee, pour construire une situation exacte. */
export function placer<T extends EntiteLegacy>(entite: T, x: number, y: number): T {
  entite.x = x;
  entite.y = y;
  return entite;
}
