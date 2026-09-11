/**
 * Qui touche qui, a la fin d'un battement, et ce qu'il en resulte.
 *
 * Portage de la partie entite contre entite de detectCollisions
 * (legacy/server.js:1671). Le legacy melait dans cette meme fonction trois
 * choses: constater un contact, en tirer les consequences (capturer, changer une
 * couleur), et ramasser les bonus et malus. Ici elles sont separees.
 *
 *   - detecterContacts constate. C'est de la geometrie, elle ne change rien.
 *   - resoudreContacts decide. C'est la regle du jeu, et elle change avec le
 *     mode: le mode Classique capture par simple proximite, le mode tactique
 *     prevu plus tard capturera par cone. Le point de branchement existe donc
 *     des maintenant, la ou le legacy melangeait tout.
 *   - Le ramassage des bonus et des malus n'est pas un contact entre entites:
 *     il arrive avec l'etape 1.4.
 *
 * QUI ATTAQUE QUI. Le legacy appelait detectCollisions sur la seule entite qui
 * venait de bouger, et cette entite etait l'attaquant. Deux joueurs qui se
 * heurtaient de face jouaient donc leur capture a la course au message: le
 * gagnant etait celui dont le paquet arrivait le premier, c'est-a-dire, en
 * pratique, celui qui avait la meilleure connexion. Ici tout le monde avance dans
 * le meme battement, et les contacts sont des paires sans vainqueur designe. La
 * regle doit donc trancher elle-meme, et elle le fait ainsi:
 *
 *   1. Si un seul des deux a le droit de capturer l'autre, c'est lui.
 *   2. Si les deux l'ont, le generateur a graine tire au sort.
 *
 * Le tirage au sort remplace la loterie du reseau par une loterie equitable et
 * reproductible: a graine egale, la meme partie se rejoue a l'identique. Une
 * regle plus simple, du genre « le premier arrive dans la partie l'emporte »,
 * aurait donne un avantage permanent au meme joueur pendant trois minutes.
 */

import { entier } from '@neon-ninja/shared';

import { capturerBot, captureAutorisee, capturerJoueur, detruireBotNoir } from './capture.js';
import type { Bot, EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { entiteDe, toutesLesEntites } from './etat.js';

/**
 * En dessous de cette distance, en pixels, deux entites se touchent. Valeur du
 * legacy (server.js:1679), comparee en inegalite stricte: a vingt pixels pile,
 * il n'y a pas contact.
 */
export const SEUIL_CONTACT_PX = 20;

/** Deux entites qui se touchent, et de combien elles sont proches. */
export interface Contact {
  readonly premier: IdentifiantEntite;
  readonly second: IdentifiantEntite;
  /** Distance entre les deux centres, en pixels. */
  readonly distance: number;
}

/**
 * Une regle de resolution: ce qu'un mode de jeu fait des contacts releves.
 *
 * C'est le point d'extension du moteur. Le mode Classique est fourni ci-dessous
 * sous le nom regleClassique. Un mode tactique, qui capturera par cone
 * directionnel et non par simple proximite, s'ecrira comme une autre fonction de
 * ce type et se passera au moteur sans qu'aucune autre ligne ne change.
 */
export type RegleDeResolution = (etat: EtatPartie, contacts: readonly Contact[]) => EtatPartie;

/**
 * Releve tous les contacts de la partie.
 *
 * Chaque paire n'apparait qu'une fois. L'ordre du releve suit celui des entites
 * dans l'etat, les joueurs d'abord, puis les bots, chacun dans son ordre
 * d'arrivee: a etat egal, la liste produite est toujours la meme, ce qui est
 * indispensable au rejeu d'une partie.
 *
 * C'est le premier poste du moteur dans le profil d'un serveur charge (etape 5.2):
 * chaque paire est examinee. Deux choses le rendent moins cher sans rien changer a
 * ce qu'il releve. Aucun tableau n'est plus fabrique par entite pour parcourir les
 * suivantes. Et une paire eloignee d'au moins le seuil sur un seul axe est ecartee
 * sans calculer sa distance: la distance entre deux points n'est jamais plus petite
 * que leur ecart sur un axe, Math.hypot compris. Les paires restantes sont jugees
 * exactement comme avant, par la meme distance.
 */
export function detecterContacts(etat: EtatPartie): readonly Contact[] {
  const entites = toutesLesEntites(etat);
  const contacts: Contact[] = [];

  for (let rang = 0; rang < entites.length; rang += 1) {
    const unePart = entites[rang] as Joueur | Bot;

    for (let suivant = rang + 1; suivant < entites.length; suivant += 1) {
      const autrePart = entites[suivant] as Joueur | Bot;
      const ecartX = unePart.position.x - autrePart.position.x;
      const ecartY = unePart.position.y - autrePart.position.y;

      if (horsDePortee(ecartX) || horsDePortee(ecartY)) {
        continue;
      }

      const distance = Math.hypot(ecartX, ecartY);

      if (distance < SEUIL_CONTACT_PX) {
        contacts.push({ premier: unePart.id, second: autrePart.id, distance });
      }
    }
  }

  return contacts;
}

/**
 * Un ecart sur un axe suffit-il a exclure le contact ?
 *
 * Une valeur non numerique ne l'exclut pas ici: elle passe au calcul de la distance,
 * qui la refuse comme il l'a toujours fait.
 */
function horsDePortee(ecart: number): boolean {
  return ecart >= SEUIL_CONTACT_PX || ecart <= -SEUIL_CONTACT_PX;
}

/**
 * Applique les consequences des contacts releves.
 *
 * Par defaut, la regle du mode Classique. Passer une autre regle en troisieme
 * argument suffit a changer la facon dont le jeu resout ses contacts.
 */
export function resoudreContacts(
  etat: EtatPartie,
  contacts: readonly Contact[],
  regle: RegleDeResolution = regleClassique,
): EtatPartie {
  return regle(etat, contacts);
}

/**
 * La regle du mode Classique: on capture par simple proximite.
 *
 * Les contacts sont resolus l'un apres l'autre, chacun sur l'etat laisse par le
 * precedent. Une capture deplace la victime a l'autre bout de la carte: les
 * contacts releves plus tot qui la concernaient encore n'ont donc plus lieu
 * d'etre, et ils sont ecartes. Sans cela, une victime tout juste capturee
 * pourrait capturer a son tour un joueur qu'elle ne touche plus.
 */
export function regleClassique(etat: EtatPartie, contacts: readonly Contact[]): EtatPartie {
  let courant = etat;
  const replacees = new Set<IdentifiantEntite>();

  for (const contact of contacts) {
    if (replacees.has(contact.premier) || replacees.has(contact.second)) {
      continue;
    }

    const resolution = resoudreUnContact(courant, contact.premier, contact.second);
    courant = resolution.etat;

    if (resolution.replacee !== undefined) {
      replacees.add(resolution.replacee);
    }
  }

  return courant;
}

/** Ce qu'un contact resolu laisse derriere lui. */
interface Resolution {
  readonly etat: EtatPartie;
  /** Entite dont la position a change, et dont les autres contacts sont perimes. */
  readonly replacee: IdentifiantEntite | undefined;
}

/** Rien ne s'est passe. */
function sansEffet(etat: EtatPartie): Resolution {
  return { etat, replacee: undefined };
}

/**
 * Resout un contact, en aiguillant selon la nature des deux entites.
 *
 * Un contact entre deux bots noirs, ou entre un bot et un bot noir, ne produit
 * rien: le legacy les rangeait dans des tables separees qui ne se rencontraient
 * jamais. La capture d'un joueur PAR un bot noir n'est pas ici non plus: dans le
 * legacy comme ici, un bot noir ne prend que la proie qu'il poursuit, ce qui
 * appartient a son comportement. Elle vit donc dans bots.ts.
 */
function resoudreUnContact(
  etat: EtatPartie,
  premierId: IdentifiantEntite,
  secondId: IdentifiantEntite,
): Resolution {
  const premier = entiteDe(etat, premierId);
  const second = entiteDe(etat, secondId);

  // Une entite peut avoir disparu depuis le releve: un bot noir detruit plus tot
  // dans le meme battement figure encore dans les contacts qui le concernaient.
  if (premier === undefined || second === undefined) {
    return sansEffet(etat);
  }

  if (premier.type === 'joueur') {
    return second.type === 'joueur'
      ? duelDeJoueurs(etat, premier, second)
      : sansEffet(contactJoueurBot(etat, premier, second));
  }

  if (second.type === 'joueur') {
    return sansEffet(contactJoueurBot(etat, second, premier));
  }

  // Deux bots. Le legacy laissait celui qui bougeait repeindre l'autre; ici c'est
  // le premier releve, donc le plus ancien des deux, ce qui evite que deux bots
  // superposes se repeignent l'un l'autre a chaque battement.
  //
  // La paire peut comprendre un bot noir, et c'est capturerBot qui le refuse: un
  // bot noir n'a pas de couleur a donner, pas plus qu'un bot blanc. Voir les
  // defauts X30 et X20 de l'audit. La regle vit la-bas plutot qu'ici pour qu'un
  // futur mode de jeu qui ecrirait sa propre regle de resolution ne puisse pas
  // l'oublier.
  return sansEffet(capturerBot(etat, premierId, secondId));
}

/**
 * Un joueur touche un bot: il le repeint, ou il detruit un bot noir s'il est
 * invincible. Un joueur ordinaire qui touche un bot noir ne provoque rien ici:
 * c'est le bot noir qui l'attaque, et cela vient a l'etape 1.5.
 */
function contactJoueurBot(etat: EtatPartie, joueur: Joueur, bot: Bot): EtatPartie {
  return bot.type === 'botNoir'
    ? detruireBotNoir(etat, joueur.id, bot.id)
    : capturerBot(etat, joueur.id, bot.id);
}

/**
 * Deux joueurs se touchent: l'un capture l'autre, ou rien ne se passe.
 *
 * Quand les deux ont le droit de capturer, le generateur a graine tranche. Voir
 * l'explication en tete de fichier.
 */
function duelDeJoueurs(etat: EtatPartie, premier: Joueur, second: Joueur): Resolution {
  const premierPeut = captureAutorisee(premier, second);
  const secondPeut = captureAutorisee(second, premier);

  if (!premierPeut && !secondPeut) {
    return sansEffet(etat);
  }

  let courant = etat;
  let attaquant = premier;
  let victime = second;

  if (premierPeut && secondPeut) {
    const tirage = entier(etat.alea, 2);
    courant = { ...etat, alea: tirage.alea };

    if (tirage.valeur === 1) {
      attaquant = second;
      victime = premier;
    }
  } else if (secondPeut) {
    attaquant = second;
    victime = premier;
  }

  return { etat: capturerJoueur(courant, attaquant.id, victime.id), replacee: victime.id };
}
