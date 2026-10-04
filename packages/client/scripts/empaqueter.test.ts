/**
 * Tests des options d'un empaquetage lance directement.
 *
 * Ce qu'ils protegent: « pnpm build » empaquete une page sans version, que le
 * serveur de developpement accepte; le serveur de l'essai sur Oracle (etape 5.9)
 * empaquete la sienne avec la version et la date du commit, sans quoi il la
 * refuserait.
 */

import { describe, expect, it } from 'vitest';

import { optionsDeLEnvironnement } from './empaqueter.ts';

describe('optionsDeLEnvironnement', () => {
  it('ne donne aucune version sans variable, ni pour une variable vide', () => {
    expect(optionsDeLEnvironnement({})).toEqual({});
    expect(optionsDeLEnvironnement({ VERSION_DU_JEU: ' ', HORODATAGE_DU_JEU: '' })).toEqual({});
  });

  it('lit la version et la date du commit', () => {
    expect(
      optionsDeLEnvironnement({
        VERSION_DU_JEU: 'abc123 ',
        HORODATAGE_DU_JEU: '2026-10-04T12:00:00+02:00',
      }),
    ).toEqual({ version: 'abc123', horodatage: '2026-10-04T12:00:00+02:00' });
  });
});
