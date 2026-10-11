/**
 * Les sept gestes des taches courtes d'Among Ninjas (etape 7.21) et les quatre mini-jeux des
 * taches longues (etape 7.24), reunis: un etat par nature, et de quoi creer, faire avancer et
 * juger n'importe lequel. Leurs noms et leurs aides aussi, tels que la fenetre de la tache les
 * ecrit.
 */

import type { NatureDeTache } from '@neon-ninja/shared';

import type { EtatBataille } from './bataille.js';
import {
  appliquerBataille,
  avancementDeLaBataille,
  batailleFinie,
  creerBataille,
} from './bataille.js';
import type { EtatCaisses } from './caisses.js';
import { appliquerCaisses, avancementDesCaisses, caissesFinies, creerCaisses } from './caisses.js';
import type { AvancementDuGeste, CommandeDeGeste } from './commun.js';
import type { EtatCouleurs } from './couleurs.js';
import {
  appliquerCouleurs,
  avancementDesCouleurs,
  couleursFinies,
  creerCouleurs,
} from './couleurs.js';
import type { EtatEnvahisseurs } from './envahisseurs.js';
import {
  appliquerEnvahisseurs,
  avancementDesEnvahisseurs,
  creerEnvahisseurs,
  envahisseursFinis,
} from './envahisseurs.js';
import type { EtatFumee } from './fumee.js';
import { appliquerFumee, avancementDeLaFumee, creerFumee, fumeeFinie } from './fumee.js';
import type { EtatKatana } from './katana.js';
import { appliquerKatana, avancementDuKatana, creerKatana, katanaFini } from './katana.js';
import type { EtatLunettes } from './lunettes.js';
import {
  appliquerLunettes,
  avancementDesLunettes,
  creerLunettes,
  lunettesFinies,
} from './lunettes.js';
import type { EtatMines } from './mines.js';
import { appliquerMines, avancementDesMines, creerMines, minesFinies } from './mines.js';
import type { EtatMunitions } from './munitions.js';
import {
  appliquerMunitions,
  avancementDesMunitions,
  creerMunitions,
  munitionsFinies,
} from './munitions.js';
import type { EtatSang } from './sang.js';
import { appliquerSang, avancementDuSang, creerSang, sangFini } from './sang.js';
import type { EtatSerpent } from './serpent.js';
import { appliquerSerpent, avancementDuSerpent, creerSerpent, serpentFini } from './serpent.js';

export type { AvancementDuGeste, CommandeDeGeste, EchoDeGeste, ToucheDeGeste } from './commun.js';
export { HAUTEUR_DU_GESTE, LARGEUR_DU_GESTE } from './commun.js';

/** Un geste ou un mini-jeu en cours, quelle que soit sa nature. */
export type EtatDeGeste =
  | EtatKatana
  | EtatLunettes
  | EtatSang
  | EtatCouleurs
  | EtatMines
  | EtatMunitions
  | EtatFumee
  | EtatCaisses
  | EtatSerpent
  | EtatEnvahisseurs
  | EtatBataille;

/** Le nom d'une tache, tel que la fenetre et la carte l'ecrivent. */
export const TITRES_DES_TACHES: Readonly<Record<NatureDeTache, string>> = {
  katana: 'Aiguiser un katana',
  lunettes: 'Nettoyer les lunettes',
  sang: 'Nettoyer du sang',
  couleurs: 'Relier des couleurs',
  mines: 'Ranger des mines',
  munitions: 'Recharger des munitions',
  fumee: 'Remplir de fumée',
  caisses: 'Empiler des caisses',
  serpent: 'Nourrir le serpent',
  envahisseurs: 'Repousser les Black Ninjas',
  bataille: 'Bataille navale',
};

/** Ce que la fenetre dit de faire: au pointeur, et au clavier. */
export const AIDES_DES_TACHES: Readonly<
  Record<NatureDeTache, { readonly pointeur: string; readonly clavier: string }>
> = {
  katana: {
    pointeur: 'Glissez la lame de la garde à la pointe',
    clavier: 'Clavier : flèche droite',
  },
  lunettes: { pointeur: 'Frottez les deux verres', clavier: 'Clavier : flèches, Espace tenu' },
  sang: { pointeur: 'Frottez les trois taches', clavier: 'Clavier : flèches, Espace tenu' },
  couleurs: {
    pointeur: 'Reliez chaque couleur à son nom',
    clavier: 'Clavier : flèches, Espace',
  },
  mines: { pointeur: 'Rangez les mines dans la mallette', clavier: 'Clavier : flèches, Espace' },
  munitions: { pointeur: 'Glissez les cartouches dans le fusil', clavier: 'Clavier : Espace' },
  fumee: { pointeur: 'Maintenez, relâchez dans la bande', clavier: 'Clavier : Espace tenu' },
  caisses: { pointeur: 'Complétez deux lignes', clavier: 'Clavier : flèches' },
  serpent: { pointeur: 'Glissez pour tourner, mangez cinq fruits', clavier: 'Clavier : flèches' },
  envahisseurs: {
    pointeur: 'Votre ninja suit le pointeur et lance seul',
    clavier: 'Clavier : gauche, droite',
  },
  bataille: { pointeur: 'Coulez les deux bateaux', clavier: 'Clavier : flèches, Espace' },
};

/** Un geste neuf de cette nature, tire de cette graine. */
export function creerGeste(nature: NatureDeTache, graine: number): EtatDeGeste {
  switch (nature) {
    case 'katana':
      return creerKatana();
    case 'lunettes':
      return creerLunettes(graine);
    case 'sang':
      return creerSang(graine);
    case 'couleurs':
      return creerCouleurs(graine);
    case 'mines':
      return creerMines();
    case 'munitions':
      return creerMunitions();
    case 'fumee':
      return creerFumee();
    case 'caisses':
      return creerCaisses(graine);
    case 'serpent':
      return creerSerpent(graine);
    case 'envahisseurs':
      return creerEnvahisseurs();
    case 'bataille':
      return creerBataille(graine);
  }
}

/** Le geste apres une commande, a cet instant local. */
export function appliquerGeste(
  etat: EtatDeGeste,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatDeGeste {
  switch (etat.nature) {
    case 'katana':
      return appliquerKatana(etat, commande, maintenant);
    case 'lunettes':
      return appliquerLunettes(etat, commande, maintenant);
    case 'sang':
      return appliquerSang(etat, commande, maintenant);
    case 'couleurs':
      return appliquerCouleurs(etat, commande, maintenant);
    case 'mines':
      return appliquerMines(etat, commande, maintenant);
    case 'munitions':
      return appliquerMunitions(etat, commande, maintenant);
    case 'fumee':
      return appliquerFumee(etat, commande, maintenant);
    case 'caisses':
      return appliquerCaisses(etat, commande, maintenant);
    case 'serpent':
      return appliquerSerpent(etat, commande, maintenant);
    case 'envahisseurs':
      return appliquerEnvahisseurs(etat, commande, maintenant);
    case 'bataille':
      return appliquerBataille(etat, commande, maintenant);
  }
}

/** Le geste est-il fini, sa derniere animation jouee. */
export function gesteFini(etat: EtatDeGeste, maintenant: number): boolean {
  switch (etat.nature) {
    case 'katana':
      return katanaFini(etat, maintenant);
    case 'lunettes':
      return lunettesFinies(etat);
    case 'sang':
      return sangFini(etat);
    case 'couleurs':
      return couleursFinies(etat, maintenant);
    case 'mines':
      return minesFinies(etat, maintenant);
    case 'munitions':
      return munitionsFinies(etat, maintenant);
    case 'fumee':
      return fumeeFinie(etat);
    case 'caisses':
      return caissesFinies(etat, maintenant);
    case 'serpent':
      return serpentFini(etat);
    case 'envahisseurs':
      return envahisseursFinis(etat);
    case 'bataille':
      return batailleFinie(etat, maintenant);
  }
}

/** Ou en est le geste: « 3 sur 5 ». */
export function avancementDuGeste(etat: EtatDeGeste): AvancementDuGeste {
  switch (etat.nature) {
    case 'katana':
      return avancementDuKatana(etat);
    case 'lunettes':
      return avancementDesLunettes(etat);
    case 'sang':
      return avancementDuSang(etat);
    case 'couleurs':
      return avancementDesCouleurs(etat);
    case 'mines':
      return avancementDesMines(etat);
    case 'munitions':
      return avancementDesMunitions(etat);
    case 'fumee':
      return avancementDeLaFumee(etat);
    case 'caisses':
      return avancementDesCaisses(etat);
    case 'serpent':
      return avancementDuSerpent(etat);
    case 'envahisseurs':
      return avancementDesEnvahisseurs(etat);
    case 'bataille':
      return avancementDeLaBataille(etat);
  }
}

/**
 * La graine d'un geste: le meme joueur, a la meme station, pour la meme tache, voit le meme
 * dessin d'une ouverture a l'autre. Un hachage simple des trois, sans rien de secret: ce n'est
 * que le dessin.
 */
export function graineDuGeste(joueur: string, station: string, nature: NatureDeTache): number {
  let graine = 2166136261;

  for (const caractere of `${joueur}|${station}|${nature}`) {
    graine = Math.imul(graine ^ (caractere.codePointAt(0) ?? 0), 16777619) >>> 0;
  }

  return graine;
}
