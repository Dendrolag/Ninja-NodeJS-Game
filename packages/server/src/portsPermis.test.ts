import { createServer } from 'node:net';
import type { Server } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { PORTS_REFUSES, TIRAGES_MAXIMUM, ecouterSurUnPortPermis } from './portsPermis.js';

/** La cause d'un fetch qui echoue, ou rien s'il aboutit. */
async function causeDeLEchec(url: string): Promise<string | undefined> {
  try {
    await fetch(url);
    return undefined;
  } catch (erreur) {
    return String((erreur as Error).cause);
  }
}

const serveurs: Server[] = [];

function nouveauServeur(): Server {
  const serveur = createServer();
  serveurs.push(serveur);
  return serveur;
}

afterEach(async () => {
  await Promise.all(
    serveurs.splice(0).map(
      async (serveur) =>
        new Promise<void>((ferme) => {
          if (serveur.listening) serveur.close(() => ferme());
          else ferme();
        }),
    ),
  );
});

describe('PORTS_REFUSES', () => {
  it('ne liste que des ports que le fetch de Node refuse vraiment', async () => {
    // Le refus tombe avant toute connexion: aucun de ces fetch ne touche le reseau.
    for (const port of PORTS_REFUSES) {
      expect(
        await causeDeLEchec(`http://127.0.0.1:${String(port)}/`),
        `port ${String(port)}`,
      ).toMatch(/bad port/u);
    }
  });

  it('contient les ports qui ont fait echouer un test sous Windows', () => {
    for (const port of [6000, 6665, 6666, 6667, 6668, 6669, 10080]) {
      expect(PORTS_REFUSES.has(port)).toBe(true);
    }
  });
});

describe('ecouterSurUnPortPermis', () => {
  it('rend le port tire par le systeme pour zero, et le serveur y ecoute', async () => {
    const serveur = nouveauServeur();

    const port = await ecouterSurUnPortPermis(serveur, 0, { hote: '127.0.0.1' });

    expect(serveur.listening).toBe(true);
    expect(port).toBeGreaterThan(0);
    expect(PORTS_REFUSES.has(port)).toBe(false);
  });

  it('rend un port refuse et en tire un autre', async () => {
    // Les deux premiers tirages sont declares refuses: c'est ce que Windows peut faire.
    const vus: number[] = [];
    const serveur = nouveauServeur();

    const port = await ecouterSurUnPortPermis(serveur, 0, {
      hote: '127.0.0.1',
      estRefuse: (tire) => {
        vus.push(tire);
        return vus.length <= 2;
      },
    });

    expect(vus).toHaveLength(3);
    expect(port).toBe(vus[2]);
    expect(serveur.listening).toBe(true);
    const adresse = serveur.address();
    expect(typeof adresse === 'object' && adresse !== null ? adresse.port : undefined).toBe(port);
  });

  it('abandonne apres trop de tirages refuses, au lieu de boucler sans fin', async () => {
    const serveur = nouveauServeur();

    await expect(
      ecouterSurUnPortPermis(serveur, 0, { hote: '127.0.0.1', estRefuse: () => true }),
    ).rejects.toThrow(String(TIRAGES_MAXIMUM));
    expect(serveur.listening).toBe(false);
  });

  it('garde un port demande explicitement, meme celui qu un fetch refuserait', async () => {
    const premier = nouveauServeur();
    const libre = await ecouterSurUnPortPermis(premier, 0, { hote: '127.0.0.1' });
    await new Promise<void>((ferme) => premier.close(() => ferme()));
    const serveur = nouveauServeur();

    const port = await ecouterSurUnPortPermis(serveur, libre, {
      hote: '127.0.0.1',
      estRefuse: () => true,
    });

    expect(port).toBe(libre);
  });

  it('rend l erreur du systeme quand le port est pris', async () => {
    const premier = nouveauServeur();
    const pris = await ecouterSurUnPortPermis(premier, 0, { hote: '127.0.0.1' });

    await expect(
      ecouterSurUnPortPermis(nouveauServeur(), pris, { hote: '127.0.0.1' }),
    ).rejects.toThrow(/EADDRINUSE/u);
  });
});
