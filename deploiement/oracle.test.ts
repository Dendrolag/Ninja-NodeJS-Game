/**
 * Tests de la mise en ligne d'essai sur la machine Oracle (etape 5.9).
 *
 * Ce qu'ils protegent: le nouveau serveur demarre a cote de l'ancien, Caddy ne
 * bascule vers lui qu'une fois qu'il a rendu sa version, l'ancien n'est arrete
 * qu'une fois l'adresse publique conforme, et tout echec laisse l'ancien en
 * service. Ainsi que les arguments de ssh, qui refusent une machine inconnue.
 */

import { describe, expect, it } from 'vitest';

import { politiqueDeContenu } from '../packages/shared/dist/index.js';
import type { DependancesOracle, Emplacement, MachineOracle, Rythme } from './oracle.ts';
import {
  SOURCES_DE_L_IMAGE,
  argumentsSsh,
  emplacementLibre,
  emplacementLu,
  mettreEnLigneSurOracle,
  problemesApresPatience,
} from './oracle.ts';
import type { PageLue } from './verifications.ts';

const VERSION = 'a'.repeat(40);
const RYTHMES: { demarrage: Rythme; adressePublique: Rythme } = {
  demarrage: { essais: 3, intervalleMs: 1 },
  adressePublique: { essais: 2, intervalleMs: 1 },
};

/** La page publique, servie par le serveur de ce commit. */
const PAGE_CONFORME: PageLue = {
  statutDeLaPage: 200,
  politique: politiqueDeContenu(),
  statutDuCode: 200,
  code: `var a=f("","${VERSION}");`,
};

interface Scenario {
  /** L'emplacement en service avant la mise en ligne. */
  readonly actif?: Emplacement;
  /** La version que rend le nouveau serveur sur la machine, essai apres essai. */
  readonly santeDuNouveau?: readonly unknown[];
  /** La version que rend l'adresse publique. */
  readonly versionPublique?: string;
}

/** Une machine simulee, qui note chaque commande recue. */
function machineSimulee(scenario: Scenario): {
  readonly commandes: string[];
  readonly dependances: DependancesOracle;
} {
  const commandes: string[] = [];
  const reponses = [...(scenario.santeDuNouveau ?? [{ version: VERSION }])];
  let enService = scenario.actif;

  const machine: MachineOracle = {
    construire: async (version, horodatage) => {
      commandes.push(`construire ${version} ${horodatage ?? ''}`.trim());
    },
    actif: async () => {
      commandes.push('actif');
      return scenario.actif;
    },
    demarrer: async (emplacement) => {
      commandes.push(`demarrer ${emplacement}`);
    },
    sante: async (emplacement) => {
      commandes.push(`sante ${emplacement}`);
      const reponse = reponses.length > 1 ? reponses.shift() : reponses[0];

      if (reponse instanceof Error) {
        throw reponse;
      }

      return reponse;
    },
    basculer: async (emplacement) => {
      commandes.push(`basculer ${emplacement}`);
      enService = emplacement;
    },
    arreter: async (emplacement) => {
      commandes.push(`arreter ${emplacement}`);
    },
    journal: async (emplacement) => {
      commandes.push(`journal ${emplacement}`);
      return 'erreur au demarrage';
    },
    nettoyer: async () => {
      commandes.push('nettoyer');
    },
  };

  return {
    commandes,
    dependances: {
      machine,
      lireLaSantePublique: async () => ({
        version:
          enService === emplacementLibre(scenario.actif)
            ? (scenario.versionPublique ?? VERSION)
            : 'ancienne',
      }),
      lireLaPagePublique: async () => PAGE_CONFORME,
      attendre: async () => undefined,
      ecrire: () => undefined,
    },
  };
}

describe('emplacementLu et emplacementLibre', () => {
  it('lit l emplacement en service, ou rien avant la premiere mise en ligne', () => {
    expect(emplacementLu('bleu\n')).toBe('bleu');
    expect(emplacementLu('vert')).toBe('vert');
    expect(emplacementLu('')).toBeUndefined();
    expect(emplacementLu('rouge')).toBeUndefined();
  });

  it('demarre le nouveau serveur dans l emplacement que Caddy ne sert pas', () => {
    expect(emplacementLibre(undefined)).toBe('bleu');
    expect(emplacementLibre('bleu')).toBe('vert');
    expect(emplacementLibre('vert')).toBe('bleu');
  });
});

describe('problemesApresPatience', () => {
  it('repose la question jusqu a ce qu elle passe', async () => {
    const reponses = [['pas encore'], ['pas encore'], []];
    const attentes: number[] = [];

    await expect(
      problemesApresPatience(
        'X',
        async () => reponses.shift() ?? [],
        { essais: 5, intervalleMs: 7 },
        async (ms) => {
          attentes.push(ms);
        },
      ),
    ).resolves.toEqual([]);
    expect(attentes).toEqual([7, 7]);
  });

  it('rend les problemes du dernier essai, une erreur comprise', async () => {
    await expect(
      problemesApresPatience(
        'Le serveur',
        async () => Promise.reject(new Error('connexion refusee')),
        { essais: 2, intervalleMs: 1 },
        async () => undefined,
      ),
    ).resolves.toEqual(['Le serveur ne repond pas: connexion refusee']);
  });
});

describe('mettreEnLigneSurOracle', () => {
  it('construit, demarre a cote de l ancien, bascule, puis arrete l ancien', async () => {
    const { commandes, dependances } = machineSimulee({ actif: 'bleu' });

    await mettreEnLigneSurOracle(VERSION, '2026-10-04T12:00:00+02:00', dependances, RYTHMES);

    expect(commandes).toEqual([
      `construire ${VERSION} 2026-10-04T12:00:00+02:00`,
      'actif',
      'demarrer vert',
      'sante vert',
      'basculer vert',
      'arreter bleu',
      'nettoyer',
    ]);
  });

  it('met en ligne la premiere fois sans ancien a arreter', async () => {
    const { commandes, dependances } = machineSimulee({});

    await mettreEnLigneSurOracle(VERSION, undefined, dependances, RYTHMES);

    expect(commandes).toEqual([
      `construire ${VERSION}`,
      'actif',
      'demarrer bleu',
      'sante bleu',
      'basculer bleu',
      'nettoyer',
    ]);
  });

  it('attend le nouveau serveur le temps qu il demarre', async () => {
    const { commandes, dependances } = machineSimulee({
      actif: 'vert',
      santeDuNouveau: [new Error('connexion refusee'), { version: VERSION }],
    });

    await mettreEnLigneSurOracle(VERSION, undefined, dependances, RYTHMES);

    expect(commandes.filter((commande) => commande === 'sante bleu')).toHaveLength(2);
    expect(commandes).toContain('basculer bleu');
  });

  it('garde l ancien en service quand le nouveau ne repond pas', async () => {
    const { commandes, dependances } = machineSimulee({
      actif: 'bleu',
      santeDuNouveau: [new Error('connexion refusee')],
    });

    await expect(mettreEnLigneSurOracle(VERSION, undefined, dependances, RYTHMES)).rejects.toThrow(
      "l'ancien (bleu) n'a pas cesse de servir",
    );
    expect(commandes).toContain('journal vert');
    expect(commandes.at(-1)).toBe('arreter vert');
    expect(commandes.some((commande) => commande.startsWith('basculer'))).toBe(false);
  });

  it('garde l ancien en service quand le nouveau rend une autre version', async () => {
    const { commandes, dependances } = machineSimulee({
      actif: 'bleu',
      santeDuNouveau: [{ version: 'b'.repeat(40) }],
    });

    await expect(mettreEnLigneSurOracle(VERSION, undefined, dependances, RYTHMES)).rejects.toThrow(
      "n'a pas repondu",
    );
    expect(commandes).not.toContain('basculer vert');
    expect(commandes).not.toContain('arreter bleu');
  });

  it('revient a l ancien quand l adresse publique ne suit pas', async () => {
    const { commandes, dependances } = machineSimulee({ actif: 'bleu', versionPublique: 'autre' });

    await expect(mettreEnLigneSurOracle(VERSION, undefined, dependances, RYTHMES)).rejects.toThrow(
      "Caddy est revenu a l'ancien serveur (bleu)",
    );
    expect(commandes.slice(-3)).toEqual(['basculer vert', 'basculer bleu', 'arreter vert']);
  });

  it('refuse une page publique qui joindrait un autre serveur', async () => {
    const { commandes, dependances } = machineSimulee({ actif: 'bleu' });
    const ouverteAilleurs: DependancesOracle = {
      ...dependances,
      lireLaPagePublique: async () => ({
        ...PAGE_CONFORME,
        politique: politiqueDeContenu('https://neon-ninja.onrender.com'),
      }),
    };

    await expect(
      mettreEnLigneSurOracle(VERSION, undefined, ouverteAilleurs, RYTHMES),
    ).rejects.toThrow('politique de securite');
    expect(commandes).not.toContain('arreter bleu');
  });
});

describe('argumentsSsh', () => {
  it('ne joint que la machine epinglee, sans jamais poser de question', () => {
    const argumentsDuSsh = argumentsSsh(
      {
        hote: 'serveur.exemple.fr',
        utilisateur: 'deploiement',
        cle: '/tmp/cle',
        hotesConnus: '/depot/hote-connu',
      },
      ['sante', 'bleu'],
    );

    expect(argumentsDuSsh).toContain('StrictHostKeyChecking=yes');
    expect(argumentsDuSsh).toContain('UserKnownHostsFile=/depot/hote-connu');
    expect(argumentsDuSsh).toContain('BatchMode=yes');
    expect(argumentsDuSsh.slice(-3)).toEqual(['deploiement@serveur.exemple.fr', 'sante', 'bleu']);
  });
});

describe('SOURCES_DE_L_IMAGE', () => {
  it('envoie de quoi construire, et ni legacy ni documentation ni tests', () => {
    expect(SOURCES_DE_L_IMAGE).toContain('pnpm-lock.yaml');
    expect(SOURCES_DE_L_IMAGE).toContain('deploiement/oracle/Dockerfile');
    for (const absent of ['legacy', 'docs', 'tests']) {
      expect(SOURCES_DE_L_IMAGE).not.toContain(absent);
    }
  });
});
