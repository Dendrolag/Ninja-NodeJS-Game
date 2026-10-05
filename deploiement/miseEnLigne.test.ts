/**
 * Tests de la mise en ligne et de la bascule (etape 5.13).
 *
 * Ce qu'ils protegent: la page n'est promue qu'apres un serveur de la production
 * verifie; un echec de la production ne promeut rien; un echec du secours ne fait
 * pas echouer la mise en ligne, et se dit; la production est le serveur que joint
 * la page publique. Et pour la bascule: la page est empaquetee pour le serveur
 * choisi, et lui seul dans sa politique de securite; un serveur qui ne rend pas la
 * version en ligne est refuse avant toute promotion.
 */

import { describe, expect, it } from 'vitest';

import { politiqueDeContenu } from '../packages/shared/dist/index.js';
import type { DependancesDeLaMiseEnLigne, NomDuServeur } from './miseEnLigne.ts';
import { autreServeur, basculer, mettreEnLigne } from './miseEnLigne.ts';
import type { PageLue } from './verifications.ts';

const ANCIENNE = 'a'.repeat(40);
const NOUVELLE = 'b'.repeat(40);
const RYTHME = { essais: 2, intervalleMs: 1 };

const ORIGINES: Readonly<Record<NomDuServeur, string>> = {
  oracle: 'https://serveur.ninja.dendrolag.fr',
  render: 'https://neon-ninja.onrender.com',
};

/** La page publique empaquetee pour ce serveur et ce commit. */
function page(serveur: NomDuServeur, version: string): PageLue {
  return {
    statutDeLaPage: 200,
    html: `<head><meta name="serveur-de-jeu" content="${ORIGINES[serveur]}" /></head>`,
    politique: politiqueDeContenu(ORIGINES[serveur]),
    statutDuCode: 200,
    code: `var a=f("${ORIGINES[serveur]}","${version}");`,
  };
}

interface Scenario {
  /** Le serveur que joint la page publique, et son commit. */
  readonly page?: PageLue;
  /** Le commit que sert chaque serveur, rien s'il ne repond pas. */
  readonly versions?: Partial<Record<NomDuServeur, string | undefined>>;
  /** Les serveurs dont la mise en ligne echoue. */
  readonly enPanne?: readonly NomDuServeur[];
  /** Les fichiers changes depuis le commit en ligne. */
  readonly changes?: readonly string[];
  /** La promotion ne change pas ce que sert l'adresse publique. */
  readonly promotionSansEffet?: boolean;
}

/** Le monde simule: une page publique, deux serveurs, et ce qui leur arrive, dans l'ordre. */
function monde(scenario: Scenario = {}): {
  readonly evenements: string[];
  readonly ecrit: string[];
  readonly dependances: DependancesDeLaMiseEnLigne;
  pagePublique(): PageLue;
} {
  const evenements: string[] = [];
  const ecrit: string[] = [];
  const versions: Partial<Record<NomDuServeur, string | undefined>> = {
    oracle: ANCIENNE,
    render: ANCIENNE,
    ...scenario.versions,
  };
  const envoyees = new Map<string, PageLue>();
  let enLigne = scenario.page ?? page('oracle', ANCIENNE);

  const serveurDeLOrigine = (origine: string): NomDuServeur =>
    origine === ORIGINES.oracle ? 'oracle' : 'render';

  const mettreEnLigneSur = (nom: NomDuServeur) => async (version: string) => {
    evenements.push(`serveur ${nom} ${version === NOUVELLE ? 'nouvelle' : 'ancienne'}`);

    if (scenario.enPanne?.includes(nom) === true) {
      throw new Error(`${nom} ne demarre pas.\nJournal: erreur.`);
    }

    versions[nom] = version;
  };

  return {
    evenements,
    ecrit,
    pagePublique: () => enLigne,
    dependances: {
      origines: ORIGINES,
      page: {
        lire: async () => enLigne,
        envoyer: async (serveurDeJeu, version) => {
          const nom = serveurDeLOrigine(serveurDeJeu);
          const adresse = `https://page-${String(envoyees.size + 1)}.vercel.app`;
          evenements.push(`envoi de la page pour ${nom}`);
          envoyees.set(adresse, page(nom, version));
          return adresse;
        },
        promouvoir: async (deploiement) => {
          evenements.push('promotion');
          const envoyee = envoyees.get(deploiement);

          if (envoyee !== undefined && scenario.promotionSansEffet !== true) {
            enLigne = envoyee;
          }
        },
      },
      versionEnLigne: async (origine) => versions[serveurDeLOrigine(origine)],
      fichiersChanges: async () => scenario.changes ?? ['packages/server/src/principal.ts'],
      mettreEnLigneSur: { oracle: mettreEnLigneSur('oracle'), render: mettreEnLigneSur('render') },
      attendre: async () => undefined,
      ecrire: (texte) => {
        ecrit.push(texte);
      },
    },
  };
}

describe('autreServeur', () => {
  it('nomme le secours de chaque serveur', () => {
    expect(autreServeur('oracle')).toBe('render');
    expect(autreServeur('render')).toBe('oracle');
  });
});

describe('mettreEnLigne', () => {
  it('envoie la page, met en ligne Oracle, promeut la page, puis met Render a jour', async () => {
    const { evenements, dependances, pagePublique } = monde();

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).resolves.toEqual({
      production: 'oracle',
      version: NOUVELLE,
      misEnLigne: true,
      secoursAJour: true,
    });
    expect(evenements).toEqual([
      'envoi de la page pour oracle',
      'serveur oracle nouvelle',
      'promotion',
      'serveur render nouvelle',
    ]);
    expect(pagePublique()).toEqual(page('oracle', NOUVELLE));
  });

  it('ne promeut rien quand le serveur de la production ne se met pas en ligne', async () => {
    const { evenements, dependances, pagePublique } = monde({ enPanne: ['oracle'] });

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).rejects.toThrow(
      'oracle ne demarre pas',
    );
    expect(evenements).toEqual(['envoi de la page pour oracle', 'serveur oracle nouvelle']);
    expect(pagePublique()).toEqual(page('oracle', ANCIENNE));
  });

  it('reussit quand le secours echoue, et le dit en une annotation', async () => {
    const { dependances, ecrit, pagePublique } = monde({ enPanne: ['render'] });

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).resolves.toMatchObject({
      production: 'oracle',
      misEnLigne: true,
      secoursAJour: false,
    });
    expect(pagePublique()).toEqual(page('oracle', NOUVELLE));

    const annotation = ecrit.find((texte) => texte.startsWith('::warning'));
    expect(annotation).toContain('render ne demarre pas. Journal: erreur.');
    expect(annotation?.trimEnd()).not.toContain('\n');
  });

  it('suit la bascule: Render est la production quand la page le joint', async () => {
    const { evenements, dependances, pagePublique } = monde({ page: page('render', ANCIENNE) });

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).resolves.toMatchObject({
      production: 'render',
      secoursAJour: true,
    });
    expect(evenements).toEqual([
      'envoi de la page pour render',
      'serveur render nouvelle',
      'promotion',
      'serveur oracle nouvelle',
    ]);
    expect(pagePublique()).toEqual(page('render', NOUVELLE));
  });

  it('refuse une page publique qui ne joint aucun des deux serveurs', async () => {
    const { evenements, dependances } = monde({
      page: { ...page('oracle', ANCIENNE), politique: politiqueDeContenu() },
    });

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).rejects.toThrow(
      "n'ouvre ni a Oracle ni a Render",
    );
    expect(evenements).toEqual([]);
  });

  it('echoue quand l adresse publique ne sert pas la page promue', async () => {
    const { dependances } = monde({ promotionSansEffet: true });

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).rejects.toThrow(
      "La page publique n'est pas conforme",
    );
  });

  it('met en ligne quand la production ne dit pas sa version', async () => {
    const { evenements, dependances } = monde({ versions: { oracle: undefined } });

    await mettreEnLigne(NOUVELLE, dependances, RYTHME);

    expect(evenements).toContain('serveur oracle nouvelle');
  });

  it('ne remet pas en ligne un commit qui n a change que la documentation', async () => {
    const { evenements, dependances } = monde({ changes: ['docs/deploiement.md'] });

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).resolves.toEqual({
      production: 'oracle',
      version: ANCIENNE,
      misEnLigne: false,
      secoursAJour: true,
    });
    expect(evenements).toEqual([]);
  });

  it('remet le secours a la version de la production, meme sans rien mettre en ligne', async () => {
    const { evenements, dependances } = monde({
      versions: { oracle: NOUVELLE, render: ANCIENNE },
      page: page('oracle', NOUVELLE),
    });

    await expect(mettreEnLigne(NOUVELLE, dependances, RYTHME)).resolves.toMatchObject({
      misEnLigne: false,
      secoursAJour: true,
    });
    expect(evenements).toEqual(['serveur render nouvelle']);
  });

  it('ne redeploie pas un secours deja a la version', async () => {
    const { evenements, dependances } = monde({ versions: { render: NOUVELLE } });

    await mettreEnLigne(NOUVELLE, dependances, RYTHME);

    expect(evenements).not.toContain('serveur render nouvelle');
  });
});

describe('basculer', () => {
  it('fait joindre Render a la page, au commit en ligne, et a lui seul', async () => {
    const { evenements, dependances, pagePublique } = monde();

    await basculer('render', ANCIENNE, dependances, RYTHME);

    expect(evenements).toEqual(['envoi de la page pour render', 'promotion']);
    expect(pagePublique()).toEqual(page('render', ANCIENNE));
    expect(pagePublique().politique).not.toContain(ORIGINES.oracle);
  });

  it('revient vers Oracle de meme', async () => {
    const { dependances, pagePublique } = monde({ page: page('render', ANCIENNE) });

    await basculer('oracle', ANCIENNE, dependances, RYTHME);

    expect(pagePublique()).toEqual(page('oracle', ANCIENNE));
  });

  it('ne fait rien quand la page joint deja ce serveur', async () => {
    const { evenements, dependances } = monde();

    await basculer('oracle', ANCIENNE, dependances, RYTHME);

    expect(evenements).toEqual([]);
  });

  it('refuse un serveur qui ne dit pas sa version, avant toute promotion', async () => {
    const { evenements, dependances } = monde({ versions: { render: undefined } });

    await expect(basculer('render', ANCIENNE, dependances, RYTHME)).rejects.toThrow(
      'ne dit pas sa version',
    );
    expect(evenements).toEqual([]);
  });

  it('refuse un serveur qui n est pas a la version de la page en ligne', async () => {
    const { evenements, dependances, pagePublique } = monde({
      page: page('oracle', NOUVELLE),
      versions: { oracle: NOUVELLE, render: ANCIENNE },
    });

    await expect(basculer('render', ANCIENNE, dependances, RYTHME)).rejects.toThrow(
      'il refuserait les joueurs',
    );
    expect(evenements).toEqual([]);
    expect(pagePublique()).toEqual(page('oracle', NOUVELLE));
  });

  it('refuse des sources d un autre commit que celui du serveur', async () => {
    const { evenements, dependances } = monde();

    await expect(basculer('render', NOUVELLE, dependances, RYTHME)).rejects.toThrow(
      `git checkout ${ANCIENNE}`,
    );
    expect(evenements).toEqual([]);
  });

  it('echoue quand l adresse publique ne sert pas la page promue', async () => {
    const { dependances } = monde({ promotionSansEffet: true });

    await expect(basculer('render', ANCIENNE, dependances, RYTHME)).rejects.toThrow(
      "La page publique n'est pas conforme",
    );
  });
});
