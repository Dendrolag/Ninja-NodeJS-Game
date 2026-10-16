/**
 * Tests du rendu des sabotages d'Among Ninjas (etape 7.22): le disque d'une proie vivante qui
 * tombe a 110 pixels pendant la panne, et le decor eteint plus sombre (rendu 2C); le boitier et
 * les consoles au sol, cyan au repos, orange ou rouge pendant leur sabotage (rendu 6A); le nuage
 * noir, opaque pour une proie vivante et a demi pour qui y voit (rendu 4A); les fleches vers les
 * postes, avec leur distance (rendus 2C et 3B).
 *
 * Et les objets du decor qui remplacent l'anneau du gong, le dessin du boitier et le disque de la
 * pierre du jardin zen sur Tokyo (13 octobre 2026): toujours la, eclaires pour qui peut s'en
 * servir.
 */

import type { AmongVu, EntiteVue, EtatPriveAmong, SabotageEnCoursVu } from '@neon-ninja/shared';
import { AMONG, REGLAGES_PAR_DEFAUT, lieuxDuMode } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { APPARENCE_AMONG, imageDAmong, objetsDuDecorAmong } from './among.js';
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

const PANNE: SabotageEnCoursVu = {
  nature: 'panne',
  restantMs: 0,
  consolesTenues: [false, false],
  consolesPurgees: [false, false],
  interrupteursCoupes: 0,
};
const SURCHAUFFE: SabotageEnCoursVu = {
  nature: 'surchauffe',
  restantMs: 20_000,
  consolesTenues: [false, true],
  consolesPurgees: [true, true],
  interrupteursCoupes: 0,
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

  it('laissent le boitier et les consoles de Tokyo a leurs objets: ni socle, ni trait, ni disque', () => {
    for (const sabotage of [undefined, PANNE, SURCHAUFFE]) {
      const client = etat(PROIE, ICI, sabotage === undefined ? {} : { sabotage });

      for (const poste of ['boitier', 'console:0', 'console:1']) {
        expect(couleurs(client, poste)).toEqual([]);
        expect(disque(client, poste)).toBeUndefined();
      }
      expect(image(client).postes.disques).toEqual([]);
    }
  });
});

describe('les objets du decor', () => {
  /** La surbrillance de l'objet de ce lieu, s'il s'eclaire. */
  const eclaire = (client: EtatClient, lieu: 'gong' | 'boitier', maintenant = 0) =>
    image(client, maintenant).surbrillances.find((objet) => objet.lieu === lieu);
  const PIERRE =
    LIEUX.stations.find((station) => station.nom === 'Pierre du jardin zen') ??
    expect.fail('Tokyo a sa pierre du jardin zen');
  const AUTRE =
    LIEUX.stations.find((station) => station.nom === "Lavabos de l'arcade") ??
    expect.fail('Tokyo a ses lavabos');
  /** Les objets poses sur leur lieu, hors des meubles decoupes du fond (16 octobre 2026). */
  const surLeurLieu = (miroir: boolean) =>
    objetsDuDecorAmong('map1', miroir).filter(
      (objet) =>
        !objet.id.includes('station:') || objet.id === 'objet:station:Pierre du jardin zen',
    );
  /** Une proie qui a une tache a la pierre et une autre ailleurs, a cette place. */
  const aLaPierre = (ici: { readonly x: number; readonly y: number }, faite = false) =>
    etat(
      {
        ...PROIE,
        stations: [PIERRE, AUTRE],
        taches: [
          { station: 0, nature: 'katana', faite },
          { station: 1, nature: 'couleurs', faite: false },
        ],
      },
      ici,
    );
  const pierreEclairee = (client: EtatClient, maintenant = 0) =>
    image(client, maintenant).surbrillances.find(
      (objet) => objet.id === 'objet:station:Pierre du jardin zen',
    );

  it('habillent le gong, le boitier, la pierre et les consoles de Tokyo, a leur place', () => {
    expect(surLeurLieu(false)).toEqual([
      expect.objectContaining({
        lieu: 'gong',
        texture: '/assets/among/map1/gong.png',
        x: LIEUX.gong.x,
        y: LIEUX.gong.y,
      }),
      expect.objectContaining({
        lieu: 'boitier',
        texture: '/assets/among/map1/generator.png',
        x: LIEUX.boitier.x,
        y: LIEUX.boitier.y,
      }),
      expect.objectContaining({
        lieu: { station: 'Pierre du jardin zen' },
        texture: '/assets/among/map1/pierre-jardin.png',
        x: PIERRE.x,
        y: PIERRE.y,
      }),
      expect.objectContaining({
        id: 'objet:console:0',
        texture: '/assets/among/map1/console.png',
        x: LIEUX.consoles[0].x,
        y: LIEUX.consoles[0].y,
      }),
      expect.objectContaining({
        id: 'objet:console:1',
        texture: '/assets/among/map1/console.png',
        x: LIEUX.consoles[1].x,
        y: LIEUX.consoles[1].y,
      }),
    ]);
  });

  it('suivent leur lieu en miroir', () => {
    const miroir = lieuxDuMode('map1', true) ?? expect.fail('Tokyo a ses lieux');

    const pierre = miroir.stations.find((station) => station.nom === PIERRE.nom);

    expect(surLeurLieu(true).map(({ x, y }) => ({ x, y }))).toEqual([
      miroir.gong,
      miroir.boitier,
      { x: pierre?.x, y: pierre?.y },
      miroir.consoles[0],
      miroir.consoles[1],
    ]);
  });

  it('posent chaque meuble decoupe a sa place, devant chacune des places de sa station', () => {
    const meubles = objetsDuDecorAmong('map1', false).filter(
      (objet) => objet.pour !== undefined && objet.id !== 'objet:station:Pierre du jardin zen',
    );
    const roses =
      LIEUX.stations.find((station) => station.nom === "Bornes roses de l'arcade") ??
      expect.fail('Tokyo a ses bornes roses');

    expect(meubles).toHaveLength(32);
    expect(new Set(meubles.map((objet) => objet.id)).size).toBe(32);
    expect(
      meubles
        .filter((objet) => objet.lieu !== 'gong' && 'station' in (objet.lieu as object))
        .filter((objet) => (objet.lieu as { station: string }).station === roses.nom)
        .map((objet) => objet.pour),
    ).toEqual(expect.arrayContaining([...(roses.places ?? [])]));
    // Un meuble qui regarde de l'autre cote se pose retourne.
    expect(meubles.some((objet) => objet.retourne === true)).toBe(true);
  });

  it('n eclairent que le meuble devant la place que la partie a tiree', () => {
    const roses =
      LIEUX.stations.find((station) => station.nom === "Bornes roses de l'arcade") ??
      expect.fail('Tokyo a ses bornes roses');
    const tiree = roses.places?.[4] ?? expect.fail('les bornes roses ont des places');
    const { places: _toutes, ...station } = { ...roses, x: tiree.x, y: tiree.y };
    const client = etat(
      { ...PROIE, stations: [station], taches: [{ station: 0, nature: 'couleurs', faite: false }] },
      tiree,
    );
    const eclairees = image(client).surbrillances.filter((objet) =>
      objet.id.startsWith('objet:station:Bornes roses'),
    );

    expect(eclairees.map((objet) => objet.pour)).toEqual([tiree]);
    expect(eclairees[0]?.alpha).toBe(1);
    // Son disque ne se montre pas: le meuble le remplace.
    expect(image(client).disques.map((rond) => rond.id)).not.toContain(
      `station:${String(tiree.x)}:${String(tiree.y)}`,
    );
  });

  it('remplacent l anneau du gong', () => {
    expect(image(etat(PROIE, ICI)).disques.find((rond) => rond.id === 'gong')).toBeUndefined();
  });

  it('eclairent le gong en magenta pour qui peut le sonner, et pour lui seul', () => {
    expect(eclaire(etat(PROIE, LIEUX.gong), 'gong')).toMatchObject({
      couleur: APPARENCE_AMONG.gong.couleur,
      alpha: 1,
    });
    expect(eclaire(etat(ASSASSIN, LIEUX.gong), 'gong')).toBeDefined();
    // Trop loin, deja sonne, mort, ou pendant la surchauffe, ou le gong ne sonne pas.
    expect(eclaire(etat(PROIE, ICI), 'gong')).toBeUndefined();
    expect(eclaire(etat({ ...PROIE, gongUtilise: true }, LIEUX.gong), 'gong')).toBeUndefined();
    expect(eclaire(etat(FANTOME, LIEUX.gong), 'gong')).toBeUndefined();
    expect(eclaire(etat(PROIE, LIEUX.gong, { sabotage: SURCHAUFFE }), 'gong')).toBeUndefined();
  });

  it('font battre les consoles en rouge pendant la surchauffe, pleines a portee ou cle tenue', () => {
    const console0 = (client: EtatClient, maintenant = 0) =>
      image(client, maintenant).surbrillances.find((objet) => objet.id === 'objet:console:0');
    const console1 = (client: EtatClient) =>
      image(client).surbrillances.find((objet) => objet.id === 'objet:console:1');
    const loin = etat(PROIE, ICI, { sabotage: SURCHAUFFE });

    expect(console0(loin)?.couleur).toBe(APPARENCE_AMONG.poste.surchauffe);
    expect(console0(loin)?.alpha).not.toBe(
      console0(loin, APPARENCE_AMONG.poste.battementMs / 4)?.alpha,
    );
    // La seconde console a sa cle tenue (SURCHAUFFE): pleine.
    expect(console1(loin)?.alpha).toBe(1);
    expect(console0(etat(PROIE, LIEUX.consoles[0], { sabotage: SURCHAUFFE }))?.alpha).toBe(1);
    // Ni hors de la surchauffe, ni pendant la panne.
    expect(console0(etat(PROIE, ICI))).toBeUndefined();
    expect(console0(etat(PROIE, LIEUX.consoles[0], { sabotage: PANNE }))).toBeUndefined();
  });

  it('font battre le generateur en orange pendant la panne, et l eclairent a portee', () => {
    const loin = etat(PROIE, ICI, { sabotage: PANNE });
    const alpha = (maintenant: number) => eclaire(loin, 'boitier', maintenant)?.alpha;

    expect(eclaire(loin, 'boitier')?.couleur).toBe(APPARENCE_AMONG.poste.panne);
    expect(alpha(0)).not.toBe(alpha(APPARENCE_AMONG.poste.battementMs / 4));
    expect(eclaire(etat(PROIE, LIEUX.boitier, { sabotage: PANNE }), 'boitier')?.alpha).toBe(1);
    expect(eclaire(etat(PROIE, LIEUX.boitier), 'boitier')).toBeUndefined();
  });

  it('remplacent le disque de la pierre, et laissent le leur aux autres stations', () => {
    const disques = image(aLaPierre(ICI)).disques.map((rond) => rond.id);

    expect(disques).not.toContain(`station:${String(PIERRE.x)}:${String(PIERRE.y)}`);
    expect(disques).toContain(`station:${String(AUTRE.x)}:${String(AUTRE.y)}`);
  });

  it('font battre la pierre en cyan quand on a a y faire, et l eclairent a portee', () => {
    const loin = aLaPierre(ICI);
    const alpha = (maintenant: number) => pierreEclairee(loin, maintenant)?.alpha;

    expect(pierreEclairee(loin)?.couleur).toBe(APPARENCE_AMONG.station.couleur);
    expect(alpha(0)).not.toBe(alpha(APPARENCE_AMONG.poste.battementMs / 4));
    expect(pierreEclairee(aLaPierre(PIERRE))?.alpha).toBe(1);
    // Sa tache faite, la pierre ne dit plus rien, de loin comme de pres.
    expect(pierreEclairee(aLaPierre(ICI, true))).toBeUndefined();
    expect(pierreEclairee(aLaPierre(PIERRE, true))).toBeUndefined();
  });

  it('ne s eclairent pas avant que la page sache notre role, ni hors de la phase de jeu', () => {
    const sansRole = etat(PROIE, LIEUX.gong);

    expect(
      image({ ...sansRole, among: { ...sansRole.among, prive: undefined } }).surbrillances,
    ).toEqual([]);
    expect(eclaire(etat(PROIE, LIEUX.gong, { phase: 'discussion' }), 'gong')).toBeUndefined();
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
