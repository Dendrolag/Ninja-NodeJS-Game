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
import { OBJETS, REGLAGES_PAR_DEFAUT, TACTIQUE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EffetActif, EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import type { FaitDeJeu } from '../faits.js';
import { fait } from '../faits.js';
import type { VuePartie } from '../reconstruction.js';
import type { VueLissee } from './interpolation.js';
import { SCENE_VIDE, construireScene, couleurEnNombre } from './scene.js';

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
    };

    const scene = construireScene(etatEnJeu('moi'), glissee, 0);

    expect(scene.entites[0]?.x).toBe(42);
    expect(scene.entites[0]?.y).toBe(84);
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
      { categorie: 'bonus', nature: 'vitesse', finPrevueA: 10_000 },
      { categorie: 'bonus', nature: 'invincibilite', finPrevueA: 10_000 },
    ];

    const scene = construireScene(etatEnJeu('moi', effets), lissee(vue([joueur('moi', 0, 0)])), 0);

    expect(scene.disques.map((disque) => disque.id)).toContain('moi:vitesse');
    expect(scene.disques.map((disque) => disque.id)).toContain('moi:invincibilite');
  });

  it('ignore un bonus dont la duree est deja passee', () => {
    const effets: readonly EffetActif[] = [
      { categorie: 'bonus', nature: 'vitesse', finPrevueA: 1_000 },
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
      { categorie: 'bonus', nature: 'revelation', finPrevueA: 10_000 },
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

  it('decrit chaque zone avec sa couleur et son libelle', () => {
    const zone: ZoneVue = {
      id: 'zone-1',
      type: 'chaos',
      x: 100,
      y: 100,
      rayon: 60,
      dureeRestanteMs: 5_000,
    };

    const scene = construireScene(etatEnJeu('moi'), lissee(vue([], [], [zone])), 0);

    expect(scene.zones).toHaveLength(1);
    expect(scene.zones[0]?.libelle).toBe('Zone de chaos');
    expect(scene.zones[0]?.rayon).toBe(60);
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
