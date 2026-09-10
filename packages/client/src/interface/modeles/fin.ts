/**
 * La fin de partie, sous forme de donnees: le podium et le classement definitif.
 *
 * FONCTION PURE. Elle ne lit que le classement recu dans partieTerminee, qui est
 * definitif, et jamais le dernier instantane: celui-ci peut avoir un battement de
 * retard sur la fin, et le jeu d'origine affichait parfois un score que le
 * classement final contredisait.
 *
 * LA FAILLE S1 SE FERMAIT ICI. Le jeu d'origine construisait sa fenetre de fin
 * en concatenant les pseudos dans du HTML (showGameOverModal, client.js:3896):
 * un pseudo contenant du code s'executait chez tous les joueurs a la fin de la
 * partie. Le modele ne contient que du texte, et l'ecran le pose avec textContent.
 *
 * CE QUI N'EST PAS ICI: l'experience, les pieces, les points de ligue et les
 * defis de la maquette. Ils arrivent avec la progression de l'etape 3.3.
 */

import type { LigneClassement } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { NOMS_DES_MODES, nomDeCarte } from './cartes.js';

/** Une ligne du classement final, telle qu'on l'affiche. */
export interface LigneFin {
  readonly id: string;
  /** Rang, a partir de un. */
  readonly rang: number;
  readonly pseudo: string;
  readonly couleur: string;
  readonly points: number;
  readonly botsPortes: number;
  readonly captures: number;
  readonly botsNoirsDetruits: number;
  /** Cette ligne est la notre. */
  readonly moi: boolean;
}

/** Notre place, decoupee pour que l'ecran puisse ecrire le suffixe en exposant. */
export interface Place {
  readonly nombre: number;
  /** « re » pour la premiere place, « e » pour les autres. */
  readonly suffixe: string;
}

/** Tout ce que l'ecran de fin affiche. */
export interface ModeleFin {
  /** La ligne de contexte: « Partie terminée · Classique · Rainy Tokyo ». */
  readonly contexte: string;
  /** Notre place, ou rien si nous ne figurons pas au classement. */
  readonly place: Place | undefined;
  /** Le mot qui suit la place. */
  readonly message: string;
  /** Les trois premiers, dans l'ordre du podium: deuxieme, premier, troisieme. */
  readonly podium: readonly LigneFin[];
  /** Tout le classement, du premier au dernier. */
  readonly lignes: readonly LigneFin[];
}

/** Calcule l'ecran de fin, ou rien tant que la partie n'est pas finie. */
export function modeleFin(etat: EtatClient): ModeleFin | undefined {
  const fin = etat.fin;

  if (fin === undefined) {
    return undefined;
  }

  const lignes = fin.classement.map((ligne, index) => ligneFin(ligne, index + 1, etat.moi));
  const mienne = lignes.find((ligne) => ligne.moi);
  const salon = etat.salon;

  return {
    // Sans salon, ni le mode ni la carte ne sont connus: on ne les invente pas.
    contexte:
      salon === undefined
        ? 'Partie terminée'
        : `Partie terminée · ${NOMS_DES_MODES[salon.mode]} · ${nomDeCarte(salon.reglages.carte, salon.reglages.modeMiroir)}`,
    place:
      mienne === undefined
        ? undefined
        : { nombre: mienne.rang, suffixe: mienne.rang === 1 ? 're' : 'e' },
    message: messageDeFin(mienne?.rang),
    // L'ordre des marches est celui d'un vrai podium: le premier au centre.
    podium: [lignes[1], lignes[0], lignes[2]].filter(
      (ligne): ligne is LigneFin => ligne !== undefined,
    ),
    lignes,
  };
}

/** Une ligne du classement recu, mise a la forme de l'affichage. */
function ligneFin(ligne: LigneClassement, rang: number, moi: string | undefined): LigneFin {
  return {
    id: ligne.id,
    rang,
    pseudo: ligne.pseudo,
    couleur: ligne.couleur,
    points: ligne.points,
    botsPortes: ligne.botsPortes,
    captures: ligne.captures,
    botsNoirsDetruits: ligne.botsNoirsDetruits,
    moi: ligne.id === moi,
  };
}

/** Le mot qui accompagne une place. */
function messageDeFin(rang: number | undefined): string {
  if (rang === undefined) {
    return 'Partie terminée';
  }

  if (rang === 1) {
    return 'Victoire !';
  }

  return rang <= 3 ? 'Bien joué !' : 'La prochaine sera la bonne.';
}
