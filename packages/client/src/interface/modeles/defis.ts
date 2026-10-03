/**
 * Les defis de la semaine, tels que l'accueil et la fin de partie les montrent (etape
 * 3.10).
 *
 * LES REGLES NE SONT PAS ICI. Les defis de la semaine, leur avancee et leur recompense
 * viennent du serveur, qui les calcule par le paquet partage: le client met en forme.
 * Leur texte vient du paquet partage, avec leur definition.
 *
 * FONCTIONS PURES. L'heure du moment est donnee: le temps restant se calcule sans lire
 * l'horloge, et se teste a la minute pres.
 */

import type {
  AvancementDUnDefi,
  DefiReleve,
  DefisDeLaSemaine,
  FamilleDeDefi,
} from '@neon-ninja/shared';
import { definitionDuDefi } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import type { Glyphe } from '../icones.js';
import { formaterNombre } from './progression.js';

/** Le nom de chaque famille de defis, tel que le joueur le lit. */
export const NOMS_DES_FAMILLES: Readonly<Record<FamilleDeDefi, string>> = {
  assiduite: 'Assiduité',
  action: 'Action',
  exploit: 'Exploit',
};

/** L'icone de chaque famille: jouer, viser, gagner. */
export const ICONES_DES_FAMILLES: Readonly<Record<FamilleDeDefi, Glyphe>> = {
  assiduite: 'play',
  action: 'target',
  exploit: 'trophy',
};

/** Un defi de la semaine, mis en forme. */
export interface DefiAffiche {
  readonly id: string;
  readonly famille: FamilleDeDefi;
  readonly nomDeFamille: string;
  readonly icone: Glyphe;
  /** « Prendre 15 joueurs. » */
  readonly texte: string;
  /** « +400 XP ». */
  readonly xp: string;
  /** « 11 / 15 », ou « Relevé » une fois la recompense versee. */
  readonly avancee: string;
  /** Le remplissage de la jauge, de 0 a 100. */
  readonly pourCent: number;
  readonly accompli: boolean;
}

/** Ce que l'accueil montre des defis de la semaine. */
export interface ModeleDefisDeLaSemaine {
  /** Dans l'ordre des familles. */
  readonly defis: readonly DefiAffiche[];
  /** « Nouveaux défis dans 3 j 14 h ». */
  readonly renouvellement: string;
  /** « 1 défi relevé sur 3 », pour un lecteur d'ecran et le coup d'oeil. */
  readonly bilan: string;
}

/** Une minute, une heure et un jour, en millisecondes. */
const MINUTE_MS = 60_000;
const HEURE_MS = 60 * MINUTE_MS;
const JOUR_MS = 24 * HEURE_MS;

/** Un defi de la semaine, mis en forme. */
export function defiAffiche(avancement: AvancementDUnDefi): DefiAffiche {
  const defi = definitionDuDefi(avancement.id);

  return {
    id: avancement.id,
    famille: defi.famille,
    nomDeFamille: NOMS_DES_FAMILLES[defi.famille],
    icone: ICONES_DES_FAMILLES[defi.famille],
    texte: defi.texte,
    xp: `+${formaterNombre(avancement.xp)} XP`,
    avancee: avancement.accompli
      ? 'Relevé'
      : `${formaterNombre(avancement.actuel)} / ${formaterNombre(avancement.seuil)}`,
    pourCent: avancement.accompli
      ? 100
      : Math.min(100, Math.floor((avancement.actuel * 100) / avancement.seuil)),
    accompli: avancement.accompli,
  };
}

/**
 * Le temps qui reste avant les defis suivants: « Nouveaux défis dans 3 j 14 h », « dans
 * 5 h 12 min », « dans 12 min ». Les minutes s'arrondissent au-dessus: il ne reste
 * jamais « 0 min ».
 */
export function phraseDuRenouvellement(finLe: string, maintenantMs: number): string {
  const resteMs = Date.parse(finLe) - maintenantMs;

  if (!(resteMs > 0)) {
    return 'Nouveaux défis disponibles';
  }

  const minutes = Math.ceil(resteMs / MINUTE_MS);
  const jours = Math.floor(minutes / (JOUR_MS / MINUTE_MS));
  const heures = Math.floor((minutes % (JOUR_MS / MINUTE_MS)) / 60);
  const resteMinutes = minutes % 60;

  if (jours > 0) {
    return `Nouveaux défis dans ${String(jours)} j ${String(heures)} h`;
  }

  if (heures > 0) {
    return `Nouveaux défis dans ${String(heures)} h ${String(resteMinutes)} min`;
  }

  return `Nouveaux défis dans ${String(resteMinutes)} min`;
}

/** « 1 défi relevé sur 3 ». */
function bilanDe(defis: readonly AvancementDUnDefi[]): string {
  const releves = defis.filter((defi) => defi.accompli).length;

  return `${String(releves)} ${releves > 1 ? 'défis relevés' : 'défi relevé'} sur ${String(defis.length)}`;
}

/** Les defis de la semaine, mis en forme. */
export function defisDeLaSemaineAffiches(
  defis: DefisDeLaSemaine,
  maintenantMs: number,
): ModeleDefisDeLaSemaine {
  return {
    defis: defis.defis.map(defiAffiche),
    renouvellement: phraseDuRenouvellement(defis.finLe, maintenantMs),
    bilan: bilanDe(defis.defis),
  };
}

/**
 * Ce que l'accueil montre des defis: rien pour un invite, ni tant qu'ils ne sont pas lus.
 * Un refus ne se dit pas: le bloc reste absent, comme pour un invite.
 */
export function modeleDesDefis(
  etat: EtatClient,
  maintenantMs: number,
): ModeleDefisDeLaSemaine | undefined {
  if (etat.session.nature !== 'compte' || etat.defis.statut !== 'charge') {
    return undefined;
  }

  return defisDeLaSemaineAffiches(etat.defis.defis, maintenantMs);
}

/** Un defi qu'une partie vient de relever, tel que la fin l'annonce. */
export interface DefiReleveAffiche {
  readonly id: string;
  /** « Défi relevé : Prendre 15 joueurs. » */
  readonly texte: string;
  /** « +400 XP ». */
  readonly xp: string;
}

/** Les defis qu'une partie a releves, mis en forme pour l'ecran de fin. */
export function defisRelevesAffiches(releves: readonly DefiReleve[]): DefiReleveAffiche[] {
  return releves.map((releve) => ({
    id: releve.id,
    texte: `Défi relevé : ${definitionDuDefi(releve.id).texte}`,
    xp: `+${formaterNombre(releve.xp)} XP`,
  }));
}
