/**
 * Les zones speciales: des disques poses sur la carte, qui agissent sur ce qui
 * s'y trouve.
 *
 * Portage de la classe SpecialZone (legacy/server.js:487), de manageSpecialZones
 * (:803) et de l'application de leurs effets, qui vivait au milieu de sendUpdates
 * (:1809), c'est-a-dire dans la fonction chargee d'envoyer l'etat aux clients.
 *
 * LES QUATRE ZONES, EN UNE PHRASE CHACUNE.
 *
 *   - chaos: repeint au hasard les bots qui la traversent, donc fait fondre les
 *     scores de ceux qui les possedaient.
 *   - repulsion: les joueurs presents dans la zone repoussent les bots qui s'y
 *     trouvent.
 *   - attraction: les bots de la zone sont attires par le joueur le plus proche,
 *     ou qu'il soit.
 *   - invisibilite: les joueurs qui s'y trouvent ne sont plus dessines chez les
 *     autres joueurs, ce que le client calcule a partir des zones qu'il recoit
 *     (defaut X22 de l'audit). Depuis le 9 octobre 2026, la zone cache aussi aux
 *     Black Ninjas les joueurs et les bots qui s'y trouvent, et a l'Evade les
 *     joueurs: c'est le seul effet qu'elle a dans le moteur, lu par bots.ts et
 *     evade.ts au travers d'estCache. Elle ne pousse ni ne repeint rien.
 *
 * DEUX CHOSES QUE LE PORTAGE CHANGE, ET POURQUOI.
 *
 * 1. Les forces s'expriment par seconde, pas par battement. Le legacy poussait un
 *    bot de trois ou quatre pixels a chaque passage de sa boucle, sans jamais
 *    regarder le temps. Meme raison que pour les vitesses (defaut X17): le moteur
 *    avance proportionnellement au temps ecoule.
 *
 * 2. Un bot pousse par une zone ne traverse plus les murs. Le legacy ajoutait la
 *    poussee directement aux coordonnees, sans consulter le terrain; ici elle
 *    passe par la resolution de deplacement, comme tout autre mouvement.
 *
 * Les bots noirs sont indifferents aux zones: le legacy ne leur appliquait aucun
 * effet, parce qu'ils vivaient dans une table que sendUpdates ne passait pas aux
 * zones. Ce comportement est conserve.
 *
 * DEPUIS L'ETAPE 7.12, UNE ZONE NE NAIT PLUS SEULE. Le legacy en faisait apparaitre une
 * toutes les quinze secondes, trois au plus, d'un rayon tire au hasard, ou que ce soit
 * (manageSpecialZones et generateRandomShape, :803 et :513). A la place, et par decision du
 * porteur du projet du 28 septembre 2026 (docs/plan/etape-7-12.md), la carte pose au meme
 * rythme une MINE DE ZONE, visible de tous, qui porte la nature de la zone qu'elle cache:
 *
 *   - elle se pose loin des joueurs, des Black Ninjas et des autres mines de zone, tant que
 *     celles qui attendent sont moins que le plafond regle (trois par defaut);
 *   - un joueur en jeu, de tout camp, ou un Black Ninja qui passe dessus l'arme; ni un faux
 *     ninja ni l'Evade;
 *   - armee, elle s'ouvre trois secondes plus tard: sa zone se pose a sa place, d'un rayon
 *     fixe de 220 pixels, pour une duree tiree comme avant entre les deux durees reglees.
 *
 * Les zones ouvertes n'ont pas de plafond propre: le plafond des mines borne leur nombre.
 * Ce qu'une zone fait, une fois ouverte, ne change pas. C'est un ecart voulu au legacy, que
 * les tests de caracterisation continuent d'observer tel qu'il etait.
 */

import type { Position } from '@neon-ninja/shared';
import {
  CADENCES_LEGACY_MS,
  MINES_DE_ZONE,
  TYPES_ZONE,
  ZONES,
  element,
  nombre,
  reel,
} from '@neon-ninja/shared';

import { couleurUnique } from './couleurs.js';
import { resoudreDeplacement } from './deplacement.js';
import type {
  Bot,
  EtatPartie,
  IdentifiantEntite,
  Joueur,
  MineDeZone,
  ZoneSpeciale,
} from './etat.js';
import { couleursUtilisees, identifiantSuivant, positionDApparition } from './etat.js';
import { avancerUneEcheance, intervalleFixe } from './planification.js';

/** Une position est-elle dans la zone ? Portage de isEntityInside (legacy :542). */
export function zoneContient(zone: ZoneSpeciale, position: Position): boolean {
  return Math.hypot(position.x - zone.centre.x, position.y - zone.centre.y) <= zone.rayon;
}

/**
 * Une zone d'invisibilite couvre-t-elle cette position ? Le client s'en sert pour dessiner,
 * les Black Ninjas et l'Evade pour ne pas voir ce qui s'y cache.
 */
export function estCache(etat: EtatPartie, position: Position): boolean {
  return Object.values(etat.zones).some(
    (zone) => zone.type === 'invisibilite' && zoneContient(zone, position),
  );
}

/**
 * Fait vivre les zones et leurs mines (etape 7.12): les zones ouvertes s'expirent, les mines
 * armees s'ouvrent a leur heure, celles qu'un joueur ou un Black Ninja touche s'arment, et la
 * carte pose une mine nouvelle au rythme regle.
 *
 * Quand les zones sont desactivees dans les reglages, la carte se vide, zones et mines,
 * comme le faisait manageSpecialZones (legacy :804) pour les zones.
 *
 * @param horsJeu Les joueurs hors jeu (les traqueurs elimines, en Chasse): ils n'arment rien.
 */
export function avancerLesZones(
  etat: EtatPartie,
  dtMs: number,
  horsJeu: ReadonlySet<IdentifiantEntite> = new Set(),
): EtatPartie {
  if (!etat.reglages.zones.actives) {
    return viderLesZones(etat);
  }

  return avancerUneEcheance(
    armerLesMinesDeZone(
      ouvrirLesMinesArmees(fairePasserLeTempsSurLesZones(etat, dtMs), dtMs),
      horsJeu,
    ),
    dtMs,
    'zoneMs',
    (alea) => intervalleFixe(alea, etat.reglages.zones.intervalleApparitionS),
    poserUneMineDeZone,
  );
}

/** Zones coupees: ni zone ni mine de zone. L'etat est rendu tel quel s'il n'y en a pas. */
function viderLesZones(etat: EtatPartie): EtatPartie {
  if (Object.keys(etat.zones).length === 0 && etat.minesDeZone === undefined) {
    return etat;
  }

  return avecLesMinesDeZone({ ...etat, zones: {} }, {});
}

/**
 * L'etat avec ces mines de zone. Sans aucune mine, le champ disparait au lieu de valoir une
 * table vide: une partie dont toutes les mines se sont ouvertes redevient une partie sans.
 */
function avecLesMinesDeZone(
  etat: EtatPartie,
  mines: Readonly<Record<IdentifiantEntite, MineDeZone>>,
): EtatPartie {
  if (Object.keys(mines).length > 0) {
    return { ...etat, minesDeZone: mines };
  }

  const { minesDeZone: _videes, ...reste } = etat;
  return reste;
}

/** Retranche le temps ecoule a chaque zone et retire celles dont la duree est passee. */
function fairePasserLeTempsSurLesZones(etat: EtatPartie, dtMs: number): EtatPartie {
  if (Object.keys(etat.zones).length === 0) {
    return etat;
  }

  const zones: Record<IdentifiantEntite, ZoneSpeciale> = {};

  for (const [id, zone] of Object.entries(etat.zones)) {
    const restante = zone.dureeRestanteMs - dtMs;
    if (restante > 0) {
      zones[id] = { ...zone, dureeRestanteMs: restante };
    }
  }

  return { ...etat, zones };
}

/**
 * Les mines de zone armees se rapprochent de leur ouverture; celles dont l'heure est venue
 * quittent la carte et ouvrent leur zone a leur place, dans l'ordre de leur pose.
 */
function ouvrirLesMinesArmees(etat: EtatPartie, dtMs: number): EtatPartie {
  const posees = etat.minesDeZone;

  // Aucune mine armee: rien ne change, et la table n'est pas recopiee.
  if (
    posees === undefined ||
    Object.values(posees).every((mine) => mine.avantOuvertureMs === undefined)
  ) {
    return etat;
  }

  const mines: Record<IdentifiantEntite, MineDeZone> = {};
  const aOuvrir: MineDeZone[] = [];

  for (const [id, mine] of Object.entries(posees)) {
    if (mine.avantOuvertureMs === undefined) {
      mines[id] = mine;
      continue;
    }

    const avantOuvertureMs = mine.avantOuvertureMs - dtMs;

    if (avantOuvertureMs > 0) {
      mines[id] = { ...mine, avantOuvertureMs };
    } else {
      aOuvrir.push(mine);
    }
  }

  let courant = avecLesMinesDeZone(etat, mines);

  for (const mine of aOuvrir) {
    courant = ouvrirUneZone(courant, mine);
  }

  return courant;
}

/**
 * Une mine de zone s'ouvre: sa zone se pose a sa place, au rayon fixe, pour une duree tiree
 * entre les deux durees reglees, arrondie a la milliseconde inferieure comme dans le legacy.
 */
function ouvrirUneZone(etat: EtatPartie, mine: MineDeZone): EtatPartie {
  const reglages = etat.reglages.zones;
  const duree = reel(etat.alea, reglages.dureeMinimumS * 1000, reglages.dureeMaximumS * 1000);
  const identifiant = identifiantSuivant(etat, 'zone');
  const zone: ZoneSpeciale = {
    id: identifiant.valeur,
    type: mine.nature,
    centre: mine.position,
    rayon: ZONES.RAYON_PX,
    dureeRestanteMs: Math.floor(duree.valeur),
  };

  return {
    ...etat,
    zones: { ...etat.zones, [identifiant.valeur]: zone },
    compteurIdentifiants: identifiant.compteur,
    alea: duree.alea,
    evenements: [
      ...etat.evenements,
      {
        type: 'zoneOuverte',
        mine: mine.id,
        zone: identifiant.valeur,
        nature: mine.nature,
        position: mine.position,
      },
    ],
  };
}

/**
 * Les mines de zone qui attendent et qu'un joueur en jeu ou un Black Ninja touche s'arment.
 * Tout joueur, de tout camp, arme une mine de zone: elle n'a pas de poseur. Ni les faux
 * ninjas ni l'Evade ne l'arment (decisions 2 et 3 du porteur du projet).
 */
function armerLesMinesDeZone(
  etat: EtatPartie,
  horsJeu: ReadonlySet<IdentifiantEntite>,
): EtatPartie {
  const posees = etat.minesDeZone;

  if (posees === undefined) {
    return etat;
  }

  const mines: Record<IdentifiantEntite, MineDeZone> = {};
  const evenements = [...etat.evenements];
  // Les Black Ninjas, releves une fois pour toutes les mines, comme pour les mines posees.
  const botsNoirs = Object.values(etat.bots).filter((bot) => bot.type === 'botNoir');
  let arme = false;

  for (const [id, mine] of Object.entries(posees)) {
    const par =
      mine.avantOuvertureMs === undefined ? quiLArme(etat, mine, horsJeu, botsNoirs) : undefined;

    if (par === undefined) {
      mines[id] = mine;
      continue;
    }

    arme = true;
    mines[id] = { ...mine, avantOuvertureMs: MINES_DE_ZONE.DELAI_AVANT_OUVERTURE_MS };
    evenements.push({
      type: 'mineDeZoneArmee',
      mine: id,
      nature: mine.nature,
      par,
      position: mine.position,
    });
  }

  // Aucune mine armee dans ce battement: l'etat est rendu tel quel, sans copie.
  return arme ? { ...etat, minesDeZone: mines, evenements } : etat;
}

/**
 * L'entite qui arme cette mine dans ce battement, s'il y en a une: le premier joueur en jeu
 * qui la touche, dans l'ordre des joueurs, sinon le premier Black Ninja.
 */
function quiLArme(
  etat: EtatPartie,
  mine: MineDeZone,
  horsJeu: ReadonlySet<IdentifiantEntite>,
  botsNoirs: readonly Bot[],
): IdentifiantEntite | undefined {
  for (const joueur of Object.values(etat.joueurs)) {
    if (!horsJeu.has(joueur.id) && surLaMine(joueur.position, mine.position)) {
      return joueur.id;
    }
  }

  for (const bot of botsNoirs) {
    if (surLaMine(bot.position, mine.position)) {
      return bot.id;
    }
  }

  return undefined;
}

/**
 * Cette entite touche-t-elle la mine ? Au seuil du contact, en inegalite stricte, avec le
 * meme prefiltre par axe que les mines posees (mines.ts).
 */
function surLaMine(entite: Position, mine: Position): boolean {
  const ecartX = entite.x - mine.x;
  const ecartY = entite.y - mine.y;
  const seuil = MINES_DE_ZONE.SEUIL_ARMEMENT_PX;

  if (ecartX >= seuil || ecartX <= -seuil || ecartY >= seuil || ecartY <= -seuil) {
    return false;
  }

  return Math.hypot(ecartX, ecartY) < seuil;
}

/**
 * La carte pose une mine de zone, si celles qui attendent sont moins que le plafond regle.
 * Les mines armees ne comptent plus: leur zone est deja promise.
 *
 * La nature se tire d'abord, parmi les natures cochees, puis la place, loin des joueurs, des
 * Black Ninjas et des autres mines de zone (positionDApparition et sa distance de securite):
 * personne ne l'arme en naissant, et deux mines ne se collent pas.
 */
function poserUneMineDeZone(etat: EtatPartie): EtatPartie {
  const reglages = etat.reglages.zones;
  const naturesActives = TYPES_ZONE.filter((nature) => reglages.types[nature]);

  if (naturesActives.length === 0) {
    return etat;
  }

  const posees = Object.values(etat.minesDeZone ?? {});
  const enAttente = posees.filter((mine) => mine.avantOuvertureMs === undefined).length;

  if (enAttente >= reglages.minesMaximum) {
    return etat;
  }

  const nature = element(etat.alea, naturesActives);
  const occupees = [
    ...Object.values(etat.joueurs).map((joueur) => joueur.position),
    ...Object.values(etat.bots)
      .filter((bot) => bot.type === 'botNoir')
      .map((bot) => bot.position),
    ...posees.map((mine) => mine.position),
  ];
  const place = positionDApparition(nature.alea, etat.terrain, occupees);
  const identifiant = identifiantSuivant(etat, 'mineDeZone');
  const mine: MineDeZone = {
    id: identifiant.valeur,
    nature: nature.valeur,
    position: place.valeur,
  };

  return {
    ...avecLesMinesDeZone(etat, { ...etat.minesDeZone, [mine.id]: mine }),
    compteurIdentifiants: identifiant.compteur,
    alea: place.alea,
    evenements: [
      ...etat.evenements,
      { type: 'mineDeZonePosee', mine: mine.id, nature: mine.nature, position: mine.position },
    ],
  };
}

/** Applique l'effet de chaque zone a ce qu'elle contient. */
export function appliquerLesEffetsDeZone(etat: EtatPartie, dtMs: number): EtatPartie {
  let courant = etat;

  for (const zone of Object.values(etat.zones)) {
    courant = appliquerUneZone(courant, zone, dtMs);
  }

  return courant;
}

/**
 * Aiguille vers l'effet de la zone. L'invisibilite n'agit sur rien a chaque battement: ce
 * sont les Black Ninjas et l'Evade qui la consultent en cherchant qui voir (estCache).
 */
function appliquerUneZone(etat: EtatPartie, zone: ZoneSpeciale, dtMs: number): EtatPartie {
  switch (zone.type) {
    case 'chaos':
      return semerLeChaos(etat, zone, dtMs);
    case 'repulsion':
      return repousser(etat, zone, dtMs);
    case 'attraction':
      return attirer(etat, zone, dtMs);
    case 'invisibilite':
      return etat;
  }
}

/** Les bots ordinaires presents dans la zone. Les bots noirs y sont insensibles. */
function botsDansLaZone(etat: EtatPartie, zone: ZoneSpeciale): readonly Bot[] {
  return Object.values(etat.bots).filter(
    (bot) => bot.type === 'bot' && zoneContient(zone, bot.position),
  );
}

/**
 * Zone de chaos: chaque bot present peut changer de couleur, au hasard.
 *
 * Le legacy tirait cinq chances sur cent par bot et par battement de cinquante
 * millisecondes. Cette probabilite est ici ramenee au temps reellement ecoule,
 * pour que le chaos ne depende pas de la cadence d'appel du moteur: sur deux fois
 * plus de temps, un bot a bien deux fois plus de chances d'avoir change, et non
 * deux fois plus de tirages.
 *
 * La couleur tiree evite celles des joueurs presents, comme getUniqueColor dans
 * le legacy: un bot devenu chaotique ne compte donc pour personne, et le score de
 * celui qui le possedait baisse d'autant.
 */
function semerLeChaos(etat: EtatPartie, zone: ZoneSpeciale, dtMs: number): EtatPartie {
  const probabilite =
    1 -
    Math.pow(1 - ZONES.CHAOS_PROBABILITE_PAR_BATTEMENT, dtMs / CADENCES_LEGACY_MS.BOUCLE_SERVEUR);

  let courant = etat;

  for (const bot of botsDansLaZone(etat, zone)) {
    const tirage = nombre(courant.alea);
    courant = { ...courant, alea: tirage.alea };

    if (tirage.valeur < probabilite) {
      const teinte = couleurUnique(courant.alea, couleursUtilisees(courant));
      courant = {
        ...courant,
        bots: { ...courant.bots, [bot.id]: { ...bot, couleur: teinte.valeur } },
        alea: teinte.alea,
      };
    }
  }

  return courant;
}

/**
 * Zone de repulsion: les joueurs qui s'y trouvent repoussent les bots qui s'y
 * trouvent aussi.
 *
 * Chaque joueur a portee pousse le bot en ligne droite, avec la meme force quelle
 * que soit la distance; c'est la somme des poussees qui est ensuite plafonnee.
 * C'est exactement la formule du legacy, ou la force divisee par la distance
 * multipliait un ecart lui-meme egal a la distance.
 */
function repousser(etat: EtatPartie, zone: ZoneSpeciale, dtMs: number): EtatPartie {
  const joueursPresents = Object.values(etat.joueurs).filter((joueur) =>
    zoneContient(zone, joueur.position),
  );

  if (joueursPresents.length === 0) {
    return etat;
  }

  let courant = etat;

  for (const bot of botsDansLaZone(etat, zone)) {
    let poussee = { x: 0, y: 0 };

    for (const joueur of joueursPresents) {
      const ecart = {
        x: bot.position.x - joueur.position.x,
        y: bot.position.y - joueur.position.y,
      };
      const distance = Math.hypot(ecart.x, ecart.y);

      if (distance > 0 && distance < ZONES.REPULSION.PORTEE_PX) {
        const facteur = ZONES.REPULSION.FORCE_PX_PAR_SECONDE / distance;
        poussee = { x: poussee.x + ecart.x * facteur, y: poussee.y + ecart.y * facteur };
      }
    }

    if (poussee.x !== 0 || poussee.y !== 0) {
      courant = deplacerLeBot(courant, bot, {
        x: (borner(poussee.x, ZONES.REPULSION.PLAFOND_PX_PAR_SECONDE) * dtMs) / 1000,
        y: (borner(poussee.y, ZONES.REPULSION.PLAFOND_PX_PAR_SECONDE) * dtMs) / 1000,
      });
    }
  }

  return courant;
}

/**
 * Zone d'attraction: les bots presents vont vers le joueur le plus proche.
 *
 * Le joueur le plus proche est cherche sur toute la carte, pas seulement dans la
 * zone: c'est ce que fait le legacy, et cela se defend, une zone d'attraction
 * doit pouvoir aspirer les bots vers un joueur qui l'attend au bord.
 */
function attirer(etat: EtatPartie, zone: ZoneSpeciale, dtMs: number): EtatPartie {
  const joueurs = Object.values(etat.joueurs);
  if (joueurs.length === 0) {
    return etat;
  }

  let courant = etat;

  for (const bot of botsDansLaZone(etat, zone)) {
    const cible = leJoueurLePlusProche(joueurs, bot.position);
    const ecart = { x: cible.position.x - bot.position.x, y: cible.position.y - bot.position.y };
    const distance = Math.hypot(ecart.x, ecart.y);

    if (distance === 0) {
      continue;
    }

    const pas = (ZONES.ATTRACTION.FORCE_PX_PAR_SECONDE * dtMs) / 1000 / distance;
    courant = deplacerLeBot(courant, bot, { x: ecart.x * pas, y: ecart.y * pas });
  }

  return courant;
}

/** Le joueur le plus proche d'une position. La liste ne doit pas etre vide. */
function leJoueurLePlusProche(joueurs: readonly Joueur[], position: Position): Joueur {
  let plusProche = joueurs[0] as Joueur;
  let meilleure = Infinity;

  for (const joueur of joueurs) {
    const distance = Math.hypot(joueur.position.x - position.x, joueur.position.y - position.y);
    if (distance < meilleure) {
      meilleure = distance;
      plusProche = joueur;
    }
  }

  return plusProche;
}

/** Deplace un bot d'un pas impose par une zone, en tenant compte des murs. */
function deplacerLeBot(etat: EtatPartie, bot: Bot, pas: Position): EtatPartie {
  const position = resoudreDeplacement(etat.terrain, bot.position, pas);

  return { ...etat, bots: { ...etat.bots, [bot.id]: { ...bot, position } } };
}

/** Ramene une valeur entre moins la borne et plus la borne. */
function borner(valeur: number, borne: number): number {
  return Math.min(Math.max(valeur, -borne), borne);
}
