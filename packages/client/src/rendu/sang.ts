/**
 * Le sang du mode Massacre (etape 7.4): le dessin d'une eclaboussure, et celui d'une
 * empreinte de pas.
 *
 * TOUT EN CODE, SANS IMAGE. Decision du porteur du projet du 16 septembre 2026, dans l'esprit
 * de Hotline Miami: une tache centrale irreguliere, des gouttes projetees dans la direction
 * du coup, et des trainees etirees, dans un rouge legerement varie et un peu lumineux, pour
 * rester lisible sur un sol sombre et neon.
 *
 * LE MEME DESSIN POUR TOUS LES JOUEURS. Le tirage part d'une graine derivee de l'identifiant
 * du mort, que le serveur envoie a tout le monde: chacun voit les memes taches, au meme
 * endroit, sans que le serveur ait rien a dessiner. Le generateur est celui de
 * packages/shared, le meme que le moteur: pas de Math.random ici non plus.
 *
 * FONCTIONS PURES. Elles rendent des formes, en coordonnees de carte; les imprimer sur le
 * calque du sol est le travail de pixi.ts, qui ne decide rien.
 */

import type { Alea } from '@neon-ninja/shared';
import { creerAlea, reel } from '@neon-ninja/shared';

/** Une forme de sang: une ellipse pleine, tournee. */
export interface FormeDeSang {
  readonly x: number;
  readonly y: number;
  /** Demi-grand axe, dans la direction de la rotation, en pixels de carte. */
  readonly rayonX: number;
  /** Demi-petit axe, en pixels de carte. */
  readonly rayonY: number;
  /** Rotation de l'ellipse, en radians. */
  readonly rotation: number;
  readonly couleur: number;
  readonly alpha: number;
}

/** Les rouges du sang, du plus sombre au plus vif. Un peu lumineux, pour le sol neon. */
const ROUGES = [0x8c0a1e, 0xa3101f, 0xbd1426, 0xd41c2e] as const;

/**
 * Une graine tiree d'un texte, toujours la meme pour le meme texte.
 *
 * C'est l'empreinte FNV-1a sur trente-deux bits: courte, sans dependance, et assez
 * dispersee pour que deux identifiants voisins, « bot-12 » et « bot-13 », ne donnent pas
 * deux taches semblables.
 */
export function graineDe(texte: string): number {
  let empreinte = 0x811c9dc5;

  for (let rang = 0; rang < texte.length; rang += 1) {
    empreinte ^= texte.charCodeAt(rang);
    empreinte = Math.imul(empreinte, 0x01000193) >>> 0;
  }

  return empreinte;
}

/** Un tirage reel qui fait avancer un generateur tenu dans une variable. */
function tireur(graine: number): (minimum: number, maximum: number) => number {
  let alea: Alea = creerAlea(graine);

  return (minimum, maximum) => {
    const tirage = reel(alea, minimum, maximum);
    alea = tirage.alea;
    return tirage.valeur;
  };
}

/**
 * L'eclaboussure d'une mort.
 *
 * @param id     L'identifiant du mort: il decide du dessin, le meme pour tous.
 * @param x      Ou il est tombe.
 * @param y
 * @param angle  La direction du coup, en radians: les gouttes et les trainees partent de ce
 *               cote, comme projetees par la lame.
 * @param echelle La taille de la tache: un pour un ninja, moins pour une tache discrete.
 */
export function eclaboussure(
  id: string,
  x: number,
  y: number,
  angle: number,
  echelle = 1,
): readonly FormeDeSang[] {
  const tirer = tireur(graineDe(id));
  const couleur = (): number => ROUGES[Math.floor(tirer(0, ROUGES.length))] ?? ROUGES[0];
  const formes: FormeDeSang[] = [];

  // La tache centrale: quelques ellipses qui se chevauchent, pour un bord irregulier.
  const lobes = Math.floor(tirer(4, 7));
  for (let lobe = 0; lobe < lobes; lobe += 1) {
    const cap = tirer(0, 2 * Math.PI);
    const ecart = tirer(0, 7) * echelle;
    const rayon = tirer(7, 13) * echelle;

    formes.push({
      x: x + Math.cos(cap) * ecart,
      y: y + Math.sin(cap) * ecart,
      rayonX: rayon,
      rayonY: rayon * tirer(0.6, 1),
      rotation: tirer(0, Math.PI),
      couleur: couleur(),
      alpha: tirer(0.8, 0.95),
    });
  }

  // Les trainees: des ellipses etirees dans la direction du coup, a peu pres.
  const trainees = Math.floor(tirer(2, 5));
  for (let trainee = 0; trainee < trainees; trainee += 1) {
    const cap = angle + tirer(-0.5, 0.5);
    const longueur = tirer(10, 24) * echelle;
    const depart = tirer(6, 14) * echelle;

    formes.push({
      x: x + Math.cos(cap) * (depart + longueur),
      y: y + Math.sin(cap) * (depart + longueur),
      rayonX: longueur,
      rayonY: tirer(1.2, 2.6) * echelle,
      rotation: cap,
      couleur: couleur(),
      alpha: tirer(0.7, 0.9),
    });
  }

  // Les gouttes: petites, projetees loin, surtout devant.
  const gouttes = Math.floor(tirer(6, 12));
  for (let goutte = 0; goutte < gouttes; goutte += 1) {
    const cap = angle + tirer(-0.9, 0.9);
    const distance = tirer(14, 46) * echelle;
    const rayon = tirer(1, 3.2) * echelle;

    formes.push({
      x: x + Math.cos(cap) * distance,
      y: y + Math.sin(cap) * distance,
      rayonX: rayon,
      rayonY: rayon,
      rotation: 0,
      couleur: couleur(),
      alpha: tirer(0.75, 0.95),
    });
  }

  return formes;
}

/**
 * L'empreinte d'un pas dans le sang: une semelle et un talon, tournes dans la direction de
 * la marche, et d'autant plus pales que le pied s'est deja vide.
 *
 * @param x       Le centre du pied.
 * @param y
 * @param angle   La direction de la marche, en radians.
 * @param opacite De zero a un: le premier pas est le plus rouge.
 */
export function empreinte(
  x: number,
  y: number,
  angle: number,
  opacite: number,
): readonly FormeDeSang[] {
  const avant = { x: Math.cos(angle), y: Math.sin(angle) };

  return [
    {
      x: x + avant.x * 2.5,
      y: y + avant.y * 2.5,
      rayonX: 3.6,
      rayonY: 2.2,
      rotation: angle,
      couleur: ROUGES[1],
      alpha: opacite,
    },
    {
      x: x - avant.x * 3.5,
      y: y - avant.y * 3.5,
      rayonX: 2,
      rayonY: 1.8,
      rotation: angle,
      couleur: ROUGES[1],
      alpha: opacite,
    },
  ];
}
