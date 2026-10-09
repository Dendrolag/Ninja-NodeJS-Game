/**
 * Tests des chemins de ressources.
 *
 * Ils ont l'air modestes, et ils protegent de la panne la plus penible a
 * diagnostiquer d'un jeu: l'image qui ne s'affiche pas. Un chemin faux ne casse
 * rien, ne leve rien, et se voit seulement a l'ecran, sous la forme d'un trou.
 *
 * Deux d'entre eux vont plus loin et verifient que les fichiers annonces
 * EXISTENT VRAIMENT sur le disque. Sans eux, une ressource oubliee au
 * rapatriement ne se decouvrirait qu'a l'etape 4.3, quand une page les demande.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CARTES,
  TYPES_BONUS,
  TYPES_BONUS_TACTIQUES,
  TYPES_MALUS,
  TYPES_MALUS_TACTIQUES,
  TYPES_OBJETS_DE_POCHE,
} from './constantes.js';
import {
  IMAGES_DE_PLUIE,
  MUSIQUES,
  MUSIQUES_DE_PARTIE,
  RACINE_RESSOURCES,
  SONS,
  SONS_DE_PAS,
  SONS_EN_BOUCLE,
  cheminApercuCarte,
  cheminAvantPlan,
  cheminAvantPlanDeNuit,
  cheminCarte,
  cheminNinja,
  cheminObjet,
  cheminFondDeNuit,
  cheminLointain,
  cheminPluie,
  cheminSon,
  cheminVaisseau,
  musiqueDeLaPartie,
  tousLesNinjas,
  tousLesObjets,
} from './ressources.js';

/** Le dossier assets du depot, retrouve depuis ce fichier de test. */
const RACINE_DISQUE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets');

/** Largeur et hauteur d'une image PNG, lues dans son en-tete. */
function dimensionsPng(relatif: string): { largeur: number; hauteur: number } {
  const octets = readFileSync(join(RACINE_DISQUE, relatif));

  // Signature de huit octets, longueur et nom du bloc IHDR, puis largeur et hauteur.
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

describe('cheminCarte', () => {
  it('range les trois couches par carte, une seule fois pour les deux sens', () => {
    // Le miroir se calcule depuis l'etape 8.3: plus de dossier normal ni mirror.
    expect(cheminCarte('map1', 'background')).toBe('cartes/map1/background.png');
    expect(cheminCarte('map1', 'collision')).toBe('cartes/map1/collision.png');
    expect(cheminCarte('map3', 'foreground')).toBe('cartes/map3/foreground.png');
  });
});

describe('cheminPluie', () => {
  it('donne un chemin pour la seule carte qui a de la pluie', () => {
    expect(cheminPluie('map1')).toBe('cartes/map1/rain.png');
  });

  it('ne donne rien pour les cartes sans pluie', () => {
    // Le jeu d'origine demandait rain.png pour toutes les cartes et recevait
    // trois erreurs de chargement sur quatre. Rendre l'absence explicite evite
    // la demande.
    expect(cheminPluie('map3')).toBeUndefined();
    expect(cheminPluie('quartier')).toBeUndefined();
  });

  it('se decoupe en IMAGES_DE_PLUIE images, chacune de la taille des couches de sa carte', () => {
    // RainEffect (legacy/js/MapManager.js:13): une planche de 9000 pixels de large,
    // trois images de 3000 par 2000. Le rendu la decoupe avant de l'envoyer a la
    // carte graphique, les telephones refusant souvent une texture aussi large.
    const planche = dimensionsPng(cheminPluie('map1') as string);
    const fond = dimensionsPng(cheminCarte('map1', 'background'));

    expect(planche.largeur).toBe(fond.largeur * IMAGES_DE_PLUIE);
    expect(planche.hauteur).toBe(fond.hauteur);
  });
});

describe('cheminLointain', () => {
  it('donne un chemin pour la seule carte qui a un lointain (etape 8.8)', () => {
    expect(cheminLointain('map3')).toBe('cartes/map3/background-parallax.png');
  });

  it('ne donne rien pour les cartes sans lointain', () => {
    expect(cheminLointain('map1')).toBeUndefined();
    expect(cheminLointain('quartier')).toBeUndefined();
  });

  it('a la taille des couches de sa carte', () => {
    expect(dimensionsPng(cheminLointain('map3') as string)).toEqual(
      dimensionsPng(cheminCarte('map3', 'background')),
    );
  });
});

describe('cheminAvantPlan', () => {
  it('donne l avant-plan des cartes qui en ont un', () => {
    expect(cheminAvantPlan('map1')).toBe('cartes/map1/foreground.png');
    expect(cheminAvantPlan('map3')).toBe('cartes/map3/foreground.png');
    expect(cheminAvantPlan('quartier')).toBe('cartes/quartier/foreground.png');
  });

  it('ne donne rien pour la Station lunaire, que seul le vaisseau survole (etape 8.9)', () => {
    expect(cheminAvantPlan('station')).toBeUndefined();
  });
});

describe('cheminFondDeNuit', () => {
  it('donne le fond de nuit des cartes qui en ont un (etapes 8.9 et 8.11)', () => {
    expect(cheminFondDeNuit('station')).toBe('cartes/station/background-night.png');
    expect(cheminFondDeNuit('prison')).toBe('cartes/prison/background-night.png');
  });

  it('ne donne rien pour les autres cartes', () => {
    expect(cheminFondDeNuit('map1')).toBeUndefined();
    expect(cheminFondDeNuit('map3')).toBeUndefined();
    expect(cheminFondDeNuit('quartier')).toBeUndefined();
  });

  it('a la taille du fond de jour, qui a celle de la carte', () => {
    const jour = dimensionsPng(cheminCarte('station', 'background'));

    expect(dimensionsPng(cheminFondDeNuit('station') as string)).toEqual(jour);
    expect(jour).toEqual(CARTES.station);
  });
});

describe('cheminAvantPlanDeNuit', () => {
  it('donne l avant-plan de nuit de la seule carte qui en a un (etape 8.11)', () => {
    expect(cheminAvantPlanDeNuit('prison')).toBe('cartes/prison/foreground-night.png');
  });

  it('ne donne rien pour les autres cartes, Station lunaire comprise', () => {
    expect(cheminAvantPlanDeNuit('map1')).toBeUndefined();
    expect(cheminAvantPlanDeNuit('map3')).toBeUndefined();
    expect(cheminAvantPlanDeNuit('quartier')).toBeUndefined();
    expect(cheminAvantPlanDeNuit('station')).toBeUndefined();
  });
});

describe('les images de Prison Island (etape 8.11)', () => {
  it('ont toutes la taille du fond de jour, de jour comme de nuit', () => {
    const jour = dimensionsPng(cheminCarte('prison', 'background'));

    expect(dimensionsPng(cheminFondDeNuit('prison') as string)).toEqual(jour);
    expect(dimensionsPng(cheminAvantPlan('prison') as string)).toEqual(jour);
    expect(dimensionsPng(cheminAvantPlanDeNuit('prison') as string)).toEqual(jour);
  });

  it('ont les proportions de la carte, qui les agrandit de 30 pour cent sans les deformer', () => {
    // Le decor est livre a 1838 sur 1337, la carte en mesure 2390 sur 1738: les portes
    // du dessin livre etaient plus etroites qu'un ninja. L'agrandissement est le meme sur
    // les deux axes, a un pixel pres, pour que le decor reste sur les murs.
    const jour = dimensionsPng(cheminCarte('prison', 'background'));
    const echelleX = CARTES.prison.largeur / jour.largeur;
    const echelleY = CARTES.prison.hauteur / jour.hauteur;

    expect(Math.abs(echelleX - echelleY) * jour.largeur).toBeLessThan(1);
    expect(dimensionsPng(cheminCarte('prison', 'collision'))).toEqual(CARTES.prison);
  });
});

describe('cheminVaisseau', () => {
  it('donne le vaisseau de la seule carte qui en a un (etape 8.9)', () => {
    expect(cheminVaisseau('station')).toBe('cartes/station/spaceship.png');
  });

  it('ne donne rien pour les autres cartes', () => {
    expect(cheminVaisseau('map1')).toBeUndefined();
    expect(cheminVaisseau('map3')).toBeUndefined();
    expect(cheminVaisseau('quartier')).toBeUndefined();
  });
});

describe('cheminNinja', () => {
  it('traduit les directions du moteur en noms de fichiers du jeu', () => {
    expect(cheminNinja('nord', 1)).toBe('ninja/north_1.png');
    expect(cheminNinja('sud_ouest', 2)).toBe('ninja/south_west_2.png');
    expect(cheminNinja('est')).toBe('ninja/east_1.png');
  });

  it('donne une seule image a l immobilite', () => {
    expect(cheminNinja('immobile')).toBe('ninja/idle.png');
    expect(cheminNinja('immobile', 2)).toBe('ninja/idle.png');
  });

  it('enumere dix-sept sprites, sans doublon', () => {
    // Huit directions a deux images, plus l'immobilite qui n'en a qu'une.
    expect(tousLesNinjas()).toHaveLength(17);
    expect(new Set(tousLesNinjas()).size).toBe(17);
  });
});

describe('cheminObjet', () => {
  it('donne une icone a chaque bonus et a chaque malus', () => {
    expect(cheminObjet('vitesse')).toBe('objets/speed.png');
    expect(cheminObjet('invincibilite')).toBe('objets/shield.png');
    expect(cheminObjet('flou')).toBe('objets/blur.png');
  });

  it('dessine en SVG les six objets du Tactique', () => {
    expect(cheminObjet('rafale')).toBe('objets/rafale.svg');
    expect(cheminObjet('rechargeLente')).toBe('objets/recharge-lente.svg');
    expect(cheminObjet('viseeEtroite')).toBe('objets/visee-etroite.svg');
  });

  it('couvre les treize natures sans en oublier, fumee comprise (etape 7.10)', () => {
    const natures = [
      ...TYPES_BONUS,
      ...TYPES_MALUS,
      ...TYPES_BONUS_TACTIQUES,
      ...TYPES_MALUS_TACTIQUES,
      ...TYPES_OBJETS_DE_POCHE,
    ];

    expect(tousLesObjets()).toHaveLength(natures.length);
    expect(new Set(natures.map((nature) => cheminObjet(nature))).size).toBe(natures.length);
  });
});

describe('cheminSon', () => {
  it('range les sons dans leur dossier', () => {
    expect(cheminSon(SONS.bonusRamasse)).toBe('sons/collect-bonus.wav');
    expect(cheminSon(MUSIQUES.tokyoGarden)).toBe('sons/tokyo-garden.mp3');
    expect(cheminSon(MUSIQUES.menu)).toBe('sons/menu-music.mp3');
  });
});

describe('musiqueDeLaPartie', () => {
  it('fait tourner les trois musiques de partie selon la graine', () => {
    expect(MUSIQUES_DE_PARTIE.map((_, graine) => musiqueDeLaPartie(graine))).toEqual([
      'tokyoGarden',
      'infiltration',
      'tokyoByNight',
    ]);
    expect(musiqueDeLaPartie(3)).toBe('tokyoGarden');
  });

  it('donne la meme musique a toutes les pages d une meme graine', () => {
    expect(musiqueDeLaPartie(0xfffffffe)).toBe(musiqueDeLaPartie(0xfffffffe));
    expect(MUSIQUES_DE_PARTIE).toContain(musiqueDeLaPartie(0xffffffff));
  });

  it('ne joue jamais la musique des menus, meme sans graine ou d une graine negative', () => {
    expect(musiqueDeLaPartie(undefined)).toBe('tokyoGarden');
    expect(musiqueDeLaPartie(-1)).toBe('tokyoByNight');
    expect(musiqueDeLaPartie(2.7)).toBe('tokyoByNight');
  });

  it('se repartit a parts egales sur un grand nombre de parties', () => {
    const comptes = new Map<string, number>();

    for (let graine = 0; graine < 3000; graine += 1) {
      const piste = musiqueDeLaPartie(graine * 7919);
      comptes.set(piste, (comptes.get(piste) ?? 0) + 1);
    }

    expect([...comptes.values()]).toEqual([1000, 1000, 1000]);
  });
});

describe('les sons de la fumee et des mines', () => {
  it('sont ceux du porteur du projet, sans plus aucun son provisoire (etape 8.8)', () => {
    expect(SONS.fumee).toBe('bonus-escape-nuage.mp3');
    expect(SONS.minePosee).toBe('mine-pose.mp3');
    expect(SONS.mineArmee).toBe('activation-mine.mp3');
    expect(SONS.mineDeZoneArmee).toBe('activation-mine.mp3');
    expect(SONS.mineExplosee).toBe('explosion-mine.mp3');
    expect(SONS.zoneOuverte).toBe('explosion-mine-zone.mp3');
  });
});

describe('cheminApercuCarte', () => {
  it('range la vignette de chaque carte avec ses couches', () => {
    expect(cheminApercuCarte('map1')).toBe('cartes/map1/preview.png');
    expect(cheminApercuCarte('map3')).toBe('cartes/map3/preview.png');
  });
});

describe('les ressources annoncees existent sur le disque', () => {
  /** Verifie qu'un chemin relatif designe un fichier reellement present. */
  const present = (relatif: string): boolean => existsSync(join(RACINE_DISQUE, relatif));

  it('pour les cartes, leurs couches, et chacune de leurs couches facultatives', () => {
    const manquants: string[] = [];

    for (const carte of Object.keys(CARTES)) {
      for (const couche of ['background', 'collision'] as const) {
        const chemin = cheminCarte(carte, couche);
        if (!present(chemin)) {
          manquants.push(chemin);
        }
      }

      for (const optionnelle of [
        cheminAvantPlan(carte),
        cheminPluie(carte),
        cheminLointain(carte),
        cheminFondDeNuit(carte),
        cheminAvantPlanDeNuit(carte),
        cheminVaisseau(carte),
      ]) {
        if (optionnelle !== undefined && !present(optionnelle)) {
          manquants.push(optionnelle);
        }
      }
    }

    expect(manquants).toEqual([]);
  });

  it('sans aucun dossier d orientation: une carte se livre une fois', () => {
    // Etape 8.3. Un dossier mirror oublie la ou une carte nouvelle est livree ne
    // casserait rien, et ferait croire qu'il sert: le jeu ne le lirait jamais.
    const dossiers = readdirSync(join(RACINE_DISQUE, 'cartes'), { withFileTypes: true })
      .filter((entree) => entree.isDirectory())
      .flatMap((carte) =>
        readdirSync(join(RACINE_DISQUE, 'cartes', carte.name), { withFileTypes: true })
          .filter((entree) => entree.isDirectory())
          .map((entree) => `${carte.name}/${entree.name}`),
      );

    expect(dossiers).toEqual([]);
  });

  it('pour les sprites, les icones, les sons et la musique', () => {
    const attendus = [
      ...tousLesNinjas(),
      ...tousLesObjets(),
      ...Object.values(SONS).map((fichier) => cheminSon(fichier)),
      ...Object.values(SONS_EN_BOUCLE).map((fichier) => cheminSon(fichier)),
      ...SONS_DE_PAS.map((fichier) => cheminSon(fichier)),
      ...Object.values(MUSIQUES).map((fichier) => cheminSon(fichier)),
      ...Object.keys(CARTES).map((carte) => cheminApercuCarte(carte)),
    ];

    expect(attendus.filter((chemin) => !present(chemin))).toEqual([]);
  });
});

describe('RACINE_RESSOURCES', () => {
  it('est une adresse absolue, pour que le navigateur la resolve depuis n importe quel ecran', () => {
    expect(RACINE_RESSOURCES.startsWith('/')).toBe(true);
  });
});
