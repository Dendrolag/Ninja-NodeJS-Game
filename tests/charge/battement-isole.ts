/**
 * Jouer le banc du battement dans un processus neuf.
 *
 * POURQUOI UN PROCESSUS NEUF PAR MESURE. Le compilateur a la volee de Node
 * optimise le moteur pour les parties qu'il voit passer. Mesure a l'etape 5.1, sur
 * une partie strictement identique a l'octet pres: 300 bots coutaient 2,3 ms par
 * battement dans un processus neuf, et 8,0 ms dans un processus qui venait de jouer
 * une partie de 150 bots. L'etape 5.2 en a trouve la cause, la table des bots
 * recopiee pour chaque bot, et l'a corrigee: l'ecart est tombe a quelques pour cent.
 * La regle reste, parce qu'elle ne coute rien et qu'aucune mesure ne doit plus
 * jamais dependre de l'ordre dans lequel on la joue.
 *
 * Ce fichier lance un processus, lui fait jouer une suite de configurations dans
 * l'ordre donne, et rend leurs resultats. Une suite d'une seule configuration est
 * une mesure isolee; une suite de plusieurs mesure justement cette degradation,
 * que subit un vrai serveur ou des parties de tailles differentes se cotoient.
 *
 * LE PROFIL (etape 5.10). Sur demande, le processus de banc tourne sous le profileur de
 * Node (--cpu-prof), qui ecrit en sortant ou son temps est passe, fonction par fonction.
 * profil.ts le resume.
 */

import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ChargeurDeTerrain } from '../../packages/server/dist/index.js';
import type { CarteCollisions } from '../../packages/sim/dist/index.js';
import type { IdentifiantCarte, Mode } from '../../packages/shared/dist/index.js';

import type { ResultatBancBattement } from './battement.ts';
import { mesurerLeBattement } from './battement.ts';
import type { TerrainDeMesure } from './terrainDeMesure.ts';
import { terrainDeMesure } from './terrainDeMesure.ts';

/** L'argument qui fait de ce module un processus de banc, quand il est lance seul. */
const DRAPEAU_DU_BANC = '--banc-du-harnais';

/** Une configuration du banc, sans les murs: le processus les charge lui-meme. */
export interface ConfigurationDeBanc {
  readonly bots: number;
  readonly joueurs: number;
  readonly battements: number;
  readonly echauffement: number;
  readonly graine: number;
  readonly carte?: IdentifiantCarte;
  /** Le mode de la partie. Le Classique par defaut. */
  readonly mode?: Mode;
  /** Les joueurs posent des mines (etape 7.11). Voir OptionsBancBattement. */
  readonly mines?: boolean;
  /**
   * La partie se joue sur la carte de mesure de 10 000 sur 10 000, avec ce terrain (etape
   * 5.10). La carte des reglages ne compte plus alors.
   */
  readonly terrainDeMesure?: TerrainDeMesure;
  /** Le banc estime le filtrage par zone d'interet (etape 5.10). */
  readonly zoneDInteret?: boolean;
}

/** Ce que le processus de banc repond. */
type ReponseDuBanc =
  | { readonly type: 'resultats'; readonly resultats: readonly ResultatBancBattement[] }
  | { readonly type: 'erreur'; readonly message: string };

/**
 * Joue une suite de configurations, dans l'ordre, dans un processus neuf.
 *
 * @returns Un resultat par configuration, dans le meme ordre.
 */
export async function mesurerEnProcessusNeuf(
  configurations: readonly ConfigurationDeBanc[],
  dossierDuProfil?: string,
): Promise<readonly ResultatBancBattement[]> {
  const profil =
    dossierDuProfil === undefined ? [] : ['--cpu-prof', `--cpu-prof-dir=${dossierDuProfil}`];
  const enfant = fork(fileURLToPath(import.meta.url), [DRAPEAU_DU_BANC], {
    execArgv: ['--disable-warning=ExperimentalWarning', ...profil],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });

  return new Promise((resoudre, rejeter) => {
    let reponse: ReponseDuBanc | undefined;

    enfant.once('message', (recue: ReponseDuBanc) => {
      reponse = recue;
    });

    // La reponse ne compte qu'une fois le processus sorti: c'est en sortant que le
    // profileur ecrit son fichier, que charge.ts lit aussitot apres.
    enfant.once('exit', (code) => {
      if (reponse === undefined) {
        rejeter(
          new Error(`Le processus de banc s'est arrete sans repondre (code ${String(code)}).`),
        );
      } else if (reponse.type === 'erreur') {
        rejeter(new Error(`Processus de banc: ${reponse.message}`));
      } else {
        resoudre(reponse.resultats);
      }
    });

    enfant.send({ configurations });
  });
}

/** Joue les configurations dans ce processus-ci, murs de la carte compris. */
function jouer(configurations: readonly ConfigurationDeBanc[]): ResultatBancBattement[] {
  const terrains = new ChargeurDeTerrain();
  const terrainsDeMesure = new Map<TerrainDeMesure, CarteCollisions>();

  // Fabriquer cent millions de pixels prend quelques secondes: une fois par processus.
  const deMesure = (nature: TerrainDeMesure): CarteCollisions => {
    const deja = terrainsDeMesure.get(nature);
    const terrain =
      deja ?? terrainDeMesure(nature, terrains.charger({ carte: 'map1', modeMiroir: false }));
    terrainsDeMesure.set(nature, terrain);
    return terrain;
  };

  return configurations.map((configuration) =>
    configuration.terrainDeMesure === undefined
      ? mesurerLeBattement({
          ...configuration,
          terrain: terrains.charger({ carte: configuration.carte ?? 'map1', modeMiroir: false }),
        })
      : mesurerLeBattement({
          ...configuration,
          terrain: deMesure(configuration.terrainDeMesure),
          carteDeMesure: true,
        }),
  );
}

// Lance seul avec son drapeau, ce module attend sa suite de configurations, la joue,
// repond, et rend la main. Importe, il ne fait rien.
if (process.argv.includes(DRAPEAU_DU_BANC)) {
  process.once(
    'message',
    (demande: { readonly configurations: readonly ConfigurationDeBanc[] }) => {
      let reponse: ReponseDuBanc;

      try {
        reponse = { type: 'resultats', resultats: jouer(demande.configurations) };
      } catch (erreur) {
        reponse = {
          type: 'erreur',
          message: erreur instanceof Error ? (erreur.stack ?? erreur.message) : String(erreur),
        };
      }

      process.send?.(reponse, () => {
        process.disconnect();
      });
    },
  );
}
