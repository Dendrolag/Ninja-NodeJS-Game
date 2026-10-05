/**
 * La mise en ligne d'un commit: la page sur Vercel, le serveur de jeu de la
 * production, puis le secours (etapes 5.3 et 5.13).
 *
 * LANCE PAR LA CI, apres les deux jobs verts, sur la branche master seulement
 * (.github/workflows/ci.yml, job « Mise en ligne »). Il peut aussi se lancer a la
 * main, depuis la racine du depot compile et extrait au commit, avec les memes
 * variables; voir docs/deploiement.md.
 *
 * L'enchainement et ses garanties sont dans deploiement/miseEnLigne.ts. Ici, on le
 * branche sur le monde: Vercel, Render, et la machine Oracle par SSH.
 *
 * Variables: VERSION_DU_JEU (le commit), PAGE_DU_JEU, VERCEL_TOKEN, VERCEL_ORG_ID,
 * VERCEL_PROJECT_ID, ORACLE_HOTE, ORACLE_CLE (le fichier de la cle SSH de la CI),
 * SERVEUR_RENDER, RENDER_SERVICE_ID et RENDER_API_KEY.
 */

import { pathToFileURL } from 'node:url';

import { mettreEnLigne } from './miseEnLigne.ts';
import { arreter, dependancesDuMonde, fichiersChanges, variable } from './monde.ts';
import { miseEnLigneOracle } from './oracle.ts';
import { miseEnLigneRender } from './render.ts';

// Lance directement (« node deploiement/deployer.ts »), le script lit sa
// configuration dans l'environnement.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  try {
    const monde = dependancesDuMonde();

    await mettreEnLigne(variable('VERSION_DU_JEU'), {
      ...monde,
      fichiersChanges,
      mettreEnLigneSur: {
        oracle: miseEnLigneOracle({ hote: variable('ORACLE_HOTE'), cle: variable('ORACLE_CLE') }),
        render: miseEnLigneRender({
          service: variable('RENDER_SERVICE_ID'),
          cle: variable('RENDER_API_KEY'),
          origine: monde.origines.render,
        }),
      },
    });
  } catch (erreur) {
    arreter('Mise en ligne', erreur);
  }
}
