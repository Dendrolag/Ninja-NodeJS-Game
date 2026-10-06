/**
 * Ce que chaque joueur a le droit de voir de la partie: les vues par destinataire.
 *
 * C'EST L'ETAPE 2.9. Jusque-la, une seule trame partait a toute la partie, et la page
 * choisissait ce qu'elle dessinait. Un client modifie lisait donc tout ce que la page
 * taisait: en Chasse, chaque entite portait son type et un vrai joueur son pseudo, si bien
 * qu'un traqueur qui ouvrait les outils de son navigateur savait quels ninjas etaient des
 * proies. Desormais, le serveur decide ce que chacun recoit.
 *
 * UNE VUE PAR CLE. cleDeVue dit quelle vue un joueur recoit; les joueurs qui partagent une
 * cle recoivent la meme trame, codee une fois (FluxParVue, dans fluxDEtat.ts). Hors Chasse,
 * tout le monde a la vue commune, celle qu'instantaneDe decrit: une seule trame, comme
 * avant. Un mode a secrets n'a qu'a dire ici ses cles et ses vues.
 *
 * EN CHASSE, DEUX VUES.
 *
 *   - La vue commune va aux proies, qui voient leur camp, et a un traqueur sous Revelation:
 *     le bonus montre les vrais joueurs, que la page entoure d'un halo.
 *   - La vue des traqueurs va aux autres traqueurs, elimines compris, et a tout destinataire
 *     que l'etat ne connait pas: le plus restrictif par defaut. Une proie y est un PNJ comme
 *     les autres. Chaque ninja, PNJ ou proie, y porte un alias, et les ninjas s'y rangent
 *     dans l'ordre de leurs alias: ni la forme d'un identifiant, ni une place dans la liste
 *     ne distingue une proie. Une proie cachee dans une zone d'invisibilite en est absente,
 *     comme la page l'effacait.
 *
 * Sa couleur ne la trahit pas non plus: chaque PNJ de la Chasse nait de la couleur d'un
 * joueur (couleurDeSosie, dans le moteur). Le classement reste le meme pour tous: il dit
 * qui joue et combien il a de points, pas ou il est.
 *
 * CE QUI RESTE, ET POURQUOI. Ce qu'un joueur a vu legitimement, il le garde: une proie
 * infectee, ou un traqueur sous Revelation, a vu ou etaient les proies, et les positions se
 * suivent d'un battement a l'autre. Changer les alias n'y ferait rien. Le flux ne lui en dit
 * pas plus que ses yeux; un client modifie ne les perd simplement pas dans la foule.
 *
 * TOUT CE FICHIER EST PUR, une fois le secret des alias tire: le serveur le tire au hasard
 * pour chaque partie, et un condense a cle ne depend que de lui et de l'identifiant.
 */

import { createHmac } from 'node:crypto';

import type { BotVu, EntiteVue, InstantanePartie, JoueurVu } from '@neon-ninja/shared';
import type { EtatPartie, IdentifiantEntite } from '@neon-ninja/sim';
import { bonusActif, estCache, estTraqueur } from '@neon-ninja/sim';

import type { Notification } from './instantane.js';
import { instantaneDe } from './instantane.js';

/**
 * Le nom d'une vue. Les destinataires qui partagent une cle recoivent la meme trame. Une
 * chaine, et non une liste fermee: un mode a venir pourra donner a chaque joueur la sienne.
 */
export type CleDeVue = string;

/** La vue de tout le monde hors Chasse, et des proies en Chasse. */
export const VUE_COMMUNE: CleDeVue = 'commune';

/** La vue des traqueurs de la Chasse, ou les proies sont des PNJ. */
export const VUE_DES_TRAQUEURS: CleDeVue = 'traqueurs';

/** L'alias d'un ninja dans la vue des traqueurs: toujours le meme pour un meme identifiant. */
export type Alias = (id: IdentifiantEntite) => string;

/** Combien d'octets de hasard au moins pour le secret d'une partie. */
export const OCTETS_DU_SECRET = 16;

/** Combien de chiffres hexadecimaux du condense un alias garde: 48 bits. */
const CHIFFRES_D_UN_ALIAS = 12;

/**
 * Les alias des ninjas d'une partie.
 *
 * STABLES, pour que le lissage de la page et le delta suivent un ninja d'un battement a
 * l'autre. IMPREVISIBLES: le condense a cle (HMAC-SHA256) de l'identifiant, sous un secret
 * propre a la partie, si bien qu'on ne peut pas recalculer l'alias d'un PNJ dont on connait
 * l'identifiant, et designer les proies par elimination. UNIQUES dans la partie: une
 * collision, une chance sur des milliers de milliards, se regle en recondensant.
 *
 * @param secret Des octets tires au hasard pour cette partie, et pour elle seule.
 */
export function aliasDesNinjas(secret: Uint8Array): Alias {
  if (secret.length < OCTETS_DU_SECRET) {
    throw new Error(
      `Le secret des alias doit compter au moins ${String(OCTETS_DU_SECRET)} octets.`,
    );
  }

  const connus = new Map<IdentifiantEntite, string>();
  const pris = new Set<string>();

  return (id) => {
    const connu = connus.get(id);

    if (connu !== undefined) {
      return connu;
    }

    let essai = 0;
    let alias = condense(secret, id, essai);

    while (pris.has(alias)) {
      essai += 1;
      alias = condense(secret, id, essai);
    }

    connus.set(id, alias);
    pris.add(alias);

    return alias;
  };
}

/** Un alias candidat pour cet identifiant: le condense du secret, du rang de l'essai et de lui. */
function condense(secret: Uint8Array, id: IdentifiantEntite, essai: number): string {
  const empreinte = createHmac('sha256', secret)
    .update(`${String(essai)}:${id}`)
    .digest('hex');

  return `pnj-${empreinte.slice(0, CHIFFRES_D_UN_ALIAS)}`;
}

/**
 * La vue que recoit ce joueur.
 *
 * La vue commune hors d'une Chasse lancee. En Chasse: la vue commune pour une proie et pour
 * un traqueur sous Revelation, celle des traqueurs pour les autres traqueurs, elimines
 * compris, et pour un identifiant que l'etat ne connait pas.
 */
export function cleDeVue(etat: EtatPartie, destinataire: IdentifiantEntite): CleDeVue {
  if (etat.mode !== 'chasse' || etat.chasse === undefined) {
    return VUE_COMMUNE;
  }

  const joueur = etat.joueurs[destinataire];

  if (joueur === undefined) {
    return VUE_DES_TRAQUEURS;
  }

  return !estTraqueur(etat, destinataire) || bonusActif(joueur, 'revelation')
    ? VUE_COMMUNE
    : VUE_DES_TRAQUEURS;
}

/**
 * Les vues d'un battement, une par cle demandee, chacune construite une fois.
 *
 * La vue commune se construit des qu'une vue est demandee, meme si personne ne la recoit:
 * celle des traqueurs en part. Sans cle, rien ne se construit.
 */
export function vuesDe(
  etat: EtatPartie,
  cles: Iterable<CleDeVue>,
  alias: Alias,
): ReadonlyMap<CleDeVue, InstantanePartie> {
  const vues = new Map<CleDeVue, InstantanePartie>();
  let commune: InstantanePartie | undefined;

  for (const cle of cles) {
    if (!vues.has(cle)) {
      commune ??= instantaneDe(etat);
      vues.set(cle, cle === VUE_COMMUNE ? commune : vueDesTraqueurs(etat, commune, alias));
    }
  }

  return vues;
}

/** La vue de ce joueur, seule: ce que sa trame decrit. */
export function vuePour(
  etat: EtatPartie,
  destinataire: IdentifiantEntite,
  alias: Alias,
): InstantanePartie {
  const commune = instantaneDe(etat);

  return cleDeVue(etat, destinataire) === VUE_COMMUNE
    ? commune
    : vueDesTraqueurs(etat, commune, alias);
}

/**
 * La vue des traqueurs, tiree de la vue commune du meme battement.
 *
 * Les traqueurs d'abord, tels quels, puis les ninjas ranges par alias, puis le reste dans
 * l'ordre de la vue commune: l'Evade, les mines posees, dont le poseur passe par l'alias,
 * et les mines de zone.
 */
function vueDesTraqueurs(
  etat: EtatPartie,
  commune: InstantanePartie,
  alias: Alias,
): InstantanePartie {
  const masquer = masqueDesTraqueurs(etat, alias);
  const traqueurs: EntiteVue[] = [];
  const ninjas: BotVu[] = [];
  const reste: EntiteVue[] = [];

  for (const entite of commune.entites) {
    switch (entite.type) {
      case 'joueur':
        if (estTraqueur(etat, entite.id)) {
          traqueurs.push(entite);
        } else if (!estCache(etat, { x: entite.x, y: entite.y })) {
          ninjas.push(commeUnNinja(entite, alias));
        }
        break;
      case 'bot':
      case 'botNoir':
        ninjas.push({ ...entite, id: alias(entite.id) });
        break;
      case 'mine':
        reste.push({ ...entite, poseur: masquer(entite.poseur) });
        break;
      case 'evade':
      case 'mineDeZone':
        reste.push(entite);
        break;
    }
  }

  ninjas.sort((un, autre) => (un.id < autre.id ? -1 : un.id > autre.id ? 1 : 0));

  return { ...commune, entites: [...traqueurs, ...ninjas, ...reste] };
}

/**
 * Une proie telle qu'un traqueur la voit: un PNJ, sous son alias. Ni pseudo, ni protection,
 * ni invincibilite, que la page ne dessinait pas sur les autres.
 */
function commeUnNinja(proie: JoueurVu, alias: Alias): BotVu {
  return {
    type: 'bot',
    id: alias(proie.id),
    x: proie.x,
    y: proie.y,
    couleur: proie.couleur,
    direction: proie.direction,
  };
}

/**
 * Le masque des identifiants pour la vue des traqueurs: un traqueur garde le sien, public;
 * tout autre, proie, PNJ ou joueur parti, prend son alias.
 */
function masqueDesTraqueurs(etat: EtatPartie, alias: Alias): Alias {
  return (id) => (estTraqueur(etat, id) ? id : alias(id));
}

/**
 * Une notification telle que la vue de son destinataire la montre.
 *
 * La vue commune la laisse telle quelle. La vue des traqueurs fait passer par l'alias chaque
 * identifiant d'entite qu'elle nomme, comme dans les trames: une fumee, une mine armee ou
 * une explosion ne relie pas un ninja a un joueur. Les pseudos restent: ils disent qui, pas
 * ou. Chaque notification est nommee, pour qu'une nouvelle ne puisse pas etre oubliee.
 */
export function notificationDansLaVue(
  notification: Notification,
  etat: EtatPartie,
  cle: CleDeVue,
  alias: Alias,
): Notification {
  if (cle === VUE_COMMUNE) {
    return notification;
  }

  const masquer = masqueDesTraqueurs(etat, alias);

  switch (notification.nom) {
    case 'captureSubie':
    case 'captureReussie':
    case 'captureParBotNoir':
    case 'botNoirDetruit':
    case 'bonusActive':
    case 'malusRamasse':
    case 'malusSubi':
    case 'vieDeTraqueurPerdue':
    case 'carteVidee':
    case 'ralliement':
    case 'objetEmpoche':
    case 'minePosee':
      // Rien qui designe une autre entite qu'un identifiant de mine ou un pseudo.
      return notification;

    case 'botNoirTouche':
      return {
        ...notification,
        charge: { ...notification.charge, botNoir: masquer(notification.charge.botNoir) },
      };

    case 'tirDeCapture':
      return {
        ...notification,
        charge: { ...notification.charge, tireur: masquer(notification.charge.tireur) },
      };

    case 'coupDeKatana':
      return {
        ...notification,
        charge: {
          ...notification.charge,
          frappeur: masquer(notification.charge.frappeur),
          morts: notification.charge.morts.map((mort) => ({ ...mort, id: masquer(mort.id) })),
        },
      };

    case 'joueurTranche':
      return {
        ...notification,
        charge: {
          ...notification.charge,
          attaquant: masquer(notification.charge.attaquant),
          victime: masquer(notification.charge.victime),
        },
      };

    case 'evade':
      return { ...notification, charge: evadeMasque(notification.charge, masquer) };

    case 'fumee':
      return {
        ...notification,
        charge: { ...notification.charge, joueur: masquer(notification.charge.joueur) },
      };

    case 'mineArmee':
      return {
        ...notification,
        charge: {
          ...notification.charge,
          poseur: masquer(notification.charge.poseur),
          par: masquer(notification.charge.par),
        },
      };

    case 'mineExplosee':
      return {
        ...notification,
        charge: {
          ...notification.charge,
          poseur: masquer(notification.charge.poseur),
          touches: notification.charge.touches.map((touche) => ({
            ...touche,
            joueur: masquer(touche.joueur),
          })),
        },
      };

    case 'mineDeZone': {
      const { par } = notification.charge;

      return par === undefined
        ? notification
        : { ...notification, charge: { ...notification.charge, par: masquer(par) } };
    }
  }
}

/** Ce qui arrive au x2 de l'Evade, les joueurs nommes passes par le masque. */
function evadeMasque(
  charge: Extract<Notification, { nom: 'evade' }>['charge'],
  masquer: Alias,
): Extract<Notification, { nom: 'evade' }>['charge'] {
  switch (charge.quoi) {
    case 'apparu':
    case 'enfui':
      return charge;
    case 'attrape':
      return { ...charge, par: masquer(charge.par) };
    case 'perdu':
      return { ...charge, de: masquer(charge.de) };
    case 'vole':
      return { ...charge, par: masquer(charge.par), de: masquer(charge.de) };
  }
}
