/**
 * Le flux d'etat d'une partie: quelle trame part, et a qui.
 *
 * C'EST LE COTE SERVEUR DE L'ETAPE 2.3. Le format lui-meme (images, deltas,
 * arrondis) vit dans @neon-ninja/shared, partage avec le client qui decode. Ce
 * fichier decide seulement de la POLITIQUE d'envoi, et il retient, pour une
 * partie, ce qu'il faut pour coder le delta suivant.
 *
 * TROIS REGLES.
 *
 *   1. UNE SEULE TRAME PAR BATTEMENT POUR TOUTE LA SALLE. Elle est codee une fois
 *      et part a tous, par rapport a la trame precedente de la partie. C'est ce
 *      que l'etape 2.2 avait pose pour l'instantane JSON, et que le delta garde.
 *   2. LE PREMIER BATTEMENT EST UNE IMAGE, et une image repart a toute la salle a
 *      intervalle regulier. Le transport livre tout, dans l'ordre: un client
 *      present depuis le debut detient donc toujours la trame que suppose un
 *      delta. L'image reguliere n'est qu'une assurance contre une faute que rien
 *      ne laisse prevoir, un client qui aurait decroche se recalant sans qu'aucun
 *      message ne remonte au serveur. Elle coute peu: une image pese quelques
 *      kilo-octets.
 *   3. QUI ENTRE DANS UNE PARTIE EN COURS RECOIT SA PROPRE IMAGE, juste apres le
 *      delta du battement suivant, qu'il ignore faute de reference. Il applique
 *      ensuite les deltas de la salle comme tout le monde.
 *
 * AUCUN ETAT GLOBAL: un flux par partie, cree par la couche reseau et oublie avec
 * la partie.
 *
 * DEPUIS L'ETAPE 2.9, UNE TRAME PAR VUE. Le serveur decide ce que chaque joueur recoit
 * (vues.ts). FluxDEtat, plus bas, reste le flux d'une seule vue, avec ses trois regles;
 * FluxParVue en tient un par vue, et la regle 1 devient: une trame par battement pour
 * tous ceux qui partagent une vue. Hors Chasse, tout le monde partage la vue commune:
 * c'est la trame unique d'avant.
 */

import type { InstantanePartie } from '@neon-ninja/shared';
import { encoderDelta, encoderImage } from '@neon-ninja/shared';

import type { CleDeVue } from './vues.js';

/**
 * Tous les combien de battements une image repart a toute la salle.
 *
 * Cent battements, soit cinq secondes: un client decroche se recale dans ce delai,
 * pour quelques pour cent de bande passante en plus (mesure dans
 * docs/mesures/charge-serveur.md, section 12).
 */
export const BATTEMENTS_ENTRE_DEUX_IMAGES = 100;

/** Refuse une cadence d'images qui n'est pas un nombre entier de battements, un au moins. */
function verifierLaCadence(battementsEntreDeuxImages: number): void {
  if (!Number.isInteger(battementsEntreDeuxImages) || battementsEntreDeuxImages < 1) {
    throw new Error(
      `Une image doit repartir au moins tous les ${String(battementsEntreDeuxImages)} battements.`,
    );
  }
}

/** Les nouveaux venus d'un battement, et l'image a leur envoyer. */
export interface ImagesAttendues {
  readonly destinataires: readonly string[];
  readonly image: Uint8Array;
}

/** Le flux d'etat d'une partie. */
export class FluxDEtat {
  /** La partie telle que la derniere trame l'a decrite, arrondie: la reference du delta suivant. */
  private reference: InstantanePartie | undefined;

  /** Trames codees depuis le debut. */
  private trames = 0;

  /** L'image du dernier battement, si ce battement en a code une. */
  private imageDuBattement: Uint8Array | undefined;

  /** Les connexions entrees en cours de partie, qui attendent leur image. */
  private readonly nouveauxVenus = new Set<string>();

  /**
   * @param battementsEntreDeuxImages Cadence des images envoyees a toute la salle.
   */
  constructor(private readonly battementsEntreDeuxImages = BATTEMENTS_ENTRE_DEUX_IMAGES) {
    verifierLaCadence(battementsEntreDeuxImages);
  }

  /**
   * La trame d'un battement, pour toute la salle: une image ou un delta.
   *
   * A appeler une fois par battement, avec l'instantane de ce battement.
   */
  trameDuBattement(instantane: InstantanePartie): Uint8Array {
    const image =
      this.reference === undefined || this.trames % this.battementsEntreDeuxImages === 0;
    const codee =
      image || this.reference === undefined
        ? encoderImage(instantane)
        : encoderDelta(this.reference, instantane);

    this.reference = codee.reference;
    this.trames += 1;
    this.imageDuBattement = image ? codee.octets : undefined;

    // Une image partie a toute la salle sert aussi aux nouveaux venus: ils etaient
    // deja dans la salle quand elle est partie.
    if (image) {
      this.nouveauxVenus.clear();
    }

    return codee.octets;
  }

  /**
   * Retient qu'une connexion vient d'entrer dans la partie en cours: elle recevra
   * son image au prochain battement.
   */
  attendreUneImage(idConnexion: string): void {
    this.nouveauxVenus.add(idConnexion);
  }

  /**
   * Les connexions qui attendent leur image, et cette image; la liste est videe.
   *
   * A appeler juste apres avoir envoye la trame du battement: l'image decrit le
   * meme battement, et le nouveau venu, qui a ignore le delta, repart d'elle.
   *
   * @returns Rien si personne n'attend.
   */
  imagesAttendues(): ImagesAttendues | undefined {
    if (this.nouveauxVenus.size === 0 || this.reference === undefined) {
      return undefined;
    }

    const image = this.imageDuBattement ?? encoderImage(this.reference).octets;
    this.imageDuBattement = image;

    const destinataires = [...this.nouveauxVenus];
    this.nouveauxVenus.clear();

    return { destinataires, image };
  }
}

/** Une trame a envoyer, et les connexions qui la recoivent. */
export interface EnvoiDeTrame {
  readonly destinataires: readonly string[];
  readonly trame: Uint8Array;
}

/**
 * Le flux d'etat d'une partie, vue par vue (etape 2.9).
 *
 * UNE REFERENCE DE DELTA PAR VUE. Chaque vue a son FluxDEtat: une image au premier
 * battement, une image reguliere, un delta sinon, code une fois pour tous ceux qui la
 * recoivent.
 *
 * UNE IMAGE, ET PAS LE DELTA, A QUI CHANGE DE VUE. Deux vues d'un meme battement portent le
 * meme numero: un client qui recevrait le delta de sa nouvelle vue l'appliquerait sur
 * l'ancienne, faute de pouvoir les distinguer, et dessinerait un etat faux. Qui entre, change
 * de vue, ou attend une image recoit donc l'image de sa vue, seule. Une proie infectee passe
 * ainsi de la vue commune a celle des traqueurs.
 *
 * UNE VUE QUE PERSONNE NE RECOIT EST OUBLIEE: elle repartira d'une image.
 */
export class FluxParVue {
  /** Le flux de chaque vue recue au dernier battement. */
  private readonly flux = new Map<CleDeVue, FluxDEtat>();

  /** La vue de chaque connexion au dernier battement. */
  private vuesDesConnexions: ReadonlyMap<string, CleDeVue> = new Map();

  /** Les connexions qui doivent recevoir une image, quoi qu'elles aient recu avant. */
  private readonly enAttente = new Set<string>();

  /**
   * @param battementsEntreDeuxImages Cadence des images envoyees a tous ceux d'une vue.
   */
  constructor(private readonly battementsEntreDeuxImages = BATTEMENTS_ENTRE_DEUX_IMAGES) {
    verifierLaCadence(battementsEntreDeuxImages);
  }

  /**
   * Retient qu'une connexion vient d'entrer, ou de revenir, dans la partie en cours: elle
   * recevra l'image de sa vue au prochain battement.
   */
  attendreUneImage(idConnexion: string): void {
    this.enAttente.add(idConnexion);
  }

  /**
   * Les trames d'un battement, et a qui les envoyer.
   *
   * A appeler une fois par battement, avec toutes les connexions de la partie.
   *
   * @param vues La vue de chaque cle, pour ce battement.
   * @param destinataires La cle de chaque connexion de la partie.
   * @throws Error si une connexion attend une vue qui n'est pas fournie.
   */
  envoisDuBattement(
    vues: ReadonlyMap<CleDeVue, InstantanePartie>,
    destinataires: ReadonlyMap<string, CleDeVue>,
  ): readonly EnvoiDeTrame[] {
    const trames = this.coderLesVues(vues, new Set(destinataires.values()));
    const aJour = new Map<CleDeVue, string[]>();
    const envois: EnvoiDeTrame[] = [];

    for (const [idConnexion, cle] of destinataires) {
      if (this.vuesDesConnexions.get(idConnexion) === cle && !this.enAttente.has(idConnexion)) {
        aJour.set(cle, [...(aJour.get(cle) ?? []), idConnexion]);
      } else {
        this.enAttente.delete(idConnexion);
        this.fluxDeLaVue(cle).attendreUneImage(idConnexion);
      }
    }

    for (const [cle, trame] of trames) {
      const suivent = aJour.get(cle) ?? [];
      const images = this.fluxDeLaVue(cle).imagesAttendues();

      // Une image partie a tous ceux de la vue sert aussi aux nouveaux: un seul envoi.
      if (images !== undefined && images.image === trame) {
        envois.push({ destinataires: [...suivent, ...images.destinataires], trame });
        continue;
      }

      if (suivent.length > 0) {
        envois.push({ destinataires: suivent, trame });
      }

      if (images !== undefined) {
        envois.push({ destinataires: images.destinataires, trame: images.image });
      }
    }

    this.vuesDesConnexions = new Map(destinataires);

    return envois;
  }

  /**
   * Code la trame de chaque vue recue, et oublie les vues que plus personne ne recoit.
   */
  private coderLesVues(
    vues: ReadonlyMap<CleDeVue, InstantanePartie>,
    recues: ReadonlySet<CleDeVue>,
  ): ReadonlyMap<CleDeVue, Uint8Array> {
    for (const cle of [...this.flux.keys()]) {
      if (!recues.has(cle)) {
        this.flux.delete(cle);
      }
    }

    const trames = new Map<CleDeVue, Uint8Array>();

    for (const cle of recues) {
      const vue = vues.get(cle);

      if (vue === undefined) {
        throw new Error(`La vue « ${cle} » est attendue, et n'a pas ete fournie.`);
      }

      trames.set(cle, this.fluxDeLaVue(cle).trameDuBattement(vue));
    }

    return trames;
  }

  /** Le flux d'une vue, cree a son premier besoin. */
  private fluxDeLaVue(cle: CleDeVue): FluxDEtat {
    const existant = this.flux.get(cle);

    if (existant !== undefined) {
      return existant;
    }

    const flux = new FluxDEtat(this.battementsEntreDeuxImages);
    this.flux.set(cle, flux);

    return flux;
  }
}
