/**
 * Tests de la construction de la scene.
 *
 * LE TEST EXIGE PAR LA FICHE DE L'ETAPE EST LE PREMIER: le nombre d'entites
 * affichees correspond a l'etat recu. Il parait evident, et c'est precisement le
 * genre d'evidence que le client d'origine ne verifiait nulle part: son
 * drawEntities parcourait une variable globale que six endroits differents
 * pouvaient avoir modifiee entre deux images.
 *
 * Les autres couvrent les regles d'apparence qui ne se voient qu'a l'oeil, donc
 * que personne ne remarque quand elles cassent: la disparition dans une zone
 * d'invisibilite, les halos de bonus, le clignotement des objets.
 */

import type { EntiteVue, InfosSalon, ObjetVu, Orientation, ZoneVue } from '@neon-ninja/shared';
import {
  CARTES,
  OBJETS,
  RACINE_RESSOURCES,
  REGLAGES_PAR_DEFAUT,
  TACTIQUE,
  cheminNinja,
  cheminObjet,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EffetActif, EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import type { FaitDeJeu } from '../faits.js';
import { fait } from '../faits.js';
import type { VuePartie } from '../reconstruction.js';
import type { VueLissee } from './interpolation.js';
import { SCENE_VIDE, construireScene, couleurEnNombre, nuage } from './scene.js';
import {
  APPARENCE_EVADE,
  APPARENCE_FUMEE,
  APPARENCE_IMPACT_BOT_NOIR,
  APPARENCE_ZONE,
  AURA_DU_BLACK_NINJA,
} from './apparence.js';
import { adresseDImage, adresseRayee } from './textures.js';
import { creerTrajectoire, etatDuVaisseau } from './vaisseau.js';

/** Un joueur pose a un endroit, avec le minimum de champs. */
function joueur(id: string, x: number, y: number, couleur = '#FF0000'): EntiteVue {
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

/** Un bot ordinaire ou noir. */
function bot(id: string, x: number, y: number, type: 'bot' | 'botNoir' = 'bot'): EntiteVue {
  return { type, id, x, y, couleur: '#FFFFFF', direction: 'nord' };
}

/** Une vue de partie a partir d'entites, d'objets et de zones. */
function vue(
  entites: readonly EntiteVue[],
  objets: readonly ObjetVu[] = [],
  zones: readonly ZoneVue[] = [],
): VuePartie {
  return {
    tick: 1,
    tempsRestantMs: 60_000,
    enPause: false,
    entites,
    objets,
    zones,
    classement: [],
  };
}

/** Une vue lissee ou chaque entite est deja a sa place, sans mouvement. */
function lissee(partie: VuePartie): VueLissee {
  return {
    vue: partie,
    entites: partie.entites.map((entite) => ({
      entite,
      x: entite.x,
      y: entite.y,
      enMouvement: false,
    })),
    tempsRestantMs: partie.tempsRestantMs,
  };
}

/** Un etat de client en partie, avec l'identite fournie. */
function etatEnJeu(moi: string, effets: readonly EffetActif[] = []): EtatClient {
  return { ...ETAT_INITIAL, ecran: 'jeu', moi, effets };
}

describe('construireScene', () => {
  it('rend une scene vide tant qu aucun battement n est arrive', () => {
    expect(construireScene(etatEnJeu('moi'), undefined, 0)).toBe(SCENE_VIDE);
  });

  it('porte le vaisseau de la Station lunaire, au temps de la partie, et notre ninja (etape 8.9)', () => {
    const trajectoire = creerTrajectoire(5, CARTES.station, 180_000);
    const partie = { ...vue([joueur('moi', 300, 400)]), tempsRestantMs: 90_000 };
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(partie),
      0,
      undefined,
      'normal',
      trajectoire,
    );

    expect(scene.vaisseau).toEqual({
      ...etatDuVaisseau(trajectoire, 90_000),
      moi: { x: 300, y: 400 },
    });
    expect(construireScene(etatEnJeu('moi'), lissee(partie), 0).vaisseau).toBeUndefined();
  });

  it('affiche exactement autant d entites que l etat en contient', () => {
    const entites = [
      joueur('moi', 100, 100),
      joueur('autre', 200, 200, '#00FF00'),
      bot('bot-1', 300, 300),
      bot('bot-2', 400, 400),
      bot('noir-1', 500, 500, 'botNoir'),
    ];

    const scene = construireScene(etatEnJeu('moi'), lissee(vue(entites)), 0);

    expect(scene.entites).toHaveLength(entites.length);
    expect(scene.entites.map((sprite) => sprite.id)).toEqual([
      'moi',
      'autre',
      'bot-1',
      'bot-2',
      'noir-1',
    ]);
  });

  it('suit le nombre d entites quand l etat change', () => {
    const avant = construireScene(etatEnJeu('moi'), lissee(vue([joueur('moi', 0, 0)])), 0);
    const apres = construireScene(
      etatEnJeu('moi'),
      lissee(vue([joueur('moi', 0, 0), bot('bot-1', 10, 10), bot('bot-2', 20, 20)])),
      0,
    );

    expect(avant.entites).toHaveLength(1);
    expect(apres.entites).toHaveLength(3);
  });

  it('place chaque sprite a la position lissee, pas a celle du battement', () => {
    const partie = vue([joueur('moi', 100, 100)]);
    const glissee: VueLissee = {
      vue: partie,
      entites: [{ entite: partie.entites[0] as EntiteVue, x: 42, y: 84, enMouvement: true }],
      tempsRestantMs: partie.tempsRestantMs,
    };

    const scene = construireScene(etatEnJeu('moi'), glissee, 0);

    expect(scene.entites[0]?.x).toBe(42);
    expect(scene.entites[0]?.y).toBe(84);
  });

  it('montre un personnage arrete tourne vers sa direction, sur sa premiere image', () => {
    // A l'arret, le flux garde la derniere direction: le sprite y reste tourne, sans
    // marcher sur place, comme getFrameKey du jeu d'origine.
    const partie = vue([joueur('moi', 100, 100)]);
    const enMarche: VueLissee = {
      vue: partie,
      entites: [{ entite: partie.entites[0] as EntiteVue, x: 100, y: 100, enMouvement: true }],
      tempsRestantMs: partie.tempsRestantMs,
    };
    const texture = (etatDeLaVue: VueLissee, instant: number): string | undefined =>
      construireScene(etatEnJeu('moi'), etatDeLaVue, instant).entites[0]?.texture;

    expect(texture(lissee(partie), 0)).toBe(`${RACINE_RESSOURCES}/${cheminNinja('sud', 1)}`);
    expect(texture(lissee(partie), 1_000)).toBe(`${RACINE_RESSOURCES}/${cheminNinja('sud', 1)}`);
    expect(new Set([0, 125, 250, 375].map((instant) => texture(enMarche, instant))).size).toBe(2);
  });

  it('teinte chaque sprite de la couleur de son proprietaire', () => {
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([joueur('moi', 0, 0, '#FF0000'), bot('bot-1', 10, 10)])),
      0,
    );

    expect(scene.entites[0]?.teinte).toBe(0xff0000);
    expect(scene.entites[1]?.teinte).toBe(0xffffff);
  });

  it('pose une ombre sous notre personnage, et sous lui seul', () => {
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([joueur('moi', 0, 0), joueur('autre', 50, 50)])),
      0,
    );

    const ombres = scene.disques.filter((disque) => disque.id.endsWith(':ombre'));

    expect(ombres).toHaveLength(1);
    expect(ombres[0]?.id).toBe('moi:ombre');
  });

  it('ajoute un halo par bonus actif sur nous', () => {
    const effets: readonly EffetActif[] = [
      { categorie: 'bonus', nature: 'vitesse', surMoi: true, finPrevueA: 10_000, dureeMs: 10_000 },
      {
        categorie: 'bonus',
        nature: 'invincibilite',
        surMoi: true,
        finPrevueA: 10_000,
        dureeMs: 10_000,
      },
    ];

    const scene = construireScene(etatEnJeu('moi', effets), lissee(vue([joueur('moi', 0, 0)])), 0);

    expect(scene.disques.map((disque) => disque.id)).toContain('moi:vitesse');
    expect(scene.disques.map((disque) => disque.id)).toContain('moi:invincibilite');
  });

  it('ignore un bonus dont la duree est deja passee', () => {
    const effets: readonly EffetActif[] = [
      { categorie: 'bonus', nature: 'vitesse', surMoi: true, finPrevueA: 1_000, dureeMs: 10_000 },
    ];

    const scene = construireScene(
      etatEnJeu('moi', effets),
      lissee(vue([joueur('moi', 0, 0)])),
      5_000,
    );

    expect(scene.disques.map((disque) => disque.id)).not.toContain('moi:vitesse');
  });

  it('revele les autres joueurs, et seulement eux, quand la revelation est active', () => {
    const effets: readonly EffetActif[] = [
      {
        categorie: 'bonus',
        nature: 'revelation',
        surMoi: true,
        finPrevueA: 10_000,
        dureeMs: 10_000,
      },
    ];

    const scene = construireScene(
      etatEnJeu('moi', effets),
      lissee(vue([joueur('moi', 0, 0), joueur('autre', 50, 50), bot('bot-1', 90, 90)])),
      0,
    );

    // Notre propre halo de revelation porte le meme suffixe: on ne compte donc
    // que ceux qui ne sont pas les notres.
    const reveles = scene.disques
      .map((disque) => disque.id)
      .filter((id) => id.endsWith(':revelation') && !id.startsWith('moi:'));

    expect(reveles).toEqual(['autre:revelation']);
  });

  it('montre le rayon de detection d un bot noir, tire des reglages de la partie', () => {
    const salon = {
      idRoom: 'room-1',
      statut: 'enCours',
      joueurs: [],
      reglages: {
        ...REGLAGES_PAR_DEFAUT,
        botsNoirs: { ...REGLAGES_PAR_DEFAUT.botsNoirs, rayonDetectionPx: 321 },
      },
    } as unknown as InfosSalon;

    const scene = construireScene(
      { ...etatEnJeu('moi'), salon },
      lissee(vue([bot('noir-1', 10, 10, 'botNoir')])),
      0,
    );

    const detection = scene.disques.find((disque) => disque.id === 'noir-1:detection');

    expect(detection?.rayon).toBe(321);
  });

  it('marque le Black Ninja de ses yeux rouges et de son aura, et lui seul (etape 5.8)', () => {
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([bot('noir-1', 10, 10, 'botNoir'), bot('faux-1', 300, 300)])),
      0,
    );
    const noir = scene.entites.find((sprite) => sprite.id === 'noir-1');
    const faux = scene.entites.find((sprite) => sprite.id === 'faux-1');

    expect(noir?.texture).toMatch(/#yeux-rouges$/);
    expect(faux?.texture).not.toMatch(/#yeux-rouges$/);
    expect(scene.disques.filter((disque) => disque.id.startsWith('noir-1:volute'))).toHaveLength(
      AURA_DU_BLACK_NINJA.volutes,
    );
    expect(scene.disques.some((disque) => disque.id === 'noir-1:yeux')).toBe(true);
    expect(scene.disques.some((disque) => disque.id.startsWith('faux-1:'))).toBe(false);
  });

  describe('zone d invisibilite', () => {
    const zone: ZoneVue = {
      id: 'zone-1',
      type: 'invisibilite',
      x: 100,
      y: 100,
      rayon: 50,
      dureeRestanteMs: 5_000,
    };

    it('cache les autres joueurs qui s y trouvent', () => {
      const scene = construireScene(
        etatEnJeu('moi'),
        lissee(vue([joueur('moi', 0, 0), joueur('autre', 110, 100)], [], [zone])),
        0,
      );

      expect(scene.entites.map((sprite) => sprite.id)).toEqual(['moi']);
    });

    it('nous laisse nous voir, en transparence', () => {
      const scene = construireScene(
        etatEnJeu('moi'),
        lissee(vue([joueur('moi', 110, 100)], [], [zone])),
        0,
      );

      expect(scene.entites).toHaveLength(1);
      expect(scene.entites[0]?.alpha).toBeLessThan(1);
    });

    it('ne cache pas les bots, qui n ont rien a dissimuler', () => {
      const scene = construireScene(
        etatEnJeu('moi'),
        lissee(vue([bot('bot-1', 110, 100)], [], [zone])),
        0,
      );

      expect(scene.entites.map((sprite) => sprite.id)).toEqual(['bot-1']);
    });

    it('laisse visible un joueur juste en dehors du disque', () => {
      const scene = construireScene(
        etatEnJeu('moi'),
        lissee(vue([joueur('moi', 0, 0), joueur('autre', 200, 100)], [], [zone])),
        0,
      );

      expect(scene.entites.map((sprite) => sprite.id)).toEqual(['moi', 'autre']);
    });
  });

  describe('objets poses sur la carte', () => {
    const bonus: ObjetVu = {
      id: 'bonus-1',
      categorie: 'bonus',
      nature: 'vitesse',
      x: 300,
      y: 300,
      dureeDeVieRestanteMs: OBJETS.DUREE_DE_VIE_MS,
    };

    it('affiche un sprite et un halo par objet', () => {
      const scene = construireScene(etatEnJeu('moi'), lissee(vue([], [bonus])), 0);

      expect(scene.objets.map((sprite) => sprite.id)).toEqual(['bonus-1']);
      expect(scene.disques.map((disque) => disque.id)).toContain('bonus-1:halo');
    });

    // Defaut releve a la recette de l'etape 5.4: l'icone est une planche de deux
    // images cote a cote, et le rendu l'affichait entiere, les deux etats a la
    // fois. Le jeu d'origine en montrait une a la fois, huit fois par seconde.
    it('montre l icone d un objet image par image, jamais la planche entiere', () => {
      const textureA = (instant: number): string | undefined =>
        construireScene(etatEnJeu('moi'), lissee(vue([], [bonus])), instant).objets[0]?.texture;
      const planche = `${RACINE_RESSOURCES}/${cheminObjet('vitesse')}`;

      expect(textureA(0)).toBe(adresseDImage(planche, 0));
      expect(textureA(124)).toBe(adresseDImage(planche, 0));
      expect(textureA(125)).toBe(adresseDImage(planche, 1));
      expect(textureA(250)).toBe(adresseDImage(planche, 0));
    });

    // Defaut releve a la recette de l'etape 5.4: la pluie de Rainy Tokyo n'avait
    // jamais ete portee. Le jeu d'origine changeait d'image toutes les cent
    // millisecondes, sur une planche de trois (RainEffect, legacy/js/MapManager.js).
    it('fait tomber la pluie image par image, dix fois par seconde', () => {
      const imageA = (instant: number): number | undefined =>
        construireScene(etatEnJeu('moi'), lissee(vue([], [])), instant).imageDePluie;

      expect(imageA(0)).toBe(0);
      expect(imageA(99)).toBe(0);
      expect(imageA(100)).toBe(1);
      expect(imageA(250)).toBe(2);
      expect(imageA(300)).toBe(0);
    });

    it('laisse un objet frais pleinement opaque', () => {
      const scene = construireScene(etatEnJeu('moi'), lissee(vue([], [bonus])), 0);

      expect(scene.objets[0]?.alpha).toBe(1);
    });

    it('fait clignoter un objet sur le point de disparaitre', () => {
      const expirant = { ...bonus, dureeDeVieRestanteMs: 500 };
      const opacites = [0, 100, 200, 300].map(
        (instant) =>
          construireScene(etatEnJeu('moi'), lissee(vue([], [expirant])), instant).objets[0]?.alpha,
      );

      expect(new Set(opacites).size).toBeGreaterThan(1);
      expect(opacites.every((alpha) => (alpha ?? 0) <= 1)).toBe(true);
    });
  });

  it('dessine chaque zone a sa place, a son rayon et a sa couleur (etape 7.12)', () => {
    const zone: ZoneVue = {
      id: 'zone-1',
      type: 'chaos',
      x: 100,
      y: 100,
      rayon: 60,
      dureeRestanteMs: 5_000,
    };

    const scene = construireScene(etatEnJeu('moi'), lissee(vue([], [], [zone])), 0);
    const fond = scene.zones[0]?.couches[0]?.disques[0];

    expect(scene.zones).toHaveLength(1);
    expect(fond).toMatchObject({ x: 100, y: 100, rayon: 60 });
    expect(fond?.remplissage?.couleur).toBe(APPARENCE_ZONE.chaos.couleur);
  });

  it('fait gonfler une zone qui vient de s ouvrir, d apres le journal (etape 7.12)', () => {
    const zone: ZoneVue = {
      id: 'zone-1',
      type: 'repulsion',
      x: 400,
      y: 300,
      rayon: 220,
      dureeRestanteMs: 12_000,
    };
    const ouverte = fait(
      'mineDeZone',
      { quoi: 'ouverte', mine: 'mz', nature: 'repulsion', x: 400, y: 300 },
      1_000,
    );
    const etat = { ...etatEnJeu('moi'), journal: [ouverte] };
    const rayonA = (instant: number): number | undefined =>
      construireScene(etat, lissee(vue([], [], [zone])), instant).zones[0]?.couches[0]?.disques[0]
        ?.rayon;

    expect(rayonA(1_000)).toBe(0);
    expect(rayonA(1_150)).toBeGreaterThan(150);
    expect(rayonA(1_150)).toBeLessThan(220);
    expect(rayonA(1_300)).toBe(220);
  });
});

describe('le cone du mode Tactique', () => {
  /** Un joueur qui porte l'etat du mode Tactique. */
  function tacticien(
    id: string,
    x: number,
    y: number,
    orientation: Orientation,
    charges: number = TACTIQUE.CHARGES_MAXIMUM,
  ): EntiteVue {
    return {
      ...joueur(id, x, y),
      tactique: { orientation, charges, avantProchaineChargeMs: TACTIQUE.RECHARGE_MS },
    } as EntiteVue;
  }

  /** Un tir annonce, arrive a cet instant. */
  function tir(tireur: string, captures: number, instant: number): FaitDeJeu {
    return fait('tirDeCapture', { tireur, x: 10, y: 20, orientation: 'est', captures }, instant);
  }

  it('pose notre visee a la position affichee de notre personnage, dans sa direction', () => {
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([tacticien('moi', 100, 200, 'sud')])),
      0,
    );

    expect(scene.cones).toHaveLength(1);
    expect(scene.cones[0]).toMatchObject({
      id: 'moi:visee',
      x: 100,
      y: 200,
      rayon: TACTIQUE.PORTEE_PX,
    });
    expect(scene.cones[0]?.angle).toBeCloseTo(Math.PI / 2);
    expect(scene.cones[0]?.demiOuverture).toBeCloseTo(Math.PI / 4);
  });

  it('ne montre pas la visee des autres joueurs', () => {
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([tacticien('moi', 0, 0, 'est'), tacticien('autre', 50, 50, 'nord')])),
      0,
    );

    expect(scene.cones.map((cone) => cone.id)).toEqual(['moi:visee']);
  });

  it('palit la visee quand il ne reste aucune charge', () => {
    const armee = construireScene(
      etatEnJeu('moi'),
      lissee(vue([tacticien('moi', 0, 0, 'est')])),
      0,
    );
    const desarmee = construireScene(
      etatEnJeu('moi'),
      lissee(vue([tacticien('moi', 0, 0, 'est', 0)])),
      0,
    );

    expect(desarmee.cones[0]?.remplissage.alpha).toBeLessThan(
      armee.cones[0]?.remplissage.alpha ?? 0,
    );
  });

  it('ne pose aucun cone dans une partie Classique', () => {
    const scene = construireScene(etatEnJeu('moi'), lissee(vue([joueur('moi', 0, 0)])), 0);

    expect(scene.cones).toEqual([]);
  });

  it('fait partir l eclair d un tir de n importe qui, qui grandit, s efface et disparait', () => {
    const etat = { ...etatEnJeu('moi'), journal: [tir('autre', 2, 1_000)] };
    const partie = lissee(vue([joueur('moi', 0, 0)]));

    const depart = construireScene(etat, partie, 1_000).cones;
    const milieu = construireScene(etat, partie, 1_150).cones;
    const fin = construireScene(etat, partie, 1_300).cones;

    expect(depart).toHaveLength(1);
    expect(depart[0]).toMatchObject({ x: 10, y: 20, angle: 0, rayon: TACTIQUE.PORTEE_PX });
    expect(milieu[0]?.rayon).toBeGreaterThan(TACTIQUE.PORTEE_PX);
    expect(milieu[0]?.remplissage.alpha).toBeLessThan(depart[0]?.remplissage.alpha ?? 0);
    expect(fin).toEqual([]);
  });

  it('donne a un tir sans effet une autre couleur qu a un tir qui a capture', () => {
    const partie = lissee(vue([joueur('moi', 0, 0)]));
    const reussi = construireScene({ ...etatEnJeu('moi'), journal: [tir('moi', 1, 0)] }, partie, 0);
    const manque = construireScene({ ...etatEnJeu('moi'), journal: [tir('moi', 0, 0)] }, partie, 0);

    expect(reussi.cones[0]?.remplissage.couleur).not.toBe(manque.cones[0]?.remplissage.couleur);
  });

  it('cache l eclair d un tir parti d une zone d invisibilite, sauf le notre', () => {
    // Le tireur y est cache aux autres: l'eclair de son tir ne doit pas le trahir.
    const zone: ZoneVue = {
      id: 'zone-1',
      type: 'invisibilite',
      x: 10,
      y: 20,
      rayon: 50,
      dureeRestanteMs: 5_000,
    };
    const partie = lissee(vue([joueur('moi', 300, 300)], [], [zone]));

    const autre = construireScene(
      { ...etatEnJeu('moi'), journal: [tir('autre', 1, 0)] },
      partie,
      0,
    );
    const mien = construireScene({ ...etatEnJeu('moi'), journal: [tir('moi', 1, 0)] }, partie, 0);

    expect(autre.cones).toEqual([]);
    expect(mien.cones).toHaveLength(1);
  });
});

describe('les objets du Tactique a l ecran (etape 7.7)', () => {
  /** Un joueur qui porte l'etat du mode Tactique. */
  function tacticien(id: string): EntiteVue {
    return {
      ...joueur(id, 100, 200),
      tactique: { orientation: 'est', charges: 3, avantProchaineChargeMs: 2500 },
    } as EntiteVue;
  }

  /** Le salon d'une partie Tactique en cours. */
  const SALON_TACTIQUE: InfosSalon = {
    idRoom: 'room-1',
    statut: 'enCours',
    mode: 'tactique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [],
    reglages: REGLAGES_PAR_DEFAUT,
  };

  /** Un client en jeu dans une partie Tactique, avec ces effets. */
  function enTactique(effets: readonly EffetActif[] = []): EtatClient {
    return { ...etatEnJeu('moi', effets), salon: SALON_TACTIQUE };
  }

  /** Un effet en cours sur nous, ou inflige aux autres. */
  function effet(
    categorie: EffetActif['categorie'],
    nature: EffetActif['nature'],
    surMoi = true,
  ): EffetActif {
    return { categorie, nature, surMoi, finPrevueA: 9000, dureeMs: 10_000 };
  }

  it('pose l arc de nos charges sous notre ninja, en Tactique seulement', () => {
    const partie = lissee(vue([tacticien('moi'), tacticien('autre')]));
    const tactique = construireScene(enTactique(), partie, 0);
    const ailleurs = construireScene(etatEnJeu('moi'), partie, 0);

    expect(tactique.indicateur.disques.length).toBeGreaterThan(0);
    expect(tactique.indicateur.disques.every((disque) => disque.id.startsWith('moi:'))).toBe(true);
    expect(ailleurs.indicateur).toEqual(SCENE_VIDE.indicateur);
  });

  it('ouvre notre visee sous Visee large, et la resserre sous Visee etroite subie', () => {
    const partie = lissee(vue([tacticien('moi')]));
    const large = construireScene(enTactique([effet('bonus', 'viseeLarge')]), partie, 0);
    const etroite = construireScene(enTactique([effet('malus', 'viseeEtroite')]), partie, 0);
    const infligee = construireScene(
      enTactique([effet('malus', 'viseeEtroite', false)]),
      partie,
      0,
    );

    expect(large.cones[0]).toMatchObject({ rayon: 150 });
    expect(large.cones[0]?.demiOuverture).toBeCloseTo(Math.PI / 3);
    expect(etroite.cones[0]).toMatchObject({ rayon: 70 });
    expect(etroite.cones[0]?.demiOuverture).toBeCloseTo(Math.PI / 6);
    // Le malus qu'on a ramasse frappe les autres: notre cone ne change pas.
    expect(infligee.cones[0]).toMatchObject({ rayon: TACTIQUE.PORTEE_PX });
  });

  it('dessine l eclair d un tir au cone du tireur', () => {
    const tir = fait(
      'tirDeCapture',
      { tireur: 'autre', x: 10, y: 20, orientation: 'est', captures: 0, visee: 'large' },
      0,
    );
    const scene = construireScene(
      { ...etatEnJeu('moi'), journal: [tir] },
      lissee(vue([joueur('moi', 0, 0)])),
      0,
    );

    expect(scene.cones[0]).toMatchObject({ rayon: 150 });
    expect(scene.cones[0]?.demiOuverture).toBeCloseTo(Math.PI / 3);
  });
});

describe('couleurEnNombre', () => {
  it('convertit une couleur du contrat en nombre', () => {
    expect(couleurEnNombre('#FF0000')).toBe(0xff0000);
    expect(couleurEnNombre('00FF00')).toBe(0x00ff00);
  });

  it('rend du blanc plutot que de casser sur une couleur illisible', () => {
    // Une couleur absente ou mal formee ne doit pas faire disparaitre une entite
    // de l'ecran: mieux vaut un ninja blanc qu'un ninja invisible.
    expect(couleurEnNombre('pas-une-couleur')).toBe(0xffffff);
  });
});

describe("l'Evade dans la scene (etape 7.9)", () => {
  const evade: EntiteVue = {
    type: 'evade',
    id: 'evade-3',
    x: 400,
    y: 300,
    couleur: '#E3262E',
    direction: 'est',
  };

  it('dessine l Evade raye, non teinte, dans un halo rouge et blanc', () => {
    const scene = construireScene(etatEnJeu('moi'), lissee(vue([joueur('moi', 0, 0), evade])), 0);
    const sprite = scene.entites.find((entite) => entite.id === 'evade-3');
    const halo = scene.disques.find((disque) => disque.id === 'evade-3:halo');

    expect(sprite?.texture).toBe(adresseRayee(`${RACINE_RESSOURCES}/${cheminNinja('est', 1)}`));
    expect(sprite?.teinte).toBe(0xffffff);
    expect(halo?.remplissage).toEqual(APPARENCE_EVADE.halo.teinte);
    expect(halo?.contour).toEqual(APPARENCE_EVADE.cerne);
  });

  it('marque le porteur du x2, et lui seul, a sa position affichee', () => {
    const porteur = { ...joueur('bob', 250, 260), doubleur: true } as EntiteVue;
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([joueur('moi', 0, 0), porteur])),
      APPARENCE_EVADE.marque.tourMs / 4,
    );

    expect(scene.marques).toEqual([{ id: 'bob:x2', x: 250, y: 260, rotation: Math.PI / 2 }]);
  });

  it('ne marque personne sans x2', () => {
    const scene = construireScene(etatEnJeu('moi'), lissee(vue([joueur('moi', 0, 0)])), 0);

    expect(scene.marques).toEqual([]);
  });
});

describe('les impacts de tir sur un bot noir (revision du 3 octobre 2026)', () => {
  /** Un coup porte a ce bot noir, a cet instant. */
  function coup(coups: number, instant: number): FaitDeJeu {
    return fait(
      'botNoirTouche',
      { botNoir: 'noir', x: 100, y: 100, coups, coupsRequis: 3 },
      instant,
    );
  }

  it('dessine un eclat et un anneau pendant sa duree seulement', () => {
    const partie = lissee(vue([joueur('moi', 300, 300), bot('noir', 120, 130, 'botNoir')]));
    const etat = { ...etatEnJeu('moi'), journal: [coup(1, 1000)] };

    const pendant = construireScene(etat, partie, 1100);
    expect(pendant.impacts.map((disque) => disque.id.split(':')[2])).toEqual(['eclat', 'anneau']);
    expect(pendant.impacts[1]?.contour?.couleur).toBe(APPARENCE_IMPACT_BOT_NOIR.anneau);

    expect(construireScene(etat, partie, 1000 + APPARENCE_IMPACT_BOT_NOIR.dureeMs).impacts).toEqual(
      [],
    );
    expect(construireScene(etat, partie, 999).impacts).toEqual([]);
  });

  it('suit le bot noir, et reste ou le coup a porte quand il n est plus la', () => {
    const etat = { ...etatEnJeu('moi'), journal: [coup(1, 1000)] };

    const avecLeBot = construireScene(
      etat,
      lissee(vue([joueur('moi', 300, 300), bot('noir', 120, 130, 'botNoir')])),
      1100,
    );
    expect([avecLeBot.impacts[0]?.x, avecLeBot.impacts[0]?.y]).toEqual([120, 130]);

    const sansLeBot = construireScene(etat, lissee(vue([joueur('moi', 300, 300)])), 1100);
    expect([sansLeBot.impacts[0]?.x, sansLeBot.impacts[0]?.y]).toEqual([100, 100]);
  });

  it('elargit plus l anneau du deuxieme coup que celui du premier', () => {
    const partie = lissee(vue([joueur('moi', 300, 300), bot('noir', 120, 130, 'botNoir')]));
    const anneau = (coups: number): number =>
      construireScene({ ...etatEnJeu('moi'), journal: [coup(coups, 1000)] }, partie, 1300)
        .impacts[1]?.rayon ?? 0;

    expect(anneau(2)).toBeGreaterThan(anneau(1));
  });
});

describe('les nuages de fumee (etape 7.10)', () => {
  /** Une fuite de ce joueur, arrivee a cet instant. */
  function fuite(joueurId: string, instant: number): FaitDeJeu {
    return fait(
      'fumee',
      { joueur: joueurId, depart: { x: 100, y: 100 }, arrivee: { x: 900, y: 700 } },
      instant,
    );
  }

  /** Les centres des nuages d'une scene: le lobe central de chacun. */
  function centres(fumees: ReturnType<typeof construireScene>['fumees']): string[] {
    return fumees
      .filter((disque) => disque.id.endsWith(':brume6'))
      .map((disque) => `${String(disque.x)},${String(disque.y)}`);
  }

  it('pose un nuage au depart et un plus petit a l arrivee, pendant sa vie seulement', () => {
    const partie = lissee(vue([joueur('moi', 300, 300)]));
    const etat = { ...etatEnJeu('moi'), journal: [fuite('bob', 1000)] };

    const pendant = construireScene(etat, partie, 1200);
    expect(centres(pendant.fumees)).toEqual(['100,100', '900,700']);

    const depart = pendant.fumees.find((disque) => disque.id.endsWith(':depart:brume6'));
    const arrivee = pendant.fumees.find((disque) => disque.id.endsWith(':arrivee:brume6'));
    expect(arrivee?.rayon).toBeCloseTo((depart?.rayon ?? 0) * APPARENCE_FUMEE.echelleArrivee, 6);

    expect(construireScene(etat, partie, 1000 + APPARENCE_FUMEE.dureeDepartMs).fumees).toEqual([]);
    expect(construireScene(etat, partie, 999).fumees).toEqual([]);
  });

  it('laisse trainer le nuage de depart plus longtemps que celui d arrivee', () => {
    // Demande a la recette de l'etape 7.10: plus longtemps au depart, un peu plus a
    // l'arrivee, contre 600 millisecondes aux deux avant.
    expect(APPARENCE_FUMEE.dureeDepartMs).toBeGreaterThan(APPARENCE_FUMEE.dureeArriveeMs);
    expect(APPARENCE_FUMEE.dureeArriveeMs).toBeGreaterThan(600);

    const partie = lissee(vue([joueur('moi', 300, 300)]));
    const etat = { ...etatEnJeu('moi'), journal: [fuite('bob', 0)] };

    const entreLesDeux = construireScene(etat, partie, APPARENCE_FUMEE.dureeArriveeMs);
    expect(centres(entreLesDeux.fumees)).toEqual(['100,100']);
    expect(
      centres(construireScene(etat, partie, APPARENCE_FUMEE.dureeArriveeMs - 1).fumees),
    ).toEqual(['100,100', '900,700']);
    expect(
      centres(construireScene(etat, partie, APPARENCE_FUMEE.dureeDepartMs - 1).fumees),
    ).toEqual(['100,100']);
  });

  it('cache le nuage d un autre joueur dans une zone d invisibilite, pas le notre', () => {
    const zone: ZoneVue = {
      id: 'zone-1',
      type: 'invisibilite',
      x: 100,
      y: 100,
      rayon: 50,
      dureeRestanteMs: 5_000,
    };
    const partie = lissee(vue([joueur('moi', 300, 300)], [], [zone]));

    const autre = construireScene({ ...etatEnJeu('moi'), journal: [fuite('bob', 0)] }, partie, 100);
    const mien = construireScene({ ...etatEnJeu('moi'), journal: [fuite('moi', 0)] }, partie, 100);

    expect(centres(autre.fumees)).toEqual(['900,700']);
    expect(centres(mien.fumees)).toEqual(['100,100', '900,700']);
  });

  it('gonfle, reste plein, puis palit, et ses bouffees montent a la fin', () => {
    const debut = nuage('n', 0, 0, 100, 1000, 1);
    const plein = nuage('n', 0, 0, 400, 1000, 1);
    const fin = nuage('n', 0, 0, 900, 1000, 1);
    const lobe = (disques: typeof debut) => disques.find((disque) => disque.id === 'n:brume6');

    expect(lobe(debut)?.rayon).toBeLessThan(lobe(plein)?.rayon ?? 0);
    expect(lobe(plein)?.remplissage?.alpha).toBe(1);
    expect(lobe(fin)?.remplissage?.alpha).toBeLessThan(0.4);
    expect(debut.some((disque) => disque.id.includes('bouffee'))).toBe(false);
    expect(fin.filter((disque) => disque.id.includes('bouffee'))).toHaveLength(3);
  });

  it('gonfle aussi vite quelle que soit sa duree de vie, et tient plus longtemps s il dure', () => {
    const lobe = (disques: ReturnType<typeof nuage>) =>
      disques.find((disque) => disque.id === 'n:brume6');
    const court = nuage('n', 0, 0, APPARENCE_FUMEE.gonflementMs, 600, 1);
    const long = nuage('n', 0, 0, APPARENCE_FUMEE.gonflementMs, 1800, 1);

    expect(lobe(court)?.rayon).toBe(lobe(long)?.rayon);
    expect(lobe(nuage('n', 0, 0, 500, 600, 1))?.remplissage?.alpha).toBeLessThan(1);
    expect(lobe(nuage('n', 0, 0, 500, 1800, 1))?.remplissage?.alpha).toBe(1);
  });

  it('n a aucun nuage dans une scene vide', () => {
    expect(SCENE_VIDE.fumees).toEqual([]);
  });
});

describe('les mines (etape 7.11)', () => {
  const mine = (avantExplosionMs?: number): EntiteVue => ({
    type: 'mine',
    id: 'mine-7',
    x: 300,
    y: 300,
    couleur: '#00FF00',
    direction: 'immobile',
    poseur: 'bob',
    ...(avantExplosionMs === undefined ? {} : { avantExplosionMs }),
  });

  it('ne dessine pas une mine en personnage', () => {
    const scene = construireScene(etatEnJeu('moi'), lissee(vue([joueur('moi', 0, 0), mine()])), 0);

    expect(scene.entites.map((sprite) => sprite.id)).toEqual(['moi']);
  });

  it('pose une mine armee au sol, rayon compris, pour tous', () => {
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([joueur('moi', 0, 0), mine(800)])),
      0,
    );

    expect(scene.mines.disques.map((disque) => disque.id)).toContain('mine-7:rayon');
    expect(scene.explosions).toEqual([]);
  });

  it('n a aucune mine dans une scene vide', () => {
    expect(SCENE_VIDE.mines.disques).toEqual([]);
    expect(SCENE_VIDE.explosions).toEqual([]);
  });
});

describe('les mines de zone (etape 7.12)', () => {
  const mineDeZone = (avantOuvertureMs?: number): EntiteVue => ({
    type: 'mineDeZone',
    id: 'mineDeZone-3',
    x: 500,
    y: 400,
    couleur: '#FFFFFF',
    direction: 'immobile',
    nature: 'attraction',
    ...(avantOuvertureMs === undefined ? {} : { avantOuvertureMs }),
  });

  it('ne dessine pas une mine de zone en personnage, mais au sol, pour tous', () => {
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([joueur('moi', 0, 0), mineDeZone()])),
      0,
    );

    expect(scene.entites.map((sprite) => sprite.id)).toEqual(['moi']);
    expect(scene.zones.map((zone) => zone.id)).toEqual(['mineDeZone-3']);
  });

  it('pose les mines de zone par-dessus les zones', () => {
    const zone: ZoneVue = {
      id: 'zone-1',
      type: 'chaos',
      x: 500,
      y: 400,
      rayon: 220,
      dureeRestanteMs: 9_000,
    };
    const scene = construireScene(
      etatEnJeu('moi'),
      lissee(vue([joueur('moi', 0, 0), mineDeZone(1_000)], [], [zone])),
      0,
    );

    expect(scene.zones.map((element) => element.id)).toEqual(['zone-1', 'mineDeZone-3']);
  });
});
