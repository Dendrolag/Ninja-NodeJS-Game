/**
 * Le harnais de charge du serveur, en ligne de commande: « pnpm charge ».
 *
 * Il joue trois mesures, qui repondent chacune a une question de la fiche 5.1:
 *
 *   1. LE BANC DU BATTEMENT (--banc): combien coute une partie, selon son nombre de
 *      bots, et combien pese chacun de ses messages. Chaque configuration est
 *      mesuree dans un processus neuf. Voir battement.ts et battement-isole.ts.
 *   2. LES POPULATIONS MELEES (--melange): combien coute une partie qui en suit une
 *      autre de taille differente dans le meme processus, comme sur un vrai serveur.
 *   3. LA CHARGE DU SERVEUR COMPLET (--reseau): N parties pleines, de vrais clients
 *      par WebSocket, jusqu'a ce que le serveur ne tienne plus la frequence cible.
 *      Chaque palier tourne dans un processus neuf. Voir charge-reseau.ts et
 *      charge-reseau-isolee.ts.
 *
 * Sans aucune des trois options, les trois sont jouees. --rapide joue une version
 * courte de chacune, pour verifier que le harnais fonctionne. --sortie ecrit tous
 * les resultats dans un fichier JSON: c'est ce fichier que l'etape 5.2 comparera.
 *
 * Exemples:
 *
 *   pnpm charge
 *   pnpm charge --banc --bots-banc 150,300
 *   pnpm charge --reseau --bots 150 --bots 50,150 --rooms 8,16,32
 *   pnpm charge --sortie docs/mesures/charge-serveur-5-1.json
 *
 * Le script « charge » compile les paquets avant de lancer ce fichier: le harnais
 * mesure leur compilation, c'est-a-dire le code qui tourne en production.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism, cpus, release, totalmem, type as systeme } from 'node:os';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { ConfigurationDeBanc } from './battement-isole.ts';
import { mesurerEnProcessusNeuf } from './battement-isole.ts';
import type { ResultatBancBattement } from './battement.ts';
import { mesurerLaChargeEnProcessusNeuf } from './charge-reseau-isolee.ts';
import type { ResultatChargeReseau } from './charge-reseau.ts';
import {
  FREQUENCE_CIBLE_HZ,
  debitKoParSeconde,
  megabitsParSeconde,
  partiesParCoeur,
} from './seuils.ts';

/** Graine des parties du banc et des intentions des clients. */
const GRAINE = 42;

/** Ce qui est joue quand rien n'est precise. */
const PAR_DEFAUT = {
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
interface Plan {
  readonly banc: boolean;
  readonly melange: boolean;
  readonly reseau: boolean;
  readonly botsBanc: readonly number[];
  readonly sequences: readonly (readonly number[])[];
  readonly joueurs: number;
  readonly battements: number;
  readonly echauffement: number;
  readonly rooms: readonly number[];
  readonly scenarios: readonly (readonly number[])[];
  readonly dureeMesureS: number;
  readonly echauffementS: number;
  readonly processus: number;
  readonly sansArret: boolean;
  readonly sortie: string | undefined;
}

/** Une ligne du banc, avec le budget qui en decoule. */
interface LigneDeBanc extends ResultatBancBattement {
  readonly partiesParCoeur: number;
  readonly botsParCoeur: number;
  readonly debitParClientKoS: number;
}

/** Une charge reseau jouee palier par palier. */
interface SerieReseau {
  readonly bots: readonly number[];
  readonly paliers: readonly ResultatChargeReseau[];
  /** Le plus grand nombre de parties tenu, ou undefined si aucun palier n'a tenu. */
  readonly partiesTenues: number | undefined;
}

/** Tout ce que le harnais a mesure, tel qu'il est ecrit dans --sortie. */
interface RapportDeCharge {
  readonly date: string;
  readonly commit: string;
  readonly machine: {
    readonly processeur: string;
    readonly coeursLogiques: number;
    readonly memoireGo: number;
    readonly systeme: string;
    readonly node: string;
  };
  banc?: readonly LigneDeBanc[];
  melange?: readonly {
    readonly sequence: readonly number[];
    readonly resultats: readonly ResultatBancBattement[];
  }[];
  reseau?: readonly SerieReseau[];
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
function lirePlan(argumentsRecus: readonly string[]): Plan {
  const { values: options } = parseArgs({
    args: [...argumentsRecus],
    options: {
      banc: { type: 'boolean', default: false },
      melange: { type: 'boolean', default: false },
      reseau: { type: 'boolean', default: false },
      rapide: { type: 'boolean', default: false },
      'bots-banc': { type: 'string' },
      sequence: { type: 'string', multiple: true },
      joueurs: { type: 'string' },
      battements: { type: 'string' },
      rooms: { type: 'string' },
      bots: { type: 'string', multiple: true },
      'duree-mesure': { type: 'string' },
      echauffement: { type: 'string' },
      processus: { type: 'string' },
      'sans-arret': { type: 'boolean', default: false },
      sortie: { type: 'string' },
    },
  });

  const aucune = !options.banc && !options.melange && !options.reseau;
  const base = options.rapide ? RAPIDE : PAR_DEFAUT;

  return {
    banc: aucune || options.banc,
    melange: aucune || options.melange,
    reseau: aucune || options.reseau,
    botsBanc: entiers(options['bots-banc'], 'bots-banc') ?? base.botsBanc,
    sequences: options.sequence?.map((texte) => entiers(texte, 'sequence') ?? []) ?? base.sequences,
    joueurs: entier(options.joueurs, 'joueurs') ?? PAR_DEFAUT.joueurs,
    battements: entier(options.battements, 'battements') ?? base.battements,
    echauffement: base.echauffement,
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
  };
}

/** Formate un nombre avec un nombre fixe de decimales. */
function n(valeur: number, decimales = 2): string {
  return valeur.toFixed(decimales);
}

/** Aligne des lignes en colonnes, alignees a droite. */
function tableau(entetes: readonly string[], lignes: readonly (readonly string[])[]): string {
  const largeurs = entetes.map((entete, colonne) =>
    Math.max(entete.length, ...lignes.map((ligne) => (ligne[colonne] ?? '').length)),
  );
  const formater = (cellules: readonly string[]): string =>
    cellules.map((cellule, colonne) => cellule.padStart(largeurs[colonne] ?? 0)).join('  ');

  return [formater(entetes), ...lignes.map(formater)].join('\n');
}

/** La configuration du banc pour un nombre de bots. */
function configuration(plan: Plan, bots: number): ConfigurationDeBanc {
  return {
    bots,
    joueurs: plan.joueurs,
    battements: plan.battements,
    echauffement: plan.echauffement,
    graine: GRAINE,
  };
}

/** Joue le banc du battement, une configuration par processus. */
async function jouerLeBanc(plan: Plan): Promise<LigneDeBanc[]> {
  const lignes: LigneDeBanc[] = [];

  for (const bots of plan.botsBanc) {
    const [resultat] = await mesurerEnProcessusNeuf([configuration(plan, bots)]);

    if (resultat === undefined) {
      throw new Error(`Le banc a ${String(bots)} bots n'a rendu aucun resultat.`);
    }

    const parties = partiesParCoeur(resultat.totalMs.moyenne);
    lignes.push({
      ...resultat,
      partiesParCoeur: parties,
      botsParCoeur: parties * bots,
      debitParClientKoS: debitKoParSeconde(resultat.octetsParMessage.moyenne, FREQUENCE_CIBLE_HZ),
    });
  }

  console.log(
    [
      '',
      `Banc du battement: ${String(plan.joueurs)} joueurs, ${String(plan.battements)} battements mesures, carte map1 avec ses murs, un processus neuf par ligne`,
      tableau(
        [
          'bots',
          'entites',
          'moteur ms',
          'projection',
          'serialis.',
          'total ms',
          'total p99',
          'octets/msg',
          'deflate',
          'Ko/s client',
          'Mbit/s',
          'parties/coeur',
          'bots/coeur',
        ],
        lignes.map((ligne) => [
          String(ligne.bots),
          n(ligne.entitesParMessage, 0),
          n(ligne.moteurMs.moyenne, 3),
          n(ligne.projectionMs.moyenne, 3),
          n(ligne.serialisationMs.moyenne, 3),
          n(ligne.totalMs.moyenne, 3),
          n(ligne.totalMs.p99, 3),
          n(ligne.octetsParMessage.moyenne, 0),
          n(ligne.octetsCompressesParMessage.moyenne, 0),
          n(ligne.debitParClientKoS, 0),
          n(megabitsParSeconde(ligne.debitParClientKoS), 2),
          String(ligne.partiesParCoeur),
          String(ligne.botsParCoeur),
        ]),
      ),
    ].join('\n'),
  );

  return lignes;
}

/** Joue chaque suite de populations dans un processus, et la compare au banc isole. */
async function jouerLeMelange(
  plan: Plan,
  banc: readonly LigneDeBanc[] | undefined,
): Promise<NonNullable<RapportDeCharge['melange']>> {
  const series: { sequence: readonly number[]; resultats: readonly ResultatBancBattement[] }[] = [];
  const lignes: string[][] = [];

  for (const sequence of plan.sequences) {
    const resultats = await mesurerEnProcessusNeuf(
      sequence.map((bots) => configuration(plan, bots)),
    );
    series.push({ sequence, resultats });

    resultats.forEach((resultat, rang) => {
      const isole = banc?.find((ligne) => ligne.bots === resultat.bots);
      lignes.push([
        sequence.join(' puis '),
        String(rang + 1),
        String(resultat.bots),
        n(resultat.totalMs.moyenne, 3),
        isole === undefined ? '-' : n(isole.totalMs.moyenne, 3),
        isole === undefined ? '-' : `x${n(resultat.totalMs.moyenne / isole.totalMs.moyenne, 2)}`,
      ]);
    });
  }

  console.log(
    [
      '',
      'Populations melees: plusieurs parties jouees l une apres l autre dans un meme processus',
      tableau(['suite', 'rang', 'bots', 'total ms', 'isole ms', 'facteur'], lignes),
    ].join('\n'),
  );

  return series;
}

/** Joue une charge reseau palier par palier, jusqu'au premier palier non tenu. */
async function jouerLeReseau(plan: Plan): Promise<SerieReseau[]> {
  const series: SerieReseau[] = [];

  for (const bots of plan.scenarios) {
    const paliers: ResultatChargeReseau[] = [];
    let partiesTenues: number | undefined;

    console.log(
      `\nCharge du serveur complet: ${String(plan.joueurs)} joueurs par partie, bots ${bots.join('/')}, mesure sur ${String(plan.dureeMesureS)} s, clients sur ${String(plan.processus)} processus`,
    );

    for (const rooms of plan.rooms) {
      const palier = await mesurerLaChargeEnProcessusNeuf({
        rooms,
        joueursParRoom: plan.joueurs,
        bots,
        echauffementS: plan.echauffementS,
        dureeMesureS: plan.dureeMesureS,
        processusClients: plan.processus,
        graine: GRAINE,
      });
      paliers.push(palier);

      console.log(ligneReseau(palier));

      if (palier.verdict.tenue) {
        partiesTenues = rooms;
      } else if (!plan.sansArret) {
        break;
      }
    }

    series.push({ bots, paliers, partiesTenues });
  }

  return series;
}

/** Une ligne lisible pour un palier de charge reseau. */
function ligneReseau(palier: ResultatChargeReseau): string {
  return [
    `  ${String(palier.rooms).padStart(3)} parties, ${String(palier.clients).padStart(4)} clients:`,
    `battement ${n(palier.battementMs.moyenne)} ms (p99 ${n(palier.battementMs.p99)}),`,
    `ecart p99 ${n(palier.intervalleMs.p99, 1)} ms,`,
    `frequence min ${n(palier.frequenceParPartieHz.minimum, 1)} Hz,`,
    `processeur ${n(palier.processeurServeurPourCent, 0)} % (${n(palier.processeurParPartieMs)} ms/partie/battement),`,
    `boucle occupee ${n(palier.utilisationBouclePourCent, 0)} %,`,
    `ramasse-miettes ${n(palier.ramasseMiettes.partDuTempsPourCent, 1)} % (${String(palier.ramasseMiettes.pauses)} pauses, max ${n(palier.ramasseMiettes.plusLongueMs, 1)} ms),`,
    `retard boucle p99 ${n(palier.retardBoucleMs.p99, 1)} ms,`,
    `memoire ${n(palier.memoireRssMo, 0)} Mo,`,
    `${n(palier.octetsParMessage, 0)} octets/msg,`,
    `${n(palier.debitParClientKoS, 0)} Ko/s par client,`,
    `${n(palier.debitSortantMbitS, 1)} Mbit/s sortants,`,
    `clients ${palier.processeurClientsPourCent.map((pourCent) => n(pourCent, 0)).join('/')} %:`,
    palier.verdict.tenue ? 'TENU' : `NON TENU (${palier.verdict.motifs.join('; ')})`,
  ].join(' ');
}

/** Le commit mesure, pour que deux rapports se comparent en connaissance de cause. */
function commitCourant(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'inconnu';
  }
}

/** Joue le plan, affiche les resultats, et les ecrit si demande. */
async function principal(): Promise<void> {
  const plan = lirePlan(process.argv.slice(2));

  const rapport: RapportDeCharge = {
    date: new Date().toISOString(),
    commit: commitCourant(),
    machine: {
      processeur: cpus()[0]?.model.trim() ?? 'inconnu',
      coeursLogiques: availableParallelism(),
      memoireGo: Math.round(totalmem() / 1024 ** 3),
      systeme: `${systeme()} ${release()}`,
      node: process.version,
    },
  };

  console.log(
    `Harnais de charge Neon Ninja, commit ${rapport.commit}, ${rapport.machine.processeur}, ${String(rapport.machine.coeursLogiques)} coeurs logiques, Node ${rapport.machine.node}`,
  );

  if (plan.banc) {
    rapport.banc = await jouerLeBanc(plan);
  }

  if (plan.melange) {
    rapport.melange = await jouerLeMelange(plan, rapport.banc);
  }

  if (plan.reseau) {
    rapport.reseau = await jouerLeReseau(plan);
  }

  if (plan.sortie !== undefined) {
    const chemin = resolve(plan.sortie);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, `${JSON.stringify(rapport, null, 2)}\n`);
    console.log(`\nResultats ecrits dans ${chemin}`);
  }
}

principal().catch((erreur: unknown) => {
  console.error(erreur);
  process.exitCode = 1;
});
