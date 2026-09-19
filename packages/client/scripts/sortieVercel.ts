/**
 * La sortie Vercel: la page empaquetee et ses ressources, pretes a mettre en ligne
 * (etape 5.3).
 *
 * POURQUOI LA PAGE N'EST PAS SERVIE PAR LE SERVEUR DE JEU EN PRODUCTION. Le serveur
 * tourne sur une instance gratuite de Render: un petit processeur, et une mise en
 * veille apres quinze minutes sans visite. Lui faire envoyer 739 Ko de code et 19 Mo
 * de cartes et de sons prendrait au jeu le processeur dont il a besoin, et laisserait
 * le joueur devant un ecran blanc pendant le reveil. Vercel sert la page depuis son
 * reseau de diffusion, compressee, et tout de suite: la page dit alors elle-meme
 * qu'elle attend le serveur. Decision du 14 septembre 2026, au journal de conception.
 *
 * LE FORMAT EST CELUI DE VERCEL (Build Output API, version 3), dans .vercel/output
 * a la racine du depot:
 *
 *   static/       les fichiers servis tels quels: la page, et les ressources sous
 *                 /assets, a l'adresse que le client demande
 *   config.json   les en-tetes poses sur chaque reponse, dont la politique de
 *                 securite du contenu, ecrite par la meme fonction que celle du
 *                 serveur de developpement
 *
 * La mise en ligne elle-meme (« vercel deploy --prebuilt ») est l'affaire de
 * deploiement/deployer.ts.
 *
 * Ce script lit le paquet partage dans sa compilation: le lancer apres
 * « tsc --build ».
 */

import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { RACINE_RESSOURCES, politiqueDeContenu } from '@neon-ninja/shared';

import { ADRESSE_CANONIQUE, ALIAS_VERCEL } from './adresses.ts';
import { DOSSIER_WEB, empaqueterLeClient } from './empaqueter.ts';

/** La racine du depot. */
const RACINE_DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Le dossier des ressources du jeu, sur le disque. */
const DOSSIER_RESSOURCES = join(RACINE_DEPOT, 'assets');

/** Le dossier que « vercel deploy --prebuilt » met en ligne. */
export const DOSSIER_SORTIE_VERCEL = join(RACINE_DEPOT, '.vercel', 'output');

/** Une regle de routage de Vercel: des en-tetes sur les adresses qui correspondent. */
export type RouteVercel =
  | {
      readonly src: string;
      readonly has: readonly [{ readonly type: 'host'; readonly value: string }];
      readonly status: 308;
      readonly headers: { readonly Location: string };
    }
  | {
      readonly src: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly continue: true;
    }
  | { readonly handle: 'filesystem' };

/** Le fichier config.json de la sortie. */
export interface ConfigurationVercel {
  readonly version: 3;
  readonly routes: readonly RouteVercel[];
}

/** Ce que la sortie doit savoir de la mise en ligne. */
export interface OptionsSortieVercel {
  /** L'origine du serveur de jeu, par exemple https://neon-ninja.onrender.com. */
  readonly serveurDeJeu: string;
  /** Le commit dont la page est construite. */
  readonly version: string;
}

/**
 * La configuration de Vercel pour la page.
 *
 * Les polices portent une empreinte dans leur nom: elles ne changent jamais sous le
 * meme nom, et se gardent un an. Le reste (la page, app.js, les ressources) garde le
 * cache par defaut de Vercel, qui revalide a chaque visite: une page d'hier ne doit
 * pas survivre a la mise en ligne d'aujourd'hui. Les regles d'en-tetes passent
 * avant les fichiers, qu'elles laissent servir.
 *
 * La redirection de l'alias passe la premiere: une visite par l'alias repart vers
 * l'adresse canonique, chemin compris, sans rien servir. Elle est permanente (308),
 * pour que les moteurs de recherche reportent l'alias sur l'adresse canonique.
 *
 * @throws Si le serveur de jeu n'est pas une origine.
 */
export function configurationVercel(serveurDeJeu: string): ConfigurationVercel {
  return {
    version: 3,
    routes: [
      {
        src: '^/(.*)$',
        has: [{ type: 'host', value: ALIAS_VERCEL }],
        status: 308,
        headers: { Location: `${ADRESSE_CANONIQUE}/$1` },
      },
      {
        src: '/polices/(.*)',
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        continue: true,
      },
      {
        src: '/(.*)',
        headers: {
          'Content-Security-Policy': politiqueDeContenu(serveurDeJeu),
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        },
        continue: true,
      },
      { handle: 'filesystem' },
    ],
  };
}

/**
 * Un fichier de l'empaquetage part-il en ligne.
 *
 * Les cartes de sources restent sur la machine qui empaquette: elles donneraient a
 * lire tout le code du client, commentaires compris, a qui ouvre les outils du
 * navigateur, et le joueur n'en a aucun usage.
 */
export function fichierDeLaPagePublie(chemin: string): boolean {
  return extname(chemin) !== '.map';
}

/**
 * Une ressource du jeu part-elle en ligne.
 *
 * Les images de collision ne sont lues que par le serveur, qui en tire les murs;
 * le README decrit la provenance des ressources, il n'est pas une ressource.
 */
export function ressourcePubliee(chemin: string): boolean {
  const nom = basename(chemin);

  return nom !== 'collision.png' && extname(nom) !== '.md';
}

/** Empaquete la page pour cette mise en ligne, et ecrit la sortie Vercel en repartant de zero. */
export async function preparerLaSortieVercel(options: OptionsSortieVercel): Promise<void> {
  // La configuration d'abord: une origine mal ecrite arrete tout avant l'empaquetage.
  const configuration = configurationVercel(options.serveurDeJeu);
  const statique = join(DOSSIER_SORTIE_VERCEL, 'static');

  await empaqueterLeClient(options);
  await rm(DOSSIER_SORTIE_VERCEL, { recursive: true, force: true });
  await mkdir(statique, { recursive: true });

  await cp(DOSSIER_WEB, statique, {
    recursive: true,
    filter: (source) => fichierDeLaPagePublie(source),
  });
  await cp(DOSSIER_RESSOURCES, join(statique, RACINE_RESSOURCES.slice(1)), {
    recursive: true,
    filter: (source) => ressourcePubliee(source),
  });
  await writeFile(
    join(DOSSIER_SORTIE_VERCEL, 'config.json'),
    `${JSON.stringify(configuration, null, 2)}\n`,
  );
}

/** Lit une variable d'environnement obligatoire. */
function variableObligatoire(nom: string): string {
  const valeur = process.env[nom];

  if (valeur === undefined || valeur.trim() === '') {
    throw new Error(`${nom} doit etre definie pour preparer la sortie Vercel.`);
  }

  return valeur.trim();
}

// Lance directement (« node packages/client/scripts/sortieVercel.ts »), le script
// lit l'origine du serveur et la version dans l'environnement.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  await preparerLaSortieVercel({
    serveurDeJeu: variableObligatoire('SERVEUR_DE_JEU'),
    version: variableObligatoire('VERSION_DU_JEU'),
  });
  process.stdout.write(`Sortie Vercel prete dans ${DOSSIER_SORTIE_VERCEL}.\n`);
}
