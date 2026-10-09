/**
 * Les statistiques de fin de partie: ce que le classement final montre de chaque joueur, a
 * cote de son rang, de son pseudo et de ses points, selon le mode joue.
 *
 * Jusqu'au 9 octobre 2026, tous les modes montraient les memes colonnes, celles de la Horde:
 * ninjas, captures, Black Ninjas. En Massacre, ou l'on ne capture pas et ou les ninjas tues
 * disparaissent, elles ne disaient rien. Par decision du porteur du projet, chaque mode a
 * desormais les siennes: en Massacre, les PNJ et les joueurs massacres, les Black Ninjas
 * detruits, le plus haut combo et l'Evade attrape.
 *
 * LES DEFINITIONS SONT DES DONNEES, comme les succes. Une statistique a un identifiant, un
 * intitule de colonne, une phrase qui la dit en entier (l'infobulle, et ce que lit un lecteur
 * d'ecran) et une facon de s'ecrire. Le serveur calcule les nombres a la fin de la partie
 * (packages/server, statistiquesDeFin.ts) et les envoie avec le classement final; la page
 * pose les colonnes que ce fichier donne au mode, dans cet ordre.
 *
 * AJOUTER UN MODE. Le compilateur l'impose: STATISTIQUES_PAR_MODE est une table sur tous les
 * modes, et un mode sans ligne ne compile pas. Il faut alors:
 *
 *   1. choisir ce que son classement final doit dire, trois a six colonnes, en reprenant les
 *      statistiques existantes quand elles disent la meme chose (« captures », « Black
 *      Ninjas detruits », « Evade attrape ») plutot que d'en creer de voisines;
 *   2. pour une statistique nouvelle, l'ajouter a STATISTIQUES_DE_FIN, a DEFINITIONS, et a
 *      la table des calculs du serveur (CALCULS, dans packages/server/src/statistiquesDeFin.ts),
 *      qui est elle aussi une table complete: une statistique sans calcul ne compile pas;
 *   3. ecrire la ligne du mode ici, puis les tests du calcul cote serveur.
 *
 * Une colonne dont la partie n'a pas l'objet se retire d'elle-meme (statistiquesDeLaPartie):
 * pas de colonne de Black Ninjas quand l'hote les a coupes, pas d'Evade quand il l'a coupe.
 *
 * UN IDENTIFIANT PEUT CHANGER. Rien de ceci n'est ecrit en base: les faits de partie
 * (succes.ts) restent la seule mesure qui survit a la partie.
 */

import type { Mode } from './constantes.js';
import type { ReglagesPartie } from './reglages.js';

/** Toutes les statistiques qu'un classement final peut montrer. */
export const STATISTIQUES_DE_FIN = [
  /** Les ninjas a sa couleur a la fin; en Equipes, sa part des ninjas de son equipe. */
  'ninjas',
  /** Les joueurs captures. */
  'captures',
  /** Les faux ninjas rallies a sa suite, en Horde. */
  'ninjasRallies',
  /** Le plus haut multiplicateur de combo atteint. */
  'meilleurCombo',
  /** Le plus de ninjas pris d'un seul tir, en Tactique. */
  'meilleurTir',
  /** Les faux ninjas tues, en Massacre, Black Ninjas non compris. */
  'ninjasTues',
  /** Les joueurs tues, en Massacre. */
  'joueursTues',
  /** Les proies infectees par un traqueur, en Chasse. */
  'infections',
  /** Le temps tenu comme proie, en millisecondes, en Chasse. Absent pour qui n'a pas ete proie. */
  'survie',
  /** Les vies qui restent a un traqueur, en Chasse. Absent pour une proie. */
  'vies',
  /** Les Black Ninjas detruits. */
  'botsNoirsDetruits',
  /** 1 s'il a attrape l'Evade. */
  'evade',
] as const;

/** Une statistique de fin de partie. */
export type StatistiqueDeFin = (typeof STATISTIQUES_DE_FIN)[number];

/**
 * Comment une statistique s'ecrit dans le classement.
 *
 *   - nombre: tel quel, zero compris, et un tiret quand le serveur n'en donne pas (les vies
 *     d'une proie);
 *   - multiplicateur: « x3 », et un tiret sans combo;
 *   - duree: « 2:05 », minutes et secondes, et un tiret quand elle n'a pas de sens;
 *   - drapeau: « Oui », et un tiret sinon.
 */
export type FormatDeStatistique = 'nombre' | 'multiplicateur' | 'duree' | 'drapeau';

/** Ce que la page sait d'une statistique. */
export interface DefinitionDeStatistique {
  /** L'intitule de la colonne, court: « PNJ ». */
  readonly entete: string;
  /** La phrase entiere, en infobulle et pour les lecteurs d'ecran: « PNJ massacrés ». */
  readonly description: string;
  readonly format: FormatDeStatistique;
}

/** Chaque statistique, telle que la page la montre. */
export const DEFINITIONS_DES_STATISTIQUES: Readonly<
  Record<StatistiqueDeFin, DefinitionDeStatistique>
> = {
  ninjas: { entete: 'Ninjas', description: 'Ninjas à sa couleur à la fin', format: 'nombre' },
  captures: { entete: 'Captures', description: 'Joueurs capturés', format: 'nombre' },
  ninjasRallies: { entete: 'Ralliés', description: 'Ninjas ralliés', format: 'nombre' },
  meilleurCombo: {
    entete: 'Combo',
    description: 'Plus haut combo',
    format: 'multiplicateur',
  },
  meilleurTir: {
    entete: 'Meilleur tir',
    description: 'Le plus de ninjas pris d’un seul tir',
    format: 'nombre',
  },
  ninjasTues: { entete: 'PNJ', description: 'PNJ massacrés', format: 'nombre' },
  joueursTues: { entete: 'Joueurs', description: 'Joueurs massacrés', format: 'nombre' },
  infections: { entete: 'Infections', description: 'Proies infectées', format: 'nombre' },
  survie: { entete: 'Survie', description: 'Temps tenu comme proie', format: 'duree' },
  vies: { entete: 'Vies', description: 'Vies restantes du traqueur', format: 'nombre' },
  botsNoirsDetruits: {
    entete: 'Black Ninjas',
    description: 'Black Ninjas détruits',
    format: 'nombre',
  },
  evade: { entete: 'Évadé', description: 'A attrapé l’Évadé', format: 'drapeau' },
};

/** Les colonnes du classement final de chaque mode, dans l'ordre ou elles se lisent. */
export const STATISTIQUES_PAR_MODE: Readonly<Record<Mode, readonly StatistiqueDeFin[]>> = {
  classique: ['ninjas', 'captures', 'ninjasRallies', 'meilleurCombo', 'botsNoirsDetruits', 'evade'],
  tactique: ['ninjas', 'captures', 'meilleurTir', 'botsNoirsDetruits', 'evade'],
  equipes: ['ninjas', 'captures', 'botsNoirsDetruits', 'evade'],
  chasse: ['survie', 'infections', 'vies'],
  massacre: ['ninjasTues', 'joueursTues', 'botsNoirsDetruits', 'meilleurCombo', 'evade'],
};

/** Les statistiques d'un joueur a la fin d'une partie. Une statistique absente n'a pas d'objet. */
export type StatistiquesDUnJoueur = Readonly<Partial<Record<StatistiqueDeFin, number>>>;

/**
 * Les colonnes d'une partie donnee: celles de son mode, moins celles dont la partie n'avait
 * pas l'objet, Black Ninjas ou Evade coupes par l'hote.
 */
export function statistiquesDeLaPartie(
  mode: Mode,
  reglages: Pick<ReglagesPartie, 'evade' | 'botsNoirs'>,
): readonly StatistiqueDeFin[] {
  return STATISTIQUES_PAR_MODE[mode].filter(
    (statistique) =>
      (statistique !== 'botsNoirsDetruits' || reglages.botsNoirs.actifs) &&
      (statistique !== 'evade' || reglages.evade),
  );
}
