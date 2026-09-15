/**
 * Tests des verifications du deploiement.
 *
 * Ce qu'ils protegent: le deploiement n'attend un serveur que tant qu'il se
 * construit ou demarre, ne se declare fini que si le serveur en ligne est de la
 * version deployee, et ne laisse passer qu'une page publique de ce commit, qui
 * vise ce serveur, avec sa politique de securite.
 */

import { describe, expect, it } from 'vitest';

import { politiqueDeContenu } from '../packages/shared/dist/index.js';
import type { PageLue } from './verifications.ts';
import {
  adresseDuDeploiementVercel,
  deploiementDuCommit,
  fichiersQuiChangentLeJeu,
  issueDuDeploiement,
  problemesDeLaPage,
  problemesDeSante,
  versionEnLigne,
} from './verifications.ts';

const VERSION = '4f48889c1d2e3f4a';
const SERVEUR = 'https://neon-ninja.onrender.com';

/** La page publique d'un deploiement reussi. */
const PAGE_CONFORME: PageLue = {
  statutDeLaPage: 200,
  politique: politiqueDeContenu(SERVEUR),
  statutDuCode: 200,
  code: `var a=f("${SERVEUR}","${VERSION}");`,
};

// Recette de l'etape 5.4, sur decision du porteur du projet: chaque poussee, meme
// de documentation, remettait le serveur en ligne et coupait les parties en cours.
describe('versionEnLigne', () => {
  it('lit la version dans la reponse de la route de sante', () => {
    expect(versionEnLigne({ message: 'Neon Ninja: le serveur tourne.', version: VERSION })).toBe(
      VERSION,
    );
  });

  it('ne rend rien pour une reponse sans version lisible', () => {
    for (const corps of [undefined, null, 'texte', {}, { version: '' }, { version: 12 }]) {
      expect(versionEnLigne(corps), JSON.stringify(corps)).toBeUndefined();
    }
  });
});

describe('fichiersQuiChangentLeJeu', () => {
  it('ecarte ce qui ne part pas en ligne: documentation, tests, legacy, reglages de l agent', () => {
    expect(
      fichiersQuiChangentLeJeu([
        'docs/handoffs/etape-5-4-handoff.md',
        'CLAUDE.md',
        'tests/e2e/rendu-couleurs.spec.ts',
        'tests/caracterisation/score.test.ts',
        'legacy/server.js',
        '.claude/launch.json',
        'packages/client/src/rendu/scene.test.ts',
        'deploiement/verifications.test.ts',
      ]),
    ).toEqual([]);
  });

  // Recette de l'etape 5.4: le commit 9dadf92, qui ne changeait que le nombre de
  // scenarios de bout en bout joues a la fois en local, a remis le serveur en ligne.
  it('ecarte l outillage des tests, du linter et du formateur pose a la racine', () => {
    expect(
      fichiersQuiChangentLeJeu([
        'playwright.config.ts',
        'vitest.config.ts',
        'vitest.workspace.ts',
        'tsconfig.tests.json',
        'tsconfig.e2e.json',
        'eslint.config.js',
        '.prettierrc.json',
        '.prettierignore',
      ]),
    ).toEqual([]);
  });

  it('garde tout ce qui compose la page, le serveur ou leur mise en ligne', () => {
    const jeu = [
      'packages/client/src/rendu/pixi.ts',
      'packages/client/page/styles/jeu.css',
      'packages/server/migrations/0004_quelque_chose.sql',
      'assets/ninja/idle.png',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      'tsconfig.json',
      '.node-version',
      'deploiement/deployer.ts',
      '.github/workflows/ci.yml',
    ];

    expect(fichiersQuiChangentLeJeu(jeu)).toEqual(jeu);
  });

  it('garde un fichier qu elle ne connait pas: dans le doute, on met en ligne', () => {
    expect(fichiersQuiChangentLeJeu(['nouveau/fichier.ts'])).toEqual(['nouveau/fichier.ts']);
  });
});

describe('issueDuDeploiement', () => {
  it('attend tant que le serveur se construit ou demarre', () => {
    for (const statut of [
      'created',
      'queued',
      'build_in_progress',
      'update_in_progress',
      'pre_deploy_in_progress',
    ]) {
      expect(issueDuDeploiement(statut), statut).toBe('enCours');
    }
  });

  it('se declare fini quand le serveur est en ligne', () => {
    expect(issueDuDeploiement('live')).toBe('enLigne');
  });

  it('arrete sur un echec, une annulation, un remplacement, ou un statut inconnu', () => {
    for (const statut of [
      'build_failed',
      'update_failed',
      'pre_deploy_failed',
      'canceled',
      'deactivated',
      'un_statut_nouveau',
      undefined,
    ]) {
      expect(issueDuDeploiement(statut), String(statut)).toBe('echoue');
    }
  });
});

describe('adresseDuDeploiementVercel', () => {
  it('lit l adresse dans la sortie JSON du mode non interactif', () => {
    // Forme relevee le 14 septembre 2026, outil 59.16.0, raccourcie.
    const sortie = JSON.stringify({
      status: 'ok',
      deployment: {
        id: 'dpl_BHCtMkqaHyhzZUncW4tN3Y2dGNPa',
        url: 'https://neon-ninja-iado5tkei-dendrolags-projects.vercel.app',
        readyState: 'READY',
        target: 'production',
      },
      next: [{ command: 'vercel curl https://ailleurs.vercel.app', when: 'Verify deployment' }],
    });

    expect(adresseDuDeploiementVercel(sortie)).toBe(
      'https://neon-ninja-iado5tkei-dendrolags-projects.vercel.app',
    );
  });

  it('lit encore l ancien format, l adresse seule sur la derniere ligne', () => {
    expect(
      adresseDuDeploiementVercel(
        'Vercel CLI\nhttps://neon-ninja-abc-dendrolags-projects.vercel.app\n',
      ),
    ).toBe('https://neon-ninja-abc-dendrolags-projects.vercel.app');
  });

  it('ne rend rien d une sortie sans adresse', () => {
    expect(adresseDuDeploiementVercel('')).toBeUndefined();
    expect(adresseDuDeploiementVercel('{"status":"error","deployment":{}}')).toBeUndefined();
    expect(adresseDuDeploiementVercel('Inspect https://vercel.com/quelque-part')).toBeUndefined();
  });
});

describe('deploiementDuCommit', () => {
  it('lit le deploiement que Render vient de creer', () => {
    expect(
      deploiementDuCommit({ id: 'dep-1', status: 'created', commit: { id: VERSION } }, VERSION),
    ).toBe('dep-1');
  });

  it('retrouve le deploiement de ce commit dans la liste des deploiements recents', () => {
    const liste = [
      { deploy: { id: 'dep-3', commit: { id: 'un-commit-plus-recent' } }, cursor: 'a' },
      { deploy: { id: 'dep-2', commit: { id: VERSION } }, cursor: 'b' },
      { deploy: { id: 'dep-1', commit: { id: VERSION } }, cursor: 'c' },
    ];

    expect(deploiementDuCommit(liste, VERSION)).toBe('dep-2');
  });

  it('ne rend rien quand aucun deploiement n est celui de ce commit', () => {
    expect(deploiementDuCommit({ id: 'dep-1', commit: { id: 'autre' } }, VERSION)).toBeUndefined();
    expect(deploiementDuCommit([{ deploy: { commit: { id: VERSION } } }], VERSION)).toBeUndefined();
    expect(deploiementDuCommit([null, 'texte', {}], VERSION)).toBeUndefined();
    expect(deploiementDuCommit(undefined, VERSION)).toBeUndefined();
  });
});

describe('problemesDeSante', () => {
  it('ne trouve rien a un serveur de la version deployee', () => {
    expect(problemesDeSante({ message: 'Neon Ninja', version: VERSION }, VERSION)).toEqual([]);
  });

  it('nomme la version en ligne quand ce n est pas la bonne', () => {
    expect(problemesDeSante({ version: 'ancienne' }, VERSION)).toEqual([
      `Le serveur en ligne est de la version « ancienne », attendu « ${VERSION} ».`,
    ]);
    expect(problemesDeSante({ version: null }, VERSION)).toHaveLength(1);
  });

  it('refuse une reponse qui n est pas un objet', () => {
    expect(problemesDeSante('Neon Ninja: le serveur tourne.', VERSION)).toHaveLength(1);
    expect(problemesDeSante(null, VERSION)).toHaveLength(1);
  });
});

describe('problemesDeLaPage', () => {
  it('ne trouve rien a la page de ce commit', () => {
    expect(problemesDeLaPage(PAGE_CONFORME, SERVEUR, VERSION)).toEqual([]);
  });

  it('releve une page ou un code qui ne repondent pas', () => {
    expect(problemesDeLaPage({ ...PAGE_CONFORME, statutDeLaPage: 404 }, SERVEUR, VERSION)).toEqual([
      'La page repond 404, attendu 200.',
    ]);
    expect(
      problemesDeLaPage({ ...PAGE_CONFORME, statutDuCode: 404, code: '' }, SERVEUR, VERSION),
    ).toEqual(['app.js repond 404, attendu 200.']);
  });

  it('releve une politique absente, ou ouverte a un autre serveur', () => {
    expect(problemesDeLaPage({ ...PAGE_CONFORME, politique: null }, SERVEUR, VERSION)).toHaveLength(
      1,
    );
    expect(
      problemesDeLaPage(
        { ...PAGE_CONFORME, politique: politiqueDeContenu('https://autre.onrender.com') },
        SERVEUR,
        VERSION,
      ),
    ).toHaveLength(1);
  });

  it('releve un code d un autre commit, ou qui vise un autre serveur', () => {
    expect(
      problemesDeLaPage({ ...PAGE_CONFORME, code: `f("${SERVEUR}","ancienne")` }, SERVEUR, VERSION),
    ).toHaveLength(1);
    expect(
      problemesDeLaPage(
        { ...PAGE_CONFORME, code: `f("https://autre.onrender.com","${VERSION}")` },
        SERVEUR,
        VERSION,
      ),
    ).toHaveLength(1);
  });
});
