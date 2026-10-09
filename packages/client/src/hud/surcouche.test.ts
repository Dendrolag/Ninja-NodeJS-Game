// @vitest-environment jsdom
/**
 * Tests de la surcouche du HUD: les cartes des effets en cours (etape 4.6).
 *
 * Une carte par effet, a la couleur et avec l'icone de son objet, et une jauge. Les
 * cartes sont reutilisees d'une image a l'autre: reconstruite a chaque image, une carte
 * ferait repartir son clignotement de fin a zero, et il ne se verrait jamais.
 */

import { describe, expect, it } from 'vitest';

import type { EffetHud, Hud } from './modele.js';
import { HUD_VIDE } from './modele.js';
import { monterSurcouche } from './surcouche.js';

/** Un effet affiche. */
function effet(modifications: Partial<EffetHud> = {}): EffetHud {
  return {
    nature: 'vitesse',
    categorie: 'bonus',
    libelle: 'Boost',
    couleur: 0x00ff00,
    resteMs: 4_000,
    resteS: 4,
    part: 0.4,
    finProche: false,
    auxAutres: false,
    icone: '/assets/objets/speed.png',
    ...modifications,
  };
}

/** Un HUD de partie avec ces effets. */
function hud(effets: readonly EffetHud[]): Hud {
  return { ...HUD_VIDE, temps: '2:00', effets };
}

/** Une surcouche montee dans un hote neuf. */
function surcouche() {
  const hote = document.createElement('div');
  const monte = monterSurcouche({ hote });

  return { hote, monte };
}

describe('les cartes des effets', () => {
  it('pose une carte par effet, avec sa couleur, son icone, son reste et sa jauge', () => {
    const { hote, monte } = surcouche();

    monte.afficher(hud([effet()]));

    const carte = hote.querySelector<HTMLElement>('.hud-effet');

    expect(carte?.classList.contains('hud-effet-bonus')).toBe(true);
    expect(carte?.style.getPropertyValue('--couleur-effet')).toBe('#00ff00');
    expect(carte?.style.getPropertyValue('--part')).toBe('0.4');
    expect(carte?.querySelector('.hud-effet-libelle')?.textContent).toBe('Boost');
    expect(carte?.querySelector('.hud-effet-reste')?.textContent).toBe('4s');
    expect(
      carte?.querySelector<HTMLElement>('.hud-effet-pictogramme')?.style.backgroundImage,
    ).toContain('/assets/objets/speed.png');
    expect(carte?.querySelector('.hud-effet-jauge')).not.toBeNull();
  });

  it('reutilise la carte d une image a l autre, et la fait clignoter en fin d effet', () => {
    const { hote, monte } = surcouche();

    monte.afficher(hud([effet()]));
    const avant = hote.querySelector('.hud-effet');
    monte.afficher(hud([effet({ resteMs: 2_000, resteS: 2, part: 0.2, finProche: true })]));
    const apres = hote.querySelector('.hud-effet');

    expect(apres).toBe(avant);
    expect(apres?.classList.contains('fin-proche')).toBe(true);
    expect(apres?.querySelector('.hud-effet-reste')?.textContent).toBe('2s');
  });

  it('retire la carte d un effet fini', () => {
    const { hote, monte } = surcouche();

    monte.afficher(hud([effet()]));
    monte.afficher(hud([]));

    expect(hote.querySelector('.hud-effet')).toBeNull();
  });

  it('dit d un malus que nous infligeons qu il frappe les autres', () => {
    const { hote, monte } = surcouche();

    monte.afficher(
      hud([
        effet({
          nature: 'negatif',
          categorie: 'malus',
          libelle: 'Vision négative',
          couleur: 0xaa44ff,
          auxAutres: true,
        }),
      ]),
    );

    const carte = hote.querySelector('.hud-effet');

    expect(carte?.classList.contains('hud-effet-malus')).toBe(true);
    expect(carte?.classList.contains('aux-autres')).toBe(true);
    expect(carte?.querySelector('.hud-effet-cible')?.textContent).toBe('aux autres');
  });

  it('range les cartes du plus proche de sa fin au plus lointain', () => {
    const { hote, monte } = surcouche();

    monte.afficher(
      hud([effet({ nature: 'invincibilite', libelle: 'Invincibilité', resteMs: 1_000 }), effet()]),
    );

    const ordres = [...hote.querySelectorAll<HTMLElement>('.hud-effet')].map((carte) => [
      carte.querySelector('.hud-effet-libelle')?.textContent,
      carte.style.order,
    ]);

    expect(ordres).toEqual([
      ['Invincibilité', '0'],
      ['Boost', '1'],
    ]);
  });
});

describe("le badge du x2 de l'Evade (etape 7.9)", () => {
  it('montre le badge sur la ligne de qui le porte, et le cache ailleurs', () => {
    const { hote, monte } = surcouche();
    const ligneHud = (id: string, doubleur: boolean) => ({
      id,
      pseudo: id,
      couleur: '#FF0000',
      points: 10,
      moi: id === 'moi',
      rang: id === 'moi' ? 1 : 2,
      doubleur,
    });

    monte.afficher({ ...hud([]), classement: [ligneHud('moi', true), ligneHud('bob', false)] });

    const badges = [...hote.querySelectorAll<HTMLElement>('.hud-ligne .hud-x2')];

    expect(badges.map((badge) => badge.hidden)).toEqual([false, true]);
    expect(badges[0]?.textContent).toBe('x2');
  });
});

describe('la poche au HUD (etape 7.10)', () => {
  const fumee: NonNullable<Hud['poche']> = {
    nature: 'fumee',
    libelle: 'Fumée',
    couleur: 0xb8c4d6,
    icone: '/assets/objets/fumee.svg',
  };

  /** Une surcouche montee avec le bouton de la poche, qui compte ses appuis. */
  function avecLeBouton() {
    const hote = document.createElement('div');
    const appuis = { nombre: 0 };
    const monte = monterSurcouche({
      hote,
      utiliserLaPoche: () => {
        appuis.nombre += 1;
      },
    });

    return { hote, monte, appuis };
  }

  it('pose une carte en tete des effets tant que la poche est pleine, et la retire vide', () => {
    const { hote, monte } = avecLeBouton();

    monte.afficher({ ...hud([effet()]), poche: fumee });

    const cartes = hote.querySelectorAll<HTMLElement>('.hud-effet');
    const carte = cartes[0];
    expect(cartes).toHaveLength(2);
    expect(carte?.classList.contains('hud-effet-poche')).toBe(true);
    expect(carte?.style.getPropertyValue('--couleur-effet')).toBe('#b8c4d6');
    expect(carte?.querySelector('.hud-effet-libelle')?.textContent).toBe('Fumée');
    expect(carte?.querySelector('.hud-poche-touche')?.textContent).toBe('E');
    expect(carte?.querySelector('.hud-effet-jauge')).toBeNull();

    monte.afficher({ ...hud([effet()]), poche: undefined });

    expect(hote.querySelector('.hud-effet-poche')).toBeNull();
    expect(hote.querySelectorAll('.hud-effet')).toHaveLength(1);
  });

  it('montre le bouton quand la poche est pleine, et s en sert a l appui', () => {
    const { hote, monte, appuis } = avecLeBouton();
    const bouton = hote.querySelector<HTMLButtonElement>('.hud-poche');

    monte.afficher(hud([]));
    expect(bouton?.hidden).toBe(true);

    monte.afficher({ ...hud([]), poche: fumee });
    expect(bouton?.hidden).toBe(false);
    expect(bouton?.getAttribute('aria-label')).toBe('Fumée : s’en servir');

    bouton?.dispatchEvent(new Event('pointerdown'));
    expect(appuis.nombre).toBe(1);

    monte.afficher(hud([]));
    expect(bouton?.hidden).toBe(true);
  });

  it('ne pose pas de bouton sans commande, mais montre la carte', () => {
    const { hote, monte } = surcouche();

    monte.afficher({ ...hud([]), poche: fumee });

    expect(hote.querySelector('.hud-poche')).toBeNull();
    expect(hote.querySelector('.hud-effet-poche')).not.toBeNull();
  });
});

describe('le HUD reduit du 9 octobre 2026', () => {
  it('cache le temps restant tant que rien n est affiche', () => {
    const { hote, monte } = surcouche();
    const temps = hote.querySelector<HTMLElement>('.hud-temps');

    expect(temps?.hidden).toBe(true);

    monte.afficher(hud([]));

    expect(temps?.hidden).toBe(false);
    expect(temps?.textContent).toBe('2:00');
  });

  it('range les boutons d action ensemble: la poche, la localisation, puis la capture', () => {
    const hote = document.createElement('div');
    const appuis: string[] = [];
    monterSurcouche({
      hote,
      utiliserLaPoche: () => appuis.push('poche'),
      localiser: () => appuis.push('localiser'),
      capturer: () => appuis.push('capturer'),
    });

    const boutons = [...hote.querySelectorAll<HTMLButtonElement>('.hud-boutons > button')];

    expect(boutons.map((bouton) => bouton.className)).toEqual([
      'hud-bouton hud-poche',
      'hud-bouton hud-localiser',
      'hud-bouton hud-capture',
    ]);
    expect(boutons[1]?.getAttribute('aria-label')).toBe('Localiser mon ninja');
    expect(boutons[1]?.querySelector('.hud-bouton-libelle')?.textContent).toBe('Localiser');

    boutons[1]?.dispatchEvent(new Event('pointerdown'));
    boutons[2]?.dispatchEvent(new Event('pointerdown'));

    expect(appuis).toEqual(['localiser', 'capturer']);
  });

  it('change le pictogramme et le nom de la capture pour le katana', () => {
    const hote = document.createElement('div');
    const monte = monterSurcouche({ hote, capturer: () => undefined });

    monte.afficher({
      ...hud([]),
      charges: { disponibles: 1, maximum: 1, recharge: 1 },
      arme: 'katana',
    });

    const capture = hote.querySelector<HTMLButtonElement>('.hud-capture');

    expect(capture?.hidden).toBe(false);
    expect(capture?.querySelector('.hud-capture-libelle')?.textContent).toBe('Katana');
    expect(capture?.querySelectorAll('svg')).toHaveLength(1);
    expect(capture?.getAttribute('aria-label')).toBe('Katana, prêt');
  });

  it('montre le combo en un multiplicateur, et le compte aux lecteurs d ecran', () => {
    const { hote, monte } = surcouche();
    const combo = hote.querySelector<HTMLElement>('.hud-combo');

    monte.afficher(hud([]));
    expect(combo?.hidden).toBe(true);

    monte.afficher({
      ...hud([]),
      combo: { multiplicateur: 3, compte: '12 ninjas', fenetre: 0.5 },
    });

    expect(combo?.hidden).toBe(false);
    expect(combo?.dataset['multiplicateur']).toBe('3');
    expect(combo?.querySelector('.hud-combo-multiplicateur')?.textContent).toBe('x3');
    expect(combo?.querySelector('.hud-combo-compte')?.textContent).toBe('12 ninjas');
    expect(
      combo?.querySelector<HTMLElement>('.hud-combo-fenetre')?.style.getPropertyValue('--fenetre'),
    ).toBe('0.5');
  });

  it('pose les ninjas restants dans la barre, et les retire au demontage', () => {
    const hote = document.createElement('div');
    const compteurs = document.createElement('div');
    const monte = monterSurcouche({ hote, compteurs });

    monte.afficher({ ...hud([]), restants: { nombre: 37, libelle: '37 ninjas restants' } });

    const restants = compteurs.querySelector<HTMLElement>('.hud-restants');

    expect(restants?.hidden).toBe(false);
    expect(restants?.querySelector('.hud-restants-nombre')?.textContent).toBe('37');
    expect(restants?.querySelector('.hud-restants-libelle')?.textContent).toBe(
      '37 ninjas restants',
    );

    monte.demonter();

    expect(compteurs.querySelector('.hud-restants')).toBeNull();
  });

  it('place les points du radar autour de son centre, et marque ceux du bord', () => {
    const { hote, monte } = surcouche();

    monte.afficher({
      ...hud([]),
      radar: [
        { id: 'moi', x: 0, y: 0, couleur: '#00FFFF', moi: true, auBord: false },
        { id: 'loin', x: 1, y: -0.5, couleur: '#FF0000', moi: false, auBord: true },
      ],
    });

    const points = [...hote.querySelectorAll<HTMLElement>('.hud-radar-disque .hud-point')];

    expect(points.map((point) => [point.style.left, point.style.top])).toEqual([
      ['50%', '50%'],
      ['100%', '25%'],
    ]);
    expect(points.map((point) => point.className)).toEqual(['hud-point moi', 'hud-point au-bord']);
  });

  it('marque les lignes du classement hors du podium, sauf la notre', () => {
    const { hote, monte } = surcouche();
    const ligneHud = (id: string, rang: number) => ({
      id,
      pseudo: id,
      couleur: '#FF0000',
      points: 10 - rang,
      moi: id === 'moi',
      rang,
      doubleur: false,
    });

    monte.afficher({
      ...hud([]),
      classement: [
        ligneHud('a', 1),
        ligneHud('b', 2),
        ligneHud('c', 3),
        ligneHud('d', 4),
        ligneHud('moi', 5),
      ],
    });

    const horsPodium = [...hote.querySelectorAll('.hud-ligne')].map((ligne) =>
      ligne.classList.contains('hors-podium'),
    );

    expect(horsPodium).toEqual([false, false, false, true, false]);
  });
});

describe('le radar, pendant notre Revelation seulement', () => {
  it('se cache sans points, et se montre avec', () => {
    const { hote, monte } = surcouche();
    const radar = hote.querySelector<HTMLElement>('.hud-radar');

    expect(radar?.hidden).toBe(true);

    monte.afficher({
      ...hud([]),
      radar: [{ id: 'moi', x: 0, y: 0, couleur: '#00FFFF', moi: true, auBord: false }],
    });
    expect(radar?.hidden).toBe(false);

    monte.afficher({ ...hud([]), radar: undefined });
    expect(radar?.hidden).toBe(true);
    expect(hote.querySelectorAll('.hud-point')).toHaveLength(0);
  });
});
