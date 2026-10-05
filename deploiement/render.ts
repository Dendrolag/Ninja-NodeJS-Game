/**
 * Le serveur de jeu sur Render (etape 5.3, secours depuis l'etape 5.13).
 *
 * Render construit et demarre le commit demande, et garde l'ancien serveur en
 * service tant que le nouveau n'a pas demarre. On attend son deploiement, puis que
 * sa route de sante rende la version du commit.
 *
 * LA CLE DE RENDER NE SORT QUE DANS L'EN-TETE DE SES REQUETES. Rien n'est affiche
 * d'elle.
 */

import { setTimeout as patienter } from 'node:timers/promises';

import type { Rythme } from './patience.ts';
import { problemesApresPatience } from './patience.ts';
import { deploiementDuCommit, issueDuDeploiement, problemesDeSante } from './verifications.ts';

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

/** Le temps laisse a un service qui vient de changer de version pour la dire. Une minute. */
const RYTHME_DE_LA_SANTE: Rythme = { essais: 12, intervalleMs: 5_000 };

/** Ce qu'il faut pour deployer sur Render. */
export interface ServiceRender {
  /** L'identifiant du service Render du serveur de jeu. */
  readonly service: string;
  /** La cle de l'API de Render. Un secret. */
  readonly cle: string;
  /** L'origine publique du serveur, par exemple https://neon-ninja.onrender.com. */
  readonly origine: string;
}

/** Pose une question a l'API de Render, et rend sa reponse lue comme du JSON. */
async function demanderARender(
  render: ServiceRender,
  methode: 'GET' | 'POST',
  chemin: string,
  corps?: unknown,
): Promise<unknown> {
  const reponse = await fetch(`${API_RENDER}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${render.cle}`,
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

/** Demande a Render de deployer ce commit, et rend l'identifiant du deploiement. */
async function lancerLeDeploiement(render: ServiceRender, version: string): Promise<string> {
  const service = encodeURIComponent(render.service);
  const cree = await demanderARender(render, 'POST', `/services/${service}/deploys`, {
    commitId: version,
    clearCache: 'do_not_clear',
  });

  const id =
    deploiementDuCommit(cree, version) ??
    deploiementDuCommit(
      await demanderARender(render, 'GET', `/services/${service}/deploys?limit=10`),
      version,
    );

  if (id === undefined) {
    throw new Error(`Render n'a pas cree de deploiement pour le commit ${version}.`);
  }

  return id;
}

/** Attend que le deploiement soit en ligne, ou echoue en disant pourquoi. */
async function attendreLeDeploiement(render: ServiceRender, deploiement: string): Promise<void> {
  const chemin = `/services/${encodeURIComponent(render.service)}/deploys/${encodeURIComponent(deploiement)}`;
  const limite = Date.now() + DELAI_RENDER_MS;
  let dernierStatut: unknown;

  while (Date.now() < limite) {
    const lu = await demanderARender(render, 'GET', chemin);
    const statut =
      typeof lu === 'object' && lu !== null ? (lu as Record<string, unknown>)['status'] : undefined;

    if (statut !== dernierStatut) {
      process.stdout.write(`Render: ${String(statut)}\n`);
      dernierStatut = statut;
    }

    const issue = issueDuDeploiement(statut);

    if (issue === 'enLigne') {
      return;
    }

    if (issue === 'echoue') {
      throw new Error(
        `Le deploiement ${deploiement} sur Render s'est arrete: ${String(statut)}. Journaux sur le tableau de bord de Render.`,
      );
    }

    await patienter(INTERVALLE_RENDER_MS);
  }

  throw new Error(`Render n'est pas en ligne apres ${String(DELAI_RENDER_MS / 60_000)} minutes.`);
}

/** La mise en ligne d'un commit sur Render, telle que la mise en ligne de la production l'appelle. */
export function miseEnLigneRender(render: ServiceRender): (version: string) => Promise<void> {
  return async (version) => {
    const deploiement = await lancerLeDeploiement(render, version);
    process.stdout.write(`Deploiement Render: ${deploiement}\n`);
    await attendreLeDeploiement(render, deploiement);

    const problemes = await problemesApresPatience(
      'Render',
      async () =>
        problemesDeSante(
          await (await fetch(`${render.origine}/sante`, { cache: 'no-store' })).json(),
          version,
        ),
      RYTHME_DE_LA_SANTE,
      async (ms) => patienter(ms),
    );

    if (problemes.length > 0) {
      throw new Error(`Render n'est pas a la version du commit: ${problemes.join(' ')}`);
    }

    process.stdout.write(`Render: au commit ${version}.\n`);
  };
}
