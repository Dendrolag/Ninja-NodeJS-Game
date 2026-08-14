/**
 * Ce qui arrive quand deux entites se touchent: les captures.
 *
 * Portage de handlePlayerCapture (legacy/server.js:737), de la capture de bot
 * ecrite en ligne dans detectCollisions (:1686 a 1707) et de la destruction d'un
 * bot noir par un joueur invincible (:1718 a 1735).
 *
 * Ce fichier ne decide jamais QUI se touche: cela, c'est le releve des contacts
 * (contacts.ts). Il ne decide pas non plus qui attaque qui quand deux joueurs se
 * heurtent: c'est la regle de resolution du mode de jeu, egalement dans
 * contacts.ts. Ici on trouve seulement l'effet d'une capture donnee, ecrit une
 * fois, utilisable par n'importe quelle regle.
 *
 * Chaque fonction est autonome: elle verifie elle-meme que la capture est permise
 * et renvoie l'etat inchange si elle ne l'est pas. Une regle de mode de jeu ne
 * peut donc pas contourner par megarde la protection d'apparition ou le delai
 * entre deux captures.
 *
 * Ce que le portage change, et pourquoi:
 *
 *   - Le legacy emettait ses notifications au milieu du calcul. Ici la capture
 *     depose un evenement dans l'etat, et c'est le serveur qui en fera un
 *     message. Le moteur ne connait ni socket, ni son, ni animation.
 *   - Le champ botsControlled n'est pas porte: c'est le defaut X11 de l'audit, un
 *     compteur remis a zero a cinq endroits, jamais incremente, et envoye au
 *     client qui recevait donc toujours zero. C'est botsGagnesAuTotal qui porte
 *     la valeur reelle.
 *   - Le legacy verifiait l'egalite des couleurs a l'endroit de la detection, et
 *     pas dans handlePlayerCapture, qui pouvait donc etre appelee sur deux
 *     joueurs de meme couleur: elle comptait alors une capture et « transferait »
 *     a l'attaquant ses propres bots. Ici la verification est dans la regle
 *     d'autorisation, donc elle ne peut plus etre oubliee par un appelant.
 *   - Seule une entite portant la couleur d'un joueur repeint un bot. Voir
 *     aUneCouleurADonner plus bas: c'est la correction des defauts X20 et X30.
 */

import { COULEUR_BOT_NEUTRE, DUREES, SCORE } from '@neon-ninja/shared';

import type { Couleur } from './couleurs.js';
import { couleurUnique } from './couleurs.js';
import type { Bot, EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import {
  couleursUtilisees,
  estInvincible,
  estInvulnerable,
  peutCapturer,
  positionDApparition,
  positionsOccupees,
  retirerBot,
} from './etat.js';

/**
 * Un joueur peut-il en capturer un autre a cet instant ?
 *
 * Trois conditions, toutes venues du legacy: les deux joueurs ne portent pas la
 * meme couleur, la victime n'est ni invincible ni protegee par son apparition, et
 * l'attaquant a laisse s'ecouler le delai entre deux captures.
 */
export function captureAutorisee(attaquant: Joueur, victime: Joueur): boolean {
  return (
    attaquant.id !== victime.id &&
    attaquant.couleur !== victime.couleur &&
    !estInvulnerable(victime) &&
    peutCapturer(attaquant)
  );
}

/**
 * Un joueur en capture un autre.
 *
 * Tous les bots portant la couleur de la victime passent d'un seul coup a
 * l'attaquant: c'est le comportement a preserver numero 2 de CLAUDE.md. La
 * victime reapparait ailleurs, avec une couleur nouvelle et une protection
 * d'apparition neuve, donc avec un score de zero, ses points de bots noirs mis a
 * part. C'est le comportement a preserver numero 1: le score est un stock.
 *
 * Renvoie l'etat inchange si la capture n'est pas permise.
 */
export function capturerJoueur(
  etat: EtatPartie,
  attaquantId: IdentifiantEntite,
  victimeId: IdentifiantEntite,
): EtatPartie {
  const attaquant = etat.joueurs[attaquantId];
  const victime = etat.joueurs[victimeId];

  if (attaquant === undefined || victime === undefined || !captureAutorisee(attaquant, victime)) {
    return etat;
  }

  const couleurPerdue = victime.couleur;
  const positionDuContact = victime.position;
  const botsTransferes = Object.values(etat.bots).filter(
    (bot) => bot.type === 'bot' && bot.couleur === couleurPerdue,
  ).length;

  // La victime reapparait: nouvelle place, nouvelle couleur, protection neuve.
  // Portage de Player.respawn (legacy/server.js:922), dans l'ordre d'origine:
  // la position d'abord, la couleur ensuite. Les couleurs a eviter sont celles
  // de tous les joueurs presents, ce qui comprend deja celle de l'attaquant et
  // celle que la victime portait: le legacy excluait la premiere une seconde
  // fois, sans effet.
  const place = positionDApparition(etat.alea, etat.terrain, positionsOccupees(etat));
  const teinte = couleurUnique(place.alea, couleursUtilisees(etat));

  const joueurs: Record<IdentifiantEntite, Joueur> = {
    ...etat.joueurs,
    [attaquantId]: {
      ...attaquant,
      captures: attaquant.captures + 1,
      botsGagnesAuTotal: attaquant.botsGagnesAuTotal + botsTransferes,
      joueursCaptures: inscrireAuJournal(attaquant.joueursCaptures, victimeId, victime.pseudo),
      tempsDepuisDerniereCaptureMs: 0,
    },
    [victimeId]: {
      ...victime,
      position: place.valeur,
      couleur: teinte.valeur,
      direction: 'immobile',
      protectionSpawnRestanteMs: DUREES.PROTECTION_SPAWN_MS,
      capturesSubies: inscrireAuJournal(victime.capturesSubies, attaquantId, attaquant.pseudo),
    },
  };

  return {
    ...etat,
    joueurs,
    bots: repeindre(etat.bots, couleurPerdue, attaquant.couleur),
    evenements: [
      ...etat.evenements,
      {
        type: 'captureJoueur',
        attaquant: attaquantId,
        victime: victimeId,
        botsTransferes,
        nouvelleCouleurVictime: teinte.valeur,
        position: positionDuContact,
      },
    ],
    alea: teinte.alea,
  };
}

/**
 * Une entite en capture une autre en la repeignant a sa couleur.
 *
 * C'est la capture d'un bot, la plus frequente du jeu: un joueur qui traverse un
 * groupe de bots les fait passer a sa couleur, et son score monte d'autant.
 *
 * Le legacy laissait aussi les bots se repeindre entre eux (:1704): un bot en
 * mouvement teint celui qu'il touche. Cette contagion fait partie du jeu depuis
 * toujours, et elle est conservee ENTRE BOTS DE JOUEURS: elle est ce qui fait
 * qu'un troupeau rouge qui traverse un troupeau bleu le retourne.
 *
 * Renvoie l'etat inchange si les deux portent deja la meme couleur, si la cible
 * n'est pas un bot ordinaire, si le capteur n'a pas de couleur a donner, ou si
 * l'une des deux entites a disparu. Un bot noir ne se repeint jamais: il vivait
 * dans une table a part dans le legacy.
 */
export function capturerBot(
  etat: EtatPartie,
  capteurId: IdentifiantEntite,
  botId: IdentifiantEntite,
): EtatPartie {
  const capteur = etat.joueurs[capteurId] ?? etat.bots[capteurId];
  const bot = etat.bots[botId];

  if (capteur === undefined || bot === undefined || bot.type !== 'bot') {
    return etat;
  }

  if (!aUneCouleurADonner(capteur) || capteur.couleur === bot.couleur) {
    return etat;
  }

  return { ...etat, bots: { ...etat.bots, [botId]: { ...bot, couleur: capteur.couleur } } };
}

/**
 * Une entite a-t-elle une couleur a imposer a un bot qu'elle touche ?
 *
 * Un joueur, toujours. Un bot, seulement s'il porte deja la couleur d'un joueur:
 * un bot n'invente pas de couleur, il transmet celle de son proprietaire.
 *
 * CETTE REGLE CORRIGE DEUX DEFAUTS D'UN COUP, TOUS DEUX A L'ETAPE 1.6.
 *
 * X20, la contagion du blanc. Le legacy ne posait aucune condition sur la couleur
 * du capteur: un bot BLANC, c'est-a-dire un bot que personne n'a capture, repeignait
 * en blanc un bot de couleur. Comme les bots se croisent en permanence, un joueur
 * voyait son score fondre sans que personne ne l'attaque. Ce n'etait pas une faute
 * d'ecriture mais un comportement reel du jeu depuis deux ans, porte tel quel a
 * l'etape 1.3 avec la question posee au porteur du projet. Decision du 14 aout
 * 2026: c'est un effet de bord jamais voulu, on le corrige. La contagion entre
 * bots de joueurs, elle, reste entiere.
 *
 * X30, la contagion du noir. Celui-la n'est pas un defaut du legacy mais une
 * regression du portage: le releve des contacts confie a capturerBot n'importe
 * quelle paire de bots, bots noirs compris, si bien qu'un bot noir repeignait en
 * noir le bot ordinaire qu'il frolait, et selon l'ordre de la table seulement. Le
 * legacy n'appelait jamais detectCollisions sur un bot noir (updateBots :1567) et
 * son test de contagion exigeait entity.type === 'bot' (:1701), ce qu'un bot noir
 * n'est pas: la chose n'existait pas dans le jeu d'origine.
 */
function aUneCouleurADonner(capteur: Joueur | Bot): boolean {
  return (
    capteur.type === 'joueur' || (capteur.type === 'bot' && capteur.couleur !== COULEUR_BOT_NEUTRE)
  );
}

/**
 * Un joueur invincible detruit un bot noir qu'il touche.
 *
 * Portage de legacy/server.js:1718. Seul le bonus d'invincibilite permet cette
 * destruction: la protection d'apparition, elle, ne fait qu'epargner le joueur.
 * C'est pour cela que la condition ne passe pas par estInvulnerable.
 *
 * Le bot noir disparait et le joueur gagne quinze points, comptes par son nombre
 * de bots noirs detruits. Ces points-la ne se perdent jamais: c'est la seule
 * partie du score qui ne soit pas un stock de bots.
 *
 * Renvoie l'etat inchange si le joueur n'est pas invincible, ou si l'une des deux
 * entites a disparu.
 */
export function detruireBotNoir(
  etat: EtatPartie,
  joueurId: IdentifiantEntite,
  botNoirId: IdentifiantEntite,
): EtatPartie {
  const joueur = etat.joueurs[joueurId];
  const botNoir = etat.bots[botNoirId];

  if (joueur === undefined || botNoir === undefined || botNoir.type !== 'botNoir') {
    return etat;
  }

  if (!estInvincible(joueur)) {
    return etat;
  }

  const sansLeBotNoir = retirerBot(etat, botNoirId);

  return {
    ...sansLeBotNoir,
    joueurs: {
      ...sansLeBotNoir.joueurs,
      [joueurId]: { ...joueur, botsNoirsDetruits: joueur.botsNoirsDetruits + 1 },
    },
    evenements: [
      ...sansLeBotNoir.evenements,
      {
        type: 'botNoirDetruit',
        joueur: joueurId,
        botNoir: botNoirId,
        position: botNoir.position,
        points: SCORE.POINTS_PAR_BOT_NOIR,
      },
    ],
  };
}

/** Ajoute une capture au journal d'un joueur, ou incremente celle qui s'y trouve. */
function inscrireAuJournal(
  journal: Joueur['joueursCaptures'],
  autreId: IdentifiantEntite,
  pseudo: string,
): Joueur['joueursCaptures'] {
  const ligne = journal[autreId];

  return { ...journal, [autreId]: { pseudo, nombre: (ligne?.nombre ?? 0) + 1 } };
}

/** Fait passer tous les bots d'une couleur a une autre. */
function repeindre(
  bots: EtatPartie['bots'],
  ancienne: Couleur,
  nouvelle: Couleur,
): EtatPartie['bots'] {
  const repeints: Record<IdentifiantEntite, Bot> = {};

  for (const [id, bot] of Object.entries(bots)) {
    repeints[id] =
      bot.type === 'bot' && bot.couleur === ancienne ? { ...bot, couleur: nouvelle } : bot;
  }

  return repeints;
}
