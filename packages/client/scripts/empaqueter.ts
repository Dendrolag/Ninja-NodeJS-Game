/**
 * L'empaqueteur du client: des sources du paquet a une page que le navigateur charge.
 *
 * LE CHOIX D'ESBUILD, consigne au journal de conception le 10 septembre 2026. Il
 * fallait transformer une centaine de modules TypeScript, PixiJS et Socket.IO en
 * quelque chose qu'un navigateur charge vite. esbuild le fait en une passe, sans
 * configuration a entretenir, et il est deja la: Vitest s'en sert. Un empaqueteur
 * avec serveur de developpement (Vite) aurait apporte un second serveur a cote de
 * celui du jeu, et un rechargement a chaud dont une partie en temps reel ne sait
 * que faire. La carte d'importation du banc de mesure, sans empaquetage, chargerait
 * quarante fichiers et tout PixiJS non minifie a chaque visite.
 *
 * CE QUI SORT, dans packages/client/web:
 *
 *   index.html          la page, recopiee telle quelle
 *   app.js              tout le code du client, minifie, avec sa carte de sources
 *   styles.css          toutes les feuilles de style, polices comprises
 *   polices/            les fichiers de police, references par styles.css
 *   icones/, favicon.ico les icones de la page, et l'image d'apercu d'un lien partage
 *   robots.txt          ce que les moteurs de recherche peuvent lire (etape 5.6)
 *   sitemap.xml         le plan du site, qui ne compte que la page d'accueil
 *
 * Les ressources du jeu (cartes, sprites, sons) n'y sont pas: elles restent dans
 * assets/, a la racine du depot. En developpement, le serveur les sert sous
 * /assets; en production, la sortie Vercel les recopie (sortieVercel.ts).
 *
 * L'ADRESSE DU SERVEUR ET LA VERSION S'ECRIVENT ICI (etape 5.3). La page ne peut
 * rien demander avant de savoir a qui: esbuild remplace dans le code les deux
 * constantes que lit src/principal.ts. Sans options, elles restent vides, et la
 * page parle au serveur qui l'a servie, sans version: c'est l'empaquetage de
 * « pnpm build » et des scenarios de bout en bout.
 *
 * LE PAQUET PARTAGE EST LU DANS SES SOURCES, pas dans sa compilation. La
 * compilation incrementale de TypeScript peut laisser un dist perime (dette connue
 * depuis l'etape 1.1): empaqueter les sources garantit que la page contient le
 * code du depot, et pas celui de la derniere compilation. C'est aussi pourquoi ce
 * fichier n'importe rien du paquet partage: le harnais de bout en bout le charge
 * avant d'avoir compile quoi que ce soit.
 *
 * Lance par « pnpm build », et avant les scenarios de bout en bout.
 */

import { cp, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

/** Le dossier du paquet client. */
const RACINE_PAQUET = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Les sources de la page: le HTML, les styles, les icones. */
const DOSSIER_PAGE = join(RACINE_PAQUET, 'page');

/** Le dossier produit, que le serveur sert a la racine. */
export const DOSSIER_WEB = join(RACINE_PAQUET, 'web');

/** Les fichiers de la page recopies tels quels, a cote de index.html et des icones. */
export const FICHIERS_RECOPIES: readonly string[] = [
  'index.html',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
];

/** Ce que la page doit savoir de sa mise en ligne. Voir src/configuration.ts. */
export interface OptionsEmpaquetage {
  /** L'origine du serveur de jeu, quand il ne sert pas la page lui-meme. */
  readonly serveurDeJeu?: string;
  /** Le commit dont la page est construite. */
  readonly version?: string;
}

/** Empaquete le client dans packages/client/web, en repartant d'un dossier vide. */
export async function empaqueterLeClient(options: OptionsEmpaquetage = {}): Promise<void> {
  // Repartir de zero: un fichier d'une version precedente, reste la par oubli,
  // serait servi comme s'il faisait partie de celle-ci.
  await rm(DOSSIER_WEB, { recursive: true, force: true });

  await build({
    entryPoints: {
      app: join(RACINE_PAQUET, 'src', 'principal.ts'),
      styles: join(DOSSIER_PAGE, 'styles', 'principal.css'),
    },
    outdir: DOSSIER_WEB,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    sourcemap: true,
    alias: {
      '@neon-ninja/shared': join(RACINE_PAQUET, '..', 'shared', 'src', 'index.ts'),
    },
    define: {
      __SERVEUR_DE_JEU__: JSON.stringify(options.serveurDeJeu ?? ''),
      __VERSION_DU_JEU__: JSON.stringify(options.version ?? ''),
    },
    loader: { '.woff2': 'file', '.woff': 'file' },
    assetNames: 'polices/[name]-[hash]',
    logLevel: 'warning',
  });

  for (const fichier of FICHIERS_RECOPIES) {
    await cp(join(DOSSIER_PAGE, fichier), join(DOSSIER_WEB, fichier));
  }
  await cp(join(DOSSIER_PAGE, 'icones'), join(DOSSIER_WEB, 'icones'), { recursive: true });
}

// Lance directement (« node scripts/empaqueter.ts »), le script empaquete; importe
// par le harnais de bout en bout ou par la sortie Vercel, il se contente d'exposer
// la fonction.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  await empaqueterLeClient();
}
