/**
 * La mise en ligne d'un commit: la page sur Vercel, le serveur de jeu sur Render
 * (etape 5.3).
 *
 * LANCE PAR LA CI, apres les deux jobs verts, sur la branche master seulement
 * (.github/workflows/ci.yml, job « Mise en ligne »). Il peut aussi se lancer a la
 * main, depuis la racine du depot compile, avec les memes variables; voir
 * docs/deploiement.md.
 *
 * L'ORDRE EST CELUI QUI LAISSE LE MOINS DE JOUEURS DEVANT UNE PAGE ET UN SERVEUR DE
 * VERSIONS DIFFERENTES:
 *   1. la page est empaquetee pour ce commit et envoyee a Vercel, sans etre promue:
 *      l'adresse publique sert toujours l'ancienne;
 *   2. le serveur de ce commit est deploye sur Render, et attendu jusqu'a ce qu'il
 *      soit en ligne; sa route de sante doit rendre la version du commit;
 *   3. la page est promue: l'adresse publique sert la nouvelle en quelques secondes;
 *   4. la page publique est verifiee: elle repond, porte la politique de securite
 *      qui l'ouvre au serveur de jeu, et son code est celui du commit.
 * Entre 2 et 3, une page ouverte sur l'ancienne version est refusee par le nouveau
 * serveur, avec le motif qui dit de recharger (packages/shared/src/version.ts).
 *
 * UN ECHEC ARRETE TOUT, ET LE DIT. Si le serveur ne se met pas en ligne, Render
 * garde l'ancien en service et la page n'est pas promue: rien n'a change pour les
 * joueurs.
 *
 * LES SECRETS NE PASSENT JAMAIS EN ARGUMENT. L'outil de Vercel lit VERCEL_TOKEN,
 * VERCEL_ORG_ID et VERCEL_PROJECT_ID dans l'environnement, qu'il herite; la cle de
 * Render ne sort que dans l'en-tete de ses requetes. Rien n'est affiche d'eux.
 */

import { execFile } from 'node:child_process';
import { setTimeout as patienter } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { preparerLaSortieVercel } from '../packages/client/scripts/sortieVercel.ts';
import type { PageLue } from './verifications.ts';
import {
  adresseDuDeploiementVercel,
  deploiementDuCommit,
  fichiersQuiChangentLeJeu,
  issueDuDeploiement,
  problemesDeLaPage,
  problemesDeSante,
  versionEnLigne,
} from './verifications.ts';

/** La version de l'outil de Vercel, epinglee: une mise a jour ne doit pas changer une mise en ligne. */
const OUTIL_VERCEL = 'vercel@59.16.0';

/** L'adresse de l'API de Render. */
const API_RENDER = 'https://api.render.com/v1';

/** Entre deux questions a Render sur un deploiement en cours. */
const INTERVALLE_RENDER_MS = 10_000;

/**
 * Le temps laisse au serveur pour se construire et demarrer. Une instance gratuite
 * installe les dependances et compile en quelques minutes; au-dela de vingt-cinq,
 * quelque chose ne va pas.
 */
const DELAI_RENDER_MS = 25 * 60_000;

/**
 * Le temps laisse au serveur de jeu pour dire sa version avant la mise en ligne. Il
 * dort peut-etre: il se reveille en quinze secondes, jusqu'a une minute selon Render.
 */
const DELAI_DE_REVEIL_MS = 90_000;

/** Combien de fois, et a quel intervalle, relire un service qui vient de changer de version. */
const ESSAIS_DE_VERIFICATION = 12;
const INTERVALLE_DE_VERIFICATION_MS = 5_000;

/** Ce qu'il faut pour mettre un commit en ligne. */
export interface ConfigurationDuDeploiement {
  /** Le commit a mettre en ligne. */
  readonly version: string;
  /** L'origine du serveur de jeu, par exemple https://neon-ninja.onrender.com. */
  readonly serveurDeJeu: string;
  /** L'origine publique de la page, par exemple https://neon-ninja.vercel.app. */
  readonly pageDuJeu: string;
  /** L'identifiant du service Render du serveur de jeu. */
  readonly serviceRender: string;
  /** La cle de l'API de Render. Un secret. */
  readonly cleRender: string;
}

/** Annonce une etape du deploiement. */
function annoncer(texte: string): void {
  process.stdout.write(`\n== ${texte}\n`);
}

/** Pose une question a l'API de Render, et rend sa reponse lue comme du JSON. */
async function demanderARender(
  configuration: ConfigurationDuDeploiement,
  methode: 'GET' | 'POST',
  chemin: string,
  corps?: unknown,
): Promise<unknown> {
  const reponse = await fetch(`${API_RENDER}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${configuration.cleRender}`,
      Accept: 'application/json',
      ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });
  const texte = await reponse.text();

  if (!reponse.ok) {
    throw new Error(`Render repond ${String(reponse.status)} a ${methode} ${chemin}: ${texte}`);
  }

  return texte === '' ? undefined : (JSON.parse(texte) as unknown);
}

/**
 * Lance l'outil de Vercel avec ces arguments, et rend ce qu'il ecrit.
 *
 * PAR NPX, ET NON PAR « PNPM DLX ». L'outil n'est pas une dependance du depot: il
 * tire une quarantaine de paquets dont le jeu n'a aucun usage. pnpm le range a sa
 * facon, stricte, et l'outil n'y retrouve pas l'une de ses propres dependances
 * (@vercel/cli-auth, constate le 14 septembre 2026); npx l'installe a plat, comme
 * il s'attend a l'etre.
 */
async function lancerVercel(argumentsVercel: readonly string[]): Promise<string> {
  const commande = ['--yes', OUTIL_VERCEL, ...argumentsVercel, '--non-interactive'];

  // Sous Windows, npx est un script de commandes que seul l'interpreteur sait
  // lancer. Aucun argument ne porte de secret.
  const [programme, argumentsDuProgramme] =
    process.platform === 'win32'
      ? ['cmd.exe', ['/d', '/s', '/c', 'npx', ...commande]]
      : ['npx', commande];

  return new Promise((resoudre, rejeter) => {
    execFile(
      programme,
      argumentsDuProgramme,
      { maxBuffer: 16 * 1024 * 1024 },
      (erreur, sortie, erreurs) => {
        process.stderr.write(erreurs);

        if (erreur !== null) {
          rejeter(new Error(`L'outil de Vercel a echoue (${argumentsVercel.join(' ')}).`));
          return;
        }

        resoudre(sortie);
      },
    );
  });
}

/** L'adresse du deploiement Vercel que l'outil vient de creer, ou un echec qui le dit. */
function adresseObligatoire(sortie: string): string {
  const adresse = adresseDuDeploiementVercel(sortie);

  if (adresse === undefined) {
    throw new Error("L'outil de Vercel n'a pas donne l'adresse du deploiement.");
  }

  return adresse;
}

/** Demande a Render de deployer ce commit, et rend l'identifiant du deploiement. */
async function deployerLeServeur(configuration: ConfigurationDuDeploiement): Promise<string> {
  const service = encodeURIComponent(configuration.serviceRender);
  const cree = await demanderARender(configuration, 'POST', `/services/${service}/deploys`, {
    commitId: configuration.version,
    clearCache: 'do_not_clear',
  });

  const id =
    deploiementDuCommit(cree, configuration.version) ??
    deploiementDuCommit(
      await demanderARender(configuration, 'GET', `/services/${service}/deploys?limit=10`),
      configuration.version,
    );

  if (id === undefined) {
    throw new Error(`Render n'a pas cree de deploiement pour le commit ${configuration.version}.`);
  }

  return id;
}

/** Attend que le deploiement du serveur soit en ligne, ou echoue en disant pourquoi. */
async function attendreLeServeur(
  configuration: ConfigurationDuDeploiement,
  deploiement: string,
): Promise<void> {
  const chemin = `/services/${encodeURIComponent(configuration.serviceRender)}/deploys/${encodeURIComponent(deploiement)}`;
  const limite = Date.now() + DELAI_RENDER_MS;
  let dernierStatut: unknown;

  while (Date.now() < limite) {
    const lu = await demanderARender(configuration, 'GET', chemin);
    const statut =
      typeof lu === 'object' && lu !== null ? (lu as Record<string, unknown>)['status'] : undefined;

    if (statut !== dernierStatut) {
      process.stdout.write(`Serveur de jeu: ${String(statut)}\n`);
      dernierStatut = statut;
    }

    const issue = issueDuDeploiement(statut);

    if (issue === 'enLigne') {
      return;
    }

    if (issue === 'echoue') {
      throw new Error(
        `Le deploiement ${deploiement} du serveur de jeu s'est arrete: ${String(statut)}. Journaux sur le tableau de bord de Render.`,
      );
    }

    await patienter(INTERVALLE_RENDER_MS);
  }

  throw new Error(
    `Le serveur de jeu n'est pas en ligne apres ${String(DELAI_RENDER_MS / 60_000)} minutes.`,
  );
}

/**
 * Repose une verification jusqu'a ce qu'elle ne trouve plus rien, ou abandonne.
 *
 * Un hebergeur qui vient de changer de version peut encore servir l'ancienne
 * quelques secondes: une verification qui echouerait au premier essai signalerait
 * une panne qui n'existe pas.
 */
async function verifierAvecPatience(
  quoi: string,
  verification: () => Promise<readonly string[]>,
): Promise<void> {
  let problemes: readonly string[] = [];

  for (let essai = 1; essai <= ESSAIS_DE_VERIFICATION; essai += 1) {
    try {
      problemes = await verification();
    } catch (erreur) {
      problemes = [`${quoi} ne repond pas: ${String(erreur)}`];
    }

    if (problemes.length === 0) {
      process.stdout.write(`${quoi}: conforme.\n`);
      return;
    }

    await patienter(INTERVALLE_DE_VERIFICATION_MS);
  }

  throw new Error(`${quoi} n'est pas conforme:\n- ${problemes.join('\n- ')}`);
}

/** Lit la page publique et son code, sans cache. */
async function lireLaPage(pageDuJeu: string): Promise<PageLue> {
  const page = await fetch(`${pageDuJeu}/`, { cache: 'no-store' });
  const code = await fetch(`${pageDuJeu}/app.js`, { cache: 'no-store' });

  return {
    statutDeLaPage: page.status,
    politique: page.headers.get('content-security-policy'),
    statutDuCode: code.status,
    code: await code.text(),
  };
}

/** La version que sert le serveur de jeu en ce moment, ou rien s'il ne la dit pas a temps. */
async function lireLaVersionEnLigne(serveurDeJeu: string): Promise<string | undefined> {
  try {
    const reponse = await fetch(`${serveurDeJeu}/sante`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_DE_REVEIL_MS),
    });

    return versionEnLigne((await reponse.json()) as unknown);
  } catch {
    return undefined;
  }
}

/**
 * Les fichiers changes d'un commit a l'autre, ou rien si git ne sait pas les comparer:
 * un commit absent de l'historique recupere, par exemple.
 */
async function fichiersChanges(
  depuis: string,
  jusqua: string,
): Promise<readonly string[] | undefined> {
  return new Promise((resoudre) => {
    execFile(
      'git',
      ['diff', '--name-only', depuis, jusqua],
      { maxBuffer: 16 * 1024 * 1024 },
      (erreur, sortie) => {
        resoudre(
          erreur === null
            ? sortie
                .split('\n')
                .map((ligne) => ligne.trim())
                .filter((ligne) => ligne !== '')
            : undefined,
        );
      },
    );
  });
}

/**
 * Pourquoi ce commit n'a pas a partir en ligne, ou rien s'il le doit.
 *
 * Il n'y part pas s'il y est deja, ni si rien de ce qui a change depuis la version en
 * ligne ne compose le jeu: une mise en ligne coupe les parties en cours. Dans le
 * doute (serveur muet, historique incomplet), il part.
 */
async function raisonDeNePasMettreEnLigne(
  serveurDeJeu: string,
  version: string,
): Promise<string | undefined> {
  const enLigne = await lireLaVersionEnLigne(serveurDeJeu);

  if (enLigne === undefined) {
    return undefined;
  }

  if (enLigne === version) {
    return `le commit ${version} est deja en ligne.`;
  }

  const changes = await fichiersChanges(enLigne, version);

  return changes !== undefined && fichiersQuiChangentLeJeu(changes).length === 0
    ? `depuis le commit en ligne ${enLigne}, seuls des fichiers sans effet sur le jeu ont change.`
    : undefined;
}

/** Met ce commit en ligne, page et serveur, en verifiant chaque etape. */
export async function deployer(configuration: ConfigurationDuDeploiement): Promise<void> {
  const { version, serveurDeJeu, pageDuJeu } = configuration;

  annoncer('Faut-il mettre en ligne');
  const raison = await raisonDeNePasMettreEnLigne(serveurDeJeu, version);

  if (raison !== undefined) {
    annoncer(`Rien a mettre en ligne: ${raison}`);
    return;
  }

  annoncer(`Preparation de la page du commit ${version}`);
  await preparerLaSortieVercel({ serveurDeJeu, version });

  annoncer('Envoi de la page a Vercel, sans la promouvoir');
  const deploiementDeLaPage = adresseObligatoire(
    await lancerVercel(['deploy', '--prebuilt', '--prod', '--skip-domain', '--yes']),
  );
  process.stdout.write(`Page envoyee: ${deploiementDeLaPage}\n`);

  annoncer('Deploiement du serveur de jeu sur Render');
  const deploiementDuServeur = await deployerLeServeur(configuration);
  process.stdout.write(`Deploiement Render: ${deploiementDuServeur}\n`);
  await attendreLeServeur(configuration, deploiementDuServeur);
  await verifierAvecPatience('Le serveur de jeu', async () => {
    const reponse = await fetch(`${serveurDeJeu}/sante`, { cache: 'no-store' });

    return problemesDeSante((await reponse.json()) as unknown, version);
  });

  annoncer('Promotion de la page');
  await lancerVercel(['promote', deploiementDeLaPage, '--yes']);
  await verifierAvecPatience('La page publique', async () =>
    problemesDeLaPage(await lireLaPage(pageDuJeu), serveurDeJeu, version),
  );

  annoncer(`Commit ${version} en ligne: ${pageDuJeu}`);
}

/** Lit une variable d'environnement obligatoire. */
function variable(nom: string): string {
  const valeur = process.env[nom]?.trim();

  if (valeur === undefined || valeur === '') {
    throw new Error(`${nom} doit etre definie pour mettre en ligne.`);
  }

  return valeur;
}

// Lance directement (« node deploiement/deployer.ts »), le script lit sa
// configuration dans l'environnement. L'outil de Vercel y trouve la sienne.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  for (const nom of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']) {
    variable(nom);
  }

  try {
    await deployer({
      version: variable('VERSION_DU_JEU'),
      serveurDeJeu: variable('SERVEUR_DE_JEU'),
      pageDuJeu: variable('PAGE_DU_JEU'),
      serviceRender: variable('RENDER_SERVICE_ID'),
      cleRender: variable('RENDER_API_KEY'),
    });
  } catch (erreur) {
    process.stderr.write(
      `\nMise en ligne arretee: ${erreur instanceof Error ? erreur.message : String(erreur)}\n`,
    );
    process.exitCode = 1;
  }
}
