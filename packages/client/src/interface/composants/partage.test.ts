// @vitest-environment jsdom
/**
 * Tests du partage d'un lien (etape 2.7): partager sur un appareil tactile, copier
 * ailleurs, et ce qui arrive quand l'un ou l'autre echoue.
 *
 * La fenetre est une piece d'essai: jsdom ne connait ni le partage du systeme, ni
 * matchMedia, ni le presse-papiers.
 */

import { describe, expect, it } from 'vitest';

import type { DonneesDuPartage } from './partage.js';
import { partageDuSysteme, partagerLeLien } from './partage.js';

const DONNEES: DonneesDuPartage = {
  titre: 'Neon Ninja',
  texte: 'Rejoins ma partie privée de Neon Ninja.',
  url: 'https://neon-ninja.example/?partie=K7XM3Q',
};

/** Ce que la fenetre d'essai sait faire. */
interface Capacites {
  /** Le partage du systeme: son comportement, ou absent. */
  readonly partager?: (donnees: ShareData) => Promise<void>;
  /** Ce que rend canShare, s'il existe. */
  readonly peutPartager?: boolean;
  /** Le pointeur principal est-il tactile. */
  readonly tactile?: boolean;
  /** Le presse-papiers: son comportement, ou absent. */
  readonly copier?: (texte: string) => Promise<void>;
}

/** Une fenetre d'essai, et ce qu'on lui a demande de partager ou de copier. */
function fenetreDEssai(capacites: Capacites): {
  fenetre: Window;
  partages: ShareData[];
  copies: string[];
} {
  const partages: ShareData[] = [];
  const copies: string[] = [];
  const navigateur: Record<string, unknown> = {};

  if (capacites.partager !== undefined) {
    const partager = capacites.partager;
    navigateur['share'] = async (donnees: ShareData) => {
      partages.push(donnees);
      await partager(donnees);
    };
  }

  if (capacites.peutPartager !== undefined) {
    const peutPartager = capacites.peutPartager;
    navigateur['canShare'] = () => peutPartager;
  }

  if (capacites.copier !== undefined) {
    const copier = capacites.copier;
    navigateur['clipboard'] = {
      writeText: async (texte: string) => {
        copies.push(texte);
        await copier(texte);
      },
    };
  }

  const fenetre = {
    navigator: navigateur,
    matchMedia: (requete: string) => ({
      matches: requete === '(pointer: coarse)' && capacites.tactile === true,
    }),
  } as unknown as Window;

  return { fenetre, partages, copies };
}

/** Un partage qui aboutit. */
const reussit = async (): Promise<void> => undefined;

/** Une erreur qui porte ce nom, comme celles du navigateur. */
function erreurNommee(nom: string): Error {
  const erreur = new Error(nom);
  erreur.name = nom;
  return erreur;
}

describe('partageDuSysteme', () => {
  it('partage sur un appareil tactile qui sait partager', () => {
    expect(partageDuSysteme(fenetreDEssai({ partager: reussit, tactile: true }).fenetre)).toBe(
      true,
    );
  });

  it('copie sur un ordinateur, meme s il sait partager', () => {
    expect(partageDuSysteme(fenetreDEssai({ partager: reussit, tactile: false }).fenetre)).toBe(
      false,
    );
  });

  it('copie sur un appareil tactile qui ne sait pas partager', () => {
    expect(partageDuSysteme(fenetreDEssai({ tactile: true }).fenetre)).toBe(false);
  });

  it('copie sans fenetre, ou sans matchMedia', () => {
    expect(partageDuSysteme(null)).toBe(false);
    // Le document d'essai de jsdom sait partager si on le lui donne, mais n'a pas matchMedia.
    const sansMatchMedia = {
      navigator: { share: reussit },
    } as unknown as Window;
    expect(partageDuSysteme(sansMatchMedia)).toBe(false);
  });
});

describe('partagerLeLien', () => {
  it('partage le titre, le texte et le lien sur un appareil tactile', async () => {
    const { fenetre, partages, copies } = fenetreDEssai({
      partager: reussit,
      tactile: true,
      copier: reussit,
    });

    await expect(partagerLeLien(fenetre, DONNEES)).resolves.toBe('partage');
    expect(partages).toStrictEqual([
      { title: DONNEES.titre, text: DONNEES.texte, url: DONNEES.url },
    ]);
    expect(copies).toEqual([]);
  });

  it('ne dit rien quand le joueur ferme le partage sans rien choisir', async () => {
    const { fenetre, copies } = fenetreDEssai({
      partager: async () => Promise.reject(erreurNommee('AbortError')),
      tactile: true,
      copier: reussit,
    });

    await expect(partagerLeLien(fenetre, DONNEES)).resolves.toBe('annule');
    expect(copies).toEqual([]);
  });

  it('se rabat sur la copie quand le partage echoue autrement', async () => {
    const { fenetre, copies } = fenetreDEssai({
      partager: async () => Promise.reject(erreurNommee('NotAllowedError')),
      tactile: true,
      copier: reussit,
    });

    await expect(partagerLeLien(fenetre, DONNEES)).resolves.toBe('copie');
    expect(copies).toEqual([DONNEES.url]);
  });

  it('copie sans essayer de partager ce que le navigateur dit ne pas savoir partager', async () => {
    const { fenetre, partages, copies } = fenetreDEssai({
      partager: reussit,
      peutPartager: false,
      tactile: true,
      copier: reussit,
    });

    await expect(partagerLeLien(fenetre, DONNEES)).resolves.toBe('copie');
    expect(partages).toEqual([]);
    expect(copies).toEqual([DONNEES.url]);
  });

  it('copie le lien seul sur un ordinateur', async () => {
    const { fenetre, partages, copies } = fenetreDEssai({
      partager: reussit,
      tactile: false,
      copier: reussit,
    });

    await expect(partagerLeLien(fenetre, DONNEES)).resolves.toBe('copie');
    expect(partages).toEqual([]);
    expect(copies).toEqual([DONNEES.url]);
  });

  it('dit que c est impossible sans presse-papiers, ou quand il refuse', async () => {
    await expect(partagerLeLien(fenetreDEssai({}).fenetre, DONNEES)).resolves.toBe('impossible');
    await expect(
      partagerLeLien(
        fenetreDEssai({ copier: async () => Promise.reject(new Error('refus')) }).fenetre,
        DONNEES,
      ),
    ).resolves.toBe('impossible');
    await expect(partagerLeLien(null, DONNEES)).resolves.toBe('impossible');
  });
});
