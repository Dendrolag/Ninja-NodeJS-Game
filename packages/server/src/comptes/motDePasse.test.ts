/**
 * Tests du hachage des mots de passe.
 *
 * La plupart des tests hachent avec des parametres allegés, pour rester rapides:
 * ce qu'ils verifient ne depend pas du cout. Un seul verifie les parametres du
 * projet, et c'est aussi lui qui prouve qu'ils tiennent dans la memoire accordee.
 */

import { describe, expect, it } from 'vitest';

import type { ParametresScrypt } from './motDePasse.js';
import { PARAMETRES_SCRYPT, hacherMotDePasse, verifierMotDePasse } from './motDePasse.js';

/** Des parametres legers, pour les tests seulement. */
const LEGERS: ParametresScrypt = { N: 2 ** 10, r: 8, p: 1 };

describe('hacherMotDePasse et verifierMotDePasse', () => {
  it('reconnait le bon mot de passe et refuse les autres', async () => {
    const empreinte = await hacherMotDePasse('correct cheval pile', LEGERS);

    expect(await verifierMotDePasse('correct cheval pile', empreinte)).toBe(true);
    expect(await verifierMotDePasse('correct cheval Pile', empreinte)).toBe(false);
    expect(await verifierMotDePasse('correct cheval pile ', empreinte)).toBe(false);
    expect(await verifierMotDePasse('', empreinte)).toBe(false);
  });

  it('ne laisse rien voir du mot de passe dans l empreinte', async () => {
    const empreinte = await hacherMotDePasse('motdepasse-visible', LEGERS);

    expect(empreinte).not.toContain('motdepasse-visible');
    expect(empreinte).not.toContain(Buffer.from('motdepasse-visible').toString('base64'));
  });

  it('sale chaque empreinte: deux comptes au meme mot de passe ne se reconnaissent pas', async () => {
    const premiere = await hacherMotDePasse('meme mot de passe', LEGERS);
    const seconde = await hacherMotDePasse('meme mot de passe', LEGERS);

    expect(premiere).not.toBe(seconde);
    expect(await verifierMotDePasse('meme mot de passe', seconde)).toBe(true);
  });

  it('hache avec les parametres du projet, ecrits dans l empreinte', async () => {
    const empreinte = await hacherMotDePasse('parametres du projet');
    const { N, r, p } = PARAMETRES_SCRYPT;

    expect(empreinte.startsWith(`scrypt$${String(N)}$${String(r)}$${String(p)}$`)).toBe(true);
    expect(await verifierMotDePasse('parametres du projet', empreinte)).toBe(true);
  });

  it('verifie une empreinte avec ses propres parametres, meme s ils ont change depuis', async () => {
    const ancienne = await hacherMotDePasse('ancien compte', { N: 2 ** 9, r: 4, p: 1 });

    expect(ancienne.startsWith('scrypt$512$4$1$')).toBe(true);
    expect(await verifierMotDePasse('ancien compte', ancienne)).toBe(true);
  });

  it('accepte les lettres de toutes les langues', async () => {
    const empreinte = await hacherMotDePasse('mot de passe été 東京', LEGERS);

    expect(await verifierMotDePasse('mot de passe été 東京', empreinte)).toBe(true);
    expect(await verifierMotDePasse('mot de passe ete 東京', empreinte)).toBe(false);
  });

  it('refuse de lire une empreinte qui n en est pas une: c est une faute du serveur', async () => {
    await expect(verifierMotDePasse('x', 'motdepasse-en-clair')).rejects.toThrow();
    await expect(verifierMotDePasse('x', 'bcrypt$10$8$1$c2Vs$ZW1w')).rejects.toThrow();
    await expect(verifierMotDePasse('x', 'scrypt$abc$8$1$c2Vs$ZW1w')).rejects.toThrow();
  });
});
