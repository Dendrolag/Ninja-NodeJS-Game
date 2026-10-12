/**
 * L'import du tableau « Fluidite » et des alertes dans Grafana Cloud (etape 5.15).
 *
 * A LANCER PAR LE PORTEUR DU PROJET, depuis la racine du depot, apres chaque changement de ce
 * dossier: « node deploiement/grafana/importer.ts ». SANS EFFET DE BORD A LA RELANCE: le
 * tableau, le dossier, chaque alerte, le point de contact et chaque verification portent un
 * identifiant fixe, et se remplacent au lieu de se doubler.
 *
 * Ce qu'il pose, dans l'ordre: le dossier « Neon Ninja »; le tableau; les alertes, et leur
 * evaluation toutes les minutes; si COURRIEL_DES_ALERTES est donne, le point de contact par
 * courriel, et la politique qui y envoie toutes les alertes; si GRAFANA_SM_URL et
 * GRAFANA_SM_JETON sont donnes, les verifications de disponibilite (production et page,
 * toutes les minutes, depuis Francfort).
 *
 * Variables: GRAFANA_URL (https://<pile>.grafana.net), GRAFANA_JETON_IMPORT (le jeton d'un
 * compte de service administrateur de la pile), et les facultatives ci-dessus. Les jetons ne
 * s'ecrivent jamais dans le depot.
 *
 * Tout ce qui touche au reseau est injecte (ApiHttp): l'enchainement se teste sans Grafana.
 */

import { pathToFileURL } from 'node:url';

import { ALERTES, DOSSIER, GROUPE, regleGrafana } from './alertes.ts';
import { UID_DU_TABLEAU, tableauDeLaFluidite } from './tableau.ts';

/** Une reponse d'une API HTTP. */
export interface ReponseHttp {
  readonly statut: number;
  readonly corps: unknown;
}

/** Une API HTTP: Grafana, ou celle des verifications de disponibilite. */
export type ApiHttp = (
  methode: 'GET' | 'POST' | 'PUT',
  chemin: string,
  corps?: unknown,
) => Promise<ReponseHttp>;

/** Le point de contact des alertes. */
const POINT_DE_CONTACT = { uid: 'neon-ninja-courriel', nom: 'Porteur du projet' } as const;

/** Les verifications de disponibilite: ce qu'elles lisent, toutes les minutes. */
export const VERIFICATIONS = [
  { job: 'production', cible: 'https://serveur.ninja.dendrolag.fr/sante' },
  { job: 'page', cible: 'https://ninja.dendrolag.fr/' },
] as const;

/** La sonde de Grafana d'ou partent les verifications: Francfort, a cote de la machine. */
const SONDE_PREFEREE = /frankfurt/iu;

/** Un objet JSON, lu sans rien supposer de ses champs. */
function objet(valeur: unknown): Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : {};
}

/** Une liste JSON, ou une liste vide. */
function liste(valeur: unknown): Record<string, unknown>[] {
  return Array.isArray(valeur) ? valeur.map(objet) : [];
}

/** Echoue avec le message de Grafana si la reponse n'est pas un succes. */
function verifier(reponse: ReponseHttp, quoi: string): ReponseHttp {
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error(`${quoi}: ${String(reponse.statut)} ${JSON.stringify(reponse.corps)}`);
  }

  return reponse;
}

/**
 * Les sources de donnees de la pile: celle des metriques, celle du journal. Grafana Cloud
 * les nomme grafanacloud-<pile>-prom et grafanacloud-<pile>-logs; a defaut, la premiere du
 * bon type.
 */
export function sourcesDeLaPile(sources: unknown): { prometheus: string; loki: string } {
  const toutes = liste(sources);
  const choisir = (type: string, fin: string): string => {
    const duType = toutes.filter((source) => source['type'] === type);
    const trouvee = duType.find((source) => String(source['name']).endsWith(fin)) ?? duType[0];
    const uid = trouvee?.['uid'];

    if (typeof uid !== 'string') {
      throw new Error(`Aucune source de donnees ${type} dans la pile.`);
    }

    return uid;
  };

  return { prometheus: choisir('prometheus', '-prom'), loki: choisir('loki', '-logs') };
}

/** Pose le dossier, le tableau, les alertes, et, si on le donne, le courriel des alertes. */
export async function importerDansGrafana(
  grafana: ApiHttp,
  options: { readonly courriel?: string; readonly ecrire: (texte: string) => void },
): Promise<void> {
  const { prometheus } = sourcesDeLaPile(
    verifier(await grafana('GET', '/api/datasources'), 'Sources de donnees').corps,
  );

  if ((await grafana('GET', `/api/folders/${DOSSIER.uid}`)).statut === 404) {
    verifier(
      await grafana('POST', '/api/folders', { uid: DOSSIER.uid, title: DOSSIER.titre }),
      'Dossier',
    );
  }
  options.ecrire(`Dossier « ${DOSSIER.titre} » pret.\n`);

  verifier(
    await grafana('POST', '/api/dashboards/db', {
      dashboard: { ...tableauDeLaFluidite(), id: null },
      folderUid: DOSSIER.uid,
      overwrite: true,
      message: 'Import par deploiement/grafana/importer.ts',
    }),
    'Tableau',
  );
  options.ecrire(`Tableau « ${UID_DU_TABLEAU} » importe.\n`);

  for (const alerte of ALERTES) {
    const regle = regleGrafana(alerte, prometheus);
    const remplacee = await grafana('PUT', `/api/v1/provisioning/alert-rules/${alerte.uid}`, regle);

    if (remplacee.statut === 404) {
      verifier(await grafana('POST', '/api/v1/provisioning/alert-rules', regle), alerte.titre);
    } else {
      verifier(remplacee, alerte.titre);
    }
  }

  const cheminDuGroupe = `/api/v1/provisioning/folder/${DOSSIER.uid}/rule-groups/${GROUPE.nom}`;
  const groupe = objet(verifier(await grafana('GET', cheminDuGroupe), 'Groupe').corps);
  verifier(
    await grafana('PUT', cheminDuGroupe, { ...groupe, interval: GROUPE.intervalleS }),
    'Groupe',
  );
  options.ecrire(`${String(ALERTES.length)} alertes posees, evaluees toutes les minutes.\n`);

  if (options.courriel === undefined) {
    options.ecrire('Sans COURRIEL_DES_ALERTES: le point de contact reste celui de la pile.\n');
    return;
  }

  const contact = {
    uid: POINT_DE_CONTACT.uid,
    name: POINT_DE_CONTACT.nom,
    type: 'email',
    settings: { addresses: options.courriel, singleEmail: true },
    disableResolveMessage: false,
  };
  const contactRemplace = await grafana(
    'PUT',
    `/api/v1/provisioning/contact-points/${POINT_DE_CONTACT.uid}`,
    contact,
  );

  if (contactRemplace.statut === 404) {
    verifier(await grafana('POST', '/api/v1/provisioning/contact-points', contact), 'Contact');
  } else {
    verifier(contactRemplace, 'Contact');
  }

  verifier(
    await grafana('PUT', '/api/v1/provisioning/policies', {
      receiver: POINT_DE_CONTACT.nom,
      group_by: ['grafana_folder', 'alertname'],
      group_wait: '30s',
      group_interval: '5m',
      repeat_interval: '4h',
    }),
    'Politique de notification',
  );
  options.ecrire('Les alertes partent par courriel.\n');
}

/** Pose les verifications de disponibilite, une par cible, depuis Francfort. */
export async function poserLesVerifications(
  sm: ApiHttp,
  ecrire: (texte: string) => void,
): Promise<void> {
  const sondes = liste(verifier(await sm('GET', '/api/v1/probe/list'), 'Sondes').corps);
  const sonde =
    sondes.find((candidate) => SONDE_PREFEREE.test(String(candidate['name']))) ?? sondes[0];

  if (typeof sonde?.['id'] !== 'number') {
    throw new Error('Aucune sonde de verification disponible.');
  }

  const existantes = liste(verifier(await sm('GET', '/api/v1/check/list'), 'Verifications').corps);

  for (const verification of VERIFICATIONS) {
    const voulue = {
      job: verification.job,
      target: verification.cible,
      frequency: 60_000,
      timeout: 10_000,
      enabled: true,
      labels: [],
      probes: [sonde['id']],
      basicMetricsOnly: true,
      alertSensitivity: 'none',
      settings: {
        http: {
          method: 'GET',
          ipVersion: 'V4',
          noFollowRedirects: false,
          failIfNotSSL: true,
          validStatusCodes: [200],
        },
      },
    };
    const existante = existantes.find((candidate) => candidate['job'] === verification.job);

    verifier(
      existante === undefined
        ? await sm('POST', '/api/v1/check/add', voulue)
        : await sm('POST', '/api/v1/check/update', {
            ...voulue,
            id: existante['id'],
            tenantId: existante['tenantId'],
          }),
      `Verification ${verification.job}`,
    );
  }

  ecrire(
    `${String(VERIFICATIONS.length)} verifications de disponibilite posees, depuis ${String(sonde['name'])}.\n`,
  );
}

/** Une API HTTP authentifiee par un jeton, a cette adresse. */
function apiHttp(base: string, jeton: string): ApiHttp {
  return async (methode, chemin, corps) => {
    const reponse = await fetch(`${base.replace(/\/$/u, '')}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${jeton}`,
        'Content-Type': 'application/json',
        // Les alertes posees par l'API restent modifiables a la main dans Grafana.
        'X-Disable-Provenance': 'true',
      },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });
    const texte = await reponse.text();
    let lu: unknown = texte;

    try {
      lu = JSON.parse(texte);
    } catch {
      // Une reponse sans JSON reste du texte.
    }

    return { statut: reponse.status, corps: lu };
  };
}

/** Lit une variable d'environnement, ou rien si elle est vide. */
function facultative(nom: string): string | undefined {
  const valeur = process.env[nom]?.trim();
  return valeur === undefined || valeur === '' ? undefined : valeur;
}

const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanceDirectement) {
  try {
    const url = facultative('GRAFANA_URL');
    const jeton = facultative('GRAFANA_JETON_IMPORT');

    if (url === undefined || jeton === undefined) {
      throw new Error('GRAFANA_URL et GRAFANA_JETON_IMPORT doivent etre definies.');
    }

    const ecrire = (texte: string): void => {
      process.stdout.write(texte);
    };
    const courriel = facultative('COURRIEL_DES_ALERTES');
    await importerDansGrafana(apiHttp(url, jeton), {
      ecrire,
      ...(courriel === undefined ? {} : { courriel }),
    });

    const smUrl = facultative('GRAFANA_SM_URL');
    const smJeton = facultative('GRAFANA_SM_JETON');

    if (smUrl !== undefined && smJeton !== undefined) {
      await poserLesVerifications(apiHttp(smUrl, smJeton), ecrire);
    } else {
      ecrire('Sans GRAFANA_SM_URL et GRAFANA_SM_JETON: les verifications se posent a la main.\n');
    }
  } catch (erreur) {
    process.stderr.write(
      `\nImport arrete: ${erreur instanceof Error ? erreur.message : String(erreur)}\n`,
    );
    process.exitCode = 1;
  }
}
