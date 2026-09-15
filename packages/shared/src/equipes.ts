/**
 * Les equipes du mode Equipes, vues de toutes les couches (etape 7.2).
 *
 * Le moteur ne connait pas d'equipe: il connait des couleurs, et deux joueurs de meme
 * couleur sont coequipiers. Le serveur et le client, eux, parlent d'equipes. Ce fichier
 * fait le passage de l'une a l'autre, au meme endroit pour tous: l'equipe d'une
 * couleur, le classement des equipes tire du classement des joueurs, et la place que
 * ce classement donne a chacun pour ses recompenses.
 *
 * TOUT CE FICHIER EST PUR, comme la progression: le serveur l'appelle pour le bilan, le
 * client pour le HUD et l'ecran de fin, et les deux calculent la meme chose.
 */

import type { Couleur, Equipe } from './constantes.js';
import { COULEURS_DES_EQUIPES, EQUIPES } from './constantes.js';
import type { Devancement } from './progression.js';

/**
 * L'equipe qui porte cette couleur, ou undefined si aucune ne la porte.
 *
 * La casse ne compte pas: le flux d'etat fait voyager les couleurs en majuscules, et
 * rien n'oblige un appelant a les ecrire ainsi.
 */
export function equipeDeCouleur(couleur: Couleur): Equipe | undefined {
  const cherchee = couleur.toUpperCase();

  return EQUIPES.find((equipe) => COULEURS_DES_EQUIPES[equipe].toUpperCase() === cherchee);
}

/**
 * Ce qu'il faut savoir d'un joueur pour classer les equipes.
 *
 * Une ligne du classement des joueurs en a la forme, qu'elle vienne du moteur ou du
 * flux d'etat.
 */
export interface LigneDeJoueurEnEquipe {
  readonly id: string;
  readonly couleur: Couleur;
  /** En Equipes, les bots de la couleur de son equipe: la meme valeur pour tous ses membres. */
  readonly botsPortes: number;
  readonly pointsBotsNoirs: number;
  readonly captures: number;
}

/** Une equipe au classement. */
export interface LigneDEquipe {
  readonly equipe: Equipe;
  /** Le score de l'equipe: les bots de sa couleur, plus les points de bots noirs de ses membres. */
  readonly points: number;
  readonly botsPortes: number;
  readonly pointsBotsNoirs: number;
  /** Les joueurs captures par ses membres. */
  readonly captures: number;
  /** Ses membres, dans l'ordre du classement des joueurs recu. */
  readonly membres: readonly string[];
}

/** L'issue d'une partie Equipes: une equipe gagne, ou les deux sont a egalite. */
export type IssueDesEquipes =
  { readonly type: 'victoire'; readonly gagnante: Equipe } | { readonly type: 'egalite' };

/** Le classement des equipes, et ce qu'il dit de l'issue. */
export interface ClassementDesEquipes {
  /**
   * Les equipes qui ont au moins un membre, la gagnante d'abord. A egalite, dans l'ordre
   * des equipes.
   */
  readonly equipes: readonly LigneDEquipe[];
  readonly issue: IssueDesEquipes;
}

/**
 * Classe les equipes d'apres le classement de leurs joueurs.
 *
 * Le score d'une equipe vaut les bots de sa couleur, plus les points de bots noirs de
 * ses membres (decision 2 du porteur du projet). La plus haute gagne; deux scores egaux
 * font une egalite, sans autre critere (decision 8).
 *
 * UNE EQUIPE SANS MEMBRE N'EST PAS CLASSEE: l'autre gagne, et les bots de sa couleur ne
 * comptent pour personne. Sans aucun membre dans aucune equipe, personne ne gagne.
 */
export function classementDesEquipes(
  lignes: readonly LigneDeJoueurEnEquipe[],
): ClassementDesEquipes {
  const equipes: LigneDEquipe[] = [];

  for (const equipe of EQUIPES) {
    const membres = lignes.filter((ligne) => equipeDeCouleur(ligne.couleur) === equipe);

    if (membres.length === 0) {
      continue;
    }

    const botsPortes = Math.max(...membres.map((membre) => membre.botsPortes));
    const pointsBotsNoirs = somme(membres.map((membre) => membre.pointsBotsNoirs));

    equipes.push({
      equipe,
      points: botsPortes + pointsBotsNoirs,
      botsPortes,
      pointsBotsNoirs,
      captures: somme(membres.map((membre) => membre.captures)),
      membres: membres.map((membre) => membre.id),
    });
  }

  const meilleure = equipes.reduce<LigneDEquipe | undefined>(
    (retenue, ligne) => (retenue === undefined || ligne.points > retenue.points ? ligne : retenue),
    undefined,
  );

  if (
    meilleure === undefined ||
    equipes.some((ligne) => ligne !== meilleure && ligne.points === meilleure.points)
  ) {
    return { equipes, issue: { type: 'egalite' } };
  }

  return {
    equipes: [meilleure, ...equipes.filter((ligne) => ligne !== meilleure)],
    issue: { type: 'victoire', gagnante: meilleure.equipe },
  };
}

/** La place d'un joueur present a la fin d'une partie Equipes. */
export interface PlaceDansLesEquipes {
  /** Ce que retiennent l'historique, l'ecran de fin et les victoires du profil. */
  readonly placement: number;
  /** Ce que valent ses recompenses: le placement ne le dit pas en equipes. */
  readonly devancement: Devancement;
}

/**
 * La place d'un joueur present a la fin d'une partie Equipes (decision 8 du porteur du
 * projet, micro-decisions 10 et 11 de la fiche 7.2).
 *
 *   - Un vainqueur est place premier. Il devance tous les joueurs qui ne sont pas de son
 *     equipe, abandons compris, et prend les points de ligue du premier.
 *   - Un perdant est place juste apres les vainqueurs presents. Il ne devance que les
 *     abandons, et prend les points de ligue du dernier.
 *   - A egalite, tous les presents sont au meme rang, au milieu: places un plus la
 *     moitie des presents, arrondie en dessous, ce qui n'est jamais une victoire. Chacun
 *     devance les abandons et la moitie des adversaires presents, et prend les points de
 *     ligue du milieu.
 *
 * Les abandons, eux, restent comptes derniers, comme dans tout mode: ils ne passent pas
 * par cette fonction.
 *
 * @param equipe L'equipe du joueur.
 * @param nombreJoueurs Tous les joueurs de la partie, abandons compris.
 */
export function placeDansLesEquipes(
  classement: ClassementDesEquipes,
  equipe: Equipe | undefined,
  nombreJoueurs: number,
): PlaceDansLesEquipes {
  const presents = somme(classement.equipes.map((ligne) => ligne.membres.length));
  const abandons = Math.max(nombreJoueurs - presents, 0);
  const issue = classement.issue;

  if (issue.type === 'egalite') {
    const adversaires = somme(
      classement.equipes
        .filter((ligne) => ligne.equipe !== equipe)
        .map((ligne) => ligne.membres.length),
    );

    return {
      placement: 1 + Math.floor(presents / 2),
      devancement: { joueursDevances: abandons + Math.floor(adversaires / 2), partDevancee: 0.5 },
    };
  }

  const vainqueurs =
    classement.equipes.find((ligne) => ligne.equipe === issue.gagnante)?.membres.length ?? 0;

  return equipe === issue.gagnante
    ? {
        placement: 1,
        devancement: { joueursDevances: nombreJoueurs - vainqueurs, partDevancee: 1 },
      }
    : { placement: vainqueurs + 1, devancement: { joueursDevances: abandons, partDevancee: 0 } };
}

/**
 * Les points qu'on retient d'un joueur a la fin d'une partie Equipes: sa part des bots
 * de son equipe, plus ses propres points de bots noirs.
 *
 * Son score n'est pas celui de son equipe. En compter tous les bots a chacun de ses
 * membres gonflerait le meilleur score de son profil a la taille de son equipe. Sa part
 * est celle que le moteur lui fait ceder quand on le capture (decision 6 du porteur du
 * projet): les bots de l'equipe divises par ses membres, arrondi en dessous.
 */
export function pointsEnEquipe(
  classement: ClassementDesEquipes,
  joueur: LigneDeJoueurEnEquipe,
): number {
  const ligne = classement.equipes.find((equipe) => equipe.membres.includes(joueur.id));

  return ligne === undefined
    ? joueur.pointsBotsNoirs
    : Math.floor(ligne.botsPortes / ligne.membres.length) + joueur.pointsBotsNoirs;
}

/**
 * L'equipe ou entre un joueur qui n'a pas choisi: la moins nombreuse; a nombre egal,
 * celle qui a le moins de points; a points egaux, la premiere des equipes
 * (micro-decision 6 de la fiche 7.2).
 *
 * C'est l'equipe d'un joueur qui arrive au salon, avant qu'il n'en change, et celle d'un
 * joueur qui entre dans une partie deja lancee, ou il n'y a plus de salon pour choisir.
 */
export function equipeDArrivee(
  membres: Readonly<Record<Equipe, number>>,
  points: Readonly<Record<Equipe, number>>,
): Equipe {
  return EQUIPES.reduce((retenue, equipe) =>
    membres[equipe] < membres[retenue] ||
    (membres[equipe] === membres[retenue] && points[equipe] < points[retenue])
      ? equipe
      : retenue,
  );
}

/** La somme d'une liste de nombres. */
function somme(valeurs: readonly number[]): number {
  return valeurs.reduce((total, valeur) => total + valeur, 0);
}
