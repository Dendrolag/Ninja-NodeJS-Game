/**
 * Un petit serveur de fichiers, pour donner au banc de mesure de quoi tourner.
 *
 * POURQUOI IL EXISTE ENCORE. Le banc de mesure du rendu (etape 4.2) importe des
 * modules precis du paquet client (monterRendu, construireScene, la camera) pour
 * composer sa propre page de mesure. Depuis l'etape 4.3, le vrai serveur sert bien
 * la page du jeu et ses ressources, mais le client y est EMPAQUETE en un seul
 * fichier: ses modules n'y sont plus adressables un par un. Ce serveur reste donc
 * le strict minimum pour le banc: il sert trois dossiers du depot et rien d'autre.
 *
 * IL NE SERT PAS AU JEU. Le scenario de navigation, lui, monte le vrai serveur
 * (harnais/serveur-de-jeu.ts), avec Express, la page empaquetee et sa politique
 * de securite. Ce fichier vit dans tests/ et n'est jamais empaquete.
 *
 * LE CODE SERVI EST LA COMPILATION DU PAQUET CLIENT, pas une version speciale
 * pour la mesure. Un banc qui mesurerait autre chose que le vrai code ne
 * mesurerait rien. Les specificateurs de modules sont resolus par une carte
 * d'importation posee dans la page, ce qui evite d'avoir a empaqueter quoi que ce
 * soit.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du depot, retrouvee depuis ce fichier. */
export const RACINE_DEPOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

/**
 * Les dossiers servis, et sous quelle adresse.
 *
 * Liste blanche explicite: tout ce qui n'y figure pas est refuse. Un serveur de
 * fichiers qui sert une racine entiere est un serveur qui sert aussi les clefs
 * qui trainent a cote.
 */
const DOSSIERS: Readonly<Record<string, string>> = {
  '/assets': join(RACINE_DEPOT, 'assets'),
  '/paquets/client': join(RACINE_DEPOT, 'packages', 'client', 'dist'),
  '/paquets/shared': join(RACINE_DEPOT, 'packages', 'shared', 'dist'),
  // PixiJS est une dependance du seul paquet client, et pnpm range les
  // dependances au plus pres du paquet qui les declare: elles ne sont donc pas a
  // la racine du depot.
  '/vendor/pixi.js': join(RACINE_DEPOT, 'packages', 'client', 'node_modules', 'pixi.js', 'dist'),
  '/vendor/pixi-filters': join(
    RACINE_DEPOT,
    'packages',
    'client',
    'node_modules',
    'pixi-filters',
    'dist',
  ),
};

/** Le type de contenu de chaque extension servie. */
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

/** Un serveur de fichiers en marche. */
export interface ServeurStatique {
  /** Adresse de base, par exemple http://127.0.0.1:51234. */
  readonly url: string;
  arreter(): Promise<void>;
}

/**
 * Demarre le serveur de fichiers sur un port libre.
 *
 * @param pages Pages fabriquees a la volee, indexees par chemin. Elles servent au
 *              banc de mesure, qui compose sa page plutot que de la ranger dans
 *              le depot.
 */
export async function demarrerServeurStatique(
  pages: Readonly<Record<string, string>> = {},
): Promise<ServeurStatique> {
  const serveur: Server = createServer((requete, reponse) => {
    const chemin = new URL(requete.url ?? '/', 'http://interne').pathname;
    const page = pages[chemin];

    if (page !== undefined) {
      reponse.writeHead(200, { 'content-type': TYPES['.html'] as string });
      reponse.end(page);
      return;
    }

    const fichier = resoudre(chemin);

    if (fichier === undefined) {
      reponse.writeHead(404).end('introuvable');
      return;
    }

    reponse.writeHead(200, {
      'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream',
    });
    createReadStream(fichier).pipe(reponse);
  });

  await new Promise<void>((resoudreAttente) => {
    serveur.listen(0, '127.0.0.1', () => {
      resoudreAttente();
    });
  });

  const adresse = serveur.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de fichiers n'a pas d'adresse.");
  }

  return {
    url: `http://127.0.0.1:${String(adresse.port)}`,
    arreter: async () =>
      new Promise<void>((termine) => {
        serveur.close(() => {
          termine();
        });
      }),
  };
}

/**
 * Traduit une adresse en chemin de fichier, ou rien si elle sort des dossiers
 * autorises.
 *
 * La verification que le chemin resolu commence bien par le dossier autorise est
 * ce qui empeche une adresse contenant des remontees de dossier de sortir de la
 * liste blanche.
 */
function resoudre(chemin: string): string | undefined {
  for (const [prefixe, dossier] of Object.entries(DOSSIERS)) {
    if (!chemin.startsWith(`${prefixe}/`)) {
      continue;
    }

    const relatif = normalize(chemin.slice(prefixe.length + 1)).replace(/^[\\/]+/u, '');
    const fichier = join(dossier, relatif);

    if (!fichier.startsWith(dossier + sep) && fichier !== dossier) {
      return undefined;
    }

    if (existsSync(fichier) && statSync(fichier).isFile()) {
      return fichier;
    }
  }

  return undefined;
}

/**
 * La carte d'importation a poser dans une page.
 *
 * Elle traduit les noms de paquets que notre code importe en adresses que le
 * navigateur sait charger. C'est ce qui permet au banc de faire tourner la
 * compilation module par module, sans passer par l'empaquetage de la page.
 */
export const CARTE_IMPORTATION = JSON.stringify({
  imports: {
    '@neon-ninja/shared': '/paquets/shared/index.js',
    'pixi.js': '/vendor/pixi.js/pixi.mjs',
    'pixi-filters': '/vendor/pixi-filters/pixi-filters.mjs',
  },
});
