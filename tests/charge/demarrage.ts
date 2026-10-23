/**
 * Ce que coute au serveur le chargement d'une carte de 10 000 sur 10 000 (etape 5.10).
 *
 * Au demarrage, le serveur decode l'image de collision de chaque carte, dans les deux
 * sens, et calcule ses places tenables et son morceau principal (ChargeurDeTerrain,
 * packages/server/src/terrain.ts). Pour les cartes actuelles, c'est un quart de seconde
 * chacune. Pour cent millions de pixels, personne ne savait: ni la duree, ni la memoire,
 * ni si la mise en ligne, qui attend trois minutes la reponse de /sante, le supporte.
 *
 * LA MESURE PASSE PAR LE CODE DU SERVEUR, terrainDepuisImage, celui que le chargeur
 * appelle pour chaque carte et chaque sens. L'image est le terrain realiste de la carte de
 * mesure (Tokyo repete, terrainDeMesure.ts), ecrite en PNG dans un dossier temporaire,
 * comme le serait l'image de collision d'une vraie carte: noir pour les murs, blanc pour
 * le sol, quatre octets par pixel comme celle de Tokyo.
 *
 * TROIS PROCESSUS NEUFS, pour que la pointe de memoire de l'un ne cache pas celle de
 * l'autre: le premier ecrit l'image; le deuxieme la decode seulement, pour la part du
 * decodage; le troisieme fait ce que fait le serveur au demarrage, les cartes actuelles
 * puis la carte de mesure dans les deux sens. La pointe de memoire est celle que le
 * systeme a vue (resourceUsage().maxRSS), pas une estimation.
 */

import { fork } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ChargeurDeTerrain, terrainDepuisImage } from '../../packages/server/dist/index.js';
import { CARTE_DE_MESURE } from '../../packages/shared/dist/index.js';
import { estMur } from '../../packages/sim/dist/index.js';

/** L'argument qui fait de ce module un processus de mesure, quand il est lance seul. */
const DRAPEAU_DU_DEMARRAGE = '--demarrage-du-harnais';

/**
 * pngjs, tel que le serveur le charge: le harnais n'en depend pas lui-meme, il emprunte
 * celui de packages/server.
 */
interface ModulePng {
  readonly PNG: {
    readonly sync: {
      read(image: Buffer): {
        readonly width: number;
        readonly height: number;
        readonly data: Buffer;
      };
      write(png: { width: number; height: number; data: Buffer }): Buffer;
    };
  };
}

const png = createRequire(new URL('../../packages/server/package.json', import.meta.url))(
  'pngjs',
) as ModulePng;

/** Une etape du chargement: sa duree, et la pointe de memoire du processus a sa fin. */
export interface EtapeDuDemarrage {
  readonly etape: string;
  readonly dureeMs: number;
  readonly pointeMemoireMo: number;
}

/** Ce que la mesure du demarrage a releve. */
export interface ResultatDemarrage {
  readonly largeur: number;
  readonly hauteur: number;
  /** Le poids de l'image de collision, en megaoctets. */
  readonly imageMo: number;
  /** L'ecriture de l'image, qui ne fait pas partie du demarrage, pour memoire. */
  readonly ecriture: EtapeDuDemarrage;
  /** Le decodage seul, dans un processus a part. */
  readonly decodage: EtapeDuDemarrage;
  /** Ce que fait le serveur, dans l'ordre: les cartes actuelles, puis la carte de mesure. */
  readonly chargement: readonly EtapeDuDemarrage[];
}

/** Une demande au processus de mesure. */
type Demande =
  | { readonly type: 'ecrire'; readonly chemin: string }
  | { readonly type: 'decoder'; readonly chemin: string }
  | { readonly type: 'charger'; readonly chemin: string };

/** Ce que le processus de mesure repond. */
type Reponse =
  | { readonly type: 'etapes'; readonly etapes: readonly EtapeDuDemarrage[] }
  | { readonly type: 'erreur'; readonly message: string };

/**
 * L'image de collision du terrain realiste de la carte de mesure, en PNG: Tokyo repete,
 * noir pour les murs, blanc pour le sol, opaque.
 */
export function imageDuTerrainRealiste(largeur: number, hauteur: number): Buffer {
  const tokyo = new ChargeurDeTerrain().charger({ carte: 'map1', modeMiroir: false });
  const data = Buffer.alloc(largeur * hauteur * 4);

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const valeur = estMur(tokyo, x % tokyo.largeur, y % tokyo.hauteur) ? 0 : 255;
      const depart = (y * largeur + x) * 4;
      data[depart] = valeur;
      data[depart + 1] = valeur;
      data[depart + 2] = valeur;
      data[depart + 3] = 255;
    }
  }

  return png.PNG.sync.write({ width: largeur, height: hauteur, data });
}

/** La pointe de memoire du processus jusqu'ici, en megaoctets. */
function pointeMemoireMo(): number {
  // maxRSS est en kilo-octets.
  return process.resourceUsage().maxRSS / 1024;
}

/** Joue une etape et la chronometre. */
function chronometrer(etape: string, action: () => unknown): EtapeDuDemarrage {
  const debut = performance.now();
  action();
  return { etape, dureeMs: performance.now() - debut, pointeMemoireMo: pointeMemoireMo() };
}

/** Joue une demande dans ce processus-ci. */
function jouer(demande: Demande): EtapeDuDemarrage[] {
  const dimensions = CARTE_DE_MESURE;

  if (demande.type === 'ecrire') {
    return [
      chronometrer('ecriture de l image', () => {
        writeFileSync(
          demande.chemin,
          imageDuTerrainRealiste(dimensions.largeur, dimensions.hauteur),
        );
      }),
    ];
  }

  if (demande.type === 'decoder') {
    return [chronometrer('decodage du PNG', () => png.PNG.sync.read(readFileSync(demande.chemin)))];
  }

  // Ce que fait le serveur: ChargeurDeTerrain.prechargerTout pour les cartes du jeu, puis
  // terrainDepuisImage pour la carte de mesure, dans les deux sens.
  const etapes = [chronometrer('cartes actuelles', () => new ChargeurDeTerrain().prechargerTout())];
  const image = readFileSync(demande.chemin);

  // Les terrains sont gardes, comme le cache du serveur les garde.
  const gardes: unknown[] = [];
  etapes.push(
    chronometrer('carte de mesure', () => gardes.push(terrainDepuisImage(image, dimensions))),
  );
  etapes.push(
    chronometrer('carte de mesure en miroir', () =>
      gardes.push(terrainDepuisImage(image, dimensions, true)),
    ),
  );

  return etapes;
}

/** Joue une demande dans un processus neuf. */
async function enProcessusNeuf(demande: Demande): Promise<readonly EtapeDuDemarrage[]> {
  const enfant = fork(fileURLToPath(import.meta.url), [DRAPEAU_DU_DEMARRAGE], {
    execArgv: ['--disable-warning=ExperimentalWarning'],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });

  return new Promise((resoudre, rejeter) => {
    enfant.once('message', (reponse: Reponse) => {
      if (reponse.type === 'erreur') {
        rejeter(new Error(`Processus de demarrage: ${reponse.message}`));
        return;
      }

      resoudre(reponse.etapes);
    });

    enfant.once('exit', (code) => {
      rejeter(
        new Error(`Le processus de demarrage s'est arrete sans repondre (code ${String(code)}).`),
      );
    });

    enfant.send(demande);
  });
}

/** Mesure le demarrage d'un serveur qui aurait une carte de 10 000 sur 10 000. */
export async function mesurerLeDemarrage(): Promise<ResultatDemarrage> {
  const dossier = mkdtempSync(join(tmpdir(), 'neon-ninja-demarrage-'));
  const chemin = join(dossier, 'collision.png');

  try {
    const [ecriture] = await enProcessusNeuf({ type: 'ecrire', chemin });
    const [decodage] = await enProcessusNeuf({ type: 'decoder', chemin });
    const chargement = await enProcessusNeuf({ type: 'charger', chemin });

    if (ecriture === undefined || decodage === undefined) {
      throw new Error('La mesure du demarrage n a rendu aucune etape.');
    }

    return {
      largeur: CARTE_DE_MESURE.largeur,
      hauteur: CARTE_DE_MESURE.hauteur,
      imageMo: statSync(chemin).size / 1024 ** 2,
      ecriture,
      decodage,
      chargement,
    };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

// Lance seul avec son drapeau, ce module attend sa demande, la joue, repond, et rend la
// main. Importe, il ne fait rien.
if (process.argv.includes(DRAPEAU_DU_DEMARRAGE)) {
  process.once('message', (demande: Demande) => {
    let reponse: Reponse;

    try {
      reponse = { type: 'etapes', etapes: jouer(demande) };
    } catch (erreur) {
      reponse = {
        type: 'erreur',
        message: erreur instanceof Error ? (erreur.stack ?? erreur.message) : String(erreur),
      };
    }

    process.send?.(reponse, () => {
      process.disconnect();
    });
  });
}
