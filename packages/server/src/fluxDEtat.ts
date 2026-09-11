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
 */

import type { InstantanePartie } from '@neon-ninja/shared';
import { encoderDelta, encoderImage } from '@neon-ninja/shared';

/**
 * Tous les combien de battements une image repart a toute la salle.
 *
 * Cent battements, soit cinq secondes: un client decroche se recale dans ce delai,
 * pour quelques pour cent de bande passante en plus (mesure dans
 * docs/mesures/charge-serveur.md, section 12).
 */
export const BATTEMENTS_ENTRE_DEUX_IMAGES = 100;

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
    if (!Number.isInteger(battementsEntreDeuxImages) || battementsEntreDeuxImages < 1) {
      throw new Error(
        `Une image doit repartir au moins tous les ${String(battementsEntreDeuxImages)} battements.`,
      );
    }
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
