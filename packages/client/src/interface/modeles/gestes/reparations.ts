/**
 * Les gestes des reparations d'Among Ninjas (etape 7.27, fiche docs/plan/etape-7-27.md): les
 * trois facons de reparer la panne de neons (relancer le generateur, changer les fusibles,
 * accorder la frequence), la purge d'une console des deux cles, et un interrupteur du relais.
 * Un etat par geste, et de quoi creer, faire avancer et juger n'importe lequel; leurs noms et
 * leurs aides aussi, tels que la fenetre de la reparation les ecrit.
 *
 * Ils suivent les regles des gestes des taches (commun.ts): un modele pur, qui recoit des
 * commandes avec l'instant local, dans un espace de 400 sur 300 unites, et regle son rythme pour
 * qu'un joueur rapide et honnete finisse juste au-dessus de la duree minimale que le serveur
 * exige (DUREES_MINIMALES_DES_REPARATIONS_MS). Ils recoivent en plus la molette, que le cadran
 * de la frequence ecoute.
 */

import type { GesteDeReparation, PosteDeReparation } from '@neon-ninja/shared';

import type { AvancementDuGeste } from './commun.js';
import type { CommandeDeReparation } from './communDesReparations.js';
import type { EtatFrequence } from './frequence.js';
import {
  appliquerFrequence,
  avancementDeLaFrequence,
  creerFrequence,
  frequenceAccordee,
} from './frequence.js';
import type { EtatFusibles } from './fusibles.js';
import {
  appliquerFusibles,
  avancementDesFusibles,
  creerFusibles,
  fusiblesChanges,
} from './fusibles.js';
import type { EtatInterrupteur } from './interrupteur.js';
import {
  appliquerInterrupteur,
  avancementDeLInterrupteur,
  creerInterrupteur,
  interrupteurCoupe,
} from './interrupteur.js';
import type { EtatLanceur } from './lanceur.js';
import { appliquerLanceur, avancementDuLanceur, creerLanceur, lanceurFini } from './lanceur.js';
import type { EtatPurge } from './purge.js';
import { appliquerPurge, avancementDeLaPurge, creerPurge, purgeFinie } from './purge.js';

export type {
  BaseDeReparation,
  CommandeDeReparation,
  EchoDeReparation,
} from './communDesReparations.js';

/** Un geste de reparation en cours, quel qu'il soit. */
export type EtatDeReparation =
  EtatLanceur | EtatFusibles | EtatFrequence | EtatPurge | EtatInterrupteur;

/** Le nom d'un geste de reparation, tel que la fenetre l'ecrit. */
export const TITRES_DES_REPARATIONS: Readonly<Record<GesteDeReparation, string>> = {
  lanceur: 'Relancer le générateur',
  fusibles: 'Changer les fusibles',
  frequence: 'Accorder la fréquence',
  purge: 'Purger la console',
  interrupteur: 'Couper l’interrupteur',
};

/** Ce que la fenetre dit de faire: au pointeur, et au clavier. */
export const AIDES_DES_REPARATIONS: Readonly<
  Record<GesteDeReparation, { readonly pointeur: string; readonly clavier: string }>
> = {
  lanceur: {
    pointeur:
      'Tirez le lanceur, lâchez dans le vert, puis remontez les disjoncteurs qui clignotent',
    clavier: 'Clavier : Espace tenu, puis flèche haut',
  },
  fusibles: {
    pointeur: 'Touchez les fusibles grillés, puis abaissez le levier',
    clavier: 'Clavier : flèches, Espace, puis flèche bas',
  },
  frequence: {
    pointeur: 'Tournez le cadran, molette ou doigt en rond, et tenez la courbe sur la cible',
    clavier: 'Clavier : gauche, droite',
  },
  purge: {
    pointeur: 'Touchez la vanne quand la pression est dans la bande',
    clavier: 'Clavier : Espace',
  },
  interrupteur: {
    pointeur: 'Abaissez la manette jusqu’au déclic',
    clavier: 'Clavier : flèche bas tenue',
  },
};

/** Un geste de reparation neuf, tire de cette graine. */
export function creerReparation(geste: GesteDeReparation, graine: number): EtatDeReparation {
  switch (geste) {
    case 'lanceur':
      return creerLanceur(graine);
    case 'fusibles':
      return creerFusibles(graine);
    case 'frequence':
      return creerFrequence(graine);
    case 'purge':
      return creerPurge();
    case 'interrupteur':
      return creerInterrupteur();
  }
}

/** Le geste apres une commande, a cet instant local. */
export function appliquerReparation(
  etat: EtatDeReparation,
  commande: CommandeDeReparation,
  maintenant: number,
): EtatDeReparation {
  switch (etat.nature) {
    case 'lanceur':
      return appliquerLanceur(etat, commande, maintenant);
    case 'fusibles':
      return appliquerFusibles(etat, commande, maintenant);
    case 'frequence':
      return appliquerFrequence(etat, commande, maintenant);
    case 'purge':
      return appliquerPurge(etat, commande, maintenant);
    case 'interrupteur':
      return appliquerInterrupteur(etat, commande, maintenant);
  }
}

/** Le geste est-il fini, sa derniere animation jouee. */
export function reparationFinie(etat: EtatDeReparation, maintenant: number): boolean {
  switch (etat.nature) {
    case 'lanceur':
      return lanceurFini(etat, maintenant);
    case 'fusibles':
      return fusiblesChanges(etat, maintenant);
    case 'frequence':
      return frequenceAccordee(etat);
    case 'purge':
      return purgeFinie(etat, maintenant);
    case 'interrupteur':
      return interrupteurCoupe(etat);
  }
}

/** Ou en est le geste: « 2 sur 4 ». */
export function avancementDeLaReparation(etat: EtatDeReparation): AvancementDuGeste {
  switch (etat.nature) {
    case 'lanceur':
      return avancementDuLanceur(etat);
    case 'fusibles':
      return avancementDesFusibles(etat);
    case 'frequence':
      return avancementDeLaFrequence(etat);
    case 'purge':
      return avancementDeLaPurge(etat);
    case 'interrupteur':
      return avancementDeLInterrupteur(etat);
  }
}

/**
 * La graine d'un geste de reparation: le meme joueur, au meme poste, pour le meme geste, voit le
 * meme dessin d'une ouverture a l'autre. Un hachage simple, comme celui des taches.
 */
export function graineDeLaReparation(
  joueur: string,
  poste: PosteDeReparation,
  geste: GesteDeReparation,
): number {
  let graine = 2166136261;

  for (const caractere of `${joueur}|${String(poste)}|${geste}`) {
    graine = Math.imul(graine ^ (caractere.codePointAt(0) ?? 0), 16777619) >>> 0;
  }

  return graine;
}
