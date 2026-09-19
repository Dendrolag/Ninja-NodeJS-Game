/**
 * Les six objets du mode Tactique (etape 7.7): ce qu'ils font a l'arme d'un joueur.
 *
 * Trois bonus et leurs trois contraires, decides par le porteur du projet le 19 septembre
 * 2026:
 *
 *   - Rafale: un tir ne coute plus de charge. Contraire: Tir unique, une seule charge
 *     utilisable, les autres gelees et rendues a la fin de l'effet.
 *   - Recharge rapide: une charge revient en 1,5 seconde au lieu de 5. Contraire: Recharge
 *     lente, en 10 secondes.
 *   - Visee large: un cone de 120 degres sur 150 pixels au lieu de 90 sur 100. Contraire:
 *     Visee etroite, 60 degres sur 70 pixels.
 *
 * Ils suivent les regles des objets du jeu d'origine. Un bonus profite au ramasseur, et
 * deux bonus identiques additionnent leur duree (comportement a preserver 10 de
 * CLAUDE.md); un malus frappe tous les autres joueurs (comportement 4), et un malus
 * identique relance sa duree sans s'y ajouter. UN BONUS ET SON CONTRAIRE S'ANNULENT tant
 * que les deux durent: aucun des deux n'agit.
 *
 * Ce fichier ne sait que lire et ecrire la table des effets d'un joueur, et dire l'arme
 * qui en decoule. Le ramassage est dans objets.ts, le tir et la recharge dans tactique.ts.
 */

import type {
  EffetTactique,
  NatureObjet,
  ReglagesPartie,
  TypeBonusTactique,
  TypeMalusTactique,
} from '@neon-ninja/shared';
import {
  OBJETS_TACTIQUES,
  TACTIQUE,
  TYPES_BONUS_TACTIQUES,
  TYPES_MALUS_TACTIQUES,
  effetQuiAgit,
} from '@neon-ninja/shared';

import type { DureesRestantes } from './effets.js';
import type { EtatTactiqueDuJoueur } from './etat.js';

/** Aucun effet du Tactique en cours. Voir packages/shared/src/objetsTactiques.ts. */
export { AUCUN_EFFET_TACTIQUE, effetQuiAgit, viseeDe } from '@neon-ninja/shared';

/** Cette nature de bonus est-elle un bonus du Tactique ? */
export function estUnBonusTactique(nature: NatureObjet): nature is TypeBonusTactique {
  return (TYPES_BONUS_TACTIQUES as readonly string[]).includes(nature);
}

/** Cette nature de malus est-elle un malus du Tactique ? */
export function estUnMalusTactique(nature: NatureObjet): nature is TypeMalusTactique {
  return (TYPES_MALUS_TACTIQUES as readonly string[]).includes(nature);
}

/** Cette nature d'objet est-elle un des six objets du Tactique ? */
export function estUnEffetTactique(nature: NatureObjet): nature is EffetTactique {
  return estUnBonusTactique(nature) || estUnMalusTactique(nature);
}

/**
 * Le reglage d'un objet du Tactique dans les reglages de la partie.
 *
 * Une partie Tactique a toujours ce groupe: le moteur le pose en creant l'etat
 * (imposerLesReglagesDuMode). Une partie d'un autre mode ne l'a pas, et aucun objet du
 * Tactique n'y apparait: le demander est une faute d'appelant.
 */
function reglagesDesObjets(
  reglages: ReglagesPartie,
): NonNullable<ReglagesPartie['objetsTactiques']> {
  const objets = reglages.objetsTactiques;
  if (objets === undefined) {
    throw new Error('Les objets du Tactique ne se reglent que dans une partie Tactique.');
  }

  return objets;
}

/** Un objet du Tactique est-il en jeu dans cette partie ? Jamais hors du Tactique. */
export function objetTactiqueActif(reglages: ReglagesPartie, nature: EffetTactique): boolean {
  const objets = reglages.objetsTactiques;
  if (objets === undefined) {
    return false;
  }

  return estUnBonusTactique(nature) ? objets.bonus[nature].actif : objets.malus[nature].actif;
}

/** La duree d'un effet du Tactique une fois ramasse, en millisecondes. */
export function dureeDeLEffet(reglages: ReglagesPartie, nature: EffetTactique): number {
  const objets = reglagesDesObjets(reglages);
  const dureeS = estUnBonusTactique(nature)
    ? objets.bonus[nature].dureeS
    : objets.malus[nature].dureeS;

  return dureeS * 1000;
}

/** Le taux d'apparition d'un bonus du Tactique, avant la part que le mode lui laisse. */
export function tauxDuBonus(reglages: ReglagesPartie, nature: TypeBonusTactique): number {
  return reglagesDesObjets(reglages).bonus[nature].tauxApparitionPourCent;
}

/**
 * La vitesse a laquelle l'attente d'une charge s'ecoule: 1 d'ordinaire, 5 / 1,5 sous
 * Recharge rapide, 5 / 10 sous Recharge lente.
 *
 * C'est une vitesse et non une duree, pour qu'un effet qui commence ou finit au milieu
 * d'une attente ne la fasse pas sauter: le temps deja attendu reste acquis.
 */
export function vitesseDeRecharge(effets: DureesRestantes<EffetTactique>): number {
  if (effetQuiAgit(effets, 'rechargeRapide')) {
    return TACTIQUE.RECHARGE_MS / OBJETS_TACTIQUES.RECHARGE_RAPIDE_MS;
  }

  return effetQuiAgit(effets, 'rechargeLente')
    ? TACTIQUE.RECHARGE_MS / OBJETS_TACTIQUES.RECHARGE_LENTE_MS
    : 1;
}

/**
 * Le nombre de charges qu'un joueur peut avoir en main: cinq d'ordinaire, une sous Tir
 * unique. La recharge s'arrete la.
 */
export function chargesMaximum(effets: DureesRestantes<EffetTactique>): number {
  return effetQuiAgit(effets, 'tirUnique')
    ? OBJETS_TACTIQUES.CHARGES_SOUS_TIR_UNIQUE
    : TACTIQUE.CHARGES_MAXIMUM;
}

/**
 * Met de cote les charges que le Tir unique retire de la main, ou les rend quand il cesse
 * d'agir: a sa fin, ou quand une Rafale l'annule.
 *
 * Sous Tir unique, un joueur n'a qu'une charge en main; les autres sont gelees, pas
 * perdues, et reviennent a la fin de l'effet (decision du porteur du projet du
 * 19 septembre 2026). Sans ce gel, un plafond sur les charges utilisables ne limiterait
 * rien: la charge depensee serait aussitot remplacee par une de la reserve.
 */
export function gelerOuRendre(arme: EtatTactiqueDuJoueur): EtatTactiqueDuJoueur {
  const maximum = chargesMaximum(arme.effets);

  if (maximum < TACTIQUE.CHARGES_MAXIMUM) {
    return arme.charges > maximum
      ? {
          ...arme,
          charges: maximum,
          chargesGelees: arme.chargesGelees + arme.charges - maximum,
        }
      : arme;
  }

  return arme.chargesGelees > 0
    ? {
        ...arme,
        charges: Math.min(arme.charges + arme.chargesGelees, TACTIQUE.CHARGES_MAXIMUM),
        chargesGelees: 0,
      }
    : arme;
}

/** Un tir coute-t-il une charge ? Non pendant une Rafale. */
export function tirPayant(arme: EtatTactiqueDuJoueur): boolean {
  return !effetQuiAgit(arme.effets, 'rafale');
}

/** Un joueur peut-il tirer ? S'il lui reste une charge en main, ou pendant une Rafale. */
export function peutTirer(arme: EtatTactiqueDuJoueur): boolean {
  return !tirPayant(arme) || arme.charges > 0;
}
