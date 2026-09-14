/**
 * Ce que le deploiement verifie de ce qu'il vient de mettre en ligne (etape 5.3).
 *
 * FONCTIONS PURES. Elles lisent ce que les hebergeurs et les services en ligne ont
 * repondu, et disent ce qui ne va pas; deployer.ts pose les questions et s'arrete
 * au premier probleme. Rien ici ne touche au reseau: tout se teste.
 *
 * Le paquet partage est lu dans sa compilation, comme le fait le harnais de charge:
 * ce dossier est lance par Node lui-meme, hors de tout paquet. Compiler avant.
 */

import { politiqueDeContenu } from '../packages/shared/dist/index.js';

/** Ou en est un deploiement Render, du point de vue de celui qui l'attend. */
export type IssueDuDeploiement = 'enCours' | 'enLigne' | 'echoue';

/**
 * Les statuts d'un deploiement Render qui n'ont pas encore d'issue.
 *
 * Tout autre statut que ceux-ci et « live » arrete l'attente: un echec de
 * construction ou de demarrage, une annulation, ou un deploiement remplace par un
 * plus recent. Un statut que Render ajouterait un jour arrete aussi, en le nommant:
 * mieux vaut un deploiement arrete qu'une attente qui ne sait pas ce qu'elle attend.
 */
const STATUTS_EN_COURS: ReadonlySet<string> = new Set([
  'created',
  'queued',
  'build_in_progress',
  'update_in_progress',
  'pre_deploy_in_progress',
]);

/** L'issue d'un deploiement Render, d'apres son statut. */
export function issueDuDeploiement(statut: unknown): IssueDuDeploiement {
  if (statut === 'live') {
    return 'enLigne';
  }

  return typeof statut === 'string' && STATUTS_EN_COURS.has(statut) ? 'enCours' : 'echoue';
}

/** La version que dit servir la route de sante du serveur de jeu, ou rien si elle ne la dit pas. */
export function versionEnLigne(corps: unknown): string | undefined {
  if (typeof corps !== 'object' || corps === null) {
    return undefined;
  }

  const version = (corps as Record<string, unknown>)['version'];

  return typeof version === 'string' && version !== '' ? version : undefined;
}

/** Les dossiers dont rien ne part en ligne. */
const DOSSIERS_HORS_DU_JEU: readonly string[] = ['docs/', 'tests/', 'legacy/', '.claude/'];

/** Les fins de nom des fichiers qui ne partent jamais en ligne: la documentation et les tests. */
const FICHIERS_HORS_DU_JEU: readonly string[] = ['.md', '.test.ts', '.spec.ts'];

/**
 * Parmi ces fichiers changes, ceux qui composent le jeu en ligne ou sa mise en ligne.
 *
 * UNE MISE EN LIGNE COUPE LES PARTIES EN COURS: elle ne se justifie que si quelque
 * chose de ce qui tourne a change (recette de l'etape 5.4). La liste est ecrite a
 * l'envers, par ce qui ne part jamais en ligne: un fichier qu'elle ne connait pas
 * compte comme faisant partie du jeu, et, dans le doute, on met en ligne.
 */
export function fichiersQuiChangentLeJeu(fichiers: readonly string[]): readonly string[] {
  return fichiers.filter(
    (fichier) =>
      !DOSSIERS_HORS_DU_JEU.some((dossier) => fichier.startsWith(dossier)) &&
      !FICHIERS_HORS_DU_JEU.some((fin) => fichier.endsWith(fin)),
  );
}

/** Un objet JSON, lu sans rien supposer de ses champs. */
function objet(valeur: unknown): Record<string, unknown> | undefined {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : undefined;
}

/**
 * L'identifiant du deploiement Render de ce commit, dans une reponse de l'API.
 *
 * Render repond a une demande de deploiement par le deploiement cree; quand un
 * autre deploiement est deja en cours, il met la demande en file et ne rend rien.
 * Le deploiement se retrouve alors dans la liste des deploiements recents, ou chaque
 * element enveloppe un deploiement (« deploy ») avec son commit.
 *
 * @param reponse La reponse de la demande de deploiement, ou celle de la liste.
 * @param version Le commit deploye.
 */
export function deploiementDuCommit(reponse: unknown, version: string): string | undefined {
  const candidats = Array.isArray(reponse)
    ? reponse.map((element) => objet(objet(element)?.['deploy']))
    : [objet(reponse)];

  for (const deploiement of candidats) {
    const id = deploiement?.['id'];

    if (typeof id === 'string' && objet(deploiement?.['commit'])?.['id'] === version) {
      return id;
    }
  }

  return undefined;
}

/**
 * L'adresse d'un deploiement Vercel, dans ce que l'outil de Vercel ecrit.
 *
 * En mode non interactif, celui de la CI, l'outil ecrit un objet JSON dont
 * « deployment.url » est l'adresse (constate le 14 septembre 2026, version 59.16.0).
 * Un outil qui ecrirait encore l'ancien format, l'adresse seule sur sa ligne, est
 * lu aussi.
 *
 * @returns L'adresse, ou undefined si la sortie n'en porte aucune.
 */
export function adresseDuDeploiementVercel(sortie: string): string | undefined {
  try {
    const url = objet(objet(JSON.parse(sortie) as unknown)?.['deployment'])?.['url'];

    if (typeof url === 'string' && url.startsWith('https://')) {
      return url;
    }
  } catch {
    // Pas du JSON: l'ancien format, lu ci-dessous.
  }

  return sortie
    .split(/\r?\n/u)
    .map((ligne) => ligne.trim())
    .filter((ligne) => /^https:\/\/\S+$/u.test(ligne))
    .at(-1);
}

/**
 * Ce qui ne va pas dans la reponse de sante du serveur en ligne.
 *
 * @param corps   La reponse de /sante, lue comme du JSON.
 * @param version Le commit deploye.
 * @returns Les problemes, aucun si le serveur en ligne est bien de cette version.
 */
export function problemesDeSante(corps: unknown, version: string): readonly string[] {
  const lu = objet(corps);

  if (lu === undefined) {
    return ["La route de sante du serveur n'a pas rendu d'objet JSON."];
  }

  return lu['version'] === version
    ? []
    : [
        `Le serveur en ligne est de la version « ${String(lu['version'])} », attendu « ${version} ».`,
      ];
}

/** Ce que le deploiement a lu de la page publique. */
export interface PageLue {
  /** Le code HTTP de la page. */
  readonly statutDeLaPage: number;
  /** L'en-tete Content-Security-Policy de la page, s'il y en a un. */
  readonly politique: string | null;
  /** Le code HTTP de app.js. */
  readonly statutDuCode: number;
  /** Le contenu de app.js. */
  readonly code: string;
}

/**
 * Ce qui ne va pas dans la page publique.
 *
 * La page elle-meme ne change pas d'une version a l'autre: c'est app.js qui porte
 * la version et l'adresse du serveur, ecrites par l'empaqueteur. Les y trouver
 * prouve que l'adresse publique sert bien la page de ce commit.
 *
 * @returns Les problemes, aucun si la page est celle de ce commit.
 */
export function problemesDeLaPage(
  page: PageLue,
  serveurDeJeu: string,
  version: string,
): readonly string[] {
  const problemes: string[] = [];

  if (page.statutDeLaPage !== 200) {
    problemes.push(`La page repond ${String(page.statutDeLaPage)}, attendu 200.`);
  }

  if (page.politique !== politiqueDeContenu(serveurDeJeu)) {
    problemes.push(
      "La page ne porte pas la politique de securite qui l'ouvre au serveur de jeu, et a lui seul.",
    );
  }

  if (page.statutDuCode !== 200) {
    problemes.push(`app.js repond ${String(page.statutDuCode)}, attendu 200.`);
  } else if (!page.code.includes(version) || !page.code.includes(serveurDeJeu)) {
    problemes.push("app.js n'est pas celui de ce commit, ou ne vise pas ce serveur de jeu.");
  }

  return problemes;
}
