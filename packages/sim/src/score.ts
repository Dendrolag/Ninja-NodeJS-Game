/**
 * Le score et le classement.
 *
 * Portage de calculatePlayerScores (legacy/server.js:1766).
 *
 * LE POINT LE PLUS IMPORTANT DU FICHIER: le score est un stock, pas un cumul.
 * Il vaut le nombre de bots qui portent la couleur du joueur A L'INSTANT PRESENT,
 * plus quinze points par bot noir detruit. Se faire capturer ne « retire » donc
 * rien a personne: la victime change de couleur, et les bots qu'elle portait
 * comptent desormais pour l'attaquant. Son score retombe de lui-meme a ses seuls
 * points de bots noirs. C'est le comportement a preserver numero 1 de CLAUDE.md,
 * et c'est ce qui fait la tension de fin de partie.
 *
 * CONSEQUENCE DE CONCEPTION: le score n'est pas range dans l'etat. Il s'en
 * deduit. Le ranger reviendrait a tenir une seconde verite a jour a la main, avec
 * le risque qu'elle diverge de la premiere: c'est exactement la maladie du
 * legacy, ou des compteurs etaient remis a zero a cinq endroits et incrementes
 * nulle part (defaut X11). Une capture met bien les scores a jour, mais elle le
 * fait en repeignant des bots, pas en ecrivant un nombre.
 *
 * Le serveur appellera calculerScores au moment d'envoyer le classement, a sa
 * propre cadence, qui n'a pas besoin d'etre celle du moteur.
 */

import { SCORE } from '@neon-ninja/shared';

import type { Couleur } from './couleurs.js';
import type { EtatPartie, HistoriqueCapture, IdentifiantEntite, Joueur } from './etat.js';

/** Ce que vaut un joueur a un instant donne, et de quoi c'est fait. */
export interface LigneScore {
  readonly id: IdentifiantEntite;
  readonly pseudo: string;
  readonly couleur: Couleur;
  /**
   * Le score affiche: les bots portes plus les points de bots noirs.
   *
   * Le legacy nommait ce total currentBots, ce qui laissait croire a un nombre de
   * bots alors qu'il comprenait aussi les points de bots noirs. Les deux parts
   * sont ici separees et nommees pour ce qu'elles sont.
   */
  readonly points: number;
  /** Nombre de bots portant actuellement la couleur du joueur. */
  readonly botsPortes: number;
  /** Points acquis en detruisant des bots noirs. Ceux-la ne se perdent jamais. */
  readonly pointsBotsNoirs: number;
  /** Nombre de joueurs captures. Sert a departager deux scores egaux. */
  readonly captures: number;
  /** Cumul des bots gagnes en capturant des joueurs. Ne redescend jamais. */
  readonly botsGagnesAuTotal: number;
  /** Nombre de bots noirs detruits. */
  readonly botsNoirsDetruits: number;
  /** Qui ce joueur a capture, et combien de fois. */
  readonly joueursCaptures: Readonly<Record<IdentifiantEntite, HistoriqueCapture>>;
  /** Qui a capture ce joueur, et combien de fois. */
  readonly capturesSubies: Readonly<Record<IdentifiantEntite, HistoriqueCapture>>;
}

/**
 * Le score d'un seul joueur, lu dans l'etat.
 *
 * Seuls les bots ordinaires comptent. Les bots noirs portent la couleur noire et
 * n'appartiennent a personne; ils rapportent quand on les detruit, pas quand on
 * les cotoie.
 */
export function scoreDe(etat: EtatPartie, joueur: Joueur): LigneScore {
  const botsPortes = Object.values(etat.bots).filter(
    (bot) => bot.type === 'bot' && bot.couleur === joueur.couleur,
  ).length;
  const pointsBotsNoirs = joueur.botsNoirsDetruits * SCORE.POINTS_PAR_BOT_NOIR;

  return {
    id: joueur.id,
    pseudo: joueur.pseudo,
    couleur: joueur.couleur,
    points: botsPortes + pointsBotsNoirs,
    botsPortes,
    pointsBotsNoirs,
    captures: joueur.captures,
    botsGagnesAuTotal: joueur.botsGagnesAuTotal,
    botsNoirsDetruits: joueur.botsNoirsDetruits,
    joueursCaptures: joueur.joueursCaptures,
    capturesSubies: joueur.capturesSubies,
  };
}

/**
 * Le classement de la partie: tous les joueurs, du meilleur au moins bon.
 *
 * On departage d'abord au score, puis au nombre de captures. A egalite parfaite,
 * le tri de JavaScript etant stable, l'ordre d'arrivee dans la partie fait office
 * de troisieme critere. C'est deja ce que faisait le legacy, qui n'avait pas non
 * plus de troisieme critere.
 *
 * Cette fonction ne modifie rien: elle lit l'etat et en tire un tableau.
 */
export function calculerScores(etat: EtatPartie): readonly LigneScore[] {
  return Object.values(etat.joueurs)
    .map((joueur) => scoreDe(etat, joueur))
    .sort(
      (premier, second) => second.points - premier.points || second.captures - premier.captures,
    );
}
