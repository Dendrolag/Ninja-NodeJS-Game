/**
 * La fin de partie, sous forme de donnees: le podium, le classement definitif, et ce
 * que la partie a rapporte a notre compte.
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
 * LA PROGRESSION VIENT DU RECAPITULATIF DE L'ETAPE 3.3, TELLE QUELLE. Les gains
 * affiches sont ceux que la base a ecrits (progressionDeFin), pas un calcul du
 * client: la seule regle appliquee ici est la mise en forme. Le recapitulatif
 * arrive apres le classement, le temps de l'ecriture; en attendant, l'ecran le
 * dit. Un invite n'a que le classement (cadrage, section 3). Les defis de la
 * maquette sont reportes apres la v1 (cadrage, question 7).
 */

import type {
  ClassementDesEquipes,
  Equipe,
  LigneClassement,
  ProgressionDeFin,
} from '@neon-ninja/shared';
import {
  COULEURS_DES_EQUIPES,
  classementDesEquipes,
  equipeDeCouleur,
  placeDansLesEquipes,
  pointsEnEquipe,
} from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { NOMS_DES_EQUIPES, NOMS_DES_MODES, nomDeCarte } from './cartes.js';
import type { BarreDeNiveau } from './progression.js';
import {
  NOMS_DES_PALIERS,
  barreDeNiveau,
  formaterNombre,
  formaterVariation,
} from './progression.js';

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

/** Une equipe au classement final d'une partie Equipes, telle qu'on l'affiche (etape 7.2). */
export interface EquipeFin {
  readonly equipe: Equipe;
  /** « Équipe Cyan ». */
  readonly nom: string;
  readonly couleur: string;
  readonly points: number;
  readonly captures: number;
  /** Nous en sommes. */
  readonly mienne: boolean;
}

/** Notre place, decoupee pour que l'ecran puisse ecrire le suffixe en exposant. */
export interface Place {
  readonly nombre: number;
  /** « re » pour la premiere place, « e » pour les autres. */
  readonly suffixe: string;
}

/** Le sens d'une variation de points de ligue, qui decide de sa couleur. */
export type SensDeLaLigue = 'hausse' | 'baisse' | 'stable';

/** Ce que la partie a rapporte a notre compte, tel qu'on l'affiche. */
export type ProgressionAffichee =
  /** Le serveur ecrit la partie en base: le recapitulatif n'est pas encore arrive. */
  | { readonly nature: 'attente' }
  /** La partie n'a pas pu etre enregistree: elle ne compte pas, et le joueur doit le savoir. */
  | { readonly nature: 'nonEnregistree'; readonly motif: string }
  | {
      readonly nature: 'enregistree';
      /** « +210 XP ». */
      readonly xp: string;
      /** La barre du niveau atteint apres la partie. */
      readonly barre: BarreDeNiveau;
      /** « Niveau 3 atteint ! », seulement si la partie a fait monter de niveau. */
      readonly passageDeNiveau: string | undefined;
      /** « +21 ». */
      readonly pieces: string;
      /** « +20 », « −10 » ou « 0 ». */
      readonly variationLigue: string;
      readonly sensDeLaLigue: SensDeLaLigue;
      /** Le palier et les points apres la partie: « Argent · 120 points ». */
      readonly palier: string;
      /** « Bronze → Argent », seulement si le palier a change. */
      readonly changementDePalier: string | undefined;
    };

/** Tout ce que l'ecran de fin affiche. */
export interface ModeleFin {
  /** La ligne de contexte: « Partie terminée · Horde · Rainy Tokyo ». */
  readonly contexte: string;
  /** Notre place, ou rien si nous ne figurons pas au classement. */
  readonly place: Place | undefined;
  /** Le mot qui suit la place. */
  readonly message: string;
  /**
   * Les trois premiers, dans l'ordre du podium: deuxieme, premier, troisieme. Vide dans
   * une partie Equipes, ou ce sont les equipes qui se classent.
   */
  readonly podium: readonly LigneFin[];
  /** Les equipes, la gagnante d'abord, dans une partie Equipes seulement (etape 7.2). */
  readonly equipes: readonly EquipeFin[] | undefined;
  /** Tout le classement, du premier au dernier. */
  readonly lignes: readonly LigneFin[];
  /** Ce que la partie a rapporte a notre compte. Absent pour un invite. */
  readonly progression: ProgressionAffichee | undefined;
  /**
   * « Rejouer » est-il actif. Il demande a entrer dans une partie: pendant que le lien
   * se retablit, la demande ne partirait pas (etape 2.6).
   */
  readonly peutRejouer: boolean;
}

/** Calcule l'ecran de fin, ou rien tant que la partie n'est pas finie. */
export function modeleFin(etat: EtatClient): ModeleFin | undefined {
  const fin = etat.fin;

  if (fin === undefined) {
    return undefined;
  }

  const salon = etat.salon;

  if (salon?.mode === 'equipes') {
    return { ...modeleFinEnEquipes(fin.classement, etat), contexte: contexteDeFin(etat) };
  }

  const lignes = fin.classement.map((ligne, index) => ligneFin(ligne, index + 1, etat.moi));
  const mienne = lignes.find((ligne) => ligne.moi);

  return {
    contexte: contexteDeFin(etat),
    place:
      mienne === undefined
        ? undefined
        : { nombre: mienne.rang, suffixe: mienne.rang === 1 ? 're' : 'e' },
    message: messageDeFin(mienne?.rang),
    // L'ordre des marches est celui d'un vrai podium: le premier au centre.
    podium: [lignes[1], lignes[0], lignes[2]].filter(
      (ligne): ligne is LigneFin => ligne !== undefined,
    ),
    equipes: undefined,
    lignes,
    // Une session en verification a presente un jeton que le serveur a accepte:
    // c'est un compte, dont la progression arrivera.
    progression:
      etat.session.nature === 'invite' ? undefined : progressionAffichee(etat.progressionDeFin),
    peutRejouer: etat.connexion === 'connecte',
  };
}

/** La ligne de contexte. Sans salon, ni le mode ni la carte ne sont connus: on ne les invente pas. */
function contexteDeFin(etat: EtatClient): string {
  const salon = etat.salon;

  return salon === undefined
    ? 'Partie terminée'
    : `Partie terminée · ${NOMS_DES_MODES[salon.mode]} · ${nomDeCarte(salon.reglages.carte, salon.reglages.modeMiroir)}`;
}

/**
 * L'ecran de fin d'une partie Equipes (etape 7.2), contexte mis a part.
 *
 * Ce sont les equipes qui se classent: le titre dit l'issue, les equipes remplacent le
 * podium, et le tableau range les joueurs par equipe. Le rang d'un joueur est celui que
 * l'historique retient (placeDansLesEquipes): premier pour un vainqueur, juste apres
 * les vainqueurs pour un perdant, au milieu a egalite. Ses points et ses ninjas sont sa
 * part des ninjas de son equipe, plus ses points de Black Ninjas: les points de toute
 * l'equipe se liraient comme un score personnel.
 */
function modeleFinEnEquipes(
  classement: readonly LigneClassement[],
  etat: EtatClient,
): Omit<ModeleFin, 'contexte'> {
  const equipes = classementDesEquipes(classement);
  const notreLigne = classement.find((ligne) => ligne.id === etat.moi);
  const notre = notreLigne === undefined ? undefined : equipeDeCouleur(notreLigne.couleur);
  const rangDEquipe = (ligne: LigneClassement): number => {
    const trouve = equipes.equipes.findIndex((equipe) => equipe.membres.includes(ligne.id));
    return trouve === -1 ? equipes.equipes.length : trouve;
  };

  const lignes = [...classement]
    .sort((une, autre) => rangDEquipe(une) - rangDEquipe(autre))
    .map((ligne) => ({
      ...ligneFin(
        ligne,
        placeDansLesEquipes(equipes, equipeDeCouleur(ligne.couleur), classement.length).placement,
        etat.moi,
      ),
      points: pointsEnEquipe(equipes, ligne),
      botsPortes: partDesNinjas(equipes, ligne.id),
    }));

  return {
    place: undefined,
    message: messageDesEquipes(equipes, notre),
    podium: [],
    equipes: equipes.equipes.map((ligne) => ({
      equipe: ligne.equipe,
      nom: `Équipe ${NOMS_DES_EQUIPES[ligne.equipe]}`,
      couleur: COULEURS_DES_EQUIPES[ligne.equipe],
      points: ligne.points,
      captures: ligne.captures,
      mienne: ligne.equipe === notre,
    })),
    lignes,
    progression:
      etat.session.nature === 'invite' ? undefined : progressionAffichee(etat.progressionDeFin),
    peutRejouer: etat.connexion === 'connecte',
  };
}

/** La part d'un joueur dans les ninjas de son equipe: ses ninjas divises par ses membres. */
function partDesNinjas(equipes: ClassementDesEquipes, id: string): number {
  const equipe = equipes.equipes.find((ligne) => ligne.membres.includes(id));

  return equipe === undefined ? 0 : Math.floor(equipe.botsPortes / equipe.membres.length);
}

/** Ce que le titre dit de l'issue d'une partie Equipes, vue de notre equipe. */
function messageDesEquipes(equipes: ClassementDesEquipes, notre: Equipe | undefined): string {
  const issue = equipes.issue;

  if (issue.type === 'egalite') {
    return 'Égalité !';
  }

  return issue.gagnante === notre
    ? 'Victoire de votre équipe !'
    : `Victoire de l’équipe ${NOMS_DES_EQUIPES[issue.gagnante]}`;
}

/** Le recapitulatif de progression, mis en forme. */
export function progressionAffichee(
  progression: ProgressionDeFin | undefined,
): ProgressionAffichee {
  if (progression === undefined) {
    return { nature: 'attente' };
  }

  if (!progression.enregistree) {
    return { nature: 'nonEnregistree', motif: progression.motif };
  }

  const { avant, apres } = progression;

  return {
    nature: 'enregistree',
    xp: `+${formaterNombre(progression.xpGagnee)} XP`,
    barre: barreDeNiveau(apres.xpTotale),
    passageDeNiveau:
      apres.niveau > avant.niveau ? `Niveau ${String(apres.niveau)} atteint !` : undefined,
    pieces: `+${formaterNombre(progression.piecesGagnees)}`,
    variationLigue: formaterVariation(progression.variationPointsLigue),
    sensDeLaLigue: sensDe(progression.variationPointsLigue),
    palier: `${NOMS_DES_PALIERS[apres.palier]} · ${formaterNombre(apres.pointsLigue)} ${apres.pointsLigue > 1 ? 'points' : 'point'}`,
    changementDePalier:
      apres.palier === avant.palier
        ? undefined
        : `${NOMS_DES_PALIERS[avant.palier]} → ${NOMS_DES_PALIERS[apres.palier]}`,
  };
}

/** Le sens d'une variation. */
function sensDe(variation: number): SensDeLaLigue {
  if (variation > 0) {
    return 'hausse';
  }

  return variation < 0 ? 'baisse' : 'stable';
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
