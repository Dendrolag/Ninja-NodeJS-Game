/**
 * Tests de la mise en ligne d'essai sur la machine Oracle (etape 5.9).
 *
 * Ce qu'ils protegent: le nouveau serveur demarre a cote de l'ancien, Caddy ne
 * bascule vers lui qu'une fois qu'il a rendu sa version, l'ancien n'est arrete
 * qu'une fois l'adresse publique a cette version, et tout echec laisse l'ancien en
 * service. Ainsi que les arguments de ssh, qui refusent une machine inconnue.
 */

import { describe, expect, it } from 'vitest';

import type { DependancesOracle, Emplacement, MachineOracle } from './oracle.ts';
import {
  SOURCES_DE_L_IMAGE,
  argumentsSsh,
  emplacementLibre,
  emplacementLu,
  mettreEnLigneSurOracle,
} from './oracle.ts';
import type { Rythme } from './patience.ts';

const VERSION = 'a'.repeat(40);
const RYTHMES: { demarrage: Rythme; adressePublique: Rythme } = {
  demarrage: { essais: 3, intervalleMs: 1 },
  adressePublique: { essais: 2, intervalleMs: 1 },
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
    construire: async (version) => {
      commandes.push(`construire ${version}`);
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

describe('mettreEnLigneSurOracle', () => {
  it('construit, demarre a cote de l ancien, bascule, puis arrete l ancien', async () => {
    const { commandes, dependances } = machineSimulee({ actif: 'bleu' });

    await mettreEnLigneSurOracle(VERSION, dependances, RYTHMES);

    expect(commandes).toEqual([
      `construire ${VERSION}`,
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

    await mettreEnLigneSurOracle(VERSION, dependances, RYTHMES);

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

    await mettreEnLigneSurOracle(VERSION, dependances, RYTHMES);

    expect(commandes.filter((commande) => commande === 'sante bleu')).toHaveLength(2);
    expect(commandes).toContain('basculer bleu');
  });

  it('garde l ancien en service quand le nouveau ne repond pas', async () => {
    const { commandes, dependances } = machineSimulee({
      actif: 'bleu',
      santeDuNouveau: [new Error('connexion refusee')],
    });

    await expect(mettreEnLigneSurOracle(VERSION, dependances, RYTHMES)).rejects.toThrow(
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

    await expect(mettreEnLigneSurOracle(VERSION, dependances, RYTHMES)).rejects.toThrow(
      "n'a pas repondu",
    );
    expect(commandes).not.toContain('basculer vert');
    expect(commandes).not.toContain('arreter bleu');
  });

  it('revient a l ancien quand l adresse publique ne suit pas', async () => {
    const { commandes, dependances } = machineSimulee({ actif: 'bleu', versionPublique: 'autre' });

    await expect(mettreEnLigneSurOracle(VERSION, dependances, RYTHMES)).rejects.toThrow(
      "Caddy est revenu a l'ancien serveur (bleu)",
    );
    expect(commandes.slice(-3)).toEqual(['basculer vert', 'basculer bleu', 'arreter vert']);
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
