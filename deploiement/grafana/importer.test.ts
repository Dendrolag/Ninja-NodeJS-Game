/**
 * Tests de Grafana (etape 5.15): le tableau et les alertes ne lisent que des metriques que
 * le serveur ecrit, et leur import se relance sans rien doubler.
 */

import { describe, expect, it } from 'vitest';

import { creerJournalEnMemoire } from '../../packages/server/src/surveillance/journal.ts';
import { SurveillanceDuJeu } from '../../packages/server/src/surveillance/surveillanceDuJeu.ts';
import { ALERTES, regleGrafana } from './alertes.ts';
import type { ApiHttp, ReponseHttp } from './importer.ts';
import {
  VERIFICATIONS,
  importerDansGrafana,
  poserLesVerifications,
  sourcesDeLaPile,
} from './importer.ts';
import { VERDICT, metriquesLues } from './requetes.ts';
import { UID_DU_TABLEAU, tableauDeLaFluidite } from './tableau.ts';

/** Toutes les requetes d'un objet JSON: la valeur de chaque champ « expr ». */
function requetesDe(valeur: unknown): string[] {
  if (Array.isArray(valeur)) {
    return valeur.flatMap(requetesDe);
  }

  if (typeof valeur !== 'object' || valeur === null) {
    return [];
  }

  return Object.entries(valeur).flatMap(([cle, champ]) =>
    cle === 'expr' && typeof champ === 'string' ? [champ] : requetesDe(champ),
  );
}

describe('le tableau et les alertes', () => {
  const ecrites = new Set(
    new SurveillanceDuJeu({ processus: false, journal: creerJournalEnMemoire() }).registre
      .nomsDesFamilles,
  );

  it('ne lisent que des metriques que le serveur ecrit', () => {
    const requetes = [
      ...requetesDe(tableauDeLaFluidite()),
      ...ALERTES.map((alerte) => alerte.expr),
    ];
    const lues = new Set(requetes.flatMap(metriquesLues));

    expect(lues.size).toBeGreaterThan(20);
    expect([...lues].filter((nom) => !ecrites.has(nom))).toEqual([]);
  });

  it('reconnait les metriques d une requete, histogrammes compris', () => {
    expect(
      metriquesLues(
        'histogram_quantile(0.9, sum by (le) (rate(neon_battement_duree_ms_bucket[5m]))) / sum(rate(neon_battements_total[5m])) + node_cpu_seconds_total',
      ),
    ).toEqual(['neon_battement_duree_ms', 'neon_battements_total']);
  });

  it('donne au verdict ses quatre issues, dans l ordre', () => {
    expect(VERDICT.split(' or ')).toHaveLength(5);
    expect(VERDICT).toMatch(/\+ 1\).*\+ 2\).*\+ 3\).*vector\(-1\)$/u);
  });

  it('donne a chaque panneau un identifiant unique, et au tableau un identifiant fixe', () => {
    const tableau = tableauDeLaFluidite();
    const ids = (tableau['panels'] as { id: number }[]).map((panneau) => panneau.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(tableau['uid']).toBe(UID_DU_TABLEAU);
    expect(tableauDeLaFluidite()).toEqual(tableau);
  });

  it('donne a chaque alerte un identifiant unique, une requete et un seuil', () => {
    const uids = ALERTES.map((alerte) => alerte.uid);

    expect(new Set(uids).size).toBe(uids.length);
    expect(ALERTES.length).toBeGreaterThanOrEqual(9);

    const regle = regleGrafana(ALERTES[0] ?? (undefined as never), 'source-prom');
    expect(regle).toMatchObject({ uid: ALERTES[0]?.uid, condition: 'C', folderUID: 'neon-ninja' });
  });
});

/** Une API factice: elle retient les appels, et repond selon ce qu'elle contient deja. */
function grafanaFactice(): ApiHttp & {
  readonly appels: string[];
  readonly corps: Map<string, unknown>;
} {
  const appels: string[] = [];
  const contenu = new Map<string, unknown>();
  const repondre = (statut: number, corps: unknown = {}): ReponseHttp => ({ statut, corps });

  const api = async (methode: 'GET' | 'POST' | 'PUT', chemin: string, corps?: unknown) => {
    appels.push(`${methode} ${chemin}`);

    if (methode === 'GET' && chemin === '/api/datasources') {
      return repondre(200, [
        { type: 'prometheus', name: 'grafanacloud-usage', uid: 'usage' },
        { type: 'prometheus', name: 'grafanacloud-neonninja-prom', uid: 'prom' },
        { type: 'loki', name: 'grafanacloud-neonninja-logs', uid: 'logs' },
      ]);
    }

    if (methode === 'GET') {
      return contenu.has(chemin) ? repondre(200, contenu.get(chemin)) : repondre(404);
    }

    if (methode === 'PUT' && !contenu.has(chemin) && !chemin.endsWith('/policies')) {
      return repondre(404);
    }

    const cle =
      methode === 'POST' && chemin === '/api/folders'
        ? `/api/folders/${String((corps as { uid: string }).uid)}`
        : methode === 'POST' && chemin === '/api/v1/provisioning/alert-rules'
          ? `/api/v1/provisioning/alert-rules/${String((corps as { uid: string }).uid)}`
          : methode === 'POST' && chemin === '/api/v1/provisioning/contact-points'
            ? `/api/v1/provisioning/contact-points/${String((corps as { uid: string }).uid)}`
            : chemin;
    contenu.set(cle, corps);

    // Le groupe des alertes nait avec sa premiere regle.
    if (cle.startsWith('/api/v1/provisioning/alert-rules/')) {
      contenu.set('/api/v1/provisioning/folder/neon-ninja/rule-groups/fluidite', {
        title: 'fluidite',
        interval: 300,
        rules: [],
      });
    }

    return repondre(200);
  };

  return Object.assign(api, { appels, corps: contenu });
}

describe('l import dans Grafana', () => {
  it('pose le dossier, le tableau, les alertes et le courriel', async () => {
    const grafana = grafanaFactice();

    await importerDansGrafana(grafana, {
      courriel: 'porteur@example.org',
      ecrire: () => undefined,
    });

    expect(grafana.appels).toContain('POST /api/folders');
    expect(grafana.appels).toContain('POST /api/dashboards/db');
    expect(
      grafana.appels.filter((appel) => appel === 'POST /api/v1/provisioning/alert-rules'),
    ).toHaveLength(ALERTES.length);
    expect(
      grafana.corps.get('/api/v1/provisioning/folder/neon-ninja/rule-groups/fluidite'),
    ).toMatchObject({ interval: 60 });
    expect(
      grafana.corps.get('/api/v1/provisioning/contact-points/neon-ninja-courriel'),
    ).toMatchObject({
      type: 'email',
      settings: { addresses: 'porteur@example.org' },
    });
    expect(grafana.corps.get('/api/v1/provisioning/policies')).toMatchObject({
      receiver: 'Porteur du projet',
    });

    // Les alertes lisent la source des metriques de la pile, pas celle de l'usage.
    const regle = grafana.corps.get(
      `/api/v1/provisioning/alert-rules/${ALERTES[0]?.uid ?? ''}`,
    ) as {
      data: { datasourceUid: string }[];
    };
    expect(regle.data[0]?.datasourceUid).toBe('prom');
  });

  it('se relance sans rien doubler: tout se remplace', async () => {
    const grafana = grafanaFactice();
    await importerDansGrafana(grafana, {
      courriel: 'porteur@example.org',
      ecrire: () => undefined,
    });
    grafana.appels.length = 0;

    await importerDansGrafana(grafana, {
      courriel: 'porteur@example.org',
      ecrire: () => undefined,
    });

    expect(
      grafana.appels.filter(
        (appel) => appel.startsWith('POST') && appel !== 'POST /api/dashboards/db',
      ),
    ).toEqual([]);
    expect(
      grafana.appels.filter((appel) => appel.startsWith('PUT /api/v1/provisioning/alert-rules/')),
    ).toHaveLength(ALERTES.length);
  });

  it('ne touche pas au courriel sans adresse', async () => {
    const grafana = grafanaFactice();

    await importerDansGrafana(grafana, { ecrire: () => undefined });

    expect(grafana.appels.some((appel) => appel.includes('contact-points'))).toBe(false);
    expect(grafana.appels.some((appel) => appel.includes('policies'))).toBe(false);
  });

  it('refuse une pile sans source de metriques', () => {
    expect(() => sourcesDeLaPile([{ type: 'loki', name: 'x-logs', uid: 'l' }])).toThrow(
      /prometheus/u,
    );
  });
});

describe('les verifications de disponibilite', () => {
  it('les pose depuis Francfort, puis les met a jour a la relance', async () => {
    const posees: { chemin: string; corps: unknown }[] = [];
    let existantes: unknown[] = [];
    const sm: ApiHttp = async (methode, chemin, corps) => {
      if (chemin === '/api/v1/probe/list') {
        return {
          statut: 200,
          corps: [
            { id: 1, name: 'Paris' },
            { id: 7, name: 'Frankfurt' },
          ],
        };
      }
      if (chemin === '/api/v1/check/list') {
        return { statut: 200, corps: existantes };
      }
      posees.push({ chemin: `${methode} ${chemin}`, corps });
      return { statut: 200, corps: {} };
    };

    await poserLesVerifications(sm, () => undefined);

    expect(posees.map((pose) => pose.chemin)).toEqual(
      VERIFICATIONS.map(() => 'POST /api/v1/check/add'),
    );
    expect(posees[0]?.corps).toMatchObject({ job: 'production', probes: [7], frequency: 60_000 });

    existantes = VERIFICATIONS.map((verification, rang) => ({
      id: rang + 10,
      tenantId: 3,
      job: verification.job,
    }));
    posees.length = 0;
    await poserLesVerifications(sm, () => undefined);

    expect(posees.map((pose) => pose.chemin)).toEqual(
      VERIFICATIONS.map(() => 'POST /api/v1/check/update'),
    );
    expect(posees[1]?.corps).toMatchObject({ id: 11, tenantId: 3, job: 'page' });
  });
});
