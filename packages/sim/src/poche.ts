/**
 * La poche d'un joueur, et la fumee, son premier objet (etape 7.10).
 *
 * Aucune version du jeu d'origine n'avait de poche: ses regles sont celles que le porteur
 * du projet a tranchees le 28 septembre 2026 (docs/plan/etape-7-10.md). Un bonus du jeu
 * agit des qu'on le ramasse; un objet de poche, lui, se garde jusqu'a ce que le joueur
 * choisisse de s'en servir.
 *
 * CE QUI SE DECIDE ICI:
 *
 *   - Ramasser un objet de poche remplit la poche, et rien d'autre. La poche n'a qu'une
 *     place: pleine, elle ne ramasse pas, et l'objet reste sur la carte pour un autre.
 *   - La poche se vide a toute prise: capture par un joueur, prise par un Black Ninja,
 *     infection en Chasse, mort en Massacre. Chacune passe par sansPoche, la ou elle
 *     s'ecrit.
 *   - Le joueur qui s'en sert et porte une fumee reparait ailleurs, au hasard, loin des
 *     joueurs, des Black Ninjas et de l'Evade, et a un tiers de carte au moins de son
 *     depart. Rien d'autre ne change pour lui: ses ninjas, son score, son combo, le x2 de
 *     l'Evade, ses effets en cours, son delai entre deux captures. Aucune protection a
 *     l'arrivee.
 *
 *   - Le joueur qui s'en sert et porte une mine la pose sous ses pieds (etape 7.11, mines.ts).
 *
 * L'ORDRE DU BATTEMENT. Les poches servent juste apres le deplacement des joueurs, avant les
 * bots, les tirs et les contacts (tick, dans moteur.ts). Un joueur qui declenche sa fumee
 * dans le battement ou un adversaire ou un Black Ninja le touche s'echappe: c'est le reflexe
 * que la fumee recompense.
 *
 * AUCUN TIRAGE SANS FUMEE. Une poche vide, ou une demande sans poche, ne consomme rien du
 * generateur: une partie ou personne ne s'enfuit rejoue a l'octet celle d'avant l'etape.
 */

import type { Alea, NatureObjet, ObjetDePoche, Position } from '@neon-ninja/shared';
import { FUMEE, TYPES_OBJETS_DE_POCHE } from '@neon-ninja/shared';

import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { positionDApparition } from './etat.js';
import { poserUneMine } from './mines.js';
import type { Entrees } from './moteur.js';

/** Cette nature d'objet va-t-elle dans la poche ? */
export function estUnObjetDePoche(nature: NatureObjet): nature is ObjetDePoche {
  return (TYPES_OBJETS_DE_POCHE as readonly NatureObjet[]).includes(nature);
}

/** Le joueur a-t-il la place de ramasser un objet de poche ? */
export function aLaPocheVide(joueur: Joueur): boolean {
  return joueur.poche === undefined;
}

/**
 * Le joueur, la poche videe. Le champ disparait au lieu de valoir undefined: un joueur
 * qui n'a jamais rien eu en poche et un joueur qui l'a videe sont le meme etat.
 */
export function sansPoche(joueur: Joueur): Joueur {
  if (joueur.poche === undefined) {
    return joueur;
  }

  const { poche: _videe, ...reste } = joueur;
  return reste;
}

/**
 * Le joueur met un objet de poche dans sa poche. L'appelant a verifie qu'elle etait vide
 * et retire l'objet de la carte.
 *
 * @param position Ou l'objet etait pose, pour le journal.
 */
export function empocher(
  etat: EtatPartie,
  joueur: Joueur,
  nature: ObjetDePoche,
  position: Position,
): EtatPartie {
  return {
    ...etat,
    joueurs: { ...etat.joueurs, [joueur.id]: { ...joueur, poche: nature } },
    evenements: [...etat.evenements, { type: 'objetEmpoche', joueur: joueur.id, nature, position }],
  };
}

/** Ce que fait chaque objet de poche quand son porteur s'en sert. */
const SERVIR: Readonly<Record<ObjetDePoche, (etat: EtatPartie, joueur: Joueur) => EtatPartie>> = {
  fumee: fuirDansLaFumee,
  mine: poserUneMine,
};

/**
 * Chaque joueur qui le demande se sert de ce qu'il a en poche, dans l'ordre d'arrivee.
 *
 * Une demande sur une poche vide ne fait rien. Un joueur hors jeu (un traqueur elimine, en
 * Chasse) ne se sert de rien.
 */
export function utiliserLesPoches(
  etat: EtatPartie,
  entrees: Entrees,
  horsJeu: ReadonlySet<IdentifiantEntite>,
): EtatPartie {
  let courant = etat;

  for (const id of Object.keys(etat.joueurs)) {
    if (entrees[id]?.utiliserLaPoche !== true || horsJeu.has(id)) {
      continue;
    }

    // Lu dans l'etat courant: un joueur deja parti en fumee a change de place, et les
    // suivants doivent s'en ecarter.
    const joueur = courant.joueurs[id];
    if (joueur?.poche !== undefined) {
      courant = SERVIR[joueur.poche](courant, joueur);
    }
  }

  return courant;
}

/** Le joueur s'enfuit dans un nuage de fumee: il reparait ailleurs, la poche videe. */
function fuirDansLaFumee(etat: EtatPartie, joueur: Joueur): EtatPartie {
  const arrivee = destinationDeLaFumee(etat, joueur);

  return {
    ...etat,
    joueurs: {
      ...etat.joueurs,
      [joueur.id]: { ...sansPoche(joueur), position: arrivee.valeur },
    },
    evenements: [
      ...etat.evenements,
      { type: 'fumee', joueur: joueur.id, depart: joueur.position, arrivee: arrivee.valeur },
    ],
    alea: arrivee.alea,
  };
}

/**
 * Ou mene la fumee de ce joueur.
 *
 * Un tirage d'apparition, qui s'ecarte des menaces comme toute apparition s'ecarte des
 * entites presentes, et que l'on recommence tant qu'il tombe trop pres du depart. Au bout
 * de FUMEE.TIRAGES_LOIN_DU_DEPART tirages, on garde le dernier: la distance au depart se
 * relache avant l'ecart aux menaces, que positionDApparition ne relache qu'a la derniere
 * extremite.
 */
export function destinationDeLaFumee(
  etat: EtatPartie,
  joueur: Joueur,
): { readonly valeur: Position; readonly alea: Alea } {
  const menaces = menacesDe(etat, joueur.id);
  const minimum =
    FUMEE.PART_DE_CARTE_AU_DEPART * Math.max(etat.terrain.largeur, etat.terrain.hauteur);

  let tirage = positionDApparition(etat.alea, etat.terrain, menaces);

  for (
    let essai = 1;
    essai < FUMEE.TIRAGES_LOIN_DU_DEPART && distance(tirage.valeur, joueur.position) < minimum;
    essai += 1
  ) {
    tirage = positionDApparition(tirage.alea, etat.terrain, menaces);
  }

  return tirage;
}

/** Ce dont la fumee eloigne un joueur: les autres joueurs, les Black Ninjas, et l'Evade. */
function menacesDe(etat: EtatPartie, id: IdentifiantEntite): readonly Position[] {
  const joueurs = Object.values(etat.joueurs)
    .filter((autre) => autre.id !== id)
    .map((autre) => autre.position);
  const botsNoirs = Object.values(etat.bots)
    .filter((bot) => bot.type === 'botNoir')
    .map((bot) => bot.position);
  const evade = etat.evade?.surLaCarte;

  return [...joueurs, ...botsNoirs, ...(evade === undefined ? [] : [evade.position])];
}

/** Distance entre deux positions, en pixels. */
function distance(une: Position, autre: Position): number {
  return Math.hypot(une.x - autre.x, une.y - autre.y);
}
