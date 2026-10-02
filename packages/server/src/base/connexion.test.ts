/**
 * Tests des adresses d'une base Neon et de l'ouverture de la base, sans base.
 *
 * Les operations sur une vraie base sont testees dans tests/base/.
 */

import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';

import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { adresseChiffree, adresseDirecte, adressePooler, ouvrirBase } from './connexion.js';

const DIRECTE =
  'postgresql://neondb_owner:mot%2Fde%3Apasse@ep-cool-darkness-123456.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const POOLER =
  'postgresql://neondb_owner:mot%2Fde%3Apasse@ep-cool-darkness-123456-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

describe('adresses d une base Neon', () => {
  it('passe du pooler a l adresse directe en ne touchant qu a l hote', () => {
    expect(adresseDirecte(POOLER)).toBe(DIRECTE);
  });

  it('passe de l adresse directe au pooler en ne touchant qu a l hote', () => {
    expect(adressePooler(DIRECTE)).toBe(POOLER);
  });

  it('laisse intacte une adresse qui est deja de la bonne sorte', () => {
    expect(adresseDirecte(DIRECTE)).toBe(DIRECTE);
    expect(adressePooler(POOLER)).toBe(POOLER);
  });

  it('ne cherche le suffixe que dans le premier segment de l hote', () => {
    const piege = 'postgresql://u:p@ep-a.region-pooler.neon.tech/base';

    expect(adresseDirecte(piege)).toBe(piege);
  });
});

describe('adresseChiffree', () => {
  it('demande explicitement la verification du certificat a la place de require', () => {
    const chiffree = new URL(adresseChiffree(DIRECTE));

    expect(chiffree.searchParams.get('sslmode')).toBe('verify-full');
    expect(chiffree.searchParams.get('channel_binding')).toBe('require');
    expect(chiffree.hostname).toBe(new URL(DIRECTE).hostname);
    expect(chiffree.password).toBe(new URL(DIRECTE).password);
  });

  it('ne touche pas a une adresse qui choisit deja son mode', () => {
    const verifiee = 'postgresql://u:p@hote/base?sslmode=verify-full';
    const sansMode = 'postgresql://u:p@hote/base';

    expect(adresseChiffree(verifiee)).toBe(verifiee);
    expect(adresseChiffree(sansMode)).toBe(sansMode);
  });
});

describe('ouvrirBase', () => {
  it('n ouvre aucune connexion avant la premiere requete, et se referme', async () => {
    // Aucun serveur n'ecoute sur ce port: une connexion ouverte a l'ouverture
    // ferait echouer le test.
    const base = ouvrirBase('postgresql://personne:rien@127.0.0.1:1/aucune');

    expect(base.db).toBeDefined();
    await expect(base.fermer()).resolves.toBeUndefined();
  });

  it('abandonne une base qui ne repond pas, au lieu de l attendre sans fin (etape 8.8)', async () => {
    // Un serveur qui accepte la connexion et ne dit jamais rien: la base muette qui a
    // retenu une mise en ligne quinze minutes, le 2 octobre 2026.
    const prises: Socket[] = [];
    const muet = createServer((prise) => prises.push(prise));
    await new Promise<void>((pret) => muet.listen(0, '127.0.0.1', pret));
    const { port } = muet.address() as AddressInfo;
    const base = ouvrirBase(`postgresql://personne:rien@127.0.0.1:${String(port)}/aucune`, {
      delaiDeConnexionMs: 200,
    });

    try {
      const erreur: unknown = await base.db.execute(sql`select 1`).then(
        () => undefined,
        (raison: unknown) => raison,
      );

      // Drizzle enveloppe l'erreur du pilote: c'est sa cause qui dit le delai depasse.
      expect(erreur).toBeInstanceOf(Error);
      expect(String((erreur as Error).cause)).toMatch(/timeout/iu);
    } finally {
      await base.fermer();
      for (const prise of prises) prise.destroy();
      await new Promise((ferme) => muet.close(ferme));
    }
  });
});
