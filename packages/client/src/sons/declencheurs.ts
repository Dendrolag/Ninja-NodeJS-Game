/**
 * Quel fait de jeu produit quel son.
 *
 * FONCTIONS PURES, TESTABLES SANS HAUT-PARLEUR. Elles traduisent ce qui vient
 * d'arriver en noms de sons; jouer ces sons est le travail de lecteur.ts. C'est
 * la meme separation que partout ailleurs dans ce paquet: ce qui decide se teste,
 * ce qui touche au navigateur ne decide rien.
 *
 * RECONCILIATION AVEC LA FICHE DE L'ETAPE. Elle demandait de « brancher
 * AudioManager sur les evenements sonores (playerSound) ». Cet evenement
 * n'existe pas, et son absence est une decision de l'etape 2.2, inscrite dans le
 * contrat: le jeu d'origine faisait transiter les sons par le serveur, qui
 * renvoyait a chaque client les sons a jouer. Cela consommait de la bande
 * passante pour une information que le client possede deja, et cela mettait le
 * serveur au courant d'un reglage purement local. Ici, le son est declenche par
 * le fait de jeu recu, chez celui qui le recoit.
 *
 * DEUX SOURCES, PARCE QU'IL Y A DEUX NATURES DE MESSAGES. Un son peut naitre
 * d'une NOTIFICATION (« je viens d'etre capture ») ou d'un CHANGEMENT D'ETAT
 * (« la partie vient de commencer », « il reste dix secondes »). La premiere
 * famille est traitee par sonDuFait, la seconde par sonsDuChangement, qui compare
 * deux etats successifs. Aucune des deux ne retient quoi que ce soit.
 *
 * DEUX DEFAUTS DU JEU D'ORIGINE SONT CORRIGES AU PASSAGE.
 *
 *   1. Son client demandait des sons qui n'existaient pas dans sa table:
 *      « collectBonus » et « collectMalus » a chaque ramassage, alors que la
 *      table s'appelait « bonus » et « malus ». La lecture echouait en silence:
 *      les sons de ramassage n'ont jamais ete entendus. Ici la table est un type,
 *      et un nom qui n'existe pas ne compile pas.
 *   2. Son gestionnaire audio chargeait une musique de fin de partie absente des
 *      ressources. Le chargement de TOUT l'audio echouait donc a cette ligne, et
 *      son indicateur « pret » restait faux pour toujours.
 */

import type { NomDeSon } from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';
import type { FaitDeJeu } from '../faits.js';

/**
 * Le son que declenche une notification, s'il y en a un.
 *
 * Rendre undefined est un cas ordinaire: tous les faits ne font pas de bruit. Une
 * arrivee et un depart, par exemple, s'ecrivent dans le fil sans s'entendre.
 */
export function sonDuFait(fait: FaitDeJeu): NomDeSon | undefined {
  switch (fait.nature) {
    case 'bonusActive':
      return 'bonusRamasse';

    case 'malusRamasse':
    case 'malusSubi':
      return 'malusRamasse';

    case 'captureReussie':
      return 'joueurCapture';

    case 'captureSubie':
    case 'captureParBotNoir':
      return 'joueurCaptureSubi';

    case 'botNoirDetruit':
      return 'botNoirDetruit';

    case 'joueurArrive':
    case 'joueurParti':
      return undefined;
  }
}

/**
 * A partir de combien de temps restant la partie se met a presser.
 *
 * Le jeu d'origine passait son minuteur en alerte a dix secondes.
 */
export const SEUIL_TEMPS_PRESSE_MS = 10_000;

/**
 * Les sons que produit le passage d'un etat au suivant.
 *
 * COMPARER DEUX ETATS PLUTOT QUE DE RETENIR DES DRAPEAUX. Le jeu d'origine
 * gardait une poignee de booleens pour savoir s'il avait deja joue tel son, et
 * devait penser a les remettre a zero a chaque debut de partie, ce qu'il oubliait
 * dans deux des cinq chemins qui redemarraient une partie. Ici, il n'y a rien a
 * remettre a zero: la difference entre deux etats dit tout.
 */
export function sonsDuChangement(precedent: EtatClient, courant: EtatClient): readonly NomDeSon[] {
  const sons: NomDeSon[] = [];

  if (precedent.ecran !== 'jeu' && courant.ecran === 'jeu') {
    sons.push('partieLancee');
  }

  if (precedent.fin === undefined && courant.fin !== undefined) {
    sons.push('partieTerminee');
  }

  const avant = precedent.compteARebours?.secondesRestantes;
  const apres = courant.compteARebours?.secondesRestantes;

  if (apres !== undefined && apres !== avant) {
    // Le dernier battement a son propre son: c'est ce qui fait comprendre a
    // l'oreille que la partie part maintenant.
    sons.push(apres <= 1 ? 'compteAReboursFinal' : 'compteARebours');
  }

  if (courant.messages.length > precedent.messages.length) {
    sons.push('chat');
  }

  if (battementDeFin(precedent.partie?.tempsRestantMs, courant.partie?.tempsRestantMs)) {
    sons.push('tempsPresqueEcoule');
  }

  return sons;
}

/**
 * Faut-il faire entendre le battement des dernieres secondes.
 *
 * Le son se joue une fois par seconde entamee, et pas a chaque battement recu: on
 * compare donc la seconde du battement precedent a celle du battement courant.
 */
export function battementDeFin(
  precedentMs: number | undefined,
  courantMs: number | undefined,
): boolean {
  if (precedentMs === undefined || courantMs === undefined) {
    return false;
  }

  if (courantMs > SEUIL_TEMPS_PRESSE_MS || courantMs <= 0) {
    return false;
  }

  return Math.ceil(courantMs / 1000) !== Math.ceil(precedentMs / 1000);
}
