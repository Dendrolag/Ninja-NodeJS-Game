/**
 * La production est-elle a jour (etape 5.15): ce que Grafana ne sait pas verifier seul.
 *
 * LANCE PAR UN WORKFLOW PLANIFIE, toutes les heures (.github/workflows/production-a-jour.yml).
 * Il lit la page publique pour savoir quel serveur est la production, la version que ce
 * serveur dit servir, et l'historique de master. Il echoue, en disant pourquoi, si un commit
 * qui touche le jeu attend depuis plus d'une heure de partir en ligne: la mise en ligne de
 * la CI prend un quart d'heure, une heure de retard dit qu'elle a echoue ou n'a pas tourne.
 * GitHub previent par courriel d'un workflow planifie en echec.
 *
 * LA REGLE EST CELLE DE LA MISE EN LIGNE (verifications.ts, fichiersQuiChangentLeJeu): un
 * commit de documentation ne part pas en ligne, et ne met donc pas la production en retard.
 *
 * UNE FOIS PAR JOUR, LE SECOURS AUSSI. Render, en secours, doit etre a la version de la
 * production pour qu'une bascule soit possible. Le reveiller toutes les heures userait ses
 * heures gratuites: on ne le lit qu'une fois par jour (VERIFIER_LE_SECOURS=oui).
 *
 * Variables: PAGE_DU_JEU, ORACLE_HOTE, SERVEUR_RENDER, VERIFIER_LE_SECOURS (oui ou non).
 */

import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import type { NomDuServeur } from './miseEnLigne.ts';
import { autreServeur } from './miseEnLigne.ts';
import { arreter, lireLaVersionEnLigne, originesDesServeurs, variable } from './monde.ts';
import { lireLaPage } from './vercel.ts';
import { fichiersQuiChangentLeJeu, serveurJointParLaPage } from './verifications.ts';

/** Le temps laisse a la mise en ligne d'un commit, en millisecondes: une heure. */
export const DELAI_DE_MISE_EN_LIGNE_MS = 60 * 60_000;

/** Un commit de master qui n'est pas en ligne. */
export interface CommitAttendu {
  readonly commit: string;
  /** Sa date, en millisecondes depuis 1970. */
  readonly dateMs: number;
  readonly fichiers: readonly string[];
}

/** Ce qu'on a lu du monde. */
export interface EtatDeLaProduction {
  /** Le serveur que joint la page publique, ou rien si elle n'en joint aucun connu. */
  readonly production: NomDuServeur | undefined;
  /** La version que dit servir la production, ou rien si elle ne la dit pas. */
  readonly versionEnLigne: string | undefined;
  /** La tete de master. */
  readonly tete: string;
  /**
   * Les commits de master qui ne sont pas en ligne, du plus ancien au plus recent, ou rien si
   * git ne sait pas les dire (la version en ligne absente de l'historique).
   */
  readonly enAttente: readonly CommitAttendu[] | undefined;
  /** La date de la tete, en millisecondes, pour juger quand l'historique manque. */
  readonly dateDeLaTeteMs: number;
  readonly maintenantMs: number;
  /** La version du secours, quand on l'a lue: rien s'il n'a pas repondu. */
  readonly secours?: { readonly version: string | undefined };
}

/** Les problemes de la production, ou une liste vide si elle est a jour. */
export function problemesDeLaProduction(etat: EtatDeLaProduction): string[] {
  if (etat.production === undefined) {
    return ['la page publique ne joint aucun des deux serveurs de jeu.'];
  }

  if (etat.versionEnLigne === undefined) {
    return [`la production (${etat.production}) ne dit pas sa version.`];
  }

  const problemes: string[] = [];
  const retard = commitEnRetard(etat);

  if (retard !== undefined) {
    problemes.push(
      `la production (${etat.production}) sert ${etat.versionEnLigne}, et ${retard} attend depuis plus d'une heure de partir en ligne.`,
    );
  }

  if (etat.secours !== undefined && etat.secours.version !== etat.versionEnLigne) {
    const secours = autreServeur(etat.production);
    problemes.push(
      etat.secours.version === undefined
        ? `le secours (${secours}) ne dit pas sa version.`
        : `le secours (${secours}) sert ${etat.secours.version}, la production ${etat.versionEnLigne}: une bascule refuserait.`,
    );
  }

  return problemes;
}

/** Le commit qui touche le jeu et attend depuis trop longtemps, ou rien. */
function commitEnRetard(etat: EtatDeLaProduction): string | undefined {
  if (etat.versionEnLigne === etat.tete) {
    return undefined;
  }

  // Sans historique, dans le doute, on juge sur la tete, comme la mise en ligne qui part.
  if (etat.enAttente === undefined) {
    return etat.maintenantMs - etat.dateDeLaTeteMs > DELAI_DE_MISE_EN_LIGNE_MS
      ? `la tete de master ${etat.tete}`
      : undefined;
  }

  const premier = etat.enAttente.find(
    (commit) => fichiersQuiChangentLeJeu(commit.fichiers).length > 0,
  );

  return premier !== undefined && etat.maintenantMs - premier.dateMs > DELAI_DE_MISE_EN_LIGNE_MS
    ? `le commit ${premier.commit}, qui touche le jeu,`
    : undefined;
}

/** Lance git, et rend ce qu'il ecrit, ou rien s'il echoue. */
async function git(argumentsDeGit: readonly string[]): Promise<string | undefined> {
  return new Promise((resoudre) => {
    execFile('git', argumentsDeGit, { maxBuffer: 16 * 1024 * 1024 }, (erreur, sortie) => {
      resoudre(erreur === null ? sortie : undefined);
    });
  });
}

/**
 * Lit la sortie de « git log --name-only --format=@%H %ct »: un commit par bloc, sa ligne
 * d'en-tete puis ses fichiers. Rendue du plus ancien au plus recent.
 */
export function lireLeJournalGit(sortie: string): CommitAttendu[] {
  const commits: { commit: string; dateMs: number; fichiers: string[] }[] = [];

  for (const ligne of sortie.split('\n').map((brute) => brute.trim())) {
    const entete = /^@([0-9a-f]{40}) (\d+)$/u.exec(ligne);

    if (entete !== null) {
      commits.push({ commit: entete[1] ?? '', dateMs: Number(entete[2]) * 1000, fichiers: [] });
    } else if (ligne !== '') {
      commits.at(-1)?.fichiers.push(ligne);
    }
  }

  return commits.reverse();
}

/** Lit le monde, juge, et echoue en disant pourquoi si la production n'est pas a jour. */
async function verifier(): Promise<void> {
  const origines = originesDesServeurs();
  const page = await lireLaPage(variable('PAGE_DU_JEU'));
  const production = serveurJointParLaPage(page.politique, origines);
  const versionEnLigne =
    production === undefined ? undefined : await lireLaVersionEnLigne(origines[production]);
  const tete = (await git(['rev-parse', 'HEAD']))?.trim() ?? '';
  const dateDeLaTete = Number((await git(['show', '-s', '--format=%ct', 'HEAD']))?.trim() ?? 0);
  const journal =
    versionEnLigne === undefined
      ? undefined
      : await git(['log', '--name-only', '--format=@%H %ct', `${versionEnLigne}..HEAD`]);
  const lireLeSecours = process.env['VERIFIER_LE_SECOURS'] === 'oui' && production !== undefined;

  const problemes = problemesDeLaProduction({
    production,
    versionEnLigne,
    tete,
    enAttente: journal === undefined ? undefined : lireLeJournalGit(journal),
    dateDeLaTeteMs: dateDeLaTete * 1000,
    maintenantMs: Date.now(),
    ...(lireLeSecours
      ? { secours: { version: await lireLaVersionEnLigne(origines[autreServeur(production)]) } }
      : {}),
  });

  process.stdout.write(
    `Production: ${production ?? 'inconnue'}, version ${versionEnLigne ?? 'inconnue'}; master: ${tete}.\n`,
  );

  if (problemes.length > 0) {
    throw new Error(problemes.join(' '));
  }

  process.stdout.write(
    lireLeSecours ? 'La production et le secours sont a jour.\n' : 'La production est a jour.\n',
  );
}

// Lance directement (« node deploiement/productionAJour.ts »), le script lit sa
// configuration dans l'environnement.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  try {
    await verifier();
  } catch (erreur) {
    arreter('Verification de la production', erreur);
  }
}
