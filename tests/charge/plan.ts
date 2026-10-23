/**
 * Ce que la ligne de commande du harnais de charge demande: le plan de mesure.
 *
 * Separe de charge.ts, qui lance la mesure des qu'on l'importe, pour que la lecture des
 * options se teste (plan.test.ts).
 *
 * LA CARTE DE MESURE (etape 5.10). --carte-de-mesure realiste ou vide joue le banc et les
 * populations melees sur 10 000 sur 10 000 pixels (terrainDeMesure.ts). Sans --bots-banc,
 * le banc y joue alors 1 000, 2 000, 5 000 et 10 000 faux ninjas. --zone-d-interet estime
 * en plus le filtrage par zone d'interet, --profil ecrit le profil du processeur de chaque
 * processus de banc dans un dossier, et --demarrage mesure ce que coute au serveur le
 * chargement d'une carte de 10 000 sur 10 000 (demarrage.ts).
 */

import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';

import type { IdentifiantCarte, Mode } from '../../packages/shared/dist/index.js';
import { CARTES, MODES } from '../../packages/shared/dist/index.js';

import type { TerrainDeMesure } from './terrainDeMesure.ts';
import { TERRAINS_DE_MESURE } from './terrainDeMesure.ts';

/** Ce qui est joue quand rien n'est precise. */
export const PAR_DEFAUT = {
  botsBanc: [50, 100, 150, 200, 300, 500, 1000],
  sequences: [
    [50, 150],
    [150, 50],
    [150, 300],
  ],
  joueurs: 12,
  // Une minute de jeu mesuree, apres dix secondes d'echauffement.
  battements: 1200,
  echauffement: 200,
  rooms: [1, 2, 4, 8, 16, 24, 32, 48, 64, 96],
  scenarios: [[150], [50, 150]],
  dureeMesureS: 20,
  echauffementS: 5,
} as const;

/** Les foules du banc sur la carte de mesure, quand --bots-banc ne les donne pas (etape 5.10). */
export const BOTS_DE_LA_CARTE_DE_MESURE = [1000, 2000, 5000, 10_000] as const;

/** La version courte de --rapide. */
const RAPIDE = {
  botsBanc: [150],
  sequences: [[50, 150]],
  battements: 300,
  echauffement: 100,
  rooms: [1, 2],
  scenarios: [[150]],
  dureeMesureS: 5,
  echauffementS: 2,
} as const;

/** Ce que la ligne de commande a demande. */
export interface Plan {
  readonly banc: boolean;
  readonly melange: boolean;
  readonly reseau: boolean;
  /** Mesurer le chargement d'une carte de 10 000 sur 10 000 (etape 5.10, --demarrage). */
  readonly demarrage: boolean;
  readonly botsBanc: readonly number[];
  readonly sequences: readonly (readonly number[])[];
  readonly joueurs: number;
  readonly battements: number;
  /** Battements joues avant de mesurer le banc. --echauffement-banc le change (etape 5.10). */
  readonly echauffement: number;
  readonly rooms: readonly number[];
  readonly scenarios: readonly (readonly number[])[];
  readonly dureeMesureS: number;
  readonly echauffementS: number;
  readonly processus: number;
  readonly sansArret: boolean;
  readonly sortie: string | undefined;
  /** Le mode des parties du banc et des populations melees. Le Classique par defaut. */
  readonly mode: Mode;
  /**
   * La carte des parties du banc et des populations melees, murs compris. Tokyo (map1)
   * par defaut; --carte map3 mesure Spirit & Time, dont le plafond de faux ninjas est
   * plus haut (etape 7.6): 360 depuis l'etape 8.8.
   */
  readonly carte: IdentifiantCarte;
  /**
   * Le terrain de la carte de mesure de 10 000 sur 10 000 (etape 5.10), qui remplace alors
   * la carte. Absent: la carte, a sa taille.
   */
  readonly terrainDeMesure: TerrainDeMesure | undefined;
  /** Le banc estime le filtrage par zone d'interet (etape 5.10, --zone-d-interet). */
  readonly zoneDInteret: boolean;
  /** Le dossier ou ecrire le profil du processeur de chaque processus de banc (etape 5.10). */
  readonly profil: string | undefined;
  /** Les joueurs du banc posent des mines (etape 7.11, --mines). */
  readonly mines: boolean;
  /** La charge reseau tourne sur un serveur surveille comme en production (etape 5.15). */
  readonly surveillance: boolean;
}

/**
 * Lit une liste d'entiers positifs separes par des virgules.
 *
 * Les espaces sont acceptes aussi: sous PowerShell, « --rooms 8,16 » sans
 * guillemets devient un tableau, que pnpm transmet sous la forme « 8 16 ».
 */
function entiers(texte: string | undefined, nom: string): number[] | undefined {
  if (texte === undefined) {
    return undefined;
  }

  const valeurs = texte
    .trim()
    .split(/[\s,]+/u)
    .map((morceau) => Number(morceau));

  if (valeurs.some((valeur) => !Number.isInteger(valeur) || valeur <= 0)) {
    throw new Error(
      `--${nom} attend des entiers positifs separes par des virgules, recu « ${texte} ».`,
    );
  }

  return valeurs;
}

/** Lit un entier positif. */
function entier(texte: string | undefined, nom: string): number | undefined {
  const valeurs = entiers(texte, nom);

  if (valeurs !== undefined && valeurs.length !== 1) {
    throw new Error(`--${nom} attend un seul entier, recu « ${String(texte)} ».`);
  }

  return valeurs?.[0];
}

/** Traduit la ligne de commande en plan de mesure. */
export function lirePlan(argumentsRecus: readonly string[]): Plan {
  const { values: options } = parseArgs({
    args: [...argumentsRecus],
    options: {
      banc: { type: 'boolean', default: false },
      melange: { type: 'boolean', default: false },
      reseau: { type: 'boolean', default: false },
      demarrage: { type: 'boolean', default: false },
      rapide: { type: 'boolean', default: false },
      'bots-banc': { type: 'string' },
      sequence: { type: 'string', multiple: true },
      joueurs: { type: 'string' },
      battements: { type: 'string' },
      'echauffement-banc': { type: 'string' },
      rooms: { type: 'string' },
      bots: { type: 'string', multiple: true },
      'duree-mesure': { type: 'string' },
      echauffement: { type: 'string' },
      processus: { type: 'string' },
      'sans-arret': { type: 'boolean', default: false },
      sortie: { type: 'string' },
      mode: { type: 'string' },
      carte: { type: 'string' },
      'carte-de-mesure': { type: 'string' },
      'zone-d-interet': { type: 'boolean', default: false },
      profil: { type: 'string' },
      mines: { type: 'boolean', default: false },
      surveillance: { type: 'boolean', default: false },
    },
  });

  // Le demarrage ne se joue que demande: il ecrit une image de cent millions de pixels.
  const aucune = !options.banc && !options.melange && !options.reseau && !options.demarrage;
  const base = options.rapide ? RAPIDE : PAR_DEFAUT;
  const terrainDeMesure = terrainDeMesureDe(options['carte-de-mesure']);

  return {
    banc: aucune || options.banc,
    melange: aucune || options.melange,
    reseau: aucune || options.reseau,
    demarrage: options.demarrage,
    botsBanc:
      entiers(options['bots-banc'], 'bots-banc') ??
      (terrainDeMesure === undefined ? base.botsBanc : BOTS_DE_LA_CARTE_DE_MESURE),
    sequences: options.sequence?.map((texte) => entiers(texte, 'sequence') ?? []) ?? base.sequences,
    joueurs: entier(options.joueurs, 'joueurs') ?? PAR_DEFAUT.joueurs,
    battements: entier(options.battements, 'battements') ?? base.battements,
    echauffement: entier(options['echauffement-banc'], 'echauffement-banc') ?? base.echauffement,
    rooms: entiers(options.rooms, 'rooms') ?? base.rooms,
    scenarios: options.bots?.map((texte) => entiers(texte, 'bots') ?? []) ?? base.scenarios,
    dureeMesureS: entier(options['duree-mesure'], 'duree-mesure') ?? base.dureeMesureS,
    echauffementS: entier(options.echauffement, 'echauffement') ?? base.echauffementS,
    // Les clients prennent la moitie des coeurs, moins un: le serveur mesure garde
    // son fil, et le systeme le sien.
    processus:
      entier(options.processus, 'processus') ??
      Math.max(Math.floor(availableParallelism() / 2) - 1, 1),
    sansArret: options['sans-arret'],
    sortie: options.sortie,
    mode: modeDe(options.mode),
    carte: carteDe(options.carte),
    terrainDeMesure,
    zoneDInteret: options['zone-d-interet'],
    profil: options.profil,
    mines: options.mines,
    surveillance: options.surveillance,
  };
}

/** Lit la carte demandee, Tokyo (map1) s'il n'y en a pas. */
function carteDe(texte: string | undefined): IdentifiantCarte {
  if (texte === undefined) {
    return 'map1';
  }

  const carte = (Object.keys(CARTES) as IdentifiantCarte[]).find(
    (candidate) => candidate === texte,
  );

  if (carte === undefined) {
    throw new Error(
      `--carte attend l'une de ${Object.keys(CARTES).join(', ')}, recu « ${texte} ».`,
    );
  }

  return carte;
}

/** Lit le terrain de la carte de mesure demande, aucun s'il n'y en a pas. */
function terrainDeMesureDe(texte: string | undefined): TerrainDeMesure | undefined {
  if (texte === undefined) {
    return undefined;
  }

  const terrain = TERRAINS_DE_MESURE.find((candidat) => candidat === texte);

  if (terrain === undefined) {
    throw new Error(
      `--carte-de-mesure attend l'un de ${TERRAINS_DE_MESURE.join(', ')}, recu « ${texte} ».`,
    );
  }

  return terrain;
}

/** Lit le mode demande, le Classique s'il n'y en a pas. */
function modeDe(texte: string | undefined): Mode {
  if (texte === undefined) {
    return 'classique';
  }

  const mode = MODES.find((candidat) => candidat === texte);

  if (mode === undefined) {
    throw new Error(`--mode attend l'un de ${MODES.join(', ')}, recu « ${texte} ».`);
  }

  return mode;
}
