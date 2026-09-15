/**
 * Jouer un palier de charge reseau dans un processus neuf.
 *
 * La meme raison que pour le banc du battement (battement-isole.ts): le
 * compilateur a la volee de Node garde l'empreinte des parties qu'il a vu passer:
 * a l'etape 5.1, une partie plus peuplee que les precedentes coutait jusqu'a trois
 * fois et demie plus cher, un effet que l'etape 5.2 a ramene a quelques pour cent.
 * Un serveur remonte dans le processus d'un palier precedent heriterait aussi de sa
 * memoire. Chaque palier lance donc son serveur dans un processus a
 * lui: ses chiffres ne dependent ni de l'ordre des paliers, ni de celui des
 * scenarios.
 *
 * Les clients simules, eux, restent dans leurs propres processus, lances par
 * celui-ci.
 */

import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { OptionsChargeReseau, ResultatChargeReseau } from './charge-reseau.ts';
import { mesurerLaCharge } from './charge-reseau.ts';

/** L'argument qui fait de ce module un processus de serveur mesure, quand il est lance seul. */
const DRAPEAU_DU_PALIER = '--palier-du-harnais';

/** Ce que le processus du palier repond. */
type ReponseDuPalier =
  | { readonly type: 'resultat'; readonly resultat: ResultatChargeReseau }
  | { readonly type: 'erreur'; readonly message: string };

/** Joue un palier de charge dans un processus neuf, et rend sa mesure. */
export async function mesurerLaChargeEnProcessusNeuf(
  options: OptionsChargeReseau,
): Promise<ResultatChargeReseau> {
  const enfant = fork(fileURLToPath(import.meta.url), [DRAPEAU_DU_PALIER], {
    execArgv: ['--disable-warning=ExperimentalWarning'],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });

  return new Promise((resoudre, rejeter) => {
    enfant.once('message', (reponse: ReponseDuPalier) => {
      if (reponse.type === 'erreur') {
        rejeter(new Error(`Processus du palier: ${reponse.message}`));
        return;
      }

      resoudre(reponse.resultat);
    });

    // Une promesse deja tenue ignore ce rejet: il ne porte que sur un processus
    // arrete sans avoir repondu.
    enfant.once('exit', (code) => {
      rejeter(
        new Error(`Le processus du palier s'est arrete sans repondre (code ${String(code)}).`),
      );
    });

    enfant.send(options);
  });
}

// Lance seul avec son drapeau, ce module attend ses options, joue le palier,
// repond, et rend la main. Importe, il ne fait rien.
if (process.argv.includes(DRAPEAU_DU_PALIER)) {
  process.once('message', (options: OptionsChargeReseau) => {
    mesurerLaCharge(options)
      .then(
        (resultat): ReponseDuPalier => ({ type: 'resultat', resultat }),
        (erreur: unknown): ReponseDuPalier => ({
          type: 'erreur',
          message: erreur instanceof Error ? (erreur.stack ?? erreur.message) : String(erreur),
        }),
      )
      .then((reponse) => {
        process.send?.(reponse, () => {
          process.disconnect();
        });
      });
  });
}
