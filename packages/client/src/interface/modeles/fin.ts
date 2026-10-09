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
 * maquette sont reportes apres la v1 (cadrage, question 7). Depuis l'etape 3.7, le
 * recapitulatif dit aussi les succes que la partie a donnes, et le plus proche.
 *
 * LES COLONNES DEPENDENT DU MODE (9 octobre 2026). A cote du rang, du pseudo et des points,
 * le classement montre les statistiques que packages/shared donne au mode joue
 * (statistiquesDeFin.ts), avec les nombres que le serveur a envoyes. Le x2 de l'Evade ne se
 * montre plus a cote des pseudos: l'Evade attrape est une colonne.
 */

import type {
  ClassementDesEquipes,
  Equipe,
  FormatDeStatistique,
  LigneClassement,
  ProgressionDeFin,
  StatistiqueDeFin,
  StatistiquesDUnJoueur,
} from '@neon-ninja/shared';
import {
  COULEURS_DES_EQUIPES,
  DEFINITIONS_DES_STATISTIQUES,
  DUREE_MINIMUM_POUR_LES_DEFIS_S,
  classementDesEquipes,
  equipeDeCouleur,
  placeDansLesEquipes,
  pointsEnEquipe,
  statistiquesDeLaPartie,
} from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { formaterDuree } from '../../hud/modele.js';
import { NOMS_DES_EQUIPES, NOMS_DES_MODES, nomDeCarte } from './cartes.js';
import type { BarreDeNiveau } from './progression.js';
import {
  NOMS_DES_PALIERS,
  barreDeNiveau,
  formaterNombre,
  formaterVariation,
} from './progression.js';
import type { DefiAffiche, DefiReleveAffiche } from './defis.js';
import { defiAffiche, defisRelevesAffiches } from './defis.js';
import type { SuccesObtenuAffiche } from './succes.js';
import { phraseDuPlusProche, succesDebloquesAffiches } from './succes.js';

/** Une colonne de statistique du classement final. */
export interface ColonneDeStatistique {
  readonly id: StatistiqueDeFin;
  /** L'intitule de la colonne: « PNJ ». */
  readonly entete: string;
  /** Ce qu'elle compte, en entier: « PNJ massacrés ». */
  readonly description: string;
}

/** Une ligne du classement final, telle qu'on l'affiche. */
export interface LigneFin {
  readonly id: string;
  /** Rang, a partir de un. */
  readonly rang: number;
  readonly pseudo: string;
  readonly couleur: string;
  readonly points: number;
  /** Ses statistiques, deja ecrites, dans l'ordre des colonnes du modele: « 12 », « x3 », « — ». */
  readonly statistiques: readonly string[];
  /** Cette ligne est la notre. */
  readonly moi: boolean;
  /**
   * Sa fiche peut s'ouvrir d'un clic sur son pseudo (etape 3.5): il est au salon avec
   * un compte, et nous avons un compte. Un joueur parti avant la fin n'est plus au
   * salon: le classement seul ne dit pas s'il avait un compte.
   */
  readonly aUneFiche: boolean;
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
      /** Les succes que la partie a donnes (etape 3.7). */
      readonly succes: readonly SuccesObtenuAffiche[];
      /** « Plus que 3 victoires pour Dix couronnes ». Absente si rien n'est commence. */
      readonly plusProche: string | undefined;
      /** Les defis que la partie a releves, avec leur XP (etape 3.10). */
      readonly defisReleves: readonly DefiReleveAffiche[];
      /** Les defis de la semaine de la partie, apres elle. */
      readonly defis: readonly DefiAffiche[];
      /**
       * Pourquoi la partie n'a pas fait avancer les defis, quand on le sait d'avance: elle
       * etait reglee sur moins de trois minutes. Absent sinon.
       */
      readonly avisDesDefis: string | undefined;
    };

/** Tout ce que l'ecran de fin affiche. */
export interface ModeleFin {
  /** La ligne de contexte: « Partie terminée · Horde · Tokyo ». */
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
  /** Les colonnes de statistiques du mode joue, apres le rang, le joueur et les points. */
  readonly colonnes: readonly ColonneDeStatistique[];
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
  const colonnes = colonnesDeLaFin(etat);

  if (salon?.mode === 'equipes') {
    return {
      ...modeleFinEnEquipes(fin.classement, etat, colonnes),
      contexte: contexteDeFin(etat),
      colonnes,
    };
  }

  const lignes = fin.classement.map((ligne, index) => ligneFin(ligne, index + 1, etat, colonnes));
  const mienne = lignes.find((ligne) => ligne.moi);

  return {
    contexte: contexteDeFin(etat),
    colonnes,
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
      etat.session.nature === 'invite'
        ? undefined
        : progressionAffichee(etat.progressionDeFin, etat.salon?.reglages.dureePartieS),
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
 * Les colonnes de statistiques de la partie finie: celles de son mode, moins celles qu'un
 * reglage coupait. Sans salon, le mode n'est pas connu: aucune colonne, on n'invente rien.
 */
function colonnesDeLaFin(etat: EtatClient): readonly ColonneDeStatistique[] {
  const salon = etat.salon;

  if (salon === undefined) {
    return [];
  }

  return statistiquesDeLaPartie(salon.mode, salon.reglages).map((id) => ({
    id,
    entete: DEFINITIONS_DES_STATISTIQUES[id].entete,
    description: DEFINITIONS_DES_STATISTIQUES[id].description,
  }));
}

/**
 * L'ecran de fin d'une partie Equipes (etape 7.2), contexte et colonnes mis a part.
 *
 * Ce sont les equipes qui se classent: le titre dit l'issue, les equipes remplacent le
 * podium, et le tableau range les joueurs par equipe. Le rang d'un joueur est celui que
 * l'historique retient (placeDansLesEquipes): premier pour un vainqueur, juste apres
 * les vainqueurs pour un perdant, au milieu a egalite. Ses points sont sa part des ninjas
 * de son equipe, plus ses points de Black Ninjas: les points de toute l'equipe se liraient
 * comme un score personnel. Sa colonne de ninjas, que le serveur calcule, est cette part.
 */
function modeleFinEnEquipes(
  classement: readonly LigneClassement[],
  etat: EtatClient,
  colonnes: readonly ColonneDeStatistique[],
): Omit<ModeleFin, 'contexte' | 'colonnes'> {
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
        etat,
        colonnes,
      ),
      points: pointsEnEquipe(equipes, ligne),
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
      etat.session.nature === 'invite'
        ? undefined
        : progressionAffichee(etat.progressionDeFin, etat.salon?.reglages.dureePartieS),
    peutRejouer: etat.connexion === 'connecte',
  };
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

/** Ce que la fin dit d'une partie trop courte pour les defis (etape 3.10). */
export const AVIS_PARTIE_TROP_COURTE_POUR_LES_DEFIS =
  'Une partie de moins de trois minutes ne fait pas avancer les défis.';

/**
 * Le recapitulatif de progression, mis en forme.
 *
 * @param dureePartieS La duree reglee de la partie, si le salon la dit encore.
 */
export function progressionAffichee(
  progression: ProgressionDeFin | undefined,
  dureePartieS?: number,
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
    succes: succesDebloquesAffiches(progression.succes.debloques),
    plusProche:
      progression.succes.plusProche === undefined
        ? undefined
        : phraseDuPlusProche(progression.succes.plusProche),
    defisReleves: defisRelevesAffiches(progression.defis.releves),
    defis: progression.defis.defis.map(defiAffiche),
    avisDesDefis:
      dureePartieS !== undefined && dureePartieS < DUREE_MINIMUM_POUR_LES_DEFIS_S
        ? AVIS_PARTIE_TROP_COURTE_POUR_LES_DEFIS
        : undefined,
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
function ligneFin(
  ligne: LigneClassement,
  rang: number,
  etat: EtatClient,
  colonnes: readonly ColonneDeStatistique[],
): LigneFin {
  const auSalon = etat.salon?.joueurs.find((joueur) => joueur.id === ligne.id);
  const statistiques = etat.fin?.statistiques?.[ligne.id] ?? {};

  return {
    id: ligne.id,
    rang,
    pseudo: ligne.pseudo,
    couleur: ligne.couleur,
    points: ligne.points,
    statistiques: colonnes.map((colonne) => valeurEcrite(statistiques, colonne.id)),
    moi: ligne.id === etat.moi,
    aUneFiche: auSalon?.compte !== undefined && etat.session.nature === 'compte',
  };
}

/** Le tiret d'une statistique sans objet. */
export const SANS_OBJET = '—';

/** Une statistique d'un joueur, ecrite selon son format. */
function valeurEcrite(statistiques: StatistiquesDUnJoueur, id: StatistiqueDeFin): string {
  return ecrireUneStatistique(statistiques[id], DEFINITIONS_DES_STATISTIQUES[id].format);
}

/**
 * Ecrit une valeur de statistique: « 12 », « x3 », « 2:05 », « Oui », ou un tiret quand elle
 * n'a pas d'objet: une statistique absente (les vies d'une proie), un combo sous x2, un
 * drapeau baisse.
 */
export function ecrireUneStatistique(
  valeur: number | undefined,
  format: FormatDeStatistique,
): string {
  switch (format) {
    case 'nombre':
      return valeur === undefined ? SANS_OBJET : formaterNombre(valeur);
    case 'multiplicateur':
      return valeur === undefined || valeur < 2 ? SANS_OBJET : `x${String(valeur)}`;
    case 'duree':
      return valeur === undefined ? SANS_OBJET : formaterDuree(valeur);
    case 'drapeau':
      return valeur !== undefined && valeur > 0 ? 'Oui' : SANS_OBJET;
  }
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
