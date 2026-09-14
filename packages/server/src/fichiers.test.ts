/**
 * Tests du service des fichiers et de la route de sante.
 *
 * Ils montent un vrai serveur sur un port libre, avec deux dossiers fabriques pour
 * l'occasion, et l'interrogent comme le ferait un navigateur. Ce qu'ils
 * protegent: la page est servie avec sa politique de securite, les ressources a
 * l'adresse que le client demande, et rien d'autre, surtout pas ce qui se trouve
 * a cote des dossiers servis. Depuis l'etape 5.3: la route de sante dit la version,
 * l'activite du serveur, et l'adresse sous laquelle il voit le demandeur.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ReponseDeSante } from './fichiers.js';
import { MESSAGE_DE_SANTE, POLITIQUE_DE_CONTENU } from './fichiers.js';
import type { OptionsServeur, ServeurMonte } from './serveur.js';
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

/** Monte un serveur avec ces options, et rend son adresse. */
async function monterAvec(options: OptionsServeur): Promise<string> {
  serveur = await demarrerServeur(0, options);

  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  return `http://127.0.0.1:${String(adresse.port)}`;
}

/** Monte un serveur, avec ou sans dossiers, et rend son adresse. */
async function monter(avecFichiers: boolean): Promise<string> {
  return monterAvec(
    avecFichiers
      ? { fichiers: { client: join(dossier, 'client'), ressources: join(dossier, 'ressources') } }
      : {},
  );
}

/** Pose la question de sante, et rend la reponse lue. */
async function sante(
  url: string,
  chemin = '/sante',
  entetes: Record<string, string> = {},
): Promise<ReponseDeSante> {
  const reponse = await fetch(`${url}${chemin}`, { headers: entetes });

  expect(reponse.status).toBe(200);

  return (await reponse.json()) as ReponseDeSante;
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

  it('laisse ses adresses a Socket.IO', async () => {
    const url = await monter(true);
    const reponse = await fetch(`${url}/socket.io/?EIO=4&transport=polling`);

    expect(reponse.status).toBe(200);
  });
});

describe('un serveur sans dossiers', () => {
  it('ne sert aucun fichier, et repond a la racine comme a la sante', async () => {
    const url = await monter(false);

    expect((await sante(url, '/')).message).toBe(MESSAGE_DE_SANTE);
    expect((await fetch(`${url}/index.html`)).status).toBe(404);
  });
});

describe('la route de sante', () => {
  it('repond sans cache, avec ou sans dossiers', async () => {
    const url = await monter(true);
    const reponse = await fetch(`${url}/sante`);

    expect(reponse.status).toBe(200);
    expect(reponse.headers.get('cache-control')).toBe('no-store');
    expect(await reponse.json()).toMatchObject({
      message: MESSAGE_DE_SANTE,
      version: null,
      parties: 0,
      joueurs: 0,
      connexions: 0,
    });
  });

  it('dit la version, les parties et les joueurs du serveur', async () => {
    const url = await monterAvec({ version: '4f48889c1d2e' });
    const jeu = serveur?.jeu;

    if (jeu === undefined) {
      throw new Error("Le serveur de test n'est pas monte.");
    }

    const partie = jeu.rooms.creer();
    jeu.rooms.creer();
    jeu.rooms.rejoindre(partie.id, { id: 'connexion-alice', pseudo: 'Alice' });
    jeu.rooms.rejoindre(partie.id, { id: 'connexion-bruno', pseudo: 'Bruno' });

    expect(await sante(url)).toMatchObject({
      version: '4f48889c1d2e',
      parties: 2,
      joueurs: 2,
      connexions: 0,
    });
  });

  it('rend l adresse du demandeur, sans croire un en-tete que personne n a pose', async () => {
    const url = await monter(false);
    const corps = await sante(url, '/sante', { 'X-Forwarded-For': '203.0.113.7' });

    expect(corps.adresse).toContain('127.0.0.1');
  });

  it('rend l adresse vue a travers les mandataires de confiance', async () => {
    const url = await monterAvec({ mandatairesDeConfiance: 1 });
    const corps = await sante(url, '/sante', { 'X-Forwarded-For': '203.0.113.7' });

    expect(corps.adresse).toBe('203.0.113.7');
  });
});
