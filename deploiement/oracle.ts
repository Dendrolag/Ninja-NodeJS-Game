/**
 * La mise en ligne d'essai: le serveur de jeu sur la machine Oracle (etape 5.9).
 *
 * LANCE PAR LA CI, a cote de la mise en ligne de la production et sans la bloquer
 * (.github/workflows/ci.yml, job « Essai sur Oracle »). Render reste la production:
 * rien de ce que voient les joueurs de ninja.dendrolag.fr ne passe par ici.
 *
 * LA MACHINE SERT ELLE-MEME LA PAGE DE L'ESSAI, a l'adresse du serveur. Une page
 * Vercel non promue n'aurait pu se jouer qu'avec un compte Vercel (le projet protege
 * toute adresse autre que son domaine public), et son adresse aurait change a
 * chaque commit.
 *
 * L'ENCHAINEMENT, EN BLEU ET VERT. Le serveur en service tourne dans un
 * emplacement; celui de ce commit demarre dans l'autre:
 *   1. les sources du commit sont envoyees a la machine, qui en construit l'image;
 *   2. le nouveau serveur demarre dans l'emplacement libre, migre la base de
 *      l'essai, et doit rendre sa version sur /sante, sur la machine;
 *   3. Caddy bascule vers lui;
 *   4. l'adresse publique doit rendre la version et la page du commit;
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
import { fileURLToPath, pathToFileURL } from 'node:url';

import { dateDuCommit, lireLaPage, raisonDeNePasMettreEnLigne } from './deployer.ts';
import type { PageLue } from './verifications.ts';
import { problemesDeLaPage, problemesDeSante } from './verifications.ts';

/** Les deux emplacements de la machine. */
export type Emplacement = 'bleu' | 'vert';

/** Ce que la mise en ligne demande a la machine: les commandes de neon-ninja.sh. */
export interface MachineOracle {
  /** Envoie les sources du commit, et en construit l'image. */
  construire(version: string, horodatage: string | undefined): Promise<void>;
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

/** Combien de fois reposer une question, et a quel intervalle. */
export interface Rythme {
  readonly essais: number;
  readonly intervalleMs: number;
}

/** Ce dont la mise en ligne a besoin du monde exterieur. */
export interface DependancesOracle {
  readonly machine: MachineOracle;
  /** La reponse de /sante a l'adresse publique. */
  lireLaSantePublique(): Promise<unknown>;
  /** La page et son code a l'adresse publique. */
  lireLaPagePublique(): Promise<PageLue>;
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
 * Ce que la machine recoit du commit: de quoi installer, compiler et empaqueter,
 * et rien d'autre. Ni la documentation, ni les tests, ni legacy/.
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

/**
 * Repose une verification jusqu'a ce qu'elle ne trouve plus rien, au rythme dit.
 *
 * @returns Les problemes du dernier essai, aucun si la verification a fini par passer.
 */
export async function problemesApresPatience(
  quoi: string,
  verification: () => Promise<readonly string[]>,
  rythme: Rythme,
  attendre: (ms: number) => Promise<void>,
): Promise<readonly string[]> {
  let problemes: readonly string[] = [];

  for (let essai = 1; essai <= rythme.essais; essai += 1) {
    try {
      problemes = await verification();
    } catch (erreur) {
      problemes = [
        `${quoi} ne repond pas: ${erreur instanceof Error ? erreur.message : String(erreur)}`,
      ];
    }

    if (problemes.length === 0) {
      return [];
    }

    if (essai < rythme.essais) {
      await attendre(rythme.intervalleMs);
    }
  }

  return problemes;
}

/** Ce qui ne va pas a l'adresse publique: la version du serveur, puis la page. */
async function problemesALAdressePublique(
  dependances: DependancesOracle,
  version: string,
): Promise<readonly string[]> {
  const sante = problemesDeSante(await dependances.lireLaSantePublique(), version);

  return sante.length > 0
    ? sante
    : problemesDeLaPage(await dependances.lireLaPagePublique(), undefined, version);
}

/** Met ce commit en ligne sur la machine Oracle, en bleu et vert. */
export async function mettreEnLigneSurOracle(
  version: string,
  horodatage: string | undefined,
  dependances: DependancesOracle,
  rythmes: { readonly demarrage: Rythme; readonly adressePublique: Rythme } = {
    demarrage: RYTHME_DU_DEMARRAGE,
    adressePublique: RYTHME_DE_L_ADRESSE_PUBLIQUE,
  },
): Promise<void> {
  const { machine, ecrire } = dependances;

  ecrire(`\n== Construction de l'image du commit ${version} sur la machine\n`);
  await machine.construire(version, horodatage);

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
    async () => problemesALAdressePublique(dependances, version),
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
    async construire(version, horodatage) {
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

      await demander(
        ['construire', version, ...(horodatage === undefined ? [] : [horodatage])],
        archive.stdout,
        true,
      );
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

/** Lit une variable d'environnement obligatoire. */
function variable(nom: string): string {
  const valeur = process.env[nom]?.trim();

  if (valeur === undefined || valeur === '') {
    throw new Error(`${nom} doit etre definie pour mettre en ligne sur Oracle.`);
  }

  return valeur;
}

// Lance directement (« node deploiement/oracle.ts »), le script lit sa
// configuration dans l'environnement: VERSION_DU_JEU, ORACLE_HOTE et ORACLE_CLE,
// le fichier de la cle privee de la CI.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  try {
    const version = variable('VERSION_DU_JEU');
    const hote = variable('ORACLE_HOTE');
    const origine = `https://${hote}`;

    process.stdout.write('\n== Faut-il mettre en ligne sur Oracle\n');
    const raison = await raisonDeNePasMettreEnLigne(origine, version);

    if (raison === undefined) {
      await mettreEnLigneSurOracle(version, await dateDuCommit(version), {
        machine: machineParSsh({
          hote,
          utilisateur: 'deploiement',
          cle: variable('ORACLE_CLE'),
          hotesConnus: join(dirname(fileURLToPath(import.meta.url)), 'oracle', 'hote-connu'),
        }),
        lireLaSantePublique: async () =>
          (await fetch(`${origine}/sante`, { cache: 'no-store' })).json() as Promise<unknown>,
        lireLaPagePublique: async () => lireLaPage(origine),
        attendre: async (ms) => patienter(ms),
        ecrire: (texte) => process.stdout.write(texte),
      });
    } else {
      process.stdout.write(`\n== Rien a mettre en ligne sur Oracle: ${raison}\n`);
    }
  } catch (erreur) {
    process.stderr.write(
      `\nMise en ligne d'essai arretee: ${erreur instanceof Error ? erreur.message : String(erreur)}\n`,
    );
    process.exitCode = 1;
  }
}
