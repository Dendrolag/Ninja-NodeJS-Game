/**
 * Le serveur de jeu sur la machine Oracle (etape 5.9, production depuis l'etape
 * 5.13).
 *
 * LANCE PAR LA MISE EN LIGNE (deploiement/deployer.ts), comme serveur de la
 * production ou comme secours, selon le serveur que joint la page publique. La
 * machine ne sert plus de page depuis l'etape 5.13: la seule page publique est
 * celle de Vercel.
 *
 * L'ENCHAINEMENT, EN BLEU ET VERT. Le serveur en service tourne dans un
 * emplacement; celui de ce commit demarre dans l'autre:
 *   1. les sources du commit sont envoyees a la machine, qui en construit l'image;
 *   2. le nouveau serveur demarre dans l'emplacement libre, migre la base, et doit
 *      rendre sa version sur /sante, sur la machine;
 *   3. Caddy bascule vers lui;
 *   4. l'adresse publique doit rendre la version du commit;
 *   5. l'ancien serveur s'arrete, les images inutiles sont retirees.
 * Si le nouveau ne repond pas en 2, il est arrete et l'ancien n'a jamais cesse de
 * servir. Si l'adresse publique ne suit pas en 4, Caddy revient a l'ancien.
 *
 * LA CI N'A SUR LA MACHINE QUE LES COMMANDES DE deploiement/oracle/neon-ninja.sh,
 * imposees a sa cle SSH. L'identite de la machine est epinglee dans
 * deploiement/oracle/hote-connu: une machine qui en changerait est refusee.
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { setTimeout as patienter } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import type { Rythme } from './patience.ts';
import { problemesApresPatience } from './patience.ts';
import { problemesDeSante } from './verifications.ts';

/** Les deux emplacements de la machine. */
export type Emplacement = 'bleu' | 'vert';

/** Ce que la mise en ligne demande a la machine: les commandes de neon-ninja.sh. */
export interface MachineOracle {
  /** Envoie les sources du commit, et en construit l'image. */
  construire(version: string): Promise<void>;
  /** L'emplacement que Caddy sert, ou rien avant la premiere mise en ligne. */
  actif(): Promise<Emplacement | undefined>;
  demarrer(emplacement: Emplacement, version: string): Promise<void>;
  /** La reponse de /sante du serveur de cet emplacement, lue sur la machine. */
  sante(emplacement: Emplacement): Promise<unknown>;
  /** Caddy sert desormais cet emplacement. */
  basculer(emplacement: Emplacement): Promise<void>;
  arreter(emplacement: Emplacement): Promise<void>;
  /** Les dernieres lignes ecrites par le serveur de cet emplacement. */
  journal(emplacement: Emplacement): Promise<string>;
  /** Retire les images qui ne servent plus. */
  nettoyer(): Promise<void>;
}

/** Ce dont la mise en ligne a besoin du monde exterieur. */
export interface DependancesOracle {
  readonly machine: MachineOracle;
  /** La reponse de /sante a l'adresse publique. */
  lireLaSantePublique(): Promise<unknown>;
  attendre(ms: number): Promise<void>;
  ecrire(texte: string): void;
}

/**
 * Le temps laisse au nouveau serveur pour repondre sur la machine: il migre la base
 * et decode les murs des cartes avant d'ouvrir son port. Trois minutes.
 */
export const RYTHME_DU_DEMARRAGE: Rythme = { essais: 60, intervalleMs: 3_000 };

/** Le temps laisse a l'adresse publique pour suivre la bascule. Une minute. */
export const RYTHME_DE_L_ADRESSE_PUBLIQUE: Rythme = { essais: 12, intervalleMs: 5_000 };

/**
 * Ce que la machine recoit du commit: de quoi installer et compiler le serveur, et
 * rien d'autre. Ni la documentation, ni les tests, ni legacy/.
 */
export const SOURCES_DE_L_IMAGE: readonly string[] = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'tsconfig.json',
  'packages',
  'assets',
  'deploiement/oracle/Dockerfile',
];

/** L'emplacement que nomme la sortie de « neon-ninja actif », ou rien. */
export function emplacementLu(sortie: string): Emplacement | undefined {
  const mot = sortie.trim();

  return mot === 'bleu' || mot === 'vert' ? mot : undefined;
}

/** L'emplacement ou demarre le nouveau serveur: celui que Caddy ne sert pas. */
export function emplacementLibre(actif: Emplacement | undefined): Emplacement {
  return actif === 'bleu' ? 'vert' : 'bleu';
}

/** Met ce commit en ligne sur la machine Oracle, en bleu et vert. */
export async function mettreEnLigneSurOracle(
  version: string,
  dependances: DependancesOracle,
  rythmes: { readonly demarrage: Rythme; readonly adressePublique: Rythme } = {
    demarrage: RYTHME_DU_DEMARRAGE,
    adressePublique: RYTHME_DE_L_ADRESSE_PUBLIQUE,
  },
): Promise<void> {
  const { machine, ecrire } = dependances;

  ecrire(`\n== Construction de l'image du commit ${version} sur la machine\n`);
  await machine.construire(version);

  const ancien = await machine.actif();
  const nouveau = emplacementLibre(ancien);
  ecrire(
    `\n== Demarrage dans l'emplacement ${nouveau}${ancien === undefined ? '' : `, ${ancien} reste en service`}\n`,
  );
  await machine.demarrer(nouveau, version);

  const auDemarrage = await problemesApresPatience(
    'Le nouveau serveur',
    async () => problemesDeSante(await machine.sante(nouveau), version),
    rythmes.demarrage,
    async (ms) => dependances.attendre(ms),
  );

  if (auDemarrage.length > 0) {
    ecrire(`\nJournal du nouveau serveur:\n${await machine.journal(nouveau)}\n`);
    await machine.arreter(nouveau);
    throw new Error(
      `Le nouveau serveur n'a pas repondu: ${auDemarrage.join(' ')} Il est arrete; ${ancien === undefined ? "aucun serveur n'etait en service" : `l'ancien (${ancien}) n'a pas cesse de servir`}.`,
    );
  }

  ecrire(`\n== Bascule de Caddy vers ${nouveau}\n`);
  await machine.basculer(nouveau);

  const enPublic = await problemesApresPatience(
    "L'adresse publique",
    async () => problemesDeSante(await dependances.lireLaSantePublique(), version),
    rythmes.adressePublique,
    async (ms) => dependances.attendre(ms),
  );

  if (enPublic.length > 0) {
    if (ancien === undefined) {
      throw new Error(
        `L'adresse publique ne suit pas: ${enPublic.join(' ')} Le nouveau serveur reste en place, pour le diagnostic: il n'y en avait pas d'autre.`,
      );
    }

    await machine.basculer(ancien);
    await machine.arreter(nouveau);
    throw new Error(
      `L'adresse publique ne suit pas: ${enPublic.join(' ')} Caddy est revenu a l'ancien serveur (${ancien}), le nouveau est arrete.`,
    );
  }

  if (ancien !== undefined) {
    ecrire(`\n== Arret de l'ancien serveur (${ancien})\n`);
    await machine.arreter(ancien);
  }

  await machine.nettoyer();
  ecrire(`\n== Commit ${version} en ligne sur la machine Oracle\n`);
}

/** Comment joindre la machine par SSH. */
export interface AccesSsh {
  /** Le nom de la machine, par exemple serveur.ninja.dendrolag.fr. */
  readonly hote: string;
  /** Le compte de mise en ligne. */
  readonly utilisateur: string;
  /** Le fichier de la cle privee. Jamais affiche. */
  readonly cle: string;
  /** Le fichier qui epingle l'identite de la machine. */
  readonly hotesConnus: string;
}

/**
 * Les arguments de ssh pour demander une commande a la machine.
 *
 * Sans question (BatchMode), et seulement a la machine epinglee: une identite
 * inconnue ou changee arrete tout, au lieu d'etre acceptee.
 */
export function argumentsSsh(acces: AccesSsh, commande: readonly string[]): readonly string[] {
  return [
    '-i',
    acces.cle,
    '-o',
    'BatchMode=yes',
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    `UserKnownHostsFile=${acces.hotesConnus}`,
    '-o',
    'ConnectTimeout=20',
    `${acces.utilisateur}@${acces.hote}`,
    ...commande,
  ];
}

/**
 * Lance un programme, et rend ce qu'il ecrit. Ses erreurs passent a l'ecran.
 *
 * @param entree  Ce qu'il lit sur son entree standard, s'il lit quelque chose.
 * @param afficher Recopie aussi sa sortie a l'ecran, au fil de l'eau.
 */
function lancer(
  programme: string,
  argumentsDuProgramme: readonly string[],
  entree?: Readable,
  afficher = false,
): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const processus = spawn(programme, argumentsDuProgramme, {
      stdio: [entree === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
    });
    let sortie = '';

    if (entree !== undefined && processus.stdin !== null) {
      entree.pipe(processus.stdin);
    }

    processus.stdout?.setEncoding('utf8');
    processus.stdout?.on('data', (morceau: string) => {
      sortie += morceau;

      if (afficher) {
        process.stdout.write(morceau);
      }
    });
    processus.on('error', rejeter);
    processus.on('close', (code) => {
      if (code === 0) {
        resoudre(sortie);
      } else {
        rejeter(
          new Error(
            `${programme} a echoue (code ${String(code)}): ${argumentsDuProgramme.slice(-3).join(' ')}.`,
          ),
        );
      }
    });
  });
}

/** La machine, jointe par SSH avec la cle de la CI. */
export function machineParSsh(acces: AccesSsh): MachineOracle {
  const demander = async (
    commande: readonly string[],
    entree?: Readable,
    afficher = false,
  ): Promise<string> => lancer('ssh', argumentsSsh(acces, commande), entree, afficher);

  return {
    async construire(version) {
      const archive = spawn(
        'git',
        ['archive', '--format=tar', version, '--', ...SOURCES_DE_L_IMAGE],
        {
          stdio: ['ignore', 'pipe', 'inherit'],
        },
      );
      const fin = new Promise<void>((resoudre, rejeter) => {
        archive.on('error', rejeter);
        archive.on('close', (code) => {
          if (code === 0) {
            resoudre();
          } else {
            rejeter(new Error(`git archive a echoue (code ${String(code)}).`));
          }
        });
      });

      await demander(['construire', version], archive.stdout, true);
      await fin;
    },
    async actif() {
      return emplacementLu(await demander(['actif']));
    },
    async demarrer(emplacement, version) {
      await demander(['demarrer', emplacement, version]);
    },
    async sante(emplacement) {
      return JSON.parse(await demander(['sante', emplacement])) as unknown;
    },
    async basculer(emplacement) {
      await demander(['basculer', emplacement], undefined, true);
    },
    async arreter(emplacement) {
      await demander(['arreter', emplacement]);
    },
    async journal(emplacement) {
      return demander(['journal', emplacement]);
    },
    async nettoyer() {
      await demander(['nettoyer']);
    },
  };
}

/** Ou trouver la machine de la production. */
export interface MachineDeLaProduction {
  /** Le nom de la machine, par exemple serveur.ninja.dendrolag.fr. */
  readonly hote: string;
  /** Le fichier de la cle privee de la CI. Jamais affiche. */
  readonly cle: string;
}

/**
 * La mise en ligne d'un commit sur la machine Oracle, jointe par SSH avec la cle de
 * la CI, telle que la mise en ligne de la production l'appelle.
 */
export function miseEnLigneOracle(
  acces: MachineDeLaProduction,
): (version: string) => Promise<void> {
  const origine = `https://${acces.hote}`;

  return async (version) =>
    mettreEnLigneSurOracle(version, {
      machine: machineParSsh({
        hote: acces.hote,
        utilisateur: 'deploiement',
        cle: acces.cle,
        hotesConnus: join(dirname(fileURLToPath(import.meta.url)), 'oracle', 'hote-connu'),
      }),
      lireLaSantePublique: async () =>
        (await fetch(`${origine}/sante`, { cache: 'no-store' })).json() as Promise<unknown>,
      attendre: async (ms) => patienter(ms),
      ecrire: (texte) => process.stdout.write(texte),
    });
}
