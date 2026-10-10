/**
 * Relier des couleurs a leur nom (etape 7.21): tirer quatre fils, chaque couleur de gauche vers
 * son nom, ecrit a droite. LA TACHE SE LIT SANS DISTINGUER LES COULEURS: chaque prise porte
 * aussi le nom de sa couleur, et l'on relie un nom a un nom (etude, section 9.4).
 *
 * Au clavier: haut et bas pour choisir le fil, droite pour passer aux noms, haut et bas pour
 * choisir le nom, Espace pour relier. Un fil relie au mauvais nom revient, sans rien couter
 * d'autre que le temps.
 *
 * Chaque fil branche joue son animation (FIL_MS) avant le suivant: quatre fils font 3,6
 * secondes au plus vite, au-dessus des 3,5 secondes du serveur. Les quatre couleurs se tirent
 * parmi les douze couleurs nommees du mode, et l'ordre des noms aussi.
 */

import type { CouleurNommee } from '@neon-ninja/shared';
import { COULEURS_NOMMEES } from '@neon-ninja/shared';

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste, PointDuGeste } from './commun.js';
import { avecEcho, dansLeRectangle, tireur } from './commun.js';

/** Ce que dure un fil branche, son animation comprise. */
export const FIL_MS = 900;

/** Le nombre de fils. */
export const NOMBRE_DE_FILS = 4;

/** Les prises de gauche et les bornes de droite: leur rectangle, et l'ecart entre deux rangs. */
export const PRISES = { gauche: 30, largeur: 100, hauteur: 34 } as const;
export const BORNES = { gauche: 270, largeur: 100, hauteur: 34 } as const;

/** Le centre du rang `rang`, de haut en bas. */
export function hauteurDuRang(rang: number): number {
  return 62 + rang * 58;
}

/** Le bout d'une prise, d'ou part son fil. */
export function boutDeLaPrise(rang: number): PointDuGeste {
  return { x: PRISES.gauche + PRISES.largeur, y: hauteurDuRang(rang) };
}

/** Le bout d'une borne, ou arrive un fil. */
export function boutDeLaBorne(rang: number): PointDuGeste {
  return { x: BORNES.gauche, y: hauteurDuRang(rang) };
}

/** Ou en est le cablage. */
export interface EtatCouleurs extends BaseDeGeste {
  readonly nature: 'couleurs';
  /** Les couleurs de gauche, de haut en bas. */
  readonly couleurs: readonly CouleurNommee[];
  /** Les noms de droite, de haut en bas. */
  readonly noms: readonly string[];
  /** Les fils relies, par rang de gauche. */
  readonly relies: readonly boolean[];
  /** La fin de l'animation du dernier fil branche. */
  readonly finDuFil: number;
  /** Le fil tenu au pointeur: son rang, et ou en est son bout. */
  readonly prise?: { readonly rang: number } & PointDuGeste;
  /** Le choix du clavier: le cote, le fil choisi, le nom choisi. */
  readonly curseur: {
    readonly cote: 'gauche' | 'droite';
    readonly gauche: number;
    readonly droite: number;
  };
}

/** Quatre couleurs a relier, tirees de cette graine. */
export function creerCouleurs(graine: number): EtatCouleurs {
  const tirer = tireur(graine);
  const couleurs = tirer.melanger(COULEURS_NOMMEES).slice(0, NOMBRE_DE_FILS);

  return {
    nature: 'couleurs',
    couleurs,
    noms: tirer.melanger(couleurs.map((couleur) => couleur.nom)),
    relies: couleurs.map(() => false),
    finDuFil: 0,
    curseur: { cote: 'gauche', gauche: 0, droite: 0 },
    echos: [],
  };
}

/** Le rang de la ligne sous ce point, dans ces rectangles, ou -1. */
function rangSous(point: PointDuGeste, colonne: { gauche: number; largeur: number }): number {
  for (let rang = 0; rang < NOMBRE_DE_FILS; rang += 1) {
    if (
      dansLeRectangle(
        point,
        colonne.gauche - 10,
        hauteurDuRang(rang) - PRISES.hauteur / 2 - 6,
        colonne.largeur + 20,
        PRISES.hauteur + 12,
      )
    ) {
      return rang;
    }
  }

  return -1;
}

/** Le premier fil pas encore relie a partir de ce rang, ou ce rang. */
function filSuivant(relies: readonly boolean[], depart: number): number {
  for (let pas = 0; pas < relies.length; pas += 1) {
    const rang = (depart + pas) % relies.length;

    if (relies[rang] !== true) {
      return rang;
    }
  }

  return depart;
}

/** Relie ce fil a ce nom: branche s'il est le sien, revient sinon. */
function relier(etat: EtatCouleurs, fil: number, nom: number, maintenant: number): EtatCouleurs {
  const { prise: _lachee, ...sansPrise } = etat;
  const juste = etat.couleurs[fil]?.nom === etat.noms[nom];

  if (!juste || etat.relies[fil] === true || maintenant < etat.finDuFil) {
    return avecEcho(sansPrise, 'ratee');
  }

  const relies = etat.relies.map((relie, rang) => relie || rang === fil);

  return avecEcho(
    {
      ...sansPrise,
      relies,
      finDuFil: maintenant + FIL_MS,
      curseur: { cote: 'gauche', gauche: filSuivant(relies, fil), droite: etat.curseur.droite },
    },
    'fil',
  );
}

/** Le cablage apres une commande. */
export function appliquerCouleurs(
  etat: EtatCouleurs,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatCouleurs {
  if (commande.type === 'temps') {
    return etat;
  }

  if (commande.type === 'touche') {
    return commande.enfoncee ? toucher(etat, commande.touche, maintenant) : etat;
  }

  const { prise: _lachee, ...sansPrise } = etat;

  switch (commande.phase) {
    case 'bas': {
      const rang = rangSous(commande, PRISES);

      return rang < 0 || etat.relies[rang] === true || maintenant < etat.finDuFil
        ? etat
        : { ...etat, prise: { rang, x: commande.x, y: commande.y } };
    }

    case 'deplace':
      return etat.prise === undefined
        ? etat
        : { ...etat, prise: { rang: etat.prise.rang, x: commande.x, y: commande.y } };

    case 'haut': {
      if (etat.prise === undefined) {
        return etat;
      }

      const nom = rangSous(commande, BORNES);

      return nom < 0 ? sansPrise : relier(etat, etat.prise.rang, nom, maintenant);
    }
  }
}

/** Une touche enfoncee. */
function toucher(
  etat: EtatCouleurs,
  touche: Extract<CommandeDeGeste, { type: 'touche' }>['touche'],
  maintenant: number,
): EtatCouleurs {
  const { cote, gauche, droite } = etat.curseur;
  const deplacer = (rang: number, sens: number): number =>
    (rang + sens + NOMBRE_DE_FILS) % NOMBRE_DE_FILS;

  switch (touche) {
    case 'haut':
    case 'bas': {
      const sens = touche === 'haut' ? -1 : 1;

      return {
        ...etat,
        curseur:
          cote === 'gauche'
            ? { cote, gauche: deplacer(gauche, sens), droite }
            : { cote, gauche, droite: deplacer(droite, sens) },
      };
    }

    case 'droite':
      return { ...etat, curseur: { cote: 'droite', gauche, droite } };

    case 'gauche':
      return { ...etat, curseur: { cote: 'gauche', gauche, droite } };

    case 'espace':
      return cote === 'gauche'
        ? { ...etat, curseur: { cote: 'droite', gauche, droite } }
        : relier(
            { ...etat, curseur: { cote: 'gauche', gauche, droite } },
            gauche,
            droite,
            maintenant,
          );
  }
}

/** Le cablage est-il fini: quatre fils, le dernier branche. */
export function couleursFinies(etat: EtatCouleurs, maintenant: number): boolean {
  return etat.relies.every((relie) => relie) && maintenant >= etat.finDuFil;
}

/** Les fils relies. */
export function avancementDesCouleurs(etat: EtatCouleurs): AvancementDuGeste {
  return { faits: etat.relies.filter((relie) => relie).length, total: NOMBRE_DE_FILS };
}
