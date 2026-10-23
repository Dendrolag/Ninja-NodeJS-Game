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
 * Une quatrieme, LE DEMARRAGE (--demarrage, etape 5.10), mesure ce que coute au serveur
 * le chargement d'une carte de 10 000 sur 10 000. Voir demarrage.ts. Le banc et les
 * populations melees se jouent aussi sur cette carte (--carte-de-mesure); voir plan.ts.
 *
 * Sans aucune des trois options, les trois sont jouees. --rapide joue une version
 * courte de chacune, pour verifier que le harnais fonctionne. --sortie ecrit tous
 * les resultats dans un fichier JSON: c'est ce fichier que l'etape 5.2 comparera.
 *
 * Exemples:
 *
 *   pnpm charge
 *   pnpm charge --banc --bots-banc 150,300
 *   pnpm charge --banc --carte map3 --bots-banc 150,300,360
 *   pnpm charge --banc --mines --bots-banc 50,150,300
 *   pnpm charge --banc --carte-de-mesure realiste --joueurs 30 --zone-d-interet
 *   pnpm charge --banc --carte-de-mesure realiste --bots-banc 5000 --profil profils
 *   pnpm charge --demarrage
 *   pnpm charge --reseau --bots 150 --bots 50,150 --rooms 8,16,32
 *   pnpm charge --sortie docs/mesures/charge-serveur-5-1.json
 *
 * Le script « charge » compile les paquets avant de lancer ce fichier: le harnais
 * mesure leur compilation, c'est-a-dire le code qui tourne en production.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism, cpus, release, totalmem, type as systeme } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { IdentifiantCarte, Mode } from '../../packages/shared/dist/index.js';

import type { ConfigurationDeBanc } from './battement-isole.ts';
import { mesurerEnProcessusNeuf } from './battement-isole.ts';
import type { ResultatBancBattement } from './battement.ts';
import { mesurerLaChargeEnProcessusNeuf } from './charge-reseau-isolee.ts';
import type { ResultatChargeReseau } from './charge-reseau.ts';
import type { ResultatDemarrage } from './demarrage.ts';
import { mesurerLeDemarrage } from './demarrage.ts';
import type { Plan } from './plan.ts';
import { lirePlan } from './plan.ts';
import type { ProfilDuProcesseur, ResumeDuProfil } from './profil.ts';
import { resumeEnTexte, resumerLeProfil } from './profil.ts';
import {
  FREQUENCE_CIBLE_HZ,
  debitKoParSeconde,
  megabitsParSeconde,
  partiesParCoeur,
} from './seuils.ts';

/**
 * Battements joues avant de mesurer le banc des mines (--mines, etape 7.11): deux minutes,
 * le temps que les joueurs en aient pose pres du plafond.
 */
const ECHAUFFEMENT_DES_MINES = 2400;

/** Graine des parties du banc et des intentions des clients. */
const GRAINE = 42;

/** Lignes du profil du processeur gardees dans le rapport, par fonction et par fichier. */
const LIGNES_DU_PROFIL = 40;

/** Une ligne du banc, avec le budget qui en decoule. */
interface LigneDeBanc extends ResultatBancBattement {
  readonly partiesParCoeur: number;
  readonly botsParCoeur: number;
  readonly debitParClientKoS: number;
  /** Le profil du processeur du processus de banc, si --profil l'a demande (etape 5.10). */
  readonly profil?: ResumeDuProfil;
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
  /** Le mode et la carte des parties du banc et des populations melees. */
  readonly mode: Mode;
  readonly carte: IdentifiantCarte;
  /** Le terrain de la carte de mesure de 10 000 sur 10 000, s'il remplace la carte (etape 5.10). */
  readonly terrainDeMesure: string | undefined;
  readonly joueurs: number;
  banc?: readonly LigneDeBanc[];
  melange?: readonly {
    readonly sequence: readonly number[];
    readonly resultats: readonly ResultatBancBattement[];
  }[];
  reseau?: readonly SerieReseau[];
  demarrage?: ResultatDemarrage;
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
    // Les mines s'accumulent: deux minutes de jeu avant de mesurer (etape 7.11).
    echauffement: plan.mines
      ? Math.max(plan.echauffement, ECHAUFFEMENT_DES_MINES)
      : plan.echauffement,
    graine: GRAINE,
    mode: plan.mode,
    carte: plan.carte,
    mines: plan.mines,
    ...(plan.terrainDeMesure === undefined ? {} : { terrainDeMesure: plan.terrainDeMesure }),
    zoneDInteret: plan.zoneDInteret,
  };
}

/** Les profils deja ecrits dans le dossier du profil. */
function profilsPresents(dossier: string): Set<string> {
  mkdirSync(dossier, { recursive: true });
  return new Set(readdirSync(dossier).filter((nom) => nom.endsWith('.cpuprofile')));
}

/** Le resume du profil qu'un processus de banc vient d'ecrire, s'il y en a un nouveau. */
function nouveauProfil(dossier: string, avant: ReadonlySet<string>): ResumeDuProfil | undefined {
  const nouveau = [...profilsPresents(dossier)].find((nom) => !avant.has(nom));

  if (nouveau === undefined) {
    return undefined;
  }

  const profil = JSON.parse(readFileSync(join(dossier, nouveau), 'utf8')) as ProfilDuProcesseur;
  const resume = resumerLeProfil(profil);

  // Les quarante lignes les plus lourdes suffisent au rapport: la suite pese sans rien dire.
  return {
    ...resume,
    fonctions: resume.fonctions.slice(0, LIGNES_DU_PROFIL),
    fichiers: resume.fichiers.slice(0, LIGNES_DU_PROFIL),
  };
}

/** Joue le banc du battement, une configuration par processus. */
async function jouerLeBanc(plan: Plan): Promise<LigneDeBanc[]> {
  const lignes: LigneDeBanc[] = [];

  for (const bots of plan.botsBanc) {
    const avant = plan.profil === undefined ? undefined : profilsPresents(plan.profil);
    const [resultat] = await mesurerEnProcessusNeuf([configuration(plan, bots)], plan.profil);

    if (resultat === undefined) {
      throw new Error(`Le banc a ${String(bots)} bots n'a rendu aucun resultat.`);
    }

    const profil =
      plan.profil === undefined || avant === undefined
        ? undefined
        : nouveauProfil(plan.profil, avant);
    const parties = partiesParCoeur(resultat.totalMs.moyenne);
    lignes.push({
      ...resultat,
      partiesParCoeur: parties,
      botsParCoeur: parties * bots,
      debitParClientKoS: debitKoParSeconde(resultat.octetsParMessage.moyenne, FREQUENCE_CIBLE_HZ),
      ...(profil === undefined ? {} : { profil }),
    });

    if (profil !== undefined) {
      console.log(`\n${String(bots)} bots. ${resumeEnTexte(profil, 15)}`);
    }
  }

  const carte =
    plan.terrainDeMesure === undefined
      ? `carte ${plan.carte} avec ses murs`
      : `carte de mesure de 10 000 sur 10 000, terrain ${plan.terrainDeMesure}`;

  console.log(
    [
      '',
      `Banc du battement: mode ${plan.mode}, ${String(plan.joueurs)} joueurs, ${String(plan.battements)} battements mesures, ${carte}, un processus neuf par ligne`,
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
          'JSON',
          'deflate',
          'Ko/s client',
          'Mbit/s',
          'parties/coeur',
          'bots/coeur',
          'noirs',
          'lancement s',
          'zone ent.',
          'zone oct.',
          'zone Mbit/s',
          'zone ms',
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
          n(ligne.octetsJsonParMessage.moyenne, 0),
          n(ligne.octetsCompressesParMessage.moyenne, 0),
          n(ligne.debitParClientKoS, 0),
          n(megabitsParSeconde(ligne.debitParClientKoS), 2),
          String(ligne.partiesParCoeur),
          String(ligne.botsParCoeur),
          String(ligne.botsNoirs),
          n(ligne.lancementMs / 1000, 2),
          ...(ligne.zoneDInteret === undefined
            ? ['-', '-', '-', '-']
            : [
                n(ligne.zoneDInteret.entitesParJoueur, 0),
                n(ligne.zoneDInteret.octetsParMessage.moyenne, 0),
                n(
                  megabitsParSeconde(
                    debitKoParSeconde(
                      ligne.zoneDInteret.octetsParMessage.moyenne,
                      FREQUENCE_CIBLE_HZ,
                    ),
                  ),
                  3,
                ),
                n(ligne.zoneDInteret.codageMs.moyenne, 3),
              ]),
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
        surveillance: plan.surveillance,
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
    ...(palier.surveillance === undefined
      ? []
      : [
          `\n        surveillance: /metriques ${n(palier.surveillance.lectureMs.moyenne)} ms (max ${n(palier.surveillance.lectureMs.maximum)}),`,
          `${String(palier.surveillance.series)} series, ${n(palier.surveillance.octetsParLecture / 1024, 0)} Ko par lecture,`,
          `bulletins ${n(palier.surveillance.partDesBulletinsPourCent, 2)} % des octets`,
        ]),
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

/** Mesure le demarrage d'une carte de 10 000 sur 10 000, et l'affiche. */
async function jouerLeDemarrage(): Promise<ResultatDemarrage> {
  const resultat = await mesurerLeDemarrage();
  const etapes = [resultat.ecriture, resultat.decodage, ...resultat.chargement];

  console.log(
    [
      '',
      `Demarrage d'une carte de ${String(resultat.largeur)} sur ${String(resultat.hauteur)}: image de collision de ${n(resultat.imageMo, 1)} Mo, une ligne par etape, pointe de memoire du processus a sa fin`,
      tableau(
        ['etape', 'duree s', 'pointe Mo'],
        etapes.map((etape) => [
          etape.etape,
          n(etape.dureeMs / 1000, 2),
          n(etape.pointeMemoireMo, 0),
        ]),
      ),
    ].join('\n'),
  );

  return resultat;
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
    mode: plan.mode,
    carte: plan.carte,
    terrainDeMesure: plan.terrainDeMesure,
    joueurs: plan.joueurs,
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

  if (plan.demarrage) {
    rapport.demarrage = await jouerLeDemarrage();
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
