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

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TYPES_BONUS, TYPES_MALUS } from './constantes.js';
import {
  MUSIQUE_DE_JEU,
  RACINE_RESSOURCES,
  SONS,
  SONS_DE_PAS,
  SONS_EN_BOUCLE,
  cheminCarte,
  cheminNinja,
  cheminObjet,
  cheminPluie,
  cheminSon,
  tousLesNinjas,
  tousLesObjets,
} from './ressources.js';

/** Le dossier assets du depot, retrouve depuis ce fichier de test. */
const RACINE_DISQUE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets');

describe('cheminCarte', () => {
  it('range les trois couches par carte et par mode', () => {
    expect(cheminCarte('map1', false, 'background')).toBe('cartes/map1/normal/background.png');
    expect(cheminCarte('map2', true, 'collision')).toBe('cartes/map2/mirror/collision.png');
    expect(cheminCarte('map3', false, 'foreground')).toBe('cartes/map3/normal/foreground.png');
  });
});

describe('cheminPluie', () => {
  it('donne un chemin pour la seule carte qui a de la pluie', () => {
    expect(cheminPluie('map1', false)).toBe('cartes/map1/normal/rain.png');
    expect(cheminPluie('map1', true)).toBe('cartes/map1/mirror/rain.png');
  });

  it('ne donne rien pour les cartes sans pluie', () => {
    // Le jeu d'origine demandait rain.png pour toutes les cartes et recevait
    // trois erreurs de chargement sur quatre. Rendre l'absence explicite evite
    // la demande.
    expect(cheminPluie('map2', false)).toBeUndefined();
    expect(cheminPluie('map3', true)).toBeUndefined();
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

  it('couvre les six natures sans en oublier', () => {
    const natures = [...TYPES_BONUS, ...TYPES_MALUS];

    expect(tousLesObjets()).toHaveLength(natures.length);
    expect(new Set(natures.map((nature) => cheminObjet(nature))).size).toBe(natures.length);
  });
});

describe('cheminSon', () => {
  it('range les sons dans leur dossier', () => {
    expect(cheminSon(SONS.bonusRamasse)).toBe('sons/collect-bonus.wav');
    expect(cheminSon(MUSIQUE_DE_JEU)).toBe('sons/game-music-2.mp3');
  });
});

describe('les ressources annoncees existent sur le disque', () => {
  /** Verifie qu'un chemin relatif designe un fichier reellement present. */
  const present = (relatif: string): boolean => existsSync(join(RACINE_DISQUE, relatif));

  it('pour les cartes, leurs trois couches et la pluie', () => {
    const manquants: string[] = [];

    for (const carte of ['map1', 'map2', 'map3'] as const) {
      for (const modeMiroir of [false, true]) {
        for (const couche of ['background', 'collision', 'foreground'] as const) {
          const chemin = cheminCarte(carte, modeMiroir, couche);
          if (!present(chemin)) {
            manquants.push(chemin);
          }
        }

        const pluie = cheminPluie(carte, modeMiroir);
        if (pluie !== undefined && !present(pluie)) {
          manquants.push(pluie);
        }
      }
    }

    expect(manquants).toEqual([]);
  });

  it('pour les sprites, les icones, les sons et la musique', () => {
    const attendus = [
      ...tousLesNinjas(),
      ...tousLesObjets(),
      ...Object.values(SONS).map((fichier) => cheminSon(fichier)),
      ...Object.values(SONS_EN_BOUCLE).map((fichier) => cheminSon(fichier)),
      ...SONS_DE_PAS.map((fichier) => cheminSon(fichier)),
      cheminSon(MUSIQUE_DE_JEU),
    ];

    expect(attendus.filter((chemin) => !present(chemin))).toEqual([]);
  });
});

describe('RACINE_RESSOURCES', () => {
  it('est une adresse absolue, pour que le navigateur la resolve depuis n importe quel ecran', () => {
    expect(RACINE_RESSOURCES.startsWith('/')).toBe(true);
  });
});
