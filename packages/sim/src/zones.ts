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
 *   - invisibilite: les joueurs qui s'y trouvent ne sont plus dessines. Aucun
 *     effet sur les regles du jeu, donc aucun effet dans le moteur; c'est le
 *     client qui le calcule a partir des zones qu'il recoit. Voir le defaut X22
 *     de l'audit.
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
 */

import type { Position } from '@neon-ninja/shared';
import { CADENCES_LEGACY_MS, TYPES_ZONE, ZONES, element, nombre, reel } from '@neon-ninja/shared';

import { couleurUnique } from './couleurs.js';
import { resoudreDeplacement } from './deplacement.js';
import type { Bot, EtatPartie, IdentifiantEntite, Joueur, ZoneSpeciale } from './etat.js';
import { couleursUtilisees, identifiantSuivant } from './etat.js';
import { avancerUneEcheance, intervalleFixe } from './planification.js';

/** Une position est-elle dans la zone ? Portage de isEntityInside (legacy :542). */
export function zoneContient(zone: ZoneSpeciale, position: Position): boolean {
  return Math.hypot(position.x - zone.centre.x, position.y - zone.centre.y) <= zone.rayon;
}

/** Les zones d'invisibilite qui couvrent cette position. Le client s'en sert pour dessiner. */
export function estCache(etat: EtatPartie, position: Position): boolean {
  return Object.values(etat.zones).some(
    (zone) => zone.type === 'invisibilite' && zoneContient(zone, position),
  );
}

/**
 * Fait vivre les zones: les expire, puis en fait apparaitre de nouvelles.
 *
 * Quand les zones sont desactivees dans les reglages, la carte se vide, comme le
 * faisait manageSpecialZones (legacy :804).
 */
export function avancerLesZones(etat: EtatPartie, dtMs: number): EtatPartie {
  if (!etat.reglages.zones.actives) {
    return Object.keys(etat.zones).length === 0 ? etat : { ...etat, zones: {} };
  }

  return avancerUneEcheance(
    fairePasserLeTempsSurLesZones(etat, dtMs),
    dtMs,
    'zoneMs',
    (alea) => intervalleFixe(alea, etat.reglages.zones.intervalleApparitionS),
    faireApparaitreUneZone,
  );
}

/** Retranche le temps ecoule a chaque zone et retire celles dont la duree est passee. */
function fairePasserLeTempsSurLesZones(etat: EtatPartie, dtMs: number): EtatPartie {
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
 * Fait apparaitre une zone, si le plafond de trois n'est pas atteint.
 *
 * L'ordre des tirages est celui du legacy: la nature, la duree, puis la forme.
 * Le respecter n'est pas de la coquetterie: c'est ce qui fait qu'une partie
 * rejouee avec la meme graine produit exactement les memes zones.
 */
function faireApparaitreUneZone(etat: EtatPartie): EtatPartie {
  const reglages = etat.reglages.zones;
  const naturesActives = TYPES_ZONE.filter((nature) => reglages.types[nature]);

  if (naturesActives.length === 0) {
    return etat;
  }

  if (Object.keys(etat.zones).length >= ZONES.SIMULTANEES_MAXIMUM) {
    return etat;
  }

  const nature = element(etat.alea, naturesActives);
  const duree = reel(nature.alea, reglages.dureeMinimumS * 1000, reglages.dureeMaximumS * 1000);
  const forme = tirerUneForme(etat, duree.alea);

  const identifiant = identifiantSuivant(etat, 'zone');
  const zone: ZoneSpeciale = {
    id: identifiant.valeur,
    type: nature.valeur,
    centre: forme.centre,
    rayon: forme.rayon,
    // Le legacy arrondissait la duree a la milliseconde inferieure.
    dureeRestanteMs: Math.floor(duree.valeur),
  };

  return {
    ...etat,
    zones: { ...etat.zones, [identifiant.valeur]: zone },
    compteurIdentifiants: identifiant.compteur,
    alea: forme.alea,
  };
}

/**
 * Tire la taille et la place d'une zone.
 *
 * Portage de generateRandomShape (legacy :513): une zone couvre au plus un
 * cinquieme de la carte, mesure cent cinquante pixels de rayon au minimum, et se
 * pose entierement a l'interieur de la carte.
 *
 * Une precaution que le legacy n'avait pas: sur une carte assez petite pour que
 * le cinquieme d'aire descende sous le rayon minimal, le tirage du legacy aurait
 * produit un rayon plus grand que la carte, donc une zone impossible a placer. Le
 * rayon est ici plafonne a la moitie du plus petit cote.
 */
function tirerUneForme(
  etat: EtatPartie,
  alea: EtatPartie['alea'],
): { readonly centre: Position; readonly rayon: number; readonly alea: EtatPartie['alea'] } {
  const { largeur, hauteur } = etat.carte;
  const rayonParLAire = Math.sqrt((largeur * hauteur) / ZONES.PART_DE_CARTE / Math.PI);
  const rayonMaximum = Math.max(
    ZONES.RAYON_MINIMUM_PX,
    Math.min(rayonParLAire, Math.min(largeur, hauteur) / 2),
  );

  const rayon = reel(alea, ZONES.RAYON_MINIMUM_PX, rayonMaximum);
  const x = reel(rayon.alea, rayon.valeur, largeur - rayon.valeur);
  const y = reel(x.alea, rayon.valeur, hauteur - rayon.valeur);

  return { centre: { x: x.valeur, y: y.valeur }, rayon: rayon.valeur, alea: y.alea };
}

/** Applique l'effet de chaque zone a ce qu'elle contient. */
export function appliquerLesEffetsDeZone(etat: EtatPartie, dtMs: number): EtatPartie {
  let courant = etat;

  for (const zone of Object.values(etat.zones)) {
    courant = appliquerUneZone(courant, zone, dtMs);
  }

  return courant;
}

/** Aiguille vers l'effet de la zone. L'invisibilite ne change rien a la simulation. */
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
