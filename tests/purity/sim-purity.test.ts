/**
 * Verification de l'invariant de purete du coeur de simulation.
 *
 * Ce test ne verifie pas du code applicatif: il verifie que le garde-fou lui-meme
 * fonctionne. Il soumet a ESLint des extraits qui violent volontairement la regle
 * .claude/rules/sim-purity.md, en pretendant qu'ils vivent dans packages/sim, et
 * exige que le linter les refuse.
 *
 * Sans ce test, rien ne garantirait que la regle est encore active. Une
 * configuration ESLint peut se casser en silence, et l'invariant tomberait sans
 * que personne s'en apercoive avant qu'il soit trop tard.
 */

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/** Chemin fictif situe dans le coeur de simulation, pour activer le bloc de regles dedie. */
const FICHIER_DANS_SIM = 'packages/sim/src/fichier-de-verification.ts';

/** Chemin fictif situe hors du coeur, ou les memes ecritures sont autorisees. */
const FICHIER_HORS_SIM = 'packages/server/src/fichier-de-verification.ts';

let eslint: ESLint;

/** Lint un extrait comme s'il se trouvait au chemin indique, et renvoie les regles declenchees. */
async function reglesDeclenchees(code: string, chemin: string): Promise<string[]> {
  const resultats = await eslint.lintText(code, { filePath: chemin });
  return resultats.flatMap((resultat) =>
    resultat.messages.map((message) => message.ruleId ?? 'erreur-de-syntaxe'),
  );
}

beforeAll(() => {
  eslint = new ESLint();
});

describe('invariant de purete de packages/sim', () => {
  describe('imports interdits', () => {
    const casInterdits: ReadonlyArray<readonly [string, string]> = [
      ['socket.io', "import { Server } from 'socket.io';\nexport const s: unknown = Server;"],
      ['express', "import express from 'express';\nexport const e: unknown = express;"],
      ['pixi.js', "import { Application } from 'pixi.js';\nexport const a: unknown = Application;"],
      [
        'node:fs',
        "import { readFileSync } from 'node:fs';\nexport const r: unknown = readFileSync;",
      ],
      ['fs', "import { readFileSync } from 'fs';\nexport const r: unknown = readFileSync;"],
      [
        'node:http',
        "import { createServer } from 'node:http';\nexport const c: unknown = createServer;",
      ],
    ];

    it.each(casInterdits)('refuse un import de %s', async (_nom, code) => {
      expect(await reglesDeclenchees(code, FICHIER_DANS_SIM)).toContain('no-restricted-imports');
    });
  });

  describe("lecture de l'horloge et du hasard", () => {
    it('refuse Date.now()', async () => {
      const code = 'export const maintenant = Date.now();';
      expect(await reglesDeclenchees(code, FICHIER_DANS_SIM)).toContain('no-restricted-properties');
    });

    it('refuse Math.random()', async () => {
      const code = 'export const tirage = Math.random();';
      expect(await reglesDeclenchees(code, FICHIER_DANS_SIM)).toContain('no-restricted-properties');
    });
  });

  describe('acces au navigateur', () => {
    it('refuse document', async () => {
      const code = 'export const element = document.querySelector("canvas");';
      expect(await reglesDeclenchees(code, FICHIER_DANS_SIM)).toContain('no-restricted-globals');
    });
  });

  describe('code conforme', () => {
    it('accepte une fonction pure qui recoit le temps et la graine', async () => {
      const code = [
        'interface Etat { readonly temps: number; readonly graine: number }',
        'export function tick(etat: Etat, dt: number): Etat {',
        '  return { temps: etat.temps + dt, graine: etat.graine };',
        '}',
      ].join('\n');

      expect(await reglesDeclenchees(code, FICHIER_DANS_SIM)).toEqual([]);
    });
  });

  describe('portee de la regle', () => {
    it('autorise Date.now() hors du coeur de simulation', async () => {
      const code = 'export const maintenant = Date.now();';
      expect(await reglesDeclenchees(code, FICHIER_HORS_SIM)).not.toContain(
        'no-restricted-properties',
      );
    });

    it('autorise socket.io hors du coeur de simulation', async () => {
      const code = "import { Server } from 'socket.io';\nexport const s: unknown = Server;";
      expect(await reglesDeclenchees(code, FICHIER_HORS_SIM)).not.toContain(
        'no-restricted-imports',
      );
    });
  });
});
