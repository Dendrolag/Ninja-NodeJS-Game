/**
 * Tests des reprises de migration au demarrage, sans base (etape 8.8).
 *
 * Les migrations elles-memes sont testees sur une vraie base dans tests/base/.
 */

import { describe, expect, it, vi } from 'vitest';

import { TENTATIVES_DE_MIGRATION, appliquerMigrationsAvecReprises } from './migrations.js';

describe('appliquerMigrationsAvecReprises', () => {
  it('migre du premier coup quand la base repond', async () => {
    const appliquer = vi.fn(async () => undefined);

    await appliquerMigrationsAvecReprises('postgresql://base', appliquer);

    expect(appliquer).toHaveBeenCalledOnce();
  });

  it('reprend apres un echec, et le dit', async () => {
    const plainte = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const appliquer = vi
      .fn<(adresse: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))
      .mockResolvedValueOnce(undefined);

    await appliquerMigrationsAvecReprises('postgresql://base', appliquer);

    expect(appliquer).toHaveBeenCalledTimes(2);
    expect(plainte).toHaveBeenCalledOnce();
    expect(String(plainte.mock.calls[0]?.[0])).toContain('tentative 1');
    plainte.mockRestore();
  });

  it('abandonne apres la derniere tentative, en remontant l erreur', async () => {
    const plainte = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const appliquer = vi.fn(async () => {
      throw new Error('base muette');
    });

    await expect(appliquerMigrationsAvecReprises('postgresql://base', appliquer)).rejects.toThrow(
      'base muette',
    );
    expect(appliquer).toHaveBeenCalledTimes(TENTATIVES_DE_MIGRATION);
    plainte.mockRestore();
  });
});
