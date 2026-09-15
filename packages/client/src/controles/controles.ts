/**
 * Les controles: ce que le joueur demande, et quand on l'envoie.
 *
 * CETTE CLASSE NE TOUCHE NI AU DOCUMENT NI AU RESEAU. Elle retient l'etat de la
 * saisie et repond a une seule question: « y a-t-il quelque chose de nouveau a
 * envoyer ». Les evenements du navigateur sont branches dessus par clavier.ts et
 * tactile.ts; l'envoi est fait par l'appelant, qui detient le client. Elle est
 * donc entierement verifiable sans navigateur, ce qui est le point du decoupage.
 *
 * ON N'EMET QUE CE QUI CHANGE, et c'est le changement de fond par rapport au jeu
 * d'origine. Son movePlayer tournait sur une minuterie et envoyait un message a
 * chaque tour, meme quand le joueur ne touchait a rien: cinquante messages par
 * seconde et par joueur pour dire « je ne bouge pas ». Ici, maintenir une touche
 * n'envoie qu'un seul message, celui du moment ou elle a ete enfoncee.
 *
 * C'EST LE SERVEUR QUI REND CELA POSSIBLE. Depuis l'etape 2.1, il conserve la
 * derniere intention connue d'un joueur d'un battement a l'autre: un joueur qui
 * maintient sa touche n'a rien a repeter. Et le transport garantit l'ordre et la
 * remise des messages, donc une intention envoyee une fois est une intention
 * recue. Si le transport changeait pour un canal sans garantie, il faudrait
 * reintroduire une repetition, et c'est ici qu'elle se poserait.
 *
 * LA CAPTURE N'EST PAS UNE INTENTION, ET ELLE N'EXISTE QU'EN MODE TACTIQUE. En
 * Classique, on capture en touchant: le moteur resout le contact, il n'y a rien a
 * declencher. En Tactique (etape 7.1), le joueur tire, par la barre d'espace ou par
 * le bouton de capture. Un tir est un geste ponctuel, pas un etat qui dure: il ne se
 * compare pas a la demande precedente, il est retenu jusqu'a ce que la boucle le
 * prenne, puis il part une fois.
 */

import type { IntentionDeplacement, Vecteur } from '@neon-ninja/shared';

import type { DirectionsDemandees } from './intention.js';
import {
  AUCUNE_DIRECTION,
  IMMOBILE,
  intentionDepuisDirections,
  intentionDepuisManette,
  memeIntention,
} from './intention.js';
import { directionsDepuisTouches, nomDeTouche } from './touches.js';

/** L'etat de saisie d'un joueur, et ce qu'il reste a annoncer. */
export class Controles {
  private readonly enfoncees = new Set<string>();
  private manetteActive = false;
  private ecartManette: Vecteur = { x: 0, y: 0 };
  private rayonManette = 0;

  /** La derniere intention effectivement envoyee. */
  private derniereEmise: IntentionDeplacement = IMMOBILE;

  /** Une touche vient d'etre enfoncee. */
  enfoncer(touche: string): void {
    this.enfoncees.add(nomDeTouche(touche));
  }

  /** Une touche vient d'etre relachee. */
  relacher(touche: string): void {
    this.enfoncees.delete(nomDeTouche(touche));
  }

  /**
   * Le pouce a bouge sur la manette virtuelle.
   *
   * @param ecart Deplacement depuis le centre de la manette, en pixels.
   * @param rayon Rayon de la manette, en pixels.
   */
  deplacerLaManette(ecart: Vecteur, rayon: number): void {
    this.manetteActive = true;
    this.ecartManette = ecart;
    this.rayonManette = rayon;
  }

  /** Le pouce a quitte la manette. */
  relacherLaManette(): void {
    this.manetteActive = false;
    this.ecartManette = { x: 0, y: 0 };
  }

  /**
   * Tout relacher d'un coup.
   *
   * Appele quand la fenetre perd le focus. Sans cela, un joueur qui change
   * d'onglet en courant continue de courir: le navigateur ne lui enverra jamais
   * le relachement de sa touche, et le serveur garde la derniere intention.
   * C'est un defaut connu du jeu d'origine.
   */
  toutRelacher(): void {
    this.enfoncees.clear();
    this.relacherLaManette();
  }

  /** Les directions demandees en ce moment, clavier et manette confondus. */
  directions(): DirectionsDemandees {
    return this.enfoncees.size === 0 ? AUCUNE_DIRECTION : directionsDepuisTouches(this.enfoncees);
  }

  /** L'intention correspondant a la saisie du moment. */
  intention(): IntentionDeplacement {
    // La manette l'emporte quand un pouce y est pose: sur un appareil tactile,
    // c'est la seule saisie, et sur un appareil qui a les deux, c'est la
    // derniere sollicitee qui compte.
    if (this.manetteActive) {
      return intentionDepuisManette(this.ecartManette, this.rayonManette);
    }

    return intentionDepuisDirections(this.directions());
  }

  /**
   * Ce qu'il faut envoyer maintenant, ou rien si l'intention n'a pas change.
   *
   * A appeler a chaque image. Rendre undefined est le cas ordinaire: un joueur
   * qui court en ligne droite n'emet plus rien apres son premier message.
   */
  aEmettre(): IntentionDeplacement | undefined {
    const voulue = this.intention();

    if (memeIntention(voulue, this.derniereEmise)) {
      return undefined;
    }

    this.derniereEmise = voulue;

    return voulue;
  }

  /** Une demande de localisation attend-elle d'etre servie. */
  private localisationDemandee = false;

  /**
   * Le joueur demande a retrouver son personnage: touche F, ou bouton sur mobile.
   *
   * Ce n'est pas une intention: rien ne part sur le reseau. Les fleches qui
   * designent le personnage sont un affichage local, que la boucle de rendu
   * declenche en lisant cette demande.
   */
  demanderLaLocalisation(): void {
    this.localisationDemandee = true;
  }

  /**
   * Y a-t-il une demande de localisation en attente. La lire la consomme.
   *
   * Lire et effacer d'un coup garantit qu'une demande n'est servie qu'une fois,
   * meme si la boucle la lit a chaque image.
   */
  prendreLaDemandeDeLocalisation(): boolean {
    const demandee = this.localisationDemandee;
    this.localisationDemandee = false;

    return demandee;
  }

  /** Une demande de tir attend-elle d'etre envoyee. */
  private tirDemande = false;

  /** Le joueur tire: barre d'espace, ou bouton de capture (mode Tactique). */
  demanderUnTir(): void {
    this.tirDemande = true;
  }

  /**
   * Y a-t-il un tir a envoyer. La lire la consomme, comme la demande de localisation:
   * un tir demande part une fois, meme si la boucle la lit a chaque image. Deux
   * demandes entre deux images n'en font qu'une, comme deux demandes entre deux
   * battements cote serveur.
   */
  prendreLaDemandeDeTir(): boolean {
    const demande = this.tirDemande;
    this.tirDemande = false;

    return demande;
  }

  /**
   * Repart de zero: plus rien d'enfonce, et la prochaine intention sera emise.
   *
   * Appele a l'entree en partie. Sans la remise a zero de la derniere intention
   * emise, un joueur qui entre dans une partie en tenant deja sa touche
   * n'enverrait rien, parce que son intention n'aurait pas change depuis la
   * partie precedente.
   */
  reinitialiser(): void {
    this.toutRelacher();
    this.derniereEmise = IMMOBILE;
    this.localisationDemandee = false;
    this.tirDemande = false;
  }
}
