/**
 * La bascule de la page publique d'un serveur de jeu a l'autre (etape 5.13).
 *
 * LANCEE PAR LA CI, a la demande (.github/workflows/bascule.yml, « Run workflow »,
 * y compris depuis un telephone), ou a la main, depuis la racine du depot compile
 * et extrait au commit que sert le serveur choisi. Elle ne touche a aucun serveur:
 * elle remplace la page publique par celle du meme commit, empaquetee pour l'autre.
 * L'enchainement et ses refus sont dans deploiement/miseEnLigne.ts.
 *
 * Variables: CIBLE (oracle ou render), PAGE_DU_JEU, VERCEL_TOKEN, VERCEL_ORG_ID,
 * VERCEL_PROJECT_ID, ORACLE_HOTE et SERVEUR_RENDER.
 */

import { pathToFileURL } from 'node:url';

import type { NomDuServeur } from './miseEnLigne.ts';
import { basculer } from './miseEnLigne.ts';
import { arreter, commitDesSources, dependancesDuMonde, variable } from './monde.ts';

/** Le serveur que nomme CIBLE. */
function cibleLue(texte: string): NomDuServeur {
  if (texte !== 'oracle' && texte !== 'render') {
    throw new Error(`CIBLE vaut « oracle » ou « render », recu « ${texte} ».`);
  }

  return texte;
}

const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  try {
    const sources = await commitDesSources();

    if (sources === undefined) {
      throw new Error('git ne dit pas le commit des sources.');
    }

    await basculer(cibleLue(variable('CIBLE')), sources, dependancesDuMonde());
  } catch (erreur) {
    arreter('Bascule', erreur);
  }
}
