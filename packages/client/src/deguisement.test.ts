// @vitest-environment jsdom
/**
 * Tests du deguisement d'Among Ninjas dans la page (etape 7.28): le bouton « Habit » (rendus 4C et
 * 5C), le deguise que nous connaissons, gris et cerne de sa couleur (rendu 3A), l'habit pose sur
 * la carte (rendu 2A), le PNJ a portee du katana, et les sons, pour nous seuls.
 */

import type { AmongVu, DeguiseVu, EntiteVue, EtatPriveAmong } from '@neon-ninja/shared';
import { AMONG, COULEUR_DE_LA_FOULE, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { victimeAPortee } from './among.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { HUD_VIDE, habitHud } from './hud/modele.js';
import { monterSurcouche } from './hud/surcouche.js';
import { APPARENCE_AMONG, habitPose, imageDAmong } from './rendu/among.js';
import type { VueLissee } from './rendu/interpolation.js';
import { construireScene, couleurEnNombre } from './rendu/scene.js';
import { sonsDuChangement } from './sons/declencheurs.js';

const PROIE: EtatPriveAmong = {
  role: 'proie',
  complices: [],
  fantome: false,
  gong: { x: 1145, y: 630 },
  stations: [],
  taches: [],
  gongUtilise: false,
};
const ASSASSIN: EtatPriveAmong = { ...PROIE, role: 'tueur' };

/** Un joueur de la vue. */
function joueur(id: string, x: number, y: number, couleur = '#FF8C1A'): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur,
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Un PNJ de la vue, sous son alias. */
function pnj(id: string, x: number, y: number): EntiteVue {
  return { type: 'bot', id, x, y, couleur: COULEUR_DE_LA_FOULE, direction: 'sud' };
}

/** Nous, dans une partie Among Ninjas en jeu, avec ces entites et ce que le flux dit du mode. */
function etat(
  prive: EtatPriveAmong,
  entites: readonly EntiteVue[] = [joueur('moi', 1000, 1000)],
  among: Partial<AmongVu> = {},
): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    moi: 'moi',
    salon: {
      idRoom: 'room-1',
      statut: 'enCours',
      mode: 'among',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: { ...REGLAGES_PAR_DEFAUT, carte: 'map1' },
    },
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites: [...entites],
      objets: [],
      zones: [],
      classement: [],
      among: { phase: 'jeu', restantMs: 0, tachesFaites: 0, tachesTotal: 10, ...among },
    },
    among: { prive, reunion: undefined, morts: [] },
  };
}

/** La vue lissee d'un etat, chaque entite a sa place. */
function lissee(client: EtatClient): VueLissee {
  const vue = client.partie ?? expect.fail('une partie');

  return {
    vue,
    entites: vue.entites.map((entite) => ({
      entite,
      x: entite.x,
      y: entite.y,
      enMouvement: false,
    })),
    tempsRestantMs: 0,
  };
}

const DEGUISE: DeguiseVu = { id: 'moi', restantMs: 14_000 };

describe('le bouton Habit, dans le modele', () => {
  it('n est la qu avec un habit ou un deguisement', () => {
    expect(habitHud(etat(PROIE))).toBeUndefined();
    expect(habitHud(etat({ ...PROIE, habit: true }))).toEqual({ actif: true });
    expect(habitHud(etat(PROIE, undefined, { deguises: [DEGUISE] }))).toEqual({
      actif: false,
      deguise: { part: 0.7, secondes: 14 },
    });
  });

  it('ne revet rien pour un assassin deguise, qui y lit seulement son temps', () => {
    // Le sien dure sa recharge et cinq secondes, trente par defaut (16 octobre 2026).
    expect(
      habitHud(etat(ASSASSIN, undefined, { deguises: [{ id: 'moi', restantMs: 15_000 }] })),
    ).toEqual({
      actif: false,
      deguise: { part: 0.5, secondes: 15 },
    });
    // Un habit dans l'etat d'un assassin ne se revet pas: il ne peut pas en avoir.
    expect(habitHud(etat({ ...ASSASSIN, habit: true }))).toBeUndefined();
  });

  it('se cache pour un fantome et hors du jeu', () => {
    expect(habitHud(etat({ ...PROIE, habit: true, fantome: true }))).toBeUndefined();
    expect(habitHud(etat({ ...PROIE, habit: true }, undefined, { phase: 'vote' }))).toBeUndefined();
  });

  it('ne lit que notre deguisement, pas celui d un complice', () => {
    expect(
      habitHud(etat(ASSASSIN, undefined, { deguises: [{ id: 'complice', restantMs: 5000 }] })),
    ).toBeUndefined();
  });
});

describe('le bouton Habit, dans la surcouche', () => {
  function monte() {
    const hote = document.createElement('div');
    const appuis: string[] = [];
    const surcouche = monterSurcouche({
      hote,
      capturer: () => appuis.push('capturer'),
      agir: () => undefined,
    });
    const bouton = () =>
      hote.querySelector<HTMLButtonElement>('.hud-habit') ?? expect.fail('un bouton Habit');

    return { surcouche, bouton, appuis };
  }

  it('surgit au ramassage, revet l habit par le tir, et se cache sans habit', () => {
    const { surcouche, bouton, appuis } = monte();

    surcouche.afficher({ ...HUD_VIDE, habit: undefined });
    expect(bouton().hidden).toBe(true);

    surcouche.afficher({ ...HUD_VIDE, habit: { actif: true } });
    expect(bouton().hidden).toBe(false);
    expect(bouton().disabled).toBe(false);
    expect(bouton().textContent).toContain('Habit');
    expect(bouton().querySelector('.hud-bouton-touche')?.textContent).toBe('Espace');
    bouton().dispatchEvent(new Event('pointerdown'));
    expect(appuis).toEqual(['capturer']);
  });

  it('se vide en anneau pendant le deguisement, et en dit les secondes', () => {
    const { surcouche, bouton } = monte();

    surcouche.afficher({
      ...HUD_VIDE,
      habit: { actif: false, deguise: { part: 0.7, secondes: 14 } },
    });

    expect(bouton().classList.contains('deguise')).toBe(true);
    expect(bouton().style.getPropertyValue('--part')).toBe('0.7');
    expect(bouton().textContent).toContain('14 s');
    expect(bouton().disabled).toBe(true);
    expect(bouton().getAttribute('aria-label')).toBe('Déguisé, 14 secondes');
  });
});

describe('le deguise que nous connaissons', () => {
  it('se dessine au gris des PNJ, cerne d un contour a sa couleur', () => {
    const client = etat(
      ASSASSIN,
      [
        joueur('moi', 1000, 1000),
        joueur('complice', 1100, 1000, '#9A55FF'),
        joueur('autre', 900, 1000, '#1FBF4C'),
      ],
      {
        deguises: [DEGUISE, { id: 'complice', restantMs: 3000 }],
      },
    );
    const scene = construireScene(client, lissee(client), 0);
    const dessin = (id: string) => scene.entites.find((entite) => entite.id === id);

    expect(dessin('moi')?.teinte).toBe(couleurEnNombre(COULEUR_DE_LA_FOULE));
    expect(dessin('moi')?.contourNeon).toBe(couleurEnNombre('#FF8C1A'));
    expect(dessin('complice')?.teinte).toBe(couleurEnNombre(COULEUR_DE_LA_FOULE));
    expect(dessin('complice')?.contourNeon).toBe(couleurEnNombre('#9A55FF'));
    expect(dessin('autre')?.teinte).toBe(couleurEnNombre('#1FBF4C'));
    expect(dessin('autre')?.contourNeon).toBeUndefined();
  });
});

describe('l habit sur la carte', () => {
  it('se dessine en kimono au trait, sur un disque qui bat, la ou le flux le dit', () => {
    const pose = habitPose({ x: 500, y: 400 }, 0);
    const plus = habitPose({ x: 500, y: 400 }, APPARENCE_AMONG.habit.battementMs / 4);

    expect(pose.disques).toEqual([expect.objectContaining({ id: 'habit:halo', x: 500, y: 400 })]);
    expect(pose.traits.map((trait) => trait.id)).toEqual([
      'habit:corps',
      'habit:col',
      'habit:ceinture',
    ]);
    expect(pose.disques[0]?.remplissage?.alpha).not.toBe(plus.disques[0]?.remplissage?.alpha);
    expect(habitPose(undefined, 0)).toEqual({ disques: [], traits: [] });
  });

  it('entre dans l image d Among Ninjas quand la vue le porte', () => {
    const client = etat(PROIE, undefined, { habit: { x: 1050, y: 1000 } });
    const image = imageDAmong(client, lissee(client), 'ninja', 0);

    expect(image.fleches.some((trait) => trait.id === 'habit:corps')).toBe(true);
    expect(image.disques.some((disque) => disque.id === 'habit:halo')).toBe(true);
    expect(imageDAmong(etat(PROIE), lissee(etat(PROIE)), 'ninja', 0).fleches).toEqual([]);
  });
});

describe('le katana face a un PNJ', () => {
  const armee = joueur('moi', 1000, 1000);
  const avecArme: EntiteVue = {
    ...armee,
    tactique: { orientation: 'sud', charges: 1, avantProchaineChargeMs: 0 },
  } as EntiteVue;

  it('vise le PNJ a portee faute de proie, et la proie avant le PNJ', () => {
    const seul = etat(ASSASSIN, [avecArme, pnj('pnj-1', 1020, 1000), pnj('pnj-2', 1010, 1000)]);
    expect(victimeAPortee(seul)).toBe('pnj-2');

    const avecProie = etat(ASSASSIN, [
      avecArme,
      pnj('pnj-2', 1010, 1000),
      joueur('proie', 1025, 1000),
    ]);
    expect(victimeAPortee(avecProie)).toBe('proie');

    const loin = etat(ASSASSIN, [
      avecArme,
      pnj('pnj-3', 1000 + AMONG.PORTEE_DU_MEURTRE_PX + 5, 1000),
    ]);
    expect(victimeAPortee(loin)).toBeUndefined();
  });

  it('eclaire le PNJ vise', () => {
    const client = etat(ASSASSIN, [avecArme, pnj('pnj-2', 1010, 1000)]);
    const image = imageDAmong(client, lissee(client), 'ninja', 0);

    expect(image.disques.some((disque) => disque.id === 'pnj-2:victime')).toBe(true);
  });
});

describe('les sons du deguisement', () => {
  it('disent l habit pris, le deguisement revetu, puis perdu, a nous seuls', () => {
    const avant = etat(PROIE);
    const habit = etat({ ...PROIE, habit: true });
    const deguise = etat(PROIE, undefined, { deguises: [DEGUISE] });
    const complice = etat(ASSASSIN, undefined, { deguises: [{ id: 'complice', restantMs: 5000 }] });

    expect(sonsDuChangement(avant, habit)).toContain('habitPris');
    expect(sonsDuChangement(habit, deguise)).toContain('deguisementRevetu');
    expect(sonsDuChangement(deguise, avant)).toContain('deguisementPerdu');
    expect(sonsDuChangement(etat(ASSASSIN), complice)).not.toContain('deguisementRevetu');
  });
});
