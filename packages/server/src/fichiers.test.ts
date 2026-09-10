/**
 * Tests du service des fichiers.
 *
 * Ils montent un vrai serveur sur un port libre, avec deux dossiers fabriques pour
 * l'occasion, et l'interrogent comme le ferait un navigateur. Ce qu'ils
 * protegent: la page est servie avec sa politique de securite, les ressources a
 * l'adresse que le client demande, et rien d'autre, surtout pas ce qui se trouve
 * a cote des dossiers servis.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MESSAGE_DE_SANTE, POLITIQUE_DE_CONTENU } from './fichiers.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Le secret pose a cote des dossiers servis, qui ne doit jamais sortir. */
const SECRET = 'ne-doit-jamais-etre-servi';

let dossier: string;
let serveur: ServeurMonte | undefined;

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'neon-ninja-fichiers-'));

  await mkdir(join(dossier, 'client'));
  await mkdir(join(dossier, 'ressources', 'sons'), { recursive: true });
  await writeFile(
    join(dossier, 'client', 'index.html'),
    '<!doctype html><title>Page du jeu</title>',
  );
  await writeFile(join(dossier, 'client', 'app.js'), 'console.log("jeu");');
  await writeFile(join(dossier, 'ressources', 'sons', 'clic.txt'), 'un son');
  await writeFile(join(dossier, 'secret.txt'), SECRET);
});

afterEach(async () => {
  await serveur?.fermer();
  serveur = undefined;
  await rm(dossier, { recursive: true, force: true });
});

/** Monte un serveur, avec ou sans dossiers, et rend son adresse. */
async function monter(avecFichiers: boolean): Promise<string> {
  serveur = await demarrerServeur(
    0,
    avecFichiers
      ? { fichiers: { client: join(dossier, 'client'), ressources: join(dossier, 'ressources') } }
      : {},
  );

  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  return `http://127.0.0.1:${String(adresse.port)}`;
}

describe('le service des fichiers', () => {
  it('sert la page a la racine, avec sa politique de securite', async () => {
    const url = await monter(true);
    const reponse = await fetch(`${url}/`);

    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toContain('Page du jeu');
    expect(reponse.headers.get('content-security-policy')).toBe(POLITIQUE_DE_CONTENU);
    expect(reponse.headers.get('x-content-type-options')).toBe('nosniff');
    expect(reponse.headers.get('x-powered-by')).toBeNull();
  });

  it('sert le code empaquete a cote de la page', async () => {
    const url = await monter(true);
    const reponse = await fetch(`${url}/app.js`);

    expect(reponse.status).toBe(200);
    expect(reponse.headers.get('content-type')).toContain('javascript');
  });

  it('sert les ressources a l adresse que le client demande', async () => {
    const url = await monter(true);
    const reponse = await fetch(`${url}/assets/sons/clic.txt`);

    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toBe('un son');
  });

  it('ne sort jamais des dossiers servis', async () => {
    const url = await monter(true);

    for (const chemin of [
      '/assets/../secret.txt',
      '/assets/..%2Fsecret.txt',
      '/assets/%2E%2E/%2E%2E/secret.txt',
      '/..%2Fsecret.txt',
    ]) {
      const reponse = await fetch(`${url}${chemin}`);

      expect(reponse.status, chemin).not.toBe(200);
      expect(await reponse.text(), chemin).not.toContain(SECRET);
    }
  });

  it('repond a la question de sante', async () => {
    const url = await monter(true);
    const reponse = await fetch(`${url}/sante`);

    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toBe(MESSAGE_DE_SANTE);
  });

  it('laisse ses adresses a Socket.IO', async () => {
    const url = await monter(true);
    const reponse = await fetch(`${url}/socket.io/?EIO=4&transport=polling`);

    expect(reponse.status).toBe(200);
  });
});

describe('un serveur sans dossiers', () => {
  it('ne sert aucun fichier, et repond a la racine comme a la sante', async () => {
    const url = await monter(false);

    expect(await (await fetch(`${url}/`)).text()).toBe(MESSAGE_DE_SANTE);
    expect((await fetch(`${url}/index.html`)).status).toBe(404);
  });
});
