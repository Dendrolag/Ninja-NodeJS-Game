/**
 * Tests du controle de version entre la page et le serveur.
 *
 * Ce qu'ils protegent: un serveur construit d'un commit n'accepte que la page du
 * meme commit, quoi que la page envoie; un serveur sans version accepte tout; et la
 * ligne affichee en pied d'accueil dit la meme chose a tout le monde, quelle que soit
 * la langue du navigateur et le fuseau de la machine (etapes 8.4 et 4.9).
 */

import { describe, expect, it } from 'vitest';

import {
  LIBELLE_DE_DEVELOPPEMENT,
  NUMERO_DE_VERSION,
  dateCourteDeVersion,
  dateDeVersion,
  infobulleDeVersion,
  libelleDeVersion,
  versionAcceptee,
  versionMineure,
} from './version.js';

const VERSION = '4f48889c1d2e';

describe('versionAcceptee', () => {
  it('accepte la page construite du meme commit', () => {
    expect(versionAcceptee(VERSION, { version: VERSION })).toBe(true);
    expect(versionAcceptee(VERSION, { version: VERSION, jeton: 'j'.repeat(43) })).toBe(true);
  });

  it('refuse la page d un autre commit', () => {
    expect(versionAcceptee(VERSION, { version: 'autre' })).toBe(false);
    expect(versionAcceptee(VERSION, { version: 42 })).toBe(false);
  });

  it('refuse une page qui ne dit pas sa version', () => {
    expect(versionAcceptee(VERSION, {})).toBe(false);
    expect(versionAcceptee(VERSION, { jeton: 'j'.repeat(43) })).toBe(false);
    expect(versionAcceptee(VERSION, undefined)).toBe(false);
    expect(versionAcceptee(VERSION, null)).toBe(false);
    expect(versionAcceptee(VERSION, VERSION)).toBe(false);
  });

  it('ne lit pas une version heritee plutot que portee', () => {
    const heritee: unknown = Object.create({ version: VERSION });

    expect(versionAcceptee(VERSION, heritee)).toBe(false);
  });

  it('laisse un serveur sans version accepter toute page', () => {
    expect(versionAcceptee(undefined, undefined)).toBe(true);
    expect(versionAcceptee(undefined, { version: 'n importe laquelle' })).toBe(true);
  });
});

describe('dateDeVersion', () => {
  it('ecrit la date d un commit en toutes lettres', () => {
    expect(dateDeVersion('2026-09-20T19:44:10+02:00')).toBe('20 septembre 2026, 19h44');
  });

  it('dit « 1er » le premier du mois, et rien d autre', () => {
    expect(dateDeVersion('2026-08-01T07:05:00+02:00')).toBe('1er août 2026, 07h05');
    expect(dateDeVersion('2026-08-02T07:05:00+02:00')).toBe('2 août 2026, 07h05');
  });

  it('couvre les douze mois', () => {
    const mois = Array.from({ length: 12 }, (_, index) =>
      dateDeVersion(`2026-${String(index + 1).padStart(2, '0')}-15T12:00:00Z`),
    );

    expect(mois.filter((nom) => nom === undefined)).toEqual([]);
    expect(new Set(mois).size).toBe(12);
    expect(mois[0]).toBe('15 janvier 2026, 12h00');
    expect(mois[11]).toBe('15 décembre 2026, 12h00');
  });

  it('ne convertit aucune heure: le fuseau de la chaine est ignore', () => {
    // LE POINT DU TEST. Passer par un objet Date rendrait une heure differente selon
    // le reglage de la machine qui affiche, si bien que deux joueurs liraient deux
    // heures pour la meme version. Ici l'heure affichee est celle a laquelle le
    // commit a ete fait, la ou il a ete fait.
    expect(dateDeVersion('2026-09-20T19:44:10+02:00')).toBe('20 septembre 2026, 19h44');
    expect(dateDeVersion('2026-09-20T19:44:10Z')).toBe('20 septembre 2026, 19h44');
    expect(dateDeVersion('2026-09-20T19:44:10-07:00')).toBe('20 septembre 2026, 19h44');
  });

  it('ne rend rien d une chaine qui n est pas une date', () => {
    expect(dateDeVersion('')).toBeUndefined();
    expect(dateDeVersion('hier')).toBeUndefined();
    expect(dateDeVersion('20/09/2026 19:44')).toBeUndefined();
    expect(dateDeVersion('2026-13-20T19:44:10+02:00')).toBeUndefined();
    expect(dateDeVersion('2026-00-20T19:44:10+02:00')).toBeUndefined();
  });
});

describe('NUMERO_DE_VERSION', () => {
  it('a trois nombres, a partir de 1.5.0', () => {
    expect(NUMERO_DE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);

    const [majeur = 0, mineur = 0] = NUMERO_DE_VERSION.split('.').map(Number);

    expect(majeur * 1000 + mineur).toBeGreaterThanOrEqual(1005);
  });
});

describe('versionMineure', () => {
  it('garde les deux premiers nombres: un correctif reste dans sa version mineure', () => {
    expect(versionMineure('1.5.0')).toBe('1.5');
    expect(versionMineure('1.5.3')).toBe('1.5');
    expect(versionMineure('2.10.1')).toBe('2.10');
  });
});

describe('dateCourteDeVersion', () => {
  it('ecrit la date d un commit en jj/mm/aaaa, sans l heure', () => {
    expect(dateCourteDeVersion('2026-10-02T22:47:10+02:00')).toBe('02/10/2026');
    expect(dateCourteDeVersion('2026-08-01T07:05:00Z')).toBe('01/08/2026');
  });

  it('ne convertit aucune heure: le fuseau de la chaine est ignore', () => {
    // A 23h30 a Paris, il est deja le lendemain a Tokyo et encore la veille a New
    // York: convertir donnerait trois dates pour la meme version.
    expect(dateCourteDeVersion('2026-10-02T23:30:00+02:00')).toBe('02/10/2026');
    expect(dateCourteDeVersion('2026-10-02T23:30:00-07:00')).toBe('02/10/2026');
    expect(dateCourteDeVersion('2026-10-02T00:10:00+09:00')).toBe('02/10/2026');
  });

  it('ne rend rien d une chaine qui n est pas une date', () => {
    expect(dateCourteDeVersion('')).toBeUndefined();
    expect(dateCourteDeVersion('02/10/2026')).toBeUndefined();
    expect(dateCourteDeVersion('2026-13-02T12:00:00Z')).toBeUndefined();
    expect(dateCourteDeVersion('2026-00-02T12:00:00Z')).toBeUndefined();
  });
});

describe('libelleDeVersion', () => {
  const COMMIT = 'ee181518d887796fb7dd012e7e91e6a88740e2ed';
  const NUMERO = `V${NUMERO_DE_VERSION}`;

  it('dit le numero, la date et l empreinte courte quand la page vient d une mise en ligne', () => {
    expect(libelleDeVersion(COMMIT, '2026-09-20T19:44:10+02:00')).toBe(
      `${NUMERO} · 20/09/2026 · ee18151`,
    );
  });

  it('dit le numero et le developpement quand la page n a pas de version', () => {
    // C'est l'empaquetage local et celui des scenarios de bout en bout: une ligne
    // vide laisserait croire a une page cassee.
    expect(LIBELLE_DE_DEVELOPPEMENT).toBe(`${NUMERO} · développement`);
    expect(libelleDeVersion()).toBe(LIBELLE_DE_DEVELOPPEMENT);
    expect(libelleDeVersion('')).toBe(LIBELLE_DE_DEVELOPPEMENT);
    expect(libelleDeVersion('', '2026-09-20T19:44:10+02:00')).toBe(LIBELLE_DE_DEVELOPPEMENT);
  });

  it('se replie sur le numero et l empreinte quand git n a rien su dire de la date', () => {
    expect(libelleDeVersion(COMMIT)).toBe(`${NUMERO} · ee18151`);
    expect(libelleDeVersion(COMMIT, '')).toBe(`${NUMERO} · ee18151`);
    expect(libelleDeVersion(COMMIT, 'pas une date')).toBe(`${NUMERO} · ee18151`);
  });

  it('ne depend pas du fuseau de la machine', () => {
    expect(libelleDeVersion(COMMIT, '2026-10-02T23:30:00-07:00')).toBe(
      `${NUMERO} · 02/10/2026 · ee18151`,
    );
  });

  it('ne montre jamais l empreinte entiere', () => {
    // Quarante caracteres en pied de page ne seraient plus discrets, et personne ne
    // les lit. L'empreinte complete est dans l'infobulle.
    expect(libelleDeVersion(COMMIT, '2026-09-20T19:44:10+02:00')).not.toContain(COMMIT);
  });
});

describe('infobulleDeVersion', () => {
  const COMMIT = 'ee181518d887796fb7dd012e7e91e6a88740e2ed';

  it('garde la date complete et l empreinte entiere', () => {
    expect(infobulleDeVersion(COMMIT, '2026-09-20T19:44:10+02:00')).toBe(
      `Version du 20 septembre 2026, 19h44 · commit ${COMMIT}`,
    );
  });

  it('se contente de l empreinte sans date, et ne dit rien en developpement', () => {
    expect(infobulleDeVersion(COMMIT)).toBe(`Commit ${COMMIT}`);
    expect(infobulleDeVersion(COMMIT, 'pas une date')).toBe(`Commit ${COMMIT}`);
    expect(infobulleDeVersion()).toBeUndefined();
    expect(infobulleDeVersion('')).toBeUndefined();
  });
});
