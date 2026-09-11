/**
 * La charge du serveur complet: N parties, de vrais clients, le vrai reseau.
 *
 * C'EST LA MOITIE DU HARNAIS QUI MESURE CE QUE LE BANC DU BATTEMENT NE VOIT PAS.
 * Le banc dit ce que coute une partie seule, sans reseau ni horloge. Ici tourne le
 * serveur tel que « pnpm dev » le lance: sa compilation, Express, Socket.IO, les
 * murs des cartes, l'horloge du systeme. Des clients simules s'y connectent par
 * WebSocket, creent leurs parties, les rejoignent, les lancent et y jouent. Ce qui
 * est mesure est donc aussi l'ecriture des messages sur chaque connexion, la
 * reception des intentions, et la concurrence de N parties sur un seul fil.
 *
 * COMMENT ON MESURE SANS TOUCHER AU SERVEUR. Le serveur recoit son horloge par
 * injection (horloge.ts). Le harnais lui fournit celle du systeme, enveloppee: a
 * chaque rappel repete a la cadence des battements, elle note l'instant et la
 * duree du rappel. Or ce rappel est exactement la boucle d'une partie: avancer le
 * moteur, puis diffuser l'instantane et les notifications. Aucune ligne du serveur
 * n'est modifiee, aucun crochet n'y est ajoute. Le compte a rebours, qui se repete
 * chaque seconde, n'est pas compte.
 *
 * CE QUI DIT QU'UN SERVEUR SATURE. Node.js fait battre toutes les parties sur un
 * seul fil. Quand la somme de leurs battements depasse la cadence, les rappels
 * prennent du retard: l'ecart entre deux battements d'une partie s'allonge, et sa
 * frequence reelle baisse. C'est ce que juge verdictDeTenue (seuils.ts). Le
 * processeur du serveur et le retard de sa boucle d'evenements sont releves a cote,
 * pour situer la saturation.
 *
 * LA MESURE N'EST PAS DETERMINISTE, et ne peut pas l'etre: les graines des parties
 * sont tirees par le serveur, et le reseau et le systeme ont leurs propres
 * aleas. Elle est reproductible au sens ou deux executions donnent des chiffres
 * proches; le rapport donne l'ecart observe.
 */

import type { ChildProcess } from 'node:child_process';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PerformanceObserver, monitorEventLoopDelay, performance } from 'node:perf_hooks';

import type { Horloge } from '../../packages/server/dist/index.js';
import {
  CADENCE_BATTEMENT_MS,
  ChargeurDeTerrain,
  demarrerServeur,
  horlogeSysteme,
} from '../../packages/server/dist/index.js';

import type { OrdreAuxClients, RapportDesClients, ReponseDesClients } from './clients.ts';
import { DRAPEAU_DES_CLIENTS } from './clients.ts';
import type { VerdictDeTenue } from './seuils.ts';
import { debitKoParSeconde, megabitsParSeconde, verdictDeTenue } from './seuils.ts';
import type { Resume } from './statistiques.ts';
import { resumer } from './statistiques.ts';

/** Delai au-dela duquel un processus de clients est considere comme perdu. */
const DELAI_PROCESSUS_MS = 120_000;

/** Temps de jeu garde en reserve apres la mesure, pour qu'aucune partie ne finisse pendant. */
const RESERVE_DE_JEU_S = 10;

/** Duree minimum d'une partie acceptee par le serveur (BORNES_REGLAGES.dureePartieS). */
const DUREE_PARTIE_MINIMUM_S = 30;

/** Ce qu'il faut pour jouer une charge. */
export interface OptionsChargeReseau {
  /** Nombre de parties simultanees. */
  readonly rooms: number;
  /** Joueurs par partie. Douze, la capacite du Classique, pour une partie pleine. */
  readonly joueursParRoom: number;
  /**
   * Bots par partie, dans les bornes du salon: le serveur refuse au-dela. Plusieurs
   * nombres sont attribues aux parties a tour de role (voir botsDeLaRoom).
   */
  readonly bots: readonly number[];
  /** Temps de jeu laisse passer apres le lancement, avant de mesurer, en secondes. */
  readonly echauffementS: number;
  /** Duree de la fenetre de mesure, en secondes. */
  readonly dureeMesureS: number;
  /** Nombre de processus entre lesquels les clients sont repartis. */
  readonly processusClients: number;
  /** Graine des intentions des clients simules. */
  readonly graine: number;
}

/** Ce que la charge a mesure. Durees en millisecondes, tailles en octets. */
export interface ResultatChargeReseau {
  readonly rooms: number;
  readonly joueursParRoom: number;
  readonly bots: readonly number[];
  readonly clients: number;
  readonly dureeMesureS: number;
  /** Duree d'un battement complet d'une partie, cote serveur: moteur puis diffusion. */
  readonly battementMs: Resume;
  /** Ecart entre deux battements successifs d'une meme partie. */
  readonly intervalleMs: Resume;
  /** Frequence reelle de battement, une valeur par partie. */
  readonly frequenceParPartieHz: Resume;
  /** Retard de la boucle d'evenements du serveur. */
  readonly retardBoucleMs: { readonly p50: number; readonly p99: number; readonly maximum: number };
  /**
   * Part du temps ou le fil du serveur a travaille, en pour cent.
   *
   * Proche de cent, le fil est plein: le calcul sature. Nettement en dessous alors
   * que les battements prennent du retard, la cause est ailleurs que dans le
   * calcul (programmation des minuteries, ramasse-miettes).
   */
  readonly utilisationBouclePourCent: number;
  /**
   * Les pauses du ramasse-miettes pendant la mesure: leur nombre, leur duree totale
   * en pour cent de la fenetre, et la plus longue, en millisecondes. Une pause
   * arrete tout le fil, battements compris.
   */
  readonly ramasseMiettes: {
    readonly pauses: number;
    readonly partDuTempsPourCent: number;
    readonly plusLongueMs: number;
  };
  /** Processeur consomme par le processus du serveur, en pour cent d'un coeur. */
  readonly processeurServeurPourCent: number;
  /** Cout moyen d'une partie par battement: processeur du serveur divise par les battements. */
  readonly processeurParPartieMs: number;
  readonly memoireRssMo: number;
  readonly tasUtiliseMo: number;
  /** Taille moyenne d'un instantane recu, sur le fil. */
  readonly octetsParMessage: number;
  /** Instantanes recus par client et par seconde. */
  readonly messagesParClientHz: number;
  /** Debit descendant d'un client, tous messages confondus, en kilo-octets par seconde. */
  readonly debitParClientKoS: number;
  /** Debit sortant total du serveur vers les clients, en megabits par seconde. */
  readonly debitSortantMbitS: number;
  /** Intentions recues par le serveur, par seconde. */
  readonly intentionsParSeconde: number;
  /** Ecart entre deux instantanes recus par un meme client. */
  readonly intervalleReceptionMs: Resume;
  /** Processeur de chaque processus de clients, en pour cent d'un coeur. */
  readonly processeurClientsPourCent: readonly number[];
  readonly deconnexions: number;
  readonly verdict: VerdictDeTenue;
}

/** Les battements d'une partie, notes par l'horloge instrumentee. */
interface BoucleObservee {
  readonly debuts: number[];
  readonly durees: number[];
}

/**
 * Le releve des battements de toutes les parties.
 *
 * Il ne note que pendant la fenetre de mesure: la mise en route, le decompte et
 * l'echauffement ne comptent pas.
 */
interface Releve {
  actif: boolean;
  readonly boucles: BoucleObservee[];
}

/**
 * L'horloge du systeme, enveloppee pour noter chaque battement de partie.
 *
 * Seuls les rappels repetes a la cadence des battements sont notes: c'est la
 * boucle de GameRoom. Le compte a rebours se repete chaque seconde et passe tel
 * quel.
 */
export function horlogeInstrumentee(releve: Releve): Horloge {
  return {
    maintenant: () => horlogeSysteme.maintenant(),
    repeter: (rappel, intervalleMs) => {
      if (intervalleMs !== CADENCE_BATTEMENT_MS) {
        return horlogeSysteme.repeter(rappel, intervalleMs);
      }

      const boucle: BoucleObservee = { debuts: [], durees: [] };
      releve.boucles.push(boucle);

      return horlogeSysteme.repeter(() => {
        const debut = performance.now();
        rappel();

        if (releve.actif) {
          boucle.debuts.push(debut);
          boucle.durees.push(performance.now() - debut);
        }
      }, intervalleMs);
    },
  };
}

/**
 * Repartit les parties entre les processus de clients, a tour de role.
 *
 * @returns Pour chaque processus, les rangs des parties dont il a la charge. Un
 *          processus sans partie n'est pas lance.
 */
export function repartir(rooms: number, processus: number): number[][] {
  const lots = Array.from(
    { length: Math.max(Math.min(processus, rooms), 1) },
    () => [] as number[],
  );

  for (let rang = 0; rang < rooms; rang += 1) {
    lots[rang % lots.length]?.push(rang);
  }

  return lots.filter((lot) => lot.length > 0);
}

/** Un processus de clients, et de quoi attendre ses reponses. */
interface ProcessusDeClients {
  readonly enfant: ChildProcess;
  attendre<T extends ReponseDesClients['type']>(
    type: T,
  ): Promise<Extract<ReponseDesClients, { type: T }>>;
  ordonner(ordre: OrdreAuxClients): void;
}

/** Lance un processus de clients. */
function lancerDesClients(): ProcessusDeClients {
  const enfant = fork(
    fileURLToPath(new URL('./clients.ts', import.meta.url)),
    [DRAPEAU_DES_CLIENTS],
    {
      execArgv: ['--disable-warning=ExperimentalWarning'],
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    },
  );

  return {
    enfant,
    ordonner: (ordre) => {
      enfant.send(ordre);
    },
    attendre: async (type) =>
      new Promise((resoudre, rejeter) => {
        const minuterie = setTimeout(() => {
          nettoyer();
          rejeter(new Error(`Le processus de clients n'a pas repondu « ${type} » a temps.`));
        }, DELAI_PROCESSUS_MS);

        const surMessage = (reponse: ReponseDesClients): void => {
          if (reponse.type === 'erreur') {
            nettoyer();
            rejeter(new Error(`Processus de clients: ${reponse.message}`));
            return;
          }

          if (reponse.type === type) {
            nettoyer();
            resoudre(reponse as Extract<ReponseDesClients, { type: typeof type }>);
          }
        };

        const surSortie = (code: number | null): void => {
          nettoyer();
          rejeter(new Error(`Le processus de clients s'est arrete (code ${String(code)}).`));
        };

        const nettoyer = (): void => {
          clearTimeout(minuterie);
          enfant.off('message', surMessage);
          enfant.off('exit', surSortie);
        };

        enfant.on('message', surMessage);
        enfant.on('exit', surSortie);
      }),
  };
}

/** Attend un temps donne, en millisecondes. */
async function patienter(dureeMs: number): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, dureeMs));
}

/**
 * Joue une charge et la mesure.
 *
 * Deroulement: le serveur demarre sur un port libre, les murs de la carte sont
 * decodes d'avance, les processus de clients creent et remplissent leurs parties,
 * puis toutes les parties sont lancees ensemble. Apres l'echauffement, la fenetre
 * de mesure s'ouvre des deux cotes a la fois; a sa fermeture, chacun rapporte, et
 * tout est ferme.
 */
export async function mesurerLaCharge(options: OptionsChargeReseau): Promise<ResultatChargeReseau> {
  const releve: Releve = { actif: false, boucles: [] };
  const terrains = new ChargeurDeTerrain();

  // Decoder l'image de collision coute plusieurs centaines de millisecondes. Le
  // faire ici plutot qu'a la creation de la premiere partie evite qu'un client
  // attende sa reponse pendant ce temps.
  terrains.charger({ carte: 'map1', modeMiroir: false });

  const serveur = await demarrerServeur(0, { horloge: horlogeInstrumentee(releve), terrains });
  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    await serveur.fermer();
    throw new Error("Le serveur mesure n'a pas d'adresse.");
  }

  const url = `http://127.0.0.1:${String(adresse.port)}`;
  const lots = repartir(options.rooms, options.processusClients);
  const processus = lots.map(() => lancerDesClients());

  try {
    const dureePartieS = Math.max(
      DUREE_PARTIE_MINIMUM_S,
      Math.ceil(options.echauffementS + options.dureeMesureS + RESERVE_DE_JEU_S),
    );

    await Promise.all(
      processus.map(async (clients, indice) => {
        clients.ordonner({
          type: 'preparer',
          url,
          rooms: lots[indice] ?? [],
          totalRooms: options.rooms,
          joueursParRoom: options.joueursParRoom,
          bots: options.bots,
          dureePartieS,
          graine: options.graine + indice,
        });
        await clients.attendre('prepare');
      }),
    );

    await Promise.all(
      processus.map(async (clients) => {
        clients.ordonner({ type: 'lancer' });
        await clients.attendre('lance');
      }),
    );

    await patienter(options.echauffementS * 1000);

    return await mesurerLaFenetre(options, releve, processus);
  } finally {
    for (const clients of processus) {
      if (clients.enfant.connected) {
        clients.ordonner({ type: 'fermer' });
      }
    }

    await Promise.all(
      processus.map(
        async (clients) =>
          new Promise<void>((resoudre) => {
            if (clients.enfant.exitCode !== null) {
              resoudre();
              return;
            }

            clients.enfant.once('exit', () => {
              resoudre();
            });
          }),
      ),
    );

    await serveur.fermer();
  }
}

/** Ouvre la fenetre de mesure des deux cotes, la referme, et rassemble les chiffres. */
async function mesurerLaFenetre(
  options: OptionsChargeReseau,
  releve: Releve,
  processus: readonly ProcessusDeClients[],
): Promise<ResultatChargeReseau> {
  // Une resolution d'une milliseconde: a dix, le retard mesure sur un serveur
  // presque au repos etait deja de douze millisecondes, c'est-a-dire surtout la
  // granularite de la mesure elle-meme.
  const retard = monitorEventLoopDelay({ resolution: 1 });

  // Chaque pause du ramasse-miettes arrive ici, peu apres avoir eu lieu.
  const pauses: number[] = [];
  const ramasseMiettes = new PerformanceObserver((liste) => {
    for (const entree of liste.getEntries()) {
      if (releve.actif) {
        pauses.push(entree.duration);
      }
    }
  });
  ramasseMiettes.observe({ entryTypes: ['gc'] });

  await Promise.all(
    processus.map(async (clients) => {
      clients.ordonner({ type: 'mesurer' });
      await clients.attendre('mesure');
    }),
  );

  const debut = performance.now();
  const processeurAuDebut = process.cpuUsage();
  const utilisationAuDebut = performance.eventLoopUtilization();
  releve.actif = true;
  retard.enable();

  await patienter(options.dureeMesureS * 1000);

  releve.actif = false;
  retard.disable();
  ramasseMiettes.disconnect();
  const dureeMs = performance.now() - debut;
  const processeur = process.cpuUsage(processeurAuDebut);
  const utilisation = performance.eventLoopUtilization(utilisationAuDebut);
  const memoire = process.memoryUsage();

  const rapports = await Promise.all(
    processus.map(async (clients) => {
      clients.ordonner({ type: 'rapporter' });
      return clients.attendre('rapport');
    }),
  );

  return assembler(options, releve, rapports, {
    dureeMs,
    processeurMs: (processeur.user + processeur.system) / 1000,
    retardBoucleMs: {
      p50: retard.percentile(50) / 1e6,
      p99: retard.percentile(99) / 1e6,
      maximum: retard.max / 1e6,
    },
    utilisationBouclePourCent: utilisation.utilization * 100,
    pausesRamasseMiettesMs: pauses,
    memoireRssMo: memoire.rss / 1024 / 1024,
    tasUtiliseMo: memoire.heapUsed / 1024 / 1024,
  });
}

/** Ce que le processus du serveur a releve sur lui-meme pendant la fenetre. */
interface ReleveDuServeur {
  readonly dureeMs: number;
  readonly processeurMs: number;
  readonly retardBoucleMs: ResultatChargeReseau['retardBoucleMs'];
  readonly utilisationBouclePourCent: number;
  /** Duree de chaque pause du ramasse-miettes pendant la fenetre, en millisecondes. */
  readonly pausesRamasseMiettesMs: readonly number[];
  readonly memoireRssMo: number;
  readonly tasUtiliseMo: number;
}

/** Rassemble les releves du serveur et des clients en un resultat. */
export function assembler(
  options: OptionsChargeReseau,
  releve: { readonly boucles: readonly BoucleObservee[] },
  rapports: readonly RapportDesClients[],
  serveur: ReleveDuServeur,
): ResultatChargeReseau {
  const secondes = serveur.dureeMs / 1000;
  const durees = releve.boucles.flatMap((boucle) => boucle.durees);
  const intervalles = releve.boucles.flatMap((boucle) =>
    boucle.debuts.slice(1).map((instant, rang) => instant - (boucle.debuts[rang] as number)),
  );
  const frequences = releve.boucles.map((boucle) => boucle.debuts.length / secondes);

  const clients = rapports.reduce((total, rapport) => total + rapport.clients, 0);
  const messages = rapports.reduce((total, rapport) => total + rapport.messagesEtat, 0);
  const octetsEtat = rapports.reduce((total, rapport) => total + rapport.octetsEtat, 0);
  const octetsAutres = rapports.reduce((total, rapport) => total + rapport.octetsAutres, 0);
  const intentions = rapports.reduce((total, rapport) => total + rapport.intentions, 0);
  const deconnexions = rapports.reduce((total, rapport) => total + rapport.deconnexions, 0);

  const octetsParMessage = messages === 0 ? 0 : octetsEtat / messages;
  const messagesParClientHz = clients === 0 ? 0 : messages / clients / secondes;
  const debitParClientKoS =
    clients === 0 ? 0 : debitKoParSeconde((octetsEtat + octetsAutres) / clients, 1 / secondes);

  const frequenceParPartieHz = resumer(frequences);
  const intervalleMs = resumer(intervalles);

  return {
    rooms: options.rooms,
    joueursParRoom: options.joueursParRoom,
    bots: options.bots,
    clients,
    dureeMesureS: secondes,
    battementMs: resumer(durees),
    intervalleMs,
    frequenceParPartieHz,
    retardBoucleMs: serveur.retardBoucleMs,
    utilisationBouclePourCent: serveur.utilisationBouclePourCent,
    ramasseMiettes: {
      pauses: serveur.pausesRamasseMiettesMs.length,
      partDuTempsPourCent:
        (serveur.pausesRamasseMiettesMs.reduce((total, pause) => total + pause, 0) /
          serveur.dureeMs) *
        100,
      plusLongueMs: serveur.pausesRamasseMiettesMs.reduce(
        (plusLongue, pause) => Math.max(plusLongue, pause),
        0,
      ),
    },
    processeurServeurPourCent: (serveur.processeurMs / serveur.dureeMs) * 100,
    processeurParPartieMs: durees.length === 0 ? 0 : serveur.processeurMs / durees.length,
    memoireRssMo: serveur.memoireRssMo,
    tasUtiliseMo: serveur.tasUtiliseMo,
    octetsParMessage,
    messagesParClientHz,
    debitParClientKoS,
    debitSortantMbitS: megabitsParSeconde(debitParClientKoS * clients),
    intentionsParSeconde: intentions / secondes,
    intervalleReceptionMs: mergerLesIntervalles(rapports),
    processeurClientsPourCent: rapports.map((rapport) => rapport.processeurPourCent),
    deconnexions,
    verdict: verdictDeTenue({
      frequenceMinimumHz: frequenceParPartieHz.minimum,
      intervalleP99Ms: intervalleMs.p99,
      deconnexions,
    }),
  };
}

/**
 * L'ecart de reception le plus defavorable entre les processus de clients.
 *
 * Chaque processus resume ses propres ecarts; les resumes ne s'additionnent pas.
 * On garde, pour chaque centile, la valeur du processus le plus mal servi: c'est
 * une borne haute honnete de ce que vit un client.
 */
function mergerLesIntervalles(rapports: readonly RapportDesClients[]): Resume {
  const resumes = rapports.map((rapport) => rapport.intervalleReceptionMs);
  const pire = (champ: keyof Resume): number =>
    resumes.reduce((valeur, resume) => Math.max(valeur, resume[champ]), 0);

  const nombre = resumes.reduce((total, resume) => total + resume.nombre, 0);
  const moyenne =
    nombre === 0
      ? 0
      : resumes.reduce((total, resume) => total + resume.moyenne * resume.nombre, 0) / nombre;

  return {
    nombre,
    moyenne,
    p50: pire('p50'),
    p95: pire('p95'),
    p99: pire('p99'),
    minimum: resumes.reduce((valeur, resume) => Math.min(valeur, resume.minimum), Infinity),
    maximum: pire('maximum'),
  };
}
