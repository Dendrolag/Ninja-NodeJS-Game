// @vitest-environment jsdom
/**
 * Tests du referencement de la page (etape 5.6).
 *
 * Ce qu'ils protegent: ce que lisent les moteurs de recherche et les messageries
 * sans executer le jeu. Le titre et la description; une seule adresse canonique,
 * la meme dans la page, le fichier des robots, le plan du site et la mise en ligne
 * de la CI; l'apercu d'un lien partage et son image, a la taille annoncee; les
 * donnees structurees; et la presentation statique, dont les textes des modes
 * doivent rester ceux des ecrans du jeu, mot pour mot.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { NOMS_DES_MODES, TEXTES_DES_MODES } from '../src/interface/modeles/cartes.js';
import { ADRESSE_CANONIQUE } from './adresses.ts';

const RACINE_PAQUET = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_PAGE = join(RACINE_PAQUET, 'page');

/** Lit un fichier en texte, avec les fins de ligne d'Unix quel que soit le poste. */
function lireFichier(chemin: string): string {
  return readFileSync(chemin, 'utf8').replace(/\r\n/gu, '\n');
}

/** Lit un fichier de la page. */
function lire(chemin: string): string {
  return lireFichier(join(DOSSIER_PAGE, chemin));
}

const page = new DOMParser().parseFromString(lire('index.html'), 'text/html');

/** Un texte tel qu'on le lit: les retours a la ligne du fichier ne comptent pas. */
function texteLu(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

/** Le contenu d'une balise meta, cherchee par son nom ou sa propriete. */
function meta(cle: string): string | null {
  return (
    (
      page.querySelector(`meta[name="${cle}"]`) ?? page.querySelector(`meta[property="${cle}"]`)
    )?.getAttribute('content') ?? null
  );
}

/** La largeur et la hauteur d'une image JPEG, lues dans son en-tete de trame. */
function tailleJpeg(octets: Buffer): { largeur: number; hauteur: number } {
  let position = 2;

  while (position < octets.length) {
    const marqueur = octets.readUInt16BE(position);
    const longueur = octets.readUInt16BE(position + 2);

    // Les marqueurs de debut de trame: C0 a CF, sauf C4 (tables), C8 et CC.
    if (marqueur >= 0xffc0 && marqueur <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marqueur)) {
      return {
        hauteur: octets.readUInt16BE(position + 5),
        largeur: octets.readUInt16BE(position + 7),
      };
    }

    position += 2 + longueur;
  }

  throw new Error('Aucune trame dans cette image JPEG.');
}

describe('la tete de la page', () => {
  it('dit ce qu est le jeu dans son titre, et le decrit', () => {
    expect(page.title).toBe('Neon Ninja, jeu multijoueur gratuit dans le navigateur');
    expect(meta('description')).toMatch(/^Jeu multijoueur en temps réel dans le navigateur\./u);
    // Au-dela, les moteurs de recherche la coupent.
    expect(meta('description')?.length).toBeLessThanOrEqual(160);
    expect(page.documentElement.lang).toBe('fr');
  });

  it('declare l adresse canonique', () => {
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${ADRESSE_CANONIQUE}/`,
    );
  });

  it('donne un apercu a un lien partage, avec une image a la taille annoncee', () => {
    expect(meta('og:url')).toBe(`${ADRESSE_CANONIQUE}/`);
    expect(meta('og:title')).toBe(page.title);
    expect(meta('og:description')).not.toBe('');
    expect(meta('og:image')).toBe(`${ADRESSE_CANONIQUE}/icones/apercu.jpg`);
    expect(meta('og:image:alt')).not.toBe('');
    expect(meta('twitter:card')).toBe('summary_large_image');

    const taille = tailleJpeg(readFileSync(join(DOSSIER_PAGE, 'icones', 'apercu.jpg')));

    expect(taille).toEqual({ largeur: 1200, hauteur: 630 });
    expect(meta('og:image:width')).toBe(String(taille.largeur));
    expect(meta('og:image:height')).toBe(String(taille.hauteur));
  });

  it('decrit le jeu en donnees structurees, avec la description et l image de la page', () => {
    const blocs = [...page.querySelectorAll('script[type="application/ld+json"]')];
    expect(blocs).toHaveLength(1);

    const donnees = JSON.parse(blocs[0]?.textContent ?? '') as {
      '@context': string;
      '@graph': readonly Record<string, unknown>[];
    };
    const jeu = donnees['@graph'].find((noeud) => noeud['@type'] === 'VideoGame');
    const site = donnees['@graph'].find((noeud) => noeud['@type'] === 'WebSite');

    expect(donnees['@context']).toBe('https://schema.org');
    expect(site?.['url']).toBe(`${ADRESSE_CANONIQUE}/`);
    expect(jeu).toMatchObject({
      name: 'Neon Ninja',
      url: `${ADRESSE_CANONIQUE}/`,
      description: meta('description'),
      image: meta('og:image'),
      inLanguage: 'fr',
      playMode: 'MultiPlayer',
      isAccessibleForFree: true,
    });
  });
});

describe('la presentation statique', () => {
  const presentation = page.querySelector('#application .presentation');

  it('est dans l element ou le jeu se monte, et a son titre', () => {
    expect(presentation).not.toBeNull();
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(texteLu(presentation?.querySelector('h1') ?? null)).toBe(
      'Le ninja, c’est vous. Enfin, un des trois cents.',
    );
  });

  it('presente chaque mode avec le nom et le texte des ecrans du jeu, dans leur ordre', () => {
    const modes = [...(presentation?.querySelectorAll('.presentation-modes li') ?? [])].map(
      (carte) => [texteLu(carte.querySelector('h2')), texteLu(carte.querySelector('p'))],
    );

    expect(modes).toEqual(MODES.map((mode) => [NOMS_DES_MODES[mode], TEXTES_DES_MODES[mode]]));
  });

  it('dit qu il faut JavaScript a qui ne l a pas', () => {
    expect(texteLu(presentation?.querySelector('noscript') ?? null)).toContain(
      'a besoin de JavaScript',
    );
  });
});

describe('les robots et le plan du site', () => {
  it('laissent tout lire, et designent le plan du site', () => {
    const robots = lire('robots.txt');

    expect(robots).toMatch(/^User-agent: \*$/mu);
    expect(robots).not.toMatch(/^Disallow: \S/mu);
    expect(robots).toMatch(new RegExp(`^Sitemap: ${ADRESSE_CANONIQUE}/sitemap\\.xml$`, 'mu'));
  });

  it('ne listent que la page d accueil, a l adresse canonique', () => {
    const plan = new DOMParser().parseFromString(lire('sitemap.xml'), 'application/xml');

    expect(plan.querySelector('parsererror')).toBeNull();
    expect([...plan.querySelectorAll('url > loc')].map((loc) => loc.textContent)).toEqual([
      `${ADRESSE_CANONIQUE}/`,
    ]);
  });

  it('parlent de l adresse ou la CI met la page en ligne', () => {
    const ci = lireFichier(join(RACINE_PAQUET, '..', '..', '.github', 'workflows', 'ci.yml'));

    expect(ci).toContain(`PAGE_DU_JEU: ${ADRESSE_CANONIQUE}\n`);
  });
});
