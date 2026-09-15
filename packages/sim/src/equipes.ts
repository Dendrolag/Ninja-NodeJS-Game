/**
 * Le mode Equipes: deux equipes d'une couleur chacune, qui se disputent les bots.
 *
 * Etape 7.2. Aucune version du jeu d'origine n'avait ce mode: ses regles sont celles
 * que le porteur du projet a tranchees le 15 septembre 2026 (docs/plan/etape-7-2.md).
 *
 * UNE EQUIPE, POUR LE MOTEUR, C'EST UNE COULEUR. Tous les membres d'une equipe portent
 * la sienne, et le moteur n'a aucune autre notion d'equipe. C'est ce qui laisse
 * inchanges le score, qui compte deja les bots d'une couleur, la contagion, qui
 * transmet deja la couleur d'un joueur present, et l'interdiction de capturer un
 * joueur de sa propre couleur. L'etat d'une partie ne gagne donc aucun champ, et une
 * partie Classique reste identique a l'octet. Qui est dans quelle equipe se decide au
 * salon, par le serveur, qui fait entrer chaque joueur avec la couleur de la sienne.
 *
 * CE QUI CHANGE, et se decide ici:
 *
 *   - La PART d'un joueur: les bots de son equipe divises par le nombre de ses
 *     membres, arrondi en dessous, pris parmi les plus proches de lui. Un joueur seul
 *     dans son equipe a pour part tous ses bots: en un contre un, c'est le Classique.
 *   - Un adversaire capture cede sa part a l'attaquant, et garde sa couleur
 *     (capturerEnEquipe, dans capture.ts).
 *   - Un bot noir fait perdre la part reglee de la part, et non de tous les bots de
 *     l'equipe.
 *   - Un malus frappe l'equipe adverse, et epargne les coequipiers du ramasseur.
 */

import type { PerteFaceAuBotNoir } from './bots.js';
import type { BotOrdinaire, EtatPartie, Joueur } from './etat.js';
import type { VictimeDuMalus } from './objets.js';

/**
 * La part d'un joueur dans les bots de son equipe, les plus proches de lui d'abord.
 *
 * Les membres comptes sont les joueurs de la partie qui portent sa couleur, lui
 * compris. Un joueur dont le lien est tombe en fait partie: il est encore dans l'etat,
 * et garde sa place (etape 2.5).
 *
 * « Au plus pres » se mesure entre les centres, au moment ou la question est posee; a
 * distance egale, l'ordre des bots dans l'etat departage, ce qui garde le resultat
 * reproductible.
 */
export function partDuJoueur(etat: EtatPartie, joueur: Joueur): readonly BotOrdinaire[] {
  const membres = Object.values(etat.joueurs).filter(
    (autre) => autre.couleur === joueur.couleur,
  ).length;
  const bots = Object.values(etat.bots).filter(
    (bot): bot is BotOrdinaire => bot.type === 'bot' && bot.couleur === joueur.couleur,
  );
  const part = Math.floor(bots.length / Math.max(membres, 1));

  return bots
    .map((bot, rang) => ({
      bot,
      rang,
      distance: Math.hypot(bot.position.x - joueur.position.x, bot.position.y - joueur.position.y),
    }))
    .sort((un, autre) => un.distance - autre.distance || un.rang - autre.rang)
    .slice(0, part)
    .map(({ bot }) => bot);
}

/**
 * Ce que perd un joueur attrape par un bot noir, en Equipes: la part reglee de sa part,
 * les bots les plus proches de lui, arrondie en dessous.
 *
 * Le reglage est celui de l'hote, cinquante pour cent par defaut, comme en Classique;
 * seul change ce a quoi il s'applique (decision 7 du porteur du projet).
 */
export const perteEnEquipe: PerteFaceAuBotNoir = (etat, victime) => {
  const part = partDuJoueur(etat, victime);
  const perdus = Math.floor((part.length * etat.reglages.botsNoirs.partDeBotsPerduePourCent) / 100);

  return part.slice(0, perdus);
};

/** Qui subit un malus, en Equipes: les joueurs d'une autre couleur que le ramasseur. */
export const malusEnEquipe: VictimeDuMalus = (ramasseur, autre) =>
  autre.couleur !== ramasseur.couleur;
