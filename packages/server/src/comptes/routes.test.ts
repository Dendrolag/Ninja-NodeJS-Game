/**
 * Tests des routes HTTP des comptes, avec un service factice.
 *
 * Ces tests verifient la TRADUCTION: codes HTTP, en-tetes, corps, adresse du
 * demandeur, controle d'acces du navigateur. Ce que le service decide (mot de
 * passe, session, limites) est verifie contre une vraie base, dans
 * tests/base/authentification.test.ts.
 */

import type { MaProgression, ReponseRefusee, SessionOuverte } from '@neon-ninja/shared';
import { ROUTES_COMPTES } from '@neon-ninja/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OptionsServeur, ServeurMonte } from '../serveur.js';
import { demarrerServeur } from '../serveur.js';
import type { ReponseDeCompte, ServiceDeComptes } from './annuaire.js';

const JETON = 'J'.repeat(43);

const SESSION: SessionOuverte = { jeton: JETON, compte: { pseudo: 'Alice', niveau: 1 } };

const PROGRESSION: MaProgression = {
  pseudo: 'Alice',
  niveau: 3,
  xpTotale: 2500,
  pieces: 40,
  pointsLigue: 12,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

let serveur: ServeurMonte | undefined;

afterEach(async () => {
  await serveur?.fermer();
  serveur = undefined;
  vi.restoreAllMocks();
});

/** Monte un serveur et rend son adresse. */
async function monter(options: OptionsServeur): Promise<string> {
  serveur = await demarrerServeur(0, options);
  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  return `http://127.0.0.1:${String(adresse.port)}`;
}

/** Une reponse acceptee du service. */
function acceptee<T>(valeur: T): ReponseDeCompte<T> {
  return { acceptee: true, valeur };
}

/** Un service dont chaque methode peut etre remplacee, et dont les appels sont notes. */
function serviceFactice(remplacements: Partial<ServiceDeComptes> = {}): ServiceDeComptes {
  return {
    inscrire: vi.fn(async () => acceptee(SESSION)),
    connecter: vi.fn(async () => acceptee(SESSION)),
    deconnecter: vi.fn(async () => undefined),
    maProgression: vi.fn(async () => acceptee(PROGRESSION)),
    compteDeSession: vi.fn(async () => undefined),
    identiteDe: vi.fn(async () => undefined),
    pseudoDeCompte: vi.fn(async () => false),
    enregistrerFinDePartie: vi.fn(async () => []),
    ...remplacements,
  };
}

/** Ce qu'une requete a rendu. */
interface Reponse {
  readonly statut: number;
  readonly corps: unknown;
  readonly entetes: Headers;
}

/** Envoie une requete et lit sa reponse. */
async function requete(
  url: string,
  chemin: string,
  options: {
    readonly methode?: string;
    readonly corps?: string;
    readonly entetes?: Record<string, string>;
  } = {},
): Promise<Reponse> {
  const reponse = await fetch(`${url}${chemin}`, {
    method: options.methode ?? 'POST',
    headers: {
      ...(options.corps === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.entetes,
    },
    ...(options.corps === undefined ? {} : { body: options.corps }),
  });
  const texte = await reponse.text();

  return {
    statut: reponse.status,
    corps: texte === '' ? undefined : (JSON.parse(texte) as unknown),
    entetes: reponse.headers,
  };
}

/** Le premier motif d'un refus. */
function premierChamp(corps: unknown): string | undefined {
  return (corps as ReponseRefusee).erreurs[0]?.champ;
}

describe('un serveur sans comptes', () => {
  it('repond que les comptes sont indisponibles, sur chaque route', async () => {
    const url = await monter({});

    const inscription = await requete(url, ROUTES_COMPTES.inscription, { corps: '{}' });
    const moi = await requete(url, ROUTES_COMPTES.moi, { methode: 'GET' });

    expect(inscription.statut).toBe(503);
    expect(premierChamp(inscription.corps)).toBe('comptes');
    expect(moi.statut).toBe(503);
  });
});

describe('inscription et connexion', () => {
  it('rend 201 et la session a une inscription acceptee, en passant le corps au service', async () => {
    const service = serviceFactice();
    const url = await monter({ comptes: service });

    const reponse = await requete(url, ROUTES_COMPTES.inscription, {
      corps: JSON.stringify({ pseudo: 'Alice', motDePasse: 'secret123' }),
    });

    expect(reponse.statut).toBe(201);
    expect(reponse.corps).toEqual(SESSION);
    expect(reponse.entetes.get('cache-control')).toBe('no-store');
    expect(service.inscrire).toHaveBeenCalledWith(
      { pseudo: 'Alice', motDePasse: 'secret123' },
      expect.any(String),
    );
  });

  it('rend 200 et la session a une connexion acceptee', async () => {
    const url = await monter({ comptes: serviceFactice() });

    const reponse = await requete(url, ROUTES_COMPTES.connexion, { corps: '{}' });

    expect(reponse.statut).toBe(200);
    expect(reponse.corps).toEqual(SESSION);
  });

  it('traduit chaque motif de refus en son code', async () => {
    const refus = (motif: 'demandeInvalide' | 'pseudoPris' | 'identifiantsIncorrects') =>
      vi.fn(async () => ({
        acceptee: false as const,
        motif,
        erreurs: [{ champ: motif, motif: 'refuse' }],
      }));

    const url = await monter({
      comptes: serviceFactice({
        inscrire: refus('pseudoPris'),
        connecter: refus('identifiantsIncorrects'),
      }),
    });

    const inscription = await requete(url, ROUTES_COMPTES.inscription, { corps: '{}' });
    const connexion = await requete(url, ROUTES_COMPTES.connexion, { corps: '{}' });

    expect([inscription.statut, premierChamp(inscription.corps)]).toEqual([409, 'pseudoPris']);
    expect([connexion.statut, premierChamp(connexion.corps)]).toEqual([
      401,
      'identifiantsIncorrects',
    ]);

    await serveur?.fermer();
    const autre = await monter({ comptes: serviceFactice({ inscrire: refus('demandeInvalide') }) });
    expect((await requete(autre, ROUTES_COMPTES.inscription, { corps: '{}' })).statut).toBe(400);
  });

  it('dit dans combien de secondes reessayer apres trop de tentatives', async () => {
    const url = await monter({
      comptes: serviceFactice({
        connecter: vi.fn(async () => ({
          acceptee: false as const,
          motif: 'tropDeTentatives' as const,
          erreurs: [{ champ: 'tentatives', motif: 'Trop de tentatives.' }],
          reessayerDansMs: 42_100,
        })),
      }),
    });

    const reponse = await requete(url, ROUTES_COMPTES.connexion, { corps: '{}' });

    expect(reponse.statut).toBe(429);
    expect(reponse.entetes.get('retry-after')).toBe('43');
  });

  it('refuse un corps illisible ou trop gros sans deranger le service', async () => {
    const service = serviceFactice();
    const url = await monter({ comptes: service });

    const illisible = await requete(url, ROUTES_COMPTES.connexion, { corps: '{pas du json' });
    const tropGros = await requete(url, ROUTES_COMPTES.inscription, {
      corps: JSON.stringify({ pseudo: 'Alice', motDePasse: 'a'.repeat(10_000) }),
    });

    expect(illisible.statut).toBe(400);
    expect(tropGros.statut).toBe(413);
    expect(service.connecter).not.toHaveBeenCalled();
    expect(service.inscrire).not.toHaveBeenCalled();
  });

  it('cache le detail d une panne au demandeur, et la journalise', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const url = await monter({
      comptes: serviceFactice({
        inscrire: vi.fn(async () => {
          throw new Error('detail interne de la base');
        }),
      }),
    });

    const reponse = await requete(url, ROUTES_COMPTES.inscription, { corps: '{}' });

    expect(reponse.statut).toBe(500);
    expect(JSON.stringify(reponse.corps)).not.toContain('detail interne');
    expect(journal).toHaveBeenCalled();
  });

  it('repond en JSON a une adresse inconnue des comptes', async () => {
    const url = await monter({ comptes: serviceFactice() });

    const reponse = await requete(url, '/api/comptes/inconnue', { methode: 'GET' });

    expect(reponse.statut).toBe(404);
    expect(premierChamp(reponse.corps)).toBe('route');
  });
});

describe('routes reservees a une session', () => {
  it('refusent une demande sans jeton, ou avec un jeton mal forme, sans deranger le service', async () => {
    const service = serviceFactice();
    const url = await monter({ comptes: service });

    const sansJeton = await requete(url, ROUTES_COMPTES.moi, { methode: 'GET' });
    const malForme = await requete(url, ROUTES_COMPTES.moi, {
      methode: 'GET',
      entetes: { Authorization: 'Bearer trop-court' },
    });
    const autreForme = await requete(url, ROUTES_COMPTES.deconnexion, {
      entetes: { Authorization: `Basic ${JETON}` },
    });

    for (const reponse of [sansJeton, malForme, autreForme]) {
      expect(reponse.statut).toBe(401);
      expect(reponse.entetes.get('www-authenticate')).toBe('Bearer');
    }
    expect(service.maProgression).not.toHaveBeenCalled();
    expect(service.deconnecter).not.toHaveBeenCalled();
  });

  it('rendent la progression et ferment la session de qui presente son jeton', async () => {
    const service = serviceFactice();
    const url = await monter({ comptes: service });
    const entetes = { Authorization: `Bearer ${JETON}` };

    const moi = await requete(url, ROUTES_COMPTES.moi, { methode: 'GET', entetes });
    const deconnexion = await requete(url, ROUTES_COMPTES.deconnexion, { entetes });

    expect([moi.statut, moi.corps]).toEqual([200, PROGRESSION]);
    expect(service.maProgression).toHaveBeenCalledWith(JETON);
    expect(deconnexion.statut).toBe(204);
    expect(service.deconnecter).toHaveBeenCalledWith(JETON);
  });

  it('traduisent une session absente en 401', async () => {
    const url = await monter({
      comptes: serviceFactice({
        maProgression: vi.fn(async () => ({
          acceptee: false as const,
          motif: 'sessionAbsente' as const,
          erreurs: [{ champ: 'session', motif: 'Session absente.' }],
        })),
      }),
    });

    const reponse = await requete(url, ROUTES_COMPTES.moi, {
      methode: 'GET',
      entetes: { Authorization: `Bearer ${JETON}` },
    });

    expect(reponse.statut).toBe(401);
    expect(reponse.entetes.get('www-authenticate')).toBe('Bearer');
  });
});

describe('controle d acces du navigateur', () => {
  const ORIGINE = 'https://jeu.exemple.fr';

  it('autorise une origine de la liste, et elle seule', async () => {
    const url = await monter({ comptes: serviceFactice(), originesAutorisees: [ORIGINE] });

    const autorisee = await requete(url, ROUTES_COMPTES.connexion, {
      methode: 'OPTIONS',
      entetes: { Origin: ORIGINE, 'Access-Control-Request-Method': 'POST' },
    });
    const etrangere = await requete(url, ROUTES_COMPTES.connexion, {
      methode: 'OPTIONS',
      entetes: { Origin: 'https://ailleurs.exemple', 'Access-Control-Request-Method': 'POST' },
    });

    expect(autorisee.statut).toBe(204);
    expect(autorisee.entetes.get('access-control-allow-origin')).toBe(ORIGINE);
    expect(autorisee.entetes.get('access-control-allow-headers')).toContain('Authorization');
    expect(etrangere.entetes.get('access-control-allow-origin')).toBeNull();
  });

  it('n autorise jamais l envoi de cookies: la session est un jeton', async () => {
    const url = await monter({ comptes: serviceFactice(), originesAutorisees: [ORIGINE] });

    const reponse = await requete(url, ROUTES_COMPTES.connexion, {
      corps: '{}',
      entetes: { Origin: ORIGINE },
    });

    expect(reponse.entetes.get('access-control-allow-origin')).toBe(ORIGINE);
    expect(reponse.entetes.get('access-control-allow-credentials')).toBeNull();
  });
});

describe('adresse du demandeur', () => {
  it('ignore X-Forwarded-For sans mandataire de confiance', async () => {
    const service = serviceFactice();
    const url = await monter({ comptes: service });

    await requete(url, ROUTES_COMPTES.connexion, {
      corps: '{}',
      entetes: { 'X-Forwarded-For': '203.0.113.7' },
    });

    expect(service.connecter).toHaveBeenCalledWith({}, expect.not.stringContaining('203.0.113.7'));
  });

  it('lit l adresse transmise par un mandataire de confiance', async () => {
    const service = serviceFactice();
    const url = await monter({ comptes: service, mandatairesDeConfiance: 1 });

    await requete(url, ROUTES_COMPTES.connexion, {
      corps: '{}',
      entetes: { 'X-Forwarded-For': '203.0.113.7' },
    });

    expect(service.connecter).toHaveBeenCalledWith({}, '203.0.113.7');
  });
});
