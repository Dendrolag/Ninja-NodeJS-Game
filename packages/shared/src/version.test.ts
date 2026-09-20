/**
 * Tests du controle de version entre la page et le serveur.
 *
 * Ce qu'ils protegent: un serveur construit d'un commit n'accepte que la page du
 * meme commit, quoi que la page envoie; un serveur sans version accepte tout; et la
 * ligne affichee en pied d'accueil dit la meme chose a tout le monde, quelle que soit
 * la langue du navigateur et le fuseau de la machine (etape 8.4).
 */

import { describe, expect, it } from 'vitest';

import {
  LIBELLE_DE_DEVELOPPEMENT,
  dateDeVersion,
  libelleDeVersion,
  versionAcceptee,
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

describe('libelleDeVersion', () => {
  const COMMIT = 'ee181518d887796fb7dd012e7e91e6a88740e2ed';

  it('dit la date et l empreinte courte quand la page vient d une mise en ligne', () => {
    expect(libelleDeVersion(COMMIT, '2026-09-20T19:44:10+02:00')).toBe(
      'Version du 20 septembre 2026, 19h44 · ee18151',
    );
  });

  it('dit le developpement quand la page n a pas de version', () => {
    // C'est l'empaquetage local et celui des scenarios de bout en bout: une ligne
    // vide laisserait croire a une page cassee.
    expect(libelleDeVersion()).toBe(LIBELLE_DE_DEVELOPPEMENT);
    expect(libelleDeVersion('')).toBe(LIBELLE_DE_DEVELOPPEMENT);
    expect(libelleDeVersion('', '2026-09-20T19:44:10+02:00')).toBe(LIBELLE_DE_DEVELOPPEMENT);
  });

  it('se replie sur la seule empreinte quand git n a rien su dire de la date', () => {
    expect(libelleDeVersion(COMMIT)).toBe('Version ee18151');
    expect(libelleDeVersion(COMMIT, '')).toBe('Version ee18151');
    expect(libelleDeVersion(COMMIT, 'pas une date')).toBe('Version ee18151');
  });

  it('ne montre jamais l empreinte entiere', () => {
    // Quarante caracteres en pied de page ne seraient plus discrets, et personne ne
    // les lit. L'empreinte complete est dans l'infobulle, posee par l'ecran.
    expect(libelleDeVersion(COMMIT, '2026-09-20T19:44:10+02:00')).not.toContain(COMMIT);
  });
});
