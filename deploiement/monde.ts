/**
 * Ce que la mise en ligne et la bascule lisent du monde: git, les routes de sante
 * des serveurs de jeu, et leur configuration dans l'environnement (etape 5.13).
 *
 * La configuration n'a rien de secret hors des cles, qui restent dans
 * l'environnement: les adresses et les identifiants sont ecrits en clair dans les
 * workflows de la CI.
 */

import { execFile } from 'node:child_process';
import { setTimeout as patienter } from 'node:timers/promises';

import type { DependancesDeLaBascule, NomDuServeur } from './miseEnLigne.ts';
import { pageVercel } from './vercel.ts';
import { versionEnLigne } from './verifications.ts';

/**
 * Le temps laisse a un serveur de jeu pour dire sa version. Render gratuit dort
 * peut-etre: il se reveille en quinze secondes, jusqu'a une minute selon Render.
 */
const DELAI_DE_REVEIL_MS = 90_000;

/** Lance git, et rend ce qu'il ecrit, ou rien s'il echoue. */
async function git(argumentsDeGit: readonly string[]): Promise<string | undefined> {
  return new Promise((resoudre) => {
    execFile('git', argumentsDeGit, { maxBuffer: 16 * 1024 * 1024 }, (erreur, sortie) => {
      resoudre(erreur === null ? sortie : undefined);
    });
  });
}

/**
 * La date d'un commit, en ISO 8601, ou rien si git ne sait pas la dire.
 *
 * C'est elle que le pied de l'accueil presente au joueur (etape 8.4). On prend la
 * date du commit et non celle de la mise en ligne: les deux peuvent differer de
 * plusieurs heures, et c'est le code servi que la ligne doit decrire, pas le moment
 * ou il est parti.
 */
export async function dateDuCommit(commit: string): Promise<string | undefined> {
  const date = (await git(['show', '-s', '--format=%cI', commit]))?.trim();

  return date === undefined || date === '' ? undefined : date;
}

/**
 * Les fichiers changes d'un commit a l'autre, ou rien si git ne sait pas les comparer:
 * un commit absent de l'historique recupere, par exemple.
 */
export async function fichiersChanges(
  depuis: string,
  jusqua: string,
): Promise<readonly string[] | undefined> {
  return (await git(['diff', '--name-only', depuis, jusqua]))
    ?.split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== '');
}

/** Le commit des sources du depot, ou rien si git ne sait pas le dire. */
export async function commitDesSources(): Promise<string | undefined> {
  return (await git(['rev-parse', 'HEAD']))?.trim();
}

/** La version que sert ce serveur de jeu en ce moment, ou rien s'il ne la dit pas a temps. */
export async function lireLaVersionEnLigne(origine: string): Promise<string | undefined> {
  try {
    const reponse = await fetch(`${origine}/sante`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_DE_REVEIL_MS),
    });

    return versionEnLigne((await reponse.json()) as unknown);
  } catch {
    return undefined;
  }
}

/** Lit une variable d'environnement obligatoire. */
export function variable(nom: string): string {
  const valeur = process.env[nom]?.trim();

  if (valeur === undefined || valeur === '') {
    throw new Error(`${nom} doit etre definie.`);
  }

  return valeur;
}

/**
 * L'origine de chaque serveur de jeu: Oracle par le nom de sa machine
 * (ORACLE_HOTE), Render par son adresse (SERVEUR_RENDER).
 */
export function originesDesServeurs(): Readonly<Record<NomDuServeur, string>> {
  return {
    oracle: `https://${variable('ORACLE_HOTE')}`,
    render: variable('SERVEUR_RENDER'),
  };
}

/**
 * Ce que la bascule, et la mise en ligne, lisent et changent du monde: la page
 * publique (PAGE_DU_JEU) sur Vercel, dont l'outil lit sa configuration dans
 * l'environnement, et la version de chaque serveur de jeu.
 */
export function dependancesDuMonde(): DependancesDeLaBascule {
  for (const nom of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']) {
    variable(nom);
  }

  return {
    origines: originesDesServeurs(),
    page: pageVercel(variable('PAGE_DU_JEU'), dateDuCommit),
    versionEnLigne: lireLaVersionEnLigne,
    attendre: async (ms) => patienter(ms),
    ecrire: (texte) => process.stdout.write(texte),
  };
}

/** Ecrit l'erreur qui a arrete une commande, et la fait echouer. */
export function arreter(quoi: string, erreur: unknown): void {
  process.stderr.write(
    `\n${quoi} arretee: ${erreur instanceof Error ? erreur.message : String(erreur)}\n`,
  );
  process.exitCode = 1;
}
