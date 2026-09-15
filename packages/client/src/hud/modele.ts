/**
 * Le HUD, sous forme de donnees: ce que la surcouche doit montrer.
 *
 * FONCTION PURE, COMME LA SCENE. On lui donne l'etat et l'instant, elle rend la
 * description de ce qu'il faut afficher: le temps restant deja mis en forme, les
 * lignes du classement, les effets en cours avec leur reste, les points de la
 * minimap, et, dans le mode Tactique, nos charges. Ecrire cela dans le document est
 * le travail d'un autre fichier.
 *
 * POURQUOI CE DECOUPAGE ICI AUSSI. Le client d'origine avait quinze fonctions qui
 * ecrivaient dans le document, chacune allant chercher ses donnees dans une
 * variable globale differente: updateTimer, updatePlayerList, updateBonusTimers,
 * updateActiveBonusesDisplay, updateMalusEffects, et ainsi de suite. Le score
 * affiche pouvait donc contredire le score recu, et rien ne pouvait le detecter.
 * Ici, tout ce qui s'affiche vient d'un seul calcul, verifiable par un test.
 *
 * LE HUD EST EN SURCOUCHE, PAS DANS PIXIJS. Du texte et des boutons se font mieux
 * en DOM: c'est accessible, cela se selectionne, cela se met en forme avec une
 * feuille de style, et cela ne coute rien au GPU. PixiJS dessine le terrain, le
 * document dessine l'interface par-dessus. C'est la pile annoncee par CLAUDE.md.
 */

import type { Couleur, LigneClassement, TypeBonus, TypeMalus } from '@neon-ninja/shared';
import { TACTIQUE } from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';
import { APPARENCE_OBJET } from '../rendu/apparence.js';
import { effetsEnCours, moiDansLaPartie, resteDeLEffet } from '../selecteurs.js';

/** Sous cette duree restante, le temps s'affiche en alerte. */
export const SEUIL_URGENCE_MS = 30_000;

/** Une ligne du classement, prete a etre affichee. */
export interface LigneHud {
  readonly id: string;
  readonly pseudo: string;
  readonly couleur: Couleur;
  readonly points: number;
  /** Cette ligne est la notre: l'affichage la met en avant. */
  readonly moi: boolean;
  /** Rang, a partir de un. */
  readonly rang: number;
}

/** Un effet en cours sur nous, avec ce qu'il en reste. */
export interface EffetHud {
  readonly nature: TypeBonus | TypeMalus;
  readonly categorie: 'bonus' | 'malus';
  readonly libelle: string;
  readonly couleur: number;
  /** Ce qu'il reste, en millisecondes. */
  readonly resteMs: number;
  /** Ce qu'il reste, en secondes arrondies vers le haut: ce que le joueur lit. */
  readonly resteS: number;
}

/** Un point a poser sur la minimap, en coordonnees de carte. */
export interface PointMinimap {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly couleur: Couleur;
  /** Ce point est le notre: l'affichage le grossit. */
  readonly moi: boolean;
}

/** Nos charges, dans le mode Tactique (etape 7.1). */
export interface ChargesHud {
  readonly disponibles: number;
  readonly maximum: number;
  /**
   * Ou en est la charge qui revient, de zero a un. Un aux charges pleines: rien n'est
   * en cours.
   */
  readonly recharge: number;
}

/** Tout ce que la surcouche affiche a un instant donne. */
export interface Hud {
  /** Le temps restant, mis en forme minutes deux-points secondes. */
  readonly temps: string;
  /** Le temps restant en millisecondes, pour les animations. */
  readonly tempsRestantMs: number;
  /** La partie touche a sa fin: l'affichage passe en alerte. */
  readonly urgence: boolean;
  /** La partie est suspendue. */
  readonly enPause: boolean;
  /** Qui a suspendu la partie, quand on le sait. */
  readonly pausePar: string | undefined;
  readonly classement: readonly LigneHud[];
  readonly effets: readonly EffetHud[];
  readonly minimap: readonly PointMinimap[];
  /** Nos charges. Absentes hors du mode Tactique, ou tant qu'on n'est pas sur la carte. */
  readonly charges: ChargesHud | undefined;
}

/** Un HUD vide, celui d'un ecran hors partie. */
export const HUD_VIDE: Hud = {
  temps: '0:00',
  tempsRestantMs: 0,
  urgence: false,
  enPause: false,
  pausePar: undefined,
  classement: [],
  effets: [],
  minimap: [],
  charges: undefined,
};

/**
 * Met en forme une duree en minutes et secondes.
 *
 * Les secondes sont arrondies VERS LE HAUT, pour que le compteur affiche « 1 »
 * pendant la derniere seconde et non « 0 » pendant qu'il reste encore du temps.
 */
export function formaterDuree(millisecondes: number): string {
  const secondes = Math.max(Math.ceil(millisecondes / 1000), 0);
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;

  return `${String(minutes)}:${String(reste).padStart(2, '0')}`;
}

/**
 * Construit le HUD a afficher.
 *
 * @param etat       L'etat du client.
 * @param maintenant Instant local, lu sur l'horloge du client.
 */
export function construireHud(etat: EtatClient, maintenant: number): Hud {
  const partie = etat.partie;

  if (partie === undefined) {
    return HUD_VIDE;
  }

  return {
    temps: formaterDuree(partie.tempsRestantMs),
    tempsRestantMs: partie.tempsRestantMs,
    urgence: partie.tempsRestantMs <= SEUIL_URGENCE_MS,
    enPause: partie.enPause,
    pausePar: etat.pausePar,
    classement: classementHud(partie.classement, etat.moi),
    effets: effetsHud(etat, maintenant),
    minimap: minimapHud(etat),
    charges: chargesHud(etat),
  };
}

/** Le classement, numerote et marque a notre nom. */
function classementHud(
  classement: readonly LigneClassement[],
  moi: string | undefined,
): readonly LigneHud[] {
  return classement.map((ligne, index) => ({
    id: ligne.id,
    pseudo: ligne.pseudo,
    couleur: ligne.couleur,
    points: ligne.points,
    moi: ligne.id === moi,
    rang: index + 1,
  }));
}

/**
 * Les effets a montrer, du plus proche de sa fin au plus lointain.
 *
 * L'ordre compte: la jauge qui va disparaitre est celle que le joueur regarde.
 */
function effetsHud(etat: EtatClient, maintenant: number): readonly EffetHud[] {
  return effetsEnCours(etat, maintenant)
    .map((effet) => {
      const resteMs = resteDeLEffet(effet, maintenant);
      const apparence = APPARENCE_OBJET[effet.nature];

      return {
        nature: effet.nature,
        categorie: effet.categorie,
        libelle: apparence.libelle,
        couleur: apparence.couleur,
        resteMs,
        resteS: Math.ceil(resteMs / 1000),
      };
    })
    .sort((gauche, droite) => gauche.resteMs - droite.resteMs);
}

/**
 * Les points de la minimap.
 *
 * ON N'Y MET QUE LES JOUEURS, pas les bots. Une carte couverte de cent points
 * blancs ne dit rien; les joueurs, eux, sont ce que l'on cherche du regard. Le
 * jeu d'origine n'avait pas de minimap du tout: elle vient des maquettes.
 */
function minimapHud(etat: EtatClient): readonly PointMinimap[] {
  return (etat.partie?.entites ?? [])
    .filter((entite) => entite.type === 'joueur')
    .map((entite) => ({
      id: entite.id,
      x: entite.x,
      y: entite.y,
      couleur: entite.couleur,
      moi: entite.id === etat.moi,
    }));
}

/**
 * Nos charges, d'apres le flux d'etat.
 *
 * L'attente de la prochaine vient du dernier battement recu: elle avance par
 * vingtiemes de seconde, ce qui ne se voit pas sur une jauge de cinq secondes.
 */
function chargesHud(etat: EtatClient): ChargesHud | undefined {
  const moi = moiDansLaPartie(etat);

  if (moi?.type !== 'joueur' || moi.tactique === undefined) {
    return undefined;
  }

  const { charges, avantProchaineChargeMs } = moi.tactique;
  const enCours = 1 - avantProchaineChargeMs / TACTIQUE.RECHARGE_MS;

  return {
    disponibles: charges,
    maximum: TACTIQUE.CHARGES_MAXIMUM,
    recharge: charges >= TACTIQUE.CHARGES_MAXIMUM ? 1 : Math.min(Math.max(enCours, 0), 1),
  };
}
