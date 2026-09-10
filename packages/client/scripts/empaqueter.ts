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
 *   icones/, favicon.ico les icones de la page
 *
 * Les ressources du jeu (cartes, sprites, sons) n'y sont pas: elles restent dans
 * assets/, a la racine du depot, et le serveur les sert sous /assets.
 *
 * LE PAQUET PARTAGE EST LU DANS SES SOURCES, pas dans sa compilation. La
 * compilation incrementale de TypeScript peut laisser un dist perime (dette connue
 * depuis l'etape 1.1): empaqueter les sources garantit que la page contient le
 * code du depot, et pas celui de la derniere compilation.
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

/** Empaquete le client dans packages/client/web, en repartant d'un dossier vide. */
export async function empaqueterLeClient(): Promise<void> {
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
    loader: { '.woff2': 'file', '.woff': 'file' },
    assetNames: 'polices/[name]-[hash]',
    logLevel: 'warning',
  });

  await cp(join(DOSSIER_PAGE, 'index.html'), join(DOSSIER_WEB, 'index.html'));
  await cp(join(DOSSIER_PAGE, 'favicon.ico'), join(DOSSIER_WEB, 'favicon.ico'));
  await cp(join(DOSSIER_PAGE, 'icones'), join(DOSSIER_WEB, 'icones'), { recursive: true });
}

// Lance directement (« node scripts/empaqueter.ts »), le script empaquete; importe
// par le harnais de bout en bout, il se contente d'exposer la fonction.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  await empaqueterLeClient();
}
