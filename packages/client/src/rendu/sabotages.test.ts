/**
 * Tests du rendu des sabotages d'Among Ninjas (etape 7.22): le disque d'une proie vivante qui
 * tombe a 110 pixels pendant la panne, et le decor eteint plus sombre (rendu 2C); le boitier et
 * les consoles au sol, cyan au repos, orange ou rouge pendant leur sabotage (rendu 6A); le nuage
 * noir, opaque pour une proie vivante et a demi pour qui y voit (rendu 4A); les fleches vers les
 * postes, avec leur distance (rendus 2C et 3B).
 */

import type { AmongVu, EntiteVue, EtatPriveAmong, SabotageEnCoursVu } from '@neon-ninja/shared';
import { AMONG, REGLAGES_PAR_DEFAUT, lieuxDuMode } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { APPARENCE_AMONG, imageDAmong } from './among.js';
import { VISION_AMONG } from './apparence.js';
import type { VueLissee } from './interpolation.js';

const LIEUX = lieuxDuMode('map1', false) ?? expect.fail('Tokyo a ses lieux');

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
const FANTOME: EtatPriveAmong = { ...PROIE, fantome: true };

const PANNE: SabotageEnCoursVu = { nature: 'panne', restantMs: 0, consolesTenues: [false, false] };
const SURCHAUFFE: SabotageEnCoursVu = {
  nature: 'surchauffe',
  restantMs: 20_000,
  consolesTenues: [false, true],
};

/** Nous, a cette place, dans une partie Among Ninjas, avec ce que le flux dit du mode. */
function etat(
  prive: EtatPriveAmong,
  ici: { readonly x: number; readonly y: number },
  among: Partial<AmongVu> = {},
): EtatClient {
  const moi: EntiteVue = {
    type: 'joueur',
    id: 'moi',
    x: ici.x,
    y: ici.y,
    couleur: '#2EE6FF',
    direction: 'sud',
    pseudo: 'moi',
    invincible: false,
    protege: false,
  };

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
      entites: [moi],
      objets: [],
      zones: [],
      classement: [],
      among: { phase: 'jeu', restantMs: 0, tachesFaites: 0, tachesTotal: 10, ...among },
    },
    among: { prive, reunion: undefined, morts: [] },
  };
}

/** L'image d'Among Ninjas de cet etat, chaque entite a sa place. */
function image(client: EtatClient, maintenant = 0) {
  const vue = client.partie ?? expect.fail('une partie');
  const lissee: VueLissee = {
    vue,
    entites: vue.entites.map((entite) => ({
      entite,
      x: entite.x,
      y: entite.y,
      enMouvement: false,
    })),
    tempsRestantMs: 0,
  };

  return imageDAmong(client, lissee, 'ninja', maintenant);
}

const ICI = { x: 1000, y: 1100 };

describe('la vision pendant la panne', () => {
  it('tombe a 110 pixels pour une proie vivante, et le decor eteint s assombrit', () => {
    const vision = image(etat(PROIE, ICI, { sabotage: PANNE })).vision;

    expect(vision?.rayon).toBe(AMONG.RAYON_DE_VISION_EN_PANNE_PX);
    expect(vision?.voile).toBe(APPARENCE_AMONG.voileEnPanne);
    expect(vision?.voile).toBeGreaterThan(VISION_AMONG.voile);
  });

  it('ne change pas pour un assassin, ni hors de la panne', () => {
    const normale = image(etat(ASSASSIN, ICI)).vision;

    expect(image(etat(ASSASSIN, ICI, { sabotage: PANNE })).vision).toEqual(normale);
    expect(image(etat(PROIE, ICI, { sabotage: SURCHAUFFE })).vision?.voile).toBe(
      VISION_AMONG.voile,
    );
    expect(image(etat(PROIE, ICI, { sabotage: SURCHAUFFE })).vision?.rayon).toBeGreaterThan(
      AMONG.RAYON_DE_VISION_EN_PANNE_PX,
    );
  });

  it('reste absente pour un fantome, qui voit tout', () => {
    expect(image(etat(FANTOME, ICI, { sabotage: PANNE })).vision).toBeUndefined();
  });
});

describe('le boitier et les consoles', () => {
  /** Les couleurs des traits d'un poste. */
  const couleurs = (client: EtatClient, poste: string): readonly number[] =>
    image(client)
      .postes.traits.filter((trait) => trait.id.startsWith(`${poste}:`))
      .map((trait) => trait.couleur);

  /** Le disque ou l'on repare, s'il est dessine. */
  const disque = (client: EtatClient, poste: string) =>
    image(client).postes.disques.find((rond) => rond.id === `${poste}:disque`);

  it('sont toujours la, cyan, sans disque de reparation hors de leur sabotage', () => {
    const client = etat(PROIE, ICI);

    expect(new Set(couleurs(client, 'boitier'))).toEqual(new Set([APPARENCE_AMONG.poste.repos]));
    expect(new Set(couleurs(client, 'console:1'))).toEqual(new Set([APPARENCE_AMONG.poste.repos]));
    expect(disque(client, 'boitier')).toBeUndefined();
    expect(image(client).postes.disques.find((rond) => rond.id === 'boitier:socle')).toMatchObject({
      x: LIEUX.boitier.x,
      y: LIEUX.boitier.y,
    });
  });

  it('passent le boitier a l orange pendant la panne, avec son disque de reparation', () => {
    const client = etat(PROIE, ICI, { sabotage: PANNE });

    expect(new Set(couleurs(client, 'boitier'))).toEqual(new Set([APPARENCE_AMONG.poste.panne]));
    expect(disque(client, 'boitier')?.rayon).toBe(AMONG.RAYON_D_UN_POSTE_PX);
    expect(disque(client, 'console:0')).toBeUndefined();
  });

  it('passent les consoles au rouge pendant la surchauffe, et emplissent celle qui est tenue', () => {
    const client = etat(PROIE, ICI, { sabotage: SURCHAUFFE });

    expect(new Set(couleurs(client, 'console:0'))).toEqual(
      new Set([APPARENCE_AMONG.poste.surchauffe]),
    );
    expect(disque(client, 'console:0')?.remplissage).toBeUndefined();
    expect(disque(client, 'console:1')?.remplissage?.couleur).toBe(
      APPARENCE_AMONG.poste.surchauffe,
    );
  });

  it('font battre le disque de reparation', () => {
    const client = etat(PROIE, ICI, { sabotage: PANNE });
    const alpha = (maintenant: number) =>
      image(client, maintenant).postes.disques.find((rond) => rond.id === 'boitier:disque')?.contour
        ?.alpha;

    expect(alpha(0)).not.toBe(alpha(APPARENCE_AMONG.poste.battementMs / 4));
  });
});

describe('le nuage noir', () => {
  const NUAGE = { x: 990, y: 190 };

  /** L'opacite du coeur du nuage, s'il est dessine. */
  const coeur = (prive: EtatPriveAmong, among: Partial<AmongVu>) =>
    image(etat(prive, ICI, among)).disques.find((rond) => rond.id === 'nuage:coeur');

  it('est opaque pour une proie vivante, a demi pour un assassin et un fantome', () => {
    expect(coeur(PROIE, { nuage: NUAGE })?.remplissage?.alpha).toBe(
      APPARENCE_AMONG.nuage.alphaOpaque,
    );
    expect(coeur(ASSASSIN, { nuage: NUAGE })?.remplissage?.alpha).toBe(
      APPARENCE_AMONG.nuage.alphaTranslucide,
    );
    expect(coeur(FANTOME, { nuage: NUAGE })?.remplissage?.alpha).toBe(
      APPARENCE_AMONG.nuage.alphaTranslucide,
    );
  });

  it('se pose sur sa station, en volutes toujours les memes, et dans son disque', () => {
    const volutes = (client: EtatClient) =>
      image(client).disques.filter((rond) => rond.id.startsWith('nuage:'));
    const premieres = volutes(etat(PROIE, ICI, { nuage: NUAGE }));

    expect(premieres).toHaveLength(APPARENCE_AMONG.nuage.volutes + 1);
    expect(volutes(etat(PROIE, ICI, { nuage: NUAGE }))).toEqual(premieres);
    expect(
      premieres.every(
        (rond) =>
          Math.hypot(rond.x - NUAGE.x, rond.y - NUAGE.y) + rond.rayon <= AMONG.RAYON_DU_NUAGE_PX,
      ),
    ).toBe(true);
  });

  it('ne se dessine pas sans nuage dans le flux', () => {
    expect(coeur(PROIE, {})).toBeUndefined();
  });
});

describe('les fleches vers les postes', () => {
  it('montrent le boitier pendant la panne, en orange, avec sa distance', () => {
    const resultat = image(etat(PROIE, ICI, { sabotage: PANNE }));
    const distance = Math.round(Math.hypot(LIEUX.boitier.x - ICI.x, LIEUX.boitier.y - ICI.y));

    expect(resultat.fleches).toHaveLength(1);
    expect(resultat.fleches[0]?.couleur).toBe(APPARENCE_AMONG.poste.panne);
    expect(resultat.libelles.map((libelle) => libelle.texte)).toEqual([
      `Boîtier ${String(distance)} px`,
    ]);
  });

  it('pointent vers le poste, a la meme distance de nous quelle que soit la sienne', () => {
    const [fleche] = image(etat(PROIE, ICI, { sabotage: PANNE })).fleches;
    const pointe = { x: fleche?.points[2] ?? 0, y: fleche?.points[3] ?? 0 };
    const versLePoste = Math.atan2(LIEUX.boitier.y - ICI.y, LIEUX.boitier.x - ICI.x);

    expect(Math.hypot(pointe.x - ICI.x, pointe.y - ICI.y)).toBeCloseTo(
      APPARENCE_AMONG.fleche.rayon,
    );
    expect(Math.atan2(pointe.y - ICI.y, pointe.x - ICI.x)).toBeCloseTo(versLePoste);
  });

  it('posent leur texte en deca de la fleche, qui ne le couvre pas, de cote comme en long', () => {
    const { rayon, longueur, largeurDUneLettre } = APPARENCE_AMONG.fleche;
    const taille = VISION_AMONG.taillePseudo;
    const places = [
      { x: LIEUX.boitier.x - 600, y: LIEUX.boitier.y },
      { x: LIEUX.boitier.x, y: LIEUX.boitier.y + 600 },
    ];

    for (const ici of places) {
      const [libelle] = image(etat(PROIE, ici, { sabotage: PANNE })).libelles;
      const horizontal = ici.y === LIEUX.boitier.y;
      const centre = horizontal ? (libelle?.x ?? 0) - ici.x : ici.y - (libelle?.y ?? 0);
      const demi = horizontal
        ? ((libelle?.texte.length ?? 0) * taille * largeurDUneLettre) / 2
        : taille / 2;

      expect(centre + demi).toBeLessThan(rayon - longueur);
      expect(centre - demi).toBeGreaterThan(0);
    }
  });

  it('montrent les deux consoles pendant la surchauffe, en rouge', () => {
    const resultat = image(etat(ASSASSIN, ICI, { sabotage: SURCHAUFFE }));

    expect(resultat.fleches.map((fleche) => fleche.couleur)).toEqual([
      APPARENCE_AMONG.poste.surchauffe,
      APPARENCE_AMONG.poste.surchauffe,
    ]);
    expect(resultat.libelles.every((libelle) => libelle.texte.startsWith('Console '))).toBe(true);
  });

  it('se taisent pres du poste, hors du jeu, et sans sabotage a reparer', () => {
    const pres = { x: LIEUX.boitier.x + 40, y: LIEUX.boitier.y };
    const flou: SabotageEnCoursVu = { ...PANNE, nature: 'flou', restantMs: 5_000 };

    expect(image(etat(PROIE, pres, { sabotage: PANNE })).fleches).toEqual([]);
    expect(image(etat(PROIE, ICI, { phase: 'vote', sabotage: PANNE })).fleches).toEqual([]);
    expect(image(etat(ASSASSIN, ICI, { sabotage: flou })).fleches).toEqual([]);
    expect(image(etat(PROIE, ICI)).libelles).toEqual([]);
  });
});
