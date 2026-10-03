/**
 * Les defis de la semaine (etape 3.10): ce qu'ils sont, lesquels valent cette semaine,
 * et ou en est un compte.
 *
 * TROIS DEFIS PAR SEMAINE, LES MEMES POUR TOUS, un par famille: l'assiduite (jouer),
 * l'action (faire) et l'exploit (reussir). Ils se tirent de la semaine seule, par le
 * generateur a graine: aucune table ne les garde, et le serveur comme le client
 * calculent les memes.
 *
 * LA VARIETE, PAR FAMILLES ET PAR CYCLES. Chaque famille a sa reserve. Elle se parcourt
 * dans un ordre mele, tire pour chaque cycle: un defi ne revient pas avant que toute sa
 * famille soit passee, et jamais deux semaines de suite, meme d'un cycle au suivant.
 *
 * UNE SEMAINE va du lundi 0 h au lundi suivant 0 h, heure de Paris, le fuseau des joueurs
 * (celui des jours de « Fidele »). Elle se nomme par la date de son lundi: « 2026-10-05 ».
 *
 * L'AVANCEE EST UN PLI SUR LES PARTIES DE LA SEMAINE, comme le parcours des succes. Une
 * partie compte si on l'a finie et qu'elle durait trois minutes au moins: un abandon ne
 * rapporte rien, et des parties de trente secondes feraient de l'XP sans jouer. Ce que
 * disent les faits de partie (bonus, ralliements, Evades...) ne compte qu'a plusieurs,
 * comme pour les succes (decision du porteur du projet, 28 septembre 2026): seul, une
 * partie privee deviendrait une ferme.
 *
 * UN IDENTIFIANT NE SE REUTILISE JAMAIS. Il est ecrit dans la base a chaque defi releve:
 * le donner a un autre defi changerait ce que les comptes ont accompli.
 *
 * FONCTIONS PURES. Rien ici ne lit l'horloge: le jour de chaque partie arrive avec elle,
 * et la semaine en cours est donnee par le serveur.
 */

import type { Alea } from './alea.js';
import { creerAlea, entier } from './alea.js';
import { JOUEURS_POUR_UNE_VICTOIRE } from './comptes.js';
import type { Mode } from './constantes.js';
import type { FaitDePartie, PartieDuParcours } from './succes.js';
import { JOUEURS_POUR_UN_PODIUM } from './succes.js';

// --------------------------------------------------------------------------
// Les familles et leurs recompenses
// --------------------------------------------------------------------------

/** Les familles de defis, dans l'ordre ou la semaine les montre. */
export const FAMILLES_DE_DEFIS = ['assiduite', 'action', 'exploit'] as const;

/** Une famille de defis. */
export type FamilleDeDefi = (typeof FAMILLES_DE_DEFIS)[number];

/**
 * L'XP que rapporte un defi releve, selon sa famille (etape 3.10): 1 200 XP par semaine
 * au plus, l'equivalent de cinq bonnes parties. Changer un nombre ici change le jeu pour
 * tout le monde: c'est une decision de conception.
 */
export const XP_DES_FAMILLES: Readonly<Record<FamilleDeDefi, number>> = {
  assiduite: 300,
  action: 400,
  exploit: 500,
};

/**
 * La duree reglee a partir de laquelle une partie compte pour les defis: trois minutes,
 * le seuil des points de ligue et la duree par defaut.
 */
export const DUREE_MINIMUM_POUR_LES_DEFIS_S = 180;

// --------------------------------------------------------------------------
// Les definitions
// --------------------------------------------------------------------------

/**
 * Comment un defi compte les parties de la semaine.
 *
 * - somme: chaque partie ajoute sa valeur (« Prendre 15 joueurs »);
 * - record: la meilleure partie compte seule (« Atteindre le multiplicateur x5 »);
 * - distincts: chaque valeur differente compte une fois (« 3 cartes differentes »).
 */
export type ComptageDeDefi =
  | { readonly genre: 'somme'; readonly valeur: (partie: PartieDuParcours) => number }
  | { readonly genre: 'record'; readonly valeur: (partie: PartieDuParcours) => number }
  | {
      readonly genre: 'distincts';
      readonly cle: (partie: PartieDuParcours) => string | undefined;
    };

/** Un defi. */
export interface DefinitionDeDefi {
  /** Stable, en minuscules et tirets. Jamais reutilise. */
  readonly id: string;
  readonly famille: FamilleDeDefi;
  /** Ce qu'il faut faire, en une phrase. */
  readonly texte: string;
  /** Le defi est releve quand son avancee atteint ce nombre. */
  readonly seuil: number;
  readonly comptage: ComptageDeDefi;
}

/** La partie a-t-elle des adversaires. */
function aPlusieurs(partie: PartieDuParcours): boolean {
  return partie.nombreJoueurs >= JOUEURS_POUR_UNE_VICTOIRE;
}

/** Une premiere place dans une partie a plusieurs, comme pour les succes. */
function victoire(partie: PartieDuParcours): boolean {
  return aPlusieurs(partie) && partie.placement === 1;
}

/** Un fait de la partie, s'il a ete releve a plusieurs; zero sinon. */
function fait(partie: PartieDuParcours, nom: FaitDePartie): number {
  return aPlusieurs(partie) ? (partie.faits?.[nom] ?? 0) : 0;
}

/** Une partie de ce mode compte 1. */
function partieDe(mode: Mode): ComptageDeDefi {
  return { genre: 'somme', valeur: (partie) => (partie.mode === mode ? 1 : 0) };
}

/** Une victoire dans ce mode compte 1. */
function victoireEn(mode: Mode): ComptageDeDefi {
  return {
    genre: 'somme',
    valeur: (partie) => (partie.mode === mode && victoire(partie) ? 1 : 0),
  };
}

/** Chaque partie ajoute ce fait. */
function sommeDuFait(nom: FaitDePartie): ComptageDeDefi {
  return { genre: 'somme', valeur: (partie) => fait(partie, nom) };
}

/**
 * Tous les defis, famille par famille. La liste et ses nombres sont ceux de la fiche de
 * l'etape 3.10.
 */
export const DEFIS = [
  // L'assiduite: jouer.
  {
    id: 'jouer-dix-parties',
    famille: 'assiduite',
    texte: 'Finir 10 parties.',
    seuil: 10,
    comptage: { genre: 'somme', valeur: () => 1 },
  },
  {
    id: 'jouer-horde',
    famille: 'assiduite',
    texte: 'Finir 3 parties de Horde.',
    seuil: 3,
    comptage: partieDe('classique'),
  },
  {
    id: 'jouer-tactique',
    famille: 'assiduite',
    texte: 'Finir 3 parties de Tactique.',
    seuil: 3,
    comptage: partieDe('tactique'),
  },
  {
    id: 'jouer-equipes',
    famille: 'assiduite',
    texte: 'Finir 3 parties d’Équipes.',
    seuil: 3,
    comptage: partieDe('equipes'),
  },
  {
    id: 'jouer-chasse',
    famille: 'assiduite',
    texte: 'Finir 3 parties de Chasse.',
    seuil: 3,
    comptage: partieDe('chasse'),
  },
  {
    id: 'jouer-massacre',
    famille: 'assiduite',
    texte: 'Finir 3 parties de Massacre.',
    seuil: 3,
    comptage: partieDe('massacre'),
  },
  {
    id: 'trois-cartes',
    famille: 'assiduite',
    texte: 'Jouer sur 3 cartes différentes.',
    seuil: 3,
    comptage: { genre: 'distincts', cle: (partie) => partie.carte },
  },
  {
    id: 'trois-modes',
    famille: 'assiduite',
    texte: 'Jouer 3 modes différents.',
    seuil: 3,
    comptage: { genre: 'distincts', cle: (partie) => partie.mode },
  },
  {
    id: 'parties-en-miroir',
    famille: 'assiduite',
    texte: 'Finir 3 parties en miroir.',
    seuil: 3,
    comptage: { genre: 'somme', valeur: (partie) => (partie.modeMiroir ? 1 : 0) },
  },
  {
    id: 'parties-entre-amis',
    famille: 'assiduite',
    texte: 'Finir 2 parties avec un ami.',
    seuil: 2,
    comptage: { genre: 'somme', valeur: (partie) => (partie.amis.length > 0 ? 1 : 0) },
  },

  // L'action: faire.
  {
    id: 'prendre-joueurs',
    famille: 'action',
    texte: 'Prendre 15 joueurs.',
    seuil: 15,
    comptage: { genre: 'somme', valeur: (partie) => partie.captures },
  },
  {
    id: 'black-ninjas',
    famille: 'action',
    texte: 'Détruire 10 Black Ninjas.',
    seuil: 10,
    comptage: { genre: 'somme', valeur: (partie) => partie.botsNoirsDetruits },
  },
  {
    id: 'bonus',
    famille: 'action',
    texte: 'Ramasser 15 bonus, à plusieurs.',
    seuil: 15,
    comptage: sommeDuFait('bonusRamasses'),
  },
  {
    id: 'malus',
    famille: 'action',
    texte: 'Ramasser 10 malus, à plusieurs.',
    seuil: 10,
    comptage: sommeDuFait('malusRamasses'),
  },
  {
    id: 'rallier',
    famille: 'action',
    texte: 'Rallier 300 ninjas en Horde, à plusieurs.',
    seuil: 300,
    comptage: sommeDuFait('ninjasRallies'),
  },
  {
    id: 'evades',
    famille: 'action',
    texte: 'Attraper 3 fois l’Évadé, à plusieurs.',
    seuil: 3,
    comptage: sommeDuFait('evadesAttrapes'),
  },
  {
    id: 'doubleurs',
    famille: 'action',
    texte: 'Prendre 2 fois le x2 à son porteur.',
    seuil: 2,
    comptage: sommeDuFait('doubleursVoles'),
  },
  {
    id: 'revanches',
    famille: 'action',
    texte: 'Prendre 3 revanches : reprendre qui vient de vous prendre.',
    seuil: 3,
    comptage: sommeDuFait('revanches'),
  },

  // L'exploit: reussir.
  {
    id: 'victoires',
    famille: 'exploit',
    texte: 'Gagner 3 parties à plusieurs.',
    seuil: 3,
    comptage: { genre: 'somme', valeur: (partie) => (victoire(partie) ? 1 : 0) },
  },
  {
    id: 'podiums',
    famille: 'exploit',
    texte: `Finir 3 fois sur le podium d’une partie à ${String(JOUEURS_POUR_UN_PODIUM)} joueurs ou plus.`,
    seuil: 3,
    comptage: {
      genre: 'somme',
      valeur: (partie) =>
        partie.nombreJoueurs >= JOUEURS_POUR_UN_PODIUM && partie.placement <= 3 ? 1 : 0,
    },
  },
  {
    id: 'gagner-horde',
    famille: 'exploit',
    texte: 'Gagner une partie de Horde à plusieurs.',
    seuil: 1,
    comptage: victoireEn('classique'),
  },
  {
    id: 'gagner-tactique',
    famille: 'exploit',
    texte: 'Gagner une partie de Tactique à plusieurs.',
    seuil: 1,
    comptage: victoireEn('tactique'),
  },
  {
    id: 'gagner-equipes',
    famille: 'exploit',
    texte: 'Gagner une partie d’Équipes.',
    seuil: 1,
    comptage: victoireEn('equipes'),
  },
  {
    id: 'gagner-chasse',
    famille: 'exploit',
    texte: 'Gagner une partie de Chasse.',
    seuil: 1,
    comptage: victoireEn('chasse'),
  },
  {
    id: 'gagner-massacre',
    famille: 'exploit',
    texte: 'Gagner une partie de Massacre à plusieurs.',
    seuil: 1,
    comptage: victoireEn('massacre'),
  },
  {
    id: 'multiplicateur',
    famille: 'exploit',
    texte: 'Atteindre le multiplicateur x5, à plusieurs.',
    seuil: 5,
    comptage: { genre: 'record', valeur: (partie) => fait(partie, 'meilleurMultiplicateur') },
  },
  {
    id: 'razzia',
    famille: 'exploit',
    texte: 'Récupérer 20 ninjas d’une seule capture, à plusieurs.',
    seuil: 20,
    comptage: { genre: 'record', valeur: (partie) => fait(partie, 'meilleureRazzia') },
  },
  {
    id: 'points-de-ligue',
    famille: 'exploit',
    texte: 'Gagner 40 points de ligue.',
    seuil: 40,
    comptage: {
      genre: 'somme',
      valeur: (partie) => Math.max(partie.variationPointsLigue, 0),
    },
  },
] as const satisfies readonly DefinitionDeDefi[];

/** L'identifiant d'un defi connu. */
export type IdentifiantDefi = (typeof DEFIS)[number]['id'];

/** Les defis, par identifiant. */
const DEFIS_PAR_ID: ReadonlyMap<string, DefinitionDeDefi> = new Map(
  DEFIS.map((defi) => [defi.id, defi]),
);

/**
 * Cet identifiant est-il celui d'un defi connu. Ce que la base rend peut nommer un defi
 * retire depuis: il s'ignore.
 */
export function estUnDefi(id: string): id is IdentifiantDefi {
  return DEFIS_PAR_ID.has(id);
}

/** La definition d'un defi connu. */
export function definitionDuDefi(id: IdentifiantDefi): DefinitionDeDefi {
  const defi = DEFIS_PAR_ID.get(id);

  if (defi === undefined) {
    throw new Error(`Defi inconnu: ${id}.`);
  }

  return defi;
}

// --------------------------------------------------------------------------
// La semaine
// --------------------------------------------------------------------------

/** Un jour, en millisecondes. */
const JOUR_MS = 86_400_000;

/** Le lundi de reference des cycles: le 1er janvier 2024 etait un lundi. */
const LUNDI_DE_REFERENCE_MS = Date.UTC(2024, 0, 1);

/** Une date de calendrier: « 2026-10-05 ». */
const FORME_D_UN_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Le jour de calendrier, en millisecondes depuis l'origine, a minuit en temps universel. */
function jourEnMs(jour: string): number {
  const morceaux = FORME_D_UN_JOUR.exec(jour);

  if (morceaux === null) {
    throw new Error(`Un jour s'ecrit AAAA-MM-JJ, recu « ${jour} ».`);
  }

  const [, annee, mois, quantieme] = morceaux;
  const ms = Date.UTC(Number(annee), Number(mois) - 1, Number(quantieme));

  // Un 31 fevrier deviendrait un 3 mars sans le dire.
  if (new Date(ms).toISOString().slice(0, 10) !== jour) {
    throw new Error(`Ce jour n'existe pas: « ${jour} ».`);
  }

  return ms;
}

/**
 * La semaine d'un jour: la date de son lundi.
 *
 * Calcul de calendrier seulement: le jour arrive deja a l'heure de Paris.
 */
export function semaineDuJour(jour: string): string {
  const ms = jourEnMs(jour);
  // getUTCDay rend 0 le dimanche: le lundi est six jours avant un dimanche.
  const depuisLundi = (new Date(ms).getUTCDay() + 6) % 7;

  return new Date(ms - depuisLundi * JOUR_MS).toISOString().slice(0, 10);
}

/** Le lundi de la semaine suivante: « 2026-10-12 » pour « 2026-10-05 ». */
export function semaineSuivante(semaine: string): string {
  return new Date(jourEnMs(semaineDuJour(semaine)) + 7 * JOUR_MS).toISOString().slice(0, 10);
}

/** Le rang d'une semaine depuis le lundi de reference, negatif avant lui. */
function rangDeLaSemaine(semaine: string): number {
  return Math.round((jourEnMs(semaineDuJour(semaine)) - LUNDI_DE_REFERENCE_MS) / (7 * JOUR_MS));
}

// --------------------------------------------------------------------------
// Le tirage
// --------------------------------------------------------------------------

/** Les defis d'une famille, dans l'ordre de DEFIS. */
function reserveDe(famille: FamilleDeDefi): readonly IdentifiantDefi[] {
  return DEFIS.filter((defi) => defi.famille === famille).map((defi) => defi.id);
}

/** La graine du melange d'une famille pour un cycle. */
function graineDuCycle(famille: FamilleDeDefi, cycle: number): number {
  return (FAMILLES_DE_DEFIS.indexOf(famille) + 1) * 1_000_003 + cycle * 7919;
}

/** Melange une liste, par Fisher et Yates, avec le generateur a graine. */
function melanger<T>(elements: readonly T[], graine: number): T[] {
  const melange = [...elements];
  let alea: Alea = creerAlea(graine);

  for (let i = melange.length - 1; i > 0; i -= 1) {
    const tirage = entier(alea, i + 1);
    const j = tirage.valeur;
    alea = tirage.alea;
    [melange[i], melange[j]] = [melange[j] as T, melange[i] as T];
  }

  return melange;
}

/**
 * L'ordre d'une famille pendant un cycle.
 *
 * Le premier defi d'un cycle ne peut pas etre le dernier du precedent: s'il l'est, il
 * echange sa place avec le deuxieme. Le dernier d'un cycle, lui, ne bouge jamais tant
 * que la famille a trois defis ou plus: la regle n'a pas a remonter les cycles.
 */
function ordreDuCycle(famille: FamilleDeDefi, cycle: number): IdentifiantDefi[] {
  const reserve = reserveDe(famille);
  const ordre = melanger(reserve, graineDuCycle(famille, cycle));
  const precedent = melanger(reserve, graineDuCycle(famille, cycle - 1));

  if (ordre[0] === precedent[precedent.length - 1]) {
    [ordre[0], ordre[1]] = [ordre[1] as IdentifiantDefi, ordre[0] as IdentifiantDefi];
  }

  return ordre;
}

/** Le defi d'une famille pour une semaine. */
function defiDeLaFamille(famille: FamilleDeDefi, rang: number): IdentifiantDefi {
  const taille = reserveDe(famille).length;
  const cycle = Math.floor(rang / taille);
  // Le rang dans le cycle va de zero a la taille exclue: le defi existe toujours.
  return ordreDuCycle(famille, cycle)[rang - cycle * taille] as IdentifiantDefi;
}

/** Les trois defis d'une semaine, dans l'ordre des familles. */
export function defisDeLaSemaine(semaine: string): readonly IdentifiantDefi[] {
  const rang = rangDeLaSemaine(semaine);

  return FAMILLES_DE_DEFIS.map((famille) => defiDeLaFamille(famille, rang));
}

// --------------------------------------------------------------------------
// L'avancee
// --------------------------------------------------------------------------

/**
 * La partie compte-t-elle pour les defis: finie (un abandon ne rapporte aucune XP) et
 * reglee sur trois minutes au moins.
 */
export function compteePourLesDefis(partie: PartieDuParcours): boolean {
  return partie.xpGagnee > 0 && partie.dureeS >= DUREE_MINIMUM_POUR_LES_DEFIS_S;
}

/** L'avancee brute d'un defi sur ces parties, sans plafond. */
export function avanceeDuDefi(
  defi: DefinitionDeDefi,
  parties: readonly PartieDuParcours[],
): number {
  const comptees = parties.filter(compteePourLesDefis);
  const comptage = defi.comptage;

  switch (comptage.genre) {
    case 'somme':
      return comptees.reduce((total, partie) => total + comptage.valeur(partie), 0);
    case 'record':
      return comptees.reduce((record, partie) => Math.max(record, comptage.valeur(partie)), 0);
    case 'distincts':
      return new Set(
        comptees.flatMap((partie) => {
          const cle = comptage.cle(partie);
          return cle === undefined ? [] : [cle];
        }),
      ).size;
  }
}

/** Ou en est un compte d'un defi de la semaine. */
export interface AvancementDUnDefi {
  readonly id: IdentifiantDefi;
  /** L'avancee, au plus le seuil. */
  readonly actuel: number;
  readonly seuil: number;
  /** L'XP versee s'il est releve, celle qu'il rapportera sinon. */
  readonly xp: number;
  /** Le defi est releve et sa recompense versee. */
  readonly accompli: boolean;
}

/**
 * Ou en est un compte des defis d'une semaine.
 *
 * @param parties Les parties du compte terminees dans cette semaine.
 * @param releves L'XP versee pour chaque defi deja releve cette semaine. C'est elle qui
 *                fait foi: un defi releve le reste, quoi que dise le pli.
 */
export function avancementsDeLaSemaine(
  semaine: string,
  parties: readonly PartieDuParcours[],
  releves: ReadonlyMap<string, number>,
): AvancementDUnDefi[] {
  return defisDeLaSemaine(semaine).map((id) => {
    const defi = definitionDuDefi(id);
    const verse = releves.get(id);

    return {
      id,
      actuel: verse === undefined ? Math.min(avanceeDuDefi(defi, parties), defi.seuil) : defi.seuil,
      seuil: defi.seuil,
      xp: verse ?? XP_DES_FAMILLES[defi.famille],
      accompli: verse !== undefined,
    };
  });
}

/** Les defis de la semaine en cours, tels que l'accueil d'un compte les montre. */
export interface DefisDeLaSemaine {
  /** Le lundi de la semaine: « 2026-10-05 ». */
  readonly semaine: string;
  /** La fin de la semaine, lundi suivant 0 h a Paris, au format ISO 8601. */
  readonly finLe: string;
  /** Dans l'ordre des familles. */
  readonly defis: readonly AvancementDUnDefi[];
}

/** Un defi releve par une partie, et l'XP qu'il a versee. */
export interface DefiReleve {
  readonly id: IdentifiantDefi;
  readonly xp: number;
}

/**
 * Ce que la fin d'une partie dit des defis d'un compte (etape 3.10).
 *
 * UNE PARTIE N'ANNONCE QUE LES DEFIS QU'ELLE A RELEVES, comme les succes: un reessai
 * d'enregistrement annonce donc les memes.
 */
export interface DefisDeFin {
  /** Dans l'ordre des familles. */
  readonly releves: readonly DefiReleve[];
  /** Les defis de la semaine de la partie, apres elle. */
  readonly defis: readonly AvancementDUnDefi[];
}
