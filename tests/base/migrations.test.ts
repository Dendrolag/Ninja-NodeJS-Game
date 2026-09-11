/**
 * Tests des migrations, contre une vraie base Neon.
 *
 * La preparation globale a deja applique les migrations a une branche videe: si
 * elles ne s'appliquaient pas, aucun test de la base ne tournerait. Ces tests
 * verifient ce qu'elles ont cree, et qu'on peut les rejouer sans dommage.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DOSSIER_MIGRATIONS, appliquerMigrations } from '@neon-ninja/server';
import { CARTES, MODES } from '@neon-ninja/shared';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { adresseBase, baseDeTest, baseDisponible } from './contexte.js';

/** Nombre de migrations ecrites dans le depot, d'apres le journal de drizzle-kit. */
async function migrationsDuDepot(): Promise<number> {
  const journal = JSON.parse(
    await readFile(join(DOSSIER_MIGRATIONS, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: unknown[] };

  return journal.entries.length;
}

describe.runIf(baseDisponible())('migrations', () => {
  const db = baseDeTest();

  /** Nombre de migrations que la base se souvient d'avoir recues. */
  async function migrationsAppliquees(): Promise<number> {
    const { rows } = await db().execute<{ nombre: number }>(
      sql`select count(*)::int as nombre from drizzle.__drizzle_migrations`,
    );

    return rows[0]?.nombre ?? 0;
  }

  it('creent les tables du schema v1 et de l authentification, et aucune autre', async () => {
    const { rows } = await db().execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );

    expect(rows.map((ligne) => ligne.table_name)).toEqual([
      'comptes',
      'mots_de_passe',
      'parties',
      'progressions',
      'resultats',
      'sessions',
    ]);
  });

  it('traduisent les modes et les cartes de shared en types enumeres', async () => {
    const { rows } = await db().execute<{ type: string; valeur: string }>(
      sql`select t.typname as type, e.enumlabel as valeur
          from pg_type t join pg_enum e on e.enumtypid = t.oid
          order by t.typname, e.enumsortorder`,
    );

    const valeursDe = (type: string): string[] =>
      rows.filter((ligne) => ligne.type === type).map((ligne) => ligne.valeur);

    expect(valeursDe('mode_de_jeu')).toEqual([...MODES]);
    expect(valeursDe('carte')).toEqual(Object.keys(CARTES));
  });

  it('ont toutes ete appliquees, et se rejouent sans rien changer', async () => {
    const attendues = await migrationsDuDepot();
    expect(attendues).toBeGreaterThan(0);
    expect(await migrationsAppliquees()).toBe(attendues);

    await appliquerMigrations(adresseBase());

    expect(await migrationsAppliquees()).toBe(attendues);
  });
});
