/**
 * Tests du flux d'etat binaire.
 *
 * Trois garanties, dans l'ordre de leur importance.
 *
 *   1. LA RECONSTRUCTION EST EXACTE. Une image, puis n'importe quelle suite de
 *      deltas, redonnent exactement l'instantane arrondi que le serveur a code,
 *      battement apres battement. C'est verifie sur une longue partie tiree au
 *      hasard, ou des entites bougent, changent, apparaissent, disparaissent et
 *      changent d'ordre.
 *   2. UN DELTA NE S'APPLIQUE JAMAIS A LA MAUVAISE PARTIE. Sans la trame qu'il
 *      suppose, il est ignore au lieu de fabriquer un etat faux.
 *   3. UNE TRAME FAUSSE EST REFUSEE, et une valeur que le format ne sait pas coder
 *      aussi, au lieu de partir ou d'etre lue de travers.
 */

import { describe, expect, it } from 'vitest';

import { creerAlea, entier, nombre } from './alea.js';
import type { Alea } from './alea.js';
import {
  COULEURS_JOUEURS,
  DIRECTIONS,
  TYPES_BONUS,
  TYPES_MALUS,
  TYPES_ZONE,
} from './constantes.js';
import type { EntiteVue, InstantanePartie, JoueurVu, LigneClassement } from './evenements.js';
import {
  ErreurDeTrame,
  SUBDIVISIONS_DU_PIXEL,
  appliquerTrame,
  encoderDelta,
  encoderImage,
  lireEnTete,
  quantifierInstantane,
} from './flux.js';

/** Un generateur a graine que l'on tire sans se soucier de le faire suivre. */
function tirages(graine: number): {
  nombre: () => number;
  entier: (borne: number) => number;
  element: <T>(liste: readonly T[]) => T;
} {
  let alea: Alea = creerAlea(graine);

  return {
    nombre: () => {
      const tirage = nombre(alea);
      alea = tirage.alea;
      return tirage.valeur;
    },
    entier: (borne) => {
      const tirage = entier(alea, borne);
      alea = tirage.alea;
      return tirage.valeur;
    },
    element: (liste) => {
      const tirage = entier(alea, liste.length);
      alea = tirage.alea;
      return liste[tirage.valeur] as (typeof liste)[number];
    },
  };
}

/** Un instantane vide, a completer. */
function instantane(modifications: Partial<InstantanePartie> = {}): InstantanePartie {
  return {
    tick: 1,
    tempsRestantMs: 180_000,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement: [],
    ...modifications,
  };
}

function joueur(id: string, x: number, y: number, modifications: Partial<JoueurVu> = {}): JoueurVu {
  return {
    id,
    type: 'joueur',
    x,
    y,
    couleur: '#FF0000',
    direction: 'est',
    pseudo: id,
    invincible: false,
    protege: false,
    ...modifications,
  };
}

function bot(id: string, x: number, y: number, type: 'bot' | 'botNoir' = 'bot'): EntiteVue {
  return { id, type, x, y, couleur: '#FFFFFF', direction: 'nord' };
}

function ligne(id: string, points: number): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur: '#00FF00',
    points,
    botsPortes: points,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

/**
 * Une partie qui evolue au hasard, battement apres battement, avec tout ce qu'un
 * vrai serveur produit: des positions a virgule, des durees qui ne tombent pas
 * rond, des couleurs quelconques, des joueurs qui arrivent au milieu de la liste,
 * des bots qui disparaissent, un classement qui se reordonne.
 */
function* partieAuHasard(graine: number, battements: number): Generator<InstantanePartie> {
  const hasard = tirages(graine);
  const identifiant = (): string =>
    Array.from({ length: 20 }, () =>
      hasard.element([...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_']),
    ).join('');
  const couleur = (): string =>
    hasard.nombre() < 0.7
      ? hasard.element(COULEURS_JOUEURS)
      : `#${hasard.entier(0x1000000).toString(16).padStart(6, '0')}`;

  let joueurs: JoueurVu[] = Array.from({ length: 12 }, (_, rang) =>
    joueur(identifiant(), 100 + rang * 150, 400, { pseudo: `Joueur ${String(rang)} é🙂` }),
  );
  let bots: EntiteVue[] = Array.from({ length: 150 }, (_, rang) =>
    bot(`bot-${String(rang)}`, hasard.nombre() * 2000, hasard.nombre() * 1500),
  );
  let objets: InstantanePartie['objets'] = [];
  let zones: InstantanePartie['zones'] = [];
  let compteur = 0;
  let tempsRestantMs = 180_000;
  let enPause = false;

  for (let tick = 1; tick <= battements; tick += 1) {
    const dt = 45 + hasard.nombre() * 10;
    tempsRestantMs = Math.max(tempsRestantMs - dt, 0);

    if (tick % 97 === 0) enPause = !enPause;

    bots = bots.map((entite) => {
      if (hasard.nombre() < 0.4) return entite;

      return {
        ...entite,
        x: entite.x + (hasard.nombre() - 0.5) * 10,
        y: entite.y + (hasard.nombre() - 0.5) * 10,
        couleur: hasard.nombre() < 0.03 ? couleur() : entite.couleur,
        direction: hasard.nombre() < 0.05 ? hasard.element(DIRECTIONS) : entite.direction,
      };
    });

    joueurs = joueurs.map((entite) => ({
      ...entite,
      x: entite.x + (hasard.nombre() - 0.5) * 30,
      y: entite.y + (hasard.nombre() - 0.5) * 30,
      invincible: hasard.nombre() < 0.02 ? !entite.invincible : entite.invincible,
      protege: hasard.nombre() < 0.02 ? !entite.protege : entite.protege,
      couleur: hasard.nombre() < 0.01 ? couleur() : entite.couleur,
    }));

    if (tick % 37 === 0) bots = [...bots, bot(`botNoir-${String(tick)}`, 1000, 750, 'botNoir')];
    if (tick % 53 === 0) {
      const disparu = hasard.entier(bots.length);
      bots = bots.filter((_, rang) => rang !== disparu);
    }
    if (tick % 71 === 0) joueurs = joueurs.slice(1);
    if (tick % 89 === 0) joueurs = [...joueurs, joueur(identifiant(), 500.3, 500.7)];
    // Un identifiant repris par un element d'une autre nature: un nouveau, pas une modification.
    if (tick % 131 === 0 && bots[0] !== undefined) {
      bots = [{ ...bots[0], type: 'botNoir' }, ...bots.slice(1)];
    }

    if (hasard.nombre() < 0.05) {
      compteur += 1;
      const bonus = hasard.nombre() < 0.5;
      objets = [
        ...objets,
        {
          id: `${bonus ? 'bonus' : 'malus'}-${String(compteur)}`,
          categorie: bonus ? 'bonus' : 'malus',
          nature: bonus ? hasard.element(TYPES_BONUS) : hasard.element(TYPES_MALUS),
          x: hasard.nombre() * 2000,
          y: hasard.nombre() * 1500,
          dureeDeVieRestanteMs: 8000,
        },
      ];
    }
    objets = objets
      .map((objet) => ({ ...objet, dureeDeVieRestanteMs: objet.dureeDeVieRestanteMs - dt }))
      .filter((objet) => objet.dureeDeVieRestanteMs > 0);

    if (hasard.nombre() < 0.02 && zones.length < 3) {
      compteur += 1;
      zones = [
        ...zones,
        {
          id: `zone-${String(compteur)}`,
          type: hasard.element(TYPES_ZONE),
          x: hasard.nombre() * 2000,
          y: hasard.nombre() * 1500,
          rayon: 150 + hasard.nombre() * 200,
          dureeRestanteMs: 20_000,
        },
      ];
    }
    zones = zones
      .map((zone) => ({ ...zone, dureeRestanteMs: zone.dureeRestanteMs - dt }))
      .filter((zone) => zone.dureeRestanteMs > 0);

    const classement = joueurs
      .map((entite, rang) => ({
        ...ligne(entite.id, (tick * (rang + 1)) % 40),
        pseudo: entite.pseudo,
        couleur: entite.couleur,
        captures: Math.floor(tick / 100),
      }))
      .sort((premier, second) => second.points - premier.points);

    yield {
      tick,
      tempsRestantMs,
      enPause,
      entites: [...joueurs, ...bots],
      objets,
      zones,
      classement,
    };
  }
}

describe('quantifierInstantane', () => {
  it('arrondit les positions au huitieme de pixel, les durees a la milliseconde, les couleurs en majuscules', () => {
    const arrondi = quantifierInstantane(
      instantane({
        tempsRestantMs: 179_950.4,
        entites: [joueur('a', 10.06, 20.2, { couleur: '#ff00aa' })],
        objets: [
          {
            id: 'o',
            categorie: 'bonus',
            nature: 'vitesse',
            x: 1.3,
            y: 2.99,
            dureeDeVieRestanteMs: 7_999.6,
          },
        ],
      }),
    );

    expect(SUBDIVISIONS_DU_PIXEL).toBe(8);
    expect(arrondi.tempsRestantMs).toBe(179_950);
    expect(arrondi.entites[0]).toMatchObject({ x: 10, y: 20.25, couleur: '#FF00AA' });
    expect(arrondi.objets[0]).toMatchObject({ x: 1.25, y: 3, dureeDeVieRestanteMs: 8_000 });
  });

  it('ne change rien a un instantane deja arrondi', () => {
    const une = quantifierInstantane([...partieAuHasard(1, 20)].at(-1) as InstantanePartie);

    expect(quantifierInstantane(une)).toEqual(une);
  });

  it('refuse une valeur que le format ne sait pas coder', () => {
    expect(() =>
      quantifierInstantane(instantane({ entites: [bot('b', Number.NaN, 0)] })),
    ).toThrow();
    expect(() =>
      quantifierInstantane(instantane({ entites: [bot('b', Number.POSITIVE_INFINITY, 0)] })),
    ).toThrow();
    expect(() =>
      quantifierInstantane(
        instantane({ entites: [{ ...bot('b', 0, 0), direction: 'haut' as never }] }),
      ),
    ).toThrow();
    expect(() =>
      quantifierInstantane(instantane({ entites: [{ ...bot('b', 0, 0), couleur: 'rouge' }] })),
    ).toThrow();
    expect(() => quantifierInstantane(instantane({ tempsRestantMs: -1 }))).toThrow();
  });
});

describe('image', () => {
  it('redonne exactement l instantane arrondi', () => {
    const une = [...partieAuHasard(2, 30)].at(-1) as InstantanePartie;
    const codee = encoderImage(une);

    expect(appliquerTrame(undefined, codee.octets)).toEqual(quantifierInstantane(une));
    expect(codee.reference).toEqual(quantifierInstantane(une));
  });

  it('s applique quelle que soit la partie detenue', () => {
    const [premiere, seconde] = [...partieAuHasard(3, 2)] as [InstantanePartie, InstantanePartie];
    const detenue = quantifierInstantane(seconde);

    expect(appliquerTrame(detenue, encoderImage(premiere).octets)).toEqual(
      quantifierInstantane(premiere),
    );
  });

  it('pese bien moins que le JSON pour une partie pleine', () => {
    const pleine = [...partieAuHasard(4, 5)].at(-1) as InstantanePartie;
    const json = JSON.stringify(pleine).length;

    expect(encoderImage(pleine).octets.length).toBeLessThan(json / 3);
  });

  it('garde a l identique pseudos accentues, emojis et couleurs quelconques', () => {
    const une = instantane({
      entites: [joueur('😀', 1, 2, { pseudo: 'Zoé 🥷 ß中', couleur: '#0A0B0C' })],
      classement: [{ ...ligne('😀', 3), pseudo: 'Zoé 🥷 ß中', couleur: '#ABCDEF' }],
    });

    expect(appliquerTrame(undefined, encoderImage(une).octets)).toEqual(quantifierInstantane(une));
  });
});

describe('delta', () => {
  it('reconstruit chaque battement d une longue partie a partir d une seule image', () => {
    let referenceServeur: InstantanePartie | undefined;
    let partieClient: InstantanePartie | undefined;
    let battements = 0;

    for (const courant of partieAuHasard(5, 600)) {
      const codee =
        referenceServeur === undefined
          ? encoderImage(courant)
          : encoderDelta(referenceServeur, courant);
      referenceServeur = codee.reference;
      partieClient = appliquerTrame(partieClient, codee.octets);

      expect(partieClient).toEqual(quantifierInstantane(courant));
      battements += 1;
    }

    expect(battements).toBe(600);
  });

  it('reprend exactement apres une image recue en cours de partie', () => {
    let referenceServeur: InstantanePartie | undefined;
    let arrive: InstantanePartie | undefined;

    for (const courant of partieAuHasard(6, 300)) {
      const delta =
        referenceServeur === undefined ? undefined : encoderDelta(referenceServeur, courant);
      const image = encoderImage(courant);
      referenceServeur = (delta ?? image).reference;

      // Le nouveau venu recoit le delta de la salle avant son image: il l'ignore.
      if (courant.tick === 150) {
        expect(delta).toBeDefined();
        expect(appliquerTrame(undefined, (delta as { octets: Uint8Array }).octets)).toBeUndefined();
        arrive = appliquerTrame(undefined, image.octets);
      } else if (arrive !== undefined && delta !== undefined) {
        arrive = appliquerTrame(arrive, delta.octets);
      }

      if (courant.tick >= 150) {
        expect(arrive).toEqual(quantifierInstantane(courant));
      }
    }
  });

  it('ne pese que quelques octets quand rien n a change', () => {
    const une = [...partieAuHasard(7, 3)].at(-1) as InstantanePartie;
    const reference = encoderImage(une).reference;

    const delta = encoderDelta(reference, { ...une, tick: une.tick + 1 });

    // L'en-tete, puis pour chacune des quatre listes sa taille, son ordre et zero
    // changement.
    expect(delta.octets.length).toBeLessThan(24);
    expect(appliquerTrame(reference, delta.octets)).toEqual({ ...reference, tick: une.tick + 1 });
  });

  it('pese bien moins qu une image quand les bots bougent', () => {
    const [avant, apres] = [...partieAuHasard(8, 2)] as [InstantanePartie, InstantanePartie];
    const reference = encoderImage(avant).reference;

    expect(encoderDelta(reference, apres).octets.length).toBeLessThan(
      encoderImage(apres).octets.length / 3,
    );
  });

  it('suit un joueur qui arrive au milieu de la liste et un bot qui disparait', () => {
    const avant = instantane({
      tick: 10,
      entites: [joueur('a', 1, 1), bot('b1', 2, 2), bot('b2', 3, 3)],
    });
    const apres = instantane({
      tick: 11,
      entites: [joueur('a', 1, 1), joueur('n', 9, 9), bot('b2', 3.5, 3)],
    });
    const reference = encoderImage(avant).reference;

    expect(appliquerTrame(reference, encoderDelta(reference, apres).octets)).toEqual(
      quantifierInstantane(apres),
    );
  });

  it('suit un classement qui se reordonne et un score qui baisse', () => {
    const avant = instantane({ tick: 3, classement: [ligne('a', 10), ligne('b', 5)] });
    const apres = instantane({ tick: 4, classement: [ligne('b', 12), ligne('a', 0)] });
    const reference = encoderImage(avant).reference;

    expect(appliquerTrame(reference, encoderDelta(reference, apres).octets)).toEqual(apres);
  });

  it('traite comme nouveau un identifiant repris par une entite d une autre nature', () => {
    const avant = instantane({ tick: 1, entites: [bot('x', 1, 1)] });
    const apres = instantane({ tick: 2, entites: [joueur('x', 1, 1)] });
    const reference = encoderImage(avant).reference;

    expect(appliquerTrame(reference, encoderDelta(reference, apres).octets)).toEqual(apres);
  });

  it('peut sauter des battements, si la reference est la bonne', () => {
    const avant = instantane({ tick: 5, entites: [bot('b', 1, 1)] });
    const apres = instantane({ tick: 9, entites: [bot('b', 4, 1)] });
    const reference = encoderImage(avant).reference;
    const delta = encoderDelta(reference, apres);

    expect(lireEnTete(delta.octets)).toEqual({ nature: 'delta', tick: 9, base: 5 });
    expect(appliquerTrame(reference, delta.octets)).toEqual(apres);
  });

  it('refuse de coder un delta qui ne suit pas sa reference', () => {
    const reference = encoderImage(instantane({ tick: 5 })).reference;

    expect(() => encoderDelta(reference, instantane({ tick: 5 }))).toThrow();
    expect(() => encoderDelta(reference, instantane({ tick: 4 }))).toThrow();
  });
});

describe('un delta ne s applique qu a sa reference', () => {
  const [premiere, seconde, troisieme] = [...partieAuHasard(9, 3)] as [
    InstantanePartie,
    InstantanePartie,
    InstantanePartie,
  ];
  const image = encoderImage(premiere);
  const delta = encoderDelta(image.reference, seconde);

  it('est ignore sans partie detenue', () => {
    expect(appliquerTrame(undefined, delta.octets)).toBeUndefined();
  });

  it('est ignore sur une partie d un autre battement', () => {
    const plusLoin = encoderDelta(delta.reference, troisieme).reference;

    expect(appliquerTrame(plusLoin, delta.octets)).toBeUndefined();
  });

  it('dit dans son en-tete le battement qu il suppose', () => {
    expect(lireEnTete(image.octets)).toEqual({ nature: 'image', tick: 1, base: undefined });
    expect(lireEnTete(delta.octets)).toEqual({ nature: 'delta', tick: 2, base: 1 });
  });
});

describe('les formes que le reseau rend', () => {
  const une = instantane({ tick: 4, entites: [bot('b', 10, 20)] });
  const octets = encoderImage(une).octets;

  it('lit un ArrayBuffer, comme dans un navigateur', () => {
    const tampon = new ArrayBuffer(octets.byteLength);
    new Uint8Array(tampon).set(octets);

    expect(appliquerTrame(undefined, tampon)).toEqual(une);
  });

  it('lit une vue qui ne commence pas au debut de son tampon, comme un Buffer de Node', () => {
    const large = new Uint8Array(octets.length + 7);
    large.set(octets, 5);

    expect(appliquerTrame(undefined, large.subarray(5, 5 + octets.length))).toEqual(une);
  });
});

describe('une trame fausse est refusee', () => {
  const [premiere, seconde] = [...partieAuHasard(10, 2)] as [InstantanePartie, InstantanePartie];
  const image = encoderImage(premiere);
  const delta = encoderDelta(image.reference, seconde);

  it('refuse une trame vide ou tronquee', () => {
    expect(() => appliquerTrame(undefined, new Uint8Array())).toThrow(ErreurDeTrame);

    for (const coupe of [1, 5, Math.floor(image.octets.length / 2), image.octets.length - 1]) {
      expect(() => appliquerTrame(undefined, image.octets.subarray(0, coupe))).toThrow(
        ErreurDeTrame,
      );
    }
  });

  it('refuse une autre version du format', () => {
    const autre = image.octets.slice();
    autre[0] = 6;

    expect(() => appliquerTrame(undefined, autre)).toThrow(ErreurDeTrame);
  });

  it('refuse des octets en trop', () => {
    const allongee = new Uint8Array(image.octets.length + 1);
    allongee.set(image.octets);

    expect(() => appliquerTrame(undefined, allongee)).toThrow(ErreurDeTrame);
  });

  it('refuse un delta dont le battement de reference precede zero', () => {
    // Nature delta, battement 1, ecart de 2.
    expect(() => appliquerTrame(undefined, Uint8Array.of(3, 1, 2))).toThrow(ErreurDeTrame);
  });

  it('refuse un code de liste fermee hors de la liste', () => {
    // Image, battement 1, 1000 ms, sans pause, une entite nouvelle de type inconnu.
    const trame = Uint8Array.of(2, 1, 0xe8, 0x07, 0, 1, 1, 1, 0, 1, 0x62, 9);

    expect(() => appliquerTrame(undefined, trame)).toThrow(ErreurDeTrame);
  });

  it('ne leve jamais autre chose qu une ErreurDeTrame sur des octets alteres', () => {
    const hasard = tirages(11);

    for (let essai = 0; essai < 300; essai += 1) {
      const alteree = delta.octets.slice();
      alteree[hasard.entier(alteree.length)] = hasard.entier(256);

      try {
        appliquerTrame(image.reference, alteree);
      } catch (erreur) {
        expect(erreur).toBeInstanceOf(ErreurDeTrame);
      }
    }
  });
});
