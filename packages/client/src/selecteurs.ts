/**
 * Les selecteurs: les questions que l'affichage pose a l'etat.
 *
 * POURQUOI DES FONCTIONS PLUTOT QUE DES CHAMPS. Tout ce qui se DEDUIT de l'etat
 * n'a pas a y etre range: le ranger obligerait a le recalculer a chaque action et
 * a le tenir d'accord avec le reste, ce qui est exactement le mecanisme par
 * lequel le score du client d'origine finissait par se contredire d'un endroit a
 * l'autre. Une deduction se calcule au moment ou on l'affiche.
 *
 * Elles sont pures et sans etat: on leur donne l'etat, elles repondent.
 */

import type { EffetTactique, JoueurDuSalon, LigneClassement, TypeBonus } from '@neon-ninja/shared';
import { EFFETS_TACTIQUES, TYPES_BONUS } from '@neon-ninja/shared';

import type { EffetActif, EtatClient } from './etat.js';
import type { VuePartie } from './reconstruction.js';
import { entiteDe } from './reconstruction.js';

/** Sommes-nous l'hote de la partie, celui qui regle, lance et suspend. */
export function jeSuisHote(etat: EtatClient): boolean {
  return moiDansLeSalon(etat)?.hote === true;
}

/** Notre place dans le salon, avec le pseudo que le serveur a retenu. */
export function moiDansLeSalon(etat: EtatClient): JoueurDuSalon | undefined {
  return etat.salon?.joueurs.find((joueur) => joueur.id === etat.moi);
}

/**
 * Notre entite dans la partie: celle qu'il faut suivre du regard.
 *
 * C'est de cette reponse que le rendu de l'etape 4.2 tirera le centre de sa
 * camera. Absente tant que la partie n'a pas commence.
 */
export function moiDansLaPartie(etat: EtatClient): ReturnType<typeof entiteDe> {
  return etat.moi === undefined ? undefined : entiteDe(etat.partie, etat.moi);
}

/** Notre ligne de classement, celle que l'affichage met en avant. */
export function maLigneDeClassement(etat: EtatClient): LigneClassement | undefined {
  const classement = etat.fin?.classement ?? etat.partie?.classement ?? [];

  return classement.find((ligne) => ligne.id === etat.moi);
}

/**
 * Les effets encore en cours a cet instant.
 *
 * Le magasin ne fait le menage qu'a l'arrivee d'un nouvel effet: entre deux, un
 * effet peut avoir expire sans que rien ne soit arrive pour le constater. C'est
 * l'affichage qui pose la question, a chaque image, et qui obtient donc toujours
 * une reponse juste.
 *
 * @param maintenant Instant local, lu sur l'horloge du client.
 */
export function effetsEnCours(etat: EtatClient, maintenant: number): readonly EffetActif[] {
  return etat.effets.filter((effet) => effet.finPrevueA > maintenant);
}

/**
 * Les bonus du jeu d'origine en cours sur nous: ceux qui ont un halo et un son en boucle.
 * Les bonus du Tactique (etape 7.7) n'en ont pas: ils se lisent sur les charges.
 */
export function bonusDOrigineEnCours(etat: EtatClient, maintenant: number): readonly TypeBonus[] {
  return effetsEnCours(etat, maintenant)
    .map((effet) => effet.nature)
    .filter((nature): nature is TypeBonus => (TYPES_BONUS as readonly string[]).includes(nature));
}

/** Les effets du Tactique en cours sur nous, et ce qu'il reste de chacun (etape 7.7). */
export function effetsTactiquesSurMoi(
  etat: EtatClient,
  maintenant: number,
): Readonly<Record<EffetTactique, number>> {
  const restes: Record<EffetTactique, number> = {
    rafale: 0,
    rechargeRapide: 0,
    viseeLarge: 0,
    tirUnique: 0,
    rechargeLente: 0,
    viseeEtroite: 0,
  };

  for (const effet of effetsEnCours(etat, maintenant)) {
    if (effet.surMoi && (EFFETS_TACTIQUES as readonly string[]).includes(effet.nature)) {
      restes[effet.nature as EffetTactique] = resteDeLEffet(effet, maintenant);
    }
  }

  return restes;
}

/**
 * Le filtre que nos malus posent sur le terrain: flou sous Vision floue, gris sous Vision
 * negative, comme le jeu d'origine (applyBlurEffect et applyNegativeEffect,
 * legacy/client.js:3430). Seul le terrain est touche, le HUD reste net. Un malus que nous
 * avons ramasse frappe les autres: il ne touche pas notre ecran.
 */
export function filtreDesMalus(etat: EtatClient, maintenant: number): string {
  const subis = new Set(
    effetsEnCours(etat, maintenant)
      .filter((effet) => effet.categorie === 'malus' && effet.surMoi)
      .map((effet) => effet.nature),
  );
  const filtres = [
    ...(subis.has('flou') ? [FILTRES_DES_MALUS.flou] : []),
    ...(subis.has('negatif') ? [FILTRES_DES_MALUS.negatif] : []),
  ];

  return filtres.length === 0 ? 'none' : filtres.join(' ');
}

/** Les filtres CSS de Vision floue et de Vision negative, valeurs du jeu d'origine. */
export const FILTRES_DES_MALUS = {
  flou: 'blur(8px)',
  negatif: 'grayscale(100%)',
} as const;

/** Ce qu'il reste d'un effet, en millisecondes. Zero s'il est fini. */
export function resteDeLEffet(effet: EffetActif, maintenant: number): number {
  return Math.max(effet.finPrevueA - maintenant, 0);
}

/** La partie tourne-t-elle vraiment, c'est-a-dire ni finie ni suspendue. */
export function partieEnMouvement(etat: EtatClient): boolean {
  const partie: VuePartie | undefined = etat.partie;

  return etat.ecran === 'jeu' && partie !== undefined && !partie.enPause;
}
